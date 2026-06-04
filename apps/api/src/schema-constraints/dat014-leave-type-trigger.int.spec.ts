import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-014 — real-DB witness for the leaves.type auto-sync trigger added in
 * migration 20260527150000_dat014_leave_type_autosync_trigger.
 *
 * The Leave model keeps a legacy enum column `type "LeaveType"` alongside the FK
 * `leave_type_id → leave_type_configs`. The audit's failure mode is drift: a
 * write that sets `type` inconsistently with the config's `code` leaves the two
 * descriptors disagreeing. Dropping the column (the audit's primary fix) is
 * blocked by active frontend consumers of `leave.type`, so DAT-014 takes the
 * stopgap path: a BEFORE INSERT OR UPDATE trigger that DERIVES `type` from the
 * joined config code, making the column a read-only mirror of the FK.
 *
 * Witness shape — COERCION, not rejection. Invariant #2 is phrased for a
 * validate-and-reject trigger ("rejected … P0001"); the chosen auto-sync style
 * overwrites NEW.type instead of erroring (a conscious deviation blessed by the
 * task's bail-condition language — see DAT-014 Learnings). The analog of
 * FAIL-pre/PASS-post is therefore: a raw INSERT/UPDATE that sets a WRONG `type`
 * persists that wrong value pre-migration (FAIL-pre), and reads back coerced to
 * the FK-derived value post-migration (PASS-post). Teeth by construction: if the
 * trigger were absent the wrong value would survive and every assertion below
 * would fail loudly — a vacuous green is impossible.
 *
 * Enum-mapping mirrors leaves.service.ts: the config code is stored verbatim if
 * it is a "LeaveType" member, otherwise 'OTHER'. Both branches are exercised
 * (CP → 'CP'; a non-enum custom code → 'OTHER').
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 * Raw SQL is used for the leaves writes so the trigger acts on the literal column
 * value, then the value is read back via raw SELECT.
 */

const db = new PrismaClient();

/** Read the persisted `type` of a leave row straight from the column. */
async function readLeaveType(id: string): Promise<string | null> {
  const rows = await db.$queryRawUnsafe<{ type: string | null }[]>(
    `SELECT "type"::text AS type FROM "leaves" WHERE id = $1`,
    id,
  );
  return rows[0]?.type ?? null;
}

describe('DAT-014 — leaves.type auto-sync trigger (real DB)', () => {
  let userId: string;
  let cpConfigId: string; // code 'CP' — a "LeaveType" enum member
  let customConfigId: string; // non-enum code — must map to OTHER

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat014-${randomUUID()}@witness.test`,
        login: `dat014-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat014',
        lastName: 'Witness',
      },
    });
    userId = user.id;

    // The migrated DB already seeds a 'CP' config (code is @unique), so reuse it
    // rather than creating a duplicate.
    const cp =
      (await db.leaveTypeConfig.findFirst({ where: { code: 'CP' } })) ??
      (await db.leaveTypeConfig.create({
        data: { code: 'CP', name: 'Congés payés (DAT-014 witness)' },
      }));
    cpConfigId = cp.id;

    const custom = await db.leaveTypeConfig.create({
      // A code that is NOT a member of the "LeaveType" enum → must coerce to OTHER.
      data: {
        code: `CUSTOM_${randomUUID().slice(0, 8)}`,
        name: 'Custom type (DAT-014)',
      },
    });
    customConfigId = custom.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Insert a leave with an explicit (possibly wrong) `type`, return its id. */
  async function insertLeave(
    leaveTypeId: string,
    type: string | null,
  ): Promise<string> {
    const id = randomUUID();
    const typeSql = type === null ? 'NULL' : `'${type}'::"LeaveType"`;
    await db.$executeRawUnsafe(
      `INSERT INTO "leaves" (id, "userId", "leave_type_id", "type", "startDate", "endDate", days, status, "updatedAt")
       VALUES ($1, $2, $3, ${typeSql}, DATE '2026-03-01', DATE '2026-03-02', 1, 'PENDING', now())`,
      id,
      userId,
      leaveTypeId,
    );
    return id;
  }

  it('INSERT: a wrong type against a CP config is coerced to CP', async () => {
    // FAIL-pre: 'RTT' would persist. PASS-post: trigger derives 'CP' from the FK.
    const id = await insertLeave(cpConfigId, 'RTT');
    expect(await readLeaveType(id)).toBe('CP');
  });

  it('INSERT: NULL type against a CP config is filled to CP', async () => {
    const id = await insertLeave(cpConfigId, null);
    expect(await readLeaveType(id)).toBe('CP');
  });

  it('INSERT: a non-enum custom config code is coerced to OTHER', async () => {
    // The service maps unknown codes to OTHER; the trigger must agree, otherwise
    // a custom leave type would be wrongly stored/validated.
    const id = await insertLeave(customConfigId, 'RTT');
    expect(await readLeaveType(id)).toBe('OTHER');
  });

  it('UPDATE: re-writing type to a wrong value is re-coerced from the FK', async () => {
    const id = await insertLeave(cpConfigId, 'RTT'); // already coerced to CP on insert
    expect(await readLeaveType(id)).toBe('CP');
    // An UPDATE that tries to drift the column back away from the FK is healed.
    await db.$executeRawUnsafe(
      `UPDATE "leaves" SET "type" = 'SICK_LEAVE'::"LeaveType" WHERE id = $1`,
      id,
    );
    expect(await readLeaveType(id)).toBe('CP');
  });

  it('UPDATE: changing the FK to the custom config re-derives type to OTHER', async () => {
    const id = await insertLeave(cpConfigId, 'CP');
    expect(await readLeaveType(id)).toBe('CP');
    await db.$executeRawUnsafe(
      `UPDATE "leaves" SET "leave_type_id" = $2 WHERE id = $1`,
      id,
      customConfigId,
    );
    expect(await readLeaveType(id)).toBe('OTHER');
  });
});
