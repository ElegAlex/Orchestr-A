import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-023 — real-DB witnesses for the leave no-overlap EXCLUDE constraint added in
 * migration 20260527190000_dat023_leave_no_overlap_exclude.
 *
 *   EXCLUDE USING gist ("userId" WITH =, daterange("startDate","endDate",'[]') WITH &&)
 *   WHERE (status = 'APPROVED')
 *
 * It is the DB floor under leaves.service.ts checkOverlap (which rejects overlaps at
 * create/update with a ConflictException but races: two concurrent creates, or a
 * manager declaring a leave while another approval lands, can slip two overlapping
 * leaves past the application check and both reach APPROVED — the audit Description).
 * A violation surfaces SQLSTATE 23P01 (exclusion_violation) + the constraint name
 * `leaves_no_overlap`.
 *
 * Three properties the constraint encodes, each pinned by a test:
 *   - partial WHERE (status='APPROVED'): only APPROVED leaves mutually exclude, and
 *     the constraint re-checks on UPDATE when a row ENTERS the predicate
 *     (PENDING → APPROVED) — the audit's exact race path;
 *   - '[]' inclusive bounds: a leave ending Mar 5 and one starting Mar 5 overlap;
 *   - userId scoping: overlap is only forbidden within one user.
 *
 * 7 tests: 3 negatives (INSERT two APPROVED overlapping; the inclusive-bound
 * adjacency [Mar1,Mar5]+[Mar5,Mar10]; the PENDING→APPROVED race via UPDATE), 3
 * positives (PENDING+APPROVED overlap accepted; different-user overlap accepted;
 * same-user non-overlapping accepted), and 1 catalog pin asserting the constraint
 * exists by name (catches a silent rename if migrate dev ever runs drift-clean).
 *
 * Negatives use raw SQL ($executeRawUnsafe) so the driver surfaces the SQLSTATE /
 * constraint name verbatim. Pre-migration the offending writes are accepted (the
 * FAIL-pre the contract demands); post-migration the DB rejects them. Each test
 * uses its own throwaway user so leaves from one test cannot collide with another
 * (the suite runs serially but shares one DB). Runs against the ephemeral migrated
 * DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert a raw INSERT/UPDATE is rejected by the no-overlap EXCLUDE. Teeth by
 * construction: if the constraint is absent (FAIL-pre) the write is accepted,
 * `message` stays empty, and the 23P01 assertion fails loudly — a vacuous green is
 * impossible.
 */
async function expectOverlapRejected(write: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await write;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected an exclusion_violation (23P01) but the write was accepted',
  ).toMatch(/23P01/);
  expect(message).toContain('leaves_no_overlap');
}

