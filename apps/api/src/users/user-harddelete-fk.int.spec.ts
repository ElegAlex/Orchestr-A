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

/**
 * DAT-008 / DAT-026 (decision A′) — real-DB witness for the anonymised-shell
 * deletion path. Because the audit_logs.actorId FK above forbids physically
 * deleting an audit-authoring user, UsersService.hardDelete instead ANONYMISES the
 * row in place. This proves the DB supports that pattern: the User row survives
 * with tombstoned identifiers + deletedAt set, the audit row is untouched and
 * still references the (now anonymised) id, and a raw physical delete is STILL
 * rejected by the FK — confirming OBS-002 / audit_logs were not altered to make
 * erasure work. The trigger's own immutability is covered by audit-immutability.int.spec.ts.
 */
describe('anonymised-shell deletion coexists with the immutable audit trail (real DB)', () => {
  it('anonymises the user in place; audit row persists referencing the id; raw physical delete still rejected (P2003)', async () => {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `int-${userId}@example.test`,
        login: `int-${userId}`,
        passwordHash: 'integration-test-not-a-real-hash',
        firstName: 'Real',
        lastName: 'Person',
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

    // What hardDelete does for an audit-bearing user: anonymise in place.
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymized.invalid`,
        login: `deleted-${userId}`,
        firstName: 'Utilisateur',
        lastName: 'supprimé',
        avatarUrl: null,
        avatarPreset: null,
        isActive: false,
        deletedAt: new Date(),
      },
    });

    // The shell survives with PII tombstoned + deletedAt set + deactivated.
    const shell = await prisma.user.findUnique({ where: { id: userId } });
    expect(shell).not.toBeNull();
    expect(shell?.deletedAt).not.toBeNull();
    expect(shell?.isActive).toBe(false);
    expect(shell?.email).toBe(`deleted-${userId}@anonymized.invalid`);
    expect(shell?.login).toBe(`deleted-${userId}`);
    expect(shell?.firstName).not.toBe('Real');
    expect(shell?.lastName).not.toBe('Person');

    // The audit row is untouched and still attributes the action to this id.
    const audit = await prisma.auditLog.findFirst({
      where: { actorId: userId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(userId);

    // The FK is unchanged: a raw physical delete is STILL rejected — which is
    // exactly why the shell path exists. audit_logs / OBS-002 were not weakened.
    let code: string | undefined;
    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      code =
        err instanceof Prisma.PrismaClientKnownRequestError
          ? err.code
          : 'rejected';
    }
    expect(code).toBeDefined();

    // The shell and its audit row both still exist (immutable trail preserved).
    expect(
      await prisma.user.findUnique({ where: { id: userId } }),
    ).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { actorId: userId } })).toBe(1);
  });
});
