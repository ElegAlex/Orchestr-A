import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-038 — real-DB witnesses for the Event.parentEventId cycle-prevention guards
 * added in migration 20260528140000_dat038_event_parent_cycle_prevention.
 *
 * Direct DAT-018 analog on a self-FK column (parentEventId on the events node table)
 * rather than an edge join table. Unlike DAT-018 there is NO service-level cycle guard
 * for events (events.service.ts has no equivalent of checkCircularDependency) — the
 * trigger is the only line of defense, not just a DB floor. Two complementary guards:
 *
 *   - CHECK events_parent_no_self_ck ("parentEventId" IS DISTINCT FROM "id") — the
 *     1-hop self-loop. Surfaces SQLSTATE 23514 + the constraint name. `IS DISTINCT FROM`
 *     tolerates the NULL-parent hot path (dev: 0/195 events parented).
 *   - BEFORE INSERT OR UPDATE trigger events_parent_no_cycle_trg — multi-hop cycles.
 *     Walks the existing graph UPWARD from NEW.parentEventId via each ancestor row's
 *     own parentEventId; if NEW.id is reachable it RAISEs (P0001) a message carrying
 *     the identifier `events_parent_no_cycle`.
 *
 * Self-loop deliberately left to the CHECK: in a valid forest the upward walk from X
 * never returns to X via OTHER rows' parent fields, so the trigger stays silent and
 * the CHECK fires — the two guards never both fire on one row.
 *
 * Test set: 3 negatives (self-loop INSERT, 2-hop INSERT cycle, 3-hop INSERT cycle),
 * 3 INSERT-positives (NULL-parent — the hot path; linear chain; sibling tree), and
 * 1 UPDATE-positive locking the TG_OP/OLD-id exclusion (re-point that a naive trigger
 * traversing the stale OLD row would false-reject). Plus 1 UPDATE-negative (a real
 * cycle introduced by UPDATE) to exercise the BEFORE UPDATE arm.
 *
 * Negatives use raw SQL ($executeRawUnsafe) so the driver surfaces the SQLSTATE /
 * message verbatim. Pre-migration the offending writes are accepted (the FAIL-pre the
 * contract demands); post-migration the DB rejects them. Each test creates its own
 * events so they cannot collide across tests (the suite runs serially but shares one
 * DB). Runs against the ephemeral migrated DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

async function expectSelfLoopRejected(insert: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected a check_violation (23514) but the INSERT was accepted',
  ).toMatch(/23514/);
  expect(message).toContain('events_parent_no_self_ck');
}

async function expectCycleRejected(stmt: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await stmt;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected the cycle trigger to RAISE but the statement was accepted',
  ).toContain('events_parent_no_cycle');
}

describe('DAT-038 — events parent-chain cycle prevention (real DB)', () => {
  let createdById: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat038-${randomUUID()}@witness.test`,
        login: `dat038-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat038',
        lastName: 'Witness',
      },
    });
    createdById = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Create a fresh event with a known id and an optional parent. Goes through the
   *  ORM so the trigger sees the same write path as production code. */
  async function mkEvent(
    label: string,
    parentEventId: string | null = null,
  ): Promise<string> {
    const e = await db.event.create({
      data: {
        title: `DAT-038 ${label} ${randomUUID()}`,
        date: new Date('2026-06-01'),
        createdById,
        parentEventId,
      },
    });
    return e.id;
  }

  /** Raw INSERT of an event with a specific id + parent. Used for self-loop / 2-hop /
   *  3-hop cycle witnesses so the SQLSTATE / RAISE message surfaces verbatim. */
  function insertEventWith(
    id: string,
    parentEventId: string | null,
  ): Promise<unknown> {
    return db.$executeRawUnsafe(
      `INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring", "createdById", "createdAt", "updatedAt", "parentEventId")
       VALUES ($1, $2, DATE '2026-06-01', true, false, false, $3, now(), now(), $4)`,
      id,
      `DAT-038 raw ${id}`,
      createdById,
      parentEventId,
    );
  }

  // Negative #1 — self-loop X.parentEventId = X.id. Caught by the CHECK (23514).
  it('rejects a self-loop X.parentEventId = X.id (events_parent_no_self_ck)', async () => {
    const x = randomUUID();
    await expectSelfLoopRejected(insertEventWith(x, x));
  });

  // Negative #2 — 2-hop cycle: A has no parent; B parent=A; then UPDATE A parent=B.
  // The UPDATE closes the cycle (trigger).
  it('rejects a 2-hop cycle A.parent=B, B.parent=A (events_parent_no_cycle)', async () => {
    const a = await mkEvent('2hop-A');
    const b = await mkEvent('2hop-B', a);
    await expectCycleRejected(
      db.$executeRawUnsafe(
        `UPDATE events SET "parentEventId" = $1 WHERE id = $2`,
        b,
        a,
      ),
    );
  });

  // Negative #3 — 3-hop cycle: A,B,C in a linear chain C->B->A, then UPDATE A parent=C.
  it('rejects a 3-hop cycle A->B->C with A.parent=C (events_parent_no_cycle)', async () => {
    const a = await mkEvent('3hop-A');
    const b = await mkEvent('3hop-B', a);
    const c = await mkEvent('3hop-C', b);
    await expectCycleRejected(
      db.$executeRawUnsafe(
        `UPDATE events SET "parentEventId" = $1 WHERE id = $2`,
        c,
        a,
      ),
    );
  });

  // Positive #1 — NULL parent (the hot path: dev shows 0/195 events parented). The
  // short-circuit `IF NEW.parentEventId IS NULL THEN RETURN NEW` must accept this.
  it('ACCEPTS an event with no parent (NULL — the hot path)', async () => {
    await expect(mkEvent('null-parent')).resolves.toMatch(/.+/);
  });

  // Positive #2 — linear chain A (root) <- B <- C <- D. All four accepted.
  it('ACCEPTS a linear chain A <- B <- C <- D (no false reject)', async () => {
    const a = await mkEvent('lin-A');
    const b = await mkEvent('lin-B', a);
    const c = await mkEvent('lin-C', b);
    await expect(mkEvent('lin-D', c)).resolves.toMatch(/.+/);
  });

  // Positive #3 — sibling tree: A (root) has children B and C — same parent, no cycle.
  it('ACCEPTS sibling children of one parent (no false reject)', async () => {
    const a = await mkEvent('tree-A');
    await expect(mkEvent('tree-B', a)).resolves.toMatch(/.+/);
    await expect(mkEvent('tree-C', a)).resolves.toMatch(/.+/);
  });

  // UPDATE-positive — re-point a child from one valid parent to another valid parent
  // (legitimate re-attach). A naive trigger that walks the stale OLD parent would
  // false-reject; the TG_OP/OLD-id exclusion makes the walk reflect the post-update
  // graph, so this must be accepted. Carries DAT-018's load-bearing learning #3.
  it('ACCEPTS re-pointing C from B to A on UPDATE (OLD-row exclusion)', async () => {
    const a = await mkEvent('upd-A');
    const b = await mkEvent('upd-B', a);
    const c = await mkEvent('upd-C', b);
    await expect(
      db.$executeRawUnsafe(
        `UPDATE events SET "parentEventId" = $1 WHERE id = $2`,
        a,
        c,
      ),
    ).resolves.toBe(1);
  });
});
