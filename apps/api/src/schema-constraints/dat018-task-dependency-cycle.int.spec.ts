import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-018 — real-DB witnesses for the TaskDependency cycle-prevention guards added
 * in migration 20260527180000_dat018_task_dependency_cycle_prevention.
 *
 * Two complementary DB-level guards close the cycle hole the service-layer
 * checkCircularDependency() already covers (defense-in-depth — the DB floor catches
 * direct-SQL / non-addDependency paths the service can't):
 *
 *   - CHECK task_dependencies_no_self_ck ("taskId" <> "dependsOnTaskId") — the 1-hop
 *     self-loop. Surfaces SQLSTATE 23514 + the constraint name.
 *   - BEFORE INSERT OR UPDATE trigger task_dependencies_no_cycle_trg — multi-hop
 *     cycles. Walks the existing graph forward from NEW.dependsOnTaskId; if NEW.taskId
 *     is reachable it RAISEs (P0001) a message carrying the identifier
 *     `task_dependencies_no_cycle`.
 *
 * The self-loop is deliberately left to the CHECK: in a valid DAG the forward walk
 * from X never reaches X, so the trigger stays silent and the CHECK fires — the two
 * guards never both fire on one row, and each negative asserts a distinct signal.
 *
 * 7 tests: 3 negatives (self-loop, 2-hop, 3-hop), 3 INSERT-positives (linear chain,
 * tree, diamond — proving the trigger does not false-reject DAGs), and 1 UPDATE-
 * positive (a legitimate re-point that a naive trigger would false-reject by
 * traversing the stale OLD row — locks the TG_OP/OLD.id exclusion clause).
 *
 * Negatives use raw SQL ($executeRawUnsafe) so the driver surfaces the SQLSTATE /
 * message verbatim. Pre-migration the offending writes are accepted (the FAIL-pre the
 * contract demands); post-migration the DB rejects them. Each test creates its own
 * tasks so edges from one test cannot pollute another (the suite runs serially but
 * shares one DB). Runs against the ephemeral migrated DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert a raw INSERT is rejected by the self-loop CHECK. Teeth by construction: if
 * the constraint is absent (FAIL-pre) the INSERT is accepted, `message` stays empty,
 * and the 23514 assertion fails loudly — a vacuous green is impossible.
 */
async function expectSelfLoopRejected(insert: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(message, 'expected a check_violation (23514) but the INSERT was accepted').toMatch(
    /23514/,
  );
  expect(message).toContain('task_dependencies_no_self_ck');
}

/**
 * Assert a raw INSERT is rejected by the cycle-prevention trigger. Teeth by
 * construction: if the trigger is absent (FAIL-pre) the INSERT is accepted, `message`
 * stays empty, and the identifier assertion fails loudly.
 */
async function expectCycleRejected(insert: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(message, 'expected the cycle trigger to RAISE but the INSERT was accepted').toContain(
    'task_dependencies_no_cycle',
  );
}

describe('DAT-018 — task_dependencies cycle prevention (real DB)', () => {
  let projectId: string;

  beforeAll(async () => {
    await db.$connect();
    const project = await db.project.create({ data: { name: `DAT-018 project ${randomUUID()}` } });
    projectId = project.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Create a fresh task within the shared project; returns its id. */
  async function mkTask(label: string): Promise<string> {
    const t = await db.task.create({ data: { title: `DAT-018 ${label} ${randomUUID()}`, projectId } });
    return t.id;
  }

  /** Raw INSERT of a dependency edge (bypasses the service, so the DB guards fire). */
  function addDep(taskId: string, dependsOnTaskId: string): Promise<unknown> {
    return db.$executeRawUnsafe(
      `INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, now())`,
      taskId,
      dependsOnTaskId,
    );
  }

  // Negative #1 — 1-hop self-loop A → A. Caught by the CHECK (23514), not the trigger.
  it('rejects a self-loop A->A (task_dependencies_no_self_ck)', async () => {
    const a = await mkTask('selfloop-A');
    await expectSelfLoopRejected(addDep(a, a));
  });

  // Negative #2 — 2-hop cycle: A->B then B->A. The 2nd edge closes the cycle (trigger).
  it('rejects a 2-hop cycle A->B, B->A (task_dependencies_no_cycle)', async () => {
    const a = await mkTask('2hop-A');
    const b = await mkTask('2hop-B');
    await addDep(a, b); // accepted
    await expectCycleRejected(addDep(b, a));
  });

  // Negative #3 — 3-hop cycle: A->B, B->C then C->A. The 3rd edge closes it (trigger).
  it('rejects a 3-hop cycle A->B, B->C, C->A (task_dependencies_no_cycle)', async () => {
    const a = await mkTask('3hop-A');
    const b = await mkTask('3hop-B');
    const c = await mkTask('3hop-C');
    await addDep(a, b); // accepted
    await addDep(b, c); // accepted
    await expectCycleRejected(addDep(c, a));
  });

  // Positive #1 — linear chain A->B->C->D: 3 edges, all accepted (no cycle).
  it('ACCEPTS a linear chain A->B->C->D (no false reject)', async () => {
    const a = await mkTask('lin-A');
    const b = await mkTask('lin-B');
    const c = await mkTask('lin-C');
    const d = await mkTask('lin-D');
    await expect(addDep(a, b)).resolves.toBeDefined();
    await expect(addDep(b, c)).resolves.toBeDefined();
    await expect(addDep(c, d)).resolves.toBeDefined();
  });

  // Positive #2 — tree A->B, A->C: both accepted (shared parent is not a cycle).
  it('ACCEPTS a tree A->B, A->C (no false reject)', async () => {
    const a = await mkTask('tree-A');
    const b = await mkTask('tree-B');
    const c = await mkTask('tree-C');
    await expect(addDep(a, b)).resolves.toBeDefined();
    await expect(addDep(a, c)).resolves.toBeDefined();
  });

  // Positive #3 — diamond A->B, A->C, B->D, C->D: all 4 accepted (convergence, no cycle).
  it('ACCEPTS a diamond A->B, A->C, B->D, C->D (no false reject)', async () => {
    const a = await mkTask('dia-A');
    const b = await mkTask('dia-B');
    const c = await mkTask('dia-C');
    const d = await mkTask('dia-D');
    await expect(addDep(a, b)).resolves.toBeDefined();
    await expect(addDep(a, c)).resolves.toBeDefined();
    await expect(addDep(b, d)).resolves.toBeDefined();
    await expect(addDep(c, d)).resolves.toBeDefined();
  });

  // UPDATE-positive — re-point an existing edge (A->B) to (A->C). A naive trigger
  // would traverse the stale OLD A->B row and false-reject; the TG_OP/OLD.id exclusion
  // makes the walk reflect the post-update graph, so this must be accepted.
  it('ACCEPTS re-pointing an edge A->B to A->C on UPDATE (OLD-row exclusion)', async () => {
    const a = await mkTask('upd-A');
    const b = await mkTask('upd-B');
    const c = await mkTask('upd-C');
    const edge = await db.taskDependency.create({ data: { taskId: a, dependsOnTaskId: b } });
    await expect(
      db.$executeRawUnsafe(
        `UPDATE task_dependencies SET "dependsOnTaskId" = $1 WHERE id = $2`,
        c,
        edge.id,
      ),
    ).resolves.toBe(1);
  });
});
