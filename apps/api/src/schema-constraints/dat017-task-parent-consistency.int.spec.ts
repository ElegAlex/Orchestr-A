import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-017 — real-DB witness for the task parent-consistency CHECK added in
 * migration 20260527170000_dat017_task_parent_requires_project_check.
 *
 * Task.projectId is nullable so transverse tasks (meetings, cross-cutting work)
 * can exist with no project. But epicId/milestoneId were settable independently of
 * projectId, so a task could hang off an epic/milestone while naming NO project —
 * `projectId IS NULL AND (epicId IS NOT NULL OR milestoneId IS NOT NULL)`. The
 * create DTO does not tie the three fields together (each is @IsOptional, no
 * cross-field @ValidateIf), so nothing rejected the orphan combination before this
 * CHECK. The CHECK is the DB-level floor.
 *
 * SCOPE of this CHECK (and the limit of what these tests assert): it is a SINGLE-ROW
 * invariant — "if epicId or milestoneId is set, projectId must be set too". It does
 * NOT enforce that the project named by the task is the SAME project the epic/
 * milestone belongs to; that cross-table property is DAT-037 (a trigger). Positive
 * #2 below deliberately wires the epic to project X and sets the task's projectId to
 * X for setup realism, but the assertion is ONLY that the row is accepted because
 * projectId is non-null — the CHECK is trivially satisfied regardless of the epic's
 * own projectId.
 *
 * Negatives use raw SQL ($executeRawUnsafe) so the driver's check_violation code
 * (SQLSTATE 23514) + the offending constraint name (tasks_parent_requires_project_ck)
 * surface verbatim. Pre-migration the orphan INSERTs are accepted (the FAIL-pre the
 * task demands); post-migration Postgres rejects them. Runs against the ephemeral
 * migrated DB provisioned by vitest.int.global-setup.ts.
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

describe('DAT-017 — task parent-consistency CHECK (real DB)', () => {
  let projectId: string;
  let epicId: string;
  let milestoneId: string;

  beforeAll(async () => {
    await db.$connect();
    const project = await db.project.create({ data: { name: `DAT-017 project ${randomUUID()}` } });
    projectId = project.id;
    const epic = await db.epic.create({
      data: { name: `DAT-017 epic ${randomUUID()}`, projectId },
    });
    epicId = epic.id;
    const milestone = await db.milestone.create({
      data: { name: `DAT-017 milestone ${randomUUID()}`, projectId, dueDate: new Date() },
    });
    milestoneId = milestone.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  // Negative #1 — epic set but no project: the exact orphan the audit names.
  it('rejects projectId=NULL with epicId set (tasks_parent_requires_project_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO tasks (id, title, "projectId", "epicId", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-017 orphan-epic', NULL, $1, now())`,
        epicId,
      ),
      'tasks_parent_requires_project_ck',
    );
  });

  // Negative #2 — milestone set but no project: the other half of the OR clause.
  it('rejects projectId=NULL with milestoneId set (tasks_parent_requires_project_ck)', async () => {
    await expectCheckViolation(
      db.$executeRawUnsafe(
        `INSERT INTO tasks (id, title, "projectId", "milestoneId", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-017 orphan-milestone', NULL, $1, now())`,
        milestoneId,
      ),
      'tasks_parent_requires_project_ck',
    );
  });

  // Positive #1 — true transverse task: all three NULL. The legitimate use case the
  // audit explicitly preserves (projectId nullable for meetings / cross-cutting work).
  it('ACCEPTS a transverse task with projectId/epicId/milestoneId all NULL', async () => {
    const task = await db.task.create({ data: { title: `DAT-017 transverse ${randomUUID()}` } });
    expect(task.projectId).toBeNull();
    expect(task.epicId).toBeNull();
    expect(task.milestoneId).toBeNull();
  });

  // Positive #2 — regular project task with an epic. Accepted because projectId is
  // non-null; the CHECK is trivially satisfied by the first disjunct REGARDLESS of the
  // epic's own projectId (cross-table equality is DAT-037, not this CHECK).
  it('ACCEPTS a task with projectId set and an epic (single-row invariant satisfied)', async () => {
    const task = await db.task.create({
      data: { title: `DAT-017 regular ${randomUUID()}`, projectId, epicId },
    });
    expect(task.projectId).toBe(projectId);
    expect(task.epicId).toBe(epicId);
  });
});
