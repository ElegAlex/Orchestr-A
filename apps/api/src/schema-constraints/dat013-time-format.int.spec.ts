import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-013 — real-DB witness for the time-of-day format CHECK constraints added in
 * migration 20260527140000_dat013_time_format_check.
 *
 * Six columns store a time of day as free String (Task.startTime/endTime,
 * Event.startTime/endTime, PredefinedTask.startTime/endTime). The audit named
 * '9:5', '25:99' and '' as accepted-but-invalid. The HH:MM format is validated at
 * the DTO layer, but a buggy service path or a direct admin SQL write bypasses it.
 * The CHECK is the DB-level floor: it rejects malformed values independent of the
 * application validators.
 *
 * Each negative case attempts a raw INSERT that is valid in every respect EXCEPT a
 * malformed time string. Pre-migration the row is accepted (the FAIL-pre the task
 * demands); post-migration Postgres rejects it with SQLSTATE 23514 naming the
 * offending constraint. Raw SQL is used (not the ORM) so the driver's
 * check_violation code + constraint name surface in the error message verbatim.
 *
 * Surface (DAT-013, literal): tasks, events, predefined_tasks. Representative — not
 * exhaustive: '25:99' (the strongest single invalid — fails both the hour and the
 * minute group) on tasks + predefined_tasks, '' (the empty-string audit example) on
 * events, plus a positive case proving valid HH:MM and NULL both pass.
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

describe('DAT-013 — time-of-day format CHECK constraints (real DB)', () => {
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat013-${randomUUID()}@witness.test`,
        login: `dat013-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat013',
        lastName: 'Witness',
      },
    });
    userId = user.id;
    const project = await db.project.create({ data: { name: 'DAT-013 witness project' } });
    projectId = project.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('tasks: rejects malformed startTime "25:99" (tasks_startTime_format_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO tasks (id, title, "projectId", "startTime", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-013 task', $1, '25:99', now())`,
        projectId,
      ),
      'tasks_startTime_format_ck',
    );
  });

  it('predefined_tasks: rejects malformed endTime "25:99" (predefined_tasks_endTime_format_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO predefined_tasks (id, name, "defaultDuration", "createdById", "endTime", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-013 predefined', 'TIME_SLOT', $1, '25:99', now())`,
        userId,
      ),
      'predefined_tasks_endTime_format_ck',
    );
  });

  it('events: rejects empty-string startTime "" (events_startTime_format_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO events (id, title, "date", "createdById", "startTime", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-013 event', TIMESTAMP '2026-01-10 09:00', $1, '', now())`,
        userId,
      ),
      'events_startTime_format_ck',
    );
  });

  it('accepts valid HH:MM and NULL (NULL passes a CHECK; valid rows unaffected)', async () => {
    // Valid time on a task (single-digit hour '9:05' — accepted by the lenient CHECK,
    // which is exactly the Task/Event DTO regex).
    await db.$executeRawUnsafe(
      `INSERT INTO tasks (id, title, "projectId", "startTime", "endTime", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-013 valid task', $1, '9:05', '17:00', now())`,
      projectId,
    );
    // NULL times — the CHECK passes under SQL three-valued logic.
    await db.$executeRawUnsafe(
      `INSERT INTO tasks (id, title, "projectId", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-013 no-time task', $1, now())`,
      projectId,
    );
    // Boundary values on a predefined task.
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", "createdById", "startTime", "endTime", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-013 valid predefined', 'TIME_SLOT', $1, '00:00', '23:59', now())`,
      userId,
    );
    expect(true).toBe(true);
  });
});
