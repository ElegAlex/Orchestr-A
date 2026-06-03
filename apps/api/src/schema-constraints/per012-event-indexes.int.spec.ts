import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * PER-012 — structural witness for the three indexes added to the events /
 * event_participants tables in migration 20260603_per012_event_missing_indexes.
 *
 * Context: /planning queries filter events by date BETWEEN (6-month window),
 * projectId, createdById, and participants.userId — all without indexes.
 * PER-012 adds:
 *   events table:
 *   - (date)               — primary range filter on every /planning call
 *   - (createdById, date)  — owner + date composite (list by creator, range)
 *   event_participants table:
 *   - (userId)             — participant look-up without scanning all rows
 *
 * Note: @@index([projectId]) and @@index([createdById]) already exist from
 * DAT-011. Only the three new indexes above are asserted here.
 *
 * SCHEMA INDEX EXCEPTION — no behavioural unit test. Honest fail-pre witness:
 *   BEFORE migration: pg_indexes on "events" / "event_participants" does NOT
 *                     contain the three new index names listed below.
 *   AFTER  migration: pg_indexes contains all three.
 *
 * Running this spec against a DB without the migration applied causes the
 * pg_indexes query to return fewer than 3 matching rows — the expectation
 * fails loudly with a pinpointed index name.
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'events_date_idx',
  'events_createdById_date_idx',
  'event_participants_userId_idx',
] as const;

describe('PER-012 — Event table missing indexes on date, createdById+date, userId (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('all three new indexes exist (pg_indexes)', async () => {
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
        `index "${name}" not found — PER-012 migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('events_date_idx covers (date) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'events_date_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/\bdate\b/);
  });

  it('events_createdById_date_idx covers (createdById, date) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'events_createdById_date_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"createdById"/);
    expect(def).toMatch(/\bdate\b/);
  });

  it('event_participants_userId_idx covers (userId) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'event_participants_userId_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"userId"/);
  });
});
