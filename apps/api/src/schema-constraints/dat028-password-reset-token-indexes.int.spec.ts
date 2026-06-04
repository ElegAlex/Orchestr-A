import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * DAT-028 — structural witness for the two indexes added to the
 * password_reset_tokens table.
 *
 * Context: PasswordResetToken has expiresAt / usedAt but only @unique on
 * token.  Queries to list pending tokens per user (userId + usedAt IS NULL)
 * and GC scans over expired ones (expiresAt < NOW()) cause full table scans.
 *
 * DAT-028 adds:
 *   password_reset_tokens table:
 *   - (userId, usedAt)  — composite for "pending tokens per user" filter
 *   - (expiresAt)       — for the eager expired-token cleanup deleteMany
 *
 * SCHEMA INDEX EXCEPTION — no behavioural unit test for the index itself.
 * Honest fail-pre witness:
 *   BEFORE migration: pg_indexes on "password_reset_tokens" does NOT contain
 *                     the two new index names listed below.
 *   AFTER  migration: pg_indexes contains both.
 *
 * Running this spec against a DB without the migration applied causes the
 * pg_indexes query to return fewer than 2 matching rows — the expectation
 * fails loudly with a pinpointed index name.
 */

const db = new PrismaClient();

const EXPECTED_INDEXES = [
  'password_reset_tokens_userId_usedAt_idx',
  'password_reset_tokens_expiresAt_idx',
] as const;

describe('DAT-028 — PasswordResetToken missing indexes on (userId,usedAt) and expiresAt (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('both new indexes exist (pg_indexes)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'password_reset_tokens'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      EXPECTED_INDEXES as unknown as string[],
    );

    const found = rows.map((r) => r.indexname);
    for (const name of EXPECTED_INDEXES) {
      expect(
        found,
        `index "${name}" not found — DAT-028 migration may not have been applied`,
      ).toContain(name);
    }
    expect(found).toHaveLength(EXPECTED_INDEXES.length);
  });

  it('password_reset_tokens_userId_usedAt_idx covers (userId, usedAt) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE indexname = 'password_reset_tokens_userId_usedAt_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"userId"/);
    expect(def).toMatch(/"usedAt"/);
  });

  it('password_reset_tokens_expiresAt_idx covers (expiresAt) — per indexdef', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE indexname = 'password_reset_tokens_expiresAt_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0].indexdef;
    expect(def).toMatch(/"expiresAt"/);
  });
});
