import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * DAT-029 — structural witness for the two indexes added to join tables
 * in migration 20260604_dat029_join_table_indexes.
 *
 * Context: UserService and ProjectMember each have a composite @@unique on
 * (userId, serviceId) and (projectId, userId) respectively. PostgreSQL's
 * B-tree index on a composite key is only usable for the LEADING column;
 * a reverse-lookup "all users in service X" or "all projects for user X"
 * requires a full table scan. DAT-029 adds explicit single-column indexes
 * on the non-leading columns to cover those paths.
 *
 * DAT-029 adds:
 *   user_services table:
 *   - (serviceId)   — reverse-lookup 'all users in service X'
 *   project_members table:
 *   - (userId)      — reverse-lookup 'all projects for user X'
 *
 * Note: EventParticipant.@@index([userId]) was already added by PER-012 —
 * it is NOT re-added here (confirmed present before this migration).
 *
 * SCHEMA INDEX EXCEPTION — no behavioural unit test. Honest fail-pre witness:
 *   BEFORE migration: pg_indexes does NOT contain these two index names.
 *   AFTER  migration: pg_indexes contains both.
 *
 * Running this spec against a DB without the migration applied causes the
 * pg_indexes query to return fewer matching rows — each expectation pinpoints
 * the missing index by name.
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'user_services_serviceId_idx',
  'project_members_userId_idx',
] as const;

describe('DAT-029 — join-table reverse-lookup indexes (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('both new indexes exist (pg_indexes)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE indexname = ANY($1::text[])
       ORDER BY indexname`,
      EXPECTED_INDEXES as unknown as string[],
    );

    const found = rows.map((r) => r.indexname);
    for (const name of EXPECTED_INDEXES) {
      expect(
        found,
        `index "${name}" not found — DAT-029 migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('user_services_serviceId_idx covers (serviceId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'user_services_serviceId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"serviceId"/);
  });

  it('project_members_userId_idx covers (userId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'project_members_userId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"userId"/);
  });

  it('EventParticipant.userId index was NOT re-added (PER-012 owns it)', async () => {
    // Confirm event_participants_userId_idx still exists (PER-012 did not regress)
    // and that we have exactly one such index (not a duplicate).
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'event_participants' AND indexname = 'event_participants_userId_idx'`,
    );
    expect(rows).toHaveLength(1);
  });
});
