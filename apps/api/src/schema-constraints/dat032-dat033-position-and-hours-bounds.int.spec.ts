import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-032 + DAT-033 — real-DB witnesses for the CHECK constraints added in
 * migration 20260528120000_dat032_dat033_position_and_hours_bounds.
 *
 * Bundle: DAT-032 (subtasks_position_ck: position >= 0) + DAT-033
 * (time_entries_hours_ck: hours >= 0 AND hours <= 24) — same migration, same
 * SQL mechanism, defense-in-depth completion of the DAT-004 numeric-bound family
 * (DAT-032 was omitted from DAT-004's Suggested-fix list; DAT-033 was scoped
 * out of COR-022's service-layer cap by Invariant 1).
 *
 * Raw SQL surfaces the driver code (SQLSTATE 23514) + constraint name verbatim.
 * Negative cases pre-migration are accepted (the FAIL-pre the contract demands);
 * post-migration the DB rejects them. Positive cases assert the inclusive
 * boundaries.
 *
 * Load-bearing positive: hours = 0 (dismissal row, isDismissal = true). The
 * COR-022 closeout established that TimeTrackingService writes dismissals with
 * hours = 0, and CreateTimeEntryDto's @Min(0.25) is gated by @ValidateIf
 * (!isDismissal). The legitimate persisted range is therefore {0} ∪ [0.25, 24],
 * NOT [0.25, 24]. The DB floor must admit hours = 0; this test would FAIL if
 * the floor were encoded as `hours >= 0.25` (the over-constraint trap the
 * implementer must avoid). Pre-flight (2026-05-28) confirmed 101 such rows
 * exist in dev today.
 *
 * Out of scope: the COR-022 per-(userId, date) aggregate cap (cross-row, not
 * expressible as a per-row CHECK) and its TOCTOU residual.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

async function expectCheckViolation(
  insert: Promise<unknown>,
  constraint: string,
): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(message, 'expected a check_violation (23514) but the INSERT was accepted').toMatch(
    /23514/,
  );
  expect(message).toContain(constraint);
}

describe('DAT-032 + DAT-033 — position/hours CHECK constraints (real DB)', () => {
  let userId: string;
  let taskId: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat032-${randomUUID()}@witness.test`,
        login: `dat032-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat032',
        lastName: 'Witness',
      },
    });
    userId = user.id;
    const task = await db.task.create({ data: { title: 'DAT-032/033 witness task' } });
    taskId = task.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // DAT-032 — subtasks.position >= 0
  // ---------------------------------------------------------------------------

  it('subtasks: rejects position = -1 (subtasks_position_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO subtasks (id, title, "position", "taskId", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-032 negative', -1, $1, now())`,
        taskId,
      ),
      'subtasks_position_ck',
    );
  });

  it('subtasks: accepts position = 0 and position = 5 (inclusive lower bound)', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO subtasks (id, title, "position", "taskId", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-032 zero', 0, $1, now())`,
      taskId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO subtasks (id, title, "position", "taskId", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-032 positive', 5, $1, now())`,
      taskId,
    );
    expect(true).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // DAT-033 — time_entries.hours within [0, 24]
  // ---------------------------------------------------------------------------

  // time_entries has a separate actor-XOR CHECK (userId XOR thirdPartyId).
  // The negative cases set userId so the row satisfies the XOR and the only
  // remaining failure mode is the bound we're testing.

  it('time_entries: rejects hours = -1 (time_entries_hours_ck, lower bound)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "updatedAt")
         VALUES (gen_random_uuid(), $1, $1, DATE '2026-01-10', -1, 'DEVELOPMENT', now())`,
        userId,
      ),
      'time_entries_hours_ck',
    );
  });

  it('time_entries: rejects hours = 25 (time_entries_hours_ck, upper bound)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "updatedAt")
         VALUES (gen_random_uuid(), $1, $1, DATE '2026-01-11', 25, 'DEVELOPMENT', now())`,
        userId,
      ),
      'time_entries_hours_ck',
    );
  });

  it('time_entries: accepts hours = 0 (dismissal — load-bearing, guards against over-constraint)', async () => {
    // If the CHECK were `hours >= 0.25` instead of `>= 0`, this INSERT would be
    // rejected and 101 legitimate dismissal rows would have failed migration.
    await db.$executeRawUnsafe(
      `INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "isDismissal", "updatedAt")
       VALUES (gen_random_uuid(), $1, $1, DATE '2026-01-12', 0, 'DEVELOPMENT', true, now())`,
      userId,
    );
    expect(true).toBe(true);
  });

  it('time_entries: accepts hours = 0.5 and hours = 8 (regular bounded values)', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "updatedAt")
       VALUES (gen_random_uuid(), $1, $1, DATE '2026-01-13', 0.5, 'DEVELOPMENT', now())`,
      userId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "updatedAt")
       VALUES (gen_random_uuid(), $1, $1, DATE '2026-01-14', 8, 'DEVELOPMENT', now())`,
      userId,
    );
    expect(true).toBe(true);
  });
});