describe('DAT-023 — leaves no-overlap EXCLUDE constraint (real DB)', () => {
  let leaveTypeId: string;

  beforeAll(async () => {
    await db.$connect();
    // The migrated DB seeds a 'CP' config (code is @unique); reuse it, else create.
    const cp =
      (await db.leaveTypeConfig.findFirst({ where: { code: 'CP' } })) ??
      (await db.leaveTypeConfig.create({
        data: { code: 'CP', name: 'Congés payés (DAT-023 witness)' },
      }));
    leaveTypeId = cp.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Create a fresh throwaway user; returns its id. */
  async function mkUser(label: string): Promise<string> {
    const u = await db.user.create({
      data: {
        email: `dat023-${label}-${randomUUID()}@witness.test`,
        login: `dat023-${label}-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat023',
        lastName: 'Witness',
      },
    });
    return u.id;
  }

  /**
   * Raw INSERT of a leave (bypasses the service, so the DB constraint fires).
   * Dates are ISO 'YYYY-MM-DD'. Returns the new row id.
   */
  function insertLeave(
    userId: string,
    startDate: string,
    endDate: string,
    status: 'PENDING' | 'APPROVED',
  ): Promise<unknown> {
    return db.$executeRawUnsafe(
      `INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3::date, $4::date, 1, $5::"LeaveStatus", now())`,
      userId,
      leaveTypeId,
      startDate,
      endDate,
      status,
    );
  }

  // Negative #1 — two APPROVED leaves, same user, overlapping ranges. The 2nd is
  // rejected (23P01 + leaves_no_overlap). The core invariant.
  it('rejects two APPROVED leaves for the same user with overlapping ranges', async () => {
    const u = await mkUser('overlap');
    await insertLeave(u, '2026-03-01', '2026-03-10', 'APPROVED'); // accepted
    await expectOverlapRejected(
      insertLeave(u, '2026-03-05', '2026-03-15', 'APPROVED'),
    );
  });

  // Negative #2 — inclusive-bound adjacency: leave1 ends Mar 5, leave2 starts Mar 5.
  // Only '[]' (both bounds inclusive) flags this as an overlap; '[)' or '()' would
  // not. Proves the daterange bound mode discriminately.
  it('rejects APPROVED leaves where one ends and the next starts on the same day ([] bounds)', async () => {
    const u = await mkUser('adjacent');
    await insertLeave(u, '2026-04-01', '2026-04-05', 'APPROVED'); // accepted
    await expectOverlapRejected(
      insertLeave(u, '2026-04-05', '2026-04-10', 'APPROVED'),
    );
  });

  // Negative #3 — the audit's exact race path. Two overlapping PENDING leaves both
  // exist (partial WHERE excludes PENDING). Approving the first is fine; approving
  // the second makes it ENTER the WHERE predicate against an already-APPROVED
  // overlapping row → the EXCLUDE re-checks on UPDATE and rejects it.
  it('rejects the second PENDING→APPROVED transition when ranges overlap (the race path)', async () => {
    const u = await mkUser('race');
    const l1 = await db.leave.create({
      data: {
        userId: u,
        leaveTypeId,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-05'),
        days: 5,
        status: 'PENDING',
      },
    });
    const l2 = await db.leave.create({
      data: {
        userId: u,
        leaveTypeId,
        startDate: new Date('2026-05-03'),
        endDate: new Date('2026-05-07'),
        days: 5,
        status: 'PENDING',
      },
    });
    // First approval: no other APPROVED row yet → accepted.
    await expect(
      db.$executeRawUnsafe(
        `UPDATE "leaves" SET status = 'APPROVED'::"LeaveStatus" WHERE id = $1`,
        l1.id,
      ),
    ).resolves.toBe(1);
    // Second approval enters the predicate against l1 → rejected.
    await expectOverlapRejected(
      db.$executeRawUnsafe(
        `UPDATE "leaves" SET status = 'APPROVED'::"LeaveStatus" WHERE id = $1`,
        l2.id,
      ),
    );
  });

  // Positive #1 — same user, overlapping ranges, but one is PENDING. The partial
  // WHERE only constrains APPROVED rows, so both are accepted.
  it('ACCEPTS overlapping leaves for the same user when one is PENDING (partial WHERE)', async () => {
    const u = await mkUser('pending');
    await expect(
      insertLeave(u, '2026-06-01', '2026-06-10', 'APPROVED'),
    ).resolves.toBeDefined();
    await expect(
      insertLeave(u, '2026-06-05', '2026-06-15', 'PENDING'),
    ).resolves.toBeDefined();
  });

  // Positive #2 — two APPROVED leaves with identical overlapping ranges but for
  // DIFFERENT users. The "userId" WITH = key scopes the exclusion per user, so both
  // are accepted (proves it is not a global calendar lock).
  it('ACCEPTS overlapping APPROVED leaves for DIFFERENT users (userId scoping)', async () => {
    const u1 = await mkUser('userA');
    const u2 = await mkUser('userB');
    await expect(
      insertLeave(u1, '2026-07-01', '2026-07-10', 'APPROVED'),
    ).resolves.toBeDefined();
    await expect(
      insertLeave(u2, '2026-07-01', '2026-07-10', 'APPROVED'),
    ).resolves.toBeDefined();
  });

  // Positive #3 — two APPROVED leaves, same user, non-overlapping (a clear gap).
  // Even under inclusive '[]' bounds these do not touch, so both are accepted.
  it('ACCEPTS non-overlapping APPROVED leaves for the same user', async () => {
    const u = await mkUser('gap');
    await expect(
      insertLeave(u, '2026-08-01', '2026-08-05', 'APPROVED'),
    ).resolves.toBeDefined();
    await expect(
      insertLeave(u, '2026-08-12', '2026-08-15', 'APPROVED'),
    ).resolves.toBeDefined();
  });

  // Catalog pin — assert the EXCLUDE constraint exists by name. Mirrors the DAT-016
  // pg_indexes pin: catches a silent rename if a future drift-clean migrate dev ever
  // regenerates the constraint under a different name.
  it('pins the constraint name leaves_no_overlap in pg_constraint', async () => {
    const rows = await db.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'leaves'::regclass AND contype = 'x'`,
    );
    expect(rows.map((r) => r.conname)).toContain('leaves_no_overlap');
  });
});
