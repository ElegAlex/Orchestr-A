import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { PrismaClient } from 'database';
import { AppModule } from '../app.module';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { recomputeChainFrom } from '../audit/recompute-chain';
import { PrismaService } from '../prisma/prisma.service';
import { type AuditLogPort, emitSystemBackfill } from './system-backfill-audit';

/**
 * DAT-021 — one-shot full-chain hash recompute after the schemaVersion column
 * was added.
 *
 * Why a recompute is mandatory
 * ----------------------------
 * `computeRowHash` now folds `schemaVersion` into the canonical concat. The
 * migration (20260526120000_dat021_…) backfilled `schemaVersion = 1` onto every
 * existing row, which changes every row's hash INPUT. The first row's own hash
 * changes; every subsequent row's hash changes too because its `prevHash`
 * (= predecessor's rowHash) changed. So the ENTIRE chain — from genesis to tail —
 * must be re-hashed. This walks ALL rows (heavier than AUD-READ-001's targeted
 * segment recompute, which anchored at the first row carrying a legacy code).
 *
 * Dual-scheme retirement (intended consequence)
 * ---------------------------------------------
 * The OBS-002 migration sealed any pre-chain rows with a SQL-canonical hash
 * (`payload::text`), a segment documented as "not JS-re-verifiable". Recomputing
 * from genesis with the imported `computeRowHash` rehashes that segment too,
 * making the WHOLE chain uniformly `computeRowHash(+schemaVersion)`-canonical and
 * JS-verifiable. This RETIRES the dual hash scheme — a strict improvement, via the
 * same audited mechanism as AUD-READ-001 (advisory lock + trigger-disable inside
 * one transaction + SYSTEM_BACKFILL bracketing). We change derived HASHES, never
 * audit FACTS (who/what/when/actor-snapshot/payload are untouched).
 *
 * Safety: everything runs inside ONE Prisma interactive transaction. `ALTER TABLE
 * … DISABLE TRIGGER` is transactional DDL — any throw rolls the whole transaction
 * back and leaves the trigger ENABLED. Idempotent: a second run recomputes the
 * same hashes (schemaVersion already 1, computeRowHash deterministic) and the
 * in-tx verification still passes; rows are rewritten to identical values.
 *
 * Operator gesture only — see the runbook in the DAT-021 closing commit body for
 * the prod row-count check + advisory-lock window note. Requires the DATABASE_URL
 * role to OWN audit_logs (ALTER TABLE privilege).
 */

export const SCRIPT_NAME = 'recompute-chain-on-schema-bump';
/** Immutability trigger created by the OBS-002 + DAT-009 migration (d6299cc). */
export const IMMUTABILITY_TRIGGER = 'audit_logs_no_update_delete';

/** Sentinel thrown to force a `--dry-run` rollback of the interactive transaction. */
class DryRunRollback extends Error {
  constructor() {
    super('dry-run rollback');
    this.name = 'DryRunRollback';
  }
}

export interface RecomputeDeps {
  /** PrismaService (CLI) or a raw PrismaClient (direct-DB witness). */
  prisma: PrismaClient;
  dryRun?: boolean;
  logger?: { log: (msg: string) => void; warn: (msg: string) => void };
}

export interface RecomputeChainResult {
  /** Total rows in audit_logs at run time. */
  totalRows: number;
  /** Rows whose prevHash/rowHash were recomputed (= the whole chain from genesis). */
  recomputedCount: number;
  /** Whether the run rolled back without persisting (dry run). */
  dryRun: boolean;
  /** Whether the in-transaction chain re-verification passed. */
  verified: boolean;
}

/**
 * Core, testable recompute logic. Takes any PrismaClient-shaped handle so it can
 * be driven by a real PrismaService (CLI) or a raw PrismaClient against a
 * throwaway DB (the direct-DB witness — vitest mocks `database`, so trigger/chain
 * SQL can only be exercised against a real Postgres).
 */
