import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-003 — real-DB witness for the date-range CHECK constraints added in
 * migration 20260527120000_dat003_dat004_business_invariants.
 *
 * Bundle: DAT-003 (dates) + DAT-004 (numeric bounds) — same migration, same
 * witness path. Numeric-bound witnesses live in dat004-numeric-bounds.int.spec.ts.
 *
 * Each negative case attempts a raw INSERT that is valid in every respect EXCEPT
 * an inverted date range. Pre-migration the row is accepted (the FAIL-pre the
 * task demands); post-migration Postgres rejects it with SQLSTATE 23514 naming the
 * offending constraint. Raw SQL is used (not the ORM) so the driver's check_violation
 * code + constraint name surface in the error message verbatim.
 *
 * Surface (DAT-003, literal): leaves, projects, epics, telework_recurring_rules,
 * leave_validation_delegates, school_vacations, events. Representative — not
 * exhaustive: 1 inverted-dates case on `leaves`, 1 on `events` (recurrenceEndDate >= date
 * column-name variant), plus a positive case proving nullable ranges (NULL passes) and
 * valid ranges are still accepted.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert a raw INSERT is rejected by a CHECK constraint. Teeth by construction: if the
 * constraint is absent (FAIL-pre), the INSERT is accepted, `message` stays empty, and the
 * 23514 assertion fails loudly — a vacuous green is impossible.
 */
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

describe('DAT-003 — date-range CHECK constraints (real DB)', () => {
  let userId: string;
  let leaveTypeId: string;
  let projectId: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat003-${randomUUID()}@witness.test`,
        login: `dat003-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat003',
        lastName: 'Witness',
      },
    });
    userId = user.id;
    const leaveType = await db.leaveTypeConfig.create({
      data: { code: `DAT003-${randomUUID()}`, name: 'DAT-003 witness type' },
    });
    leaveTypeId = leaveType.id;
    const project = await db.project.create({ data: { name: 'DAT-003 witness project' } });
    projectId = project.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('leaves: rejects endDate < startDate (leaves_dates_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO leaves (id, "userId", leave_type_id, "startDate", "endDate", days, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, DATE '2026-01-10', DATE '2026-01-05', 1, now())`,
        userId,
        leaveTypeId,
      ),
      'leaves_dates_ck',
    );
  });

  it('events: rejects recurrenceEndDate < date (events_recurrence_end_ck, column-name variant)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO events (id, title, "date", "recurrenceEndDate", "createdById", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-003 event', TIMESTAMP '2026-01-10 09:00', TIMESTAMP '2026-01-05 09:00', $1, now())`,
        userId,
      ),
      'events_recurrence_end_ck',
    );
  });

  it('accepts valid ranges and NULL endDate (NULL passes a CHECK; valid rows unaffected)', async () => {
    // Valid leave range (equal dates allowed by >=).
    await db.$executeRawUnsafe(
      `INSERT INTO leaves (id, "userId", leave_type_id, "startDate", "endDate", days, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, DATE '2026-02-02', DATE '2026-02-02', 1, now())`,
      userId,
      leaveTypeId,
    );
    // Project with a NULL endDate — the CHECK passes under SQL three-valued logic.
    await db.$executeRawUnsafe(
      `INSERT INTO projects (id, name, "startDate", "endDate", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-003 open-ended', DATE '2026-03-01', NULL, now())`,
    );
    // Epic with a valid range against the witness project.
    await db.$executeRawUnsafe(
      `INSERT INTO epics (id, name, "projectId", "startDate", "endDate", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-003 epic', $1, DATE '2026-03-01', DATE '2026-03-31', now())`,
      projectId,
    );
    expect(true).toBe(true);
  });
});
