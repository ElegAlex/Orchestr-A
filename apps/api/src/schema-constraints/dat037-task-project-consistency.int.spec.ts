import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-037 — real-DB witnesses for the cross-table task.projectId consistency
 * guards added in migration 20260528150000_dat037_task_project_consistency.
 *
 * DESIGN — Option A (operator-decided, see BACKLOG): task-side BEFORE REJECT
 * + parent-side AFTER CASCADE on `epics` and `milestones`. The pair is
 * non-deadlocking because the AFTER cascade runs after the parent row holds
 * NEW.projectId; the cascade UPDATE on tasks then satisfies the task-side
 * BEFORE re-check (parent.projectId == NEW task.projectId).
 *
 * 7 tests in 3 groups:
 *
 *   NEGATIVES (the audit failure mode, reject before write):
 *     1. INSERT task with epicId=E and projectId=P_other (E.projectId=P_E) → P0001
 *        carrying `tasks_project_matches_epic`.
 *     2. INSERT task with milestoneId=M and projectId=P_other → P0001 carrying
 *        `tasks_project_matches_milestone`.
 *     3. UPDATE existing task setting projectId to disagree with parent epic → reject.
 *
 *   POSITIVES (BEFORE-trigger doesn't false-reject the happy path):
 *     4. INSERT task with epicId=E and projectId=E.projectId → accepted.
 *     5. INSERT task with epicId=E + milestoneId=M (both in same project) → accepted.
 *     6. INSERT task with no parents (projectId optional) → accepted.
 *
 *   CASCADE (parent-side AFTER trigger rewrites dependent tasks):
 *     7. UPDATE epic.projectId from P1 to P2 → dependent task.projectId auto-updates
 *        to P2; the task-side BEFORE doesn't fire on the cascade (it sees the new
 *        parent value and matches the new task value); the post-cascade row is
 *        consistent.
 *
 * Runs against the ephemeral migrated DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

async function expectViolationContaining(
  stmt: Promise<unknown>,
  identifier: string,
): Promise<void> {
  let message = '';
  try {
    await stmt;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    `expected the trigger to RAISE ${identifier} but the write was accepted`,
  ).toContain(identifier);
}

describe('DAT-037 — cross-table task.projectId consistency (real DB)', () => {
  let projectA: string;
  let projectB: string;

  beforeAll(async () => {
    await db.$connect();
    const a = await db.project.create({
      data: { name: `DAT-037 A ${randomUUID()}` },
    });
    projectA = a.id;
    const b = await db.project.create({
      data: { name: `DAT-037 B ${randomUUID()}` },
    });
    projectB = b.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function mkEpic(projectId: string, label: string): Promise<string> {
    const e = await db.epic.create({
      data: { name: `DAT-037 epic ${label} ${randomUUID()}`, projectId },
    });
    return e.id;
  }

  async function mkMilestone(
    projectId: string,
    label: string,
  ): Promise<string> {
    const m = await db.milestone.create({
      data: {
        name: `DAT-037 ms ${label} ${randomUUID()}`,
        projectId,
        dueDate: new Date('2026-12-31'),
      },
    });
    return m.id;
  }

  /** Raw INSERT of a task so the trigger surfaces its RAISE identifier verbatim. */
  function insertTaskRaw(opts: {
    projectId: string | null;
    epicId?: string;
    milestoneId?: string;
    title?: string;
  }): Promise<unknown> {
    return db.$executeRawUnsafe(
      `INSERT INTO tasks (id, title, "projectId", "epicId", "milestoneId", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, now())`,
      opts.title ?? `DAT-037 task ${randomUUID()}`,
      opts.projectId,
      opts.epicId ?? null,
      opts.milestoneId ?? null,
    );
  }

  it('rejects INSERT task with epicId but projectId disagreeing (tasks_project_matches_epic)', async () => {
    const epicInA = await mkEpic(projectA, 'epic-A');
    await expectViolationContaining(
      insertTaskRaw({ projectId: projectB, epicId: epicInA }),
      'tasks_project_matches_epic',
    );
  });

  it('rejects INSERT task with milestoneId but projectId disagreeing (tasks_project_matches_milestone)', async () => {
    const msInA = await mkMilestone(projectA, 'ms-A');
    await expectViolationContaining(
      insertTaskRaw({ projectId: projectB, milestoneId: msInA }),
      'tasks_project_matches_milestone',
    );
  });

  it('rejects UPDATE that re-points task.projectId to disagree with its existing epic', async () => {
    const epicInA = await mkEpic(projectA, 'upd-epic-A');
    const t = await db.task.create({
      data: {
        title: `DAT-037 upd ${randomUUID()}`,
        projectId: projectA,
        epicId: epicInA,
      },
    });
    await expectViolationContaining(
      db.$executeRawUnsafe(
        `UPDATE tasks SET "projectId" = $1 WHERE id = $2`,
        projectB,
        t.id,
      ),
      'tasks_project_matches_epic',
    );
  });

  it('ACCEPTS INSERT task with epicId and matching projectId', async () => {
    const epicInA = await mkEpic(projectA, 'happy-epic');
    await expect(
      insertTaskRaw({ projectId: projectA, epicId: epicInA }),
    ).resolves.toBe(1);
  });

  it('ACCEPTS INSERT task with epicId AND milestoneId both in the same project', async () => {
    const epicInA = await mkEpic(projectA, 'both-epic');
    const msInA = await mkMilestone(projectA, 'both-ms');
    await expect(
      insertTaskRaw({
        projectId: projectA,
        epicId: epicInA,
        milestoneId: msInA,
      }),
    ).resolves.toBe(1);
  });

  it('ACCEPTS INSERT task with no parents (orphan task allowed by DAT-017)', async () => {
    await expect(insertTaskRaw({ projectId: null })).resolves.toBe(1);
  });

  it('CASCADE: UPDATE epic.projectId rewrites dependent tasks (proves no deadlock)', async () => {
    // Setup: epic in project A with two child tasks both in project A.
    const e = await mkEpic(projectA, 'cascade-epic');
    const t1 = await db.task.create({
      data: {
        title: `DAT-037 cas-t1 ${randomUUID()}`,
        projectId: projectA,
        epicId: e,
      },
    });
    const t2 = await db.task.create({
      data: {
        title: `DAT-037 cas-t2 ${randomUUID()}`,
        projectId: projectA,
        epicId: e,
      },
    });

    // Move the epic to project B. Without the parent-side cascade, the task-side
    // BEFORE on subsequent task UPDATEs would block any re-alignment. With the
    // cascade, the parent UPDATE succeeds and tasks auto-align.
    await db.$executeRawUnsafe(
      `UPDATE epics SET "projectId" = $1 WHERE id = $2`,
      projectB,
      e,
    );

    const after1 = await db.task.findUnique({ where: { id: t1.id } });
    const after2 = await db.task.findUnique({ where: { id: t2.id } });
    expect(after1?.projectId).toBe(projectB);
    expect(after2?.projectId).toBe(projectB);

    // Post-cascade rows must still pass the BEFORE on a no-op title update —
    // proves the cascade brought tasks into compliance with the new parent value.
    await expect(
      db.$executeRawUnsafe(
        `UPDATE tasks SET title = $1 WHERE id = $2`,
        'post-cascade noop',
        t1.id,
      ),
    ).resolves.toBe(1);
  });
});
