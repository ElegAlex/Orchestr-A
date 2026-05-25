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
 * Entity type stamped on every security event row in `audit_logs`.
 * DAT-002 keeps this a single constant; per-action subject typing
 * (User for ROLE_CHANGE/PASSWORD_CHANGED, Auth for LOGIN_*, ...) is
 * OBS-001's payload-schema-enrichment scope, not this commit's.
 */
const SECURITY_EVENT_ENTITY_TYPE = 'SecurityEvent';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('SecurityAudit');

  constructor(private readonly auditPersistence: AuditPersistenceService) {}

  log(event: {
    action: AuditAction;
    userId?: string;
    targetId?: string;
    ip?: string;
    details?: string;
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
    // Mapping AuditEvent → AuditPersistenceService.log args:
    //   action     → event.action
    //   actorId    → the user performing the action (event.userId), or null
    //   entityId   → the subject of the action (targetId, else userId, else
    //                'unknown' for anonymous failures like a bad-login attempt)
    //   payload    → JSONB carrying ip / details / success / timestamp as
    //                today's AuditEvent exposes them (ua/reason land in OBS-001)
    //
    // Persistence is fire-and-forget: `void` makes the floating promise
    // explicit, and the `.catch` is load-bearing — a DB failure must degrade
    // to logger-only, never crash a login/leave-approval flow. OBS-002 will
    // later harden append-only enforcement and the hash chain at the DB level.
    void this.auditPersistence
      .log({
        action: event.action,
        entityType: SECURITY_EVENT_ENTITY_TYPE,
        entityId: event.targetId ?? event.userId ?? 'unknown',
        actorId: event.userId ?? null,
        payload: {
          ip: event.ip,
          details: event.details,
          success: event.success,
          timestamp: entry.timestamp,
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
}
