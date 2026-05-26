import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { PrismaClient } from 'database';
import { AppModule } from '../app.module';
import {
  AuditPersistenceService,
  computeRowHash,
} from '../audit/audit-persistence.service';
import { PrismaService } from '../prisma/prisma.service';
import { type AuditLogPort, emitSystemBackfill } from './system-backfill-audit';

/**
 * AUD-READ-001 — one-shot normalization of the legacy free-string audit action
 * `'PASSWORD_RESET_ADMIN'` (emitted by SEC-003 / 2763552, before OBS-004 / 330a8eb
 * renamed the emit site to `AuditAction.PASSWORD_RESET_BY_ADMIN`) to the canonical
 * `'PASSWORD_RESET_BY_ADMIN'`, WITH a full hash-chain recompute so integrity is
 * preserved end-to-end.
 *
 * Why this is normalization, NOT history rewriting
 * ------------------------------------------------
 * The OBS-002 + DAT-009 immutability trigger exists to stop tampering with audit
 * FACTS — who did what, when, with which actor snapshot. NONE of those change here.
 * We rewrite ONE derived label (the action code string — the SAME event, renamed in
 * code at 330a8eb) and recompute the integrity hashes that depend on it. This is the
 * same class of operation as the OBS-002 migration that *created* the chain over
 * pre-existing rows. To keep the act itself honest, the normalization writes its own
 * `SYSTEM_BACKFILL` rows into the very trail it touches and runs inside one bracketed
 * transaction with the operator identity captured.
 *
 * The trigger disable/re-enable window
 * ------------------------------------
 * Everything runs inside a SINGLE Prisma interactive transaction. `ALTER TABLE …
 * DISABLE TRIGGER` is DDL and is transactional in Postgres — if anything throws, the
 * whole transaction (including the DISABLE) rolls back and the trigger is left ENABLED.
 * That rollback is the primary safety guarantee against a "trigger stuck disabled"
 * state; the explicit ENABLE before commit + the try/finally re-enable are
 * belt-and-suspenders. Requires the `DATABASE_URL` role to OWN `audit_logs`
 * (ALTER TABLE privilege) — see the runbook in the closing commit body.
 *
 * Hash chain recompute strategy
 * -----------------------------
 * The chain order is deterministic `(createdAt ASC, id ASC)`. After the action UPDATE,
 * every row from the FIRST affected row to the tail must be re-hashed: the first
 * affected row because its own field changed, every subsequent row because its
 * `prevHash` (= the predecessor's `rowHash`) changed. The walk recomputes them in
 * order, anchoring on the (untouched) stored `rowHash` of the row immediately before
 * the first affected one. The recompute imports `computeRowHash` from the write path —
 * it is NEVER reimplemented here, because write-time/migration-time hashing divergence
 * would silently desync the chain. Rows before the first affected row are not touched
 * (they keep whatever scheme sealed them — e.g. the OBS-002 SQL-canonical legacy
 * segment); the segment from the first affected row onward becomes uniformly
 * `computeRowHash`-canonical.
 *
 * Idempotency
 * -----------
 * A second run finds 0 rows with the legacy value, skips the disable/update/recompute
 * entirely, and recomputes nothing. (It still emits its own STARTED/COMPLETED
 * SYSTEM_BACKFILL pair — each invocation is an honest, recorded maintenance event;
 * idempotency is a property of the DATA, not of the trace.)
 */

export const SCRIPT_NAME = 'normalize-action-codes';
export const FROM_VALUE = 'PASSWORD_RESET_ADMIN';
export const TO_VALUE = 'PASSWORD_RESET_BY_ADMIN';
/** Immutability trigger created by the OBS-002 + DAT-009 migration (d6299cc). */
export const IMMUTABILITY_TRIGGER = 'audit_logs_no_update_delete';

/** Sentinel thrown to force a `--dry-run` rollback of the interactive transaction. */
class DryRunRollback extends Error {
  constructor() {
    super('dry-run rollback');
    this.name = 'DryRunRollback';
  }
}

/** Raw row shape pulled for the recompute walk. */
interface ChainRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  createdAt: Date;
  payload: Record<string, unknown> | null;
  prevHash: string | null;
  rowHash: string;
}

export interface NormalizeDeps {
  /** PrismaService (CLI) or a raw PrismaClient (direct-DB witness). */
  prisma: PrismaClient;
  dryRun?: boolean;
  logger?: { log: (msg: string) => void; warn: (msg: string) => void };
}

