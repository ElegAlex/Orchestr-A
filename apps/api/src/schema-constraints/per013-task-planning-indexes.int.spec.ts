import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * PER-013 — structural witness for the five indexes added to the tasks table
 * in migration 20260603_per013_task_planning_indexes.
 *
 * Context: Planning queries filter on endDate >= / startDate <= heavily.
 * milestoneId / epicId queries (mass updates) are also unindexed. The
 * composite (projectId, status) covers combined filtering for kanban/list
 * views without a full tasks scan.
 *
 * PER-013 adds:
 *   tasks table:
 *   - (endDate)              — planning range upper-bound filter
 *   - (startDate)            — planning range lower-bound filter
 *   - (milestoneId)          — milestone mass-update / list queries
 *   - (epicId)               — epic mass-update / list queries
 *   - (projectId, status)    — kanban / filtered task-list composite
 *
 * Note: @@index([projectId]), @@index([assigneeId]), @@index([status]) already
 * exist from the original schema. Only the five new indexes above are asserted.
 *
 * SCHEMA INDEX EXCEPTION — no behavioural unit test. Honest fail-pre witness:
 *   BEFORE migration: pg_indexes on "tasks" does NOT contain the five new
 *                     index names listed below.
 *   AFTER  migration: pg_indexes contains all five.
 *
 * Running this spec against a DB without the migration applied causes the
 * pg_indexes query to return fewer than 5 matching rows — the expectation
 * fails loudly with a pinpointed index name.
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'tasks_endDate_idx',
  'tasks_startDate_idx',
  'tasks_milestoneId_idx',
  'tasks_epicId_idx',
  'tasks_projectId_status_idx',
] as const;

describe('PER-013 — Task table missing indexes on endDate/startDate/milestoneId/epicId/projectId+status (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('all five new indexes exist (pg_indexes)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE indexname = ANY($1::text[])
       ORDER BY indexname`,
      EXPECTED_INDEXES as unknown as string[],
    );

    const found = rows.map((r) => r.indexname);
    // Assert each expected index by name so the failure message pinpoints which
    // index is missing — a generic count check could mask a partial deploy.
    for (const name of EXPECTED_INDEXES) {
      expect(
        found,
        `index "${name}" not found — PER-013 migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('tasks_endDate_idx covers (endDate) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'tasks_endDate_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"endDate"/);
  });

  it('tasks_startDate_idx covers (startDate) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'tasks_startDate_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"startDate"/);
  });

  it('tasks_milestoneId_idx covers (milestoneId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'tasks_milestoneId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"milestoneId"/);
  });

  it('tasks_epicId_idx covers (epicId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'tasks_epicId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"epicId"/);
  });

  it('tasks_projectId_status_idx covers (projectId, status) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'tasks_projectId_status_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"projectId"/);
    expect(def).toMatch(/\bstatus\b/);
  });
});
