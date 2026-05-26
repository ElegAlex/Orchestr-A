import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from 'database';

/**
 * TST-DB-001 — real-DB witness for the USR-DEL-001 invariant: a user who authored
 * an audit row cannot be hard-deleted. The audit_logs.actorId FK is ON DELETE
 * NO ACTION (migration 20260525190000 §5 — SetNull would issue an UPDATE the
 * immutability trigger rejects), so the DB itself rejects the delete with P2003.
 * UsersService.checkDependencies turns that into a typed ConflictException by
 * counting `audit_logs WHERE actorId = userId` first; this test proves both the
 * DB-level guarantee and the exact count predicate the service relies on.
 *
 * The mocked unit suite can assert the count→ConflictException mapping but never
 * the FK rejection itself — that is the gap this harness closes.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const prisma = new PrismaClient();

describe('audit_logs.actorId FK ON DELETE NO ACTION blocks user hardDelete (real DB)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects deleting a user who authored an audit row (P2003); dep-check counts it; both rows survive', async () => {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `int-${userId}@example.test`,
        login: `int-${userId}`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Int',
        lastName: 'Test',
      },
    });
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN_SUCCESS',
        entityType: 'Auth',
        entityId: userId,
        actorId: userId,
        rowHash: createHash('sha256').update(userId).digest('hex'),
      },
    });

    // The exact predicate UsersService.checkDependencies uses, on a real DB.
    expect(await prisma.auditLog.count({ where: { actorId: userId } })).toBe(1);

    // DB-level guarantee: NO ACTION rejects the delete before any row is touched.
    let code: string | undefined;
    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        code = err.code;
      }
    }
    expect(code).toBe('P2003');

    // No partial delete: user and its audit row both survive.
    expect(
      await prisma.user.findUnique({ where: { id: userId } }),
    ).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { actorId: userId } })).toBe(1);
  });
});