export interface NormalizeResult {
  /** Rows whose `action` was rewritten FROM_VALUE → TO_VALUE. */
  affectedCount: number;
  /** First affected row in (createdAt, id) order, or null when none. */
  firstAffected: { id: string; createdAt: Date } | null;
  /** Rows whose hash was recomputed (the affected row + all rows after it). */
  recomputedCount: number;
  /** Whether the run rolled back without persisting (dry run). */
  dryRun: boolean;
  /** Whether the in-transaction chain re-verification passed. */
  verified: boolean;
}

/**
 * Core, testable normalization logic. Takes any PrismaClient-shaped handle so it can
 * be driven by a real PrismaService (CLI) or a raw PrismaClient against a throwaway DB
 * (the direct-DB witness — vitest mocks the `database` module, so the trigger/chain
 * SQL can only be exercised against a real Postgres).
 */
export async function normalizeActionCodes(
  deps: NormalizeDeps,
): Promise<NormalizeResult> {
  const { prisma, dryRun = false } = deps;
  const log = deps.logger?.log ?? (() => {});

  const result: NormalizeResult = {
    affectedCount: 0,
    firstAffected: null,
    recomputedCount: 0,
    dryRun,
    verified: false,
  };

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize against concurrent audit emissions on the SAME advisory lock the
      // write path uses (audit-persistence.service.ts). Acquired BEFORE the ALTER's
      // ACCESS EXCLUSIVE lock: any in-flight emit completes and releases this first,
      // and no new emit can start while we hold it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))`;

      const firstRows = await tx.$queryRaw<
        Array<{ id: string; createdAt: Date }>
      >`
        SELECT id, "createdAt" FROM audit_logs
        WHERE action = ${FROM_VALUE}
        ORDER BY "createdAt" ASC, id ASC
        LIMIT 1
      `;

      if (firstRows.length === 0) {
        // Idempotent no-op: nothing to normalize, chain untouched.
        result.verified = true;
        log(`[${SCRIPT_NAME}] 0 rows with action='${FROM_VALUE}' — no-op.`);
        return;
      }

      const first = firstRows[0];
      result.firstAffected = { id: first.id, createdAt: first.createdAt };

      // Anchor: the row immediately BEFORE the first affected row in chain order.
      // Its stored rowHash becomes the opaque prevHash of the first affected row and
      // must remain UNTOUCHED (we never rewrite rows before the first affected one).
      const predRows = await tx.$queryRaw<
        Array<{ id: string; rowHash: string }>
      >`
        SELECT id, "rowHash" FROM audit_logs
        WHERE ("createdAt", id) < (${first.createdAt}, ${first.id})
        ORDER BY "createdAt" DESC, id DESC
        LIMIT 1
      `;
      const anchorPrevHash = predRows.length > 0 ? predRows[0].rowHash : null;
      const predecessor = predRows.length > 0 ? predRows[0] : null;

      // DDL: disable the immutability trigger. Transactional — rolled back (trigger
      // re-enabled) automatically if anything below throws.
      await tx.$executeRawUnsafe(
        `ALTER TABLE audit_logs DISABLE TRIGGER ${IMMUTABILITY_TRIGGER}`,
      );

      const affected = await tx.$executeRaw`
        UPDATE audit_logs SET action = ${TO_VALUE} WHERE action = ${FROM_VALUE}
      `;
      result.affectedCount = Number(affected);

      // Walk every row from the first affected row to the tail, in chain order, with
      // the action change already applied, recomputing prevHash + rowHash.
      const rows = await tx.$queryRaw<ChainRow[]>`
        SELECT id, action, "entityType", "entityId", "actorId", "createdAt",
               payload, "prevHash", "rowHash"
        FROM audit_logs
        WHERE ("createdAt", id) >= (${first.createdAt}, ${first.id})
        ORDER BY "createdAt" ASC, id ASC
      `;

      let prevHash = anchorPrevHash;
      for (const row of rows) {
        const newRowHash = computeRowHash({
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          actorId: row.actorId,
          createdAt: row.createdAt,
          payload: row.payload,
          prevHash,
        });
        await tx.$executeRaw`
          UPDATE audit_logs SET "prevHash" = ${prevHash}, "rowHash" = ${newRowHash}
          WHERE id = ${row.id}
        `;
        prevHash = newRowHash;
      }
      result.recomputedCount = rows.length;

      await tx.$executeRawUnsafe(
        `ALTER TABLE audit_logs ENABLE TRIGGER ${IMMUTABILITY_TRIGGER}`,
      );

      // In-transaction verification: re-read the affected segment fresh and assert
      // every stored rowHash recomputes from its own fields + (new) prevHash. Catches
      // any walk logic error before commit.
      const verifyRows = await tx.$queryRaw<ChainRow[]>`
        SELECT id, action, "entityType", "entityId", "actorId", "createdAt",
               payload, "prevHash", "rowHash"
        FROM audit_logs
        WHERE ("createdAt", id) >= (${first.createdAt}, ${first.id})
        ORDER BY "createdAt" ASC, id ASC
      `;
      let expectedPrev = anchorPrevHash;
      for (const row of verifyRows) {
        if (row.prevHash !== expectedPrev) {
          throw new Error(
            `[${SCRIPT_NAME}] chain verify failed at row ${row.id}: prevHash mismatch`,
          );
        }
        const expected = computeRowHash({
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          actorId: row.actorId,
          createdAt: row.createdAt,
          payload: row.payload,
          prevHash: row.prevHash,
        });
        if (row.rowHash !== expected) {
          throw new Error(
            `[${SCRIPT_NAME}] chain verify failed at row ${row.id}: rowHash mismatch`,
          );
        }
        expectedPrev = row.rowHash;
      }

      // Guard against an off-by-one in the tuple comparison: the predecessor row must
      // be exactly as it was before — we must NOT have rewritten any sealed prefix row.
      if (predecessor) {
        const afterPred = await tx.$queryRaw<Array<{ rowHash: string }>>`
          SELECT "rowHash" FROM audit_logs WHERE id = ${predecessor.id}
        `;
        if (afterPred.length !== 1 || afterPred[0].rowHash !== predecessor.rowHash) {
          throw new Error(
            `[${SCRIPT_NAME}] predecessor row ${predecessor.id} was unexpectedly modified`,
          );
        }
      }

      result.verified = true;
      log(
        `[${SCRIPT_NAME}] normalized ${result.affectedCount} row(s), recomputed ${result.recomputedCount} hash(es).`,
      );

      if (dryRun) {
        log(`[${SCRIPT_NAME}] --dry-run: rolling back, no rows persisted.`);
        throw new DryRunRollback();
      }
    });
  } catch (err) {
    if (err instanceof DryRunRollback) {
      // Expected: dry-run forces a clean rollback. The trigger DISABLE was rolled back
      // with it; nothing is persisted. result still carries the computed counts.
      return result;
    }
    // Any other failure rolled back the whole transaction (DISABLE reverted → trigger
    // ENABLED). Re-throw so the caller aborts and surfaces the error.
    throw err;
  }

  return result;
}

