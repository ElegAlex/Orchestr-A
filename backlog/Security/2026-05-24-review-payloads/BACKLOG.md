# ORCHESTRA — Security Audit Remediation Backlog

> **Source audit:** `audits/2026-05-24-adversarial-review/` (this directory)
> **Generated:** 2026-05-24
> **Total tasks:** 174 — 173 from adversarial review (6 sub-agents) + 1 from Codex cross-review

## Schema legend

Each task carries these fields. Claude Code must not invent new ones, and must not skip fields when transitioning a task to a new status.

| Field | Semantics |
| --- | --- |
| **Status** | `TODO` → `IN_PROGRESS` → `DONE` → `VERIFIED`. Use `BLOCKED` only when `Blocked_by` is set and unmet. |
| **Phase** | Topological order. Higher phases assume lower phases are complete; do not pick from phase N+1 while phase N has TODO/IN_PROGRESS items unless they are explicitly independent. |
| **Cluster** | Root-cause grouping (A–K, or `—` for isolated). See `audits/2026-05-24-adversarial-review.md` for cluster definitions. |
| **Confidence** | `cross-validated` (both Claude Code and Codex flagged independently — highest priority within phase) / `claude-only` / `codex-only`. |
| **Blocked_by** | List of task IDs that must be DONE before this one can start. |
| **Severity** | `blocking` / `important` / `nit` / `suggestion`. Source-of-truth from the audit. |
| **File** | Repo-relative path + line number where the finding was identified. |
| **Source** | Pointer to the source finding object in the per-agent JSON file. Truth is in the JSON; this MD is a workbench. |
| **Description / Root cause / Code evidence / Suggested fix** | Verbatim from the source finding. Do NOT rewrite. |
| **Acceptance criteria** | Mandatory testable items. All must hold for the task to move to DONE. |
| **Verification command** | Best-effort inferred command to validate the fix. If marked TBD, write the verification logic before claiming DONE. |
| **Closed_by** | Git commit SHA that closed this task. Empty until DONE. Required by CI gate. |
| **Learnings** | Optional. Fill when execution reveals something the audit missed. |

## Totals

- **By severity:** 32 blocking · 116 important · 21 nit · 5 suggestion
- **By category:** 33 correctness · 30 data_integrity · 25 observability · 30 performance · 30 security · 25 tests · 1 tooling

## Cross-validated subset (max-confidence — close first within each phase)

These findings were independently flagged by both Claude Code's adversarial review and OpenAI Codex's cross-review. Defensible to an auditor as not-an-hallucination.

| ID | Title |
| --- | --- |
| `DAT-001` | Leave.approve() updates status outside transaction and audit is logger-only |
| `DAT-002` | AuditService is logger-only — security events not persisted |
| `DAT-007` | Task.projectId onDelete: Cascade — hard-delete of a Project nukes its TimeEntries, ProjectSnapshots, Documents — losing audit history |
| `OBS-001` | Security audit events go to console only, not to durable storage |
| `PER-003` | Daily snapshot cron N+1: findFirst per project then create |
| `PER-010` | Leave model has ZERO indexes — every leaves query is a seq scan |
| `SEC-001` | RBAC guard defaults to permissive mode — uncovered routes silently allow access |

## How Claude Code consumes this backlog

See `CLAUDE_SESSION_CONTRACT.md` in this directory for the exact session protocol. TL;DR for humans:

1. Each fresh Claude Code session reads `BACKLOG.md` + last 5 entries of `PROGRESS_LOG.md`.
2. Picks the next available TODO task respecting phase order, dependencies, and confidence (cross-validated first within phase).
3. Moves task to IN_PROGRESS, commits this BACKLOG.md change BEFORE writing any code.
4. Executes the fix, runs the verification command, only marks DONE if it passes.
5. Commits the code change with `[closes <task-id>]` in the message.
6. Updates `Closed_by`, appends a session entry to `PROGRESS_LOG.md`, commits.
7. Stops (does not auto-continue to next task).

---


## Phase 1 — Stop the bleed (audit-prescribed blockers)
*7 tasks in this phase.*

### COR-003 — Leave day calculation never subtracts public holidays

- **Status:** TODO
- **Phase:** 1
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** correctness · calendar
- **File:** `apps/api/src/leaves/leave-year-window.ts:71`
- **Source:** `audits/agents/02-correctness.json#COR-003`

**Description:**
calculateLeaveDays and splitLeaveByYear filter only weekends via isWeekend(); they never consult the holidays table. A leave that includes May 1 (Fête du Travail) will be charged 1 day against the user's CP/RTT allocation even though that day is a non-working holiday. The user pays for a day off they would have had off anyway.

**Root cause:**
Holiday calendar is only consumed by HolidaysService.countWorkingDays. The leaves module evolved independently and never integrated holidays into the day-counting engine.

**Code evidence:**
```
function calculateLeaveDays(...) { ... while (cursor <= endKey) { if (!isWeekend(cursor)) workDays++; cursor = nextDayKey(cursor); } ... }
```

**Suggested fix:**
Either (a) fetch holidays for [start, end] from HolidaysService and pass the Set<DayKey> of non-working holiday dates into calculateLeaveDays/splitLeaveByYear, or (b) compose holidaysService.countWorkingDays inside the leave service. Must be done atomically with the balance gate.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-003]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leave-year-window.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-001 — Leave.approve() updates status outside transaction and audit is logger-only

- **Status:** TODO
- **Phase:** 1
- **Cluster:** D
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** data_integrity · transaction
- **File:** `apps/api/src/leaves/leaves.service.ts:1454`
- **Source:** `audits/agents/03-data-integrity.json#DAT-001`

**Description:**
approve() performs prisma.leave.update({status:APPROVED,validatedById,validatedAt}) then calls auditService.log(...). There is no $transaction wrapping these. Worse, AuditService.log is a Logger.log/JSON.stringify — it does not persist to audit_logs. A crash between the leave update and the log call leaves a silently approved leave with zero audit trail.

**Root cause:**
Two parallel audit services exist (AuditService = console logger, AuditPersistenceService = DB writer) and the leaves module wired the wrong one; transaction discipline was never enforced.

**Code evidence:**
```
approve(): const updatedLeave = await this.prisma.leave.update(...); this.auditService.log({ action: AuditAction.LEAVE_APPROVED, ... });
```

**Suggested fix:**
Inject AuditPersistenceService into LeavesService. Wrap prisma.leave.update(...) and auditPersistence.log(...) in prisma.$transaction. Same for reject, cancel, validator changes.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-005 — Money/hours precision uses Float (double-precision) instead of Decimal

- **Status:** TODO
- **Phase:** 1
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:411`
- **Source:** `audits/agents/03-data-integrity.json#DAT-005`

**Description:**
TimeEntry.hours Float, Leave.days Float, LeaveBalance.totalDays Float, Task.estimatedHours Float, ProjectSnapshot.progress Float are all DOUBLE PRECISION in Postgres. Half-day arithmetic (0.5, 0.25) accumulates floating-point error: SUM(hours) across many rows will drift. For HR balances this becomes legally observable.

**Root cause:**
Initial schema chose JS-native floats; team did not anticipate aggregation drift.

**Code evidence:**
```
schema.prisma:411: hours Float. schema.prisma:577 days Float. schema.prisma:651 totalDays Float.
```

**Suggested fix:**
Migrate to Decimal @db.Decimal(6,2). One-shot migration: ALTER TABLE ... TYPE numeric(6,2) USING ("hours"::numeric(6,2)). Update Prisma client.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-005]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-001 — RBAC guard defaults to permissive mode — uncovered routes silently allow access

- **Status:** DONE
- **Phase:** 1
- **Cluster:** B
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** security · authz
- **File:** `apps/api/src/rbac/permissions.guard.ts:69`
- **Source:** `audits/agents/01-security.json#SEC-001`

**Description:**
PermissionsGuardV2 is registered as global APP_GUARD but reads RBAC_GUARD_MODE from env with default 'permissive'. In permissive mode, any controller method missing @RequirePermissions/@AllowSelfService/@Public/@RequireAnyPermission is ALLOWED with only a warning log. A malicious authenticated user can hit any endpoint a developer forgot to decorate. Production deployments that ship without RBAC_GUARD_MODE=enforce in .env are wide open by default.

**Root cause:**
Migration strategy left the guard in 'permissive' as the default to avoid breaking changes during V2 rollout. No fail-closed default; .env.example and .env.production.example don't even mention RBAC_GUARD_MODE.

**Code evidence:**
```
const envMode = process.env.RBAC_GUARD_MODE; this.mode = envMode === 'enforce' ? 'enforce' : 'permissive';
```

**Suggested fix:**
Default to 'enforce' (this.mode = envMode === 'permissive' ? 'permissive' : 'enforce') OR document RBAC_GUARD_MODE=enforce in .env.production.example and add a startup boot check that refuses to start in production if mode is 'permissive'.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/rbac/permissions.guard.spec.ts  # may need creation if missing
```

**Closed_by:** 507d755
**Learnings:**
- Suggested fix offered two alternatives joined by OR; implemented BOTH (default flip + boot-assert + env docs) for defense-in-depth, matching the example commit message shape in `CLAUDE_SESSION_CONTRACT.md`.
- Pre-existing test file `permissions.guard.spec.ts` already had `mode enforce: refuse` coverage but used `makeGuard('enforce')` which sets the env explicitly — it did not cover the "env unset" path that was the actual regression vector. Added two tests: env-unset → enforce, env-unknown-value → enforce (fail-closed). The first one is the FAIL-pre-fix / PASS-post-fix witness required by acceptance criterion #2.
- `docker-compose.prod.yml` already pins `RBAC_GUARD_MODE: enforce`, so the production deployment was already safe in practice; the bug was the development/staging default and any prod deployment NOT going through that compose file. The boot-assert closes the loop.
- Scope: change touched 6 files. Only `permissions.guard.ts:69` was strictly in the audit's File scope; the other 5 (main.ts, rbac.module.ts, env examples, spec) are direct consequences of the Suggested fix and are documented in the commit body.

---
### SEC-002 — PATCH /users/:id has no horizontal scope check — any user with users:update can modify any user

- **Status:** DONE
- **Phase:** 1
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** security · authz
- **File:** `apps/api/src/users/users.service.ts:342`
- **Source:** `audits/agents/01-security.json#SEC-002`

**Description:**
UsersService.update only enforces TEMPLATE hierarchy when updateUserDto.roleCode is provided (line 358). It performs NO check that the target user is within the caller's department/service perimeter. The documented 'RESPONSABLE scope perimeter' is not enforced. Any role that has users:update (currently USERS_CRUD = ADMIN/ADMIN_DELEGATED in templates, but easily granted to a custom institutional role) can edit ANY user globally — change email, login, isActive, departmentId, services. Combined with isActive control, an ADMIN_DELEGATED can disable other ADMIN_DELEGATED accounts.

**Root cause:**
Service relies entirely on permission check at controller level; the resource-level scope/ownership filter is missing for users.

**Code evidence:**
```
async update(id, updateUserDto, callerRoleCode?) { const existingUser = await this.prisma.user.findUnique({ where: { id } }); ... // no scope check
```

**Suggested fix:**
Inject AccessScopeService.assertCanManageUser(targetUserId, callerUser) into update/remove; for non-ADMIN, restrict to users where caller is dept manager or shares a service.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** 24bbfe7
**Learnings:**
- Audit's "Suggested fix" named `AccessScopeService.assertCanManageUser` but only the service existed — the method did not. Treated adding the named method as in-scope (matches advisor reading of the contract; not a BLOCKED-prerequisite case since the host module was already provided & @Global).
- Vertical hierarchy (RoleHierarchyService.assertCanAssignRole) and horizontal scope (new method) are deliberately kept separate: the former only fires when `roleCode` is in the payload; the latter fires unconditionally. Both must hold.
- Acceptance criterion 4 lists "user delete, password reset" for audit_logs; user *update* is not listed. No audit_logs change made in this commit — left for a dedicated audit-trail task if needed.
- Scope check does not prevent two peer ADMIN_DELEGATEDs sharing a service from touching each other (that's a hierarchy concern, not scope; audit did not request hierarchy on update). Surfaced as a peer-edit follow-up if the threat model justifies it.
- Adjacent files touched (justified by Suggested fix scope): `common/services/access-scope.service.ts` (new method), `users/users.controller.ts` (thread full caller through to service). No unrelated paths modified.

---
### SEC-003 — POST /users/:id/reset-password bypasses role-hierarchy guard

- **Status:** IN_PROGRESS
- **Phase:** 1
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** security · authz
- **File:** `apps/api/src/users/users.controller.ts:378`
- **Source:** `audits/agents/01-security.json#SEC-003`

**Description:**
/users/:id/reset-password requires only @RequirePermissions('users:manage_roles') and calls UsersService.resetPassword(id, newPassword) directly with NO RoleHierarchyService.assertCanAssignRole check. By contrast, /auth/reset-password-token enforces hierarchy. So any holder of users:manage_roles (template ADMIN, but also potentially custom institutional roles bound to ADMIN_DELEGATED in the future) can directly set a peer/parent ADMIN's password and self-escalate by then logging in. The endpoint also accepts a body password without any ownership/target-self check, so an ADMIN A can reset ADMIN B's password and hijack the account.

**Root cause:**
Two parallel password-reset endpoints exist; only the AuthService one was hardened. The users.service.resetPassword path was not updated to match.

**Code evidence:**
```
@Post(':id/reset-password') @RequirePermissions('users:manage_roles') resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminResetPasswordDto) { return this.usersService.resetPassword(id, dto.newPassword); }
```

**Suggested fix:**
Call this.roleHierarchy.assertCanAssignRole(callerRoleCode, target.role?.code) in UsersService.resetPassword. Forbid self-reset via this admin endpoint.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-003]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### CLAUDE-CFG-001 — Smoke hook misses untracked changes

- **Status:** TODO
- **Phase:** 1
- **Cluster:** —
- **Confidence:** codex-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tooling · audit_workflow
- **File:** `.claude/settings.json:31-36`
- **Source:** `audits/codex-addendum.json#CLAUDE-CFG-001`

**Description:**
The Stop hook uses `git diff --quiet HEAD -- apps packages e2e` which only sees tracked file changes. Untracked files (newly created tests, configs, documentation) bypass the smoke gate entirely. This makes the audit workflow unreliable: any future review that produces new audit artifacts or test files will not trigger the smoke validation.

**Root cause:**
The diff-based check is too narrow. `git diff` ignores untracked files by design; this hook needs to also inspect the working tree.

**Code evidence:**
```
"matcher": "Edit|Write|MultiEdit",
"hooks": [
  {
    "type": "command",
    "command": "git diff --quiet HEAD -- apps packages e2e"
  }
]
```

**Suggested fix:**
Replace `git diff --quiet HEAD -- apps packages e2e` with `git status --porcelain -- apps packages e2e | grep -q .` (inverted condition to mean 'changes exist'). This includes untracked files in the trigger logic. Alternatively, add a separate post-write targeted check that fires on every relevant file write rather than only at Stop.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes CLAUDE-CFG-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (config change, no automated test)
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 2 — Cour des Comptes ready — Audit log durcissement
*16 tasks in this phase.*

### DAT-002 — AuditService is logger-only — security events not persisted

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** data_integrity · audit_log
- **File:** `apps/api/src/audit/audit.service.ts:19`
- **Source:** `audits/agents/03-data-integrity.json#DAT-002`

**Description:**
AuditAction.LOGIN_SUCCESS, LOGIN_FAILURE, ACCESS_DENIED, ROLE_CHANGE, USER_DEACTIVATED, PASSWORD_CHANGED, LEAVE_APPROVED, LEAVE_REJECTED are all routed through a Logger that writes JSON to stdout. Nothing is persisted to audit_logs. RGPD traceability promised by schema comment is unfulfilled.

**Root cause:**
Two audit services exist but RGPD-relevant security events still target the legacy logger.

**Code evidence:**
```
audit.service.ts: this.logger.log(JSON.stringify(entry)) — no Prisma access in the file.
```

**Suggested fix:**
Make AuditService write to both the logger AND audit_logs. Add columns for ip and success to audit_logs or use the existing payload JSONB.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/audit/audit.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-001 — Security audit events go to console only, not to durable storage

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · audit_log
- **File:** `apps/api/src/audit/audit.service.ts:16`
- **Source:** `audits/agents/05-observability.json#OBS-001`

**Description:**
AuditService.log() writes LOGIN_SUCCESS/FAILURE, ROLE_CHANGE, LEAVE_APPROVED/REJECTED, USER_DEACTIVATED, PASSWORD_CHANGED, ACCESS_DENIED only through NestJS Logger (stdout). There is NO database persistence. If the container is recreated, logs scrape rotates, or stdout is not centralized, all auth/leave decisions are unrecoverable. An auditor asking 'who approved leave X on date Y' cannot get a guaranteed answer.

**Root cause:**
Two parallel audit services exist (AuditService = console, AuditPersistenceService = DB) with no convergence; sensitive paths chose the volatile one.

**Code evidence:**
```
if (event.success) { this.logger.log(JSON.stringify(entry)); } else { this.logger.warn(JSON.stringify(entry)); }
```

**Suggested fix:**
Make AuditService persist to audit_logs via AuditPersistenceService in addition to (or replacing) Logger.log. Migrate all current emitters (auth, leaves) to write to DB. Add a structured actor/subject/before/after/ip/ua/reason JSON payload.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/audit/audit.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-002 — Append-only is a convention, not enforced by DB

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · audit_log
- **File:** `apps/api/src/audit/audit-persistence.service.ts:25`
- **Source:** `audits/agents/05-observability.json#OBS-002`

**Description:**
Schema comment claims audit_logs is 'append-only par convention applicative'. The migration creates no DB-level GRANT/REVOKE, no row-level security, no trigger preventing UPDATE/DELETE, and no hash chain. An ADMIN with DB access (or any code path doing prisma.auditLog.deleteMany) can silently tamper with the trail.

**Root cause:**
Append-only enforcement was deferred to convention; no DB-level protection.

**Code evidence:**
```
/// Table append-only par convention applicative (aucun update, aucun delete via service).
```

**Suggested fix:**
Add a Postgres trigger BEFORE UPDATE/DELETE ON audit_logs that RAISE EXCEPTION. Run application with a DB role that has only INSERT+SELECT on audit_logs. Add a hash chain column (prevHash, rowHash).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/audit/audit-persistence.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-003 — Leave approval audit lacks before/after state and role snapshot

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/leaves/leaves.service.ts:1486`
- **Source:** `audits/agents/05-observability.json#OBS-003`

**Description:**
On LEAVE_APPROVED the only payload is details: 'Leave X approved for user Y' plus actor id. There is NO capture of: validator's role/templateKey AT THE TIME of decision, validator's delegation chain, leave's previous status, leave date range, type, and balance impact. RBAC permissions resolved 100% compile-time — they can change between deploys without DB trace.

**Root cause:**
Audit emitter only takes (action, userId, targetId, details); no structured before/after; templateKey not snapshotted.

**Code evidence:**
```
this.auditService.log({ action: AuditAction.LEAVE_APPROVED, userId: validatorId, targetId: id, details: `Leave ${id} approved for user ${leave.userId}`, success: true });
```

**Suggested fix:**
Extend audit payload with { actor: { id, roleCode, templateKey, permissions[] }, subject: { leaveId, userId }, before: { status }, after: { status, validatorId, validatedAt, validationComment }, ip, ua, requestId }.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-003]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-004 — Role changes on users are NOT audited

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/users/users.service.ts:432`
- **Source:** `audits/agents/05-observability.json#OBS-004`

**Description:**
UsersService.update() mutates roleId, passwordHash, isActive, departmentId, serviceIds with zero call to AuditService/AuditPersistenceService. ROLE_CHANGE is defined as an enum value but is never emitted anywhere. An auditor asking 'when did user X become MANAGER, who promoted them' cannot get an answer.

**Root cause:**
AuditAction.ROLE_CHANGE enum exists but no caller. UsersService never injected AuditService.

**Code evidence:**
```
grep -n 'auditService' apps/api/src/users/users.service.ts → no matches
```

**Suggested fix:**
Inject AuditService into UsersService; emit ROLE_CHANGE, USER_DEACTIVATED, USER_REACTIVATED, PASSWORD_RESET_BY_ADMIN, SERVICE_MEMBERSHIP_CHANGED, DEPARTMENT_CHANGED with before/after.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-004]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-005 — Role template / institutional role mutations are NOT audited

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/rbac/roles.service.ts:65`
- **Source:** `audits/agents/05-observability.json#OBS-005`

**Description:**
RolesService manages creation/update/deletion of institutional roles bound to templates (V4 RBAC). No AuditService injection, no audit emission. An auditor cannot reconstruct 'which role existed on 2024-03-15 with what templateKey'. Combined with templateKey being compile-time, the only audit trail is git history.

**Root cause:**
RBAC module never wired into AuditModule.

**Code evidence:**
```
grep -n auditService apps/api/src/rbac/roles.service.ts → no matches
```

**Suggested fix:**
Audit ROLE_CREATED/ROLE_UPDATED/ROLE_DELETED/ROLE_DEFAULT_CHANGED with full diff. Add deploy-time audit row recording each templateKey hash.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-005]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/rbac/roles.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-006 — Document access/downloads are NOT logged

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/documents/documents.controller.ts:53`
- **Source:** `audits/agents/05-observability.json#OBS-006`

**Description:**
DocumentsController exposes documents:read endpoints. There is no audit emission on document read or download. For a French collectivité, document downloads (especially personnel files, leave justifications, project deliverables) must be traceable. RGPD Art. 30 + Cour des Comptes expect 'who read what when'.

**Root cause:**
Documents module not wired to audit.

**Code evidence:**
```
@RequirePermissions('documents:read') — no audit emit anywhere in controller/service
```

