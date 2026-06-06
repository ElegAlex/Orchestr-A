import { z } from 'zod';
import { AuditAction } from './audit-action.enum';

/**
 * DAT-021 (c) — central Zod registry for `audit_logs.payload` shapes.
 *
 * One schema per `AuditAction` enum member, exhaustively keyed by the
 * `Record<AuditAction, …>` below. A new enum member with no schema is a COMPILE
 * error (same exhaustiveness mechanic OBS-024 used for `ENTITY_TYPE_BY_ACTION`,
 * and the post-OBS-024 third compile-time enforcement layer:
 *   enum (audit-action.enum.ts) ∩ entityType (ENTITY_TYPE_BY_ACTION) ∩ payload (here)).
 *
 * ── Strictness policy ──────────────────────────────────────────────────────
 * Every schema is `.strict()`: a payload with an UNKNOWN top-level key is
 * rejected at INSERT time. The audit trail's value depends on payload
 * predictability — an unexpected top-level key is a red flag, and the gate
 * surfaces it as a rejected write rather than a silently-stored anomaly.
 *
 * Strictness is enforced on the TOP-LEVEL KEY SET, not on the internals of
 * open-ended snapshot fields. `before` / `after` / `snapshot` / `subject` /
 * `actor` carry arbitrary domain objects (Dates, Prisma.Decimal, nested rows)
 * and are validated as `z.unknown()`: the predictable thing about a snapshot is
 * THAT it is present under a known key, not its exact interior shape. Tightening
 * those internals would couple the audit gate to every domain model's column
 * list with no traceability gain.
 *
 * ── Two writers, two provenances ───────────────────────────────────────────
 * `AuditService.log()` (auth flows, deploy, leave self-approval) routes a
 * GENERIC security envelope ({ ip, details, success, timestamp, ua?, reason?,
 * before?, after? }) through `AuditPersistenceService.log()`. Direct callers
 * (users / leaves / projects / rbac / documents / export / scripts) pass
 * bespoke per-action payloads. An action emitted by BOTH paths (e.g.
 * LEAVE_APPROVED — rich direct row + an envelope self-approval row) takes the
 * `z.union([...])` of the two shapes; neither branch is loosened.
 *
 * ── Versioning hinge (v1 only this session) ────────────────────────────────
 * Every row written today is `schemaVersion = 1` and these schemas describe the
 * v1 shape. The `Record<AuditAction, …>` shape IS the v2 dispatch hook: a future
 * v2 would key on the row's `schemaVersion` (e.g.
 * `Record<AuditAction, Record<number, ZodTypeAny>>` or a discriminated union on
 * a payload `schemaVersion` field) and dispatch per row. That dispatch is
 * deliberately NOT built now; the registry shape leaves the door open.
 */

/** Optional string metadata (ip / ua / details / reason). A present-but-undefined
 *  value is accepted: several emitters spread `ip: meta?.ip` unconditionally. */
const optStr = z.string().optional();

/** Open snapshot value — a domain object/array/scalar captured before/after a
 *  mutation. Validated only for PRESENCE under a known key, never interior shape. */
const snapshot = z.unknown();

/**
 * The `AuditService.log()` generic security envelope (DAT-002 dual-write).
 * `success` + `timestamp` are always set by the writer; `ip`/`details` keys are
 * always present (value may be undefined); the rest are conditional.
 * `requestId` is OBS-009: optional correlation id from the ALS context, lets an
 * SRE stitch a security-envelope audit row back to the originating HTTP request.
 */
const securityEnvelope = z
  .object({
    ip: optStr,
    details: optStr,
    success: z.boolean(),
    timestamp: z.string(),
    ua: optStr,
    reason: optStr,
    before: snapshot.optional(),
    after: snapshot.optional(),
    requestId: optStr,
  })
  .strict();

/** Symmetric before/after mutation (role reassignment, (de)activation, dept,
 *  default-role flip). Both snapshots present. */
const beforeAfter = z.object({ before: snapshot, after: snapshot }).strict();

/** Final column snapshot written BEFORE a row is erased (USER/PROJECT/ROLE
 *  delete). */
const deletionSnapshot = z.object({ snapshot }).strict();

