import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * Phase-4C — real-DB witness for the CHECK constraints, indexes, and FK
 * correction added by migration 20260606213229_phase4c_checks_indexes_fk.
 *
 * Constraints witnessed:
 *   events_recurrenceDay_ck         — recurrenceDay BETWEEN 0 AND 6 (or NULL)
 *   events_recurrenceWeekInterval_ck — recurrenceWeekInterval >= 1 (or NULL)
 *   telework_recurring_rules_dayofweek_ck — dayOfWeek BETWEEN 0 AND 6
 *   documents_contentSha256_ck       — 64-char lowercase hex (or NULL)
 *   tasks_time_order_ck              — endTime >= startTime (or either NULL)
 *   events_time_order_ck             — same on events
 *   predefined_tasks_time_order_ck   — same on predefined_tasks
 *   project_members_dates_ck         — endDate >= startDate (or either NULL)
 *
 * Indexes witnessed (pg_indexes):
 *   telework_schedules_date_userId_idx
 *   predefined_task_assignments_userId_idx
 *   audit_logs_created_at_id_desc_idx
 *
 * FK direction (DAT-028):
 *   audit_logs_actorId_fkey  → confupdtype='a' AND confdeltype='a' (NO ACTION)
 *
 * Strategy: create one minimally-valid parent row via ORM then UPDATE the
 * target column to the violating value via $executeRawUnsafe so the raw SQLSTATE
 * 23514 and constraint name surface verbatim in the driver error message.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert that a raw write is rejected by a CHECK constraint.
 * Teeth: if the constraint is absent (pre-migration), the write succeeds,
 * `message` stays empty, and the 23514 assertion fails loudly — a vacuous
 * green is impossible.
 */
async function expectCheckViolation(
  stmt: Promise<unknown>,
  constraint: string,
): Promise<void> {
  let message = '';
  try {
    await stmt;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    `expected a check_violation (23514) naming "${constraint}" but the write was accepted`,
  ).toMatch(/23514/);
  expect(message).toContain(constraint);
}

