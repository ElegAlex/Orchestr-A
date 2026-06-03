import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * PER-010 — structural witness for the three composite indexes added to the
 * Leave table in migration 20260603120451_per010_leave_missing_indexes.
 *
 * Context: DAT-010 already added (userId,status), (validatorId,status),
 * (startDate,endDate), (leaveTypeId,status). PER-010 adds the three indexes
 * that were still missing for heavy HR query paths:
 *   - (userId, startDate)               — user leave history by date range
 *   - (status, startDate)               — status-scoped calendar queries
 *   - (userId, leaveTypeId, startDate)  — per-user per-type date range
 *
 * SCHEMA INDEX EXCEPTION — no behavioural unit test. Honest fail-pre witness:
 *   BEFORE migration: pg_indexes on "leaves" does NOT contain the three new
 *                     index names listed below.
 *   AFTER  migration: pg_indexes contains all three.
 *
 * Running this spec against a DB without the migration applied causes the
 * pg_indexes query to return fewer than 3 matching rows — the expectation
 * fails loudly with a pinpointed index name.
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'leaves_userId_startDate_idx',
  'leaves_status_startDate_idx',
  'leaves_userId_leave_type_id_startDate_idx',
] as const;

describe('PER-010 — Leave table missing composite indexes (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('all three new composite indexes exist on the leaves table (pg_indexes)', async () => {
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
        `index "${name}" not found on table "leaves" — PER-010 migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('leaves_userId_startDate_idx covers (userId, startDate) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_userId_startDate_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"userId"/);
    expect(def).toMatch(/"startDate"/);
  });

  it('leaves_status_startDate_idx covers (status, startDate) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_status_startDate_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/\bstatus\b/);
    expect(def).toMatch(/"startDate"/);
  });

  it('leaves_userId_leave_type_id_startDate_idx covers (userId, leave_type_id, startDate) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_userId_leave_type_id_startDate_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"userId"/);
    expect(def).toMatch(/leave_type_id/);
    expect(def).toMatch(/"startDate"/);
  });
});