/**
 * Shared vocabulary for the leaves lifecycle emitters (OBS-003 / OBS-021). The
 * seven LEAVE_* actions draw their top-level keys from this bounded set; the
 * key SET is predictable even though individual actions use a subset. Unknown
 * keys (typos, accidental additions) are still rejected.
 */
const leaveAudit = z
  .object({
    actor: snapshot.optional(),
    subject: snapshot.optional(),
    ip: optStr,
    ua: optStr,
    before: snapshot.optional(),
    after: snapshot.optional(),
    targetUserId: z.string().nullable().optional(),
    validatorAssigned: z.string().nullable().optional(),
    selfApproved: z.boolean().nullable().optional(),
    cancelledByOwner: z.boolean().nullable().optional(),
    operation: z.string().optional(),
  })
  .strict();

/** Document access (OBS-006). DOCUMENT_DOWNLOADED is reserved/unwired but shares
 *  the READ shape. */
const documentAccess = z
  .object({
    documentId: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
    ip: optStr,
    ua: optStr,
  })
  .strict();

/** Personal-data egress (OBS-007 / OBS-026). `dateRange` (planning) and
 *  `subject` (project CSV) are scope-dependent and mutually exclusive in
 *  practice; both optional here. */
const dataExported = z
  .object({
    format: z.string(),
    scope: z.string(),
    recordCount: z.number(),
    dateRange: snapshot.optional(),
    subject: snapshot.optional(),
    ip: optStr,
    ua: optStr,
  })
  .strict();

/** Operational backfill/maintenance scripts (OBS-018). Mirrors
 *  `emitSystemBackfill`'s payload exactly — the DAT-021 recompute script and the
 *  AUD-READ-001 normalization both emit through it. */
const systemBackfill = z
  .object({
    script: z.string(),
    args: z.array(z.string()),
    phase: z.enum(['STARTED', 'COMPLETED']),
    dryRun: z.boolean(),
    affectedCount: z.number().optional(),
    fromValue: optStr,
    toValue: optStr,
  })
  .strict();

/**
 * The exhaustive registry. `satisfies Record<AuditAction, …>` makes a missing
 * schema a compile error AT DEFINITION, while preserving the literal key set so
 * the compile witness (`audit-payload-registry.compile-witness.ts`) can
 * independently re-assert exhaustiveness. Grouped by emitter family for review.
 */