**Suggested fix:**
Emit DOCUMENT_READ / DOCUMENT_DOWNLOADED audit events with { actorId, documentId, mimeType, sizeBytes, ip, ua }.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-006]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/documents/documents.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-012 — Deploy workflow is theatrical — no real deploy and no deploy audit trail

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** observability · deploy_log
- **File:** `.github/workflows/deploy.yml:70`
- **Source:** `audits/agents/05-observability.json#OBS-012`

**Description:**
The 'Deploy to Server (SSH)' step is echo-only. No real SSH, no version pinned in the running container is recorded anywhere, no audit row 'release X deployed by Y at T'. Combined with no Sentry release tagging, the system cannot answer 'what version was running when leave Z was approved'.

**Root cause:**
Workflow was scaffolded but never wired to real deployment.

**Code evidence:**
```
run: | echo "🚀 Deployment process" echo "For production deployment, configure the following:" ... echo "Manual deployment steps:"
```

**Suggested fix:**
Either wire real SSH deploy (appleboy/ssh-action) writing a release row in DB on success, or remove the misleading workflow. Persist deploy events in a deployments table.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-012]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (config change, no automated test)
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-009 — AuditLog has no append-only enforcement and no integrity hash chain

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · audit_log
- **File:** `packages/database/prisma/schema.prisma:1108`
- **Source:** `audits/agents/03-data-integrity.json#DAT-009`

**Description:**
The schema comment says 'append-only par convention applicative' but there is no DB-side protection: no trigger preventing UPDATE/DELETE, no immutability constraint, no row-level checksum or hash chaining. A DBA or a service bypass can silently rewrite history. actorId is SetNull on user deletion.

**Root cause:**
Convention-only enforcement; the comment itself documents the gap.

**Code evidence:**
```
schema.prisma:1106 Table append-only par convention applicative; schema.prisma:1118 onDelete: SetNull.
```

**Suggested fix:**
Create a trigger BEFORE UPDATE/DELETE on audit_logs that RAISE EXCEPTION (except for migration role). Add prevHash/rowHash chain. Replace actorId → SetNull with actorEmail/actorLabel snapshot columns.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-009]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-021 — AuditLog.payload Json? has no schema validation, no JSONB GIN index

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · json
- **File:** `packages/database/prisma/schema.prisma:1120`
- **Source:** `audits/agents/03-data-integrity.json#DAT-021`

**Description:**
AuditLog.payload Json? (JSONB). No application-side Zod validation reference, no schema versioning field, no GIN index — queries like 'audit logs where payload.userId = X' will table-scan. Schema drift across action codes is invisible.

**Root cause:**
JSONB chosen for flexibility without operational discipline.

**Code evidence:**
```
schema.prisma:1119-1120 payload Json? — no @@index, no version column.
```

**Suggested fix:**
(a) Add schemaVersion Int @default(1). (b) CREATE INDEX audit_logs_payload_gin ON audit_logs USING GIN (payload jsonb_path_ops). (c) Define Zod schemas per action code in central module.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-021]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-007 — Data exports (ICS/CSV/XLSX) are NOT audited

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/planning-export/planning-export.service.ts:1`
- **Source:** `audits/agents/05-observability.json#OBS-007`

**Description:**
Planning exports (and any CSV export under csv-parser/xlsx) leave no audit trace of who exported what range. RGPD-wise this is a personal-data egress event that must be tracked.

**Root cause:**
Export endpoints not instrumented.

**Code evidence:**
```
exportIcs(...) defined; no auditService injection in planning-export module
```

**Suggested fix:**
Emit DATA_EXPORTED { actorId, format, scope, dateRange, recordCount, ip } at each export endpoint.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-007]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/planning-export/planning-export.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-018 — Backfill / seed scripts have no persisted audit trail

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/scripts/backfill-snapshots.ts:27`
- **Source:** `audits/agents/05-observability.json#OBS-018`

**Description:**
scripts/backfill-snapshots.ts and seed paths run direct Prisma writes (mass leave-balance recompute, role seeding) with only console.error on failure. No row in audit_logs marking 'system backfill ran at T, touched N entities, by operator U'.

**Root cause:**
Scripts not wired to AuditPersistenceService.

**Code evidence:**
```
console.error('Backfill failed:', err);
```

**Suggested fix:**
Each script writes one AuditLog row { action: 'SYSTEM_BACKFILL', entityType: 'SystemMaintenance', actorId: process.env.DEPLOY_USER || null, payload: { script, args, affectedCount, dryRun } } at start AND at end.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-018]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/scripts/backfill-snapshots.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-020 — Audit retention undocumented, no archival strategy for 5+ year horizon

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · audit_log
- **File:** `packages/database/prisma/schema.prisma:1108`
- **Source:** `audits/agents/05-observability.json#OBS-020`

**Description:**
Cour des Comptes typically expects 5-10 year retention of decision trails. No retention policy documented; no archival pipeline (S3, Glacier, French sovereign); no DB size capacity plan; no migration to time-partitioned tables. The table will grow unbounded and queries (no createdAt index alone) will degrade.

**Root cause:**
Retention/archival never specified.

**Code evidence:**
```
Only indices: [entityType, entityId] and [actorId, createdAt]; no [createdAt] alone; no partitioning; no archival job in repo.
```

**Suggested fix:**
Document retention (e.g. 6 years online, 10 years cold). Add @@index([createdAt]) and consider monthly Postgres partitioning. Nightly job exporting prior-month rows to immutable WORM storage with hash chain receipt persisted back.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-020]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-021 — Self-approval audited; cancellation / cancellation-request / update / delete are not

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · audit_log
- **File:** `apps/api/src/leaves/leaves.service.ts:546`
- **Source:** `audits/agents/05-observability.json#OBS-021`

**Description:**
Only LEAVE_APPROVED (incl. self-approve) and LEAVE_REJECTED emit audit events. CANCELLATION_REQUESTED, APPROVE_CANCELLATION, leave UPDATE (date range change), leave DELETE, and admin force-edit have no audit emission. An auditor cannot reconstruct 'leave was approved on T1 then its dates were silently changed on T2'.

**Root cause:**
Audit emit added only to two transitions during initial implementation.

**Code evidence:**
```
Only auditService.log calls in leaves.service.ts are at lines 546, 1486, 1559. cancel/update/delete/balance paths have no audit emit.
```

**Suggested fix:**
Emit LEAVE_CANCELLATION_REQUESTED, LEAVE_CANCELLED, LEAVE_UPDATED (with before/after dates+type+duration), LEAVE_DELETED, LEAVE_BALANCE_ADJUSTED.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-021]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-024 — Two divergent audit codebases (enum vs free-string) — no schema for action codes

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · audit_log
- **File:** `apps/api/src/audit/audit.service.ts:3`
- **Source:** `audits/agents/05-observability.json#OBS-024`

**Description:**
AuditService uses an enum (AuditAction.LEAVE_APPROVED) while AuditPersistenceService accepts an arbitrary string ('PROJECT_ARCHIVED'). There is no central registry, no compile-time guarantee that action codes used across modules are coherent. An auditor querying by action will hit two namespaces.

**Root cause:**
Two parallel implementations evolved without merger.

**Code evidence:**
```
AuditAction enum has 9 members in audit.service.ts; AuditPersistenceService accepts free-string action; projects.service.ts emits 'PROJECT_ARCHIVED' (not in enum).
```

**Suggested fix:**
Unify into one AuditService writing to DB. Export a single AuditAction enum/const used by both auth flows and entity-state transitions.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-024]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/audit/audit.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-011 — Audit emission almost never asserted — only one leaves test spies AuditService.log

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · coverage_gap
- **File:** `apps/api/src/audit/audit-persistence.service.spec.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-011`

**Description:**
AuditService.log is called from auth.service (5 sites), leaves.service (3+ sites), but the only assertion across all 65 spec files that spies the actual auditService instance is leaves.service.spec.ts L971. AuditPersistenceService.log is called from projects.service (2 sites) but its own spec only validates the Prisma create call shape, not that the service is called at the right business moments. RBAC role changes emit nothing? — no spec asserts emission for role mutations. This is a Cour-des-Comptes risk.

**Root cause:**
Services receive AuditService as injected dep mocked with log: vi.fn() but tests never assert it was called.

**Code evidence:**
```
grep auditService.log in specs: 4 lines (one is import); grep auditPersistence in specs: 0 hits in non-audit specs even though projects.service uses it
```

**Suggested fix:**
Add audit-emission assertions on every state transition that the audit policy requires: login success/failure, password reset, role update/delete, leave approve/reject/cancel/self-approve, project archive, document delete, user role change.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-011]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/audit/audit-persistence.service.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 3 — Defense-in-depth schema — Invariants métier en SQL
*10 tasks in this phase.*

### DAT-003 — No DB CHECK on Leave.endDate >= startDate (and others)

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:575`
- **Source:** `audits/agents/03-data-integrity.json#DAT-003`

**Description:**
Leave.startDate/endDate, Project.startDate/endDate, Epic.startDate/endDate, TeleworkRecurringRule.startDate/endDate, LeaveValidationDelegate.startDate/endDate, SchoolVacation.startDate/endDate, Event.recurrenceEndDate >= date have no DB-level CHECK constraint. A buggy service call or a direct admin SQL fix can write inverted ranges.

**Root cause:**
Business rules duplicated only in DTO/Zod, with no defense-in-depth at the DB layer.

**Code evidence:**
```
schema.prisma:575: startDate DateTime @db.Date  endDate DateTime @db.Date — no @@check.
```

**Suggested fix:**
Add ALTER TABLE leaves ADD CONSTRAINT leaves_dates_ck CHECK ("endDate" >= "startDate"). Repeat for projects, epics, telework_recurring_rules, leave_validation_delegates, school_vacations, events.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-003]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-004 — No CHECK on LeaveBalance.totalDays >= 0 / Leave.days > 0

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:646`
- **Source:** `audits/agents/03-data-integrity.json#DAT-004`

**Description:**
LeaveBalance.totalDays Float, Leave.days Float, Subtask.position Int, PredefinedTask.weight Int (comment 1..5), Epic.progress Int (0-100%), Task.progress Int (0-100%), ProjectMember.allocation Int? (0-100), Document.size Int accept any value at the DB level. Negative balances/progress and out-of-range weights pass through if service layer is bypassed.

**Root cause:**
Business invariants encoded only in DTO validators, no defense-in-depth.

**Code evidence:**
```
schema.prisma:651-652: totalDays Float // Nombre de jours attribués — no constraint.
```

**Suggested fix:**
Add CHECKs: leave_balances_totaldays_ck, leaves_days_ck, tasks_progress_ck, epics_progress_ck, predefined_tasks_weight_ck, project_members_allocation_ck, documents_size_ck.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-004]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-022 — No upper bound on TimeEntry.hours; no per-day cap

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · quota
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts:141`
- **Source:** `audits/agents/02-correctness.json#COR-022`

**Description:**
create() accepts any hours value. No validation that a single entry is <= 24, no per-(user, date) sum cap, no rejection of negative hours. A typo of 80 instead of 8 silently inflates totals.

**Root cause:**
DTO validation likely uses @IsNumber without a range; service-level invariant absent.

**Code evidence:**
```
return this.prisma.timeEntry.create({ data: { ..., hours, ... } });
```

**Suggested fix:**
Add @Min(0) @Max(24) on CreateTimeEntryDto.hours. Sum existing same-(userId, date) hours and reject if threshold exceeded.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-022]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/time-tracking/time-tracking.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-012 — Free-string fields where enum would prevent drift

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:280`
- **Source:** `audits/agents/03-data-integrity.json#DAT-012`

**Description:**
PredefinedTask.defaultDuration String ('HALF_DAY'|'FULL_DAY'|'TIME_SLOT'), PredefinedTaskAssignment.period String, PredefinedTaskAssignment.completionStatus String, PredefinedTaskRecurringRule.{period,recurrenceType} String, ProjectMember.role String, AppSettings.category String, AuditLog.action/entityType String. Typos in service calls write invalid values; filters silently drop them.

**Root cause:**
Schema author preferred String to avoid coupling enum migrations to feature work.

**Code evidence:**
```
schema.prisma:956 defaultDuration String, schema.prisma:984 completionStatus String @default("NOT_DONE").
```

**Suggested fix:**
Promote to enums where the value set is closed. For AuditLog.action keep String but add a CHECK against a list or document the canonical codes.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-012]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-013 — Time-of-day stored as String 'HH:MM' instead of Postgres TIME / minutes-int

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:290`
- **Source:** `audits/agents/03-data-integrity.json#DAT-013`

**Description:**
Task.startTime/endTime String, Event.startTime/endTime String, PredefinedTask.startTime/endTime String. No format enforcement: '9:5', '25:99', '' all accepted. Comparisons require string-lex tricks.

**Root cause:**
Quick-and-dirty representation that bypassed timezone discussions.

**Code evidence:**
```
schema.prisma:290-291: startTime String? // Horaire de début optionnel (format HH:MM).
```

**Suggested fix:**
Use @db.Time or store minutes-since-midnight Int. Add CHECK constraint if keeping String.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-013]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-014 — Leave.type LeaveType? legacy enum still exists alongside leaveTypeId — drift risk

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:569`
- **Source:** `audits/agents/03-data-integrity.json#DAT-014`

**Description:**
Schema explicitly says 'Gardé pour rétrocompatibilité'. Two sources of truth for leave type: enum column type and FK leaveTypeId. Any code reading type instead of leaveType.code will see stale values when admin renames/recreates a type.

**Root cause:**
Half-finished migration from enum to dynamic table; deprecated column not yet dropped.

**Code evidence:**
```
schema.prisma:573 type LeaveType? // Gardé pour rétrocompatibilité
```

**Suggested fix:**
Drop column leaves.type in a migration after verifying no SELECT references it. Until then, add a CHECK / trigger ensuring consistency.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-014]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-016 — Department.name and Service.name lack UNIQUE constraints

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:92`
- **Source:** `audits/agents/03-data-integrity.json#DAT-016`

**Description:**
Two departments or services can be created with identical names — UI shows duplicates indistinguishable except by UUID. Same for Client.name. RBAC scope decisions pivot on department/service membership; ambiguity in name is a security concern.

**Root cause:**
Schema author treated UUID as identity and left name as a label.

**Code evidence:**
```
schema.prisma:87-101 Department: no @@unique on name; schema.prisma:103-119 Service: no @@unique.
```

**Suggested fix:**
Add @unique on Department.name and @@unique([departmentId, name]) on Service.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-016]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-017 — Task.projectId nullable creates orphan tasks with no integrity check

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:280`
- **Source:** `audits/agents/03-data-integrity.json#DAT-017`

**Description:**
projectId nullable for transverse tasks. No constraint prevents inconsistent combinations: projectId IS NULL AND (epicId IS NOT NULL OR milestoneId IS NOT NULL) should be impossible but is currently allowed.

**Root cause:**
Nullable FK without compensating CHECK.

**Code evidence:**
```
schema.prisma:282-284: projectId nullable; epicId/milestoneId can be set independently.
```

**Suggested fix:**
Add CHECK ("projectId" IS NOT NULL OR ("epicId" IS NULL AND "milestoneId" IS NULL)). Consider trigger validating epic.projectId = task.projectId.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-017]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-018 — TaskDependency self-relation has no cycle prevention

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · cascade
- **File:** `packages/database/prisma/schema.prisma:348`
- **Source:** `audits/agents/03-data-integrity.json#DAT-018`

**Description:**
TaskDependency(taskId → dependsOnTaskId) allows A→B and B→A or longer cycles at DB level. No CHECK, no trigger. Same for Event.parentEventId.

**Root cause:**
Self-reference modelled without recursive CTE guard.

**Code evidence:**
```
schema.prisma:348-360 TaskDependency: no CHECK; schema.prisma:899-906 Event.parentEventId: no CHECK.
```

**Suggested fix:**
Add CHECK ("taskId" <> "dependsOnTaskId"). For multi-hop cycles, implement WITH RECURSIVE check in service addDependency and/or trigger.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-018]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-023 — Leave: no overlap constraint (EXCLUDE USING gist) — same user can have overlapping approved leaves

- **Status:** TODO
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:569`
- **Source:** `audits/agents/03-data-integrity.json#DAT-023`

**Description:**
Nothing at the DB level prevents user X from having two APPROVED leaves whose [startDate, endDate] ranges overlap. Service code may check, but a manager declaring a leave for the user while another approval lands races through.

**Root cause:**
Range exclusion is a known Postgres feature but rarely added by default.

**Code evidence:**
```
schema.prisma:569-598 Leave model — only PK and FK constraints.
```

**Suggested fix:**
CREATE EXTENSION btree_gist; ALTER TABLE leaves ADD CONSTRAINT leaves_no_overlap EXCLUDE USING gist ("userId" WITH =, daterange("startDate", "endDate", '[]') WITH &&) WHERE (status = 'APPROVED').

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-023]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 4 — RBAC complétude
*6 tasks in this phase.*

### TST-001 — Permission matrix covers only 35 of 91 permissions declared in API controllers

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · permission_matrix
- **File:** `e2e/fixtures/permission-matrix.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-001`

**Description:**
CLAUDE.md mandates ALL 6 roles tested against ALL sensitive endpoints. Grepping @RequirePermissions across apps/api/src yields 91 unique permission codes; the matrix has 35 distinct action: entries spread across 12 resources. Entirely missing resources: comments, documents, epics, holidays, milestones, school_vacations, settings, time_tracking. Entirely missing actions within covered resources: tasks:create/update/delete, telework:update/delete/read_team, users:delete/manage_roles/import/reset_password, leaves:update/delete/manage_delegations, departments:update/delete, projects:archive/manage_members, services/clients/skills writes, etc.

**Root cause:**
Matrix was authored once for the early modules and never regrown when modules landed. No CI gate fails when controllers declare permissions absent from the matrix.

**Code evidence:**
```
91 permissions from controllers vs 35 in matrix; missing tasks:create/update/delete, telework:update/delete, users:delete, users:manage_roles, leaves:update/delete, comments/documents/holidays/settings/milestones/epics entirely absent
```

**Suggested fix:**
Add a unit test that diffs grep -oP "@RequirePermissions\('[^']+'" apps/api/src against the matrix action: set and fails on missing entries. Backfill the 56 missing actions across the 8 missing resources.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — derive test from finding description for e2e/fixtures/permission-matrix.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-001 — Hardcoded role 'ADMIN' bypass violates RBAC V4

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/epics/epics.service.ts:107`
- **Source:** `audits/agents/02-correctness.json#COR-001`

**Description:**
assertProjectMembership uses if (userRole === 'ADMIN') return; — a string-equal bypass on a role code instead of a permission check. Violates the documented memory rule 'No hardcoded roles' and the RBAC V4 invariant that bypasses go through permissions like projects:manage_any.

**Root cause:**
RBAC migration to permissions was incomplete in epics.service.ts; the legacy ADMIN check was not replaced by a permission lookup.

**Code evidence:**
```
if (userRole === 'ADMIN') return;
```

**Suggested fix:**
Inject PermissionsService and check permissions.includes('projects:manage_any') instead of comparing role codes.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/epics/epics.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-002 — Hardcoded role 'ADMIN' bypass in milestones

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/milestones/milestones.service.ts:133`
- **Source:** `audits/agents/02-correctness.json#COR-002`

**Description:**
Same anti-pattern as COR-001 in MilestonesService.assertProjectMembership. Custom roles bound to ADMIN template via templateKey will fail this check because the role.code is the custom code, not the literal 'ADMIN'.

**Root cause:**
Legacy role-code comparison instead of permission-based gating.

**Code evidence:**
```
if (userRole === 'ADMIN') return;
```

**Suggested fix:**
Use PermissionsService.getPermissionsForRole(roleCode) and check projects:manage_any.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/milestones/milestones.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-028 — getUserLeaves does not enforce ownership — exposes any user's leaves to a request specifying that userId

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · data_flow
- **File:** `apps/api/src/leaves/leaves.service.ts:1004`
- **Source:** `audits/agents/02-correctness.json#COR-028`

**Description:**
getUserLeaves(userId) trusts the caller to have authorised the userId. It does not take a currentUser, does not check userId === currentUser.id, and computes canEdit/canDelete unconditionally as if the caller were the owner. Any route wired to this method that lets the user pass a userId without controller-level gating is a horizontal-privilege issue.

**Root cause:**
Method was written assuming the controller always passes req.user.id; the assumption is invisible at the service boundary.

**Code evidence:**
```
async getUserLeaves(userId: string) { ... return leaves.map((leave) => ({ ...leave, canEdit: leave.status === LeaveStatus.PENDING, canDelete: ... })); }
```

**Suggested fix:**
Either accept a currentUserId and assert equality (or canManageLeave), or rename the method to getOwnLeaves(currentUserId).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-028]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-030 — GET /users/:id has no horizontal scope filter — any role with users:read can read every user's full profile

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · authz
- **File:** `apps/api/src/users/users.controller.ts:217`
- **Source:** `audits/agents/01-security.json#SEC-030`

**Description:**
findOne selects email, login, departmentId, role, full skills list, project memberships with project status. There is no filter by department/service. Any role with users:read can enumerate every user's full sensitive profile by UUID. Combined with GET /users (1000/page), any users:read holder gets the entire directory and per-user details. This contradicts the documented 'RESPONSABLE scope perimeter'.

**Root cause:**
Service does no per-resource scope filter; the controller's permission check is binary.

**Code evidence:**
```
@Get(':id') @RequirePermissions('users:read') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.usersService.findOne(id); }
```

**Suggested fix:**
Apply AccessScopeService.userReadWhere limiting non-admin queries to self, users in same service(s), users in services managed by caller; restrict the select payload for non-management roles.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-030]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-018 — No spec asserts users:manage_roles flow — role changes can grant ADMIN silently

- **Status:** TODO
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · coverage_gap
- **File:** `apps/api/src/users/users.service.spec.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-018`

