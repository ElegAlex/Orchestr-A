import { Injectable, Logger } from '@nestjs/common';
import { AuditPersistenceService } from './audit-persistence.service';

export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  REGISTER = 'REGISTER',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ROLE_CHANGE = 'ROLE_CHANGE',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_BY_ADMIN = 'PASSWORD_RESET_BY_ADMIN',
  SERVICE_MEMBERSHIP_CHANGED = 'SERVICE_MEMBERSHIP_CHANGED',
  DEPARTMENT_CHANGED = 'DEPARTMENT_CHANGED',
  // OBS-005 — institutional-role (table `roles`) lifecycle mutations. Distinct
  // from ROLE_CHANGE, which records a *user* being reassigned to another role.
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_DELETED = 'ROLE_DELETED',
  ROLE_DEFAULT_CHANGED = 'ROLE_DEFAULT_CHANGED',
  // OBS-006 — document access lifecycle. READ = explicit metadata fetch-by-id
  // (DocumentsController GET /:id). DOWNLOADED = actual binary stream; reserved
  // and currently unwired — the binary lives in external storage referenced by
  // `Document.url`, so byte transfer bypasses the API and is not observable here.
  DOCUMENT_READ = 'DOCUMENT_READ',
  DOCUMENT_DOWNLOADED = 'DOCUMENT_DOWNLOADED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  // OBS-021 — full leave lifecycle beyond approve/reject. LEAVE_CANCELLED was
  // already emitted by DAT-001's cancel() path as a free-string; promoted to an
  // enum member here (identical value → zero prod-data impact, advances the
  // OBS-024 enum-vs-free-string unification). The other four are net-new
  // emitters on the update / hard-delete / cancellation-request / balance-
  // adjustment paths so an auditor can reconstruct "leave approved on T1 then
  // its dates were silently changed on T2".
  LEAVE_CANCELLED = 'LEAVE_CANCELLED',
  LEAVE_CANCELLATION_REQUESTED = 'LEAVE_CANCELLATION_REQUESTED',
  LEAVE_UPDATED = 'LEAVE_UPDATED',
  LEAVE_DELETED = 'LEAVE_DELETED',
  LEAVE_BALANCE_ADJUSTED = 'LEAVE_BALANCE_ADJUSTED',
  // OBS-012 — a release booted. Written on every container boot in a deploy
  // context (DeploymentsService). The durable source of truth is the
  // `deployments` table; this audit row is the Cour-des-Comptes narrative
  // cross-reference so deploy events sit inline with user actions.
  RELEASE_DEPLOYED = 'RELEASE_DEPLOYED',
  // OBS-007 — personal-data egress (RGPD). One action with `scope` in the
  // payload disambiguating the export domain (planning / …). Currently wired on
  // the planning ICS export; CSV exports (tasks/milestones) are a documented
  // follow-up (see OBS-007 Learnings).
  DATA_EXPORTED = 'DATA_EXPORTED',
}

/**
 * Subject type stamped on each security event row in `audit_logs`.
 *
 * OBS-001 refines DAT-002's single 'SecurityEvent' constant into per-action
 * subject types so an auditor can filter by *what the event is about*:
 *   - `User`  — account-state mutations (role change, deactivation, password,
 *               registration). The subject is a user record.
 *   - `Auth`  — authentication / authorization events (login outcomes, access
 *               denial). The subject is the auth attempt, not a stored row.
 *   - `Leave` — leave-request decisions (approve / reject).
 *   - `Role`  — institutional-role lifecycle (create / update / delete /
 *               default change). The subject is a row in the `roles` table
 *               (OBS-005).
 *   - `Document` — document access events (read / download). The subject is a
 *               row in the `documents` table (OBS-006).
 *   - `Deployment` — release/boot events. The subject is the release SHA, also
 *               persisted as a row in the `deployments` table (OBS-012).
 *   - `Export` — personal-data egress events (RGPD). The subject is the export
 *               operation; `scope` in the payload names the domain (OBS-007).
 *
 * Typed as an exhaustive `Record<AuditAction, ...>` so adding an AuditAction
 * without a subject type is a compile error, not a silent 'unknown'.
 */
const ENTITY_TYPE_BY_ACTION: Record<
  AuditAction,
  'User' | 'Auth' | 'Leave' | 'Role' | 'Document' | 'Deployment' | 'Export'
