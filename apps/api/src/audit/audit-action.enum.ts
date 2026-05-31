/**
 * AuditAction — the single source of truth for audit action codes (OBS-024).
 *
 * Both audit writers depend on this enum:
 *   - `AuditService` (console SecurityAudit + DAT-002 dual-write), and
 *   - `AuditPersistenceService` (durable `audit_logs` hash chain).
 *
 * Extracted into its own module so the lower-level `AuditPersistenceService`
 * can type its `action` parameter as `AuditAction` without importing the
 * higher-level `AuditService` (which would create an import cycle). The enum is
 * re-exported from `audit.service.ts` so existing `'../audit/audit.service'`
 * import paths keep working unchanged.
 *
 * The string value of each member IS the action code persisted to the
 * `audit_logs.action` column — never change a value without a query-time alias
 * for legacy rows (OBS-002 immutability blocks backfilling old codes).
 */
export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  // SEC-006 — a per-(account, IP) progressive lockout was armed after repeated
  // failed logins (LoginLockoutService). Subject = the targeted account
  // identifier (sanitized, like LOGIN_FAILURE); payload carries the lock's
  // before/after and the escalation level.
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  REGISTER = 'REGISTER',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ROLE_CHANGE = 'ROLE_CHANGE',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_BY_ADMIN = 'PASSWORD_RESET_BY_ADMIN',
  SERVICE_MEMBERSHIP_CHANGED = 'SERVICE_MEMBERSHIP_CHANGED',
  DEPARTMENT_CHANGED = 'DEPARTMENT_CHANGED',
  // USR-DEL-001 — definitive user removal (UsersService.hardDelete). Net-new
  // emitter, symmetric with DAT-007's PROJECT_DELETED / OBS-005's ROLE_DELETED:
  // a final column snapshot is written to payload.snapshot BEFORE the row is
  // erased, so an auditor sees the deletion in the immutable trail. Distinct
  // from USER_DEACTIVATED (the soft-deactivation path), which is the canonical
  // removal action for a user that already authored audit history.
  USER_DELETED = 'USER_DELETED',
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
  // OBS-018 — operational backfill/seed/maintenance scripts. One action with a
  // `phase` ('STARTED' | 'COMPLETED') in the payload (single-enum, mirrors the
  // OBS-012 RELEASE_DEPLOYED precedent rather than split STARTED/COMPLETED
  // enums). entityId = the script name.
  SYSTEM_BACKFILL = 'SYSTEM_BACKFILL',
  // OBS-024 — project lifecycle. These three were the last free-strings emitted
  // straight to AuditPersistenceService (projects.service.ts: archive /
  // unarchive / DAT-007 hard-delete). Promoted to enum members here with their
  // original string values (zero prod-data impact, identical to the free-string
  // codes already in `audit_logs`), converging the last divergent namespace.
  PROJECT_ARCHIVED = 'PROJECT_ARCHIVED',
  PROJECT_UNARCHIVED = 'PROJECT_UNARCHIVED',
  PROJECT_DELETED = 'PROJECT_DELETED',
}