describe('Phase-4C — CHECK constraints, indexes, FK direction (real DB)', () => {
  let userId: string;
  let userId2: string;
  let userId3: string;
  let projectId: string;

  // ── parent rows used as FK anchors ────────────────────────────────────────

  beforeAll(async () => {
    await db.$connect();

    const user = await db.user.create({
      data: {
        email: `p4c-${randomUUID()}@witness.test`,
        login: `p4c-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Phase4C',
        lastName: 'Witness',
      },
    });
    userId = user.id;

    // Extra users needed for project_members tests (unique constraint on projectId+userId)
    const user2 = await db.user.create({
      data: {
        email: `p4c2-${randomUUID()}@witness.test`,
        login: `p4c2-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Phase4C2',
        lastName: 'Witness',
      },
    });
    userId2 = user2.id;

    const user3 = await db.user.create({
      data: {
        email: `p4c3-${randomUUID()}@witness.test`,
        login: `p4c3-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Phase4C3',
        lastName: 'Witness',
      },
    });
    userId3 = user3.id;

    const project = await db.project.create({
      data: { name: `Phase-4C witness project ${randomUUID()}` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  // ── 1. events_recurrenceDay_ck ────────────────────────────────────────────

  it('events: rejects recurrenceDay=7 (events_recurrenceDay_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "updatedAt")
       VALUES ($1, 'P4C recDay', TIMESTAMP '2026-09-01 09:00', $2, now())`,
      eventId,
      userId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE events SET "recurrenceDay" = 7 WHERE id = $1`,
        eventId,
      ),
      'events_recurrenceDay_ck',
    );
  });

  it('events: accepts recurrenceDay=3 (events_recurrenceDay_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "updatedAt")
       VALUES ($1, 'P4C recDay ok', TIMESTAMP '2026-09-01 09:00', $2, now())`,
      eventId,
      userId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE events SET "recurrenceDay" = 3 WHERE id = $1`,
        eventId,
      ),
    ).resolves.toBe(1);
  });

  it('events: accepts recurrenceDay=NULL (events_recurrenceDay_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "recurrenceDay", "updatedAt")
       VALUES ($1, 'P4C recDay null', TIMESTAMP '2026-09-01 09:00', $2, 2, now())`,
      eventId,
      userId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE events SET "recurrenceDay" = NULL WHERE id = $1`,
        eventId,
      ),
    ).resolves.toBe(1);
  });

  // ── 2. events_recurrenceWeekInterval_ck ──────────────────────────────────

  it('events: rejects recurrenceWeekInterval=0 (events_recurrenceWeekInterval_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "updatedAt")
       VALUES ($1, 'P4C recWI', TIMESTAMP '2026-09-02 09:00', $2, now())`,
      eventId,
      userId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE events SET "recurrenceWeekInterval" = 0 WHERE id = $1`,
        eventId,
      ),
      'events_recurrenceWeekInterval_ck',
    );
  });

  it('events: accepts recurrenceWeekInterval=2 (events_recurrenceWeekInterval_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "updatedAt")
       VALUES ($1, 'P4C recWI ok', TIMESTAMP '2026-09-02 09:00', $2, now())`,
      eventId,
      userId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE events SET "recurrenceWeekInterval" = 2 WHERE id = $1`,
        eventId,
      ),
    ).resolves.toBe(1);
  });

  it('events: accepts recurrenceWeekInterval=NULL (events_recurrenceWeekInterval_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "recurrenceWeekInterval", "updatedAt")
       VALUES ($1, 'P4C recWI null', TIMESTAMP '2026-09-02 09:00', $2, 3, now())`,
      eventId,
      userId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE events SET "recurrenceWeekInterval" = NULL WHERE id = $1`,
        eventId,
      ),
    ).resolves.toBe(1);
  });

  // ── 3. telework_recurring_rules_dayofweek_ck ──────────────────────────────

  it('telework_recurring_rules: rejects dayOfWeek=7 (telework_recurring_rules_dayofweek_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO telework_recurring_rules (id, "userId", "dayOfWeek", "startDate", "updatedAt")
         VALUES (gen_random_uuid(), $1, 7, DATE '2026-09-01', now())`,
        userId,
      ),
      'telework_recurring_rules_dayofweek_ck',
    );
  });

  it('telework_recurring_rules: accepts dayOfWeek=6 (telework_recurring_rules_dayofweek_ck)', async () => {
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO telework_recurring_rules (id, "userId", "dayOfWeek", "startDate", "updatedAt")
         VALUES (gen_random_uuid(), $1, 6, DATE '2026-09-01', now())`,
        userId,
      ),
    ).resolves.toBe(1);
  });

  // ── 4. documents_contentSha256_ck ─────────────────────────────────────────

  it('documents: rejects contentSha256 with non-hex chars (documents_contentSha256_ck)', async () => {
    const docId = randomUUID();
    // documents table has no updatedAt column
    await db.$executeRawUnsafe(
      `INSERT INTO documents (id, name, url, "mimeType", size, "projectId")
       VALUES ($1, 'P4C doc', 'https://example.com/f', 'application/octet-stream', 1, $2)`,
      docId,
      projectId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE documents SET "contentSha256" = 'nothex' WHERE id = $1`,
        docId,
      ),
      'documents_contentSha256_ck',
    );
  });

  it('documents: accepts contentSha256 as 64-char lowercase hex (documents_contentSha256_ck)', async () => {
    const docId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO documents (id, name, url, "mimeType", size, "projectId")
       VALUES ($1, 'P4C doc hex', 'https://example.com/g', 'application/octet-stream', 2, $2)`,
      docId,
      projectId,
    );
    const validHex = 'a'.repeat(64);
    await expect(
      db.$executeRawUnsafe(
        `UPDATE documents SET "contentSha256" = $1 WHERE id = $2`,
        validHex,
        docId,
      ),
    ).resolves.toBe(1);
  });

  it('documents: accepts contentSha256=NULL (documents_contentSha256_ck)', async () => {
    const docId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO documents (id, name, url, "mimeType", size, "projectId", "contentSha256")
       VALUES ($1, 'P4C doc null', 'https://example.com/h', 'application/octet-stream', 3, $2, $3)`,
      docId,
      projectId,
      'b'.repeat(64),
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE documents SET "contentSha256" = NULL WHERE id = $1`,
        docId,
      ),
    ).resolves.toBe(1);
  });

  // ── 5. tasks_time_order_ck ────────────────────────────────────────────────

  it('tasks: rejects startTime > endTime (tasks_time_order_ck)', async () => {
    const taskId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO tasks (id, title, "updatedAt")
       VALUES ($1, 'P4C task time', now())`,
      taskId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE tasks SET "startTime" = '17:00', "endTime" = '09:00' WHERE id = $1`,
        taskId,
      ),
      'tasks_time_order_ck',
    );
  });

  it('tasks: accepts startTime < endTime (tasks_time_order_ck)', async () => {
    const taskId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO tasks (id, title, "updatedAt")
       VALUES ($1, 'P4C task time ok', now())`,
      taskId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE tasks SET "startTime" = '09:00', "endTime" = '17:00' WHERE id = $1`,
        taskId,
      ),
    ).resolves.toBe(1);
  });

  // ── 6. events_time_order_ck ───────────────────────────────────────────────

  it('events: rejects startTime > endTime (events_time_order_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "updatedAt")
       VALUES ($1, 'P4C event time', TIMESTAMP '2026-09-03 09:00', $2, now())`,
      eventId,
      userId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE events SET "startTime" = '17:00', "endTime" = '09:00' WHERE id = $1`,
        eventId,
      ),
      'events_time_order_ck',
    );
  });

  it('events: accepts startTime < endTime (events_time_order_ck)', async () => {
    const eventId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO events (id, title, "date", "createdById", "updatedAt")
       VALUES ($1, 'P4C event time ok', TIMESTAMP '2026-09-03 09:00', $2, now())`,
      eventId,
      userId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE events SET "startTime" = '09:00', "endTime" = '17:00' WHERE id = $1`,
        eventId,
      ),
    ).resolves.toBe(1);
  });

  // ── 7. predefined_tasks_time_order_ck ────────────────────────────────────

  it('predefined_tasks: rejects startTime > endTime (predefined_tasks_time_order_ck)', async () => {
    const ptId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", "updatedAt")
       VALUES ($1, 'P4C pt time', 'HALF_DAY', now())`,
      ptId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE predefined_tasks SET "startTime" = '17:00', "endTime" = '09:00' WHERE id = $1`,
        ptId,
      ),
      'predefined_tasks_time_order_ck',
    );
  });

  it('predefined_tasks: accepts startTime < endTime (predefined_tasks_time_order_ck)', async () => {
    const ptId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", "updatedAt")
       VALUES ($1, 'P4C pt time ok', 'FULL_DAY', now())`,
      ptId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE predefined_tasks SET "startTime" = '09:00', "endTime" = '17:00' WHERE id = $1`,
        ptId,
      ),
    ).resolves.toBe(1);
  });

  it('predefined_tasks: accepts both times NULL (predefined_tasks_time_order_ck)', async () => {
    const ptId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", "startTime", "endTime", "updatedAt")
       VALUES ($1, 'P4C pt null times', 'TIME_SLOT', '08:00', '12:00', now())`,
      ptId,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE predefined_tasks SET "startTime" = NULL, "endTime" = NULL WHERE id = $1`,
        ptId,
      ),
    ).resolves.toBe(1);
  });

  // ── 8. project_members_dates_ck ───────────────────────────────────────────

  it('project_members: rejects endDate < startDate (project_members_dates_ck)', async () => {
    // Each test uses a distinct userId to avoid the (projectId, userId) unique constraint
    const pmId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO project_members (id, "projectId", "userId", role)
       VALUES ($1, $2, $3, 'MEMBER')`,
      pmId,
      projectId,
      userId,
    );
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `UPDATE project_members SET "startDate" = DATE '2026-09-30', "endDate" = DATE '2026-09-01' WHERE id = $1`,
        pmId,
      ),
      'project_members_dates_ck',
    );
  });

  it('project_members: accepts endDate >= startDate (project_members_dates_ck)', async () => {
    // Use userId2 — unique constraint prevents re-using userId in the same project
    const pmId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO project_members (id, "projectId", "userId", role)
       VALUES ($1, $2, $3, 'MEMBER')`,
      pmId,
      projectId,
      userId2,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE project_members SET "startDate" = DATE '2026-09-01', "endDate" = DATE '2026-09-30' WHERE id = $1`,
        pmId,
      ),
    ).resolves.toBe(1);
  });

  it('project_members: accepts endDate=NULL (project_members_dates_ck)', async () => {
    // Use userId3 — unique constraint prevents re-using same user in the same project
    const pmId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO project_members (id, "projectId", "userId", role, "startDate", "endDate")
       VALUES ($1, $2, $3, 'MEMBER', DATE '2026-09-01', DATE '2026-09-10')`,
      pmId,
      projectId,
      userId3,
    );
    await expect(
      db.$executeRawUnsafe(
        `UPDATE project_members SET "endDate" = NULL WHERE id = $1`,
        pmId,
      ),
    ).resolves.toBe(1);
  });

  // ── 9. Index existence ────────────────────────────────────────────────────

  it('index telework_schedules_date_userId_idx exists', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'telework_schedules_date_userId_idx'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('index predefined_task_assignments_userId_idx exists', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'predefined_task_assignments_userId_idx'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('index audit_logs_created_at_id_desc_idx exists', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'audit_logs_created_at_id_desc_idx'`,
    );
    expect(rows).toHaveLength(1);
  });

  // ── 10. DAT-028 — audit_logs FK direction ─────────────────────────────────

  it('DAT-028: audit_logs_actorId_fkey has NO ACTION on both update and delete', async () => {
    const rows = await db.$queryRawUnsafe<
      { confupdtype: string; confdeltype: string }[]
    >(
      `SELECT confupdtype, confdeltype
       FROM pg_constraint
       WHERE conname = 'audit_logs_actorId_fkey' AND contype = 'f'`,
    );
    expect(rows).toHaveLength(1);
    // 'a' = NO ACTION in pg_constraint confupdtype/confdeltype
    expect(rows[0].confupdtype).toBe('a');
    expect(rows[0].confdeltype).toBe('a');
  });
});