**Description:**
users.controller.ts L379 declares @RequirePermissions('users:manage_roles') on the password reset endpoint, but the actual role-change path lives on users PATCH and on rbac/roles updateRole. Neither user.controller.spec.ts nor users.service.spec.ts contains the strings 'changeRole', 'manage_roles', 'roleId' as an assertion target. Combined with TST-001 (matrix missing users:manage_roles), the privilege-escalation path is dark.

**Root cause:**
Role-mutation assumed to be implicitly covered by the rbac module spec; user-side surface not pinned.

**Code evidence:**
```
grep changeRole|setRole|manage_roles apps/api/src/users/*.spec.ts → empty; auth.service.spec.ts L299 has 'role injection prevention' on register, but not on PATCH
```

**Suggested fix:**
Add a test 'CONTRIBUTEUR PATCH /users/me with roleId in body cannot change role' that asserts the field is stripped/rejected. Add a multi-role E2E that confirms 403 from PATCH /users/:id with a roleId by a non-ADMIN.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-018]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 5 — Auth defense-in-depth
*12 tasks in this phase.*

### SEC-004 — forcePasswordChange flag is set by seeder but never enforced anywhere in the API

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** security · auth
- **File:** `packages/database/prisma/seed.ts:281`
- **Source:** `audits/agents/01-security.json#SEC-004`

**Description:**
When the seed auto-generates the admin password, it sets forcePasswordChange: true on the user. However, no code path in apps/api/src reads this field (grep -r forcePasswordChange returns zero hits in apps/api). The admin can log in, obtain a full JWT, and use every endpoint without ever changing the generated password.

**Root cause:**
Half-implemented self-rotation requirement: schema/seed support added but the login flow and JwtAuthGuard never gate on it.

**Code evidence:**
```
grep -rn 'forcePasswordChange' apps/api/src returns no results; seed.ts writes the field but it is never read.
```

**Suggested fix:**
In AuthService.login or JwtStrategy.validate, if user.forcePasswordChange is true, issue only a restricted token that allows ONLY PATCH /users/me/change-password and reject all other API routes until the flag is cleared.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-004]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-005 — Username enumeration via differential error semantics during login

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** security · auth
- **File:** `apps/api/src/auth/auth.service.ts:84`
- **Source:** `audits/agents/01-security.json#SEC-005`

**Description:**
validateUser returns null for unknown user and null for bad password, BUT it throws UnauthorizedException('Compte désactivé') if the user exists, the password is correct, and the account is disabled. An attacker can iterate logins, submit a guessed password, and distinguish 'wrong password / unknown user' (generic 401) from 'correct password but disabled account' (specific 401) — confirming both account existence AND password validity. Also: the audit log writes the attempted login plaintext into LOGIN_FAILURE details, which makes log poisoning easy.

**Root cause:**
Disabled-account check runs AFTER password verification with a distinct error message.

**Code evidence:**
```
if (!isPasswordValid) { return null; } if (!user.isActive) { throw new UnauthorizedException('Compte désactivé'); }
```

**Suggested fix:**
Return a single generic 401 for all failure modes. Fold the disabled case into the same null return.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-005]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-008 — Auth audit events do not carry IP/User-Agent despite controller extracting them

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · audit_log
- **File:** `apps/api/src/auth/auth.service.ts:97`
- **Source:** `audits/agents/05-observability.json#OBS-008`

**Description:**
auth.controller.ts extracts ip+ua via extractMeta(req) but passes them only to RefreshTokenService.issue/rotate. authService.login() emits LOGIN_SUCCESS without ip/ua. LOGIN_FAILURE similarly lacks ip/ua. For brute force forensics this is unreconstructable.

**Root cause:**
AuthService.login signature accepts meta but doesn't forward to auditService.log.

**Code evidence:**
```
this.auditService.log({ action: AuditAction.LOGIN_SUCCESS, userId: user.id, details: ..., success: true }); // no ip, no userAgent
```

**Suggested fix:**
Add ip and userAgent to the AuditService event signature; emit them from all auth paths and from leaves/users mutations (interceptor to inject request context).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-008]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-013 — Failed login details log raw user-supplied 'login' value to stdout

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · pii_leak
- **File:** `apps/api/src/auth/auth.service.ts:99`
- **Source:** `audits/agents/05-observability.json#OBS-013`

**Description:**
LOGIN_FAILURE event is logged as warn with details: 'Failed login attempt for login: ${loginDto.login}'. The login can be an email (PII) or arbitrary attacker-supplied string (log injection risk). With pino redact only covering req.body.password, the login field is not masked.

**Root cause:**
No structured field separation; free-text details containing PII.

**Code evidence:**
```
details: `Failed login attempt for login: ${loginDto.login}`
```

**Suggested fix:**
Hash or partially mask login in failure events (login: hash(login).slice(0,8)), or whitelist enumeration via separate non-PII counter.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-013]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-006 — Login rate-limit too permissive: 30 attempts/min per IP enables brute force

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · auth
- **File:** `apps/api/src/auth/auth.controller.ts:90`
- **Source:** `audits/agents/01-security.json#SEC-006`

**Description:**
POST /auth/login is throttled at 30 req/min and 120 req/15min per IP. Combined with the 6-char minimum password (LoginDto MinLength(6)), an attacker with a botnet can run distributed password spraying. There is no per-account lockout, no exponential backoff on failed attempts, and no CAPTCHA.

**Root cause:**
Generic IP-based throttler is the only protection; no account-locking mechanism.

**Code evidence:**
```
@Throttle({ short: { limit: 30, ttl: 60_000 }, medium: { limit: 120, ttl: 900_000 } })
```

**Suggested fix:**
Add per-account failure counter (Redis) with progressive lockout (5 failures → 15min lock, escalating). Reduce login burst to 5/min. Consider requiring CAPTCHA after 3 failures.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-006]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-007 — LoginDto allows 6-character passwords while RegisterDto enforces 8+ with complexity

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · auth
- **File:** `apps/api/src/auth/dto/login.dto.ts:18`
- **Source:** `audits/agents/01-security.json#SEC-007`

**Description:**
LoginDto requires only @MinLength(6) and no complexity. Pre-existing accounts (seeded admin with SEED_ADMIN_PASSWORD, imported users) may be created with weaker passwords because import bypasses RegisterDto. The CSV import bcrypts userData.password with zero validation — admins can import users with 'a' as a password.

**Root cause:**
Asymmetric validation: registration is strict, import/seed bypass entirely.

**Code evidence:**
```
ImportUserDto's password is never validated; UsersService.importUsers line 918: const passwordHash = await bcrypt.hash(userData.password, 12);
```

**Suggested fix:**
Define a shared PasswordPolicy validator (custom class-validator decorator) and apply it on RegisterDto, CreateUserDto, UpdateUserDto, ImportUserDto, ChangePasswordDto, ResetPasswordDto, AdminResetPasswordDto, and the seed.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-007]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/dto/login.dto.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-013 — Fastify trustProxy not enabled — rate-limit and refresh-token IP tracking broken behind nginx

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · other
- **File:** `apps/api/src/main.ts:22`
- **Source:** `audits/agents/01-security.json#SEC-013`

**Description:**
FastifyAdapter is constructed with only { logger: ... }. There is no trustProxy: true. Behind the docker-compose nginx reverse proxy, every request's req.ip resolves to the nginx container IP. ThrottlerBehindProxyGuard reads req.ips?.length ? req.ips[0] : (req.ip ?? 'unknown') — req.ips is only populated when trustProxy is on. Result: in production every API client appears as one nginx IP → throttler caps ALL legitimate users collectively at 600 req/min; refresh-token audit stores the nginx IP rather than the real client.

**Root cause:**
Fastify default trustProxy=false; nginx forwards X-Forwarded-For, but Fastify ignores it without explicit opt-in.

**Code evidence:**
```
new FastifyAdapter({ logger: fastifyLoggerOptions }) — no trustProxy.
```

**Suggested fix:**
FastifyAdapter({ logger: ..., trustProxy: true }) (or pass a CIDR matching the nginx network).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-013]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-014 — Refresh token cookie not marked __Host- and Path scoped only to /api/auth — vulnerable to subdomain attacks

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · auth
- **File:** `apps/api/src/auth/auth.controller.ts:67`
- **Source:** `audits/agents/01-security.json#SEC-014`

**Description:**
Set-Cookie for orchestr_a_refresh_token uses Path=/api/auth, HttpOnly, SameSite=Lax, and Secure only in NODE_ENV=production. It is NOT prefixed with __Host- (which would enforce Secure + Path=/ + no Domain). If the app is ever deployed on a shared domain alongside other apps on other subdomains, a malicious sibling subdomain or an XSS on a sibling can plant or read this cookie. SameSite=Lax also exposes top-level navigation CSRF.

**Root cause:**
Cookie attributes assembled manually as a string; missing __Host- prefix.

**Code evidence:**
```
`${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Max-Age=${maxAge}; Path=/api/auth; HttpOnly; SameSite=Lax${secure}`
```

**Suggested fix:**
Rename cookie to __Host-orchestr_a_refresh_token, drop any Domain attribute, use Path=/ + Secure + HttpOnly + SameSite=Strict in production. Use @fastify/cookie reply.setCookie() rather than raw header construction.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-014]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-019 — Password reset tokens do not invalidate active access JWTs — only refresh tokens are revoked

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · auth
- **File:** `apps/api/src/auth/auth.service.ts:360`
- **Source:** `audits/agents/01-security.json#SEC-019`

**Description:**
resetPassword hashes the new password, updates user.passwordHash, calls refreshTokenService.revokeAllForUser(), and audits. It does NOT blacklist active JWT access tokens. Because access TTL is 15 minutes by default, an attacker who stole a fresh access token continues to have full API access for up to 15 minutes AFTER the victim resets their password. The blacklist mechanism is keyed by jti and only populated on /auth/logout — there's no mechanism to revoke 'all JWTs for user X'.

**Root cause:**
JWT blacklist is per-jti; no userId-scoped revocation list.

**Code evidence:**
```
await this.refreshTokenService.revokeAllForUser(resetToken.userId); — no JWT blacklist of active access tokens.
```

**Suggested fix:**
Add a per-user 'token-not-valid-before' timestamp in Redis (e.g. jwt:nbf:<userId>) bumped to Date.now() on password reset / role change / forced logout. In JwtStrategy.validate, reject any token whose iat < nbf.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-019]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-021 — JWT blacklist is silently best-effort on Redis write failure

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · auth
- **File:** `apps/api/src/auth/jwt-blacklist.service.ts:28`
- **Source:** `audits/agents/01-security.json#SEC-021`

**Description:**
JwtBlacklistService.blacklist catches Redis errors and only logs them: 'Failed to blacklist jti=${jti}'. The /auth/logout request returns 204 to the client as if the token had been revoked. If Redis is unavailable at logout time, the stolen-after-logout token remains usable for up to 15min. Compare with the symmetric isBlacklisted which is fail-CLOSED.

**Root cause:**
Fail-soft on write, fail-closed on read. Asymmetry creates a usable token window without any caller awareness.

**Code evidence:**
```
} catch (err) { this.logger.error(`Failed to blacklist jti=${jti}: ${String(err)}`); }
```

**Suggested fix:**
On Redis failure during blacklist(), bubble the error so /auth/logout returns 503 and the client retries; or persist the blacklist entry in Postgres as a durable fallback.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-021]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/jwt-blacklist.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-022 — credentials:true CORS combined with JWT-in-localStorage AND refresh-token-in-cookie creates dual-mode CSRF surface

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · csrf
- **File:** `apps/api/src/main.ts:56`
- **Source:** `audits/agents/01-security.json#SEC-022`

**Description:**
The app intentionally stores JWT access tokens in localStorage but ALSO sets the refresh token in an HttpOnly cookie. With credentials: true in CORS config, the refresh-token cookie is sent on any cross-origin request from an allowed origin. /auth/refresh accepts the refresh token from EITHER the body OR the cookie. If a malicious site is ever added to ALLOWED_ORIGINS (typo, copy-paste, dev-prod confusion), the attacker can call /auth/refresh from their origin, the browser attaches the victim's cookie, the API issues a fresh access_token.

**Root cause:**
Hybrid storage model: cookie-based refresh + localStorage access. CSRF protection on the cookie side requires SameSite=Strict or anti-CSRF token; neither in place.

**Code evidence:**
```
credentials: true (main.ts:62); refreshToken = body.refreshToken ?? cookieValue(req, REFRESH_COOKIE) ?? '';
```

**Suggested fix:**
Either make /auth/refresh require the refresh token only from the BODY (not cookie), or require a custom anti-CSRF header (X-CSRF-Token) on /auth/refresh, or use SameSite=Strict on the refresh cookie.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-022]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-023 — Helmet CSP allows style-src 'unsafe-inline' and CSP is set both at Helmet and at Nginx with different policies

- **Status:** TODO
- **Phase:** 5
- **Cluster:** K
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · other
- **File:** `apps/api/src/main.ts:41`
- **Source:** `audits/agents/01-security.json#SEC-023`

**Description:**
Helmet CSP allows 'unsafe-inline' for styleSrc. The Nginx nginx.conf line 100 sets a different CSP that ALSO allows 'unsafe-inline' for both script-src and style-src. With both layers setting the header, browsers receive two CSP headers and intersect them, but the weakest allowance survives. Result: inline scripts are effectively allowed via nginx, defeating helmet's stricter scriptSrc. Any reflected/stored XSS becomes immediately exploitable.

**Root cause:**
Two layers of CSP without coordination; nginx CSP relaxes what helmet tightens.

**Code evidence:**
```
Helmet: styleSrc: ["'self'", "'unsafe-inline'"]; nginx: script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

**Suggested fix:**
Pick ONE layer (recommend helmet, scriptSrc 'self' only — remove 'unsafe-inline' from styleSrc and switch to nonce-based inline styles). Remove the duplicate Content-Security-Policy from nginx.conf, or align them strictly.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-023]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 6 — Upload / URL sinks
*8 tasks in this phase.*

### SEC-009 — Document URL field accepts arbitrary strings — stored XSS via javascript: scheme

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · input_validation
- **File:** `apps/api/src/documents/dto/create-document.dto.ts:32`
- **Source:** `audits/agents/01-security.json#SEC-009`

**Description:**
CreateDocumentDto.url is @IsString @IsNotEmpty with no @IsUrl, no scheme allowlist, no length cap. An authenticated user with documents:create can submit javascript:alert(document.cookie) as the document URL. The web frontend will likely render <a href={doc.url}> and grant the URL the user's session on click. CreateDocumentDto.mimeType is also a plain @IsString — the client sets the type with no validation.

**Root cause:**
DTO designed around 'URL points at external storage' without scheme/host enforcement.

**Code evidence:**
```
@IsString() @IsNotEmpty() url: string;  @IsString() @IsNotEmpty() mimeType: string;
```

**Suggested fix:**
Add @IsUrl({ protocols: ['http','https'], require_protocol: true, require_tld: true }) and @MaxLength(2048) on url; add @IsIn([...allowed mimes]) on mimeType.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-009]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/documents/dto/create-document.dto.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-010 — avatarUrl accepts arbitrary string — stored XSS sink

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · input_validation
- **File:** `apps/api/src/users/dto/create-user.dto.ts:85`
- **Source:** `audits/agents/01-security.json#SEC-010`

**Description:**
CreateUserDto.avatarUrl is @IsOptional @IsString. No URL validation, no scheme allowlist. An admin can set avatarUrl to javascript:... or to a remote-tracking pixel. Rendered as <img src={user.avatarUrl}> or background-image in dozens of components, this becomes an XSS via SVG payload, or a cross-origin leak / SSRF-from-browser.

**Root cause:**
Same defect as documents.url: no scheme/host validation.

**Code evidence:**
```
@IsOptional() @IsString() avatarUrl?: string;
```

**Suggested fix:**
Restrict avatarUrl to either the relative '/api/uploads/avatars/...' prefix produced by the server, or @IsUrl with https-only and trusted-host allowlist.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-010]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/dto/create-user.dto.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-011 — CreateUserDto exposes isActive boolean — caller can create pre-activated accounts

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · input_validation
- **File:** `apps/api/src/users/dto/create-user.dto.ts:91`
- **Source:** `audits/agents/01-security.json#SEC-011`

**Description:**
isActive is a writable, optional, defaults-to-true field on CreateUserDto. The /users POST controller route requires users:create, but combined with SEC-008 (no domain allowlist) and the import flow that also defaults isActive: true, this means an attacker with users:create OR users:import can mint active accounts in bulk without ever going through the public registration approval flow.

**Root cause:**
DTO permits administrative state to be set by callers; no separation between user-self-create and admin-provision.

**Code evidence:**
```
@IsOptional() @IsBoolean() isActive?: boolean; // default true
```

**Suggested fix:**
Move isActive out of CreateUserDto. Always default to false on create; require a separate POST /users/:id/activate route gated by an explicit users:activate permission.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-011]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/dto/create-user.dto.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-015 — deleteAvatar performs path traversal via user-controlled avatarUrl prefix removal

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · file_upload
- **File:** `apps/api/src/users/users.service.ts:1417`
- **Source:** `audits/agents/01-security.json#SEC-015`

**Description:**
deleteAvatar reads user.avatarUrl from DB, strips the /api/ prefix, and joins with process.cwd() then fs.unlink. Because avatarUrl is settable from CreateUserDto and UpdateUserDto as an arbitrary string (SEC-010), an admin/import could set avatarUrl to e.g. /api/../../../etc/passwd. On subsequent DELETE /users/me/avatar, the user's stored avatarUrl is path-resolved against cwd and unlinked → arbitrary file deletion.

**Root cause:**
Trusting DB-stored string built from user-controllable DTO field as a relative filesystem path.

**Code evidence:**
```
const relativePath = user.avatarUrl.replace(/^\/api\//, ''); const filePath = join(process.cwd(), relativePath); await fs.unlink(filePath)...
```

**Suggested fix:**
Never derive a filesystem path from avatarUrl. Always reconstruct uploadsDir/${userId}.${ext} from the userId and a fixed extension whitelist, then unlink only that. Validate avatarUrl strictly on write (SEC-010).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-015]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-016 — Static /api/uploads/ is served with no authentication — uploaded avatars are public

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · file_upload
- **File:** `apps/api/src/main.ts:35`
- **Source:** `audits/agents/01-security.json#SEC-016`

**Description:**
fastifyStatic is registered with prefix '/api/uploads/' against process.cwd()/uploads. The plugin serves files directly, BYPASSING the global JwtAuthGuard / PermissionsGuardV2 (those guards only run on Nest-registered routes, not on raw Fastify routes added by plugins). Result: anyone who knows or guesses a user UUID can fetch /api/uploads/avatars/<uuid>.jpg without authentication.

**Root cause:**
fastifyStatic registered before/independently of Nest's guards; Nest APP_GUARD does not cover non-Nest routes.

**Code evidence:**
```
await app.register(fastifyStatic, { root: join(process.cwd(), 'uploads'), prefix: '/api/uploads/' }); — no preHandler/auth.
```

**Suggested fix:**
Either restrict static to truly public assets and serve avatars through a Nest controller route gated by users:read; or add a fastify onRequest hook for /api/uploads that calls jwtService.verify() before allowing the static handler.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-016]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-017 — Avatar upload race condition / TOCTOU: cleanup loop deletes by userId prefix without validating ownership

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · file_upload
- **File:** `apps/api/src/users/users.service.ts:1379`
- **Source:** `audits/agents/01-security.json#SEC-017`

**Description:**
uploadAvatar lists uploadsDir, then unlinks any file starting with ${userId}. or ${userId}_. The startsWith check is permissive. Critically userId here is the AUTHENTICATED user.id from JWT — sourced from the DB so safe in practice — but the assertMagicBytes happens AFTER file.toBuffer (line 1389-1391) and BEFORE filesystem write — small window where uploads are buffered in memory at 2MB each — a DoS vector under concurrent uploads (no per-user upload rate-limit; @Throttle not applied on this endpoint).

**Root cause:**
No @Throttle on /users/me/avatar; magic-bytes validation happens after full buffer load; prefix-based cleanup not constrained to exact known extensions.

**Code evidence:**
```
if (f.startsWith(userId + '.') || f.startsWith(userId + '_')) { await fs.unlink(join(uploadsDir, f))...
```

**Suggested fix:**
Add @Throttle({ short: { limit: 5, ttl: 60_000 } }) on uploadAvatar; replace prefix cleanup with deletion of the three known extensions only (${userId}.jpg/.png/.webp); enforce assertMagicBytes on a stream-bound chunk before buffering the entire file.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-017]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-018 — AUTH_EXPOSE_RESET_TOKEN=true in .env.example trains operators to ship insecure config

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · secrets
- **File:** `.env.example:19`
- **Source:** `audits/agents/01-security.json#SEC-018`

**Description:**
.env.example sets AUTH_EXPOSE_RESET_TOKEN=true. Operators commonly cp .env.example .env and tweak DB URLs. If they also adapt this file to derive .env.production, the password-reset link generated by /auth/reset-password-token will be returned in the HTTP response body — and any logging proxy / network observer / browser dev-tools spectator can read it.

**Root cause:**
Dev convenience baked into the canonical example file with no contrary guidance in .env.production.example.

**Code evidence:**
```
AUTH_EXPOSE_RESET_TOKEN=true (.env.example line 30)
```

**Suggested fix:**
Set AUTH_EXPOSE_RESET_TOKEN=false in .env.example and explicitly document it as 'NEVER true in production'. Refuse to honor exposeToken=true when NODE_ENV=production (assert at boot).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-018]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (env config), plus boot-assert test if applicable
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-024 — External HTTP fetch to data.education.gouv.fr with no timeout / circuit breaker

- **Status:** TODO
- **Phase:** 6
- **Cluster:** J
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · other
- **File:** `apps/api/src/school-vacations/school-vacations.service.ts:177`
- **Source:** `audits/agents/01-security.json#SEC-024`

