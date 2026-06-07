import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from 'database';

/**
 * TST-009 — Real-Postgres integration witness for the SERIALIZABLE balance-gating
 * path in LeavesService.create().
 *
 * THE GAP this closes
 * -------------------
 * leaves.service.spec.ts mocks $transaction as:
 *   vi.fn(<T>(cb) => cb(mockPrismaService))
 * which re-feeds the same mock client into the callback, so the gate and the
 * write never share a Serializable snapshot. A real bug where two concurrent
 * requests both read "5 days available" and both insert 3 days (overdrawn by 1)
 * passes every mock-based assertion.
 *
 * WHAT IS TESTED
 * --------------
 * Two Prisma clients open SERIALIZABLE $transaction callbacks concurrently.
 * Both read the leaveBalance snapshot (5 days allocated) before either writes.
 * Both attempt to insert a 3-day leave (combined 6 > 5 days — an overdraw).
 * Under SERIALIZABLE isolation Postgres detects the write-skew via SSI and
 * aborts one transaction with SQLSTATE 40001 (serialization_failure / P2034).
 * After both settle, total consumed days MUST be ≤ 5 (the allocated balance).
 *
 * RED/GREEN mutation method
 * -------------------------
 * Run with MUTATION_WITNESS=1 to activate the READ COMMITTED variant where
 * both inserts succeed → total = 6 > 5 → assertion fails → RED.
 *
 * RED captured:
 *   MUTATION_WITNESS=1 pnpm --filter api test:integration \
 *     src/leaves/leaves-balance-gating.int.spec.ts
 *   → AssertionError: expected total consumed days (6) to be ≤ balance (5)
 *
 * DESIGN BOUNDARY
 * ---------------
 * Two $transaction callbacks are interleaved via a JS Promise barrier
 * (both callbacks await `bothHaveRead` after their gate read). The barrier
 * guarantees the reads overlap before either write, producing the write-skew
 * scenario that SSI detects. This exercises the exact Postgres isolation
 * semantics that protect the production path, without needing to call the
 * full service (which would require mocking 4 collaborators).
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db1 = new PrismaClient();
const db2 = new PrismaClient();

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Count total committed days for a user+leaveType (any non-REJECTED leave). */
async function consumedDays(
  db: PrismaClient,
  userId: string,
  leaveTypeId: string,
): Promise<number> {
  const rows = await db.$queryRawUnsafe<{ total: string }[]>(
    `SELECT COALESCE(SUM(days), 0)::text AS total
     FROM "leaves"
     WHERE "userId" = $1
       AND "leave_type_id" = $2
       AND status != 'REJECTED'::"LeaveStatus"`,
    userId,
    leaveTypeId,
  );
  return parseFloat(rows[0]?.total ?? '0');
}

/**
 * Run two concurrent $transaction callbacks at `isolation`.
 *
 * Each callback:
 *   1. Reads leaveBalance (gate snapshot)
 *   2. Waits at barrier (guarantees overlap)
 *   3. Checks available days; if ≥ 3, inserts 3 days
 *
 * Returns total consumed days after both settle.
 */