export async function recomputeChainOnSchemaBump(
  deps: RecomputeDeps,
): Promise<RecomputeChainResult> {
  const { prisma, dryRun = false } = deps;
  const log = deps.logger?.log ?? (() => {});

  const result: RecomputeChainResult = {
    totalRows: 0,
    recomputedCount: 0,
    dryRun,
    verified: false,
  };

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize against concurrent audit emissions on the SAME advisory lock the
      // write path uses. Acquired BEFORE the ALTER's ACCESS EXCLUSIVE lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))`;

      // Genesis = the first row in chain order. recomputeChainFrom anchors on the
      // (non-existent) predecessor → anchorPrevHash null → the whole chain rehashes.
      const genesisRows = await tx.$queryRaw<
        Array<{ id: string; createdAt: Date }>
      >`
        SELECT id, "createdAt" FROM audit_logs
        ORDER BY "createdAt" ASC, id ASC
        LIMIT 1
      `;

      if (genesisRows.length === 0) {
        // Empty table: nothing to recompute, chain trivially valid.
        result.verified = true;
        log(`[${SCRIPT_NAME}] audit_logs is empty — no-op.`);
        return;
      }
      const genesis = genesisRows[0];

      // DDL: disable the immutability trigger. Transactional — rolled back (trigger
      // re-enabled) automatically if anything below throws.
      await tx.$executeRawUnsafe(
        `ALTER TABLE audit_logs DISABLE TRIGGER ${IMMUTABILITY_TRIGGER}`,
      );

      const rec = await recomputeChainFrom(tx, genesis);
      result.recomputedCount = rec.recomputedCount;
      result.totalRows = rec.recomputedCount;

      await tx.$executeRawUnsafe(
        `ALTER TABLE audit_logs ENABLE TRIGGER ${IMMUTABILITY_TRIGGER}`,
      );

      result.verified = rec.verified;
      log(
        `[${SCRIPT_NAME}] recomputed ${result.recomputedCount} hash(es) over the full chain.`,
      );

      if (dryRun) {
        log(`[${SCRIPT_NAME}] --dry-run: rolling back, no rows persisted.`);
        throw new DryRunRollback();
      }
    });
  } catch (err) {
    if (err instanceof DryRunRollback) {
      return result;
    }
    throw err;
  }

  return result;
}

/**
 * CLI entrypoint — boots the Nest application context (mirrors
 * normalize-action-codes.ts) to get the hash-chained AuditPersistenceService for
 * the SYSTEM_BACKFILL trace, then runs the recompute. Flags: `--dry-run`.
 */
async function main(): Promise<void> {
  const logger = new Logger('RecomputeChainOnSchemaBump');
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // TOOL-DEPLOY-001 — this script DISABLE/ENABLEs the immutability trigger (DDL)
  // and rewrites audit_logs rows: it MUST run as the migration/owner role, never
  // the restricted runtime app role (which lacks UPDATE on audit_logs and ALTER on
  // the table). Fail fast if the migration URL is absent rather than silently
  // booting under the restricted DATABASE_URL and failing confusingly mid-recompute.
  if (!process.env.DATABASE_MIGRATION_URL) {
    logger.error(
      'DATABASE_MIGRATION_URL is not set. This maintenance script must run as the ' +
        'migration/owner role (it disables the immutability trigger and rewrites ' +
        'audit_logs). Export DATABASE_MIGRATION_URL=<owner connection string> and re-run.',
    );
    process.exit(1);
  }
  // Boot the Nest PrismaService against the migration role, not the restricted app role.
  process.env.DATABASE_URL = process.env.DATABASE_MIGRATION_URL;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const auditPersistence: AuditLogPort = app.get(AuditPersistenceService);

    // STARTED: emitted BEFORE the main transaction (a separate hash-chained insert
    // appended at the tail, with schemaVersion=1 — already chain-correct). It then
    // sits at the tail of the segment the recompute walks and is itself re-hashed.
    await emitSystemBackfill(auditPersistence, 'STARTED', {
      script: SCRIPT_NAME,
      args,
      dryRun,
    });

    const result = await recomputeChainOnSchemaBump({
      prisma,
      dryRun,
      logger: { log: (m) => logger.log(m), warn: (m) => logger.warn(m) },
    });

    await emitSystemBackfill(auditPersistence, 'COMPLETED', {
      script: SCRIPT_NAME,
      args,
      affectedCount: result.recomputedCount,
      dryRun,
    });

    logger.log(
      `Done: recomputed=${result.recomputedCount} dryRun=${result.dryRun} verified=${result.verified}`,
    );
  } finally {
    await app.close();
  }
}

// Only run when invoked directly, not when imported by the witness.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('recompute-chain-on-schema-bump failed:', err);
      process.exit(1);
    });
}