**Description:**
importFromOpenData calls await fetch(`${url}?${params.toString()}`) with no AbortController, no timeout, no retry/backoff. A slow or unresponsive upstream blocks the Node event loop for the request and ties up workers. An authenticated user with school_vacations:create can hit the endpoint repeatedly to amplify upstream load.

**Root cause:**
Generic fetch() without operational guards.

**Code evidence:**
```
const response = await fetch(`${url}?${params.toString()}`); // no timeout
```

**Suggested fix:**
Wrap with AbortController + 10s timeout; add @Throttle on the controller endpoint; cache results in Redis with TTL.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-024]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/school-vacations/school-vacations.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 7 — Mutations atomicity
*8 tasks in this phase.*

### COR-008 — approve() does not re-validate balance against snapshots

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · concurrency
- **File:** `apps/api/src/leaves/leaves.service.ts:1454`
- **Source:** `audits/agents/02-correctness.json#COR-008`

**Description:**
approve performs only status === PENDING and ownership checks before writing APPROVED. It does NOT recompute available days against the user's allocation. Between PENDING creation and validator approval, an admin can have reduced the user's LeaveBalance.totalDays. APPROVED is written against a stale view; the user ends up over-allocated.

**Root cause:**
Approval was treated as a pure state transition with no economic meaning.

**Code evidence:**
```
async approve(id, validatorId, comment) { const leave = ...; if (leave.status !== LeaveStatus.PENDING) throw ...; ... await this.prisma.leave.update({ where:{id}, data:{ status: LeaveStatus.APPROVED, ... } });
```

**Suggested fix:**
Run the same yearBuckets / hasConfiguredBalance / getAvailableDays loop inside a tx before applying status=APPROVED. Throw ConflictException with a 'solde devenu insuffisant' message if the allocation has shrunk.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-008]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-009 — Double-approve race: two validators can both pass PENDING check

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · concurrency
- **File:** `apps/api/src/leaves/leaves.service.ts:1440`
- **Source:** `audits/agents/02-correctness.json#COR-009`

**Description:**
approve() does findUnique → check status === PENDING → update. There is no row-level lock or update WHERE status = PENDING guard. Two validators acting simultaneously can each pass the PENDING check; both then issue UPDATE which is last-write-wins. Same race exists in reject(), cancel(), requestCancel(), rejectCancellation().

**Root cause:**
No optimistic locking (version column) and no conditional update on status.

**Code evidence:**
```
if (leave.status !== LeaveStatus.PENDING) { throw new BadRequestException(...); } ... await this.prisma.leave.update({ where: { id }, data: { status: LeaveStatus.APPROVED, ... }});
```

**Suggested fix:**
Wrap each transition in prisma.leave.updateMany({ where: { id, status: <required prior> }, data: { ... } }) and verify count === 1; else throw ConflictException. Or add an integer version column.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-009]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-014 — captureSnapshots is N+1 with no uniqueness guarantee; document race ≠ correctness

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · concurrency
- **File:** `apps/api/src/projects/projects.service.ts:983`
- **Source:** `audits/agents/02-correctness.json#COR-014`

**Description:**
captureSnapshots does Promise.all over active projects with a per-project findFirst → create. Two snapshot-scheduler ticks can both see no existing row and both insert one. There is no unique index (projectId, date) to enforce idempotency.

**Root cause:**
Architectural shortcut to avoid a DB migration.

**Code evidence:**
```
const existing = await this.prisma.projectSnapshot.findFirst({ where: { projectId: project.id, date: { gte: startOfDay } } }); if (existing) { return { created: false }; } ...
```

**Suggested fix:**
Add a unique partial index (projectId, date_trunc('day', date)) and convert the create into an upsert.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-014]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-019 — reorderSubtasks Promise.all updates can produce duplicate position values

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · async
- **File:** `apps/api/src/tasks/tasks.service.ts:1958`
- **Source:** `audits/agents/02-correctness.json#COR-019`

**Description:**
reorderSubtasks issues N parallel subtask.update({ position: index }) via Promise.all. Each statement runs as an independent transaction. Two concurrent reorder calls could leave the list in an inconsistent state.

**Root cause:**
Parallel updates without an ordered serial pass.

**Code evidence:**
```
await Promise.all(subtaskIds.map((id, index) => this.prisma.subtask.update({ where: { id }, data: { position: index } })));
```

**Suggested fix:**
Wrap in a single $transaction([...]) (sequential) or set positions to negative offsets first then to final values.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-019]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/tasks/tasks.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-024 — Bulk import does no transactional overlap-check, races with itself and with live API

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · concurrency
- **File:** `apps/api/src/leaves/leaves.service.ts:2625`
- **Source:** `audits/agents/02-correctness.json#COR-024`

**Description:**
importLeaves loads existingLeaves ONCE at the top and then iterates. If a user submits a new leave via the normal API while import is running, the import will not see it. A partial failure mid-file leaves a mix of created/uncreated rows with no rollback.

**Root cause:**
Imports were treated as best-effort batch, but the leaves domain has a strong overlap-uniqueness invariant.

**Code evidence:**
```
const existingLeaves = await this.prisma.leave.findMany(...); // outside any tx, then per-row loop with create
```

**Suggested fix:**
Wrap the iteration in $transaction; inside, after each create, append to existingLeaves so subsequent rows see the new state; on any unrecoverable error, abort the whole import.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-024]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-006 — Project.archive/unarchive: update + audit not atomic

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · transaction
- **File:** `apps/api/src/projects/projects.service.ts:655`
- **Source:** `audits/agents/03-data-integrity.json#DAT-006`

**Description:**
archive() does prisma.project.update(...archivedAt, archivedById...) and then await auditPersistence.log(...) outside a transaction. If the audit insert fails, the project is archived without trace.

**Root cause:**
Pattern of 'mutate then audit' without $transaction is standard across the codebase.

**Code evidence:**
```
projects.service.ts:655-666: update then auditPersistence.log, no $transaction.
```

**Suggested fix:**
prisma.$transaction(async tx => { await tx.project.update(...); await tx.auditLog.create({...}) }). Refactor AuditPersistenceService to accept optional tx parameter.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-006]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-024 — Create leave: $transaction lacks Serializable isolation despite race-window comment

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · transaction
- **File:** `apps/api/src/leaves/leaves.service.ts:438`
- **Source:** `audits/agents/03-data-integrity.json#DAT-024`

**Description:**
Comment explicitly says 'Isolation par défaut (ReadCommitted) suffit ici uniquement parce qu'on RE-LIT chaque allocation juste avant l'insert'. The re-read mitigation is reactive but does not eliminate the race. The comment dismisses Serializable due to retries — but no retry handler is wired.

**Root cause:**
Defensive coding without measured contention data; chose convenience.

**Code evidence:**
```
leaves.service.ts:438 await this.prisma.$transaction(async (tx) => { — no isolation option.
```

**Suggested fix:**
Either (a) wrap in $transaction with isolationLevel: Serializable and add one-shot retry on 40001; or (b) add advisory lock per (userId, leaveTypeId, year) via pg_advisory_xact_lock.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-024]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-018 — update() clients sync runs outside the project-update transaction

- **Status:** TODO
- **Phase:** 7
- **Cluster:** D
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · data_flow
- **File:** `apps/api/src/projects/projects.service.ts:587`
- **Source:** `audits/agents/02-correctness.json#COR-018`

**Description:**
The project row is updated, then projectClient.deleteMany + createMany are issued as a separate query pair, unwrapped from any tx. If the deleteMany succeeds and the createMany fails, the project ends up with no clients while the response says success.

**Root cause:**
Trade-off taken to avoid blocking the read-heavy /projects/:id response on the join table.

**Code evidence:**
```
// Sync clients hors transaction await this.prisma.projectClient.deleteMany({...}); if (clientIds.length > 0) { await this.prisma.projectClient.createMany({...}); }
```

**Suggested fix:**
Wrap project update + projectClient operations in a single $transaction block.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-018]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 8 — Date / TZ unification
*7 tasks in this phase.*

### COR-007 — getLeaveBalance uses local-TZ year window inconsistent with parisYearWindow

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · calendar
- **File:** `apps/api/src/leaves/leaves.service.ts:2054`
- **Source:** `audits/agents/02-correctness.json#COR-007`

**Description:**
balancesByType constructs yearStart = new Date(currentYear, 0, 1) and yearEnd = new Date(currentYear, 11, 31). On an API process running in UTC, these resolve to UTC midnight — NOT Paris midnight, and the endDate is INCLUSIVE 31 December 00:00 UTC so a leave starting later that day is missed. Furthermore the function sums the full leave.days column even when a leave crosses Dec 31→Jan 1.

**Root cause:**
Two parallel implementations of year-window accounting.

**Code evidence:**
```
const yearStart = new Date(currentYear, 0, 1); const yearEnd = new Date(currentYear, 11, 31); ... startDate: { gte: yearStart, lte: yearEnd }
```

**Suggested fix:**
Replace the local-TZ year window with parisYearWindow(currentYear) and aggregate usedDays/pendingDays via splitLeaveByYear.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-007]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-012 — expandRecurringRulesForRange uses local-TZ getDay across DST → can skip or duplicate a day

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · calendar
- **File:** `apps/api/src/telework/telework.service.ts:269`
- **Source:** `audits/agents/02-correctness.json#COR-012`

**Description:**
The expansion loop walks cursor.setDate(cursor.getDate() + 1) and reads cursor.getDay(). On a server in Europe/Paris, the spring-forward DST transition makes setDate(+1) produce a Date that is 23 hours later. Mixed local-TZ getDay() with UTC-anchored Date instances.

**Root cause:**
Date arithmetic mixes local-TZ getDay() with UTC-anchored Date instances. No formatInTimeZone / fromZonedTime as in the leave window.

**Code evidence:**
```
const jsDay = cursor.getDay(); ... cursor.setDate(cursor.getDate() + 1);
```

**Suggested fix:**
Normalise the cursor as a day-key string (YYYY-MM-DD) in Europe/Paris and compute weekday from that key. Store telework_schedule.date as @db.Date.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-012]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/telework/telework.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-013 — findByYear uses local-TZ year window; isNonWorkingHoliday relies on exact-instant key

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · calendar
- **File:** `apps/api/src/holidays/holidays.service.ts:52`
- **Source:** `audits/agents/02-correctness.json#COR-013`

**Description:**
findByYear computes startOfYear / endOfYear from new Date(year, 0, 1), TZ-dependent. isNonWorkingHoliday calls findUnique({ where: { date } }) which requires an exact timestamp match. The seed stores holidays as new Date(year, 0, 1) (local midnight). A consumer that builds new Date('2026-05-01') (UTC midnight) will not match.

**Root cause:**
date modelled as DateTime instead of a calendar date, and no canonical normalisation function shared by writers and readers.

**Code evidence:**
```
const startOfYear = new Date(year, 0, 1); ... return this.prisma.holiday.findUnique({ where: { date } });
```

**Suggested fix:**
Migrate Holiday.date to Postgres DATE (Prisma @db.Date), or normalise every read/write through a toUtcMidnight(yyyy-mm-dd) helper.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-013]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/holidays/holidays.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-026 — splitLeaveByYear reconciles weekend-only floor to startYear even when startYear has 0 weekdays

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/leaves/leave-year-window.ts:133`
- **Source:** `audits/agents/02-correctness.json#COR-026`

**Description:**
When a leave is entirely on weekends, calculateLeaveDays floors at 0.5; splitLeaveByYear credits the 0.5 shortfall to startYear. If the leave spans Dec 31 (Sat) → Jan 2 (Sun), the 0.5 is charged to startYear (2026) even though the leave actually crosses into 2027.

**Root cause:**
The floor recovery picks startYear as a default; no logic distributes the floor to the year that actually contains the most weekdays.

**Code evidence:**
```
if (expected > sum) { buckets.set(startYear, (buckets.get(startYear) ?? 0) + (expected - sum)); }
```

**Suggested fix:**
Credit the floor to the year that contains the START date only when the leave never enters another year; otherwise distribute proportional to span, or reject the leave with a clearer message.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-026]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leave-year-window.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-015 — User.email/login have no length cap and no citext / case-insensitive uniqueness

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:17`
- **Source:** `audits/agents/03-data-integrity.json#DAT-015`

**Description:**
email String @unique is TEXT with no length limit. 'Admin@Foo.com' and 'admin@foo.com' are two distinct rows by default Postgres collation.

**Root cause:**
TEXT default and case-sensitive equality.

**Code evidence:**
```
schema.prisma:19 email String @unique.
```

**Suggested fix:**
Either (a) convert email to CITEXT, or (b) add a functional unique index: CREATE UNIQUE INDEX users_email_lower_uk ON users (LOWER(email)). Same for login. Add VarChar(254) for email (RFC 5321).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-015]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-023 — Half-day validation in import uses getTime() comparison on YYYY-MM-DD parsing

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · edge_case
- **File:** `apps/api/src/leaves/leaves.service.ts:2563`
- **Source:** `audits/agents/02-correctness.json#COR-023`

**Description:**
validateLeavesImport rejects halfDay when startDate.getTime() !== endDate.getTime(). Works only if both parse to same instant. A CSV smuggling different ISO formats for same calendar day silently warns away half-day flag.

**Root cause:**
Instant comparison instead of calendar-day comparison.

**Code evidence:**
```
if (startDate.getTime() !== endDate.getTime()) { previewItem.status = 'warning'; ... }
```

**Suggested fix:**
Compare parisDayKey(startDate) === parisDayKey(endDate) (or the date-only ISO part).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-023]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-027 — TeleworkSchedule.date stored as full timestamp; unique index userId_date breaks on time-of-day drift

- **Status:** TODO
- **Phase:** 8
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · logic
- **File:** `apps/api/src/telework/telework.service.ts:61`
- **Source:** `audits/agents/02-correctness.json#COR-027`

**Description:**
create() does teleworkDate = new Date(date). DTO passing 2026-03-10 becomes UTC midnight; 2026-03-10T08:00:00+01:00 becomes a different instant. The unique constraint userId_date is on the full timestamp.

**Root cause:**
Calendar-day modelled as DateTime instead of DATE.

**Code evidence:**
```
const teleworkDate = new Date(date); const existing = await this.prisma.teleworkSchedule.findUnique({ where: { userId_date: { userId, date: teleworkDate } } });
```

**Suggested fix:**
Normalise via formatInTimeZone + fromZonedTime. Long-term: migrate the column to @db.Date.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-027]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/telework/telework.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 9 — Hot paths : indexes + N+1
*17 tasks in this phase.*

### PER-001 — Classic N+1 in analytics: per-project task fetch to recompute progress

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** performance · n_plus_one
- **File:** `apps/api/src/analytics/analytics.service.ts:145`
- **Source:** `audits/agents/04-performance.json#PER-001`

**Description:**
getProjects() runs projects.map(async p => calculateProjectProgress(p.id)) which fires one prisma.task.findMany({ where: { projectId } }) PER project. With 36 projects in the typical CPAM92 scope, this is 36+1 queries on every /analytics call, returning the same status columns already obtainable via a single groupBy. Each request also re-fetches tasks a SECOND time in getTasks() — full duplicate read of the entire task corpus.

**Root cause:**
Architectural: per-project async recompute pattern instead of a single SQL groupBy.

**Code evidence:**
```
return Promise.all(projects.map(async (project) => { const progress = await this.calculateProjectProgress(project.id); ... }));
```

**Suggested fix:**
Replace the .map(async) with a single prisma.task.groupBy({ by: ['projectId', 'status'], where: { projectId: { in: ids }, project: projectWhere } }) and compute progress from the resulting per-project status counts. Drop the duplicate getTasks().

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/analytics/analytics.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-002 — N+1 on leave balance: 2 queries per leave type

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** performance · n_plus_one
- **File:** `apps/api/src/leaves/leaves.service.ts:2046`
- **Source:** `audits/agents/04-performance.json#PER-002`

**Description:**
getLeaveBalance() iterates leaveTypes.map(async lt => { resolveAllocatedDays(...); prisma.leave.findMany(approved); prisma.leave.findMany(pending); }). With N leave types active (typically 5-10), this fires 2N parallel leave queries per user — every dashboard mount triggers ~16-20 queries. On a planning page that lists 50 users, this multiplies catastrophically.

**Root cause:**
Per-type async expansion instead of one groupBy on (leaveTypeId, status) for the user-year window.

**Code evidence:**
```
const balancesByType = await Promise.all(leaveTypes.map(async (lt) => { ... approvedLeaves = findMany(...); pendingLeaves = findMany(...); }))
```

**Suggested fix:**
Replace with prisma.leave.groupBy({ by: ['leaveTypeId', 'status'], where: { userId, startDate: { gte, lte }, status: { in: [APPROVED, CANCELLATION_REQUESTED, PENDING] } }, _sum: { days: true } }) then join in-memory.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-003 — Daily snapshot cron N+1: findFirst per project then create

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** performance · n_plus_one
- **File:** `apps/api/src/projects/projects.service.ts:983`
- **Source:** `audits/agents/04-performance.json#PER-003`

**Description:**
captureSnapshots() (called nightly) does projects.map(async p => prisma.projectSnapshot.findFirst({ projectId, date: { gte: startOfDay } })) then serial prisma.projectSnapshot.create(). For P active projects this is 2P queries inside Promise.all. With 100+ projects this hits the DB 200+ times.

**Root cause:**
Idempotency enforced in app code instead of via @@unique([projectId, dayBucket]) + createMany skipDuplicates.

**Code evidence:**
```
results = await Promise.all(projects.map(async (project) => { const existing = await prisma.projectSnapshot.findFirst(...); ... await prisma.projectSnapshot.create(...) }))
```

**Suggested fix:**
Fetch existing snapshots in one query, build set, then createMany({ data: filtered, skipDuplicates: true }). Add a unique index for true idempotency.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-003]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-007 — Planning overview multiplies unbounded subqueries

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** performance · pagination
- **File:** `apps/api/src/planning/planning.service.ts:66`
- **Source:** `audits/agents/04-performance.json#PER-007`

**Description:**
getOverview() requests usersService.findAll(1, 1000), servicesService.findAll(1, 1000), tasksService.findAll(1, 1000, …, startDate, endDate, …) — but tasksService.findAll DISABLES skip/take when a date filter is present, so the 1000 cap is bypassed: ALL tasks intersecting [start, end] are returned. Combined: a single planning load can pull thousands of tasks + 1000 users + 1000 services + leaves + telework + events + holidays + school-vacations + predefined assignments. Payload regularly multi-MB.

**Root cause:**
Planning overview was bolted on top of CRUD list endpoints rather than a purpose-built aggregated read model.

**Code evidence:**
```
Promise.all([ usersService.findAll(1, 1000), servicesService.findAll(1, 1000), tasksService.findAll(1, 1000, undefined, undefined, undefined, startDate, endDate, undefined, currentUser) ])
```

**Suggested fix:**
Introduce a dedicated /planning/overview SQL view or Prisma raw query returning only the minimal columns the grid needs.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-007]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/planning/planning.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-010 — Leave model has ZERO indexes — every leaves query is a seq scan

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** performance · index
- **File:** `packages/database/prisma/schema.prisma:569`
- **Source:** `audits/agents/04-performance.json#PER-010`

**Description:**
Model Leave defines no @@index at all. The service runs heavy queries filtered by userId, userId + leaveTypeId + status + startDate, validatorId, status IN (...), startDate <= end AND endDate >= start constantly. On a leaves table growing ~1 row/user/leave/year, this is the highest-traffic table for HR features and is fully unindexed.

**Root cause:**
Schema design oversight — indexes documented for TimeEntry, Task, PredefinedTask but skipped for Leave.

**Code evidence:**
```
model Leave { ... @@map("leaves") } — no @@index lines
```

**Suggested fix:**
Add: @@index([userId, startDate]), @@index([validatorId, status]), @@index([status, startDate]), @@index([userId, leaveTypeId, startDate]), @@index([startDate, endDate]).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-010]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-010 — Leave table missing indexes on hot query paths (userId+status+startDate, validatorId, status)

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · index
- **File:** `packages/database/prisma/schema.prisma:569`
- **Source:** `audits/agents/03-data-integrity.json#DAT-010`

**Description:**
Leave model has no @@index. Yet leaves.service queries by userId+status, validatorId+status (pending approvals queue), (startDate, endDate) overlap for planning, and status for dashboards. With every approved/pending leave row in one table, dashboards/calendar views require full-table scans.

**Root cause:**
Initial migration created no Leave indexes; subsequent migrations added columns without backfilling indexes.

**Code evidence:**
```
schema.prisma:569-598 — no @@index, no @@unique besides PK.
```

**Suggested fix:**
Add @@index([userId, status]), @@index([validatorId, status]), @@index([startDate, endDate]), @@index([leaveTypeId, status]).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-010]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-011 — Missing indexes on FK columns: Department.managerId, Service.{departmentId,managerId}, ProjectMember.userId, Comment.{taskId,authorId}, etc.

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · index
- **File:** `packages/database/prisma/schema.prisma:87`
- **Source:** `audits/agents/03-data-integrity.json#DAT-011`

**Description:**
Postgres does NOT auto-index foreign keys. Many FK columns lack indexes: Department.managerId, Service.departmentId, Service.managerId, Document.{projectId,uploadedBy}, Comment.{taskId,authorId}, Project.{createdById,managerId,sponsorId,archivedById}, Leave.{userId,leaveTypeId,validatorId,validatedById}, LeaveValidationDelegate.{delegatorId,delegateId}, Epic.projectId, Milestone.projectId, Holiday.createdById, Event.{projectId,createdById,parentEventId}.

**Root cause:**
Prisma does not generate indexes for fields:[...] automatically (only for @id and @unique).

**Code evidence:**
```
schema.prisma:96 Department.manager FK on managerId, no @@index([managerId]). Same pattern on Service, Comment, Document, Event, Epic, Milestone.
```

