import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * PER-011 — structural witness for the three indexes added to the User table
 * in migration 20260603_per011_user_missing_indexes.
 *
 * Context: User table is queried by isActive, departmentId, and roleId in
 * hot paths (presence, analytics, workload, leaves import, organigramme).
 * None were indexed. PER-011 adds:
 *   - isActive        — constant filter on active users (presence, workload, analytics)
 *   - departmentId    — organigramme and per-department queries
 *   - roleId          — role-scoped queries (RBAC V4)
 *
 * SCHEMA INDEX EXCEPTION — no behavioural unit test. Honest fail-pre witness:
 *   BEFORE migration: pg_indexes on "users" does NOT contain the three new
 *                     index names listed below.
 *   AFTER  migration: pg_indexes contains all three.
 *
 * Running this spec against a DB without the migration applied causes the
 * pg_indexes query to return fewer than 3 matching rows — the expectation
 * fails loudly with a pinpointed index name.
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'users_isActive_idx',
  'users_departmentId_idx',
  'users_roleId_idx',
] as const;

describe('PER-011 — User table missing indexes on isActive, departmentId, roleId (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('all three new indexes exist on the users table (pg_indexes)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'users'
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
        `index "${name}" not found on table "users" — PER-011 migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('users_isActive_idx covers (isActive) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'users_isActive_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"isActive"/);
  });

  it('users_departmentId_idx covers (departmentId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'users_departmentId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"departmentId"/);
  });

  it('users_roleId_idx covers (roleId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'users_roleId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"roleId"/);
  });
});
