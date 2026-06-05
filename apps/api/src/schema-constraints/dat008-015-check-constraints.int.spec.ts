import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * DAT-008 / DAT-015 — real-DB witness for the CHECK constraints added in
 * migration 20260605192741_dat008_015_check_constraints.
 *
 * Prisma does not model CHECK constraints, so these are hand-authored SQL
 * constraints. Postgres only enforced the service-layer range validation
 * before; out-of-range values written by any other path (raw SQL, a future
 * importer, a buggy service) were accepted.
 *
 * Structural + definition witness (SCHEMA CHECK EXCEPTION — no behavioural unit
 * test): assert each constraint exists AND that its definition carries the
 * expected bounds (so a wrong expression — e.g. the wrong column or range —
 * fails loudly, not just a missing-constraint case). Runs against the ephemeral
 * migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/** [constraint name, table, substrings the CHECK def must contain] */
const EXPECTED: ReadonlyArray<
  readonly [string, string, ReadonlyArray<string>]
> = [
  // DAT-008 — allocation is a 0–100 percentage (nullable allowed).
  [
    'project_third_party_members_allocation_ck',
    'project_third_party_members',
    ['allocation', '0', '100'],
  ],
  // DAT-015 — snapshot progress is a 0–100 percentage.
  [
    'project_snapshots_progress_ck',
    'project_snapshots',
    ['progress', '0', '100'],
  ],
  // DAT-015 — snapshot task counts are non-negative.
  [
    'project_snapshots_task_counts_ck',
    'project_snapshots',
    ['tasksDone', 'tasksTotal'],
  ],
];

describe('DAT-008/DAT-015 — CHECK constraints (real DB)', () => {
  let defs: Map<string, string>;

  beforeAll(async () => {
    const rows = await db.$queryRawUnsafe<{ conname: string; def: string }[]>(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE contype = 'c'
          AND conname = ANY($1::text[])`,
      EXPECTED.map(([name]) => name),
    );
    defs = new Map(rows.map((r) => [r.conname, r.def]));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  for (const [name, table, contains] of EXPECTED) {
    it(`${name} exists on ${table} with the expected bounds`, () => {
      const def = defs.get(name);
      expect(def, `CHECK constraint ${name} is missing`).toBeDefined();
      for (const needle of contains) {
        expect(def).toContain(needle);
      }
    });
  }
});