**Suggested fix:**
Audit every @relation(fields:[X]) and add @@index([X]) unless already covered by a composite. Run pg_stat_user_tables to confirm.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-011]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-004 — User listing default limit 1000 — effective unbounded

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · pagination
- **File:** `apps/api/src/users/users.service.ts:189`
- **Source:** `audits/agents/04-performance.json#PER-004`

**Description:**
findAll() signature (page = 1, limit = 20, ...) is overridden by Math.min(limit || 1000, 1000). PlanningService.getOverview calls usersService.findAll(1, 1000) returning up to 1000 users WITH role/department/userServices/managedServices joins, easily 5-20 KB per row → 5-20 MB payload per /planning hit.

**Root cause:**
Lack of contract on max page size; pagination uses 1000 fallback masking absence of pagination.

**Code evidence:**
```
const safeLimit = Math.min(limit || 1000, 1000);
```

**Suggested fix:**
Hard ceiling at 100 (or 200), require explicit opt-in. Planning view should request a directory-light shape via a dedicated endpoint.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-004]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-005 — Projects findAll default limit 1000 + N tasks per row

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · pagination
- **File:** `apps/api/src/projects/projects.service.ts:228`
- **Source:** `audits/agents/04-performance.json#PER-005`

**Description:**
Same 1000 ceiling. Each project row includes tasks: { select: { status: true } } (all tasks, unbounded) just to compute progress in JS. With 50 projects × 200 tasks = 10 000 task rows pulled per request only to count DONE/total. Also includes members: { take: 5 } but clients (no take) is unbounded.

**Root cause:**
Progress computed in app code instead of via projection or denormalized progress column.

**Code evidence:**
```
tasks: { select: { status: true } } ... progress: Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100)
```

**Suggested fix:**
Replace tasks include with prisma.task.groupBy. Or rely on the snapshot table.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-005]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-006 — Leaves findAll: 1000 default + unbounded when date filter present

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · pagination
- **File:** `apps/api/src/leaves/leaves.service.ts:639`
- **Source:** `audits/agents/04-performance.json#PER-006`

**Description:**
Same Math.min(limit || 1000, 1000) ceiling. Worse, when startDate/endDate are passed (planning use case) the controller returns the FULL filtered array, no pagination. The where condition triggers a sequential scan because neither startDate nor endDate is indexed (see PER-010).

**Root cause:**
Mixed return shape and 1000 cap; no hard ceiling for date-windowed queries.

**Code evidence:**
```
const safeLimit = Math.min(limit || 1000, 1000); ... if (startDate || endDate) { return enrichedLeaves; }
```

**Suggested fix:**
Force pagination even on date queries (cap 500 rows/page), expose ?format=stream if export needed. Split planning endpoint from CRUD list.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-006]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-009 — Leave import preview loads ALL active users + ALL pending/approved leaves

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · over_fetching
- **File:** `apps/api/src/users/users.service.ts:2409`
- **Source:** `audits/agents/04-performance.json#PER-009`

**Description:**
On CSV preview, the service does prisma.user.findMany({ where: { isActive: true } }) (no select projection — returns passwordHash) and prisma.leave.findMany({ status: { in: [PENDING, APPROVED] } }) over the whole history.

**Root cause:**
Bulk import wants global context, but pulls EVERYTHING into Node memory.

**Code evidence:**
```
const users = await this.prisma.user.findMany({ where: { isActive: true } }); ... const existingLeaves = await this.prisma.leave.findMany({ ... });
```

**Suggested fix:**
Project users to {id, email, firstName, lastName} only. Query overlap leaves filtered by the date span detected in the uploaded CSV (min..max).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-009]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-011 — User table missing indexes on isActive, departmentId, roleId

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · index
- **File:** `packages/database/prisma/schema.prisma:17`
- **Source:** `audits/agents/04-performance.json#PER-011`

**Description:**
User table is queried by isActive: true constantly (presence, analytics, workload, leaves import). Also by departmentId (organigramme), and roleId joins. None indexed.

**Root cause:**
Schema indexes were added selectively; common hot predicates missed.

**Code evidence:**
```
model User { ... @@map("users") } — no @@index
```

**Suggested fix:**
@@index([isActive]), @@index([departmentId]), @@index([roleId]) on User.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-011]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-012 — Event table missing indexes on date, projectId, createdById

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · index
- **File:** `packages/database/prisma/schema.prisma:880`
- **Source:** `audits/agents/04-performance.json#PER-012`

**Description:**
Events queries filter by date BETWEEN, projectId, createdById, participants.userId. None have an index. Every /planning hit calls events.findAll with a 6-month window — seq scan.

**Root cause:**
Same oversight as PER-010/011.

**Code evidence:**
```
model Event { ... date DateTime ... projectId String? ... createdById String ... @@map("events") }
```

**Suggested fix:**
@@index([date]), @@index([projectId]), @@index([createdById, date]). Add @@index([userId]) to EventParticipant.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-012]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-013 — Task missing indexes on endDate/startDate/milestoneId/epicId

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · index
- **File:** `packages/database/prisma/schema.prisma:276`
- **Source:** `audits/agents/04-performance.json#PER-013`

**Description:**
Task has only [projectId], [assigneeId], [status]. Planning queries filter on endDate >= and startDate <= heavily. milestoneId/epicId queries (mass updates) also unindexed.

**Root cause:**
Indexes only target single-column hot filters; composite date filters not anticipated.

**Code evidence:**
```
@@index([projectId]) @@index([assigneeId]) @@index([status])
```

**Suggested fix:**
Add @@index([endDate]), @@index([startDate]), @@index([milestoneId]), @@index([epicId]), @@index([projectId, status]).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-013]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-015 — Repeated service+managedService+userService pattern (4 queries) on every leaves list call

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · n_plus_one
- **File:** `apps/api/src/leaves/leaves.service.ts:102`
- **Source:** `audits/agents/04-performance.json#PER-015`

**Description:**
The trio managedServices + userServices + usersInServices appears 5 times for every leaves endpoint — for every request, the user's perimeter is recomputed from scratch via 3 SQL hits. Combined with PER-014, every leaves request triggers 4+ supplementary lookups before the main query.

**Root cause:**
No memoized AccessScope per request.

**Code evidence:**
```
const managedServices = await this.prisma.service.findMany({ where: { managerId: currentUserId } }); const userServices = await this.prisma.userService.findMany({ ... }); const usersInServices = await this.prisma.userService.findMany({ ... })
```

**Suggested fix:**
Cache the user's managedUserIds set on the request (REQUEST-scoped provider) or in Redis with 60s TTL. Better: a single SQL CTE/raw query computing the userIds in one round trip.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-015]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-016 — getUsersPresence loads 4 large tables in parallel without paging

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · over_fetching
- **File:** `apps/api/src/users/users.service.ts:1197`
- **Source:** `audits/agents/04-performance.json#PER-016`

**Description:**
Fetches ALL active users, ALL telework for the day, ALL approved leaves intersecting the day, ALL external tasks with nested assignees, ALL external events for the day with participants. Five unindexed queries fan out. For an org of 1500 users this is multi-MB on a feature that polls regularly.

**Root cause:**
Single endpoint denormalizes 5 sources; no incremental loading.

**Code evidence:**
```
users = findMany(isActive:true) ; teleworkSchedules = findMany(...) ; leaves = findMany(...) ; externalTasks = findMany(...) ; externalEvents = findMany(...)
```

**Suggested fix:**
Convert to a Postgres view or compute via raw query joining only the userIds with status (PRESENT/REMOTE/ABSENT/EXTERNAL).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-016]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-025 — Analytics projectProgressData / taskStatusData filter in JS over full task array

- **Status:** TODO
- **Phase:** 9
- **Cluster:** E
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · aggregation
- **File:** `apps/api/src/analytics/analytics.service.ts:277`
- **Source:** `audits/agents/04-performance.json#PER-025`

**Description:**
getProjectProgressData maps projects then tasks.filter(t => t.projectId === project.id).length — O(P × T) work in app code. getTaskStatusData runs 5 separate filter() passes. With T=10 000 tasks and P=100, a million comparisons per request.

**Root cause:**
Computing aggregates over a giant in-memory array instead of asking Postgres.

**Code evidence:**
```
projects.map(project => ({ ..., tasks: tasks.filter(t => t.projectId === project.id).length })); ...
```

**Suggested fix:**
Replace with prisma.task.groupBy({ by: ['projectId', 'status'], _count: true }) and assemble both views from a single grouped result.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-025]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/analytics/analytics.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 10 — Cascade vs conservation
*5 tasks in this phase.*

### DAT-007 — Task.projectId onDelete: Cascade — hard-delete of a Project nukes its TimeEntries, ProjectSnapshots, Documents — losing audit history

- **Status:** TODO
- **Phase:** 10
- **Cluster:** G
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · cascade
- **File:** `packages/database/prisma/schema.prisma:297`
- **Source:** `audits/agents/03-data-integrity.json#DAT-007`

**Description:**
Task.project → Cascade, ProjectSnapshot → Cascade, Document → Cascade, TimeEntry.project → SetNull but TimeEntry.task → SetNull. When a Project is hard-deleted, all snapshots, tasks, documents, epics, milestones are physically erased and TimeEntries lose their project link silently. audit_logs reference these projects only by string entityId with no FK — downstream rows are gone.

**Root cause:**
Cascade chosen for cleanup convenience; no soft-delete pattern for projects beyond archivedAt.

**Code evidence:**
```
schema.prisma:297 @relation(fields: [projectId], references: [id], onDelete: Cascade); projects.service.ts:704 hardDelete.
```

**Suggested fix:**
Either (a) remove the hard-delete endpoint entirely; or (b) change Task→Project to RESTRICT and require hardDelete to write a final snapshot to audit_logs.payload before cascade.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-007]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-008 — Leave.user onDelete: Cascade erases approved leave history when a user is deleted

- **Status:** TODO
- **Phase:** 10
- **Cluster:** G
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · cascade
- **File:** `packages/database/prisma/schema.prisma:592`
- **Source:** `audits/agents/03-data-integrity.json#DAT-008`

**Description:**
Leave.user → onDelete: Cascade, LeaveBalance.user → Cascade, TimeEntry.user → Cascade. Deleting a user wipes their entire approved leave history and time entries — but they remain in audit_logs (actorId SetNull) and on payslips/legal records. French Code du Travail requires conservation of leave records for 5 years.

**Root cause:**
Cascade chosen to simplify GDPR right-to-erasure but conflicts with retention obligations.

**Code evidence:**
```
schema.prisma:592 user User @relation("UserLeaves", ... onDelete: Cascade); schema.prisma:419 TimeEntry.user ... onDelete: Cascade.
```

**Suggested fix:**
Either deactivate users (isActive=false) and forbid hard delete, or change Leave.user → SetNull + add anonymized snapshot column. Document the retention policy.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-008]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-022 — User.departmentId nullable + onDelete:SetNull conflicts with RBAC scope checks

- **Status:** TODO
- **Phase:** 10
- **Cluster:** G
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:28`
- **Source:** `audits/agents/03-data-integrity.json#DAT-022`

**Description:**
RBAC depends on department/service membership. User.department is onDelete: SetNull: deleting a department silently strips all its users to no-department state. RBAC scope checks then return empty results without raising — a manager loses visibility on their team.

**Root cause:**
SetNull chosen to avoid migration friction; no business signal raised.

**Code evidence:**
```
schema.prisma:37 Department? @relation("DepartmentUsers", fields:[departmentId], references:[id], onDelete: SetNull).
```

**Suggested fix:**
Change to Restrict, force operator to reassign users first; or fire an audit_logs row from a trigger when a department deletion sets users to null.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-022]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-025 — Document model: no integrity hash, no soft-delete, no FK on uploadedBy

- **Status:** TODO
- **Phase:** 10
- **Cluster:** G
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:737`
- **Source:** `audits/agents/03-data-integrity.json#DAT-025`

**Description:**
Document.uploadedBy String is just a string — no @relation to User, no FK. A user deletion does not nullify or cascade. url/mimeType have no length cap. No checksum/hash column.

**Root cause:**
Documents module bolted on without integrating with User domain.

**Code evidence:**
```
schema.prisma:737-751 Document: uploadedBy String with no @relation.
```

**Suggested fix:**
Add uploadedBy User @relation(fields:[uploadedBy], references:[id], onDelete: SetNull) and @@index([uploadedBy]). Add contentSha256 column. Add deletedAt for soft-delete.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-025]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-026 — User has no @@index on (isActive) and no soft-delete column

- **Status:** TODO
- **Phase:** 10
- **Cluster:** G
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:17`
- **Source:** `audits/agents/03-data-integrity.json#DAT-026`

**Description:**
Users are deactivated via isActive: false but the model has no @@index([isActive]) and no deletedAt. A 'deletion' is therefore either a hard delete (which cascades Leave/TimeEntry/Comment/PersonalTodo) or an isActive toggle. No DB constraint prevents writes referencing inactive users.

**Root cause:**
Mixed deactivation/deletion model with no soft-delete pattern.

**Code evidence:**
```
schema.prisma:17-81 User: no @@index, no deletedAt.
```

**Suggested fix:**
Add deletedAt DateTime? and @@index([deletedAt]). Add @@index([isActive]). Replace hard delete with soft delete + anonymization (RGPD).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-026]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 11 — Tests : suppression du théâtre
*12 tasks in this phase.*

### TST-003 — Security E2E for telework cross-user IDOR is entirely skipped

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · skipped
- **File:** `e2e/tests/security/telework-ownership.spec.ts:17`
- **Source:** `audits/agents/06-tests.json#TST-003`

**Description:**
The whole telework-ownership suite is a single test.skip("cross-user TTV modification returns 403", () => { /* Implemented in Wave 5 ownership-idor.spec.ts */ });. A skipped security test reads green in CI but exercises nothing here.

**Root cause:**
Test left as a placeholder after the implementation moved to ownership-idor.spec.ts; never deleted.

**Code evidence:**
```
e2e/tests/security/telework-ownership.spec.ts:17 — test.skip("cross-user TTV modification returns 403", () => {})
```

**Suggested fix:**
Delete the placeholder file. If kept for traceability, convert it to a documented index file with no test.skip().

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-003]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/security/telework-ownership.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-004 — Leave lifecycle E2E does not verify balance debit — final assertion is a tautology

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · e2e_gap
- **File:** `e2e/tests/multi-role/leave-lifecycle.spec.ts:180`
- **Source:** `audits/agents/06-tests.json#TST-004`

**Description:**
The single 'create → approve → confirm status' lifecycle test ends with expect(isApproved || contributeurPage.url().includes("/leaves")).toBeTruthy();. The right operand is true by construction — the test reload()-ed /leaves, so the URL always contains /leaves. The OR therefore passes even when no approval occurred. The test never reads /api/leaves/balance before and after to assert days were debited.

**Root cause:**
Soft assertion pattern used to keep the test green when seed data is missing.

**Code evidence:**
```
expect(isApproved || contributeurPage.url().includes("/leaves")).toBeTruthy(); contributeurPage.url() is set by reload() of /leaves on line 168-169
```

**Suggested fix:**
Query GET /api/leaves/balance for the CP type before submission; submit a 2-day CP leave via API, capture initial used/remaining; have manager approve via API; reread balance and assert used += 2.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-004]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/multi-role/leave-lifecycle.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-005 — leaves.spec.ts contains zero negative-path assertions and no balance/approve coverage

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · e2e_gap
- **File:** `e2e/tests/workflows/leaves.spec.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-005`

**Description:**
Workflow file for leaves has 3 tests, all positive: page loads, tab visible, contributeur can open the modal. There is no test that (a) submits a leave and verifies API response, (b) tests OBSERVATEUR/REFERENT receive 403 on POST /api/leaves, (c) verifies balance after approval, (d) verifies reject flow, (e) verifies cancel flow. The file comments that OBSERVATEUR sees the button and the API returns an error — but never asserts that the error is in fact 403.

**Root cause:**
Tests written as UI smoke only, not as feature verification.

**Code evidence:**
```
e2e/tests/workflows/leaves.spec.ts contains only 'user can see the leave page', 'user can see Mes demandes tab', 'CONTRIBUTEUR can open creation form', and 'OBSERVATEUR — page loads'. No POST, PATCH, /approve, /reject, /balance
```

**Suggested fix:**
For each forbidden role in the matrix, POST /api/leaves and assert 403. For approve/reject/cancel, drive the API and assert status transitions + audit_logs row.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-005]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/workflows/leaves.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-006 — 8 tests in tasks page test are it.skip with TODO comments — silent rot

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · skipped
- **File:** `apps/web/app/[locale]/tasks/__tests__/page.test.tsx:284`
- **Source:** `audits/agents/06-tests.json#TST-006`

**Description:**
L284-501: it.skip('should display project filter'), ('should display priority filter'), ('should filter tasks by project'), ('should display priority badge with correct color'), ('should create task and show success message'), ('should display assignee information'), ('should display project name on task card'), ('should show error toast on fetch failure'). All have TODO comments. Same pattern in users page tests (3 skipped) and export.service.test.ts (3 PDF tests skipped).

**Root cause:**
Skips used as TODO trackers; never resurfaced.

**Code evidence:**
```
14 it.skip in apps/web (8 tasks, 3 users, 3 export); rationale: TODO comments left in code
```

**Suggested fix:**
Fix the label-input associations (semantic <label htmlFor>) and re-enable; for jspdf, mock at module boundary not deep API. Promote skips older than 30 days to GitHub issues and delete from the suite.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-006]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/web/app/[locale]/tasks/__tests__/page.test.tsx
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-007 — Security IDOR tests rely on beforeAll-created IDs and skip with 'creation failed in beforeAll' — green when broken

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · test_data
- **File:** `e2e/tests/security/ownership-idor.spec.ts:100`
- **Source:** `audits/agents/06-tests.json#TST-007`

**Description:**
ownership-idor.spec.ts has at least 18 test.skip(!projectId, 'Project creation failed in beforeAll')-style guards. If beforeAll silently fails (race, throttled, seed missing), every dependent test passes via skip — the security suite reports green while never running the cross-user 403 assertions.

**Root cause:**
beforeAll-then-skip pattern hides setup failures. Same pattern in time-tracking-scope, auth-reset-password, users-create-hierarchy.

**Code evidence:**
```
grep test.skip(!.*Id e2e/tests/security/ownership-idor.spec.ts → 18 occurrences; identical pattern in time-tracking-scope.spec.ts and auth-reset-password.spec.ts
```

**Suggested fix:**
Replace test.skip(!id, …) with expect(id).toBeDefined() so the assertion fails when setup fails; or move setup into the test itself so a setup failure is a test failure, not a skip.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-007]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/security/ownership-idor.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-009 — Leaves service spec relies on hand-rolled $transaction mock that re-feeds the same mock object

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · mock_abuse
- **File:** `apps/api/src/leaves/leaves.service.spec.ts:50`
- **Source:** `audits/agents/06-tests.json#TST-009`

**Description:**
$transaction: vi.fn(<T>(cb) => cb(mockPrismaService)) short-circuits the transaction primitive: the gate-and-write atomicity is never exercised — the callback runs on the same mock that already returned the gate result. Tests cannot detect a real bug where the second-read inside the transaction returns a different value. The 3,377-line spec therefore validates that the code calls Prisma the way the test expects, not that the transaction enforces serializability.

**Root cause:**
Convenience: faking $transaction by forwarding the host client lets existing per-call mocks keep working, at the cost of disabling tx semantics.

**Code evidence:**
```
leaves.service.spec.ts L82-87: $transaction: vi.fn(<T>(cb) => cb(mockPrismaService)) — re-feeds host mock as tx client
```

**Suggested fix:**
Add at least one Prisma-integration spec (real Postgres or pg-mem) that exercises the actual SERIALIZABLE/READ-COMMITTED behaviour for balance gating; keep the mock-based tests for branching logic.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-009]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-010 — Export service Excel tests assert createObjectURL/click/revokeObjectURL — testing browser stubs, not output

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · mock_abuse
- **File:** `apps/web/src/services/__tests__/export.service.test.ts:115`
- **Source:** `audits/agents/06-tests.json#TST-010`

**Description:**
L116-118: expect(createObjectURL).toHaveBeenCalled(); expect(click).toHaveBeenCalled(); expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');. There is no assertion on the Excel content — number of sheets, rows, headers. A regression that writes an empty workbook passes. The 3 PDF tests are skipped entirely, so PDF export is untested.

**Root cause:**
Difficulty of asserting binary output led to asserting on the side-effect mocks instead.

**Code evidence:**
```
export.service.test.ts L116-118 — three assertions all about Blob plumbing; L94-110 — 3 PDF tests skipped
```

**Suggested fix:**
Capture the Blob passed to createObjectURL, decode the xlsx with read() from xlsx lib, assert sheet names, headers, row count. For PDF, capture the buffer and assert page count and a text marker via pdf-parse.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-010]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/web/src/services/__tests__/export.service.test.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-013 — RBAC API permission test uses expect().not.toBe(403) — passes on 404/500 as 'authorized'

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · permission_matrix
- **File:** `e2e/tests/rbac/api-permissions.spec.ts:105`
- **Source:** `audits/agents/06-tests.json#TST-013`

**Description:**
The allowed-role branch asserts expect(response.status()).not.toBe(403). This passes for 404 (resource missing), 400 (DTO failure), 500 (server error) — only an explicit 403 fails. Half of the tests run against PLACEHOLDER_UUID so the happy expectation in practice is 404, not 200/201/204. A regression where the guard was disabled but the controller throws 500 stays green.

**Root cause:**
Generic test harness across heterogeneous endpoints; chose loose 'not 403' to avoid per-endpoint expected-status maintenance.

**Code evidence:**
```
api-permissions.spec.ts L105 expect(response.status(), …).not.toBe(403); placeholder UUID by design returns 404 for most reads
```

