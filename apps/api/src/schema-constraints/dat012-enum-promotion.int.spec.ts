import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-012 — real-DB witness for the String→enum promotions in migration
 * 20260527130000_dat012_promote_string_enums.
 *
 * Six columns were promoted to five native Postgres enums:
 *   - PredefinedTaskDuration       (predefined_tasks.defaultDuration)
 *   - DayPeriod                    (predefined_task_assignments.period +
 *                                   predefined_task_recurring_rules.period)
 *   - AssignmentCompletionStatus   (predefined_task_assignments.completionStatus)
 *   - RecurrenceType               (predefined_task_recurring_rules.recurrenceType)
 *   - AppSettingsCategory          (app_settings.category)
 *
 * One representative negative case per distinct enum (DayPeriod is exercised
 * once — the type, not each column, is what the migration creates). A raw INSERT
 * of a value outside the enum set is accepted pre-migration (column was text) and
 * rejected post-migration with SQLSTATE 22P02 (invalid_text_representation —
 * "invalid input value for enum"). Raw SQL surfaces the driver code verbatim.
 *
 * Teeth by construction: if a column were still `text` (FAIL-pre), the INSERT is
 * accepted, `message` stays empty, and the /22P02/ assertion fails loudly — a
 * vacuous green is impossible. A positive case asserts valid members are accepted.
 *
 * AuditLog.action / entityType are intentionally NOT enums (documented canonical
 * codes — docs/audit/canonical-action-codes.md), so they have no DB-level witness
 * here; their write-side guarantee is compile-time (audit-action.enum.ts +
 * ENTITY_TYPE_BY_ACTION + audit-payload-registry.compile-witness.ts).
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert a raw INSERT is rejected by an enum type with SQLSTATE 22P02.
 */
async function expectEnumViolation(insert: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected an invalid-enum-input error (22P02) but the INSERT was accepted',
  ).toMatch(/22P02/);
}

describe('DAT-012 — string→enum promotion (real DB)', () => {
  let userId: string;
  let predefinedTaskId: string;

  beforeAll(async () => {
    await db.$connect();
    const user = await db.user.create({
      data: {
        email: `dat012-${randomUUID()}@witness.test`,
        login: `dat012-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat012',
        lastName: 'Witness',
      },
    });
    userId = user.id;
    // Parent predefined task via raw SQL, NOT the typed client: the generated
    // client casts defaultDuration to the enum type, which does not exist in the
    // FAIL-pre (neutralized-migration) world — that would error here and skip the
    // negative assertions. Raw SQL keeps the parent setup migration-agnostic so the
    // 22P02 assertions are what actually flips FAIL-pre → PASS-post.
    predefinedTaskId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", "createdById", "updatedAt")
       VALUES ($1, 'DAT-012 witness predef', 'FULL_DAY', $2, now())`,
      predefinedTaskId,
      userId,
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('PredefinedTaskDuration: rejects an invalid defaultDuration (22P02)', async () => {
    await expectEnumViolation(
      db.$executeRawUnsafe(
        `INSERT INTO predefined_tasks (id, name, "defaultDuration", "createdById", "updatedAt")
         VALUES (gen_random_uuid(), 'DAT-012 bad duration', 'BOGUS', $1, now())`,
        userId,
      ),
    );
  });

  it('DayPeriod: rejects an invalid assignment period (22P02)', async () => {
    await expectEnumViolation(
      db.$executeRawUnsafe(
        `INSERT INTO predefined_task_assignments
           (id, "predefinedTaskId", "userId", "date", "period", "assignedById", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, now(), 'BOGUS', $2, now())`,
        predefinedTaskId,
        userId,
      ),
    );
  });

  it('AssignmentCompletionStatus: rejects an invalid completionStatus (22P02)', async () => {
    await expectEnumViolation(
      db.$executeRawUnsafe(
        `INSERT INTO predefined_task_assignments
           (id, "predefinedTaskId", "userId", "date", "period", "completionStatus", "assignedById", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, now(), 'MORNING', 'BOGUS', $2, now())`,
        predefinedTaskId,
        userId,
      ),
    );
  });

  it('RecurrenceType: rejects an invalid recurrenceType (22P02)', async () => {
    await expectEnumViolation(
      db.$executeRawUnsafe(
        `INSERT INTO predefined_task_recurring_rules
           (id, "predefinedTaskId", "userId", "period", "recurrenceType", "startDate", "createdById", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'FULL_DAY', 'BOGUS', now(), $2, now())`,
        predefinedTaskId,
        userId,
      ),
    );
  });

  it('AppSettingsCategory: rejects an invalid category (22P02)', async () => {
    await expectEnumViolation(
      db.$executeRawUnsafe(
        `INSERT INTO app_settings (id, "key", "value", "category", "updatedAt")
         VALUES (gen_random_uuid(), $1, '"x"', 'BOGUS', now())`,
        `dat012-${randomUUID()}`,
      ),
    );
  });

  it('accepts valid members across all five enums', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_tasks (id, name, "defaultDuration", "createdById", "updatedAt")
       VALUES (gen_random_uuid(), 'DAT-012 ok duration', 'TIME_SLOT', $1, now())`,
      userId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_task_assignments
         (id, "predefinedTaskId", "userId", "date", "period", "completionStatus", "assignedById", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, now(), 'AFTERNOON', 'IN_PROGRESS', $2, now())`,
      predefinedTaskId,
      userId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO predefined_task_recurring_rules
         (id, "predefinedTaskId", "userId", "period", "recurrenceType", "startDate", "createdById", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'MORNING', 'MONTHLY_ORDINAL', now(), $2, now())`,
      predefinedTaskId,
      userId,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO app_settings (id, "key", "value", "category", "updatedAt")
       VALUES (gen_random_uuid(), $1, '"x"', 'planning', now())`,
      `dat012-${randomUUID()}`,
    );
    expect(true).toBe(true);
  });
});
