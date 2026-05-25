import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeploymentsService } from './deployments.service';
import { AuditAction } from '../audit/audit.service';

/**
 * OBS-012 — witness for the deploy/boot audit trail.
 *
 * Before this fix the running container recorded NOTHING about which release was
 * live: no `deployments` row, no `RELEASE_DEPLOYED` audit event. An auditor could
 * not answer "which version was running when leave Z was approved". These tests
 * exercise that exact failure mode — they FAIL on master (the service and the
 * AuditAction member do not exist) and PASS once the boot-time recorder ships.
 */
describe('DeploymentsService', () => {
  let prisma: {
    deployment: { create: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: DeploymentsService;

  beforeEach(() => {
    prisma = {
      deployment: { create: vi.fn().mockResolvedValue({ id: 'dep-1' }) },
      $queryRaw: vi.fn().mockResolvedValue([
        { migration_name: '20260525190000_audit_logs' },
        { migration_name: '20260525200000_dat007' },
      ]),
    };
    audit = { log: vi.fn() };
    service = new DeploymentsService(
      prisma as never,
      audit as never,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('recordDeploy', () => {
    it('persists one deployments row with the full release shape', async () => {
      await service.recordDeploy({
        releaseSha: 'abc1234',
        deployedBy: 'ops@example.com',
        environment: 'production',
        nodeVersion: 'v22.0.0',
        dbMigrationsApplied: ['20260525190000_audit_logs'],
      });

      expect(prisma.deployment.create).toHaveBeenCalledTimes(1);
      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: {
          releaseSha: 'abc1234',
          deployedBy: 'ops@example.com',
          environment: 'production',
          nodeVersion: 'v22.0.0',
          dbMigrationsApplied: ['20260525190000_audit_logs'],
        },
      });
    });
  });

  describe('recordBoot (dual-write: deployments table + audit_logs narrative)', () => {
    it('writes BOTH a deployments row and a RELEASE_DEPLOYED audit event in a deploy context', async () => {
      vi.stubEnv('RELEASE_SHA', 'deadbeef');
      vi.stubEnv('DEPLOYED_BY', 'ops@example.com');
      vi.stubEnv('DEPLOY_ENVIRONMENT', 'production');

      await service.recordBoot();

      // Source of truth: the deployments table row.
      expect(prisma.deployment.create).toHaveBeenCalledTimes(1);
      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          releaseSha: 'deadbeef',
          deployedBy: 'ops@example.com',
          environment: 'production',
          nodeVersion: process.version,
          dbMigrationsApplied: [
            '20260525190000_audit_logs',
            '20260525200000_dat007',
          ],
        }),
      });

      // Narrative: a RELEASE_DEPLOYED row threads the deploy into audit_logs.
      expect(audit.log).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RELEASE_DEPLOYED,
          targetId: 'deadbeef',
          success: true,
        }),
      );
    });

    it('is a no-op outside a deploy context (no RELEASE_SHA, not production)', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RELEASE_SHA', '');

      await service.recordBoot();

      expect(prisma.deployment.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("records releaseSha='unknown' in production when RELEASE_SHA is unset (still records the boot interval)", async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RELEASE_SHA', '');

      await service.recordBoot();

      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ releaseSha: 'unknown' }),
      });
    });

    it('defaults dbMigrationsApplied to [] when the _prisma_migrations probe fails', async () => {
      vi.stubEnv('RELEASE_SHA', 'cafe123');
      prisma.$queryRaw.mockRejectedValueOnce(new Error('permission denied'));

      await service.recordBoot();

      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dbMigrationsApplied: [] }),
      });
    });
  });

  describe('onApplicationBootstrap (resilience — never blocks API startup)', () => {
    it('resolves even when the deployments write rejects', async () => {
      vi.stubEnv('RELEASE_SHA', 'beadfed');
      const errSpy = vi
        .spyOn((service as unknown as { logger: { error: () => void } }).logger, 'error')
        .mockImplementation(() => {});
      prisma.deployment.create.mockRejectedValueOnce(new Error('chain hiccup'));

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
      // Boot proceeds; the failure is logged, not thrown.
      expect(errSpy).toHaveBeenCalled();
    });
  });
});