**Suggested fix:**
Add expectedStatus per matrix entry (200/201/204/404) and tighten the assertion. At minimum, also assert < 500 and != 401.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-013]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/rbac/api-permissions.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-014 — Root e2e/permissions.spec.ts contains test.skip() and UI logins — duplicates and pollutes the structured RBAC matrix

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · e2e_gap
- **File:** `e2e/permissions.spec.ts:96`
- **Source:** `audits/agents/06-tests.json#TST-014`

**Description:**
e2e/permissions.spec.ts L96, L114, L152: test.skip() because 'requires a user user that doesn't exist'. L104/L143: UI login via page.locator('input[id="password"]').fill('user123') — direct violation of CLAUDE.md 'auth via API (never UI login in tests)'. Same file has expect(true).toBeTruthy() no-op at L87. e2e/auth.spec.ts L17/L31 and e2e/helpers.ts also use UI login.

**Root cause:**
Pre-Wave-1 legacy tests never deleted when the structured permission-matrix harness landed.

**Code evidence:**
```
e2e/permissions.spec.ts L96/114/152 test.skip(); L104/143 UI password fill; L87 expect(true).toBeTruthy()
```

**Suggested fix:**
Delete e2e/permissions.spec.ts and e2e/auth.spec.ts; refactor any genuinely missing scenarios into e2e/tests/rbac/.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-014]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/permissions.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-015 — Gantt suites pass via cascading test.skip — seed-shape dependent

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · e2e_gap
- **File:** `e2e/tests/gantt/gantt-project.spec.ts:60`
- **Source:** `audits/agents/06-tests.json#TST-015`

**Description:**
gantt-project.spec.ts and gantt-portfolio.spec.ts have ~24 test.skip(!isGanttVisible, …) / test.skip(!hasGroupBy, …) / test.skip(taskCount === 0, …) guards. If the seed produces zero gantt-eligible tasks (which is data-shape dependent), the entire Gantt assertion surface evaporates silently in CI. activity-grid-add-users.spec.ts and dashboard-quick-entry.spec.ts have the same pattern.

**Root cause:**
Skip-on-empty-data instead of seed-driven fixtures: tests adapt to whatever the seed produces.

**Code evidence:**
```
gantt-project.spec.ts: test.skip on lines 67, 93, 104, 137, 148, 197, 208, 245, 256, 261, 269, 302, 313, 320, 334; gantt-portfolio.spec.ts: lines 42, 69, 80, 117, 128, 164, 175, 207, 218, 223, 237, 248, 275
```

**Suggested fix:**
Provision the data the test needs in beforeAll via API; fail the test (not skip) when the API rejects setup. Stop trusting seed shape.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-015]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/gantt/gantt-project.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-017 — E2E DB is not reset between runs and is seeded once — test data leaks across spec files

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · test_data
- **File:** `.github/workflows/ci.yml:178`
- **Source:** `audits/agents/06-tests.json#TST-017`

**Description:**
ci.yml seeds the e2e DB once before starting the API. The Playwright runs are parallel (workers: 4) and many tests create rows with uniqueLabel('E2E-' + Date.now()) but only best-effort cleanup. Cross-spec dependencies on existence-of-CP-type-with-non-null balance, and on seed-shape Gantt tasks, make tests order-sensitive. The leave-balance-gating spec creates balances in years 2030/2031 to escape collisions — proof that isolation isn't real.

**Root cause:**
No per-test/per-file transaction or truncate. Cleanup is best-effort and async.

**Code evidence:**
```
ci.yml L178 db:seed runs once; leave-balance-gating.spec.ts L164/175 picks 2030/2031 to avoid collisions; multiple specs have try { … delete … } catch { /* ignore */ }
```

**Suggested fix:**
Either wrap each E2E spec in a savepoint via a dedicated test endpoint, or run prisma migrate reset && seed between Playwright projects. At minimum, fail tests whose afterAll cleanup throws.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-017]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (config change, no automated test)
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-019 — Auth controller spec asserts toHaveBeenCalledWith for thin pass-throughs — tests the mock, not behavior

- **Status:** TODO
- **Phase:** 11
- **Cluster:** H
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · mock_abuse
- **File:** `apps/api/src/auth/auth.controller.spec.ts:90`
- **Source:** `audits/agents/06-tests.json#TST-019`

**Description:**
10+ assertions of the shape expect(mockAuthService.login).toHaveBeenCalledWith(...), expect(mockAuthService.getPermissionsForUser).toHaveBeenCalledWith(...). The controller is a one-line forwarder; asserting the call signature pins the implementation but doesn't add behavioral coverage. Same pattern in analytics.controller.spec.ts and leaves.controller.spec.ts.

**Root cause:**
Controller specs written by reflex without modelling DTO validation, guard composition, or response shaping.

**Code evidence:**
```
auth.controller.spec.ts L93/108/130/164/176/205/224/281/309/340/359 — all toHaveBeenCalledWith on the mock service
```

**Suggested fix:**
For each controller, either remove these specs or repurpose them to test DTO validation pipes (e.g., assert 400 on missing field) and response transformation. Use supertest/Nest TestingModule with a real ValidationPipe.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-019]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.controller.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 12 — Frontend : couche données partagée
*7 tasks in this phase.*

### OBS-016 — 112 console.* calls in frontend with no client logger or scrubbing

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · logging
- **File:** `apps/web/src:1`
- **Source:** `audits/agents/05-observability.json#OBS-016`

**Description:**
grep counts 112 console.log/console.error sites under apps/web/src and apps/web/app (excluding tests). No central client logger, no environment guard, no PII scrubbing. In production these emit user data to browser console. No client-side error reporter to capture frontend exceptions.

**Root cause:**
No frontend observability layer.

**Code evidence:**
```
grep -rn 'console\.' apps/web/src apps/web/app --include='*.ts*' | grep -v test | wc -l → 112
```

**Suggested fix:**
Introduce apps/web/src/lib/logger.ts wrapping console with NODE_ENV guard + structured tagging; ESLint no-console rule (warn); wire Sentry/PostHog for client errors.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-016]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/src
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-017 — Dashboard does 3 sequential client-side fetches in one useEffect — render storm + waterfall

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · frontend_render
- **File:** `apps/web/app/[locale]/dashboard/page.tsx:243`
- **Source:** `audits/agents/04-performance.json#PER-017`

**Description:**
useEffect dependency on [user] triggers fetchData which serially fetches projectsService.getByUser, tasksService.getByAssignee, tasksService.getMyDoneUndeclared (3 awaited round-trips, not Promise.all). The page is 'use client' so not SSR'd. No TanStack Query, no cache between navigations.

**Root cause:**
Convention of 'use client' + useEffect + axios instead of RSC + server fetch or TanStack Query.

**Code evidence:**
```
useEffect(() => { const fetchData = async () => { ... projects = await projectsService.getByUser(...); tasks = await tasksService.getByAssignee(...); undeclared = await tasksService.getMyDoneUndeclared(); ... }; }, [user]);
```

**Suggested fix:**
Promise.all the three independent fetches. Better: convert to a server component. Or migrate to TanStack Query with staleTime ≥ 30s.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-017]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/app/[locale]/dashboard/page.tsx
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-018 — Projects page has 4 stacked useEffect with overlapping data fetches

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · frontend_render
- **File:** `apps/web/app/[locale]/projects/page.tsx:133`
- **Source:** `audits/agents/04-performance.json#PER-018`

**Description:**
4 useEffect blocks (lines 133, 138, 146, 158) — classic effect-chain. Each one's setState retriggers downstream effects, causing N renders per page mount. No TanStack Query.

**Root cause:**
Effects used as data-flow orchestrator; should be Query keys or RSC fetches.

**Code evidence:**
```
apps/web/app/[locale]/projects/page.tsx:133:  useEffect(() => { ... 138: useEffect(... ; 146: useEffect(...; 158: useEffect(...
```

**Suggested fix:**
Audit each useEffect for true side-effect vs derived state. Convert all data-loading effects to useQuery with proper keys.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-018]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/app/[locale]/projects/page.tsx
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-019 — TanStack Query barely used (3 components total) — no client-side cache

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · frontend_render
- **File:** `apps/web/app/[locale]/dashboard/page.tsx:243`
- **Source:** `audits/agents/04-performance.json#PER-019`

**Description:**
Grep across apps/web for useQuery|staleTime returns hits only in 3 advanced reports components. All other pages use raw axios + useEffect + useState. Every page mount refetches, no dedup, no background revalidation, no cross-page sharing.

**Root cause:**
TanStack Query was added late and never globally rolled out.

**Code evidence:**
```
grep -rn 'staleTime|useQuery' apps/web → only 3 files, all under reports/components/advanced
```

**Suggested fix:**
Standardize on TanStack Query for ALL list/detail endpoints. Set sensible defaults (staleTime 30-60s, retry 1). Provide useUsers/useProjects/useTasks hooks layer.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-019]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/app/[locale]/dashboard/page.tsx
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-020 — next.config.ts has no image domains, no bundle optimization, no analyzer

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · bundle
- **File:** `apps/web/next.config.ts:1`
- **Source:** `audits/agents/04-performance.json#PER-020`

**Description:**
Config is minimal: only sets standalone output and security headers. No images config, no experimental.optimizePackageImports, no modularizeImports for icon/util libraries, no @next/bundle-analyzer.

**Root cause:**
Config never tuned beyond defaults.

**Code evidence:**
```
const nextConfig: NextConfig = { output: 'standalone', devIndicators: false, async headers() { ... } };
```

**Suggested fix:**
Add experimental.optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns']. Wire up @next/bundle-analyzer.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-020]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/next.config.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-028 — Planning grid components: 17 useEffect vs only 20 useMemo/useCallback across the planning folder

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** performance · frontend_render
- **File:** `apps/web/src/components/planning/PlanningGrid.tsx:1`
- **Source:** `audits/agents/04-performance.json#PER-028`

**Description:**
Ratio suggests row-level rendering may not be memoized. Gantt-like grids with N users × M days × event lookups need stable references. Without row-level React.memo + stable selectors, every store update repaints the entire grid.

**Root cause:**
Component composition not optimized for big-grid rendering.

**Code evidence:**
```
grep useEffect in apps/web/src/components/planning → 17 ; grep React.memo|useMemo|useCallback → 20
```

**Suggested fix:**
Wrap DayCell, row, and group-header in React.memo with shallow-equal props. Move derived per-cell state into useMemo. Profile with React DevTools Profiler.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-028]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/src/components/planning/PlanningGrid.tsx
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-021 — Only GanttChart is code-split — analytics dashboards loaded eagerly

- **Status:** TODO
- **Phase:** 12
- **Cluster:** I
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** suggestion
- **Category:** performance · bundle
- **File:** `apps/web/app/[locale]/projects/[id]/page.tsx:41`
- **Source:** `audits/agents/04-performance.json#PER-021`

**Description:**
Grep finds exactly ONE next/dynamic usage. Reports/AdvancedAnalyticsTab, PortfolioGantt, PlanningView are heavy yet imported statically.

**Root cause:**
No systematic split policy for heavy/optional UI.

**Code evidence:**
```
grep -rn 'dynamic(' apps/web → only apps/web/app/[locale]/projects/[id]/page.tsx:49
```

**Suggested fix:**
Wrap heavy chart/grid/Gantt components in dynamic(() => import(...), { ssr: false }). Audit imports >50 KB gzipped via bundle analyzer.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-021]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/app/[locale]/projects/[id]/page.tsx
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---

## Phase 13 — Findings hors cluster — à traiter en parallèle des autres phases
*59 tasks in this phase.*

### COR-005 — findValidatorForUser ignores the link between the leave's user and the active delegation

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** correctness · logic
- **File:** `apps/api/src/leaves/leaves.service.ts:579`
- **Source:** `audits/agents/02-correctness.json#COR-005`

**Description:**
When picking an active delegate, the query filters only by isActive, date window and delegator.role.code IN (delegatorRoles). It does NOT scope to the delegation that covers the leave's user. The first active delegate created by ANY user with a delegating role wins. A delegate set up by a manager of department B can become the de-facto validator for a user in department A.

**Root cause:**
The legacy 'global manager' assumption was carried over into the multi-department world; the delegate lookup never joined back to the leave's user's department/services.

**Code evidence:**
```
const activeDelegate = await this.prisma.leaveValidationDelegate.findFirst({ where: { ...(delegatorRoles.length > 0 && { delegator: { role: { code: { in: delegatorRoles } } } }), isActive: true, ... }, ... });
```

**Suggested fix:**
Determine the would-be validator first (department.managerId), then look up an active delegation for THAT delegator. Only fall back to a generic delegate if the user has no manager. Add a test that creates two delegations and asserts cross-team isolation.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-005]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-002 — Three first-class API modules have no service spec at all

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · coverage_gap
- **File:** `apps/api/src:1`
- **Source:** `audits/agents/06-tests.json#TST-002`

**Description:**
leave-types, personal-todos, settings have no *.service.spec.ts. settings exposes settings:update which is the keystone of ADMIN-only; personal-todos has the hard-coded 20-item limit pitfall; leave-types feeds leave creation flows. Also missing controller specs: holidays, leave-types, personal-todos, settings, school-vacations (service test exists), projects-third-party-members, tasks-third-party-assignees, planning, rbac/roles, projects-clients, analytics-advanced, app.

**Root cause:**
Module specs never created when modules were extracted/created.

**Code evidence:**
```
find apps/api/src -name '*.service.ts' diff *.service.spec.ts: missing leave-types, personal-todos, settings, access-scope, role-hierarchy; missing controller spec for holidays, leave-types, personal-todos, settings, school-vacations, planning, roles, analytics-advanced, third-parties bridges
```

**Suggested fix:**
Add at minimum service specs for settings (singleton config, partial update, ADMIN-only), personal-todos (20-item ceiling), leave-types (CRUD + soft-archive). Add controller specs for analytics-advanced and projects-clients/projects-third-party-members.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — derive test from finding description for apps/api/src
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-008 — Comments service spec is 100% happy-path — no negative tests, no ownership checks

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** tests · missing_negative
- **File:** `apps/api/src/comments/comments.service.spec.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-008`

**Description:**
The file has 4 it() blocks (create OK, findAll OK, update OK, remove OK). It does not test: (a) NotFoundException on update/remove of inexistent comment, (b) ForbiddenException when a non-author non-admin tries to update/delete, (c) update/remove permission propagation for ADMIN bypass, (d) findAll with empty taskId or unauthorized scope. With 0 throws-expectations, the suite green-lights any regression.

**Root cause:**
Service spec written as smoke test without modelling business rules.

**Code evidence:**
```
apps/api/src/comments/comments.service.spec.ts: 9 describe/it total, 0 .rejects.toThrow, 0 ForbiddenException assertions
```

**Suggested fix:**
Add at minimum: 4 negative cases (notFound update, notFound remove, forbidden non-author update, forbidden non-admin remove) and assert authorId vs userId branches.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-008]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/comments/comments.service.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-004 — cancel() overwrites APPROVED with REJECTED, conflating semantics

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · state_machine
- **File:** `apps/api/src/leaves/leaves.service.ts:1608`
- **Source:** `audits/agents/02-correctness.json#COR-004`

**Description:**
LeavesService.cancel transitions an APPROVED or CANCELLATION_REQUESTED leave to status REJECTED. REJECTED is the status produced by reject() (refused by validator), so a self-cancellation and a manager rejection become indistinguishable in the audit/report flow. Additionally, validatedById / validatedAt / validationComment are NOT updated on cancellation — the row keeps the original validator's metadata.

**Root cause:**
No dedicated CANCELLED status in the LeaveStatus enum; the cancel path was implemented as a soft 'refusal' to reuse the REJECTED bucket.

**Code evidence:**
```
data: { status: LeaveStatus.REJECTED }, // in cancel()
```

**Suggested fix:**
Add CANCELLED to LeaveStatus, transition to it instead of REJECTED, include CANCELLED in the same exclusion bucket as REJECTED inside getAvailableDays. Stamp validatedById/At with the cancelling actor and emit an audit log entry (LEAVE_CANCELLED).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-004]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-006 — update() destructures endHalfDay but never applies it

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · edge_case
- **File:** `apps/api/src/leaves/leaves.service.ts:1145`
- **Source:** `audits/agents/02-correctness.json#COR-006`

**Description:**
In update, endHalfDay is destructured with an eslint-disable no-unused-vars and then passed as undefined to calculateLeaveDays and splitLeaveByYear. A user editing a multi-day leave who tries to change the afternoon-only flag on the end day will have the change silently dropped.

**Root cause:**
Half-day handling was reworked in Wave 4/5 around startHalfDay/halfDay only; endHalfDay was left as a deferred field but kept on the DTO.

**Code evidence:**
```
const { type, startDate, endDate, halfDay, startHalfDay, /* eslint-disable-next-line no-unused-vars */ endHalfDay, reason } = updateLeaveDto;
```

**Suggested fix:**
Either remove endHalfDay from UpdateLeaveDto, or thread it through.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-006]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-010 — checkOverlap omits CANCELLATION_REQUESTED, allowing later phantom conflicts

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · edge_case
- **File:** `apps/api/src/leaves/leaves.service.ts:2298`
- **Source:** `audits/agents/02-correctness.json#COR-010`

**Description:**
checkOverlap searches only PENDING and APPROVED. A leave in CANCELLATION_REQUESTED is treated as 'free space'. If rejectCancellation later restores the leave to APPROVED, the user now has two overlapping leaves.

**Root cause:**
checkOverlap was last updated when CANCELLATION_REQUESTED was added but the status set was not extended.

**Code evidence:**
```
const where: Prisma.LeaveWhereInput = { userId, status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] }, OR: [...] };
```

**Suggested fix:**
Include LeaveStatus.CANCELLATION_REQUESTED in the status in list, both in checkOverlap and in the import-overlap detection.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-010]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-011 — findAll returns array when filtered by date — breaks pagination contract and totalCount

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/leaves/leaves.service.ts:716`
- **Source:** `audits/agents/02-correctness.json#COR-011`

**Description:**
When startDate or endDate is provided, findAll returns enrichedLeaves directly (array). Callers that used result.data get undefined; callers that destructure meta.totalPages break. The safeLimit cap of 1000 is still applied but no meta.total is surfaced — callers cannot know whether they got the full set.

**Root cause:**
Special-cased return shape to keep backwards compatibility with the original planning consumer.

**Code evidence:**
```
if (startDate || endDate) { return enrichedLeaves; } return { data: enrichedLeaves, meta: {...} };
```

**Suggested fix:**
Either return { data, meta } uniformly and have the planning service unwrap, or set take: undefined when a date filter is provided.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-011]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-015 — Project date validation: create uses <= (rejects same-day), tasks uses < (accepts) — inconsistent

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/projects/projects.service.ts:88`
- **Source:** `audits/agents/02-correctness.json#COR-015`

**Description:**
projects.create rejects endDate <= startDate, so a one-day project is impossible. tasks.create rejects only endDate < startDate, so same-day tasks work.

**Root cause:**
Two different authors, two different intuitions of inclusivity; no shared date-range validator.

**Code evidence:**
```
projects.service.ts: if (endDate && startDate && new Date(endDate) <= new Date(startDate)) throw ...; vs tasks.service.ts: if (startDate && endDate && new Date(endDate) < new Date(startDate)) throw ...
```

**Suggested fix:**
Pick one convention (likely < for both) and centralise the check in a DateRangeDto.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-015]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-016 — Soft-delete (CANCELLED) project can be revived via update without restriction

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · state_machine
- **File:** `apps/api/src/projects/projects.service.ts:633`
- **Source:** `audits/agents/02-correctness.json#COR-016`

**Description:**
remove() sets status to CANCELLED. There is no guard in update() that prevents a subsequent PATCH from setting status back to ACTIVE/DRAFT. A cancelled project can be revived inadvertently. Archived projects also can still be mutated freely.

**Root cause:**
Soft-delete was implemented as a plain status value with no transition rules.

**Code evidence:**
```
async remove(id, user?) { ... await this.prisma.project.update({ where: { id }, data: { status: ProjectStatus.CANCELLED } }); ... }
```

**Suggested fix:**
In update(), reject the request if existingProject.status === CANCELLED and the new status would leave CANCELLED unless an explicit restore endpoint is introduced.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-016]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-017 — getProjectsByUser ignores archived filter — surfaces archived projects

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · data_flow
- **File:** `apps/api/src/projects/projects.service.ts:878`
- **Source:** `audits/agents/02-correctness.json#COR-017`

**Description:**
Unlike findAll, getProjectsByUser does not call archivedWhere(...). A user's 'My projects' page will list projects archived months ago, mixed with active ones.

**Root cause:**
Two listing endpoints implemented at different times; archive filter was added to findAll but never back-ported.

**Code evidence:**
```
const where: any = { members: { some: { userId } } }; // no archivedWhere
```

**Suggested fix:**
Add an archived: ArchivedFilter = ArchivedFilter.ACTIVE parameter and ...archivedWhere(archived) into the where clause.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-017]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-021 — leaveTypeConfig.code → LeaveType enum fallback silently masks misconfiguration

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/leaves/leaves.service.ts:412`
- **Source:** `audits/agents/02-correctness.json#COR-021`

**Description:**
enumType falls back to LeaveType.OTHER whenever the LeaveTypeConfig.code is not present in the LeaveType enum. A newly seeded type with an unknown code lands in OTHER, and downstream dashboards that group by type (the enum) silently merge unrelated types.

**Root cause:**
Dual source of truth (enum + table) without a hard reconciliation rule.

**Code evidence:**
```
const enumType = validEnumTypes.includes(leaveTypeConfig.code as LeaveType) ? (leaveTypeConfig.code as LeaveType) : LeaveType.OTHER;
```

**Suggested fix:**
At seed time, refuse to create a LeaveTypeConfig whose code is not in LeaveType, OR log a warning at create-leave time when the fallback fires.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-021]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-030 — cancel() lets the OWNER cancel an APPROVED leave without manager confirmation

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · logic
- **File:** `apps/api/src/leaves/leaves.service.ts:1599`
- **Source:** `audits/agents/02-correctness.json#COR-030`

