import { Logger } from '@nestjs/common';
import { AuditAction } from './audit.service';
import { AuditPersistenceService } from './audit-persistence.service';

/**
 * OBS-026 — request metadata threaded from the controller (extractMeta) for the
 * data-export audit trail. Optional so non-HTTP callers degrade gracefully.
 */
export interface ExportMeta {
  ip?: string;
  ua?: string;
}

/**
 * OBS-026 — fire-and-forget DATA_EXPORTED emission shared by the project CSV
 * export paths (tasks / milestones). Factored out of OBS-007's inlined
 * planning-ICS emission so every personal-data egress records an identical
 * RGPD shape.
 *
 * An export is a read path (GET): a transient audit hiccup must never 500 a
 * successful export, so the promise is voided and the rejection logged
 * (OBS-006/OBS-007 read-path precedent). The caller is the actor AND the event
 * subject (entityId), mirroring planning's `entityId = userId` convention; the
 * exported resource is named in `payload.subject` (e.g. `{ projectId }`).
 */
export function emitDataExported(
  auditPersistence: AuditPersistenceService,
  logger: Logger,
  args: {
    actorId: string;
    format: string;
    scope: string;
    recordCount: number;
    subject?: Record<string, unknown>;
    meta?: ExportMeta;
  },
): void {
  void auditPersistence
    .log({
      action: AuditAction.DATA_EXPORTED,
      entityType: 'Export',
      entityId: args.actorId,
      actorId: args.actorId,
      payload: {
        format: args.format,
        scope: args.scope,
        recordCount: args.recordCount,
        ...(args.subject !== undefined ? { subject: args.subject } : {}),
        ...(args.meta?.ip !== undefined ? { ip: args.meta.ip } : {}),
        ...(args.meta?.ua !== undefined ? { ua: args.meta.ua } : {}),
      },
    })
    .catch((err) => {
      logger.error(
        `Failed to persist DATA_EXPORTED audit event (scope=${args.scope}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
}