export const AUDIT_PAYLOAD_SCHEMAS = {
  // Auth flows — AuditService security envelope only.
  [AuditAction.LOGIN_SUCCESS]: securityEnvelope,
  [AuditAction.LOGIN_FAILURE]: securityEnvelope,
  // SEC-006 — lockout-armed event; emitted via the AuditService envelope with
  // before/after = { locked: … } snapshots.
  [AuditAction.ACCOUNT_LOCKED]: securityEnvelope,
  [AuditAction.REGISTER]: securityEnvelope,
  [AuditAction.ACCESS_DENIED]: securityEnvelope,
  [AuditAction.PASSWORD_CHANGED]: securityEnvelope,
  // OBS-003 — logout, AuditService security envelope.
  [AuditAction.LOGOUT]: securityEnvelope,

  // User mutations — direct before/after emitters (UsersService).
  [AuditAction.ROLE_CHANGE]: beforeAfter,
  [AuditAction.USER_DEACTIVATED]: beforeAfter,
  [AuditAction.USER_REACTIVATED]: beforeAfter,
  [AuditAction.DEPARTMENT_CHANGED]: beforeAfter,
  [AuditAction.SERVICE_MEMBERSHIP_CHANGED]: z
    .object({
      before: snapshot,
      after: snapshot,
      added: z.array(snapshot),
      removed: z.array(snapshot),
    })
    .strict(),
  [AuditAction.PASSWORD_RESET_BY_ADMIN]: z
    .object({ targetLogin: z.string(), before: snapshot, after: snapshot })
    .strict(),
  [AuditAction.USER_DELETED]: deletionSnapshot,
  // OBS-016 / OBS-017 — admin user provisioning (create + import). One schema
  // covers both emit shapes: create → { roleId, departmentId, source:'admin' },
  // import → { source:'import', row, roleId }.
  [AuditAction.USER_CREATED]: z
    .object({
      roleId: z.string().nullable().optional(),
      departmentId: z.string().nullable().optional(),
      source: z.enum(['admin', 'import']),
      row: z.number().optional(),
    })
    .strict(),

  // Institutional-role lifecycle (rbac/roles.service.ts, OBS-005).
  [AuditAction.ROLE_CREATED]: z.object({ after: snapshot }).strict(),
  [AuditAction.ROLE_UPDATED]: z
    .object({ before: snapshot, after: snapshot, changed: z.array(snapshot) })
    .strict(),
  [AuditAction.ROLE_DELETED]: deletionSnapshot,
  [AuditAction.ROLE_DEFAULT_CHANGED]: beforeAfter,

  // Document access (OBS-006).
  [AuditAction.DOCUMENT_READ]: documentAccess,
  [AuditAction.DOCUMENT_DOWNLOADED]: documentAccess,
  // Document lifecycle (OBS-006) — create/delete reference the row + project;
  // update carries before/after metadata snapshots.
  [AuditAction.DOCUMENT_CREATED]: z
    .object({ documentId: z.string(), projectId: z.string() })
    .strict(),
  [AuditAction.DOCUMENT_UPDATED]: z
    .object({
      documentId: z.string(),
      projectId: z.string(),
      before: snapshot,
      after: snapshot,
    })
    .strict(),
  [AuditAction.DOCUMENT_DELETED]: z
    .object({ documentId: z.string(), projectId: z.string() })
    .strict(),

  // Leaves lifecycle (OBS-003 / OBS-021). LEAVE_APPROVED is dual-provenance
  // (rich direct row in approve() + envelope self-approval row).
  [AuditAction.LEAVE_APPROVED]: z.union([leaveAudit, securityEnvelope]),
  [AuditAction.LEAVE_REJECTED]: leaveAudit,
  [AuditAction.LEAVE_CANCELLED]: leaveAudit,
  [AuditAction.LEAVE_CANCELLATION_REQUESTED]: leaveAudit,
  [AuditAction.LEAVE_UPDATED]: leaveAudit,
  [AuditAction.LEAVE_DELETED]: leaveAudit,
  [AuditAction.LEAVE_BALANCE_ADJUSTED]: leaveAudit,

  // Deploy ledger cross-reference (OBS-012) — envelope (AuditService).
  [AuditAction.RELEASE_DEPLOYED]: securityEnvelope,

  // Personal-data egress (OBS-007 / OBS-026).
  [AuditAction.DATA_EXPORTED]: dataExported,

  // Operational maintenance scripts (OBS-018).
  [AuditAction.SYSTEM_BACKFILL]: systemBackfill,

  // Project lifecycle (OBS-024 / DAT-007).
  [AuditAction.PROJECT_ARCHIVED]: z.object({ archivedAt: snapshot }).strict(),
  [AuditAction.PROJECT_UNARCHIVED]: z
    .object({ previousArchivedAt: snapshot })
    .strict(),
  [AuditAction.PROJECT_DELETED]: deletionSnapshot,

  // Time-entry lifecycle (OBS-015) — CREATED references the declaration's scalar
  // facts (task/project/hours/activity/date) + whether it was declared for a
  // third party; UPDATE carries before/after; DELETE a full snapshot.
  [AuditAction.TIME_ENTRY_CREATED]: z
    .object({
      taskId: z.string().nullable(),
      projectId: z.string().nullable(),
      hours: z.number(),
      activityType: z.string(),
      date: z.string(),
      declaredForThirdParty: z.boolean(),
    })
    .strict(),
  [AuditAction.TIME_ENTRY_UPDATED]: beforeAfter,
  [AuditAction.TIME_ENTRY_DELETED]: deletionSnapshot,

  // Task lifecycle (OBS-012) — CREATED references the row + project + status;
  // UPDATE carries before/after (captures the status transition); DELETE a
  // full snapshot.
  [AuditAction.TASK_CREATED]: z
    .object({
      taskId: z.string(),
      projectId: z.string().nullable(),
      status: z.string(),
    })
    .strict(),
  [AuditAction.TASK_UPDATED]: beforeAfter,
  [AuditAction.TASK_DELETED]: deletionSnapshot,

  // Telework lifecycle (OBS-013). CREATED carries the affected employee
  // (targetUserId, may differ from the actor); UPDATE/DELETE carry before-after
  // / snapshot; rule CRUD mirrors the single-entry shapes; SCHEDULES_GENERATED
  // is a bulk-materialization summary (count only).
  [AuditAction.TELEWORK_CREATED]: z
    .object({
      teleworkId: z.string(),
      targetUserId: z.string(),
      isTelework: z.boolean(),
      date: z.string(),
    })
    .strict(),
  [AuditAction.TELEWORK_UPDATED]: beforeAfter,
  [AuditAction.TELEWORK_DELETED]: deletionSnapshot,
  [AuditAction.TELEWORK_RULE_CREATED]: z
    .object({ ruleId: z.string(), targetUserId: z.string() })
    .strict(),
  [AuditAction.TELEWORK_RULE_UPDATED]: beforeAfter,
  [AuditAction.TELEWORK_RULE_DELETED]: deletionSnapshot,
  [AuditAction.TELEWORK_SCHEDULES_GENERATED]: z
    .object({
      created: z.number(),
      skipped: z.number(),
      rulesProcessed: z.number(),
    })
    .strict(),

  // Client lifecycle (OBS-004). CREATED references the row + name; UPDATE
  // carries before/after; DELETE a snapshot; ASSIGNED/REMOVED reference the
  // project↔client link.
  [AuditAction.CLIENT_CREATED]: z
    .object({ clientId: z.string(), name: z.string() })
    .strict(),
  [AuditAction.CLIENT_UPDATED]: beforeAfter,
  [AuditAction.CLIENT_DELETED]: deletionSnapshot,
  [AuditAction.CLIENT_ASSIGNED_TO_PROJECT]: z
    .object({ projectId: z.string(), clientId: z.string() })
    .strict(),
  [AuditAction.CLIENT_REMOVED_FROM_PROJECT]: z
    .object({ projectId: z.string(), clientId: z.string() })
    .strict(),
} satisfies Record<AuditAction, z.ZodTypeAny>;

