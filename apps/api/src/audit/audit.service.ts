import { Injectable, Logger } from '@nestjs/common';
import { AuditPersistenceService } from './audit-persistence.service';

export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  REGISTER = 'REGISTER',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ROLE_CHANGE = 'ROLE_CHANGE',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
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
 *
 * Typed as an exhaustive `Record<AuditAction, ...>` so adding an AuditAction
 * without a subject type is a compile error, not a silent 'unknown'.
 */
const ENTITY_TYPE_BY_ACTION: Record<AuditAction, 'User' | 'Auth' | 'Leave'> = {
  [AuditAction.LOGIN_SUCCESS]: 'Auth',
  [AuditAction.LOGIN_FAILURE]: 'Auth',
  [AuditAction.ACCESS_DENIED]: 'Auth',
  [AuditAction.REGISTER]: 'User',
  [AuditAction.ROLE_CHANGE]: 'User',
  [AuditAction.USER_DEACTIVATED]: 'User',
  [AuditAction.PASSWORD_CHANGED]: 'User',
  [AuditAction.LEAVE_APPROVED]: 'Leave',
  [AuditAction.LEAVE_REJECTED]: 'Leave',
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
