import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { AuditPersistenceService } from './audit-persistence.service';
import { AuditAction } from './audit-action.enum';
import { getRequestId } from '../common/fastify/request-id.context';

// OBS-024 — AuditAction is the single source of truth for audit action codes;
// it lives in `audit-action.enum.ts` so AuditPersistenceService can type its
// `action` parameter without an import cycle. Re-exported here so the many
// existing `'../audit/audit.service'` import sites keep working unchanged.
export { AuditAction };

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
 *   - `SystemMaintenance` — operational backfill/seed/maintenance script runs.
 *               The subject is the script name; `phase` in the payload marks
 *               start vs completion (OBS-018).
 *   - `Project` — project lifecycle (archive / unarchive / hard-delete). The
 *               subject is a row in the `projects` table; converged from
 *               free-string codes by OBS-024.
 *   - `TimeEntry` — time-entry lifecycle (create / update / delete). The subject
 *               is a row in the `time_entries` table (OBS-015).
 *   - `Task` — task lifecycle (create / update / delete). The subject is a row
 *               in the `tasks` table (OBS-012).
 *   - `Telework` — telework lifecycle: single-entry CRUD, recurring-rule CRUD,
 *               and bulk schedule generation. The subject is a row in the
 *               `telework_schedules` / `telework_recurring_rules` tables, or the
 *               triggering actor for a bulk generation (OBS-013).
 *   - `Client` — client (commanditaire) lifecycle + project↔client links. The
 *               subject is a row in the `clients` table (OBS-004).
 *   - `Settings` — application settings write. The subject is the setting key in
 *               the `app_settings` table (OBS-011).
 *   - `Delegation` — leave-validation delegation lifecycle. The subject is a row
 *               in the `leave_validation_delegates` table (OBS-008).
 *   - `ThirdParty` — third-party (tiers) lifecycle + task/project assignments.
 *               The subject is a row in the `third_parties` table (OBS-014).
 *
 * Typed as an exhaustive `Record<AuditAction, ...>` so adding an AuditAction
 * without a subject type is a compile error, not a silent 'unknown'.
 */
const ENTITY_TYPE_BY_ACTION: Record<
  AuditAction,
  | 'User'
  | 'Auth'
  | 'Leave'
  | 'Role'
  | 'Document'
  | 'Deployment'
  | 'Export'
  | 'SystemMaintenance'
  | 'Project'
  | 'TimeEntry'
  | 'Task'
  | 'Telework'
  | 'Client'
  | 'Settings'
  | 'Delegation'
  | 'ThirdParty'