> = {
  [AuditAction.LOGIN_SUCCESS]: 'Auth',
  [AuditAction.LOGIN_FAILURE]: 'Auth',
  [AuditAction.ACCESS_DENIED]: 'Auth',
  [AuditAction.REGISTER]: 'User',
  [AuditAction.ROLE_CHANGE]: 'User',
  [AuditAction.USER_DEACTIVATED]: 'User',
  [AuditAction.USER_REACTIVATED]: 'User',
  [AuditAction.PASSWORD_CHANGED]: 'User',
  [AuditAction.PASSWORD_RESET_BY_ADMIN]: 'User',
  [AuditAction.SERVICE_MEMBERSHIP_CHANGED]: 'User',
  [AuditAction.DEPARTMENT_CHANGED]: 'User',
  [AuditAction.ROLE_CREATED]: 'Role',
  [AuditAction.ROLE_UPDATED]: 'Role',
  [AuditAction.ROLE_DELETED]: 'Role',
  [AuditAction.ROLE_DEFAULT_CHANGED]: 'Role',
  [AuditAction.DOCUMENT_READ]: 'Document',
  [AuditAction.DOCUMENT_DOWNLOADED]: 'Document',
  [AuditAction.LEAVE_APPROVED]: 'Leave',
  [AuditAction.LEAVE_REJECTED]: 'Leave',
  [AuditAction.LEAVE_CANCELLED]: 'Leave',
  [AuditAction.LEAVE_CANCELLATION_REQUESTED]: 'Leave',
  [AuditAction.LEAVE_UPDATED]: 'Leave',
  [AuditAction.LEAVE_DELETED]: 'Leave',
  [AuditAction.LEAVE_BALANCE_ADJUSTED]: 'Leave',
  [AuditAction.RELEASE_DEPLOYED]: 'Deployment',
  [AuditAction.DATA_EXPORTED]: 'Export',
};

/**
 * Matches a bcrypt hash prefix (`$2a$` / `$2b$` / `$2y$`). Used to refuse a
 * password that a client mistakenly sent in the login field from ever landing
 * in the audit trail (see OBS-001 design decision #2).
 */
const BCRYPT_SHAPE = /\$2[aby]\$/;

const MAX_ENTITY_ID_LENGTH = 254;

@Injectable()
export class AuditService {
  private readonly logger = new Logger('SecurityAudit');

  constructor(private readonly auditPersistence: AuditPersistenceService) {}

  log(event: {
    action: AuditAction;
    userId?: string;
    targetId?: string;
    /**
     * Attempted login identifier (login or email) for a LOGIN_FAILURE. Becomes
     * the event subject (`entityId`) so an auditor can see who was targeted.
     */
    attemptedEmail?: string;
    ip?: string;
    /** User-Agent of the request that triggered the event, when reachable. */
    ua?: string;
    /** Machine-readable reason, esp. for failures (e.g. 'invalid_credentials'). */
    reason?: string;
    details?: string;
    /** Structured before-snapshot for mutations (role change, deactivation). */
    before?: unknown;
    /** Structured after-snapshot for mutations. */
    after?: unknown;
    success: boolean;
  }) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    if (event.success) {
      this.logger.log(JSON.stringify(entry));
    } else {
      this.logger.warn(JSON.stringify(entry));
    }

    // DAT-002 — dual-write: the logger emission above stays as the durable
    // floor; we ALSO persist to `audit_logs` so RGPD/Cour des Comptes
    // traceability survives container recreation and log rotation.
    //
    // OBS-001 mapping AuditEvent → AuditPersistenceService.log args:
    //   action     → event.action
    //   entityType → per-action subject type (ENTITY_TYPE_BY_ACTION)
    //   actorId    → the user performing the action (event.userId), or null
    //   entityId   → the subject: for LOGIN_FAILURE the attempted identifier
    //                (sanitized), else targetId, else userId, else 'unknown'
    //   payload    → JSONB: ip/details/success/timestamp (DAT-002) PLUS
    //                ua/reason/before/after when the emitter supplies them
    //
    // Persistence is fire-and-forget: `void` makes the floating promise
    // explicit, and the `.catch` is load-bearing — a DB failure must degrade
    // to logger-only, never crash a login/leave-approval flow. OBS-002 will
    // later harden append-only enforcement and the hash chain at the DB level.
    void this.auditPersistence
      .log({
        action: event.action,
        entityType: ENTITY_TYPE_BY_ACTION[event.action] ?? 'Auth',
        entityId: this.resolveEntityId(event),
        actorId: event.userId ?? null,
        payload: {
          ip: event.ip,
          details: event.details,
          success: event.success,
          timestamp: entry.timestamp,
          ...(event.ua !== undefined ? { ua: event.ua } : {}),
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
          ...(event.before !== undefined ? { before: event.before } : {}),
          ...(event.after !== undefined ? { after: event.after } : {}),
        },
      })
      .catch((err) => {
        this.logger.error(
          `Failed to persist audit event ${event.action} to audit_logs: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }

  /**
   * Resolve the event subject. For LOGIN_FAILURE the attempted identifier is
   * the subject, lowercased and length-capped. A bcrypt-shaped value (a client
   * that fat-fingered the password into the login field) is refused so the
   * trail never records a credential — falls back to 'unknown'.
   */
  private resolveEntityId(event: {
    action: AuditAction;
    userId?: string;
    targetId?: string;
    attemptedEmail?: string;
  }): string {
    if (event.action === AuditAction.LOGIN_FAILURE && event.attemptedEmail) {
      if (BCRYPT_SHAPE.test(event.attemptedEmail)) {
        return 'unknown';
      }
      return event.attemptedEmail.toLowerCase().slice(0, MAX_ENTITY_ID_LENGTH);
    }
    return event.targetId ?? event.userId ?? 'unknown';
  }
}
