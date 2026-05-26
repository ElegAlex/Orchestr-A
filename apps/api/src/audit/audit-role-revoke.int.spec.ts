import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * TOOL-DEPLOY-001 — real-DB witness for the PRIVILEGE-LAYER control on audit_logs.
 *
 * The OBS-002/DAT-009 immutability trigger (witnessed in audit-immutability.int.spec.ts)
 * is the first line of defence; this spec witnesses the SECOND, independent line: the
 * restricted runtime role (`app_user`) is GRANTed only INSERT+SELECT on audit_logs,
 * with UPDATE/DELETE/TRUNCATE REVOKEd. Postgres enforces this at the privilege layer,
 * BEFORE any trigger fires — so even a hypothetical trigger bypass (operator runs
 * `ALTER TABLE … DISABLE TRIGGER`) leaves the runtime role unable to mutate the trail.
 *
 *  - default `new PrismaClient()` → DATABASE_URL → the restricted `app_user`.
 *  - migration client → DATABASE_MIGRATION_URL → the owner role (DDL: trigger toggle).
 *
 * The expected error is `permission denied for table audit_logs` (SQLSTATE 42501),
 * which is DISTINCT from the trigger's `/append-only/` RAISE (SQLSTATE 23514) — the
 * two controls are observably different and independently exercised.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const TRIGGER = 'audit_logs_no_update_delete';

const app = new PrismaClient(); // DATABASE_URL → restricted app_user
const migration = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_MIGRATION_URL } },
});

/** Insert one audit row AS THE OWNER (so seeding never depends on app-role grants). */
async function seedRowAsOwner(): Promise<string> {
  const entityId = randomUUID();
  const row = await migration.auditLog.create({
    data: {
      action: 'LOGIN_SUCCESS',
      entityType: 'Auth',
      entityId,
      payload: { success: true },
      rowHash: createHash('sha256').update(entityId).digest('hex'),
    },
  });
  return row.id;
}

describe('audit_logs privilege-layer REVOKE for the runtime role (real DB)', () => {
  beforeAll(async () => {
    await app.$connect();
    await migration.$connect();
  });
  afterAll(async () => {
    await app.$disconnect();
    await migration.$disconnect();
  });

  it('the app role CAN INSERT and SELECT audit_logs (emissions + reads unaffected)', async () => {
    const entityId = randomUUID();
    const created = await app.auditLog.create({
      data: {
        action: 'LOGIN_SUCCESS',
        entityType: 'Auth',
        entityId,
        payload: { success: true },
        rowHash: createHash('sha256').update(entityId).digest('hex'),
      },
    });
    expect(created.id).toBeTruthy();

    const read = await app.auditLog.findUnique({ where: { id: created.id } });
    expect(read).not.toBeNull();
    expect(read?.action).toBe('LOGIN_SUCCESS');
  });

  it('the app role CANNOT UPDATE audit_logs — permission denied (ORM + raw)', async () => {
    const id = await seedRowAsOwner();

    await expect(
      app.auditLog.update({ where: { id }, data: { action: 'TAMPERED' } }),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      app.$executeRawUnsafe(
        'UPDATE audit_logs SET action = $1 WHERE id = $2',
        'TAMPERED',
        id,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('the app role CANNOT DELETE audit_logs — permission denied (ORM + raw)', async () => {
    const id = await seedRowAsOwner();

    await expect(app.auditLog.delete({ where: { id } })).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      app.$executeRawUnsafe('DELETE FROM audit_logs WHERE id = $1', id),
    ).rejects.toThrow(/permission denied/i);

    // The row survives (read back via the owner to avoid any app-role SELECT doubt).
    const survivor = await migration.auditLog.findUnique({ where: { id } });
    expect(survivor).not.toBeNull();
    expect(survivor?.action).toBe('LOGIN_SUCCESS');
  });

  it('the REVOKE blocks the app role even when the trigger is DISABLED (independent of the trigger)', async () => {
    const id = await seedRowAsOwner();

    // Operator-style bypass attempt: disable the trigger as the owner…
    await migration.$executeRawUnsafe(
      `ALTER TABLE audit_logs DISABLE TRIGGER ${TRIGGER}`,
    );
    try {
      // …the app role STILL cannot UPDATE: the privilege check fires first, so the
      // error is `permission denied` (42501), NOT the trigger's `/append-only/`.
      let message = '';
      try {
        await app.$executeRawUnsafe(
          'UPDATE audit_logs SET action = $1 WHERE id = $2',
          'TAMPERED',
          id,
        );
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message).toMatch(/permission denied/i);
      expect(message).not.toMatch(/append-only/i);
    } finally {
      // Re-enable so the chain's integrity guarantee is restored for any later row.
      await migration.$executeRawUnsafe(
        `ALTER TABLE audit_logs ENABLE TRIGGER ${TRIGGER}`,
      );
    }

    const survivor = await migration.auditLog.findUnique({ where: { id } });
    expect(survivor?.action).toBe('LOGIN_SUCCESS');
  });
});