/**
 * Thrown when a payload fails its registered schema. Wraps the underlying
 * `ZodError` so a caller can `instanceof`-catch the audit-specific failure and
 * still reach `.issues` for diagnostics. The write is rejected — no partial row.
 */
export class AuditPayloadValidationError extends Error {
  constructor(
    readonly action: AuditAction,
    readonly zodError: z.ZodError,
  ) {
    super(
      `Invalid audit payload for action ${action}: ${zodError.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`,
    );
    this.name = 'AuditPayloadValidationError';
  }
}

/**
 * Validate a payload against the schema registered for `action`.
 *
 * Invoked by `AuditPersistenceService.log()` BEFORE the row is hashed/inserted.
 *
 * Two deliberate no-op cases, neither of which weakens the production guarantee:
 *
 *  1. **Absent payload** (`null`/`undefined`): there is no shape to be
 *     "unexpected" — absence is not malformation. The gate rejects malformed
 *     PRESENT payloads only. No production emitter omits the payload.
 *
 *  2. **Action with no registered schema**: unreachable in production. The
 *     OBS-024 compile-time enum gate guarantees every real call site passes an
 *     `AuditAction`, and the exhaustive `Record<AuditAction, …>` guarantees
 *     every member has a schema. The only callers passing a non-member string
 *     are esbuild-bypassing unit tests exercising hash-chain mechanics with
 *     synthetic action codes; skipping there avoids breaking orthogonal tests
 *     without surfacing any real bug. The guarantee is delivered by the
 *     intersection (enum gate ∩ exhaustive registry ∩ strict parse), not by
 *     policing strings the type system already forbids.
 *
 * @throws {AuditPayloadValidationError} when a present payload fails its schema.
 */
export function validatePayloadForAction(
  action: AuditAction,
  payload: Record<string, unknown> | null | undefined,
): void {
  if (payload === null || payload === undefined) return;
  const schema = AUDIT_PAYLOAD_SCHEMAS[action];
  if (!schema) return;
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AuditPayloadValidationError(action, result.error);
  }
}