**Description:**
cancel() is reachable when isOwner OR canManage. If isOwner, the BadRequestException gate still allows status APPROVED→REJECTED. This contradicts the intended workflow where an owner who wants to cancel an APPROVED leave should go through requestCancel() to enter CANCELLATION_REQUESTED.

**Root cause:**
Two cancel paths co-exist but cancel doesn't restrict to managers when the leave is already APPROVED.

**Code evidence:**
```
if (currentUserId && currentUserRole) { const isOwner = leave.userId === currentUserId; const canManage = ...; if (!isOwner && !canManage) throw ForbiddenException(...); } if (leave.status !== LeaveStatus.APPROVED && leave.status !== LeaveStatus.CANCELLATION_REQUESTED) throw ...;
```

**Suggested fix:**
In cancel(), if isOwner && !canManage && leave.status === LeaveStatus.APPROVED, redirect to requestCancel() flow or throw ForbiddenException.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-030]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-019 — Destructive RBAC V4 migration with no transaction wrapping and no rollback path

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · migration
- **File:** `packages/database/prisma/migrations/20260420120000_rbac_v4_drop_legacy/migration.sql:1`
- **Source:** `audits/agents/03-data-integrity.json#DAT-019`

**Description:**
Drops role_permissions, permissions, role_configs tables, drops users.role column, drops Role enum. Header warns 'ACTION IRRÉVERSIBLE' but the SQL has no BEGIN/COMMIT and provides no rollback migration. Other migrations DO use BEGIN/COMMIT — inconsistency.

**Root cause:**
Convention not enforced; relying on prisma migrate's implicit transaction.

**Code evidence:**
```
rbac_v4_drop_legacy/migration.sql: no BEGIN/COMMIT, just sequential DROPs.
```

**Suggested fix:**
Always wrap destructive migrations in explicit BEGIN; ... COMMIT;. Pair every destructive migration with a documented docs/rollbacks/<timestamp>_<name>.md.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-019]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-020 — Production backups: 4 files, last from 2026-04-24, not encrypted, no rotation

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · backup
- **File:** `backups-prod/:1`
- **Source:** `audits/agents/03-data-integrity.json#DAT-020`

**Description:**
4 .sql.gz files, oldest 2026-04-05, last 2026-04-24 (~30 days before current). No encrypted variant — plaintext dumps containing email, passwordHash, audit_logs, leaves data. No automated rotation script visible in repo.

**Root cause:**
Backups created on-demand for migrations, not as a recurring strategy.

**Code evidence:**
```
backups-prod/ contains 4 plain .sql.gz; newest 2026-04-24.
```

**Suggested fix:**
Set up a cron pg_dump | gpg --encrypt -r <opsKey> daily to off-host bucket. Retention policy. Encrypt existing files in place. Document RPO/RTO. Verify restore quarterly.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-020]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — derive test from finding description for backups-prod/
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-027 — Event: missing index on (date), (createdById), (parentEventId); date is DateTime not @db.Date

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:879`
- **Source:** `audits/agents/03-data-integrity.json#DAT-027`

**Description:**
Event.date DateTime (timestamp not date), no @@index on date, no @@index on parentEventId, no @@index on createdById. Calendar queries WHERE date BETWEEN ... table-scan. Inconsistent with Holiday.date @db.Date.

**Root cause:**
Event module evolved without index review.

**Code evidence:**
```
schema.prisma:884 date DateTime; lines 880-909 no @@index.
```

**Suggested fix:**
Add @@index([date]), @@index([projectId, date]), @@index([parentEventId]), @@index([createdById]). Consider @db.Date.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-027]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-009 — No correlation/request ID propagation

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · tracing
- **File:** `apps/api/src/main.ts:1`
- **Source:** `audits/agents/05-observability.json#OBS-009`

**Description:**
No middleware or Fastify hook sets x-request-id; no propagation to logs; no tracing context. An auditor or SRE cannot stitch 'request → DB query → cache → error log → audit log' for one transaction. grep for 'requestId|correlationId|x-request-id|reqId' in apps/api/src returns 0 matches.

**Root cause:**
Not implemented.

**Code evidence:**
```
grep -rn 'requestId|correlationId|x-request-id|reqId' apps/api/src → 0 matches
```

**Suggested fix:**
Add a fastify onRequest hook generating uuid if x-request-id absent; bind via AsyncLocalStorage; include in pino log entries and in audit_logs.payload.requestId.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-009]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-010 — No error tracking (Sentry / equivalent) wired anywhere

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · error_tracking
- **File:** `apps/api/src/main.ts:1`
- **Source:** `audits/agents/05-observability.json#OBS-010`

**Description:**
Zero references to Sentry, Datadog, NewRelic, Honeybadger in apps/api/src or apps/web/src. Unhandled rejections, 500s, and frontend exceptions are silent — only stdout. No alerting. For a production app handling HR data this is a SLA / RGPD incident-response gap.

**Root cause:**
Never integrated.

**Code evidence:**
```
grep -rln Sentry apps/api/src apps/web/src → 0 matches
```

**Suggested fix:**
Wire @sentry/nestjs and @sentry/nextjs (or self-hosted GlitchTip for French sovereignty), with PII redaction. Hook into Nest ExceptionFilter and Next.js global-error.tsx.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-010]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-011 — No metrics endpoint (Prometheus/OTLP)

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · metrics
- **File:** `apps/api/src/main.ts:1`
- **Source:** `audits/agents/05-observability.json#OBS-011`