/**
 * CLI entrypoint — boots the Nest application context (mirrors backfill-snapshots.ts)
 * to get the hash-chained AuditPersistenceService for the SYSTEM_BACKFILL trace, then
 * runs the core normalization. Flags: `--dry-run`.
 */
async function main(): Promise<void> {
  const logger = new Logger('NormalizeActionCodes');
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const auditPersistence: AuditLogPort = app.get(AuditPersistenceService);

    // STARTED: emitted BEFORE the main transaction (a separate hash-chained insert,
    // appended at the tail). When there ARE affected rows, this STARTED row sits after
    // the affected segment and is itself re-hashed by the recompute walk — correct and
    // trace-preserving, not a double write.
    await emitSystemBackfill(auditPersistence, 'STARTED', {
      script: SCRIPT_NAME,
      args,
      fromValue: FROM_VALUE,
      toValue: TO_VALUE,
      dryRun,
    });

    const result = await normalizeActionCodes({
      prisma,
      dryRun,
      logger: { log: (m) => logger.log(m), warn: (m) => logger.warn(m) },
    });

    await emitSystemBackfill(auditPersistence, 'COMPLETED', {
      script: SCRIPT_NAME,
      args,
      fromValue: FROM_VALUE,
      toValue: TO_VALUE,
      affectedCount: result.affectedCount,
      dryRun,
    });

    logger.log(
      `Done: affected=${result.affectedCount} recomputed=${result.recomputedCount} dryRun=${result.dryRun} verified=${result.verified}`,
    );
  } finally {
    await app.close();
  }
}

// Only run when invoked directly (node dist/scripts/normalize-action-codes.js), not
// when imported by the witness.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('normalize-action-codes failed:', err);
      process.exit(1);
    });
}
