import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';

/**
 * OBS-012 — record which release is live.
 *
 * The deploy workflow used to be theatrical (echo-only SSH step) and the running
 * container recorded nothing about its own version, so the system could not
 * answer "which release was running when leave Z was approved". The real deploy
 * is a manual SSH + `docker compose` on the VPS (see scripts/deploy-prod.sh); the
 * GitHub `deploy.yml` was removed rather than faked.
 *
 * On boot, in a deploy context, this service writes:
 *   1. one `deployments` row (the durable, queryable source of truth);
 *   2. one `RELEASE_DEPLOYED` audit_logs row (the Cour-des-Comptes narrative).
 *
 * Version pinning is env-injected: scripts/deploy-prod.sh captures
 * `git rev-parse HEAD` into `RELEASE_SHA` (written to .env.production), and the
 * boot hook reads it. If unset in production we still record the boot interval
 * with releaseSha='unknown' and warn — refusing to start would be too brittle.
 */
@Injectable()
export class DeploymentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Deployments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Persist one deployments row. Pure write — all values are supplied by the
   * caller, so it is unit-testable independent of the boot environment.
   */
  async recordDeploy(input: {
    releaseSha: string;
    deployedBy: string;
    environment: string;
    nodeVersion: string;
    dbMigrationsApplied: string[];
  }) {
    return this.prisma.deployment.create({
      data: {
        releaseSha: input.releaseSha,
        deployedBy: input.deployedBy,
        environment: input.environment,
        nodeVersion: input.nodeVersion,
        dbMigrationsApplied: input.dbMigrationsApplied,
      },
    });
  }

  /**
   * Boot-time recorder. No-op outside a deploy context (dev/test) so local
   * restarts and the mocked-DB e2e harness do not pollute the ledger. Dual-write:
   * deployments table (source of truth) + audit_logs (narrative).
   */
  async recordBoot(): Promise<void> {
    if (!this.isDeployContext()) {
      return;
    }

    const releaseSha = process.env.RELEASE_SHA?.trim() || 'unknown';
    const environment =
      process.env.DEPLOY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development';
    const deployedBy = process.env.DEPLOYED_BY?.trim() || 'ci';
    const nodeVersion = process.version;
    const dbMigrationsApplied = await this.readAppliedMigrations();

    if (releaseSha === 'unknown') {
      this.logger.warn(
        'RELEASE_SHA is unset in a production boot — recording the deployment ' +
          "with releaseSha='unknown'. Set it via scripts/deploy-prod.sh so the " +
          'audit trail can pin the live release.',
      );
    }

    await this.recordDeploy({
      releaseSha,
      deployedBy,
      environment,
      nodeVersion,
      dbMigrationsApplied,
    });

    // Narrative cross-reference. AuditService.log is itself fire-and-forget on
    // the persistence side (logger floor + best-effort audit_logs INSERT).
    this.audit.log({
      action: AuditAction.RELEASE_DEPLOYED,
      targetId: releaseSha,
      success: true,
      details: `Release ${releaseSha} booted in ${environment} (node ${nodeVersion})`,
      after: {
        releaseSha,
        environment,
        deployedBy,
        nodeVersion,
        dbMigrationsApplied,
      },
    });

    this.logger.log(
      `Recorded deployment: release=${releaseSha} env=${environment} ` +
        `by=${deployedBy} migrations=${dbMigrationsApplied.length}`,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    // Fire-and-forget on the bootstrap path: a deployments-table hiccup must
    // never block API startup. We await the recordBoot promise but swallow any
    // rejection into the logger (mirrors the audit floor pattern, OBS-006).
    try {
      await this.recordBoot();
    } catch (err) {
      this.logger.error(
        `Failed to record deployment on boot: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** A deploy context = production, or an explicit env-injected release SHA. */
  private isDeployContext(): boolean {
    return (
      process.env.NODE_ENV === 'production' || !!process.env.RELEASE_SHA?.trim()
    );
  }

  /**
   * Read the migrations applied at boot from Prisma's bookkeeping table. The
   * entrypoint runs `prisma migrate deploy` before the app starts, so by boot
   * the table reflects the live schema. Best-effort: a future restricted DB role
   * (TOOL-DEPLOY-001) or a missing table must not crash boot — default to [].
   */
  private async readAppliedMigrations(): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ migration_name: string }>
      >`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at ASC`;
      return rows.map((r) => r.migration_name);
    } catch (err) {
      this.logger.warn(
        `Could not read _prisma_migrations (recording empty list): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }
}