> = {
  [AuditAction.LOGIN_SUCCESS]: 'Auth',
  [AuditAction.LOGIN_FAILURE]: 'Auth',
  [AuditAction.LOGOUT]: 'Auth',
  [AuditAction.ACCOUNT_LOCKED]: 'Auth',
  [AuditAction.ACCESS_DENIED]: 'Auth',
  [AuditAction.REGISTER]: 'User',
  [AuditAction.USER_CREATED]: 'User',
  [AuditAction.ROLE_CHANGE]: 'User',
  [AuditAction.USER_DEACTIVATED]: 'User',
  [AuditAction.USER_REACTIVATED]: 'User',
  [AuditAction.PASSWORD_CHANGED]: 'User',
  [AuditAction.PASSWORD_RESET_BY_ADMIN]: 'User',
  [AuditAction.SERVICE_MEMBERSHIP_CHANGED]: 'User',
  [AuditAction.DEPARTMENT_CHANGED]: 'User',
  [AuditAction.USER_DELETED]: 'User',
  [AuditAction.ROLE_CREATED]: 'Role',
  [AuditAction.ROLE_UPDATED]: 'Role',
  [AuditAction.ROLE_DELETED]: 'Role',
  [AuditAction.ROLE_DEFAULT_CHANGED]: 'Role',
  [AuditAction.DOCUMENT_READ]: 'Document',
  [AuditAction.DOCUMENT_DOWNLOADED]: 'Document',
  [AuditAction.DOCUMENT_CREATED]: 'Document',
  [AuditAction.DOCUMENT_UPDATED]: 'Document',
  [AuditAction.DOCUMENT_DELETED]: 'Document',
  [AuditAction.LEAVE_CREATED]: 'Leave',
  [AuditAction.LEAVE_APPROVED]: 'Leave',
  [AuditAction.LEAVE_REJECTED]: 'Leave',
  [AuditAction.LEAVE_CANCELLED]: 'Leave',
  [AuditAction.LEAVE_CANCELLATION_REQUESTED]: 'Leave',
  [AuditAction.LEAVE_UPDATED]: 'Leave',
  [AuditAction.LEAVE_DELETED]: 'Leave',
  [AuditAction.LEAVE_BALANCE_ADJUSTED]: 'Leave',
  [AuditAction.RELEASE_DEPLOYED]: 'Deployment',
  [AuditAction.DATA_EXPORTED]: 'Export',
  [AuditAction.SYSTEM_BACKFILL]: 'SystemMaintenance',
  [AuditAction.PROJECT_ARCHIVED]: 'Project',
  [AuditAction.PROJECT_UNARCHIVED]: 'Project',
  [AuditAction.PROJECT_DELETED]: 'Project',
  [AuditAction.PROJECT_CREATED]: 'Project',
  [AuditAction.PROJECT_UPDATED]: 'Project',
  [AuditAction.PROJECT_CANCELLED]: 'Project',
  [AuditAction.TIME_ENTRY_CREATED]: 'TimeEntry',
  [AuditAction.TIME_ENTRY_UPDATED]: 'TimeEntry',
  [AuditAction.TIME_ENTRY_DELETED]: 'TimeEntry',
  [AuditAction.TASK_CREATED]: 'Task',
  [AuditAction.TASK_UPDATED]: 'Task',
  [AuditAction.TASK_DELETED]: 'Task',
  [AuditAction.TELEWORK_CREATED]: 'Telework',
  [AuditAction.TELEWORK_UPDATED]: 'Telework',
  [AuditAction.TELEWORK_DELETED]: 'Telework',
  [AuditAction.TELEWORK_RULE_CREATED]: 'Telework',
  [AuditAction.TELEWORK_RULE_UPDATED]: 'Telework',
  [AuditAction.TELEWORK_RULE_DELETED]: 'Telework',
  [AuditAction.TELEWORK_SCHEDULES_GENERATED]: 'Telework',
  [AuditAction.CLIENT_CREATED]: 'Client',
  [AuditAction.CLIENT_UPDATED]: 'Client',
  [AuditAction.CLIENT_DELETED]: 'Client',
  [AuditAction.CLIENT_ASSIGNED_TO_PROJECT]: 'Client',
  [AuditAction.CLIENT_REMOVED_FROM_PROJECT]: 'Client',
  [AuditAction.SETTINGS_CHANGED]: 'Settings',
  [AuditAction.DELEGATION_CREATED]: 'Delegation',
  [AuditAction.DELEGATION_DEACTIVATED]: 'Delegation',
  [AuditAction.THIRD_PARTY_CREATED]: 'ThirdParty',
  [AuditAction.THIRD_PARTY_UPDATED]: 'ThirdParty',
  [AuditAction.THIRD_PARTY_DELETED]: 'ThirdParty',
  [AuditAction.THIRD_PARTY_ASSIGNED_TO_TASK]: 'ThirdParty',
  [AuditAction.THIRD_PARTY_UNASSIGNED_FROM_TASK]: 'ThirdParty',
  [AuditAction.THIRD_PARTY_ATTACHED_TO_PROJECT]: 'ThirdParty',
  [AuditAction.THIRD_PARTY_DETACHED_FROM_PROJECT]: 'ThirdParty',
};

/**
 * Matches a bcrypt hash prefix (`$2a$` / `$2b$` / `$2y$`). Used to refuse a
 * password that a client mistakenly sent in the login field from ever landing
 * in the audit trail (see OBS-001 design decision #2).
 */
const BCRYPT_SHAPE = /\$2[aby]\$/;

/**
 * OBS-013 — `attemptedEmail` (the raw, attacker-controlled login of a
 * LOGIN_FAILURE / ACCOUNT_LOCKED) must never reach the stdout log sink: it can
 * be email PII or arbitrary free-text. stdout — broadly shipped and far less
 * controlled — gets only a short, non-reversible digest, enough to correlate
 * repeated attempts on the same target without exposing the identifier.
 * (OBS-028 — the PERSISTED `entityId` is likewise no longer raw: it is a KEYED
 * HMAC, see `resolveEntityId` / `hashAttemptedSubject`.)
 */