**Description:**
No prom-client, no @opentelemetry/*, no /metrics endpoint. RED metrics (rate/errors/duration) and USE are not exported. Capacity planning and incident detection rely on guesswork.

**Root cause:**
Not implemented.

**Code evidence:**
```
grep prom-client / opentelemetry / @opentelemetry in apps/ + package.json → 0 application matches
```

**Suggested fix:**
Add @willsoto/nestjs-prometheus or OTLP exporter; expose /api/metrics behind auth; capture http_request_duration_seconds{route,status}, db_query_duration, redis_operation_duration, audit_event_persisted_total.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-011]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-014 — Pino redact list is too narrow — refresh tokens in query, JWT in headers, leave reason all leak

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · pii_leak
- **File:** `apps/api/src/common/fastify/redact.config.ts:4`
- **Source:** `audits/agents/05-observability.json#OBS-014`

**Description:**
redact.paths covers authorization, cookie, body.password, body.currentPassword, body.newPassword, body.refreshToken, set-cookie. Missing: req.headers['x-api-key'], req.body.token (reset password), req.query.token, req.body.validationComment (medical reasons), req.body.reason. Bearer JWT redacted via headers.authorization but x-forwarded-* and proxy-authorization are not.

**Root cause:**
Initial redact config not reviewed after feature additions.

**Code evidence:**
```
paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword', 'req.body.refreshToken', 'res.headers["set-cookie"]']
```

**Suggested fix:**
Expand redact paths to include all token-bearing query/body keys, sensitive PII fields (validationComment, motif, justification), and response body keys (passwordHash, refresh_token, access_token).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-014]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/common/fastify/redact.config.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-015 — Production startup banner uses console.log instead of structured logger

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · logging
- **File:** `apps/api/src/main.ts:148`
- **Source:** `audits/agents/05-observability.json#OBS-015`

**Description:**
main.ts prints an ASCII banner via console.log including process.env.NODE_ENV and port. This bypasses pino, breaks JSON log parsing, and leaks operational details. PrismaService also uses console.log for connect/disconnect. Contaminates log aggregators expecting JSON.

**Root cause:**
Dev-style console.log left in production paths.

**Code evidence:**
```
console.log(`\n  ╔══...╗\n  ║   🚀 ORCHESTR'A V2 API ...`); also prisma.service.ts:11 console.log('✅ Prisma connected...')
```

**Suggested fix:**
Replace console.log with NestJS Logger (already imported); remove emoji banner or guard behind NODE_ENV !== 'production'.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-015]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-017 — No global Nest ExceptionFilter — unknown errors leak stack/details or get lost

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability · error_tracking
- **File:** `apps/api/src/common:1`
- **Source:** `audits/agents/05-observability.json#OBS-017`

**Description:**
find apps/api/src -name '*.filter.ts' returns 0 results. Without a global HTTP exception filter, unexpected non-NestJS errors leak via Nest's default handler. No correlation between thrown error and any audit/Sentry pipeline. Unauthorized accesses (403) and validation failures not audit-emitted (ACCESS_DENIED enum exists, never emitted).

**Root cause:**
No filter implemented.

**Code evidence:**
```
find apps/api/src -name '*.filter.ts' -o -name '*.interceptor.ts' → 0 matches
```

**Suggested fix:**
Add AllExceptionsFilter (catches HttpException + Error); emit ACCESS_DENIED audit on 403, log structured error with requestId, ship to Sentry. Forbid leaking message/stack in production responses.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-017]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/common  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-008 — Tasks findAll bypasses pagination on date filter

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · over_fetching
- **File:** `apps/api/src/tasks/tasks.service.ts:348`
- **Source:** `audits/agents/04-performance.json#PER-008`

**Description:**
...(hasDateFilter ? {} : { skip, take: safeLimit }) — when a planning window is provided, pagination is intentionally disabled. With assignees, project, _count subqueries, each row is ~2-5 KB. A 6-month window can exceed 5000 rows.

**Root cause:**
Reusing CRUD endpoint for planning where unbounded ranges are legitimate.

**Code evidence:**
```
...(hasDateFilter ? {} : { skip, take: safeLimit })
```

**Suggested fix:**
Keep pagination always on. Introduce /tasks/planning?from&to&userIds= returning minimal grid shape.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-008]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/tasks/tasks.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-014 — Role-permissions cache stampede risk + no negative caching

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · cache
- **File:** `apps/api/src/rbac/permissions.service.ts:55`
- **Source:** `audits/agents/04-performance.json#PER-014`

**Description:**
getPermissionsForRole reads Redis, falls back to Prisma. There is NO single-flight or lock — under a burst, all concurrent requests hit prisma.role.findUnique simultaneously. Missing/unknown role returns [] but is NOT cached — every request for a bad/legacy roleCode hits Postgres forever.

**Root cause:**
Cache-aside without coalescing; absent rows never memoized.

**Code evidence:**
```
const cached = await this.redis.get(cacheKey); if (cached) return JSON.parse(...); ... role = await this.prisma.role.findUnique(...)
```

**Suggested fix:**
Wrap DB lookup with an in-process Map<roleCode, Promise> singleflight. Cache empty results with shorter TTL. On templateKey mutation, scan role-permissions:* and DEL in pipeline.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-014]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/rbac/permissions.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-022 — User/project time reports do reduce() aggregations in JS instead of SQL groupBy

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · aggregation
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts:619`
- **Source:** `audits/agents/04-performance.json#PER-022`

**Description:**
getUserReport and getProjectReport fetch ALL entries via findMany then loop to build byType, byProject, byDate maps in memory. On annual exports this materializes thousands of rows + heavy joins only to sum hours. SQL can do it in a single groupBy.

**Root cause:**
Aggregation in Node instead of pushed to Postgres.

**Code evidence:**
```
const entries = await this.prisma.timeEntry.findMany(...); const totalHours = entries.reduce(...); const byType = entries.reduce(...);
```

**Suggested fix:**
Use prisma.timeEntry.groupBy({ by: ['activityType'], _sum: { hours: true }, where }) and equivalent for project/date.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-022]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/time-tracking/time-tracking.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-023 — Two-round-trip + extra groupBy on every getByAssignee call

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · n_plus_one
- **File:** `apps/api/src/tasks/tasks.service.ts:1101`
- **Source:** `audits/agents/04-performance.json#PER-023`

**Description:**
getByAssignee fetches all tasks with deep include (project, assignee, assignees.user, _count for 4 relations), then issues a SECOND query timeEntry.groupBy({ by: ['taskId'] }). With assignees + 4 _count subqueries, a single user with 80 tasks generates 1 main query + 4 implicit count subqueries (Prisma LATERAL) + 1 groupBy. The dashboard calls this on every mount.

**Root cause:**
No caching on user-scoped derived views; eager include of expensive _counts.

**Code evidence:**
```
const tasks = await this.prisma.task.findMany({ where: { ... }, include: { _count: { select: { dependencies: true, dependents: true, raci: true, comments: true } } } }); const sums = ... timeEntry.groupBy(...)
```

**Suggested fix:**
Cache result in Redis with key tasks:assignee:<userId> TTL 30-60s, bust on task mutation. Drop unused _count fields.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-023]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/tasks/tasks.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-024 — Recurring events: createMany then immediate findMany to wire participants

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · n_plus_one
- **File:** `apps/api/src/events/events.service.ts:192`
- **Source:** `audits/agents/04-performance.json#PER-024`

**Description:**
When creating a recurring event with participants, the code does createMany for child events, then prisma.event.findMany({ parentEventId }) to get their IDs back, then eventParticipant.createMany. With a yearly weekly recurrence (52 occurrences) × 30 participants = 1 select + 1560-row insert. The entire block runs synchronously.

**Root cause:**
Recurrence expansion done synchronously at request time.

**Code evidence:**
```
await this.prisma.event.createMany({ data: occurrences }); ... const childEvents = await this.prisma.event.findMany({ where: { parentEventId: event.id } }); ...
```

**Suggested fix:**
Either (a) use prisma.event.create in a loop with participants.create nested; (b) push expansion to a BullMQ/queue worker; (c) materialize occurrences lazily on read.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-024]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/events/events.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-027 — Analytics /reports payload is unbounded — confirms documented regression

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** performance · other
- **File:** `apps/api/src/analytics/analytics.service.ts:62`
- **Source:** `audits/agents/04-performance.json#PER-027`

**Description:**
Per MEMORY: 'dateRange is not a scope filter'. getAnalytics ignores dateRange entirely — response covers FULL accessible project scope. AnalyticsResponseDto.projectDetails has one entry per project (36+ per scope), each containing full task aggregate and time entry sums. NO upper bound: tenant-admin sees ALL projects.

**Root cause:**
Reports endpoint conflates 'period filter' with 'project filter'.

**Code evidence:**
```
projects findMany has no take. Code comment: 'incident: 36 projects in scope, only 7 displayed'.
```

**Suggested fix:**
Cap projectDetails to top-N (e.g. 50) with 'see all' paginated endpoint. Add take to the projects findMany.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-027]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/analytics/analytics.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-008 — Self-registration accepts arbitrary email and login with no domain restriction

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · auth
- **File:** `apps/api/src/auth/auth.service.ts:217`
- **Source:** `audits/agents/01-security.json#SEC-008`

**Description:**
POST /auth/register is @Public(), allows MinLength(2) names, and creates the user with isActive: false. Account requires admin activation, which is acceptable. However: (1) no domain allowlist on email — a French collectivity SaaS should typically only accept emails matching a configured corporate domain; (2) firstName/lastName are not length-capped or stripped of newlines / control chars / HTML, opening stored XSS surface; (3) bot-driven account creation can clutter the admin queue.

**Root cause:**
Generic registration flow not adapted to the closed/internal user model of the application.

**Code evidence:**
```
RegisterDto: @IsString() @MinLength(2) firstName (no MaxLength); no IsEmail domain restriction.
```

**Suggested fix:**
Add REGISTRATION_ENABLED=false default in production; if enabled, accept only @MaxLength(50) for names, sanitize unicode, and enforce REGISTRATION_EMAIL_DOMAIN allowlist.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-008]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/auth.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-012 — CORS env-var mismatch between code (ALLOWED_ORIGINS) and prod template (CORS_ORIGIN)

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · cors
- **File:** `apps/api/src/main.ts:53`
- **Source:** `audits/agents/01-security.json#SEC-012`

**Description:**
Code reads process.env.ALLOWED_ORIGINS (comma-separated). .env.production.example documents CORS_ORIGIN= (singular). A production deployer following the template will have CORS_ORIGIN set, ALLOWED_ORIGINS undefined → falls into the fallback branch. With credentials:true on line 62, any future config flip to wildcard would be catastrophic.

**Root cause:**
Documentation drift; the prod template was never aligned with the code variable name.

**Code evidence:**
```
Code: process.env.ALLOWED_ORIGINS; .env.production.example: CORS_ORIGIN=
```

**Suggested fix:**
Align: rename code to read CORS_ORIGIN or fix the template. Add a boot-time assertion: if NODE_ENV=production and no allowed-origins config is set, throw at startup.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-012]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/main.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-020 — /users/me/avatar (@AllowSelfService) accepts upload from disabled users until JWT expiry

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · authz
- **File:** `apps/api/src/users/users.controller.ts:233`
- **Source:** `audits/agents/01-security.json#SEC-020`

**Description:**
JwtStrategy.validate rejects users where isActive=false. But the rejection happens by re-querying the DB on every request. The 401 returned is generic — the disabled user can still POST repeatedly to /users/me/avatar at 30 req/min (global short throttler), each writing up to 2 MB into uploads/avatars/. Combined with the cleanup-loop deleting only userId-prefixed files, a disabled-but-token-holding attacker can spam uploads. More importantly: there is no per-route @Throttle on uploadAvatar.

**Root cause:**
Generic throttler limit is high; per-upload throttle is missing; disabled user state is reactive not proactive (no global token nbf).

**Code evidence:**
```
@Post('me/avatar') @AllowSelfService() ... uploadAvatar() — no @Throttle decorator.
```

**Suggested fix:**
Add @Throttle on uploadAvatar (e.g. 5/min). Combine with SEC-019: bump user nbf on user.update when isActive flips to false.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-020]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-025 — departmentId / serviceIds typed as @IsString without @IsUUID — allows weird values and inconsistent error semantics

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · input_validation
- **File:** `apps/api/src/users/dto/create-user.dto.ts:71`
- **Source:** `audits/agents/01-security.json#SEC-025`

**Description:**
Both departmentId and the items of serviceIds are validated as plain strings. Service code subsequently passes them to Prisma findUnique({ where: { id } }) which expects a UUID column. A non-UUID value will throw a Prisma validation error (500 leaks). Same pattern in roleCode which is plain @IsString.

**Root cause:**
DTO author used IsString for foreign keys instead of IsUUID.

**Code evidence:**
```
@IsOptional() @IsString() departmentId?: string;
```

**Suggested fix:**
Replace @IsString with @IsUUID('4') on all foreign-key fields. Add Fastify bodyLimit explicitly in FastifyAdapter options.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-025]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/dto/create-user.dto.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-012 — Date tests use new Date(YYYY, M, D) (local timezone) without freezing clock or pinning TZ

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · flaky
- **File:** `apps/web/src/lib/__tests__/date-utils.test.ts:60`
- **Source:** `audits/agents/06-tests.json#TST-012`

**Description:**
Lib date-utils tests construct dates via the local-time constructor new Date(2025, 0, 15) and expect literal strings like '15/01/2025'. The suite passes in CI because the workflow exports TZ: Europe/Paris, but no vi.useFakeTimers() is used anywhere in apps/web. Any test that calls formatDistance/formatRelative-style helpers against new Date() will drift over time.

**Root cause:**
Convention not codified; TZ is set in CI but not pinned at runtime, so a contributor running locally with TZ=UTC sees off-by-one failures.

**Code evidence:**
```
grep -c useFakeTimers apps/web: 0; grep useFakeTimers apps/api: only recent-activity.service.spec.ts; CI sets TZ=Europe/Paris in 3 workflow steps as compensating control
```

**Suggested fix:**
Add a global setup that calls vi.useFakeTimers({ now: new Date('2025-01-15T10:00:00Z') }) and process.env.TZ = 'Europe/Paris'. Convert any test that constructs dates with the local-time constructor to ISO with explicit Z suffix.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-012]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/web/src/lib/__tests__/date-utils.test.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-016 — Documents service spec — only one negative test; no MIME/size/auth assertions

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · missing_negative
- **File:** `apps/api/src/documents/documents.service.spec.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-016`

**Description:**
8 it() blocks total. Only findOne should throw error when document not found is negative. Documents is a file-upload module governed by magic-bytes.validator and OwnershipCheck. There is no test that asserts the service rejects: oversize files, mismatched MIME, cross-user delete, project-scope read leak. magic-bytes.validator has its own spec but the integration with documents.service isn't tested.

**Root cause:**
Spec authored as a CRUD smoke; security-relevant paths deferred.

**Code evidence:**
```
documents.service.spec.ts: 8 it(), only 1 .rejects.toThrow; no MIME/size assertions; OwnershipCheck on controller untested at service layer
```

**Suggested fix:**
Add: BadRequest on oversize, BadRequest/UnsupportedMediaType on mime mismatch, Forbidden on cross-user delete without bypass perm, scoping check on findAll.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-016]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/documents/documents.service.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-020 — Validator dormancy not tested — findValidatorForUser fallback path missing critical case

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · missing_negative
- **File:** `apps/api/src/leaves/leaves.service.spec.ts:561`
- **Source:** `audits/agents/06-tests.json#TST-020`

**Description:**
MEMORY.md flags 'findValidatorForUser dormancy' as a known production stuck-row root cause. The service has a 3-tier resolution: active delegate → department.managerId → fallback by MANAGE_ANY role with isActive: true. Tests cover: active delegate (multiple), department manager (line 476 fallback when managerId null), but no test covers the case where department.manager exists but is isActive: false — the dormant-validator pitfall.

**Root cause:**
Dormancy fix was applied in production hot-fix but the test suite was not retroactively grown.

**Code evidence:**
```
Recent commits 716f7ec/9e17b5f reference 'post-deploy stuck-row fix + findValidatorForUser dormancy'; spec covers managerId null (L476) but not manager.isActive=false
```

**Suggested fix:**
Add a test 'falls through department.manager when manager.isActive=false' that mocks department.manager with isActive:false and asserts the fallback role-based validator is returned (or null). Add e2e variant against real DB.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-020]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-021 — Negative E2E coverage is sparse — most workflow specs only positive paths

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · e2e_gap
- **File:** `e2e/tests/workflows:1`
- **Source:** `audits/agents/06-tests.json#TST-021`

**Description:**
CLAUDE.md mandates 'Negative tests required: verify unauthorized roles get 403 or redirect'. Workflow specs primarily check that allowed roles see the right UI. The denied-side mostly relies on rbac/api-permissions.spec.ts (which has TST-013 weakness). There is no e2e test where OBSERVATEUR POSTs to /api/leaves and gets 403 confirmed at workflow level.

**Root cause:**
Negative coverage delegated to one harness that is itself weak and silent on 56 missing permissions.

**Code evidence:**
```
grep test.describe.*denied|negative|403|forbidden e2e/tests/workflows: matches mostly in comments; rbac/api-permissions is the only systematic 403 oracle
```

**Suggested fix:**
For each workflow spec, add an @negative block iterating deniedRoles from the matrix and asserting strict status codes.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-021]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — derive test from finding description for e2e/tests/workflows
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-022 — E2E job seeds DB with E2E_SEED=true but no follow-up verification that all 6 role storage states exist

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · ci
- **File:** `.github/workflows/ci.yml:168`
- **Source:** `audits/agents/06-tests.json#TST-022`

**Description:**
auth.setup.ts loops over ROLES and writes a storage state per role. If a single role login fails, the test continues for other roles but every spec that calls getTokenFromStorageState(role) throws at runtime. The CI workflow does not verify all six playwright/.auth/*.json exist before running the projects. Combined with retries=1, a partial setup is masked.

**Root cause:**
Setup project is best-effort; no gate.

**Code evidence:**
```
auth.setup.ts L19 setup.describe.configure({ mode: "serial" }) + 60s sleep on 429 with 3 retries; no post-setup check
```

**Suggested fix:**
Add a CI step after setup that lists playwright/.auth/ and fails fast if any role file is missing or empty. Alternatively, fail auth.setup.ts hard on any non-200/non-201 login response.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-022]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (config change, no automated test)
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-023 — Critical Frontend pages have no test — projects/[id], leaves, settings, telework

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · coverage_gap
- **File:** `apps/web/src/components:1`
- **Source:** `audits/agents/06-tests.json#TST-023`

**Description:**
Web tests cover dashboard, login, planning, projects (list), reports/advanced, tasks, users — but not /leaves page, not /settings/* pages, not /projects/[id] detail page (the largest), not /telework page, not /leaves/balances. usePermissions hook has a test but no test combines it with a route guard. With Next.js 16 + React 19 known compatibility risk, absence of page-level integration tests is high risk.

**Root cause:**
Web test investment concentrated on services and a handful of pages.

**Code evidence:**
```
find apps/web -name '*.test.tsx' for pages: dashboard, login, planning, projects (list only), tasks, users, reports/advanced; missing: leaves, projects/[id], settings, telework, leaves/balances, schools
```

**Suggested fix:**
Add page-level tests for /leaves, /projects/[id], /settings, /telework that render the page with a fake-API and assert role-gated affordances.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-023]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter web test  # no targeted spec inferred from apps/web/src/components
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-024 — No multi-role E2E for reject, cancel, delegation, or balance restoration

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests · e2e_gap
- **File:** `e2e/tests/multi-role/leave-lifecycle.spec.ts:1`
- **Source:** `audits/agents/06-tests.json#TST-024`

**Description:**
multi-role/leave-lifecycle.spec.ts covers only the approve happy path. There is no multi-role E2E for: manager rejects → contributeur sees REJECTED + balance restored, contributeur cancels APPROVED leave → balance restored, delegated validator → approval works, validator dormancy (assigned manager isActive:false) → fallback validator picks up. These were called out by CLAUDE.md (3361 spec lines for leaves.service.ts) but only the approve flow has integration coverage.

**Root cause:**
Single happy-path multi-role test created; never expanded.

**Code evidence:**
```
ls e2e/tests/multi-role/: only leave-lifecycle.spec.ts (1 file) + others non-leave; no leave-reject, leave-cancel, leave-delegation, leave-dormant spec
```

**Suggested fix:**
Add 4 multi-role flows: reject, cancel, delegation, dormant-manager fallback. Each must assert balance state pre/post.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-024]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:e2e -- e2e/tests/multi-role/leave-lifecycle.spec.ts
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-020 — Conflicting where.endDate assignments in findAll when overdue + date range

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · logic
- **File:** `apps/api/src/tasks/tasks.service.ts:311`
- **Source:** `audits/agents/02-correctness.json#COR-020`

**Description:**
When overdue=true is combined with startDate/endDate, where.endDate = { lt: new Date() } is set, then andFilters adds { endDate: { gte: new Date(startDate) } } to AND. Top-level endDate is merged with AND entries — works only if startDate is in the past. where.status is also unconditionally overwritten.

**Root cause:**
Mutation of where is not idempotent across filter branches.

**Code evidence:**
```
if (overdue) { where.endDate = { ...((where.endDate as object) || {}), lt: new Date() }; where.status = { not: TaskStatus.DONE }; }
```

**Suggested fix:**
Build all filters via andFilters (immutable composition); never overwrite where.status or where.endDate once set.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-020]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/tasks/tasks.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-025 — canSelfApprove permits self-approval when targetUserId === requestingUserId

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · logic
- **File:** `apps/api/src/leaves/leaves.service.ts:376`
- **Source:** `audits/agents/02-correctness.json#COR-025`

**Description:**
When a manager submits a leave with targetUserId === requestingUserId, the early branch is skipped, so declaredByManager stays false. If the manager's role also has leaves:self_approve, the leave is auto-approved bypassing the normal validator path. May be intended; if so add a comment + test.

**Root cause:**
Two flags (self_approve, declare_for_others) interact at the same join point with no explicit precedence rule.

**Code evidence:**
```
const isForSelf = !declaredByManager; const canSelfApprove = isForSelf && (await this.roleHasPermission(requestingUserRole, 'leaves:self_approve'));
```

**Suggested fix:**
Make the precedence explicit in code with a comment, and add a controller-level test asserting the documented behaviour.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-025]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-029 — getPendingDays counts by deprecated type enum, not leaveTypeId

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · edge_case
- **File:** `apps/api/src/leaves/leaves.service.ts:2113`
- **Source:** `audits/agents/02-correctness.json#COR-029`

**Description:**
getPendingDays sums PENDING leaves where type === LeaveType.CP. With the deliberate decoupling of type enum from leaveTypeId, a CP leave whose leaveTypeConfig.code maps to a different enum value would be missed.

**Root cause:**
Legacy aggregation by enum was not migrated when LeaveTypeConfig became the source of truth.

**Code evidence:**
```
where: { userId, type: LeaveType.CP, status: LeaveStatus.PENDING }
```

**Suggested fix:**
Either delete the method (it's unreferenced) or rewrite it to sum by leaveTypeId === <CP config id>.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-029]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-031 — milestonesOverdue treats milestones with null dueDate as overdue

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · logic
- **File:** `apps/api/src/projects/projects.service.ts:1011`
- **Source:** `audits/agents/02-correctness.json#COR-031`

**Description:**
captureSnapshots filters m.dueDate < now and m.dueDate >= now on milestones whose schema may permit null dueDate. Behaviour depends on Prisma's return type.

**Root cause:**
Loose null handling on optional date.

**Code evidence:**
```
const milestonesOverdue = project.milestones.filter((m) => m.status !== 'COMPLETED' && m.dueDate < now).length;
```

**Suggested fix:**
Guard m.dueDate != null before each comparison; add a unit test for a milestone with null dueDate.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-031]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-032 — getProjectStats milestones.upcoming uses Date.now() inline twice

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · logic
- **File:** `apps/api/src/projects/projects.service.ts:1184`
- **Source:** `audits/agents/02-correctness.json#COR-032`

**Description:**
The filter mixes new Date(m.dueDate) > new Date() (now) and < new Date(Date.now() + 7*24*60*60*1000). The two new Date() instantiations evaluate at different microseconds.

**Root cause:**
Inline date arithmetic without a captured now.

**Code evidence:**
```
upcoming: project.milestones.filter((m) => m.status !== 'COMPLETED' && new Date(m.dueDate) > new Date() && new Date(m.dueDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length
```

**Suggested fix:**
Capture const now = new Date(); once at the top of the method and reuse.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-032]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/projects/projects.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### COR-033 — enrichLeavesWithPermissions inconsistent for REJECTED leaves on owner edit

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · data_flow
- **File:** `apps/api/src/leaves/leaves.service.ts:156`
- **Source:** `audits/agents/02-correctness.json#COR-033`

**Description:**
Owner: canEdit only when status === PENDING; canDelete for PENDING or REJECTED. Manager-perimeter: canEdit for PENDING or APPROVED; canDelete includes CANCELLATION_REQUESTED. Owner can DELETE a REJECTED leave but cannot edit it. The UI affordance set is asymmetric.

**Root cause:**
Two evolved rule sets without a single matrix.

**Code evidence:**
```
canEdit = (isOwner && leave.status === LeaveStatus.PENDING) || (hasDeletePerm && isInPerimeter && (...PENDING|APPROVED));
```

**Suggested fix:**
Define a small lookup table (role-class, status) → {canEdit, canDelete} and derive both flags from it; add a unit test enumerating all 6 statuses × 2 role-classes.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes COR-033]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-028 — PasswordResetToken: no index on (userId, usedAt) and no auto-cleanup of expired tokens

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:1034`
- **Source:** `audits/agents/03-data-integrity.json#DAT-028`

**Description:**
PasswordResetToken has expiresAt, usedAt but only the token @unique index. Queries to list pending tokens per user, or to GC expired ones, table-scan.

**Root cause:**
Index discipline not applied to ephemeral tables.

**Code evidence:**
```
schema.prisma:1034-1048 PasswordResetToken: only @unique on token.
```

**Suggested fix:**
Add @@index([userId, usedAt]) and a periodic cleanup job (or partial index CREATE INDEX ON password_reset_tokens("expiresAt") WHERE "usedAt" IS NULL).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-028]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-029 — UserService and similar join tables: createdAt has no updatedAt and no @@index on serviceId

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:121`
- **Source:** `audits/agents/03-data-integrity.json#DAT-029`

**Description:**
UserService has @@unique([userId, serviceId]) but no @@index([serviceId]) — reverse-lookup 'all users in service X' uses the unique index's second column via scan. Same for ProjectMember, EventParticipant.

**Root cause:**
Composite unique indexes are not always usable for the second column.

**Code evidence:**
```
schema.prisma:131 @@unique([userId, serviceId]) only.
```

**Suggested fix:**
Add @@index([serviceId]) on UserService, @@index([userId]) on ProjectMember, etc.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-029]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-019 — /health exposes process.uptime — info leak with no auth, and not a real health check

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** observability · health
- **File:** `apps/api/src/app.controller.ts:26`
- **Source:** `audits/agents/05-observability.json#OBS-019`

**Description:**
GET /api/health is @Public, returns { status: 'ok', timestamp, uptime: process.uptime() } unconditionally without checking Postgres/Redis/disk. So it's both an information leak AND it tells the load balancer 'I'm healthy' even if DB is down.

**Root cause:**
Stub health endpoint.

**Code evidence:**
```
return { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };
```

**Suggested fix:**
Use @nestjs/terminus with separate /healthz (liveness, no auth) and /readyz (DB+Redis checks). Do not expose uptime/build info on a public endpoint.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-019]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/app.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-022 — Redis errors swallowed with console.warn — no metric, no alert

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** observability · logging
- **File:** `apps/api/src/rbac/permissions.service.ts:68`
- **Source:** `audits/agents/05-observability.json#OBS-022`

**Description:**
PermissionsService catches Redis read/write/del errors and console.warn's them. Silent fallback means a Redis outage degrading to compile-time recompute is invisible.

**Root cause:**
Defensive error handling without observability.

**Code evidence:**
```
console.warn('[PermissionsService] Redis read error:', error);
```

**Suggested fix:**
Replace console.warn with Nest Logger AND increment a metric (rbac_cache_error_total{op}); on sustained failure, emit a SystemDegraded audit event.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-022]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/rbac/permissions.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-025 — Nginx access log uses default 'main' format — no request_id, no upstream timing

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** observability · logging
- **File:** `nginx/nginx.conf:1`
- **Source:** `audits/agents/05-observability.json#OBS-025`

**Description:**
log_format main is the stock combined format. No $request_id, no $upstream_response_time, no $request_time, no JSON output. Reverse-proxy logs cannot be correlated with the API logs.

**Root cause:**
Nginx config not tuned for observability.

**Code evidence:**
```
log_format main '$remote_addr - $remote_user [$time_local] "$request"' (combined-like, no JSON, no request_id)
```

**Suggested fix:**
Use JSON log_format with $request_id (proxy_set_header X-Request-Id $request_id), $upstream_response_time, $request_time, $status, $bytes_sent, $http_x_forwarded_for. Forward X-Request-Id to API which propagates it.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-025]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — derive test from finding description for nginx/nginx.conf
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-030 — Leave list includes full leaveType object instead of selected fields

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** performance · over_fetching
- **File:** `apps/api/src/leaves/leaves.service.ts:681`
- **Source:** `audits/agents/04-performance.json#PER-030`

**Description:**
include: { leaveType: true } pulls every column of LeaveTypeConfig for every leave row. The UI only needs {id, code, name, color, icon}. With pagination cap = 1000 leaves × ~10-15 leaveType columns = wasted bandwidth.

**Root cause:**
include instead of select boilerplate.

**Code evidence:**
```
include: { ... leaveType: true, ... }
```

**Suggested fix:**
Replace with leaveType: { select: { id: true, code: true, name: true, color: true, icon: true } }.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-030]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-026 — JWT_SECRET placeholder is too memorable

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** security · secrets
- **File:** `.env.example:19`
- **Source:** `audits/agents/01-security.json#SEC-026`

**Description:**
Operators tend to commit example files into Docker images or onto staging without rotating. A placeholder string that looks like a real secret is more likely to be left as-is in low-stakes environments and used to sign tokens that an attacker can forge.

**Root cause:**
Cosmetic but operationally risky default.

**Code evidence:**
```
JWT_SECRET=your_super_secret_key_change_in_production_min_32_chars
```

**Suggested fix:**
Set JWT_SECRET= (empty) in .env.example too, forcing the developer to consciously generate one. Add a startup assertion: refuse to boot in production if JWT_SECRET length < 32.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-026]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (env config), plus boot-assert test if applicable
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-027 — Approve/Reject endpoints use @Body('comment')/@Body('reason') without DTO — bypasses ValidationPipe whitelist

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** security · input_validation
- **File:** `apps/api/src/leaves/leaves.controller.ts:453`
- **Source:** `audits/agents/01-security.json#SEC-027`

**Description:**
@Body('comment') comment?: string extracts a single field. The body still goes through ValidationPipe but with no metatype. Arbitrary extra fields in the request body are silently dropped (good), but the comment/reason itself has no @MaxLength, no sanitization. Stored verbatim in the leave audit trail. A 50KB rejection 'reason' is accepted. Risk: log/storage bloat, possible HTML injection if rendered without escaping.

**Root cause:**
Convenience extraction of single body field instead of a typed DTO.

**Code evidence:**
```
reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') validatorId: string, @Body('reason') reason?: string)
```

**Suggested fix:**
Define ApproveLeaveDto / RejectLeaveDto with @IsOptional @IsString @MaxLength(2000) and use them as @Body() targets.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-027]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves/leaves.controller.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-028 — taskReadWhere allows access via assigneeId — task can be 'leaked' by reassignment

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** security · authz
- **File:** `apps/api/src/common/services/access-scope.service.ts:95`
- **Source:** `audits/agents/01-security.json#SEC-028`

**Description:**
Any user assigned to a task can read it. A manager who wants to give a contributor visibility into a sensitive task can do so by assigning them. There's no project-confidentiality concept (no 'sensitive' flag) and no scoped-access logging.

**Root cause:**
Single-field 'assignee = full read' design.

**Code evidence:**
```
OR: [ { assigneeId: user.id }, { assignees: { some: { userId: user.id } } }, ... ]
```

**Suggested fix:**
Consider a confidential flag on Task/Project with audit trail of who accessed; or document this explicitly as expected behavior.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-028]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/common/services/access-scope.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### SEC-029 — Refresh token issuance stores UA verbatim with no bounding — log/DB bloat vector

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** security · other
- **File:** `apps/api/src/auth/refresh-token.service.ts:60`
- **Source:** `audits/agents/01-security.json#SEC-029`

**Description:**
issue() and rotate() store userAgent: meta?.userAgent ?? null. The controller truncates UA at 512 chars before passing to the service, but the service doesn't enforce or document this. If another caller forgets to truncate, the DB column has no constraint visible.

**Root cause:**
Truncation enforced at controller layer only.

**Code evidence:**
```
userAgent: meta?.userAgent ?? null,
```

**Suggested fix:**
Enforce maxLength in the service or via Prisma column @db.VarChar(512).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes SEC-029]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/refresh-token.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### TST-025 — E2E job runs all Playwright projects sequentially in one job — long feedback loop, no smoke fast-path

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** tests · ci
- **File:** `.github/workflows/ci.yml:161`
- **Source:** `audits/agents/06-tests.json#TST-025`

**Description:**
The Run Playwright E2E Tests step runs playwright test --config ../../playwright.config.ts without any --grep filter, so all 6 role projects + multi-role + setup run together. There is a @smoke tag convention but no CI step that runs --grep @smoke as a fast feedback path. e2e-tests is gated only by needs: [lint] so it runs without unit-test green — a unit test failure won't short-circuit the slow E2E job.

**Root cause:**
No matrix split; @smoke tag exists but unused in CI.

**Code evidence:**
```
ci.yml L161-275 single playwright invocation; @smoke present in 15+ specs; no --grep in run step
```

**Suggested fix:**
Add a e2e-smoke job gated by needs: [lint] that runs --grep @smoke with workers=4 (~3-5min). Keep the full job gated on the smoke job. Also gate e2e on backend-tests passing.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes TST-025]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
TBD — manual verification (config change, no automated test)
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### DAT-030 — Seed creates E2E test users when E2E_SEED=true OR NODE_ENV=test — fragile prod safety

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** suggestion
- **Category:** data_integrity · seed
- **File:** `packages/database/prisma/seed.ts:1596`
- **Source:** `audits/agents/03-data-integrity.json#DAT-030`

**Description:**
Seed's prod-guard for admin is correct. But E2E user creation triggers on either env var. If someone accidentally sets E2E_SEED=true in a prod shell while running migrate, E2E test users land in prod with predictable credentials.

**Root cause:**
OR-condition gate; no hard refusal when NODE_ENV=production.

**Code evidence:**
```
seed.ts:1598 if (process.env.E2E_SEED === "true" || process.env.NODE_ENV === "test").
```

**Suggested fix:**
Wrap E2E block in if ((process.env.E2E_SEED === 'true' || process.env.NODE_ENV === 'test') && process.env.NODE_ENV !== 'production').

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes DAT-030]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test apps/api/src/  # verify migration + regression
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### OBS-023 — No Prisma query logging / slow-query observability

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** suggestion
- **Category:** observability · tracing
- **File:** `apps/api/src/prisma/prisma.service.ts:1`
- **Source:** `audits/agents/05-observability.json#OBS-023`

**Description:**
PrismaService instantiated with defaults — no { log: ['query', 'warn', 'error'] }, no event listener emitting slow-query metrics or correlating queries with requestId. N+1s and slow queries are invisible to ops.

**Root cause:**
Defaults left in place.

**Code evidence:**
```
prisma.service.ts uses console.log for connect/disconnect only; no log config.
```

**Suggested fix:**
new PrismaClient({ log: [{level:'query', emit:'event'}, {level:'warn', emit:'event'}, {level:'error', emit:'event'}] }); subscribe and emit Prometheus histogram + pino structured log with requestId.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes OBS-023]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/prisma/prisma.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-026 — Redis usage limited to JWT blacklist + role-permissions — no caching on heavy reports

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** suggestion
- **Category:** performance · cache
- **File:** `apps/api/src/auth/jwt-blacklist.service.ts:1`
- **Source:** `audits/agents/04-performance.json#PER-026`

**Description:**
Only two services use Redis. Hot expensive endpoints — analytics, planning overview, users presence, leaves balance, project lists — re-execute their full Prisma plans on every request.

**Root cause:**
No cache strategy outside auth/RBAC.

**Code evidence:**
```
find apps/api/src -name '*.ts' | xargs grep -l 'redis' → only jwt-blacklist.service.ts, permissions.service.ts
```

**Suggested fix:**
Introduce a thin CacheService and wrap: /analytics (60s), /planning/overview (15-30s), /users/presence (30s), /leaves/balance/:userId (60s, bust on mutation).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-026]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/auth/jwt-blacklist.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
### PER-029 — Daily snapshot cron runs in-process on the API — risk of blocking event loop

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** suggestion
- **Category:** performance · background_job
- **File:** `apps/api/src/analytics/advanced/snapshot-scheduler.service.ts:20`
- **Source:** `audits/agents/04-performance.json#PER-029`

**Description:**
@Cron('0 23 * * *') runs captureSnapshots() directly in the API node. With PER-003's N+1 it can take a multi-second event-loop hit nightly. If multiple API replicas are running, all replicas run the cron simultaneously → duplicate findFirst races and 2-3x DB load.

**Root cause:**
No singleton lock for crons in a horizontally-scaled NestJS deployment.

**Code evidence:**
```
@Cron(SNAPSHOT_CRON, { timeZone: SNAPSHOT_TZ }) async captureDailySnapshots() { ... await this.projectsService.captureSnapshots(); }
```

**Suggested fix:**
Either run cron on a single 'scheduler' replica (env flag), or use a Redis-based lock (SET NX EX). After PER-003 fix, latency drops below 1s.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes PER-029]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/analytics/advanced/snapshot-scheduler.service.spec.ts  # may need creation if missing
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — Claude Code fills if surprises encountered)

---
