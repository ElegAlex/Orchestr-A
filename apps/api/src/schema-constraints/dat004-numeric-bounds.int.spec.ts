import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-004 — real-DB witness for the numeric-bound CHECK constraints added in
 * migration 20260527120000_dat003_dat004_business_invariants.
 *
 * Bundle: DAT-004 (numeric bounds) + DAT-003 (dates) — same migration, same witness
 * path. Date-range witnesses live in dat003-date-range.int.spec.ts.
 *
 * One negative case per numeric-bound family (the literal DAT-004 surface): every INSERT
 * is valid except a single out-of-range value, accepted pre-migration and rejected
 * post-migration with SQLSTATE 23514 naming the constraint. Raw SQL surfaces the
 * driver code + constraint name verbatim. A positive case asserts the inclusive
 * boundaries (0/100/1/5) and the strict-positive minimum (0.5) are accepted.
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

describe('DAT-004 — numeric-bound CHECK constraints (real DB)', () => {
  let userId: string;
  let userId2: string;
  let leaveTypeId: string;
  let projectId: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat004-${randomUUID()}@witness.test`,
        login: `dat004-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat004',
        lastName: 'Witness',
      },
    });
    userId = user.id;
    // Distinct user for the positive project_members row: project_members has a
    // UNIQUE(projectId, userId), so the positive case must not reuse the key the
    // negative allocation case targets (decoupled from whether that INSERT lands).
    const user2 = await db.user.create({
      data: {
        email: `dat004b-${randomUUID()}@witness.test`,
        login: `dat004b-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat004b',
        lastName: 'Witness',
      },
    });
    userId2 = user2.id;
    const leaveType = await db.leaveTypeConfig.create({
      data: { code: `DAT004-${randomUUID()}`, name: 'DAT-004 witness type' },
    });
    leaveTypeId = leaveType.id;
    const project = await db.project.create({ data: { name: 'DAT-004 witness project' } });
    projectId = project.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('leave_balances: rejects totalDays < 0 (leave_balances_totaldays_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO leave_balances (id, "leaveTypeId", "year", "totalDays", "updatedAt")
         VALUES (gen_random_uuid(), $1, 2026, -1, now())`,
        leaveTypeId,
      ),
      'leave_balances_totaldays_ck',
    );
  });

  it('leaves: rejects days = 0 (leaves_days_ck, strict > 0)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO leaves (id, "userId", leave_type_id, "startDate", "endDate", days, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, DATE '2026-01-05', DATE '2026-01-05', 0, now())`,
        userId,
        leaveTypeId,
      ),
      'leaves_days_ck',
    );
  });

  it('tasks: rejects progress > 100 (tasks_progress_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO tasks (id, title, progress, "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-004 task', 150, now())`,
      ),
      'tasks_progress_ck',
    );
  });

  it('epics: rejects progress < 0 (epics_progress_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO epics (id, name, "projectId", progress, "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-004 epic', $1, -1, now())`,
        projectId,
      ),
      'epics_progress_ck',
    );
  });

  it('predefined_tasks: rejects weight outside 1..5 (predefined_tasks_weight_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO predefined_tasks (id, name, "defaultDuration", weight, "createdById", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-004 predef', 'FULL_DAY', 6, $1, now())`,
        userId,
      ),
      'predefined_tasks_weight_ck',
    );
  });

  it('project_members: rejects allocation > 100 (project_members_allocation_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO project_members (id, "projectId", "userId", role, allocation)
         VALUES (gen_random_uuid(), $1, $2, 'Membre', 150)`,
        projectId,
        userId,
      ),
      'project_members_allocation_ck',
    );
  });

  it('documents: rejects size < 0 (documents_size_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO documents (id, name, url, "mimeType", size, "projectId", "uploadedBy")
         VALUES (gen_random_uuid(), 'DAT-004 doc', 'http://x/y', 'text/plain', -1, $1, $2)`,
        projectId,
        userId,
      ),
      'documents_size_ck',
    );
  });

  it('accepts inclusive boundaries (0/100/1/5) and the strict-positive minimum (0.5 days)', async () => {
    // totalDays = 0 (>= 0 inclusive)
    await db.$executeRawUnsafe(
      `INSERT INTO leave_balances (id, "leaveTypeId", "year", "totalDays", "updatedAt")
       VALUES (gen_random_uuid(), $1, 2027, 0, now())`,
      leaveTypeId,
    );
    // days = 0.5 (the floored half-day minimum)
    await db.$executeRawUnsafe(
      `INSERT INTO leaves (id, "userId", leave_type_id, "startDate", "endDate", days, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, DATE '2026-04-01', DATE '2026-04-01', 0.5, now())`,
      userId,
      leaveTypeId,
    );
    // progress = 100, weight = 5, allocation boundaries 0/100
    await db.$executeRawUnsafe(
      `INSERT INTO tasks (id, title, progress, "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-004 done', 100, now())`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", weight, "createdById", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-004 heavy', 'FULL_DAY', 5, $1, now())`,
      userId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO project_members (id, "projectId", "userId", role, allocation)
       VALUES (gen_random_uuid(), $1, $2, 'Membre', 0)`,
      projectId,
      userId2,
    );
    expect(true).toBe(true);
  });
});
