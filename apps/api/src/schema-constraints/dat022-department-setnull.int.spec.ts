import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-022 — real-DB witness for the User.department onDelete: SetNull → Restrict
 * change applied in migration 20260603000000_dat022_department_fk_restrict (or similar).
 *
 * Root cause: SetNull silently strips users to no-department state when a department
 * is deleted. RBAC scope checks then return empty results without raising — a manager
 * loses visibility on their team.
 *
 * Fix: onDelete: Restrict on User.department. The DB now REJECTS a department delete
 * when users are still assigned to it (SQLSTATE 23503 / foreign_key_violation).
 *
 * Test strategy: bypass the app-layer guard in DepartmentsService.remove()
 * (which already throws BadRequestException when _count.users > 0) and call
 * prisma.department.delete() directly so the DB constraint is what we're exercising.
 *
 *   FAIL-pre  (SetNull):  prisma.department.delete() succeeds; user.departmentId
 *                         becomes NULL. The assertion for a restrict_violation FAILS → RED.
 *   PASS-post (Restrict): prisma.department.delete() throws 23001 restrict_violation. GREEN.
 *
 * The test also verifies the positive case: a department with NO users can still be
 * deleted (Restrict only blocks when referencing rows exist).
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

/**
 * Assert a delete is rejected with a FK / Restrict violation.
 *
 * Postgres error codes for referential-integrity failures:
 *   23001 — restrict_violation  (onDelete: Restrict fires this)
 *   23503 — foreign_key_violation (onDelete: NoAction fires this)
 *   P2003 — Prisma wraps both as PrismaClientKnownRequestError P2003
 *
 * Teeth by construction: if the constraint is SetNull (FAIL-pre), the delete succeeds,
 * `message` stays empty, and the assertion fails loudly — a vacuous green is impossible.
 */
async function expectFkViolation(op: Promise<unknown>): Promise<void> {
  let message = '';
  try {
    await op;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected a restrict_violation (P2003 / 23001 / 23503) but the DELETE was accepted — ' +
      'onDelete is still SetNull instead of Restrict',
  ).toMatch(/P2003|23001|23503/);
}

describe('DAT-022 — User.department onDelete Restrict (real DB)', () => {
  let deptId: string;
  let userId: string;
  let emptyDeptId: string;

  beforeAll(async () => {
    await db.$connect();

    // Create a department with a user in it.
    const dept = await db.department.create({
      data: { name: `DAT-022-dept-${randomUUID()}` },
    });
    deptId = dept.id;

    const user = await db.user.create({
      data: {
        email: `dat022-${randomUUID()}@witness.test`,
        login: `dat022-${randomUUID()}`,
        passwordHash: 'x',
        firstName: 'Dat022',
        lastName: 'Witness',
        departmentId: deptId,
      },
    });
    userId = user.id;

    // Create a separate empty department for the positive case.
    const emptyDept = await db.department.create({
      data: { name: `DAT-022-empty-${randomUUID()}` },
    });
    emptyDeptId = emptyDept.id;
  });

  afterAll(async () => {
    // Clean up: disconnect user from their (still-existing) department so we can
    // drop fixtures cleanly regardless of whether the FK is SetNull or Restrict.
    await db.user.delete({ where: { id: userId } }).catch(() => null);
    await db.department.delete({ where: { id: deptId } }).catch(() => null);
    await db.department.delete({ where: { id: emptyDeptId } }).catch(() => null);
    await db.$disconnect();
  });

  it(
    'rejects department delete when users are still assigned (restrict_violation 23001)',
    async () => {
      // Bypass the service guard and hit the DB constraint directly.
      await expectFkViolation(
        db.department.delete({ where: { id: deptId } }),
      );
    },
  );

  it('allows department delete when no users are assigned (Restrict only blocks on references)', async () => {
    // Positive case: an empty department must still be deletable after the fix.
    await db.department.delete({ where: { id: emptyDeptId } });
    emptyDeptId = ''; // mark as deleted so afterAll skip is idempotent
    expect(true).toBe(true);
  });
});
