import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * TST-DB-001 — real-DB witness for the audit_logs immutability trigger
 * (`audit_logs_no_update_delete` / fn `audit_logs_immutable()`, migration
 * 20260525190000). Closes the OBS-002 + DAT-009 witness gap that prior sessions
 * could only verify by hand via psql, because the unit/e2e configs globally
 * `vi.mock('database')`.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 *
 * TOOL-DEPLOY-001 — this spec connects as the MIGRATION role
 * (DATABASE_MIGRATION_URL), NOT the default restricted app role. Postgres checks
 * table privileges BEFORE firing a BEFORE-trigger: an app-role UPDATE/DELETE on
 * audit_logs fails with `permission denied` (SQLSTATE 42501) and never reaches the
 * trigger. To witness the TRIGGER itself (`/append-only/`, SQLSTATE 23514) we must
 * use a role that HOLDS the UPDATE/DELETE privilege — the migration/owner role.
 * The privilege-layer REVOKE (the app role can't even attempt) is the separate
 * witness in audit-role-revoke.int.spec.ts.
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_MIGRATION_URL } },
});

/** Insert one independent audit row (chain validity is irrelevant to the trigger). */
async function seedRow(): Promise<string> {
  const entityId = randomUUID();
  const row = await prisma.auditLog.create({
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

describe('audit_logs immutability trigger (real DB)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('blocks UPDATE via the Prisma ORM', async () => {
    const id = await seedRow();
    await expect(
      prisma.auditLog.update({ where: { id }, data: { action: 'TAMPERED' } }),
    ).rejects.toThrow(/append-only/i);
  });

  it('blocks UPDATE via raw SQL', async () => {
    const id = await seedRow();
    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE audit_logs SET action = $1 WHERE id = $2',
        'TAMPERED',
        id,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('blocks DELETE (ORM + raw) and the row survives', async () => {
    const id = await seedRow();
    await expect(prisma.auditLog.delete({ where: { id } })).rejects.toThrow(
      /append-only/i,
    );
    await expect(
      prisma.$executeRawUnsafe('DELETE FROM audit_logs WHERE id = $1', id),
    ).rejects.toThrow(/append-only/i);

    const survivor = await prisma.auditLog.findUnique({ where: { id } });
    expect(survivor).not.toBeNull();
    expect(survivor?.action).toBe('LOGIN_SUCCESS');
  });
});
