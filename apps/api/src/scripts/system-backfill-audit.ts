import { AuditAction } from '../audit/audit.service';

/**
 * OBS-018 — testable emission helper for operational backfill/seed/maintenance
 * scripts. Scripts run outside the HTTP request lifecycle (and outside vitest),
 * so the audit emission is extracted here as a pure-ish function that takes the
 * `AuditPersistenceService` (the `.log` boundary, hash-chained per OBS-002) and
 * the run context. Tested directly: input → expected `auditPersistence.log`
 * call (the scripts themselves are not run under vitest — AUD-EMIT-001 /
 * OBS-002+DAT-009 manual-verification precedent).
 *
 * Single SYSTEM_BACKFILL action with a `phase` field (STARTED | COMPLETED) in
 * the payload — mirrors the OBS-012 single RELEASE_DEPLOYED precedent rather
 * than splitting into two enums.
 */

/** Minimal shape of AuditPersistenceService.log this helper depends on. */
export interface AuditLogPort {
  log(entry: {
    action: AuditAction;
    entityType: 'SystemMaintenance';
    entityId: string;
    actorId: string | null;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

export type BackfillPhase = 'STARTED' | 'COMPLETED';

export interface SystemBackfillContext {
  /** Script identity, becomes the audit subject (entityId). */
  script: string;
  /** CLI args the script was invoked with (process.argv.slice(2)). */
  args?: string[];
  /** Rows touched — known only at COMPLETED; omit/undefined at STARTED. */
  affectedCount?: number;
  /** Whether the run was a no-write dry run. */
  dryRun?: boolean;
}

/**
 * Resolve the operator identity for a script run. Prefers `DEPLOYED_BY` (the
 * OBS-012 deploy-context identity injected into the api container) over the
 * finding's suggested `DEPLOY_USER`; null when neither is set (a local manual
 * run leaves an honest null actor rather than a fabricated one).
 */
export function resolveBackfillActor(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return env.DEPLOYED_BY?.trim() || env.DEPLOY_USER?.trim() || null;
}

/**
 * Emit one SYSTEM_BACKFILL row for the given phase. Awaited (this is a durable
 * maintenance event, not a high-frequency read) — the caller decides whether a
 * failure should abort the script.
 */
export async function emitSystemBackfill(
  auditPersistence: AuditLogPort,
  phase: BackfillPhase,
  ctx: SystemBackfillContext,
  actorId: string | null = resolveBackfillActor(),
): Promise<void> {
  await auditPersistence.log({
    action: AuditAction.SYSTEM_BACKFILL,
    entityType: 'SystemMaintenance',
    entityId: ctx.script,
    actorId,
    payload: {
      script: ctx.script,
      args: ctx.args ?? [],
      phase,
      dryRun: ctx.dryRun ?? false,
      ...(ctx.affectedCount !== undefined
        ? { affectedCount: ctx.affectedCount }
        : {}),
    },
  });
}