async function runConcurrentInserts(
  isolation: Prisma.TransactionIsolationLevel,
  db_a: PrismaClient,
  db_b: PrismaClient,
  userId: string,
  leaveTypeId: string,
): Promise<number> {
  let txn1HasRead = false;
  let txn2HasRead = false;
  let resolveBothHaveRead!: () => void;
  const bothHaveRead = new Promise<void>((res) => {
    resolveBothHaveRead = res;
  });

  const makeTxn =
    (db: PrismaClient, label: '1' | '2') =>
    async (tx: Prisma.TransactionClient): Promise<void> => {
      // Gate read — mirrors production resolveAllocatedDays + getAvailableDays
      const balRows = await tx.$queryRawUnsafe<{ totalDays: string }[]>(
        `SELECT "totalDays"::text AS "totalDays"
         FROM "leave_balances"
         WHERE "userId" = $1 AND "leaveTypeId" = $2`,
        userId,
        leaveTypeId,
      );
      const allocated = parseFloat(balRows[0]?.totalDays ?? '0');

      const usedRows = await tx.$queryRawUnsafe<{ used: string }[]>(
        `SELECT COALESCE(SUM(days), 0)::text AS used
         FROM "leaves"
         WHERE "userId" = $1
           AND "leave_type_id" = $2
           AND status != 'REJECTED'::"LeaveStatus"`,
        userId,
        leaveTypeId,
      );
      const used = parseFloat(usedRows[0]?.used ?? '0');
      const available = allocated - used;

      // Signal: this txn has completed the gate read
      if (label === '1') txn1HasRead = true;
      else txn2HasRead = true;
      if (txn1HasRead && txn2HasRead) resolveBothHaveRead();

      // Barrier: wait until both txns have read (force write-skew window)
      await bothHaveRead;

      // Skip insert if gate says no room (don't throw — let the other txn win)
      if (available < 3) return;

      // Write 3 days — use distinct non-overlapping future dates per transaction
      // to avoid the APPROVED exclusion constraint (leaves_no_overlap).
      // Txn-1 uses June 2099 week 1, txn-2 uses June 2099 week 2 (no overlap).
      const [start, end] =
        label === '1'
          ? ['2099-06-02', '2099-06-04'] // Mon–Wed week 1 (3 working days)
          : ['2099-06-09', '2099-06-11']; // Mon–Wed week 2 (3 working days)
      await tx.$queryRawUnsafe(
        `INSERT INTO "leaves"
           (id, "userId", "leave_type_id", type, "startDate", "endDate",
            days, status, "selfApproved", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'CP'::"LeaveType", $4::date, $5::date,
                 3, 'PENDING'::"LeaveStatus", false, now(), now())`,
        randomUUID(),
        userId,
        leaveTypeId,
        start,
        end,
      );
    };

  const runTxn = (db: PrismaClient, label: '1' | '2'): Promise<void> =>
    db
      .$transaction(makeTxn(db, label), { isolationLevel: isolation })
      .then(() => undefined)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        // P2034 = serialization/write-conflict abort → expected under SSI.
        // Prisma wraps SQLSTATE 40001/40P01 as PrismaClientKnownRequestError
        // with code 'P2034' and a GENERIC message ("Transaction failed due to a
        // write conflict or a deadlock") that contains neither '40001' nor
        // 'could not serialize' — so match on the error CODE first, with the
        // message substrings kept only as a defensive fallback.
        const code = (err as { code?: string } | null)?.code;
        if (
          code === 'P2034' ||
          msg.includes('P2034') ||
          msg.includes('40001') ||
          msg.includes('could not serialize')
        ) {
          return undefined; // absorb — this is the correct rejection
        }
        throw err; // unexpected error — surface it
      });

  await Promise.all([runTxn(db_a, '1'), runTxn(db_b, '2')]);
  return consumedDays(db1, userId, leaveTypeId);
}

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

