import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * DAT-010 — real-DB witness for the four composite indexes added to the Leave
 * table in migration 20260603114945_dat010_leave_indexes.
 *
 * The Leave table was created with no @@index beyond the PK. Hot query paths
 * on leaves.service hit userId+status (user's leave list), validatorId+status
 * (pending-approvals queue), (startDate, endDate) (calendar overlap planning),
 * and leaveTypeId+status (type-scoped dashboards) — each causing a full-table
 * scan on a large leave history.
 *
 * Structural witness (SCHEMA INDEX EXCEPTION — no behavioural unit test):
 *   BEFORE migration: pg_indexes on "leaves" contains only "leaves_pkey" and
 *                     "leaves_no_overlap" (the partial-overlap exclusion index).
 *   AFTER  migration: pg_indexes also contains all four new indexes listed below.
 *
 * This spec asserts the POST state (run against the ephemeral migrated DB
 * provisioned by vitest.int.global-setup.ts via `prisma migrate deploy`).
 * Running it against a DB without the migration applied causes the pg_indexes
 * query to return fewer than 4 matching rows — the expectation fails loudly.
 * The exact index names are lifted verbatim from the generated migration SQL,
 * pinning the composite column tuples (a vacuous green on an unrelated index
 * name change is structurally impossible).
 *
 * Expected indexes (exact Prisma-convention names from the migration SQL):
 *   leaves_userId_status_idx         — (userId, status)        — user's leaves
 *   leaves_validator_id_status_idx   — (validator_id, status)  — approvals queue
 *   leaves_startDate_endDate_idx     — (startDate, endDate)    — calendar overlap
 *   leaves_leave_type_id_status_idx  — (leave_type_id, status) — type dashboards
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'leaves_leave_type_id_status_idx',
  'leaves_startDate_endDate_idx',
  'leaves_userId_status_idx',
  'leaves_validator_id_status_idx',
] as const;

describe('DAT-010 — Leave table composite indexes (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('all four composite indexes exist on the leaves table (pg_indexes)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'leaves'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      EXPECTED_INDEXES as unknown as string[],
    );

    const found = rows.map((r) => r.indexname);
    // Assert each expected index by name so the failure message pinpoints which
    // index is missing — a generic count check could mask a partial deploy.
    for (const name of EXPECTED_INDEXES) {
      expect(
        found,
        `index "${name}" not found on table "leaves" — migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('leaves_userId_status_idx covers (userId, status) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_userId_status_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    // indexdef syntax: CREATE INDEX <name> ON public.leaves USING btree ("userId", status)
    expect(def).toMatch(/"userId"/);
    expect(def).toMatch(/\bstatus\b/);
  });

  it('leaves_validator_id_status_idx covers (validator_id, status) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_validator_id_status_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/validator_id/);
    expect(def).toMatch(/\bstatus\b/);
  });

  it('leaves_startDate_endDate_idx covers (startDate, endDate) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_startDate_endDate_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"startDate"/);
    expect(def).toMatch(/"endDate"/);
  });

  it('leaves_leave_type_id_status_idx covers (leave_type_id, status) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_leave_type_id_status_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/leave_type_id/);
    expect(def).toMatch(/\bstatus\b/);
  });
});
