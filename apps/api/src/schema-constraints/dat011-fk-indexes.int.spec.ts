import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from 'database';

/**
 * DAT-011 — real-DB witness for the 25 single-column FK indexes added to
 * multiple tables in migration 20260603115724_dat011_fk_indexes.
 *
 * Postgres does NOT auto-index FK columns; Prisma only auto-indexes @id and
 * @unique fields. The tables below all had FK relations without corresponding
 * B-tree indexes, causing full-table scans on join / ON DELETE / filter paths.
 *
 * Structural witness (SCHEMA INDEX EXCEPTION — no behavioural unit test):
 *   BEFORE migration: pg_indexes on each table shows only PK/unique indexes.
 *   AFTER  migration: pg_indexes also contains all the indexes listed below.
 *
 * This spec asserts the POST state — it runs against the ephemeral migrated DB
 * provisioned by vitest.int.global-setup.ts via `prisma migrate deploy`.
 * Running against an un-migrated DB causes the pg_indexes queries to return
 * zero rows — the expectations fail loudly and precisely.
 *
 * Index names are taken verbatim from the generated migration SQL; camelCase
 * fields remain camelCase (e.g. "taskId"), @map'd fields become snake_case
 * (e.g. "delegator_id", "validated_by_id").
 *
 * Skip list — already covered by composite indexes from DAT-010:
 *   Leave.userId        — leading column in leaves_userId_status_idx
 *   Leave.validatorId   — leading column in leaves_validator_id_status_idx
 *   Leave.leaveTypeId   — leading column in leaves_leave_type_id_status_idx
 * Skip list — covered as leading column in @@unique composite:
 *   Service.departmentId — leading column in services_departmentId_name_key
 */

const db = new PrismaClient();

/** [tablename, indexname] pairs — exact values from migration SQL */
const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ['comments', 'comments_taskId_idx'],
  ['comments', 'comments_authorId_idx'],
  ['departments', 'departments_managerId_idx'],
  ['documents', 'documents_projectId_idx'],
  ['documents', 'documents_uploadedBy_idx'],
  ['epics', 'epics_projectId_idx'],
  ['events', 'events_projectId_idx'],
  ['events', 'events_createdById_idx'],
  ['events', 'events_parentEventId_idx'],
  ['holidays', 'holidays_createdById_idx'],
  ['leave_validation_delegates', 'leave_validation_delegates_delegator_id_idx'],
  ['leave_validation_delegates', 'leave_validation_delegates_delegate_id_idx'],
  ['leaves', 'leaves_validated_by_id_idx'],
  ['milestones', 'milestones_projectId_idx'],
  ['password_reset_tokens', 'password_reset_tokens_userId_idx'],
  ['password_reset_tokens', 'password_reset_tokens_createdById_idx'],
  [
    'predefined_task_recurring_rules',
    'predefined_task_recurring_rules_predefinedTaskId_idx',
  ],
  [
    'predefined_task_recurring_rules',
    'predefined_task_recurring_rules_userId_idx',
  ],
  [
    'predefined_task_recurring_rules',
    'predefined_task_recurring_rules_createdById_idx',
  ],
  ['predefined_tasks', 'predefined_tasks_createdById_idx'],
  ['projects', 'projects_createdById_idx'],
  ['projects', 'projects_managerId_idx'],
  ['projects', 'projects_sponsorId_idx'],
  ['projects', 'projects_archivedById_idx'],
  ['services', 'services_managerId_idx'],
] as const;

describe('DAT-011 — FK indexes on unindexed FK columns (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('all 25 FK indexes exist in pg_indexes', async () => {
    const indexNames = EXPECTED.map(([, name]) => name);

    const rows = await db.$queryRawUnsafe<
      { indexname: string; tablename: string }[]
    >(
      `SELECT tablename, indexname FROM pg_indexes
       WHERE indexname = ANY($1::text[])
       ORDER BY tablename, indexname`,
      indexNames as unknown as string[],
    );

    const found = rows.map((r) => r.indexname);

    for (const [tablename, indexname] of EXPECTED) {
      expect(
        found,
        `index "${indexname}" not found on table "${tablename}" — migration may not have been applied`,
      ).toContain(indexname);
    }

    expect(found).toHaveLength(EXPECTED.length);
  });

  it('comments FK indexes cover correct columns (taskId, authorId)', async () => {
    const rows = await db.$queryRawUnsafe<
      { indexname: string; indexdef: string }[]
    >(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'comments' AND indexname IN ('comments_taskId_idx','comments_authorId_idx')
       ORDER BY indexname`,
    );
    expect(rows).toHaveLength(2);
    const defs = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    expect(defs['comments_taskId_idx']).toMatch(/"taskId"/);
    expect(defs['comments_authorId_idx']).toMatch(/"authorId"/);
  });

  it('leaves_validated_by_id_idx covers validated_by_id (mapped column)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'leaves_validated_by_id_idx'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/validated_by_id/);
  });

  it("leave_validation_delegates indexes cover @map'd delegator_id and delegate_id", async () => {
    const rows = await db.$queryRawUnsafe<
      { indexname: string; indexdef: string }[]
    >(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'leave_validation_delegates'
         AND indexname IN (
           'leave_validation_delegates_delegator_id_idx',
           'leave_validation_delegates_delegate_id_idx'
         )
       ORDER BY indexname`,
    );
    expect(rows).toHaveLength(2);
    const defs = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    expect(defs['leave_validation_delegates_delegator_id_idx']).toMatch(
      /delegator_id/,
    );
    expect(defs['leave_validation_delegates_delegate_id_idx']).toMatch(
      /delegate_id/,
    );
  });

  it('projects FK indexes cover all four user-FK columns', async () => {
    const rows = await db.$queryRawUnsafe<
      { indexname: string; indexdef: string }[]
    >(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'projects'
         AND indexname IN (
           'projects_createdById_idx',
           'projects_managerId_idx',
           'projects_sponsorId_idx',
           'projects_archivedById_idx'
         )
       ORDER BY indexname`,
    );
    expect(rows).toHaveLength(4);
    const defs = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    expect(defs['projects_createdById_idx']).toMatch(/"createdById"/);
    expect(defs['projects_managerId_idx']).toMatch(/"managerId"/);
    expect(defs['projects_sponsorId_idx']).toMatch(/"sponsorId"/);
    expect(defs['projects_archivedById_idx']).toMatch(/"archivedById"/);
  });
});