describe('TST-009 — Serializable balance gating prevents overdraw (real DB)', () => {
  let userId: string;
  let leaveTypeId: string;

  beforeAll(async () => {
    await db1.$connect();
    await db2.$connect();

    const user = await db1.user.create({
      data: {
        email: `tst009-${randomUUID()}@witness.test`,
        login: `tst009-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'TST009',
        lastName: 'Witness',
      },
    });
    userId = user.id;

    // Reuse the existing CP config (seeded by migrate)
    const cp =
      (await db1.leaveTypeConfig.findFirst({ where: { code: 'CP' } })) ??
      (await db1.leaveTypeConfig.create({
        data: { code: 'CP', name: 'Congés payés (TST-009)' },
      }));
    leaveTypeId = cp.id;

    // 5 days total — enough for ONE 3-day leave but not two
    await db1.leaveBalance.create({
      data: {
        userId,
        leaveTypeId,
        year: new Date().getFullYear(),
        totalDays: 5,
      },
    });
  });

  afterAll(async () => {
    await db1.leave.deleteMany({ where: { userId } });
    await db1.leaveBalance.deleteMany({ where: { userId } });
    await db1.user.delete({ where: { id: userId } });
    await db1.$disconnect();
    await db2.$disconnect();
  });

  /**
   * GREEN path (production behaviour): Postgres SSI aborts one of the two
   * concurrent 3-day inserts. Total consumed ≤ 5.
   */
  it(
    'SERIALIZABLE: concurrent 3+3 day inserts on a 5-day balance — at most 3 days committed',
    { timeout: 15000 },
    async () => {
      const total = await runConcurrentInserts(
        Prisma.TransactionIsolationLevel.Serializable,
        db1,
        db2,
        userId,
        leaveTypeId,
      );
      expect(
        total,
        `expected total consumed days (${total}) to be ≤ balance (5)`,
      ).toBeLessThanOrEqual(5);
      expect(total, 'expected at least one insert to succeed').toBeGreaterThan(
        0,
      );
    },
  );
});

// --------------------------------------------------------------------------
// MUTATION WITNESS (run with MUTATION_WITNESS=1 to capture RED)
// --------------------------------------------------------------------------

/**
 * With READ COMMITTED, both transactions see 5 available days and both
 * insert 3 days → total = 6 > 5 → the assertion below is RED.
 *
 * RED captured:
 *   MUTATION_WITNESS=1 pnpm --filter api test:integration \
 *     src/leaves/leaves-balance-gating.int.spec.ts
 *   AssertionError: expected total consumed days (6) to be ≤ balance (5)
 *
 * Skipped by default to avoid dirtying the shared ephemeral DB. The mutation
 * witness uses isolated fixtures (separate user) so it does not interfere with
 * the Serializable test above.
 */
const runMutationWitness = process.env.MUTATION_WITNESS === '1';

describe.skipIf(!runMutationWitness)(
  'TST-009 MUTATION WITNESS — READ COMMITTED overdraw (RED on broken code)',
  () => {
    const db3 = new PrismaClient();
    const db4 = new PrismaClient();
    let userId2: string;
    let leaveTypeId2: string;

    beforeAll(async () => {
      await db3.$connect();
      await db4.$connect();

      const user = await db3.user.create({
        data: {
          email: `tst009-mut-${randomUUID()}@witness.test`,
          login: `tst009-mut-${randomUUID()}`,
          passwordHash: 'x',
          firstName: 'TST009Mut',
          lastName: 'Witness',
        },
      });
      userId2 = user.id;

      const cp =
        (await db3.leaveTypeConfig.findFirst({ where: { code: 'CP' } })) ??
        (await db3.leaveTypeConfig.create({
          data: { code: 'CP', name: 'Congés payés (TST-009 mut)' },
        }));
      leaveTypeId2 = cp.id;

      await db3.leaveBalance.create({
        data: {
          userId: userId2,
          leaveTypeId: leaveTypeId2,
          year: new Date().getFullYear(),
          totalDays: 5,
        },
      });
    });

    afterAll(async () => {
      await db3.leave.deleteMany({ where: { userId: userId2 } });
      await db3.leaveBalance.deleteMany({ where: { userId: userId2 } });
      await db3.user.delete({ where: { id: userId2 } });
      await db3.$disconnect();
      await db4.$disconnect();
    });

    it(
      'READ COMMITTED: both inserts succeed → overdraw (expected RED on broken code)',
      { timeout: 15000 },
      async () => {
        const total = await runConcurrentInserts(
          Prisma.TransactionIsolationLevel.ReadCommitted,
          db3,
          db4,
          userId2,
          leaveTypeId2,
        );
        // This assertion is RED under READ COMMITTED (both inserts land → 6 > 5)
        expect(
          total,
          `expected total consumed days (${total}) to be ≤ balance (5)`,
        ).toBeLessThanOrEqual(5);
      },
    );
  },
);