const hashAttemptedLogin = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 8);

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
    // OBS-013 — keep the raw `attemptedEmail` out of the stdout sink. The
    // persistence path below still receives the full `event` (its `entityId`
    // stays the sanitized-but-readable subject, OBS-001); only this broadly
    // shipped logger line is downgraded to a non-reversible 8-char digest.
    const { attemptedEmail, ...loggable } = event;
    const entry = {
      timestamp: new Date().toISOString(),
      ...loggable,
      ...(attemptedEmail !== undefined
        ? { attemptedEmailHash: hashAttemptedLogin(attemptedEmail) }
        : {}),
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
    //
    // PERF-001 decision (2026-06-03) — KEEP synchronous fire-and-forget.
    // A bounded in-process queue was evaluated and rejected for two reasons:
    //  1. Correctness: audit-persistence.service.ts serializes every INSERT on
    //     pg_advisory_xact_lock to maintain the hash-chain total order. An
    //     in-process queue cannot parallelize the DB work; it only adds a
    //     buffering hop before the same serialization point.
    //  2. Durability: a bounded queue's relief valve is event dropping — i.e.
    //     dropping LOGIN_SUCCESS / ACCESS_DENIED records, a compliance regression
    //     against the durability guarantee DAT-002 bought.
    // Projected volume (throttle: 30 logins/min/IP, current user base) stays
    // well below connection-pool saturation. If profiling ever shows pool
    // contention, the correct remediation is a dedicated audit DB connection pool
    // (or an async durable log like a WAL-backed queue), revisited when the
    // emitter surface widens (OBS-002 follow-up).
    void this.auditPersistence
      .log({
        action: event.action,
        entityType: ENTITY_TYPE_BY_ACTION[event.action] ?? 'Auth',
        entityId: this.resolveEntityId(event),
        actorId: event.userId ?? null,
        payload: {
          // COR-006 — guard ip/details with the same conditional-spread pattern
          // used for ua/reason/before/after: undefined-valued keys must not enter
          // the in-memory object. PostgreSQL JSONB drops them on INSERT
          // (JSON.stringify semantics) while stableStringify maps them to 'null',
          // so an unconditional key would cause hash-at-write ≠ hash-from-stored.
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
          ...(event.details !== undefined ? { details: event.details } : {}),
          success: event.success,
          timestamp: entry.timestamp,
          ...(event.ua !== undefined ? { ua: event.ua } : {}),
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
          ...(event.before !== undefined ? { before: event.before } : {}),
          ...(event.after !== undefined ? { after: event.after } : {}),
          // OBS-002 — thread the HTTP correlation id into the persisted row so
          // an SRE can stitch a security-envelope audit row back to the originating
          // request. getRequestId() returns undefined outside an HTTP context
          // (background jobs, scripts), so the key is absent on those rows.
          ...(getRequestId() !== undefined
            ? { requestId: getRequestId() }
            : {}),
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
   * Resolve the event subject. For LOGIN_FAILURE / ACCOUNT_LOCKED the attempted
   * identifier is the subject, but it must NOT enter the immutable trail raw
   * (OBS-028): it is stored as a KEYED HMAC of the normalised value (see
   * `hashAttemptedSubject`). A bcrypt-shaped value (a client that fat-fingered
   * the password into the login field) is refused so the trail never records a
   * credential — falls back to 'unknown'. Every other subject is an opaque id
   * (targetId/userId), passed through unchanged.
   */
  private resolveEntityId(event: {
    action: AuditAction;
    userId?: string;
    targetId?: string;
    attemptedEmail?: string;
  }): string {
    if (
      (event.action === AuditAction.LOGIN_FAILURE ||
        event.action === AuditAction.ACCOUNT_LOCKED) &&
      event.attemptedEmail
    ) {
      if (BCRYPT_SHAPE.test(event.attemptedEmail)) {
        return 'unknown';
      }
      return this.hashAttemptedSubject(event.attemptedEmail);
    }
    return event.targetId ?? event.userId ?? 'unknown';
  }

  /**
   * OBS-028 — pseudonymise the attempted-login identifier before it becomes the
   * persisted `entityId` of a LOGIN_FAILURE / ACCOUNT_LOCKED row. Keyed HMAC
   * (AUDIT_HASH_KEY) so it is NOT dictionary-reversible; deterministic over the
   * normalised value (trim + lowercase, the DAT-015 LOWER() convention) so
   * brute-force forensics still correlate repeat attempts / lockouts per target
   * by hash. `assertAuditHashKey` validates the key at boot; this throw is
   * defence-in-depth — a missing key makes the persist reject (logger-only via the
   * caller's `.catch`) rather than EVER fall back to storing the raw identifier.
   */
  private hashAttemptedSubject(identifier: string): string {
    const key = process.env.AUDIT_HASH_KEY;
    if (!key) {
      throw new Error(
        'AUDIT_HASH_KEY is not set — refusing to store a raw attempted identifier in audit_logs',
      );
    }
    return createHmac('sha256', key)
      .update(identifier.trim().toLowerCase())
      .digest('hex');
  }
}
