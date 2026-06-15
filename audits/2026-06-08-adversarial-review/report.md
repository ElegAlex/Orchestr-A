# Adversarial Code Review — ORCHESTR'A V2

- **Report date**: 2026-06-08
- **Repo commit**: `b9347d2f809ca2c1d897cbf3bc59bebfbfeb68ac`
- **Verdict**: **blocking-issues**
- **Method**: dynamic multi-agent workflow — 6 dimensions × sharded fan-out (read-only), per-finding adversarial refutation, blocking second-pass, coverage reconciliation against ground-truth file lists. 147 confirmed findings after refutation.

> Four findings carry blocking severity (SEC-001 API crash-loop on standalone/all-in-one boot, COR-028 rejectCancellation always returns HTTP 500 due to strict audit schema mismatch rolling back the status transition, COR-001 dependency-cycle race condition defeats the SERIALIZABLE guard by reading off the outer prisma client, DAT-001 stopRecurrence leaves a permanently inconsistent recurrence state on any mid-operation failure). Beyond the explicit blockers, Cluster A (IDOR / scope bypass on epics, milestones, tasks, orphans, skills) represents a class of privilege-escalation issues that allow any authenticated contributor to read and mutate data across project boundaries — this is not a nit but a systemic authorization design gap. The codebase is not ready for production promotion on any new deployment target until at minimum the Phase-1 clusters (A, D, E, F, M) are resolved.

## Executive summary

| Severity | Count |
|---|---|
| 🔴 blocking | 4 |
| 🟠 important | 73 |
| 🟡 nit | 61 |
| 🔵 suggestion | 9 |
| **Total** | **147** |

| Category | Count |
|---|---|
| Security | 33 |
| Correctness | 39 |
| Data integrity | 27 |
| Performance | 25 |
| Observability | 14 |
| Tests | 9 |

## Coverage assertion

- Controllers scanned: **35/35**
- Services scanned: **50/50**
- Migrations scanned: **81/81**
- Test files scanned: **153**
- Untracked files included: **0** (working-tree artifacts — PNGs/uploads/backlog digests — excluded by design)

Coverage was reconciled in-loop: any controller/service/migration absent from the union of agent-reported `scanned_files` triggered a gap-fill agent before this report was emitted. Residual gaps after gap-fill: controllers 0, services 0, migrations 0.

## Top blocking findings

- **COR-028** (blocking, correctness) — rejectCancellation() passes an unrecognized key to strict leaveAudit schema — AuditPayloadValidationError rolls back the entire Prisma transaction, reverting the status transition and returning HTTP 500 — `apps/api/src/leaves/leaves.service.ts:2394-2406`
- **SEC-001** (blocking, security) — AUDIT_HASH_KEY missing from standalone and all-in-one deployments — API crash-loops on boot — `docker-compose.standalone.yml:59-77`
- **COR-001** (blocking, correctness) — checkCircularDependency reads via this.prisma (not tx) inside serializable transaction — race allows dependency cycles — `apps/api/src/tasks/tasks.service.ts:1005-1050 (call site), 1435 (leak)`
- **DAT-001** (blocking, data_integrity) — stopRecurrence(): deleteMany + update not wrapped in a transaction — `apps/api/src/events/events.service.ts:895-905`
- **SEC-003** (important, security) — POST /leaves/import bypasses declare-for-others authorization; validateImport is a user enumeration oracle — `apps/api/src/leaves/leaves.controller.ts:286-319`
- **SEC-006** (important, security) — milestones.findAll() returns all milestones with no user-scope filter — `apps/api/src/milestones/milestones.service.ts:64-99`
- **SEC-010** (important, security) — GET /tasks/orphans exposes all orphan tasks with no user-scope filter — `apps/api/src/tasks/tasks.controller.ts:224-233`
- **SEC-013** (important, security) — skills:read exposes org-wide user emails via GET /skills/:id and GET /skills/search/:skillId — SEC-030 mitigation is incomplete — `apps/api/src/skills/skills.service.ts:117-154 and 501-530`
- **SEC-004** (important, security) — epics.create() bypasses project-membership check — `apps/api/src/epics/epics.service.ts:19-29`
- **SEC-011** (important, security) — CSV exports do not sanitize formula-injection prefixes (CWE-1236) — `apps/api/src/tasks/tasks.service.ts:2057-2075`

## Cluster analysis

Findings sharing a root cause are grouped so the fix can be applied transversally. Phase recommendation: lower = address first.

### Cluster A — Missing authorization scope gates on resource endpoints (IDOR / privilege escalation)
*Phase 1 · 12 findings*

**Root cause** — Multiple controllers omit @CurrentUser (or @CurrentUserRoleCode) from their handler signatures, so the service never receives caller identity. Services that do accept a caller ID often have no membership or scope guard on create/read paths, while sibling update/delete paths are guarded. The result is that any authenticated user holding the relevant permission can read or mutate resources in projects they are not a member of.

**Transversal remediation** — Audit every controller handler: any endpoint that returns or mutates a resource scoped to a project or user MUST extract @CurrentUser and @CurrentUserRoleCode and pass both to the service. Services must apply a fail-closed membership/scope gate (throw ForbiddenException when userId is missing AND role lacks the *:readAll / *:manageAny permission). Add an E2E smoke test asserting that a CONTRIBUTEUR on project A gets 403 on project B resources.

**Findings** — SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013

### Cluster D — Non-atomic multi-step writes — missing $transaction wrappers create TOCTOU windows and partial-update states
*Phase 1 · 8 findings*

**Root cause** — Multiple service methods issue two or more Prisma calls (read-check-write, write-then-audit, delete-then-update, create-then-assign) as independent round-trips without a $transaction wrapper. The pattern is consistent: the operation was implemented correctly in one method (e.g. update() wrapped, create() not), then sibling methods were added or refactored without matching the atomicity. The departments.remove() TOCTOU is a specific case of this broader pattern.

**Transversal remediation** — Apply a code-review checklist: every method that contains >1 prisma.* call must use $transaction unless explicitly justified. Priority: DAT-001 (stopRecurrence, blocking data corruption), DAT-003/DAT-004 (user create/import ghost-user risk), COR-029 (daily-cap race), COR-030 (bulkUpdate settings). Wrap the departments.remove count-check+delete in a $transaction and add a P2003/P2025 catch clause. Add a shared helper assertExistsOrThrow(tx, model, id) to centralize the check-then-act pattern.

**Findings** — DAT-002, DAT-003, DAT-004, DAT-006, DAT-001, COR-029, COR-030, COR-031

### Cluster E — Unbounded date-range expansion — O(N_days) in-memory iteration with no span cap
*Phase 1 · 2 findings*

**Root cause** — Both the telework generate-schedules endpoint and the planning overview endpoint accept arbitrary startDate/endDate with no maximum span validation in the DTO. The service expands these day-by-day in memory. The 366-day guard present in findAll was not replicated in generateSchedulesFromRules, and PlanningOverviewQueryDto has no span constraint at all.

**Transversal remediation** — Add a @MaxDateSpanDays(366) custom class-validator decorator and apply it to GenerateSchedulesDto and PlanningOverviewQueryDto. Add a shared service-level guard (assertSpanDaysNotExceeded) in the planning and telework services. Add an E2E test sending a 10-year span and asserting 400.

**Findings** — PER-001, PER-002

### Cluster F — checkCircularDependency uses the outer this.prisma client inside a $transaction — SERIALIZABLE isolation is defeated
*Phase 1 · 2 findings*

**Root cause** — checkCircularDependency accepts no tx parameter and always reads from this.prisma (a separate autocommit connection). The $transaction callback passes a tx client but never threads it into the helper. As a consequence the SERIALIZABLE isolation level protecting the insert does not cover the BFS read, creating a real data-race for dependency cycles. Separately, the helper also fetches the global task_dependency table with no WHERE clause (the performance dimension of the same design flaw).

**Transversal remediation** — Refactor checkCircularDependency(fromId, toId, tx?) so it accepts an optional tx parameter, defaulting to this.prisma, and pass the tx client at every call site inside a $transaction. Separately, scope the initial findMany to the relevant project (add a WHERE projectId = targetTask.projectId join) to eliminate the global table scan.

**Findings** — COR-001, PER-003

### Cluster M — Docker/deploy configuration drift — standalone and all-in-one containers missing required secrets, hardcoded credentials, and security hardening
*Phase 1 · 11 findings*

**Root cause** — The standalone compose and all-in-one Dockerfile/supervisord were not kept in sync when production hardening was applied to docker-compose.prod.yml. Required env vars (AUDIT_HASH_KEY, METRICS_TOKEN, RBAC_GUARD_MODE) are absent from the standalone targets, causing crash-loops on boot. Additional issues: hardcoded DB credentials baked into image layers, unquoted env-var shell injection in entrypoint.sh, Redis password exposed in process list via -a flag, missing root .dockerignore, certbot image unpinned.

**Transversal remediation** — Sync standalone compose with prod: add AUDIT_HASH_KEY/:?REQUIRED, METRICS_TOKEN, RBAC_GUARD_MODE=enforce. Remove hardcoded DATABASE_URL and JWT_SECRET from all-in-one Dockerfile ENV layer; document them as required runtime vars. Fix entrypoint.sh to quote ADMIN_PASSWORD via a heredoc node script or a bcrypt CLI call (not inline -e). Replace redis-cli -a with REDISCLI_AUTH env var to hide password from process list. Add a root .dockerignore excluding .env*, secrets/, and dist/. Pin certbot to a specific digest. Align all-in-one nginx.conf security headers with main nginx/nginx.conf.

**Findings** — SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033

### Cluster B — DTO input validation gaps — missing @MaxLength, @IsUUID, @IsDateString, @ArrayMaxSize
*Phase 2 · 19 findings*

**Root cause** — A mix of omissions: (1) the shared @IsStrongPassword() helper deliberately omits @MaxLength, leaving bcrypt-fed fields unbounded; (2) import/update DTOs were not kept in sync with their Create counterparts when MaxLength decorators were added; (3) UUID-typed FK arrays use @IsString instead of @IsUUID; (4) date fields use @IsString instead of @IsDateString; (5) array fields lack @ArrayMaxSize. The common thread is no shared-base-class pattern enforcing these constraints and no lint rule to flag unbounded string fields.

**Transversal remediation** — Introduce shared base DTOs using class-transformer inheritance (CreateTaskDto extends a BaseTaskDto that enforces all string bounds). Add a project-wide custom ESLint rule that flags any @IsString() field in a DTO without a companion @MaxLength(). Apply @MaxLength to all bcrypt-fed password fields. Replace @IsString with @IsUUID where the field is a FK. Replace @IsString with @IsDateString on all date inputs. Add @ArrayMaxSize to all unbounded array fields. Run a one-pass sweep of all dto files against this checklist.

**Findings** — SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

### Cluster C — Local-timezone date arithmetic instead of UTC — incorrect midnight boundaries and month/year bucketing
*Phase 2 · 9 findings*

**Root cause** — Widespread use of getMonth(), getFullYear(), setHours(0,0,0,0), setDate(getDate()+N), and getHours()/getMinutes() which all operate in the Node.js process's local timezone. The codebase uses @db.Date (UTC midnight) and Prisma DateTime (UTC), so these calls produce shifted query bounds and wrong grouping keys on any server not running UTC.

**Transversal remediation** — Introduce a shared date-utils module exporting toUTCMidnight(date), toUTCStartOfMonth(y,m), advanceDaysUTC(date,n), getUTCMonthIndex(date), and extractUTCHHMM(date). Replace all local-TZ usages in telework, events, planning-export, projects, and personal-todos with these helpers. Add a CI lint rule forbidding direct .setHours/.getMonth/.getDate usage outside the date-utils module. Add a unit test suite for each helper covering DST-boundary dates.

**Findings** — COR-004, COR-005, COR-020, COR-022, COR-010, COR-023, COR-026, COR-027, COR-035

### Cluster I — Backend analytics services materialise unbounded row sets for in-JS aggregation
*Phase 2 · 4 findings*

**Root cause** — Analytics services (RecentActivity, MilestonesCompletion, TasksBreakdown, captureSnapshots) fetch all rows for the caller's scope with no take limit because they compute distributions (status/priority counts) in JavaScript. The correct pattern for these is a DB-side groupBy query which transfers only the aggregate output.

**Transversal remediation** — Rewrite each analytics fetch as a Prisma groupBy query: prisma.task.groupBy({ by: ['status','priority'], _count: true, where: projectScope }). captureSnapshots should use groupBy per project. Add a take guard as a backstop for any remaining findMany that cannot be converted. Add a regression test asserting each analytics endpoint returns within 500ms against a 10,000-task seed.

**Findings** — PER-005, PER-016, PER-017, PER-018

### Cluster J — Audit coverage gaps — organizational and configuration mutations emit no audit rows
*Phase 2 · 7 findings*

**Root cause** — The initial audit-coverage expansion (OBS-007..OBS-024) focused on leaf transactional events (leave lifecycle, user CRUD, RBAC changes). Structural/configuration mutations — org units (departments, services), HR configuration (leave types), project-hierarchy entities (epics, milestones), collaboration (comments), and predefined-task assignments — were never in scope. The AuditAction enum has no codes for these entity types.

**Transversal remediation** — Add AuditAction codes for DEPARTMENT_*, SERVICE_*, LEAVE_TYPE_*, EPIC_*, MILESTONE_*, COMMENT_DELETED_BY_ADMIN, PREDEFINED_TASK_ASSIGNMENT_*. Inject AuditPersistenceService into the corresponding service constructors. Emit an audit row on every state-changing mutation. Add the revokeAllForUser session-termination event to the password-change audit payload.

**Findings** — OBS-003, OBS-004, OBS-005, OBS-007, OBS-010, OBS-011, OBS-012

### Cluster K — Audit requestId correlation absent from AuditPersistenceService — business events cannot be correlated to HTTP requests
*Phase 2 · 1 findings*

**Root cause** — AuditService.log() (used for auth/RBAC events) injects the ALS-based requestId via getRequestId(). AuditPersistenceService.log() (used for all business events: tasks, projects, milestones, time-entries) has no requestId parameter and no ALS import. Only the security-envelope path has correlation; all business-mutation rows are uncorelatable to specific HTTP requests.

**Transversal remediation** — Add getRequestId() from the ALS context to AuditPersistenceService.log(). It should be injected unconditionally and fall back to null when the ALS context is absent (background jobs, seeds). This single change propagates requestId to all 50+ call sites automatically. Add a test asserting that a POST /tasks request produces an audit row with a non-null requestId.

**Findings** — OBS-002

### Cluster L — Missing DB-level CHECK constraints on numeric and date columns
*Phase 2 · 5 findings*

**Root cause** — The CHECK constraint migration sweep (DAT-004/DAT-008/DAT-015/DAT-032/DAT-033) covered time_entries, leave_balances, subtask positions, and project_snapshots but omitted tasks (date ordering), projects/tasks (non-negative hours/estimates), project_snapshots (cross-column tasksDone <= tasksTotal), leave_balances (year range), and leave.days upper bound.

**Transversal remediation** — Write a single migration (dat_checks_phase2) adding: CHECK (tasks.startDate IS NULL OR tasks.endDate IS NULL OR endDate >= startDate); CHECK (projects.budgetHours IS NULL OR budgetHours >= 0); CHECK (tasks.estimatedHours IS NULL OR estimatedHours >= 0); CHECK (project_snapshots.tasksDone <= project_snapshots.tasksTotal); CHECK (leave_balances.year BETWEEN 1900 AND 2200); CHECK (leaves.days <= 365). Test in a migration dry-run against prod data before applying.

**Findings** — DAT-014, DAT-015, DAT-022, DAT-026, DAT-027

### Cluster G — Frontend service methods hardcode limit=1000 — full-table fetches on every page load
*Phase 3 · 6 findings*

**Root cause** — All frontend service methods that replaced the backend's 10-row default used limit=1000 as a safe ceiling without defining a practical upper bound or implementing pagination. With multiple 1000-row fetches on a single page (users + projects + leaves + milestones), total transferred payload can reach megabytes for growing organisations.

**Transversal remediation** — Introduce paginated versions of all list service methods (cursor or offset+limit). Remove hardcoded limit=1000 defaults. For pages that genuinely need full lists (dropdowns), replace with server-side search endpoints. Coordinate with the backend to expose search/autocomplete endpoints for user and project dropdowns.

**Findings** — PER-020, PER-006, PER-007, PER-008, PER-012, PER-019

### Cluster H — Frontend fetch inefficiency — serial waterfall calls, full re-fetch on every mutation, no TanStack Query cache reuse
*Phase 3 · 9 findings*

**Root cause** — Pages were authored in the classic CSR useEffect pattern before TanStack Query hooks were available. Sequential awaits replaced Promise.all, full fetchData() calls replaced targeted cache invalidation, and the majority of pages remain use client with no RSC shell. The result is 3-5x longer TTFB on page load and high re-fetch frequency on common interactions.

**Transversal remediation** — Migrate list queries to TanStack Query hooks (useUsers, useProjects, useTasks already exist — extend to all pages). Replace sequential awaits with Promise.all for independent fetches. Add optimistic updates for status-toggle mutations. Pre-index getDayCell inputs by (userId, date) using useMemo in usePlanningData. Align staleTime across analytics widgets to 5 minutes.

**Findings** — PER-021, PER-009, PER-010, PER-022, PER-011, PER-013, PER-023, PER-024, PER-025

### Cluster N — Test quality gaps — false-green smoke tests, missing negative paths, and controller spec coverage
*Phase 3 · 9 findings*

**Root cause** — Three overlapping patterns: (1) legacy E2E root specs use UI-form login instead of storage-state tokens; (2) @smoke kanban tests use data-guard skip logic that makes them report green when seed data is absent; (3) controller specs and web service tests cover only happy-path delegation without error-path assertions; (4) rbac-escalation tests accept 404 as a valid blocked-access response, masking guard bypasses.

**Transversal remediation** — Migrate 5 legacy root specs to asRole() + storage-state auth. Convert @smoke kanban tests to assert seed data is present (test.fail on missing seed rather than test.skip). Extend the top 5 highest-risk controller specs (settings, roles, users, tasks, leaves) with service-throws-NotFoundException/ForbiddenException paths. Replace 404-acceptance in rbac-escalation with a real resource pre-created in beforeEach. Extend web service tests for auth.service pattern of error-path coverage to leaves, tasks, and projects services.

**Findings** — TST-001, TST-002, TST-003, TST-004, TST-005, TST-006, TST-007, TST-008, TST-009

## Findings (full detail)

Every confirmed finding is listed individually below, grouped by category and ordered by severity.

### Security (33)

#### SEC-001 — AUDIT_HASH_KEY missing from standalone and all-in-one deployments — API crash-loops on boot

**🔴 blocking** · `docker-compose.standalone.yml:59-77` · confidence: high · cluster M · secret_management

docker-compose.standalone.yml does not pass AUDIT_HASH_KEY, METRICS_TOKEN, or RBAC_GUARD_MODE to the API container. The app's main.ts asserts AUDIT_HASH_KEY at boot (via assertAuditHashKey) and refuses to start without it in any environment. METRICS_TOKEN is required in prod (the docker-compose.prod.yml uses :? mandatory syntax). RBAC_GUARD_MODE defaults to permissive without explicit enforcement, allowing routes without RBAC decorators. The standalone compose is explicitly designed for production-style deployments.

```
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER:-orchestr_a}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-orchestr_a}?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required (min 32 characters)}
```

- **Root cause**: The standalone compose was not kept in sync with the security requirements added to docker-compose.prod.yml. The prod compose uses :?REQUIRED syntax for AUDIT_HASH_KEY, METRICS_TOKEN, and sets RBAC_GUARD_MODE=enforce; the standalone omits all three.
- **Impact**: Any deployment using docker-compose.standalone.yml will have the API immediately crash-loop (AUDIT_HASH_KEY assertion), or if somehow bypassed, run in permissive RBAC mode (all undecorated routes open) and expose an unauthenticated /api/metrics endpoint.
- **Suggested fix**: Add to the api environment block: AUDIT_HASH_KEY: ${AUDIT_HASH_KEY:?AUDIT_HASH_KEY is required}, METRICS_TOKEN: ${METRICS_TOKEN:?METRICS_TOKEN required}, RBAC_GUARD_MODE: enforce. Mirror exactly what docker-compose.prod.yml provides at lines 127-138.
- **Acceptance criteria**:
  - docker-compose.standalone.yml api.environment includes AUDIT_HASH_KEY with :? mandatory syntax
  - docker-compose.standalone.yml api.environment includes METRICS_TOKEN with :? mandatory syntax
  - docker-compose.standalone.yml api.environment sets RBAC_GUARD_MODE: enforce
- **Verification**: `grep -n 'AUDIT_HASH_KEY\|METRICS_TOKEN\|RBAC_GUARD_MODE' docker-compose.standalone.yml`
- **Related**: SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033
- **Notes**: The same gap exists in docker/all-in-one/supervisord.conf line 51 which also omits AUDIT_HASH_KEY from the API program's environment directive.

#### SEC-002 — Missing @MaxLength on password fields fed to bcrypt — CPU exhaustion vector

**🟠 important** · `apps/api/src/users/dto/change-password.dto.ts:10-11` · confidence: high · cluster B · input-validation / bcrypt-cpu-exhaustion

ChangePasswordDto.currentPassword has only @IsString() and no @MaxLength. An authenticated attacker can send an arbitrarily long string (up to the 1 MiB body limit) that is fed directly to bcrypt.compare() at cost factor 12. The same issue exists on newPassword in ChangePasswordDto (via @IsStrongPassword() which has no MaxLength), on AdminResetPasswordDto.newPassword, and on RegisterDto.password. LoginDto.password explicitly notes SEC-003 'cap at 1024 chars — bcrypt is CPU-intensive; without an upper bound an attacker can exhaust server CPU' — but three other password fields in the same codebase lack this protection.

```
  @IsString()
  currentPassword: string;
```

- **Root cause**: @IsStrongPassword() (password-policy.ts) applies IsString() + MinLength(8) + Matches(regex) but deliberately omits @MaxLength, so every DTO field that uses it inherits no upper bound. The fix was applied to LoginDto.password explicitly, but was not applied to the other bcrypt-fed fields.
- **Impact**: An authenticated user (any role) can POST /users/me/change-password with a ~1 MB currentPassword or newPassword, forcing one bcrypt.compare + bcrypt.hash at cost=12. With enough concurrent requests, this saturates the Node.js event loop on the single-process API. The /users/:id/reset-password and /auth/register paths are also exposed. All three paths require either auth or throttle bypasses, which limits the practical attack surface but does not eliminate it.
- **Suggested fix**: Add @MaxLength(1024) to ChangePasswordDto.currentPassword and to @IsStrongPassword() itself (or as a separate decorator applied alongside it). Also apply the same cap to AdminResetPasswordDto.newPassword (users/dto/reset-password.dto.ts) and ensure RegisterDto.password and all bcrypt-fed fields share the same ceiling. The number 1024 matches the documented SEC-003 rationale.
- **Acceptance criteria**:
  - ChangePasswordDto.currentPassword carries @MaxLength(1024)
  - All fields decorated with @IsStrongPassword() are also bounded by @MaxLength(1024) — either via the decorator itself or at the call site
  - POST /users/me/change-password with a 2000-char currentPassword returns 400
  - Existing tests pass with the constraint added
- **Verification**: `grep -n 'MaxLength' apps/api/src/users/dto/change-password.dto.ts apps/api/src/users/dto/reset-password.dto.ts apps/api/src/auth/dto/register.dto.ts apps/api/src/common/validators/password-policy.ts`
- **Related**: SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021
- **Notes**: The same missing @MaxLength affects: (1) ChangePasswordDto.currentPassword and .newPassword; (2) AdminResetPasswordDto.newPassword (apps/api/src/users/dto/reset-password.dto.ts line 3-6); (3) RegisterDto.password. All four ultimately call bcrypt.hash or bcrypt.compare. Body limit (1 MiB) is the only defence currently in place.

#### SEC-003 — POST /leaves/import bypasses declare-for-others authorization; validateImport is a user enumeration oracle

**🟠 important** · `apps/api/src/leaves/leaves.controller.ts:286-319` · confidence: high · cluster A · authorization

Both bulk-import endpoints require only `leaves:create`, the same permission any regular contributor holds to create their own leave. The import service ignores `currentUserId` entirely (marked `eslint-disable @typescript-eslint/no-unused-vars` at line 3538) and creates leave rows for arbitrary users resolved purely by CSV email, with no `leaves:declare_for_others` or `leaves:manage` check. The `POST /leaves/create` path (lines 367-420 of the service) enforces both `leaves:declare_for_others` and the service-perimeter check for any non-self `targetUserId`; the import path has neither. Additionally, `POST /leaves/import/validate` returns `resolvedUser: { id, email, name }` for every email in the CSV, turning the endpoint into a user enumeration oracle for `leaves:create` holders.

```
  @Post('import/validate')
  @RequirePermissions('leaves:create')
  ...
  validateImport(@Body() importLeavesDto: ImportLeavesDto) {
    return this.leavesService.validateLeavesImport(importLeavesDto.leaves);
  }

  @Post('import')
  @RequirePermissions('leaves:create')
  ...
  importLeaves(
    @Body() importLeavesDto: ImportLeavesDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.leavesService.importLeaves(
```

- **Root cause**: The import path was added without porting the authorization checks present in the regular `create()` path. `currentUserId` is accepted as a parameter but immediately silenced, and the service loops directly from CSV email -> user object -> `tx.leave.create` without checking whether the caller is allowed to declare leaves for that target user.
- **Impact**: Any user with `leaves:create` (CONTRIBUTEUR and above) can create leave records for arbitrary active users in the system, including managers and admins, potentially triggering balance consumption, validator notifications, or payroll exports for fabricated absences. The validate endpoint also leaks full name + UUID for any email in the user table.
- **Suggested fix**: 1. Raise the required permission to `leaves:declare_for_others` (or add a secondary `@RequirePermissions` check at service entry). 2. In `importLeaves`, replicate the perimeter check from `create()`: verify the caller's role scope covers each target user before inserting. 3. In `validateLeavesImport`, omit or redact `resolvedUser` for callers without `leaves:declare_for_others`.
- **Acceptance criteria**:
  - A CONTRIBUTEUR with only `leaves:create` receives 403 on POST /leaves/import with a foreign user email
  - A MANAGER with `leaves:declare_for_others` can import only within their service perimeter
  - POST /leaves/import/validate does not return resolvedUser.id/name to callers without declare-for-others permission
  - Existing import tests pass with an ADMIN or RESPONSABLE caller
- **Verification**: `grep -n 'currentUserId\|no-unused-vars\|eslint-disable' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leaves/leaves.service.ts | grep -A2 -B2 '3538'`
- **Related**: SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013
- **Notes**: The asymmetry with create() is deliberate evidence: lines 367-420 call accessScopeService.assertCanDeclareFor(currentUserId, targetUserId); that call is absent in importLeaves.

#### SEC-004 — epics.create() bypasses project-membership check

**🟠 important** · `apps/api/src/epics/epics.service.ts:19-29` · confidence: high · cluster A · authorization

Any authenticated user holding the `epics:create` permission can create an epic in any project, even one they are not a member of. The controller passes no `currentUser` to the service (epics.controller.ts line 41-43), and the service only verifies the project exists — it does not call `assertProjectMembership`. By contrast, `epics.update` and `epics.remove` do call `assertProjectMembership`. CONTRIBUTEUR users carry `epics:create` via COMMON_BASE.

```
  async create(createEpicDto: CreateEpicDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createEpicDto.projectId },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    return this.prisma.epic.create({
      data: createEpicDto,
      include: { project: { select: { id: true, name: true } } },
    });
  }
```

- **Root cause**: The controller handler for `POST /epics` does not extract or forward the current user to the service, and the service has no fallback membership gate. The inconsistency with update/delete (which do enforce membership) confirms it is an oversight, not a design choice.
- **Impact**: A low-privilege authenticated user (CONTRIBUTEUR or higher) can inject epics into any project in the system, including projects they have no membership in. This breaks project isolation and contaminates another team's work scope.
- **Suggested fix**: In `epics.controller.ts`, inject `@CurrentUser('id') userId: string` and `@CurrentUserRoleCode() userRole: string | null` into the `create` handler and pass them to `epicsService.create()`. In the service, call `assertProjectMembership` on the target project before creating. Because the epic does not exist yet, the membership check must target `projectId` from the DTO directly (not via epicId like update/delete do).
- **Acceptance criteria**:
  - POST /epics from a user not a member of the target project returns 403
  - POST /epics from a project member succeeds
  - POST /epics from an ADMIN (projects:manage_any) bypasses the membership check and succeeds
- **Verification**: `grep -n 'async create' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/epics/epics.service.ts`
- **Related**: SEC-003, SEC-017, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013
- **Notes**: epics.update() and epics.remove() at lines 94-142 correctly call assertProjectMembership — this inconsistency is the strongest proof the create case is a bug.

#### SEC-005 — milestones.create() bypasses project-membership check

**🟠 important** · `apps/api/src/milestones/milestones.service.ts:46-62` · confidence: high · cluster A · authorization

Any authenticated user holding `milestones:create` can create a milestone in any project. The controller handler (milestones.controller.ts lines 68-70) passes no currentUser to the service. The service only verifies project existence. By contrast, `milestones.update` and `milestones.remove` call `assertProjectMembership`. CONTRIBUTEUR carries `milestones:create` via COMMON_BASE.

```
  async create(createMilestoneDto: CreateMilestoneDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: createMilestoneDto.projectId },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const { dueDate, ...data } = createMilestoneDto;

    return this.prisma.milestone.create({
      data: {
        ...data,
        dueDate: new Date(dueDate),
        status: MilestoneStatus.PENDING,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }
```

- **Root cause**: Same pattern as epics.create: controller does not forward currentUser, service has no membership gate on create path.
- **Impact**: Low-privilege authenticated users can inject milestones into projects they are not members of, polluting project planning data across organisational boundaries.
- **Suggested fix**: Inject `@CurrentUser('id')` and `@CurrentUserRoleCode()` into the `create` controller handler, pass them to `milestonesService.create()`. In the service, resolve the caller's permissions and call a targeted `projectMember.count` check on `createMilestoneDto.projectId` before writing.
- **Acceptance criteria**:
  - POST /milestones from a non-member user returns 403
  - POST /milestones from a project member succeeds
  - POST /milestones from an ADMIN bypasses the membership check
- **Verification**: `grep -n 'async create' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/milestones/milestones.service.ts`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013

#### SEC-006 — milestones.findAll() returns all milestones with no user-scope filter

**🟠 important** · `apps/api/src/milestones/milestones.service.ts:64-99` · confidence: high · cluster A · authorization

GET /milestones returns milestones from every project in the system when no projectId filter is supplied, regardless of the caller's project memberships. The controller (milestones.controller.ts lines 79-87) does not extract or pass currentUser, so the service receives no userId/userRole. Compare with `epics.findAll()` which explicitly implements a `membershipFilter` scoped by `projects:manage_any`.

```
  async findAll(
    page = 1,
    limit = 1000,
    projectId?: string,
    status?: MilestoneStatus,
  ) {
    const safeLimit = Math.min(limit || 1000, 1000);
    const skip = (page - 1) * safeLimit;
    const where: Prisma.MilestoneWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
```

- **Root cause**: Controller signature omits `@CurrentUser` / `@CurrentUserRoleCode` decorators; service has no membership filter path for callers without project scope.
- **Impact**: Any authenticated user with `milestones:read` can enumerate milestones — and their attached project names/IDs — across all projects in the organisation, bypassing project-level confidentiality.
- **Suggested fix**: Add `@CurrentUser('id') userId: string` and `@CurrentUserRoleCode() userRole: string | null` parameters to the `findAll` controller handler and thread them through to the service. In the service, mirror the `membershipFilter` pattern already present in `epics.findAll` (lines 43-50 of epics.service.ts).
- **Acceptance criteria**:
  - GET /milestones without projectId returns only milestones from projects the caller is a member of
  - GET /milestones with a projectId the caller is not a member of returns empty or 403
  - ADMIN (projects:manage_any) still sees all milestones
- **Verification**: `grep -n 'findAll' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/milestones/milestones.service.ts | head -5`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013

#### SEC-007 — milestones.findOne() returns full project row with no access-scope check

**🟠 important** · `apps/api/src/milestones/milestones.service.ts:101-111` · confidence: high · cluster A · authorization

GET /milestones/:id returns the milestone and its full parent project row (`project: true`) to any caller with `milestones:read`. There is no membership check. The controller (line 92-94) passes no currentUser. The `project: true` include exposes budget, dates, createdById and all other project columns cross-project. Compare: tasks.findOne calls `assertCanReadTask`, projects.findOne calls `assertCanAccessProject`.

```
  async findOne(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone introuvable');
    return milestone;
  }
```

- **Root cause**: Controller omits CurrentUser; service has no access-scope guard on this read path.
- **Impact**: An authenticated user can read the complete record of any project in the organisation by guessing or iterating any milestone UUID belonging to that project. This is an IDOR amplified by the full project include.
- **Suggested fix**: Add a membership check (or replace `project: true` with `project: { select: { id: true, name: true } }`) and pass currentUser through. Use `prisma.projectMember.count` to verify membership before returning the full object.
- **Acceptance criteria**:
  - GET /milestones/:id for a milestone in a project the caller is not a member of returns 403
  - Full project row is not exposed to non-members
- **Verification**: `grep -n 'findOne' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/milestones/milestones.service.ts | head -5`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013

#### SEC-008 — epics.findOne() returns full project row with no access-scope check

**🟠 important** · `apps/api/src/epics/epics.service.ts:82-92` · confidence: high · cluster A · authorization

GET /epics/:id returns the epic and its full parent project row (`project: true`) to any caller with `epics:read`. The controller (line 71-73) passes no currentUser. No membership check is present. The same amplification as milestones.findOne: the full project object (budgets, dates, internal metadata) is returned to a caller who may have no membership in that project.

```
  async findOne(id: string) {
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: { select: { id: true, title: true, status: true } },
      },
    });
    if (!epic) throw new NotFoundException('Epic introuvable');
    return epic;
  }
```

- **Root cause**: Controller omits CurrentUser; service has no access-scope guard on this read path.
- **Impact**: IDOR: any authenticated user with `epics:read` can retrieve full project metadata by providing any epic UUID from a project they are not a member of.
- **Suggested fix**: Inject `@CurrentUser` into the controller handler; add a `projectMember.count`-based guard or replace `project: true` with `project: { select: { id: true, name: true } }` and add membership assertion.
- **Acceptance criteria**:
  - GET /epics/:id for an epic in a project the caller is not a member of returns 403
  - Full project row is not exposed to non-members
- **Verification**: `grep -n 'findOne' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/epics/epics.service.ts | head -5`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013

#### SEC-009 — Milestone import endpoints bypass project-membership check

**🟠 important** · `apps/api/src/milestones/milestones.controller.ts:137-179` · confidence: high · cluster A · authorization

POST /milestones/project/:projectId/import/validate and POST /milestones/project/:projectId/import both omit `@CurrentUser` from the handler signature, so neither passes a user identity to the service. The service methods do not have an independent membership check either. Both endpoints accept up to the DTO-bounded set of milestone objects and write them into the specified project without verifying the caller is a project member.

```
  validateImport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importMilestonesDto: ImportMilestonesDto,
  ) {
    return this.milestonesService.validateImport(
      projectId,
      importMilestonesDto.milestones,
    );
  }

  ...

  importMilestones(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() importMilestonesDto: ImportMilestonesDto,
  ) {
    return this.milestonesService.importMilestones(
      projectId,
      importMilestonesDto.milestones,
    );
  }
```

- **Root cause**: Controller handlers for import and validate-import do not extract the current user, and the service methods have no membership enforcement path.
- **Impact**: Same as milestones.create but potentially more damaging: a non-member can bulk-import milestones (potentially hundreds per request) into any project.
- **Suggested fix**: Inject `@CurrentUser('id')` and `@CurrentUserRoleCode()` into both handlers, thread them to the service, and add a membership check at the start of `validateImport` and `importMilestones` before any DB writes.
- **Acceptance criteria**:
  - POST /milestones/project/:projectId/import from a non-member returns 403
  - POST /milestones/project/:projectId/import/validate from a non-member returns 403
- **Verification**: `grep -n 'validateImport\|importMilestones' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/milestones/milestones.controller.ts`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-010, SEC-012, SEC-020, SEC-013

#### SEC-010 — GET /tasks/orphans exposes all orphan tasks with no user-scope filter

**🟠 important** · `apps/api/src/tasks/tasks.controller.ts:224-233` · confidence: high · cluster A · authorization

The `findOrphans` handler does not extract a currentUser and passes none to the service. The service returns the first 200 orphan tasks system-wide with assignee details (id, firstName, lastName, avatarUrl). All other task-read endpoints pass currentUser to the access-scope service (`assertCanReadTask`, `taskReadWhere`). CONTRIBUTEUR carries `tasks:read` via COMMON_BASE.

```
  @Get('orphans')
  @RequirePermissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer les tâches orphelines (sans projet)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des tâches orphelines',
  })
  findOrphans() {
    return this.tasksService.findOrphans();
  }
```

- **Root cause**: No `@CurrentUser` parameter in the controller handler; the service `findOrphans` method has no userId filter path.
- **Impact**: Any authenticated user can enumerate all projectless tasks in the organisation, leaking task titles, descriptions, and assignee personal data (names, avatars) belonging to other users and teams.
- **Suggested fix**: Inject `@CurrentUser('id') userId: string` and `@CurrentUserRoleCode() userRole: string | null` into the handler. In the service, check `tasks:manage_any` permission — if absent, filter orphan tasks to those created by or assigned to the current user (matching the CLAUDE.md note that orphan tasks represent personal/cross-cutting work).
- **Acceptance criteria**:
  - GET /tasks/orphans for a CONTRIBUTEUR returns only tasks they created or are assigned to
  - GET /tasks/orphans for an ADMIN returns all orphan tasks
- **Verification**: `grep -n 'findOrphans' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/tasks/tasks.controller.ts`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-012, SEC-020, SEC-013

#### SEC-011 — CSV exports do not sanitize formula-injection prefixes (CWE-1236)

**🟠 important** · `apps/api/src/tasks/tasks.service.ts:2057-2075` · confidence: high · correctness

`escapeField` in both `tasks.service.ts` (line 2070) and `milestones.service.ts` (line 414) wraps fields containing `;`, `"`, or `\n` in quotes but does NOT sanitize Excel/LibreOffice formula-injection prefixes (`=`, `+`, `-`, `@`). User-controlled strings — task.title, task.description, milestone.name, milestone.description, subtask.title (via `join('|')`) — flow directly into CSV rows. A task named `=CMD|'/c calc'!A1` or `+SUM(...)` executes as a formula when the exported file is opened in a spreadsheet client (CWE-1236).

```
    const rows = tasks.map((task) => [
      task.title,
      task.description || '',
      task.status,
      task.priority,
      task.assignee?.email || '',
      task.milestone?.name || '',
      ...
    ]);

    const escapeField = (field: string) => {
      if (field.includes(';') || field.includes('"') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
      }
      return field;
    };
```

- **Root cause**: The `escapeField` helper was written to handle CSV delimiters and newlines but does not implement spreadsheet formula-injection protection.
- **Impact**: An attacker with `tasks:create` or `milestones:create` permission can craft a task/milestone title that, when a higher-privilege user exports the project CSV and opens it in Excel or LibreOffice, executes a formula — potentially triggering DDE payloads or exfiltrating data via external calls. The same vulnerability exists in `milestones.service.ts` line 414.
- **Suggested fix**: In `escapeField`, prepend a single-quote (`'`) to any field whose first character is `=`, `+`, `-`, or `@`. This is the OWASP-recommended mitigation for CSV injection. Alternatively, always quote all cells (not just those containing delimiters).
- **Acceptance criteria**:
  - A task with title `=1+1` exports as `'=1+1` in the CSV
  - A task with title `+SUM(A1:A2)` exports as `'+SUM(A1:A2)`
  - Normal titles without formula prefixes are unaffected
- **Verification**: `grep -n 'escapeField' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/tasks/tasks.service.ts /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/milestones/milestones.service.ts`

#### SEC-012 — ICS import endpoint bulk-creates Events under `leaves:create` — bypasses `events:create` permission gate

**🟠 important** · `apps/api/src/planning-export/planning-export.controller.ts:67-93` · confidence: high · cluster A · broken-access-control

Both `POST /planning-export/ics/import/preview` and `POST /planning-export/ics/import` are protected with `@RequirePermissions('leaves:create')`. However, `importIcs` calls `tx.event.createMany(...)` in `planning-export.service.ts`, effectively creating Event rows. The normal event-creation path (`POST /events`) requires `events:create`. Templates `HR_OFFICER` and `HR_OFFICER_LIGHT` carry `LEAVES_SELF_SERVICE` (which includes `leaves:create`) but do NOT carry `EVENTS_SELF_SERVICE` (which includes `events:create`). Any user bound to these two templates can bulk-create events through the ICS import endpoint, a privilege they cannot exercise through the standard events API.

```
@Post('ics/import/preview')
@RequirePermissions('leaves:create')
...
@Post('ics/import')
@RequirePermissions('leaves:create')
...
importIcs(@Body() dto: ImportIcsDto, @CurrentUser('id') userId: string) {
  return this.planningExportService.importIcs(dto.icsContent, userId);
}
```

- **Root cause**: The ICS import controller was decorated with the permission for the leave-import workflow (`leaves:create`) but the implementation also writes to the `event` table. The permission label does not match the operation's actual effect. Templates `HR_OFFICER` and `HR_OFFICER_LIGHT` (packages/rbac/templates.ts lines 611-640 and 645-656) include `LEAVES_SELF_SERVICE` but omit `EVENTS_SELF_SERVICE`, creating a gap.
- **Impact**: A user bound to `HR_OFFICER` or `HR_OFFICER_LIGHT` — roles specifically designed to deny event creation — can import an ICS file containing up to 500 VEVENT entries and bulk-create event rows in the database. The events are owned by their user ID (createdById), so they appear under normal event queries and are visible to other users with `events:readAll`.
- **Suggested fix**: Either (a) add `@RequirePermissions('leaves:create', 'events:create')` to both import routes so the guard requires both permissions, OR (b) add `EVENTS_SELF_SERVICE` to `HR_OFFICER` and `HR_OFFICER_LIGHT` templates if event creation is an intended capability for those roles. Option (a) is safer and preserves the template intent.
- **Acceptance criteria**:
  - A user holding only `leaves:create` (not `events:create`) receives HTTP 403 on `POST /planning-export/ics/import`
  - A user holding both `leaves:create` and `events:create` can successfully import ICS events
  - Unit test covers the dual-permission guard on both import routes
- **Verification**: `grep -n 'RequirePermissions' apps/api/src/planning-export/planning-export.controller.ts && grep -n 'EVENTS_SELF_SERVICE\|leaves:create' packages/rbac/templates.ts | grep -A2 -B2 'HR_OFFICER'`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-020, SEC-013
- **Notes**: Confirmed by cross-referencing templates.ts: HR_OFFICER (line 611) and HR_OFFICER_LIGHT (line 645) include LEAVES_SELF_SERVICE but not EVENTS_SELF_SERVICE. events:create appears only inside EVENTS_SELF_SERVICE (atomic-permissions.ts line 297) and two EXTERNAL templates that strip it (lines 922, 940).

#### SEC-013 — skills:read exposes org-wide user emails via GET /skills/:id and GET /skills/search/:skillId — SEC-030 mitigation is incomplete

**🟠 important** · `apps/api/src/skills/skills.service.ts:117-154 and 501-530` · confidence: high · cluster A · authorization

GET /skills/:id (findOne) and GET /skills/search/:skillId (findUsersBySkill) both return the `email` field for every user who holds the queried skill, scoped only by `skills:read`. The `skills:read` permission is granted to all project-participating roles from TECHNICAL_LEAD upward (via PROJECT_STRUCTURE_READ), making it broadly available across the organisation. The team previously recognised cross-user skill enumeration as a vulnerability and added SEC-030 to gate GET /skills/user/:userId — but the same sensitive data (email + department + role affiliation) is reachable through findOne and findUsersBySkill without any per-user scope check. Any `skills:read` holder can enumerate the full org's email directory by iterating skill IDs.

```
async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                avatarPreset: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
```

- **Root cause**: The SEC-030 scope gate was applied only to the getUserSkills endpoint (the one that takes a :userId param). The findOne and findUsersBySkill endpoints were not revisited when SEC-030 was implemented, leaving a symmetrical data exposure path.
- **Impact**: Any holder of skills:read (TECHNICAL_LEAD / PROJECT_CONTRIBUTOR and above) can retrieve the email addresses, departments, and role affiliations of all org users who hold any given skill by iterating GET /skills/:id or GET /skills/search/:skillId. This bypasses the managed-service perimeter that SEC-030 was designed to enforce, constituting an IDOR-class data exposure within the authentication perimeter.
- **Suggested fix**: Either: (a) remove `email: true` from the user select in findOne and findUsersBySkill (email is not needed to display who-has-what-skill on a skills page); or (b) apply `assertCanManageUser` scope checks analogous to SEC-030 before returning the result. Option (a) is simpler and preferred — the UI skill detail card only needs name/avatar/department. Additionally audit getSkillsMatrix (skills:manage_matrix required, so higher bar — lower urgency).
- **Acceptance criteria**:
  - GET /skills/:id response does NOT include email in the users array when caller has only skills:read
  - GET /skills/search/:skillId response does NOT include email when caller has only skills:read
  - Skills detail pages continue to render correctly without email field
  - Callers with skills:manage_matrix may optionally retain email if the matrix UX requires it
- **Verification**: `grep -n 'email: true' apps/api/src/skills/skills.service.ts`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020
- **Notes**: skills:read is in PROJECT_STRUCTURE_READ (atomic-permissions.ts line 232), included in PROJECT_CONTRIB_CAPACITIES and TECHNICAL_LEAD templates. findUsersBySkill additionally exposes role (full role code), isActive, and userServices (service names) — a richer enumeration payload than findOne.

#### SEC-022 — Metrics endpoint has no production startup assertion for METRICS_TOKEN

**🟠 important** · `apps/api/src/metrics/metrics.controller.ts:31-43` · confidence: high · authentication

The `/api/metrics` endpoint is decorated `@Public()` (bypasses JwtAuthGuard) and conditionally checks METRICS_TOKEN only when the env-var is set. When `METRICS_TOKEN` is absent the endpoint is fully unauthenticated. The startup checks in `main.ts` (lines 42–85) enforce JWT_SECRET strength, AUDIT_HASH_KEY presence, and RBAC_GUARD_MODE for production, but no analogous boot-time assertion warns or fails when `NODE_ENV=production` and `METRICS_TOKEN` is unset.

```
  @Get()
  getMetrics(
    @Headers('authorization') authorization: string | undefined,
  ): string {
    const token = process.env['METRICS_TOKEN'];
    if (token) {
      const expected = `Bearer ${token}`;
      const authHeader = authorization ?? '';
      // SEC-011: use constant-time comparison to prevent timing side-channels.
      // Must check lengths first — timingSafeEqual throws if buffers differ in length.
      const a = Buffer.from(authHeader);
      const b = Buffer.from(expected);
```

- **Root cause**: By design the endpoint is fail-open for development/test, but no production hardening assertion was added alongside the SEC-011 timing-safe comparison fix. The Prometheus scrape endpoint exposes per-route request counters, latency sums, and any future gauge values — all without authentication if the env-var is accidentally omitted.
- **Impact**: An unauthenticated attacker can enumerate all API routes, their call frequency, HTTP status codes and latency distributions. This information aids targeted attack planning (e.g., finding low-traffic admin endpoints, measuring response timing for oracle attacks). The current in-process gauge surface is empty, but future callers of `recordGauge()` (DB pool stats, Redis latency) would also be exposed.
- **Suggested fix**: Add to the `main.ts` boot assertions: `if (process.env.NODE_ENV === 'production' && !process.env.METRICS_TOKEN) { throw new Error('METRICS_TOKEN must be set in production to protect /api/metrics'); }`. This mirrors the SWAGGER_USER/SWAGGER_PASS guard already in place.
- **Acceptance criteria**:
  - API refuses to start in production when METRICS_TOKEN is absent
  - Warning or error is emitted to logs when METRICS_TOKEN is absent in non-production environments
  - Existing metrics E2E tests still pass with a test token set
- **Verification**: `NODE_ENV=production JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa AUDIT_HASH_KEY=bbb npx ts-node apps/api/src/main.ts 2>&1 | grep -i 'METRICS_TOKEN'`

#### SEC-023 — MetricsService.recordGauge() does not escape metric name or label string before Prometheus output

**🟠 important** · `apps/api/src/metrics/metrics.service.ts:89-92` · confidence: high · observability_injection

The `recordRequest()` method correctly escapes label values using an `esc()` function (backslash, double-quote, newline substitution per the Prometheus text format spec). However, `recordGauge()` stores the `name` and `labels` parameters verbatim and renders them unescaped in `renderMetrics()` at lines 147, 149, and 152: `# HELP ${metricName}`, `# TYPE ${metricName} gauge`, and `${metricName}{${labels}} ${value}`. Currently there are no production callers of `recordGauge()`, but the comment at lines 82–88 states PrismaService and RedisService are the intended callers.

```
  recordGauge(name: string, labels: string, value: number): void {
    const key = `${name}|${labels}`;
    this.gauges.set(key, { value });
  }
```

- **Root cause**: `recordGauge()` was added as an extension point (SA-OBS-009) and designed for internal callers with hardcoded label strings. The escaping logic from `recordRequest()` was not replicated, creating a latent injection vector if any future caller derives `labels` from external data (e.g., a database name or Redis host).
- **Impact**: If a future caller passes attacker-influenced data as `labels` or `name` (e.g., a project name from user input used as a gauge dimension), an adversary could inject newlines into the Prometheus text output to create fake metric series, corrupt existing series, or confuse Prometheus parsers — a label injection attack. Currently the risk is latent (no production callers), but the API surface is public (`@Public()`).
- **Suggested fix**: Apply the same `esc()` function to both `name` and `labels` inside `recordGauge()`, or apply it inside `renderMetrics()` when producing gauge output. Also add an `@IsAlphanumeric({ allow_underscores: true })` type-assertion comment to `recordGauge()`'s JSDoc to document the caller contract.
- **Acceptance criteria**:
  - Newline and double-quote characters in gauge name/labels are escaped in Prometheus output
  - Existing metrics spec test still passes
  - recordGauge callers document that inputs must be static strings
- **Verification**: `N/A — manual verification: check renderMetrics() output after calling recordGauge('test\ninjected', 'key="val\nnewline"', 1)`

#### SEC-024 — Hardcoded default DB credentials in all-in-one Dockerfile ENV layer

**🟠 important** · `docker/all-in-one/Dockerfile:150-159` · confidence: medium · cluster M · secret_management

The all-in-one Dockerfile bakes DATABASE_URL with credentials orchestr_a:orchestr_a and JWT_SECRET="" (empty string) directly into the image layer. These become the runtime values if the operator forgets to supply them at container startup. The docker-compose.offline.yml does not pass DATABASE_URL at all, so the baked-in credential is used. An empty JWT_SECRET means any self-signed JWT is accepted.

```
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=postgresql://orchestr_a:orchestr_a@localhost:5432/orchestr_a \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    JWT_SECRET="" \
    JWT_EXPIRES_IN=7d \
    CORS_ORIGIN=http://localhost:80 \
    ALLOWED_ORIGINS=http://localhost:80 \
    SWAGGER_ENABLED=false
```

- **Root cause**: The Dockerfile sets ENV defaults that should instead be documented as required runtime variables with no fallback. The offline compose does not override DATABASE_URL.
- **Impact**: Any deployment of the all-in-one image that does not explicitly override DATABASE_URL boots with trivially guessable DB credentials. An empty JWT_SECRET allows forging tokens for any user.
- **Suggested fix**: Remove DATABASE_URL and JWT_SECRET from the Dockerfile ENV layer. In the entrypoint.sh, the JWT_SECRET is already handled (auto-generated if absent). DATABASE_URL should be computed from the individually-required POSTGRES_PASSWORD env var that the offline compose already enforces, and the entrypoint already exports DATABASE_URL on line 109.
- **Acceptance criteria**:
  - docker/all-in-one/Dockerfile does not set DATABASE_URL in any ENV instruction
  - docker/all-in-one/Dockerfile does not set JWT_SECRET="" as a default
  - docker-compose.offline.yml passes DATABASE_URL or the entrypoint constructs it from required vars
- **Verification**: `grep -n 'DATABASE_URL\|JWT_SECRET' docker/all-in-one/Dockerfile`
- **Related**: SEC-001, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033

#### SEC-025 — ADMIN_PASSWORD env var interpolated unquoted into node -e string — code injection

**🟠 important** · `docker/all-in-one/entrypoint.sh:179` · confidence: high · cluster M · injection

ADMIN_PASS (sourced directly from ADMIN_PASSWORD env var on line 169) is interpolated into a JavaScript string passed to `node -e`. The value is wrapped in single quotes inside the JS string literal, but if ADMIN_PASSWORD contains a single quote followed by JavaScript code (e.g., `foo'); require('child_process').execSync('id > /tmp/pwned'); //`), it breaks out of the string and executes arbitrary JavaScript inside the container at startup. This is reachable only by whoever controls the container's ADMIN_PASSWORD env var.

```
    # Hash the password with bcrypt using node
    ADMIN_HASH=$(node -e "const bcrypt = require('bcrypt'); bcrypt.hash('${ADMIN_PASS}', 12).then(h => console.log(h));")
```

- **Root cause**: Shell variable expansion into an interpreted language string without sanitization or quoting-aware interpolation.
- **Impact**: If an attacker controls the ADMIN_PASSWORD environment variable (e.g., via a compromised CI/CD, Kubernetes secret, or docker run command), they can execute arbitrary code inside the container as the orchestr-a user during the first-boot seed step.
- **Suggested fix**: Pass ADMIN_PASS as a separate env var to node rather than interpolating it into the -e script: ADMIN_PASS_VAL="$ADMIN_PASS" node -e "const p=process.env.ADMIN_PASS_VAL; const bcrypt=require('bcrypt'); bcrypt.hash(p,12).then(h=>console.log(h));" — this avoids any quoting issue.
- **Acceptance criteria**:
  - ADMIN_PASS is not interpolated directly into the -e script string
  - ADMIN_PASS value is passed to node via environment variable and accessed as process.env inside the script
  - A test with ADMIN_PASSWORD containing single quotes does not break the script
- **Verification**: `N/A — manual verification: grep -n 'node -e' docker/all-in-one/entrypoint.sh`
- **Related**: SEC-001, SEC-024, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033

#### SEC-026 — Standalone compose exposes API port 4000 directly to 0.0.0.0 with no nginx/TLS layer

**🟠 important** · `docker-compose.standalone.yml:73-74` · confidence: high · cluster M · network_exposure

The standalone compose exposes the NestJS API port (default 4000) on all interfaces (0.0.0.0) without a reverse proxy. There is no nginx service, no TLS termination, no rate-limiting gateway, and no HTTP→HTTPS redirect. All API traffic — including authentication, JWT tokens in Authorization headers, and sensitive HR data — travels in cleartext. Contrast with docker-compose.prod.yml which binds nginx to loopback only and relies on the host nginx for TLS.

```
    ports:
      - "${API_PORT:-4000}:4000"
```

- **Root cause**: The standalone compose is designed for "quick deployment" scenarios and lacks a TLS/proxy layer. The web service (port 3000) has the same issue.
- **Impact**: On any internet-facing host, authentication credentials, JWT tokens, and all API requests are exposed in cleartext. An on-path attacker can intercept sessions and harvest JWT tokens from Authorization headers.
- **Suggested fix**: Either (a) add a nginx service with TLS to standalone compose analogous to prod, or (b) add a prominent warning in docker-compose.standalone.yml that TLS must be provided by an external reverse proxy and bind API/web ports to 127.0.0.1 by default.
- **Acceptance criteria**:
  - API and web ports in standalone compose are bound to 127.0.0.1 by default, OR
  - A mandatory external TLS proxy is documented and enforced
- **Verification**: `grep -n 'ports:' -A3 docker-compose.standalone.yml`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033

#### SEC-027 — No root .dockerignore — .env file included in Docker build context

**🟠 important** · `docker-compose.prod.yml:89-90` · confidence: high · cluster M · secrets_in_build_context

Both the api and web prod builds use build context "." (repo root). There is no .dockerignore at the repo root. The .dockerignore files in apps/api/ and apps/web/ are NOT used because Docker applies the .dockerignore relative to the build context root, not the Dockerfile directory. The repo root contains a .env file. Without a root-level .dockerignore, this .env (and any other sensitive file at the root) is sent to the Docker daemon as part of the build context blob. In a remote Docker daemon scenario this transmits secrets over the network.

```
      context: .
      dockerfile: ./apps/api/Dockerfile
```

- **Root cause**: Missing root-level .dockerignore. The per-app .dockerignore files only apply when the build context is that specific directory, not when the build context is the monorepo root.
- **Impact**: Dev credentials in .env (including DATABASE_URL with password, any set JWT_SECRET, etc.) are transmitted to the Docker build daemon. On a CI system with a remote Docker daemon, this is a credential leak.
- **Suggested fix**: Create a /.dockerignore at the repo root that at minimum includes: .env, .env.*, !.env.example, .env.production (even though gitignored, adds defense in depth).
- **Acceptance criteria**:
  - A .dockerignore file exists at the repo root
  - It excludes .env, .env.*, .env.production, and other secret files
  - docker build . -f apps/api/Dockerfile does not include .env in the context
- **Verification**: `docker build . -f apps/api/Dockerfile --no-cache 2>&1 | grep -i '.env' || echo 'no .env in build output'`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033

#### SEC-028 — AUDIT_HASH_KEY and METRICS_TOKEN absent from all-in-one supervisord program environment

**🟠 important** · `docker/all-in-one/supervisord.conf:51` · confidence: high · cluster M · secret_management

The supervisord program environment for the API process does not forward AUDIT_HASH_KEY or METRICS_TOKEN. The API asserts AUDIT_HASH_KEY at boot (any environment) and will crash-loop in the all-in-one container. METRICS_TOKEN absence leaves the /api/metrics endpoint open (no authentication). Even if the user passes AUDIT_HASH_KEY as a container env var, supervisord will not forward it to the Node process unless explicitly listed.

```
environment=NODE_ENV="production",PORT="4000",DATABASE_URL="%(ENV_DATABASE_URL)s",REDIS_HOST="%(ENV_REDIS_HOST)s",REDIS_PORT="%(ENV_REDIS_PORT)s",JWT_SECRET="%(ENV_JWT_SECRET)s",JWT_EXPIRES_IN="%(ENV_JWT_EXPIRES_IN)s",CORS_ORIGIN="%(ENV_CORS_ORIGIN)s",ALLOWED_ORIGINS="%(ENV_ALLOWED_ORIGINS)s"
```

- **Root cause**: The supervisord config was not updated when AUDIT_HASH_KEY (OBS-028) and METRICS_TOKEN (SA-SEC-012) were added as required secrets.
- **Impact**: The all-in-one image cannot boot as a production deployment. The API supervisord process will crash-loop indefinitely.
- **Suggested fix**: Add AUDIT_HASH_KEY="%(ENV_AUDIT_HASH_KEY)s",METRICS_TOKEN="%(ENV_METRICS_TOKEN)s",RBAC_GUARD_MODE="enforce" to the [program:api] environment line. Also add AUDIT_HASH_KEY and METRICS_TOKEN to docker-compose.offline.yml environment block.
- **Acceptance criteria**:
  - supervisord.conf [program:api] environment includes AUDIT_HASH_KEY passthrough
  - supervisord.conf [program:api] environment includes METRICS_TOKEN passthrough
  - docker-compose.offline.yml passes AUDIT_HASH_KEY with :? mandatory syntax
- **Verification**: `grep 'AUDIT_HASH_KEY' docker/all-in-one/supervisord.conf docker-compose.offline.yml`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-029, SEC-030, SEC-031, SEC-032, SEC-033

#### SEC-029 — Redis password visible in process list via redis-cli -a flag in healthcheck

**🟠 important** · `docker-compose.prod.yml:62` · confidence: high · cluster M · secret_exposure

The Redis healthcheck passes the password as a command-line argument via -a. During the brief period the healthcheck process is running, the password is visible in /proc/<pid>/cmdline and in `docker inspect` output. redis-cli itself also prints a security warning to stderr for this pattern. The same issue exists in docker-compose.standalone.yml line 42.

```
      test: ["CMD-SHELL", "redis-cli -a $REDIS_PASSWORD ping | grep PONG"]
```

- **Root cause**: The -a flag for redis-cli passes the password as a command-line argument, which is process-list visible.
- **Impact**: Any process on the host with read access to /proc can observe the Redis password during each healthcheck execution. Docker inspect output also reveals it. Low-severity on a properly hardened host but violates defense-in-depth.
- **Suggested fix**: Use the REDISCLI_AUTH environment variable instead: test: ["CMD-SHELL", "REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping | grep PONG"] — this passes the password via the environment, which is not visible in process listings.
- **Acceptance criteria**:
  - Redis healthcheck uses REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping instead of redis-cli -a $REDIS_PASSWORD ping
  - Applied in both docker-compose.prod.yml and docker-compose.standalone.yml
- **Verification**: `grep -n 'redis-cli' docker-compose.prod.yml docker-compose.standalone.yml`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-030, SEC-031, SEC-032, SEC-033

#### SEC-030 — Certbot container uses unpinned :latest image with no security_opt or network isolation

**🟠 important** · `docker-compose.prod.yml:300-310` · confidence: high · cluster M · container_hardening

The certbot container uses certbot/certbot:latest (unpinned), has no security_opt: no-new-privileges, and no network specification (uses Docker default bridge, not orchestr-a-network). All other prod services use pinned image versions and no-new-privileges. An unpinned certbot image means an image change (upstream tag update) can introduce untested/vulnerable code on the next `docker compose pull`.

```
  certbot:
    image: certbot/certbot:latest
    container_name: orchestr-a-certbot-prod
    volumes:
      - certbot_certs:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    labels:
      - "com.orchestr-a.service=certbot"
      - "com.orchestr-a.tier=security"
```

- **Root cause**: Certbot image was not pinned to a specific version, and security hardening was not applied uniformly across all services.
- **Impact**: Upstream image changes can silently alter prod behavior. The certbot container has write access to the TLS private key volume (certbot_certs) — if the image is compromised, private keys are at risk.
- **Suggested fix**: Pin certbot to a specific version (e.g., certbot/certbot:v3.0.1) or a digest. Add security_opt: - no-new-privileges:true. The certbot container does not need to be on orchestr-a-network (good, it uses default bridge for ACME) but should have no-new-privileges.
- **Acceptance criteria**:
  - certbot image is pinned to a specific version or digest, not :latest
  - certbot service has security_opt: - no-new-privileges:true
- **Verification**: `grep -A5 'image: certbot' docker-compose.prod.yml`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-031, SEC-032, SEC-033

#### SEC-031 — all-in-one nginx missing Referrer-Policy, Permissions-Policy, and server_tokens off

**🟠 important** · `docker/all-in-one/nginx.conf:35-38` · confidence: high · cluster M · security_headers

The all-in-one nginx.conf sets only 3 of the 6 security headers present in nginx/nginx.conf. Missing: Referrer-Policy, Permissions-Policy, and server_tokens off. The Referrer-Policy header prevents sensitive URL path leakage to third parties. Permissions-Policy disables dangerous browser features. server_tokens off hides the nginx version from error pages and Server header, reducing fingerprinting.

```
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
```

- **Root cause**: The all-in-one nginx config was written independently and not kept in sync with the main nginx/nginx.conf which was updated with additional headers.
- **Impact**: Deployments using the all-in-one image expose nginx version in error pages (server_tokens not off), leak referer headers to external resources, and leave browser permissions (camera, mic, geolocation) unrestricted.
- **Suggested fix**: Add to docker/all-in-one/nginx.conf: server_tokens off; (http block), add_header Referrer-Policy "strict-origin-when-cross-origin" always; and add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always; in the server block.
- **Acceptance criteria**:
  - docker/all-in-one/nginx.conf has server_tokens off in http block
  - docker/all-in-one/nginx.conf has Referrer-Policy header
  - docker/all-in-one/nginx.conf has Permissions-Policy header
- **Verification**: `grep -n 'server_tokens\|Referrer-Policy\|Permissions-Policy' docker/all-in-one/nginx.conf`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-032, SEC-033

#### SEC-014 — ResetPasswordDto.token has no @MaxLength — unbounded string stored in hash path

**🟡 nit** · `apps/api/src/auth/dto/reset-password.dto.ts:10-11` · confidence: high · cluster B · input-validation / missing-maxlength

ResetPasswordDto.token has only @IsString() and no @MaxLength. The token is passed directly to crypto.createHash('sha256').update(token) which is fast, but the string is allocated in memory. The 1 MiB body limit provides an outer bound. This is a low-severity hardening gap — no bcrypt is involved, so CPU exhaustion is not a concern here.

```
  @IsString()
  token: string;
```

- **Root cause**: No @MaxLength decorator was applied to the token field. The expected value is a UUID (36 chars); any reasonable upper bound would suffice.
- **Impact**: Minimal in practice due to the 1 MiB body limit and the fast SHA-256 operation. An attacker could flood with large token values, but this is already mitigated by the @Throttle({ short: { limit: 5, ttl: 60_000 } }) applied to the reset-password endpoint.
- **Suggested fix**: Add @MaxLength(256) to ResetPasswordDto.token to reflect the expected UUID format and provide an explicit signal in the DTO schema.
- **Acceptance criteria**:
  - ResetPasswordDto.token carries @MaxLength(256)
  - POST /auth/reset-password with a 300-char token returns 400
- **Verification**: `grep -n 'MaxLength' apps/api/src/auth/dto/reset-password.dto.ts`
- **Related**: SEC-002, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021
- **Notes**: Low severity because SHA-256 is fast. The throttle on the endpoint further reduces risk.

#### SEC-015 — CreateUserDto / ImportUserDto firstName and lastName lack @MaxLength

**🟡 nit** · `apps/api/src/users/dto/create-user.dto.ts:65-75` · confidence: medium · cluster B · input-validation / missing-maxlength

CreateUserDto.firstName and .lastName carry @IsString() + @MinLength(2) but no @MaxLength. The same fields in ImportUserDto (import-users.dto.ts lines 45-55) and UpdateUserDto (inherited via PartialType) are also unbounded. These strings are written to a VARCHAR column in PostgreSQL, which will enforce a DB-level limit only if the schema column has a length constraint. Without DTO-level validation, the error surface is at the DB layer rather than the HTTP input layer.

```
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Martin',
  })
  @IsString()
  @MinLength(2)
  lastName: string;
```

- **Root cause**: No @MaxLength was applied to the firstName/lastName fields in these DTOs. The RegisterDto correctly caps these at 50 chars each, but CreateUserDto (admin path) and ImportUserDto do not.
- **Impact**: Low — the 1 MiB body limit constrains the maximum total payload. Prisma will map a too-long string to a DB error that the global exception filter converts to 500, leaking no data but causing an unclear error response. Consistent DTO-level validation is better practice.
- **Suggested fix**: Add @MaxLength(50) to firstName and lastName in CreateUserDto and ImportUserDto, matching the constraint already present in RegisterDto.
- **Acceptance criteria**:
  - CreateUserDto.firstName and lastName carry @MaxLength(50)
  - ImportUserDto.firstName and lastName carry @MaxLength(50)
  - POST /users with a 200-char firstName returns 400 rather than 500
- **Verification**: `grep -n 'MaxLength\|firstName\|lastName' apps/api/src/users/dto/create-user.dto.ts apps/api/src/users/dto/import-users.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021
- **Notes**: Also applies to UpdateUserDto which inherits via PartialType(CreateUserDto). ImportUserDto roleCode, departmentName, serviceNames are similarly unbounded, but those are used in map lookups rather than written directly to the DB as-is.

#### SEC-016 — ImportUsersDto.users array has no @ArrayMaxSize bound

**🟡 nit** · `apps/api/src/users/dto/import-users.dto.ts:86-91` · confidence: medium · cluster B · input-validation / missing-maxlength

The ImportUsersDto.users array has @IsArray() and @ValidateNested but no @ArrayMaxSize(). The import handler calls bcrypt.hash() for each row serially in a for loop. The 1 MiB body limit constrains how many entries can fit, but a compact batch (minimal fields) could exceed several hundred entries, each triggering a bcrypt.hash at cost=12. For callers with users:import permission this is a CPU exhaustion vector within the authenticated surface.

```
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUserDto)
  users: ImportUserDto[];
```

- **Root cause**: No @ArrayMaxSize decorator was added when the import endpoint was implemented.
- **Impact**: A caller holding users:import (typically ADMIN or RESPONSABLE) can issue a large batch of minimal-field entries, each requiring a bcrypt.hash call at cost=12, potentially blocking the event loop. The 1 MiB body limit and the ADMIN/RESPONSABLE role gate reduce this to a credentialed insider risk.
- **Suggested fix**: Add @ArrayMaxSize(500) (or a configurable ceiling) to ImportUsersDto.users. Alternatively, consider processing bcrypt operations in micro-batches with async yields between chunks.
- **Acceptance criteria**:
  - ImportUsersDto.users carries @ArrayMaxSize(N) for some reasonable N (e.g. 500)
  - POST /users/import with more than N entries returns 400
- **Verification**: `grep -n 'ArrayMaxSize\|@IsArray' apps/api/src/users/dto/import-users.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021
- **Notes**: The actual exploit requires a valid auth token with users:import permission. The 1 MiB limit and role gate significantly reduce risk. Raised as a nit for defense-in-depth.

#### SEC-017 — findOne ownership guard short-circuits on null role — dead code inconsistency with update/remove

**🟡 nit** · `apps/api/src/leaves/leaves.service.ts:1271` · confidence: high · cluster A · authorization

The ownership check in `findOne` is wrapped in `if (currentUserRole && ...)`. When `currentUserRole` is null or undefined the check is skipped entirely. In contrast, the `update` and `remove` paths use a fail-closed pattern: `canManage = currentUserId && currentUserRole ? … : false; if (!isOwner && !canManage) throw`. The null-role path is not reachable over HTTP (the PermissionsGuardV2 blocks any request where `user.role` is null before the service runs), but the inconsistency is a maintenance hazard.

```
    if (currentUserRole && leave.userId !== currentUserId) {
      const canManage = ...
      if (!canManage) {
        throw new ForbiddenException('Accès non autorisé à cette demande de congé');
      }
    }
```

- **Root cause**: Defensive inconsistency: the fail-open guard was not aligned with the fail-closed pattern used in sibling methods when the service was refactored.
- **Impact**: No exploitable impact over HTTP because JwtAuthGuard + PermissionsGuardV2 block null-role requests before reaching the service. Risk is latent: if a future code path calls findOne directly (e.g., a batch job, a new public route) without a role, ownership enforcement silently disappears.
- **Suggested fix**: Replace `if (currentUserRole && leave.userId !== currentUserId)` with `if (leave.userId !== currentUserId)`, and fail closed if neither ownership nor canManage is satisfied — mirroring the pattern in update/remove.
- **Acceptance criteria**:
  - findOne throws ForbiddenException for any non-owner/non-manager caller regardless of currentUserRole value
  - Unit test covers the null-role branch and asserts ForbiddenException is thrown
- **Verification**: `grep -n 'currentUserRole &&' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leaves/leaves.service.ts | head -5`
- **Related**: SEC-003, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-020, SEC-013
- **Notes**: Confirmed non-exploitable via HTTP: PermissionsGuardV2 enforce mode returns false for !user.role. This is a defensive code quality issue, not an active vulnerability.

#### SEC-018 — ConflictException message echoes the user-supplied client name verbatim

**🟡 nit** · `apps/api/src/clients/clients.service.ts:70-72` · confidence: medium · information-disclosure

When a P2002 unique constraint violation occurs on the clients table, the error message echoes `dto.name` (the user-supplied value) back in the 409 response body. The same pattern appears in the update() method (line 278-280). While the value was already submitted by the caller, returning it in an error response is unnecessary and could assist enumeration if a client name is considered sensitive data.

```
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          `Client name "${dto.name}" is already in use`,
```

- **Root cause**: Template literal interpolation of dto.name in exception message. The value is known to the caller but this is not a best practice for opaque error messages.
- **Impact**: Minimal — the caller already knows the name they submitted. The risk is low but the pattern is inconsistent with the rest of the codebase (DepartmentsService says 'Ce nom de département est déjà utilisé' without echoing the value).
- **Suggested fix**: Use a static message: `throw new ConflictException('Client name already in use')` without interpolating dto.name.
- **Acceptance criteria**:
  - POST /clients with duplicate name returns 409 with generic message, not echoing the submitted name
- **Verification**: `curl -s -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"name":"existing"}' http://localhost:4000/api/clients | jq .message`

#### SEC-019 — DepartmentsService.findAll() page parameter has no minimum floor — negative skip silently returned in response meta

**🟡 nit** · `apps/api/src/departments/departments.service.ts:80-83` · confidence: medium · missing-minimum-bound

The service method clamps `limit` to a maximum of 100 via Math.min, but applies no floor to `page`. A caller passing `page=0` computes `skip=-safeLimit` which is negative. Even if Prisma validates and rejects this, the response `meta.page` would echo back the malformed value if the query had not already failed.

```
  async findAll(page = 1, limit = 50) {
    const safeLimit = Math.min(limit || 50, 100);
    const skip = (page - 1) * safeLimit;
```

- **Root cause**: Only limit is clamped; page has no Math.max(1, ...) guard in the service.
- **Impact**: Consistent with the controller-level finding above — produces 500 on page ≤ 0. The same issue exists in ServicesService.findAll() (line 102-104).
- **Suggested fix**: Add `const safePage = Math.max(1, page ?? 1);` before the skip calculation in both DepartmentsService.findAll() and ServicesService.findAll(), or enforce it via DTO as noted in the controller-level finding.
- **Acceptance criteria**:
  - findAll(0, 50) returns page 1 data, not a 500
  - Response meta.page is always >= 1
- **Verification**: `N/A — manual verification`

#### SEC-021 — BulkUpdateSettingsDto: no per-value size or type validation on settings map

**🟡 nit** · `apps/api/src/settings/dto/update-setting.dto.ts:30-36` · confidence: high · cluster B · input_validation

BulkUpdateSettingsDto declares `settings` as `Record<string, any>` with only `@IsObject()` at the map level. Individual map values carry no `@IsString()`, `@MaxLength()`, or type constraint. A caller with `settings:update` permission can submit a single bulk request where every value is a deeply nested object or a very long string — all of which get JSON-stringified and stored individually in the DB via `update()`. The 1 MiB global bodyLimit caps total payload but does not enforce per-value bounds.

```
export class BulkUpdateSettingsDto {
  @ApiProperty({
    description: 'Liste des paramètres à mettre à jour',
  })
  @IsObject()
  settings: Record<string, any>;
}
```

- **Root cause**: The DTO only validates that the top-level field is an object; class-validator's `@IsObject()` does not recurse into map values. The `UpdateSettingDto.value` field correctly has `@MaxLength(10000)`, but that constraint is absent from the bulk path.
- **Impact**: An authorised user (role with `settings:update`) can store up to ~1 MiB of arbitrary data in the `app_settings` table in a single request, one value per known key, bypassing the per-field `@MaxLength(10000)` guard on the single-key path. The `isKnownKey()` check prevents injecting unknown keys, but the value content is unrestricted. This also produces disproportionately large `before`/`after` snapshots in `audit_logs`.
- **Suggested fix**: Replace `Record<string, any>` with a typed map and add class-validator constraints, or add a custom validator that iterates entries and asserts each value satisfies the same constraints as `UpdateSettingDto.value`. Minimal fix: add `@ValidateNested({ each: true })` with a value DTO, or add a plain `@IsString({ each: true })` + `@MaxLength(10000, { each: true })` using a transform.
- **Acceptance criteria**:
  - Each value in a bulk-update request is rejected if it exceeds 10 000 characters (matching single-key path)
  - Non-string values that cannot be JSON.stringified to a valid setting value are rejected at the DTO level
  - Existing integration tests cover oversized bulk values returning 400
- **Verification**: `curl -s -X POST http://localhost:3000/api/settings/bulk -H 'Authorization: Bearer <admin_token>' -H 'Content-Type: application/json' -d '{"settings":{"appName":"'$(python3 -c 'print("A"*20000)')'"}}'`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018
- **Notes**: The `isKnownKey()` enforcement inside `SettingsService.bulkUpdate()` ensures only the 10 known keys can be written. The attack surface is therefore limited to legitimate keys, but value size is still unconstrained at the DTO layer. [severity normalized from 'low']

#### SEC-032 — Dev compose exposes PostgreSQL and Redis on 0.0.0.0 with default weak password

**🟡 nit** · `docker-compose.yml:10-12` · confidence: medium · cluster M · network_exposure

The dev compose exposes postgres (5432) and redis (6379) on all interfaces (0.0.0.0) with the default password orchestr_a_dev_password. Redis has no password at all. While labeled DEV ONLY, developers running this on a network-connected machine (cloud workstation, VPS) expose these services to the network.

```
      # DEV ONLY - change in production
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-orchestr_a_dev_password}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
```

- **Root cause**: Dev convenience; intentional. The DEV ONLY comment exists but the default binding is still 0.0.0.0.
- **Impact**: On a cloud developer machine or public network, PostgreSQL and Redis become accessible with trivial credentials.
- **Suggested fix**: Change the default port binding to 127.0.0.1: - "127.0.0.1:${POSTGRES_PORT:-5432}:5432". This retains local connectivity for developers while blocking external access by default.
- **Acceptance criteria**:
  - docker-compose.yml postgres ports binding uses 127.0.0.1 prefix
  - docker-compose.yml redis ports binding uses 127.0.0.1 prefix
- **Verification**: `grep -n 'ports:' -A2 docker-compose.yml`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-033
- **Notes**: This is a developer convenience file, so the risk is lower than prod. The comment acknowledges it but does not mitigate it.

#### SEC-033 — HSTS header missing preload directive on host nginx

**🟡 nit** · `infra/host-nginx/orchestr-a.conf:34` · confidence: low · cluster M · tls

The HSTS header includes max-age=63072000 (~2 years) and includeSubDomains but omits the preload directive. Without preload, the site is not eligible for inclusion in browser HSTS preload lists. The current HSTS only protects users who have visited the site once; first-time visitors and those whose HSTS cache expired are still vulnerable to SSL stripping.

```
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
```

- **Root cause**: The preload directive was not added when HSTS was configured.
- **Impact**: Low: first-visit SSL stripping attacks remain possible. For a government HR application this is worth closing.
- **Suggested fix**: Change to: add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always; and submit orchestr-a.com to https://hstspreload.org.
- **Acceptance criteria**:
  - HSTS header includes the preload directive
  - orchestr-a.com passes hstspreload.org eligibility check
- **Verification**: `curl -si https://orchestr-a.com | grep -i strict-transport`
- **Related**: SEC-001, SEC-024, SEC-025, SEC-026, SEC-027, SEC-028, SEC-029, SEC-030, SEC-031, SEC-032

#### SEC-020 — `getEventsByRange` service method has no fail-closed guard when `currentUserId` is `undefined` — implicit trust in caller contract

**🔵 suggestion** · `apps/api/src/events/events.service.ts:743-750` · confidence: high · cluster A · defense-in-depth

When `currentUserId` is `undefined` AND the caller lacks `events:readAll`, no `where.OR` scope filter is set, resulting in a full scan of all events in the date range. The HTTP path is safe: `JwtAuthGuard` is registered as a global APP_GUARD, guaranteeing that `@CurrentUser('id')` always resolves to a real string before the controller calls this method. However, the service contract is implicitly open: any future internal caller (e.g., a background job, a test harness, or a new service method) that invokes `getEventsByRange` without a userId would silently return all events rather than failing. This is a defense-in-depth gap, not a current vulnerability.

```
if (!rangePermissions.includes('events:readAll')) {
  if (currentUserId) {
    where.OR = [
      { participants: { some: { userId: currentUserId } } },
      { createdById: currentUserId },
    ];
  }
}
```

- **Root cause**: The service method trusts the caller to always provide a valid userId. A fail-closed pattern would throw `ForbiddenException` (or `InternalServerErrorException`) when `currentUserId` is absent and the role lacks `events:readAll`, making the contract explicit.
- **Impact**: No current HTTP attack vector. Future misuse by internal callers could expose all events in the range without a scope filter.
- **Suggested fix**: Add a fail-closed guard in the `else` branch: `else { throw new InternalServerErrorException('currentUserId required for scoped event queries'); }` — or make the method signature require `currentUserId: string` when the permission set does not include `events:readAll`.
- **Acceptance criteria**:
  - Calling `getEventsByRange` with `currentUserId=undefined` and a role lacking `events:readAll` throws rather than returning unscoped results
  - Existing controller tests still pass (controller always provides a real userId)
- **Verification**: `grep -n 'getEventsByRange\|currentUserId' apps/api/src/events/events.service.ts | head -20`
- **Related**: SEC-003, SEC-017, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-013
- **Notes**: HTTP path is provably safe via global JwtAuthGuard. This is a code-quality / future-proofing finding only.

### Correctness (39)

#### COR-001 — checkCircularDependency reads via this.prisma (not tx) inside serializable transaction — race allows dependency cycles

**🔴 blocking** · `apps/api/src/tasks/tasks.service.ts:1005-1050 (call site), 1435 (leak)` · confidence: high · cluster F · concurrency / transaction isolation

The comment at lines 999-1004 claims that wrapping the circular-check + insert in a SERIALIZABLE transaction prevents the A→B / B→A race. The implementation is wrong: checkCircularDependency calls this.prisma.taskDependency.findMany (the singleton connection pool, auto-commit) rather than tx.taskDependency.findMany. The BFS read therefore runs outside the serializable snapshot. Two concurrent addDependency(A→B) and addDependency(B→A) requests each see the pre-insert committed state, both pass the BFS check, and both proceed to tx.taskDependency.create — producing a 2-cycle. The compound unique constraint on (taskId, dependsOnTaskId) only rejects exact duplicate edges, not the symmetric pair.

```
    const dependency = await this.prisma.$transaction(
      async (tx) => {
        // Vérifier qu'on ne crée pas une dépendance circulaire
        const hasCircularDependency = await this.checkCircularDependency(
          dependsOnTaskId,
          taskId,
        );
        // ...
      },
      { isolationLevel: 'Serializable' },
    );

    // ...inside checkCircularDependency (line 1435):
    const allDeps = await this.prisma.taskDependency.findMany({
      select: { taskId: true, dependsOnTaskId: true },
    });
```

- **Root cause**: checkCircularDependency accepts no tx parameter and always reads from this.prisma. The $transaction lambda passes a tx client but never threads it into the helper. The serializable isolation level only protects reads that share the tx connection; the BFS read uses a separate autocommit connection and is unprotected.
- **Impact**: Two concurrent requests can create a mutual dependency cycle (A depends on B, B depends on A) — a persistent data integrity violation that corrupts the dependency graph and can cause infinite loops in any downstream cycle-detection, scheduling, or critical-path logic.
- **Suggested fix**: Add a prisma parameter to checkCircularDependency: private async checkCircularDependency(startTaskId, targetTaskId, prisma: PrismaClient | Prisma.TransactionClient = this.prisma). At the call site inside the transaction pass tx: await this.checkCircularDependency(dependsOnTaskId, taskId, tx). This ensures the BFS reads within the serializable snapshot.
- **Acceptance criteria**:
  - checkCircularDependency signature accepts an optional prisma/tx client parameter
  - The call inside addDependency's $transaction lambda passes tx as the client
  - Integration test: concurrent addDependency(A→B) and addDependency(B→A) — at most one succeeds
- **Verification**: `grep -n 'checkCircularDependency\|this\.prisma\.taskDependency' apps/api/src/tasks/tasks.service.ts`
- **Related**: PER-003
- **Notes**: The compound unique index on (taskId, dependsOnTaskId) does NOT catch the symmetric 2-cycle (A→B and B→A are distinct rows). The async nature of Node.js HTTP handling makes the race window realistically exploitable.

#### COR-028 — rejectCancellation() passes an unrecognized key to strict leaveAudit schema — AuditPayloadValidationError rolls back the entire Prisma transaction, reverting the status transition and returning HTTP 500

**🔴 blocking** · `apps/api/src/leaves/leaves.service.ts:2394-2406` · confidence: high · audit-schema-validation-throws-inside-transaction

rejectCancellation() emits AuditAction.LEAVE_APPROVED with an extra top-level key rejectedCancellation: true. The schema for LEAVE_APPROVED is z.union([leaveAudit, securityEnvelope]) (payload-schemas.ts line 232). The leaveAudit branch is .strict() and does not declare rejectedCancellation — Zod rejects it. The securityEnvelope branch is also .strict() and requires success: z.boolean() and timestamp: z.string() (both absent from this payload) — it also rejects the payload. Both branches fail, the union throws AuditPayloadValidationError. validatePayloadForAction() runs BEFORE any DB transaction is opened (audit-persistence.service.ts line 134), but this call is made INSIDE a $transaction callback — the AuditPayloadValidationError propagates through the callback, Prisma rolls back the leave.update() status transition (CANCELLATION_REQUESTED → APPROVED), and the client receives HTTP 500. No audit row is written. The endpoint is live: leaves.controller.ts line 646 wires PATCH /leaves/:id/reject-cancellation.

```
      await this.auditPersistence.log({
        action: AuditAction.LEAVE_APPROVED,
        entityType: 'Leave',
        entityId: id,
        actorId: currentUserId ?? null,
        payload: {
          actor: actorSnapshot,
          subject: { leaveId: id, userId: current.userId },
          before: { status: current.status },
          after: { status: updated.status },
          rejectedCancellation: true,  // NOT in leaveAudit schema
        },
      });
```

- **Root cause**: A new semantic field rejectedCancellation: true was added to distinguish rejectCancellation() from a normal approval, but the leaveAudit Zod schema was not extended to include this key. Because all schemas are .strict() (enforced globally per payload-schemas.ts lines 12-18), any unknown top-level key is an immediate validation error. The auditPersistence.log() call is inside a Prisma $transaction callback, so the thrown error cascades to a full rollback.
- **Impact**: Every call to POST/PATCH /leaves/:id/reject-cancellation (rejecting a cancellation request) fails with HTTP 500. The leave status transition is rolled back — the leave stays in CANCELLATION_REQUESTED state permanently. No audit trail is produced. This affects any leave workflow where a manager rejects a user's cancellation request — a complete functional breakage of a named sensitive mutation path.
- **Suggested fix**: Two complementary fixes required: (1) Add rejectedCancellation: z.boolean().optional() to the leaveAudit Zod schema in apps/api/src/audit/payload-schemas.ts at line 100 (inside the .object({}) block, before .strict()); (2) Add an integration test that exercises the actual Prisma transaction + audit persistence path (not a unit test with mocked auditPersistence — the strict-parse never runs there, which is exactly why this slipped through). No migration needed; this is an application-layer schema change only.
- **Acceptance criteria**:
  - PATCH /leaves/:id/reject-cancellation returns HTTP 200 for a leave in CANCELLATION_REQUESTED state
  - An audit_logs row with action=LEAVE_APPROVED and payload.rejectedCancellation=true is persisted after a successful call
  - The leave.status transitions to APPROVED and the change is durable (not rolled back)
  - pnpm run test:integration passes (or equivalent integration test covering this path exists and passes)
- **Verification**: `grep -n 'rejectedCancellation' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/payload-schemas.ts`
- **Notes**: Validated by reading leaveAudit schema (lines 88-102 of payload-schemas.ts — rejectedCancellation absent), securityEnvelope schema (lines 60-72 — requires success+timestamp, also .strict()), and audit-persistence.service.ts line 134 confirming validatePayloadForAction() runs before the DB transaction. Controller endpoint confirmed at leaves.controller.ts:646.

#### COR-002 — DepartmentsController and ServicesController accept page ≤ 0, producing negative skip in Prisma

**🟠 important** · `apps/api/src/departments/departments.controller.ts:65-69` · confidence: high · pagination-input-validation

Both DepartmentsController.findAll() and ServicesController.findAll() parse `page` and `limit` via ParseIntPipe with no minimum/maximum constraint. Sending `page=0` results in `skip = (0-1) * safeLimit = -safeLimit`, which is a negative value passed to Prisma's `findMany({skip: ...})`. Prisma 6 validates skip at the DB layer and throws a PrismaClientValidationError (non-HttpException) which bubbles through AllExceptionsFilter as a 500. The `limit` parameter lacks an upper bound check at the controller level too (the service caps it at 100, but page is entirely unconstrained).

```
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.departmentsService.findAll(page, limit);
```

- **Root cause**: Controller uses raw ParseIntPipe without @Min(1) constraint for page, and the service only clamps limit (Math.min), but performs no floor on page. The `skip` arithmetic can produce a negative integer.
- **Impact**: Any authenticated user with departments:read or services:read permission can trigger a 500 error by passing page=0 or page=-5. This is a low-effort denial of service and produces noisy 500s in logs.
- **Suggested fix**: Replace the bare @Query('page', new ParseIntPipe) pattern with a typed DTO (similar to QueryClientsDto which uses @IsInt @Min(1)) or add a manual clamp: `const safePage = Math.max(1, page ?? 1)` before the skip calculation in the service.
- **Acceptance criteria**:
  - GET /departments?page=0 returns 400, not 500
  - GET /services?page=-1 returns 400, not 500
  - GET /departments?limit=9999 is capped at 100
- **Verification**: `curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer <token>' 'http://localhost:4000/api/departments?page=0'`
- **Notes**: The same issue exists in services.controller.ts line 69-75. Both controllers share the identical pattern.

#### COR-003 — UpdatePredefinedTaskDto: string fields missing @MaxLength (name, description, color, icon)

**🟠 important** · `apps/api/src/predefined-tasks/dto/update-predefined-task.dto.ts:20-46` · confidence: high · cluster B · input-validation

The PATCH endpoint for predefined tasks accepts unbounded string lengths for name, description, color, and icon. The companion CreatePredefinedTaskDto enforces @MaxLength(200), @MaxLength(2000), @MaxLength(20), and @MaxLength(10) respectively. UpdatePredefinedTaskDto has the @IsString/@IsOptional decorators but drops all @MaxLength constraints, so a PATCH can write arbitrarily long strings to these columns.

```
@IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Description de la tâche',
    example: 'Accueil du public au guichet',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Couleur hexadécimale',
    example: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    description: 'Icône de la tâche',
    example: '🏢',
  })
  @IsString()
  @IsOptional()
  icon?: string;
```

- **Root cause**: UpdatePredefinedTaskDto was not kept in sync with CreatePredefinedTaskDto after @MaxLength decorators were added to the Create DTO. PartialType or a shared base class was not used.
- **Impact**: Any holder of predefined_tasks:manage permission can overwrite name/description/color/icon with payloads of arbitrary length, potentially causing DB column overflow errors (500), denial-of-service via large text payloads stored in the DB, or downstream UI rendering issues.
- **Suggested fix**: Add @MaxLength(200) on name, @MaxLength(2000) on description, @MaxLength(20) on color, @MaxLength(10) on icon in UpdatePredefinedTaskDto, matching CreatePredefinedTaskDto. Alternatively, replace UpdatePredefinedTaskDto with PartialType(CreatePredefinedTaskDto) to inherit all validators automatically.
- **Acceptance criteria**:
  - PATCH /predefined-tasks/:id with name longer than 200 chars returns 400 Bad Request
  - PATCH /predefined-tasks/:id with description longer than 2000 chars returns 400 Bad Request
  - PATCH /predefined-tasks/:id with color longer than 20 chars returns 400 Bad Request
  - PATCH /predefined-tasks/:id with icon longer than 10 chars returns 400 Bad Request
- **Verification**: `grep -n '@MaxLength' apps/api/src/predefined-tasks/dto/update-predefined-task.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-015, COR-016, COR-017, COR-018, SEC-021
- **Notes**: CreatePredefinedTaskDto at apps/api/src/predefined-tasks/dto/create-predefined-task.dto.ts has @MaxLength(200)/@MaxLength(2000)/@MaxLength(20)/@MaxLength(10) on the same fields — confirmed by prior read.

#### COR-004 — getUserStats() uses local-TZ getMonth() for byMonth grouping, inconsistent with COR-035 UTC anchoring above it

**🟠 important** · `apps/api/src/telework/telework.service.ts:582-588` · confidence: high · cluster C · timezone

The byMonth aggregation calls `telework.date.getMonth()` (local-TZ host method) to bucket telework entries. The very block immediately above (COR-035, lines 562-565) explicitly uses `Date.UTC()` for the year-window bounds to avoid server-TZ contamination. `TeleworkSchedule.date` is `@db.Date`, hydrated by Prisma as UTC midnight; `getMonth()` is correct only when the host clock is UTC. On any non-UTC Node process (e.g. Europe/Paris UTC+1, `2026-01-01T00:00:00Z` would still return month 0 because UTC midnight IS January, so in practice this is neutral for Paris — but it violates the codebase's own stated host-TZ-independence invariant and will break if the server TZ is set to a positive offset where 2026-01-01T00:00:00Z could be read as December 31).

```
    // Calculer par mois
    const byMonth = teleworks.reduce(
      (acc, telework) => {
        const month = telework.date.getMonth();
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
```

- **Root cause**: `getMonth()` reads the local-TZ interpretation of a UTC timestamp. For UTC-midnight `@db.Date` values, this equals `getUTCMonth()` only on UTC-offset-zero hosts. COR-035 documents the correct pattern (`Date.UTC()`) two lines above but it was not applied to the reduce callback.
- **Impact**: On non-UTC servers (including a Europe/Paris production host running at UTC+1 in winter), `telework.date.getMonth()` for January entries stored as `2026-01-01T00:00:00Z` still returns `0` (January) — correct. However, this is accidental correctness. If the host TZ were ever east of UTC+0, entries at UTC midnight would misclassify into the previous month (e.g., UTC+14 server: `2026-01-01T00:00:00Z` → December). As written, the codebase's own host-TZ-independence invariant (COR-035 comment) is violated in the same function.
- **Suggested fix**: Replace `telework.date.getMonth()` with `telework.date.getUTCMonth()` to align with the UTC anchoring pattern used in the year-window bounds directly above:
```typescript
const month = telework.date.getUTCMonth();
```
- **Acceptance criteria**:
  - telework.date.getMonth() replaced by telework.date.getUTCMonth() in getUserStats()
  - Unit test added (or existing spec updated) for getUserStats() verifying byMonth keys match UTC month of stored dates
- **Verification**: `grep -n 'getMonth()' apps/api/src/telework/telework.service.ts`
- **Related**: COR-005, COR-020, COR-022, COR-010, COR-023, COR-026, COR-027, COR-035
- **Notes**: Functionally harmless in UTC production (prod server documented as UTC in MEMORY.md), but violates the codebase's own COR-035 invariant.

#### COR-005 — expandRecurringRulesForRange() and generateSchedulesFromRules() use local-TZ setHours() for Prisma DateTime query bounds

**🟠 important** · `apps/api/src/telework/telework.service.ts:346-349` · confidence: high · cluster C · timezone

Both `expandRecurringRulesForRange()` (lines 346-349) and `generateSchedulesFromRules()` (lines 1010-1013) build DB query bounds for `TeleworkRecurringRule.startDate`/`endDate` (Prisma `DateTime`, stored as UTC timestamps) using `setHours(0,0,0,0)` / `setHours(23,59,59,999)` — local-TZ JS methods. On a non-UTC server these produce shifted timestamps. For example on a UTC+2 server, `new Date('2026-06-01').setHours(0,0,0,0)` = `2026-05-31T22:00:00Z`, so rules starting on 2026-06-01 may be excluded from a query requesting rules for June. The same pattern repeats identically at lines 1010-1013 in `generateSchedulesFromRules`. The cursor iteration inside these functions correctly uses `teleworkDayKey()` (Paris-anchored) so day matching is correct — only the outer DB filter window can miss rules created near day boundaries.

```
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
```

- **Root cause**: `setHours()` operates on local wall clock, not UTC. `TeleworkRecurringRule.startDate/endDate` are Prisma `DateTime` (not `@db.Date`), meaning they are UTC timestamps in the DB. Prisma serializes the JS `Date` to UTC for the WHERE clause. The correct pattern for TZ-safe midnight is `new Date(Date.UTC(y, m, d))` or `setUTCHours()`.
- **Impact**: On non-UTC hosts (any UTC-positive offset), rules whose `startDate` or `endDate` falls within [UTC midnight - offset, UTC midnight) of the requested range edge may be silently excluded from expansion or schedule generation. This could cause recurring telework rules to not be expanded for the first or last partial day of a requested range.
- **Suggested fix**: Replace `setHours(0,0,0,0)` / `setHours(23,59,59,999)` with UTC equivalents:
```typescript
const start = new Date(startDate);
start.setUTCHours(0, 0, 0, 0);
const end = new Date(endDate);
end.setUTCHours(23, 59, 59, 999);
```
Apply the same fix to the duplicate at lines 1010-1013.
- **Acceptance criteria**:
  - setHours replaced by setUTCHours in both expandRecurringRulesForRange and generateSchedulesFromRules
  - No regression on existing telework E2E tests
  - Spec added testing range boundaries on a UTC+1 simulated TZ (or confirmed via COR-035 comment)
- **Verification**: `grep -n 'setHours' apps/api/src/telework/telework.service.ts`
- **Related**: COR-004, COR-020, COR-022, COR-010, COR-023, COR-026, COR-027, COR-035
- **Notes**: Prod server is UTC (Docker default), so no live miscount. The same risk pattern exists in createRecurringRule() where `new Date(startDate)` (from ISO date string) is stored directly without normalization — but ISO date-only strings parsed by V8 are UTC midnight, so that path is safe. The issue is specific to `setHours`.

#### COR-006 — reorder() does not catch P2025 (RecordNotFound) from $transaction — unknown IDs surface as HTTP 500

**🟠 important** · `apps/api/src/leave-types/leave-types.service.ts:194-204` · confidence: high · error-handling

The `reorder()` method builds an array of Prisma `update` promises and awaits them in a `$transaction`. If any `id` in `orderedIds` does not exist in the database, Prisma throws `PrismaClientKnownRequestError` with code `P2025` (record not found). This exception is not caught inside `reorder()` and propagates through NestJS's default exception handler as an HTTP 500 Internal Server Error, instead of a user-appropriate 400/404.

```
  async reorder(orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.leaveTypeConfig.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll();
  }
```

- **Root cause**: No try/catch wraps `await this.prisma.$transaction(updates)`, and NestJS's global error filter does not map `P2025` to a 4xx by default. All other write paths in this service explicitly check existence with `findUnique` before mutating.
- **Impact**: A client sending stale or tampered IDs (e.g., after a leave type was concurrently deleted) receives an HTTP 500 response and the transaction is rolled back atomically. The rollback is correct (no partial reorder), but the 500 leaks internal Prisma error details and violates the API's error contract. Logged as an unhandled server error.
- **Suggested fix**: Wrap the transaction in a try/catch that maps P2025 to NotFoundException:
```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

async reorder(orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    this.prisma.leaveTypeConfig.update({ where: { id }, data: { sortOrder: index } }),
  );
  try {
    await this.prisma.$transaction(updates);
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundException(`Type de congé introuvable dans la liste de réordonnancement`);
    }
    throw err;
  }
  return this.findAll();
}
- **Acceptance criteria**:
  - P2025 from $transaction in reorder() is caught and mapped to NotFoundException (404)
  - Other errors are re-thrown unchanged
  - Unit test added: reorder() with unknown ID returns 404, not 500
- **Verification**: `grep -n 'reorder\|P2025' apps/api/src/leave-types/leave-types.service.ts`
- **Notes**: The $transaction(array) call is atomic — if any update fails, all are rolled back. The fix only addresses the error response shape.

#### COR-007 — recalcTaskProgress overwrites progress unconditionally, breaking the DONE=100% invariant established by update()

**🟠 important** · `apps/api/src/tasks/tasks.service.ts:2261-2272 (recalcTaskProgress), 845 (COR-063 guard in update)` · confidence: high · business invariant — COR-063 DONE=100 violated by subtask toggle

update() explicitly sets progress: 100 whenever status is DONE (COR-063 invariant: a DONE task must always show 100%). However, recalcTaskProgress — called by createSubtask, updateSubtask, and deleteSubtask — reads the current subtask completion ratio and writes it back without checking the task's status. If a task is DONE and a subtask is toggled incomplete afterwards, recalcTaskProgress will set progress to a value less than 100, leaving the task in the contradictory state status=DONE, progress<100.

```
  // In update() — COR-063 guard (line 842-845):
  // COR-063 — unconditional override: a DONE task must always show 100%
  // regardless of subtask count (the spread above is skipped when
  // subtasks exist, leaving progress stale).
  ...(taskData.status === TaskStatus.DONE && { progress: 100 }),

  // In recalcTaskProgress (line 2261-2272) — no status check:
  private async recalcTaskProgress(taskId: string) {
    const subtasks = await this.prisma.subtask.findMany({ where: { taskId } });
    if (subtasks.length === 0) return;
    const completed = subtasks.filter((s) => s.isCompleted).length;
    const progress = Math.round((completed / subtasks.length) * 100);
    await this.prisma.task.update({ where: { id: taskId }, data: { progress } });
  }
```

- **Root cause**: recalcTaskProgress was written without a guard that preserves the COR-063 invariant. The invariant is enforced only in update() which controls status; the subtask mutation path bypasses it.
- **Impact**: A DONE task will show incorrect progress after any subtask state change. Dashboard KPI widgets, sprint burndown, and progress bars will display misleading data. The discrepancy persists until the task's status is changed again.
- **Suggested fix**: In recalcTaskProgress, fetch the current task status before writing: const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { status: true } }); if (task?.status === TaskStatus.DONE) return; — preserve 100% for DONE tasks. Alternatively compute progress but clamp to 100 when status is DONE.
- **Acceptance criteria**:
  - A DONE task remains at progress=100 after any subtask is toggled incomplete
  - A non-DONE task still gets its progress recalculated correctly
  - Unit test: create DONE task with subtasks, toggle subtask incomplete, verify progress=100
- **Verification**: `grep -n 'recalcTaskProgress\|DONE.*progress\|progress.*DONE' apps/api/src/tasks/tasks.service.ts`

#### COR-008 — epics.create(), milestones.create(), and tasks.create() accept mutations on CANCELLED projects

**🟠 important** · `apps/api/src/epics/epics.service.ts:1-175 (epics.create ~line 20); apps/api/src/milestones/milestones.service.ts (~line 55); apps/api/src/tasks/tasks.service.ts (~line 80)` · confidence: high · business invariant — CANCELLED project guard missing

projects.service.ts update() correctly enforces a CANCELLED guard (lines 581-584), documented as COR-016. The same invariant — no mutations allowed on CANCELLED projects — is not propagated to epics.create(), milestones.create(), or tasks.create(). Each checks only that the project exists, not that its status permits new child resources. Any caller with create permission can add epics, milestones, or tasks to a CANCELLED project.

```
// epics.service.ts — create():
const project = await this.prisma.project.findUnique({
  where: { id: createEpicDto.projectId },
});
if (!project) throw new NotFoundException('Projet introuvable');
return this.prisma.epic.create({ data: createEpicDto, ... });
// No check: project.status === ProjectStatus.CANCELLED

// projects.service.ts — update() enforces the guard (line 583):
if (existingProject.status === ProjectStatus.CANCELLED) {
  throw new ConflictException('Impossible de modifier un projet annulé');
```

- **Root cause**: The guard was added to projects.update() in response to a bug (COR-016) but was not applied consistently to child-resource creation endpoints in separate modules.
- **Impact**: Child resources can be added to a CANCELLED project, polluting reporting data and violating the business rule that cancelled projects are frozen. Existing exports, stats, and KPI aggregations over projects may include unexpectedly active child records.
- **Suggested fix**: In each create method, after fetching the parent project, add: if (project.status === ProjectStatus.CANCELLED) throw new ConflictException('Impossible de créer une ressource dans un projet annulé'); This mirrors the projects.update() guard pattern.
- **Acceptance criteria**:
  - POST /epics with a CANCELLED projectId returns 409
  - POST /milestones with a CANCELLED projectId returns 409
  - POST /tasks with a CANCELLED projectId returns 409
  - E2E tests covering each endpoint with a CANCELLED project
- **Verification**: `grep -n 'CANCELLED\|ProjectStatus' apps/api/src/epics/epics.service.ts apps/api/src/milestones/milestones.service.ts apps/api/src/tasks/tasks.service.ts`

#### COR-009 — attachToProject reassigns task.projectId without clearing epicId/milestoneId, leaving cross-project foreign key links

**🟠 important** · `apps/api/src/tasks/tasks.service.ts:1959-2010` · confidence: high · cross-resource invariant — parent-project mismatch

attachToProject writes only { projectId } to the task row without clearing epicId or milestoneId. A task that had an epicId pointing to Epic E1 (in Project P1) will, after being re-attached to Project P2, still have epicId = E1 — a cross-project link. The DB schema enforces 'parent must have a project' (FK constraint) but does not enforce 'parent must belong to the same project', so this passes the DB layer silently. Downstream queries that join task → epic → project will return inconsistent project attribution.

```
  async attachToProject(
    taskId: string,
    projectId: string,
    currentUser?: AccessUser,
  ) {
    // ...
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: { projectId },
      // No epicId: null, no milestoneId: null
    });
```

- **Root cause**: attachToProject was designed to promote orphan tasks to a project, but the guard 'task is currently orphan' is absent. There is no conditional clearing of epicId/milestoneId when the project changes.
- **Impact**: A re-attached task retains its original epic and milestone affiliations. Reports that aggregate tasks by epic or milestone will count the task under a project it no longer belongs to. The task appears in two projects' scope simultaneously.
- **Suggested fix**: Either (a) restrict attachToProject to orphan tasks only (add guard: if (task.projectId !== null) throw new ConflictException('...')) and null out epicId/milestoneId since they cannot be valid without the original project, or (b) accept a non-null projectId and explicitly null epicId and milestoneId in the same update: data: { projectId, epicId: null, milestoneId: null }.
- **Acceptance criteria**:
  - Calling attachToProject on a task that already has epicId set either throws ConflictException or clears epicId in the same DB write
  - After a successful attachToProject, task.epicId is null and task.milestoneId is null
  - Unit test: attach a task with epicId to a different project, assert epicId is null in the result
- **Verification**: `grep -n 'attachToProject\|epicId\|milestoneId' apps/api/src/tasks/tasks.service.ts | grep -A5 -B5 'attachToProject'`

#### COR-010 — stopRecurrence(): 'today' computed with local-TZ setHours instead of UTC

**🟠 important** · `apps/api/src/events/events.service.ts:892-893` · confidence: high · cluster C · timezone anchor missing

setHours(0,0,0,0) uses the server's local timezone. Event dates are stored as @db.Date (UTC midnight). On a server whose local TZ is not UTC, the deleteMany cutoff boundary is off by up to 23h, causing either: (a) one extra occurrence deleted (server ahead of UTC) or (b) one occurrence kept that should be deleted (server behind UTC).

```
    const today = new Date();
    today.setHours(0, 0, 0, 0);
```

- **Root cause**: The codebase uses UTC anchoring for all date operations (e.g. time-tracking cap check uses Date.UTC()). stopRecurrence was implemented without following this convention.
- **Impact**: On a non-UTC server (e.g. Europe/Paris, UTC+1/+2), one occurrence is silently over- or under-deleted relative to the user-facing calendar day. For French local government users who view 'today' in Europe/Paris, the recurrence cutoff will be off by 1-2 hours in summer, potentially deleting tomorrow's event or retaining today's.
- **Suggested fix**: Replace with UTC-anchored computation:
```ts
const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
```
- **Acceptance criteria**:
  - today is computed via Date.UTC() not setHours()
  - Unit test asserts the cutoff is UTC midnight, not local midnight
- **Verification**: `grep -n 'setHours' apps/api/src/events/events.service.ts`
- **Related**: COR-004, COR-005, COR-020, COR-022, COR-023, COR-026, COR-027, COR-035
- **Notes**: Production server may currently be UTC (Docker default); fix is still required as a latent correctness guarantee.

#### COR-024 — recurrenceDay validated and stored but never used in occurrence generation

**🟠 important** · `apps/api/src/events/events.service.ts:88, 165, 224-243` · confidence: high · accepted-but-unhonored field

The DTO accepts recurrenceDay (0=Mon to 6=Sun, per ApiProperty description) and the field is stored on the parent event (line 165). However, the recurrence generation loop (lines 224-243) ignores recurrenceDay entirely and simply advances by weekInterval*7 days from the seed date. A client sending recurrenceDay: 2 (Wednesday) for an event created on a Monday will receive occurrences on Mondays, not Wednesdays.

```
      recurrenceDay,
      recurrenceEndDate,
      ...eventData
    } = createEventDto;
    ...
            recurrenceDay: recurrenceDay ?? null,
    ...
          let currentDate = new Date(eventDateObj);
          currentDate.setDate(currentDate.getDate() + weekInterval * 7);
```

- **Root cause**: recurrenceDay was added to the model and DTO but the generation logic was not updated to use it. The loop unconditionally advances from eventDateObj without aligning to the specified weekday.
- **Impact**: Any caller setting recurrenceDay to a value other than the event's own weekday receives silently wrong occurrences. The API accepts the field without error, giving the caller no indication that recurrenceDay is a no-op.
- **Suggested fix**: Either: (a) remove recurrenceDay from the DTO and schema if it is intentionally vestigial and document the decision, or (b) implement the alignment: after computing nextDate = eventDate + N*7days, adjust to the nearest recurrenceDay using UTC weekday arithmetic before pushing to childRows.
- **Acceptance criteria**:
  - If recurrenceDay is removed: DTO field removed, schema migration drops column, Swagger updated
  - If recurrenceDay is used: occurrence dates match the specified weekday regardless of seed date
- **Verification**: `grep -n 'recurrenceDay' apps/api/src/events/events.service.ts apps/api/src/events/dto/create-event.dto.ts`
- **Notes**: Could be intentional vestigial metadata; resolution requires product decision. Flag as important because the DTO description states it controls the recurrence weekday.

#### COR-025 — planning.service.ts eventsService.findAll() silently caps events at 100 while leaves use 1000

**🟠 important** · `apps/api/src/planning/planning.service.ts:107-112` · confidence: high · silent event cap / data truncation

eventsService.findAll() defaults to pageSize=100 (capped at 200 max). The sibling leavesService.findAll() call on line 96 explicitly passes pageSize=1000. For organisations with more than 100 events in the requested date range, the planning overview silently returns an incomplete event set — no error, no truncation indicator, no pagination metadata consumed by the caller.

```
      this.eventsService.findAll(
        currentUser.id,
        currentUser.role,
        dateOnlyStart,
        dateOnlyEnd,
      ),
```

- **Root cause**: The planning service was written with leavesService explicitly paginated at 1000, but eventsService was called without explicit pageSize. The events.findAll() signature has page=1 and pageSize=100 as defaults, making the asymmetry invisible at the call site.
- **Impact**: Planning grid silently drops events beyond position 100 for high-volume organisations. Users see an incomplete planning view with no indication that data is missing. The effect is proportional to event density in the queried window (monthly view for a large org is most affected).
- **Suggested fix**: Pass explicit pageSize matching the leaves call:
```ts
this.eventsService.findAll(
  currentUser.id,
  currentUser.role,
  dateOnlyStart,
  dateOnlyEnd,
  undefined, // userId
  undefined, // projectId
  1,         // page
  1000,      // pageSize
),
```
- **Acceptance criteria**:
  - eventsService.findAll is called with an explicit pageSize >= 1000 in planning.service.ts
  - Integration test asserts planning overview returns all events when total > 100
- **Verification**: `grep -n 'eventsService.findAll\|leavesService.findAll' apps/api/src/planning/planning.service.ts`
- **Notes**: The mismatch between 1000 (leaves) and 100 (events) is the primary evidence this is an oversight, not an intentional limit.

#### COR-026 — exportIcs(): event start/end times applied with local-TZ setHours instead of UTC

**🟠 important** · `apps/api/src/planning-export/planning-export.service.ts:76-86` · confidence: high · cluster C · timezone anchor missing

setHours() applies hours in the server's local timezone. startTime and endTime are stored as HH:MM strings (e.g. '09:00') that represent wall-clock times. On a non-UTC server, the ICS DTSTART/DTEND values are shifted by the TZ offset, producing an ICS file where a 9:00 meeting appears at the wrong time in the recipient's calendar client.

```
        const [sh, sm] = event.startTime.split(':').map(Number);
        startDt = new Date(eventDate);
        startDt.setHours(sh, sm, 0, 0);

        if (event.endTime) {
          const [eh, em] = event.endTime.split(':').map(Number);
          endDt = new Date(eventDate);
          endDt.setHours(eh, em, 0, 0);
        } else {
          endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
        }
```

- **Root cause**: The code should construct the datetime using the event date's UTC components plus the HH:MM offset, not local setHours. For a @db.Date field stored as UTC midnight, setHours(9,0,0,0) in Europe/Paris summer (UTC+2) produces 09:00 local = 07:00 UTC, while the intent is 09:00 in the user's timezone.
- **Impact**: ICS exports for timed events have incorrect DTSTART/DTEND on any server where TZ != UTC. Calendar clients that honour UTC will show events shifted by the server's UTC offset. For the French production deployment running in a non-UTC container, all timed events are off by 1-2 hours.
- **Suggested fix**: Build datetimes using UTC components from the stored @db.Date then adding the HH:MM offset as UTC hours:
```ts
const [year, month, day] = [eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()];
startDt = new Date(Date.UTC(year, month, day, sh, sm, 0, 0));
```
- **Acceptance criteria**:
  - startDt and endDt construction uses Date.UTC() not setHours()
  - ICS export test asserts DTSTART is UTC and matches the stored HH:MM
- **Verification**: `grep -n 'setHours\|getHours' apps/api/src/planning-export/planning-export.service.ts`
- **Related**: COR-004, COR-005, COR-020, COR-022, COR-010, COR-023, COR-027, COR-035
- **Notes**: Same root cause affects endDt (line 83). Both must be fixed.

#### COR-029 — time-tracking update(): daily cap check runs outside a transaction — TOCTOU window

**🟠 important** · `apps/api/src/time-tracking/time-tracking.service.ts:662-678` · confidence: high · cluster D · TOCTOU race / uncovered transaction boundary

update() reads the daily hours aggregate (inside ensureDailyCapNotExceeded), checks against the 24h cap, then performs the update in a separate statement. Two concurrent updates for the same actor on the same day can both pass the cap check before either write commits, together exceeding 24 hours. The create() path correctly uses a SERIALIZABLE $transaction + P2034 retry; update() does not.

```
    if (existing.userId) {
      await this.ensureDailyCapNotExceeded(
        { kind: 'user', userId: existing.userId },
        effectiveDate,
        effectiveHours,
        id,
      );
    } else if (existing.thirdPartyId) {
      await this.ensureDailyCapNotExceeded(
        { kind: 'thirdParty', thirdPartyId: existing.thirdPartyId },
        effectiveDate,
        effectiveHours,
        id,
      );
    }

    const entry = await this.prisma.timeEntry.update({
```

- **Root cause**: The SERIALIZABLE transaction pattern applied to create() was not applied to update(). ensureDailyCapNotExceeded is a read, and the subsequent prisma.timeEntry.update is a separate write — no atomicity between them.
- **Impact**: Two concurrent updates to time entries for the same actor+day can both succeed while together exceeding the 24h cap. This is a real (not theoretical) race for any system with multiple concurrent API clients (mobile + web, or parallel API consumers). Violates the daily cap payroll invariant.
- **Suggested fix**: Wrap ensureDailyCapNotExceeded + timeEntry.update in a SERIALIZABLE $transaction with P2034 one-shot retry, matching the create() pattern.
- **Acceptance criteria**:
  - update() wraps cap-check + write in a SERIALIZABLE $transaction
  - P2034 one-shot retry is applied to update() matching the create() pattern
  - Concurrent update test asserts cap is enforced under race
- **Verification**: `grep -n 'SERIALIZABLE\|ensureDailyCap\|update' apps/api/src/time-tracking/time-tracking.service.ts | head -30`
- **Related**: DAT-002, DAT-003, DAT-004, DAT-006, DAT-001, COR-030, COR-031
- **Notes**: The comment in the code acknowledges this as an acceptable risk; this finding documents it as important for prioritization.

#### COR-030 — settings.service.ts bulkUpdate applies changes without a transaction — partial updates possible

**🟠 important** · `apps/api/src/settings/settings.service.ts:302-311` · confidence: high · cluster D · atomicity

The `bulkUpdate` method iterates over setting keys and calls `this.update()` sequentially without wrapping them in a `$transaction`. If the second or later `update()` call throws (e.g., unknown key validation error from `isKnownKey`, or a DB error), earlier settings are already committed to the DB. The operation is not atomic.

```
  async bulkUpdate(settings: Record<string, unknown>, actorId?: string) {
    const results: ParsedSetting[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const result = await this.update(key, value, undefined, actorId);
      results.push(result);
    }

    return results;
  }
```

- **Root cause**: Each `this.update()` call independently issues a `prisma.appSettings.upsert()`. Without a shared transaction, any error mid-iteration leaves the DB in a partially updated state.
- **Impact**: An operator sending a bulk update with a mix of valid and invalid keys will have the valid keys applied and the invalid ones rejected, leaving the settings in an inconsistent state. This is particularly relevant for related settings (e.g., `planning.visibleDays` + `planning.specialDays`) that should be updated atomically.
- **Suggested fix**: Wrap the entire `bulkUpdate` loop inside a `this.prisma.$transaction(async (tx) => { ... })`, and thread the `tx` client into each `update` call. Alternatively, validate all keys upfront before executing any DB writes.
- **Acceptance criteria**:
  - If one key in a bulk update is invalid or fails, no keys are committed to the DB.
  - If all keys are valid, all are committed atomically.
- **Verification**: `grep -n 'bulkUpdate\|\$transaction' apps/api/src/settings/settings.service.ts`
- **Related**: DAT-002, DAT-003, DAT-004, DAT-006, DAT-001, COR-029, COR-031

#### COR-031 — createAssignment has TOCTOU: telework check runs outside the transaction

**🟠 important** · `apps/api/src/predefined-tasks/predefined-tasks.service.ts:267-320` · confidence: high · cluster D · race_condition

The single-assignment `createAssignment` calls `assertTeleworkCompatibility` (line 277) outside any transaction before the `prisma.predefinedTaskAssignment.create` call (line 280). Between the telework check and the create, another request could schedule a telework day for the user on that date, bypassing the incompatibility guard. The bulk variant (`createBulkAssignment`) explicitly fixes this with COR-021 by re-running the telework check inside the transaction. The single-assignment path lacks the same protection.

```
  async createAssignment(assignedById: string, dto: CreateAssignmentDto) {
    // Check predefined task exists
    const task = await this.prisma.predefinedTask.findUnique({
      where: { id: dto.predefinedTaskId },
    });
    if (!task || !task.isActive) {
      throw new NotFoundException(
        `Tâche prédéfinie ${dto.predefinedTaskId} introuvable ou inactive`,
      );
    }
    await this.assertTeleworkCompatibility(task, [dto.userId], [dto.date]);

    try {
      return await this.prisma.predefinedTaskAssignment.create({
```

- **Root cause**: The TOCTOU window exists between `assertTeleworkCompatibility` (DB read: `teleworkSchedule.findMany`) and `predefinedTaskAssignment.create` (DB write). These are two separate DB operations without a shared transaction.
- **Impact**: A user could be assigned a non-telework-compatible task on a telework day if a concurrent request schedules the telework day between the compatibility check and the insert. This is especially likely in planning tools where batch scheduling operations happen concurrently.
- **Suggested fix**: Mirror the `createBulkAssignment` pattern: wrap the telework check and create inside a single `$transaction`, using `assertTeleworkCompatibilityTx(tx, ...)` instead of `assertTeleworkCompatibility(this.prisma, ...)`.
- **Acceptance criteria**:
  - The telework compatibility check and the assignment creation are in the same Prisma transaction.
  - A concurrent telework schedule insertion cannot bypass the compatibility guard.
- **Verification**: `grep -n 'assertTeleworkCompatibility\|\$transaction' apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- **Related**: DAT-002, DAT-003, DAT-004, DAT-006, DAT-001, COR-029, COR-030

#### COR-032 — HealthService creates a Redis connection that is never closed on module teardown

**🟠 important** · `apps/api/src/health/health.service.ts:36-57` · confidence: high · resource-lifecycle

HealthService instantiates a new ioredis `Redis` object in its constructor (either from `REDIS_URL` or individual host/port settings). The class does not implement `OnModuleDestroy` (or `OnApplicationShutdown`), so `this.redis.disconnect()` / `this.redis.quit()` is never called. On graceful shutdown, the open socket prevents the process from exiting cleanly and may cause the process to hang or leave a dangling connection to the Redis server.

```
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        connectTimeout: 3000,
        commandTimeout: 3000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    } else {
```

- **Root cause**: The class declares `private readonly redis: Redis` and initialises it eagerly in the constructor, but the class signature is `export class HealthService` with no lifecycle interfaces. Without `implements OnModuleDestroy`, NestJS never calls a teardown hook, leaving the TCP socket open.
- **Impact**: On every application restart or graceful shutdown, a Redis connection is leaked. In high-churn environments (rolling updates, health-check restarts) this exhausts Redis connection slots. The process may also stall during shutdown because Node.js won't exit while an active socket is open.
- **Suggested fix**: Add `implements OnModuleDestroy` and a corresponding `async onModuleDestroy() { await this.redis.quit(); }` method, matching the pattern already used by `PrismaService` (`onModuleDestroy` → `$disconnect`).
- **Acceptance criteria**:
  - HealthService implements OnModuleDestroy
  - onModuleDestroy calls this.redis.quit() or this.redis.disconnect()
  - App graceful shutdown completes without hanging
- **Verification**: `grep -n 'OnModuleDestroy\|onModuleDestroy\|quit\|disconnect' apps/api/src/health/health.service.ts`
- **Notes**: The same omission exists in other services (login-lockout, jwt-blacklist, cache.service, etc.) but those are outside the scan scope.

#### COR-011 — ImportLeaveDto.startDate and endDate accept arbitrary strings — missing @IsDateString()

**🟡 nit** · `apps/api/src/leaves/dto/import-leaves.dto.ts:36-46` · confidence: high · cluster B · input_validation

Both date fields use only `@IsString()` and `@IsNotEmpty()`, so any non-empty string passes DTO validation. While the service has an `isNaN(startDate.getTime())` guard at line 3688 that silently skips bad rows, the DTO contract does not enforce ISO 8601 format at the boundary. Malformed dates such as `"2026-99-99"`, `"not-a-date"`, or locale-specific formats like `"01/03/2026"` are accepted by the controller and propagate to the service.

```
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin (YYYY-MM-DD)',
    example: '2026-03-05',
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;
```

- **Root cause**: The DTO was written with `@IsString()` instead of `@IsDateString()`. The two sibling DTOs `CreateLeaveDto` and `UpdateLeaveDto` correctly use `@IsDateString()` on their date fields.
- **Impact**: Malformed dates in bulk imports produce opaque error rows in the errorDetails array rather than a clear 400 validation error, complicating diagnostics. If the isNaN guard were ever removed or refactored, silent bad data could enter the DB. There is also a secondary risk that `"01/03/2026"` (French locale format) passes `isNaN` as a valid JS Date on some environments, creating an off-by-one date stored in UTC.
- **Suggested fix**: Replace `@IsString()` with `@IsDateString()` on both `startDate` and `endDate` in `ImportLeaveDto`. Remove the now-redundant `@IsNotEmpty()` since `@IsDateString()` rejects empty strings.
- **Acceptance criteria**:
  - POST /leaves/import/validate with startDate='not-a-date' returns HTTP 400 with a class-validator error on startDate
  - POST /leaves/import with endDate='01/03/2026' returns HTTP 400
  - POST /leaves/import with startDate='2026-03-01' continues to succeed
- **Verification**: `grep -n 'IsDateString\|IsString' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leaves/dto/import-leaves.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### COR-012 — getTeamSchedule departmentId query parameter not validated as UUID

**🟡 nit** · `apps/api/src/telework/telework.controller.ts:138-147` · confidence: high · cluster B · input_validation

`departmentId` is passed as a raw `string` query parameter without UUID format validation. It is forwarded to `getTeamSchedule` and used directly in a Prisma `where: { departmentId }` clause. Prisma parameterizes the query so there is no SQL injection risk, but a malformed value (e.g. empty string, non-UUID) will simply produce a Prisma P2023 type error surfaced as a 500, rather than a clean 400.

```
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  ...
  async getTeamSchedule(
    @Param('date') date: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.teleworkService.getTeamSchedule(date, departmentId);
```

- **Root cause**: The parameter was not wrapped in `ParseUUIDPipe` or an equivalent DTO, unlike all UUID path parameters in the same controller which consistently use `ParseUUIDPipe`.
- **Impact**: Malformed departmentId values produce unhandled Prisma errors exposed as 500 responses instead of 400, leaking internal error messages in non-production error filters.
- **Suggested fix**: Apply `@Query('departmentId', new ParseUUIDPipe({ optional: true })) departmentId?: string` to validate and normalize the optional parameter.
- **Acceptance criteria**:
  - GET /telework/team/2026-06-01?departmentId=not-a-uuid returns HTTP 400
  - GET /telework/team/2026-06-01 (no departmentId) continues to return 200
  - GET /telework/team/2026-06-01?departmentId=<valid-uuid> continues to return 200
- **Verification**: `grep -n 'ParseUUIDPipe\|departmentId' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/telework/telework.controller.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### COR-013 — `@MaxLength(5 * 1024 * 1024)` on `ImportIcsDto.icsContent` is dead code — Fastify 1 MB bodyLimit fires first

**🟡 nit** · `apps/api/src/planning-export/dto/import-ics.dto.ts:1-15` · confidence: high · misleading-validation

The `@MaxLength(5_242_880)` decorator on `icsContent` is unreachable. Fastify is configured with `bodyLimit: 1_048_576` (1 MB) in `main.ts`, and this limit is enforced at the transport layer before NestJS pipes (and therefore class-validator) run. An oversized body returns HTTP 413 from Fastify before `ValidationPipe` ever sees the payload. The annotation misleads developers into believing the application enforces a 5 MB ceiling when the real enforced ceiling is 1 MB.

```
@IsString()
@MaxLength(5 * 1024 * 1024)
icsContent: string;
```

- **Root cause**: The `@MaxLength` annotation was likely added as a belt-and-suspenders check without accounting for the Fastify-layer enforcement order. class-validator runs after body parsing; Fastify rejects bodies above `bodyLimit` before parsing completes.
- **Impact**: No security impact — the effective limit is the Fastify `bodyLimit` (1 MB). The risk is developer confusion: a future developer might increase the `@MaxLength` value thinking they are increasing the actual limit, while the real gate is in `main.ts`.
- **Suggested fix**: Remove the `@MaxLength(5 * 1024 * 1024)` decorator, and optionally add a comment referencing `main.ts bodyLimit` to document where the real constraint lives. If a tighter application-layer limit is desired (e.g., 512 KB), align `@MaxLength` with the Fastify `bodyLimit` value.
- **Acceptance criteria**:
  - Either the `@MaxLength` annotation matches the actual Fastify `bodyLimit` in `main.ts`, or it is removed with a comment documenting the Fastify-layer constraint
  - No functional regression in the import endpoint
- **Verification**: `grep -n 'bodyLimit\|MaxLength' apps/api/src/main.ts apps/api/src/planning-export/dto/import-ics.dto.ts`

#### COR-014 — Time-tracking report endpoints accept raw date strings with no `@IsISO8601` validation — invalid input causes unhandled Prisma error / HTTP 500

**🟡 nit** · `apps/api/src/time-tracking/time-tracking.controller.ts:135-200` · confidence: high · cluster B · missing-input-validation

The `GET /time-tracking/me/report`, `GET /time-tracking/user/:userId/report`, and `GET /time-tracking/project/:projectId/report` routes accept `startDate` and `endDate` as plain `@Query()` strings with no DTO wrapper, no `@IsISO8601` pipe, and no `ParseDatePipe`. The service passes them directly to `new Date(startDate)` without an `isNaN` check. An invalid value like `startDate=foo` produces `Invalid Date`, which Prisma accepts silently for `gte`/`lte` filters — or throws an opaque 500, leaking a stack trace in development mode. The `GET /time-tracking/` `findAll` route also accepts raw date strings but the impact is the same.

```
@Get('me/report')
@AllowSelfService()
getMyReport(
  @CurrentUser('id') userId: string,
  @Query('startDate') startDate: string,
  @Query('endDate') endDate: string,
) {
  return this.timeTrackingService.getUserReport(userId, startDate, endDate);
}
```

- **Root cause**: The report routes were implemented with raw `@Query` decorators instead of a typed DTO with class-validator. The service (`getUserReport`, `getProjectReport`) does not validate the parsed date before using it.
- **Impact**: Any authenticated user can send `startDate=garbage` and receive an HTTP 500 (or empty result set depending on Prisma version). In development mode this may expose a stack trace. In production the opaque error still constitutes unexpected behavior. No data-mutation risk.
- **Suggested fix**: Create a `TimeReportQueryDto` with `@IsISO8601() startDate: string` and `@IsISO8601() endDate: string`, and use it for all three report routes. Alternatively, add `isNaN(start.getTime())` guards in the service and throw `BadRequestException` on invalid input.
- **Acceptance criteria**:
  - Sending `startDate=notadate` to `GET /time-tracking/me/report` returns HTTP 400 with a validation error message
  - Valid ISO 8601 strings continue to return correct results
  - The same validation covers `GET /time-tracking/user/:userId/report` and `GET /time-tracking/project/:projectId/report`
- **Verification**: `grep -n 'IsISO8601\|@Query.*startDate\|@Query.*endDate' apps/api/src/time-tracking/time-tracking.controller.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### COR-015 — daysOfWeek array missing @ArrayMaxSize — combined with createMany without skipDuplicates enables duplicate recurring-rule insertion

**🟡 nit** · `apps/api/src/predefined-tasks/dto/create-bulk-recurring-rules.dto.ts:41-46` · confidence: medium · cluster B · input-validation

daysOfWeek accepts an unbounded array where individual values are bounded to 0–6 but array length is uncapped. A caller can submit [0,0,0,...] (hundreds of entries). The service's bulkCreateRecurringRules builds a cross-product of userIds (capped at 50) × daysOfWeek (unbounded) and inserts via createMany in a held transaction without skipDuplicates. Duplicate day values in the request create duplicate DB rows per user, corrupting the rule table and inflating scheduled task generation.

```
@IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];
```

- **Root cause**: The developer added @ArrayMaxSize(50) and @ArrayMaxSize(90) to sibling arrays in the same file (userIds and dates) but omitted @ArrayMaxSize from daysOfWeek. The createMany at line 506 of predefined-tasks.service.ts also lacks skipDuplicates:true.
- **Impact**: A predefined_tasks:assign holder (MANAGER and above) can generate O(50 × N) duplicate recurring rules in a single request, consuming DB storage and causing duplicate task generation on each recurrence expansion. Combined with the missing cap this is an unbounded write amplification inside a transaction.
- **Suggested fix**: Add @ArrayMaxSize(7) to daysOfWeek (the maximum number of distinct days in a week). Also add skipDuplicates: true to the createMany call at predefined-tasks.service.ts line 506 as defense in depth. Consider adding a @ArrayUnique() custom validator or deduplicating in the service.
- **Acceptance criteria**:
  - POST /predefined-tasks/bulk-recurring-rules with daysOfWeek of length > 7 returns 400 Bad Request
  - POST with daysOfWeek [0,0,0] creates exactly 1 rule per user, not 3
  - createMany call for recurring rules uses skipDuplicates: true or service deduplicates daysOfWeek before insert
- **Verification**: `grep -n 'ArrayMaxSize\|skipDuplicates' apps/api/src/predefined-tasks/dto/create-bulk-recurring-rules.dto.ts apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-016, COR-017, COR-018, SEC-021
- **Notes**: predefined-tasks.service.ts line 506: `const { count } = await tx.predefinedTaskRecurringRule.createMany({ data: allRuleData });` — no skipDuplicates option present.

#### COR-016 — UpdateRecurringRuleDto.isActive missing @IsBoolean — invalid value reaches Prisma instead of 400

**🟡 nit** · `apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts:271-275` · confidence: high · cluster B · input-validation

The isActive field on UpdateRecurringRuleDto has @IsOptional() but no @IsBoolean(). When a caller sends a non-boolean value (e.g. the string "yes"), class-validator has no type constraint to reject it. The ValidationPipe does NOT use enableImplicitConversion (class-transformer implicit conversion is off — confirmed by the explicit @Type(() => Number) annotations throughout the DTO layer), so the raw string value passes through the pipeline unchanged and reaches Prisma, which throws a type error resulting in an unhandled 500 instead of a clean 400.

```
@ApiPropertyOptional({
    description: 'Statut actif/inactif',
  })
  @IsOptional()
  isActive?: boolean;
```

- **Root cause**: Missing @IsBoolean() decorator on the isActive update field. The symmetrical CreateRecurringRuleDto (in the same file, the class above) has this correctly validated. The update-only class was not kept in sync.
- **Impact**: Callers sending non-boolean values for isActive on PATCH /predefined-tasks/recurring-rules/:id receive a 500 instead of a 400. This leaks stack traces in non-production environments and degrades API usability.
- **Suggested fix**: Add @IsBoolean() decorator above @IsOptional() on isActive in UpdateRecurringRuleDto.
- **Acceptance criteria**:
  - PATCH /predefined-tasks/recurring-rules/:id with isActive: "yes" returns 400 Bad Request
  - PATCH with isActive: true and isActive: false both return 200 OK
- **Verification**: `grep -n -A3 'isActive' apps/api/src/predefined-tasks/dto/create-recurring-rule.dto.ts | grep -A3 'IsOptional'`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-017, COR-018, SEC-021
- **Notes**: The same class file earlier defines CreateRecurringRuleDto which has @IsBoolean() @IsOptional() isActive correctly. The inconsistency is in the Update variant class defined later in the same file.

#### COR-017 — Unvalidated startDate/endDate query strings cause Invalid Date → potential 500 in findAssignments

**🟡 nit** · `apps/api/src/predefined-tasks/predefined-tasks.service.ts:232-239` · confidence: high · cluster B · input-validation

The service passes raw strings from query parameters directly to `new Date()`. A string like "not-a-date" produces a JavaScript Invalid Date object (NaN internally). Prisma receives this as the filter value and throws a PrismaClientValidationError, which NestJS surfaces as an unhandled 500 rather than a clean 400.

```
...(filters.startDate || filters.endDate
          ? {
              date: {
                ...(filters.startDate && { gte: new Date(filters.startDate) }),
                ...(filters.endDate && { lte: new Date(filters.endDate) }),
              },
            }
          : {}),
```

- **Root cause**: The controller receives startDate and endDate as raw `string` query parameters (no ParseDate pipe or @IsDateString DTO validation applied at the controller layer). The service trusts the caller-supplied strings without parsing or validating them.
- **Impact**: Any holder of predefined_tasks:view can trigger a 500 by sending a malformed date in the startDate/endDate query params. In non-production environments this leaks stack traces.
- **Suggested fix**: Add a dedicated QueryDto class with @IsDateString() @IsOptional() for startDate and endDate at the controller layer, or validate inside the service with `if (filters.startDate && isNaN(new Date(filters.startDate).getTime())) throw new BadRequestException(...)`. Similarly apply ParseUUIDPipe to userId and predefinedTaskId query params.
- **Acceptance criteria**:
  - GET /predefined-tasks/assignments?startDate=not-a-date returns 400 Bad Request
  - GET /predefined-tasks/assignments?userId=not-a-uuid returns 400 Bad Request
  - GET /predefined-tasks/assignments?startDate=2026-01-01 returns 200 OK
- **Verification**: `grep -n 'new Date(filters' apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-018, SEC-021
- **Notes**: The companion userId and predefinedTaskId params at controller lines 117-120 are also plain string query params with no ParseUUIDPipe, surfacing similar Prisma validation errors for malformed UUIDs.

#### COR-018 — taskId query param in GET /comments has no ParseUUIDPipe — malformed UUID causes Prisma 500

**🟡 nit** · `apps/api/src/comments/comments.controller.ts:58` · confidence: high · cluster B · input-validation

The `page` and `limit` query parameters use ParseIntPipe for type enforcement, but `taskId` is accepted as a raw string with no UUID validation. A caller sending `?taskId=not-a-uuid` will cause Prisma to reject the malformed UUID in the WHERE clause, producing an unhandled 500 instead of a clean 400.

```
@Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('taskId') taskId?: string,
    @CurrentUser() user?: AuthenticatedUser,
```

- **Root cause**: Inconsistent application of ParseUUIDPipe: the pattern was applied on route :id parameters but missed on query string UUID parameters in this controller.
- **Impact**: Any authenticated user with comments:read can trigger a 500 by sending a non-UUID taskId. In non-production environments this may leak stack traces.
- **Suggested fix**: Add `new ParseUUIDPipe({ optional: true })` to the taskId @Query decorator: `@Query('taskId', new ParseUUIDPipe({ optional: true })) taskId?: string`
- **Acceptance criteria**:
  - GET /comments?taskId=not-a-uuid returns 400 Bad Request
  - GET /comments?taskId= (omitted) returns 200 OK with all accessible comments
  - GET /comments?taskId=<valid-uuid> returns 200 OK with filtered comments
- **Verification**: `grep -n 'taskId' apps/api/src/comments/comments.controller.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, SEC-021
- **Notes**: The service method findAll at comments.service.ts line 67 does `const where: any = taskId ? { taskId } : {}` — Prisma receives the raw string and rejects a non-UUID value at the DB layer.

#### COR-019 — resetPassword() (token-based) does not clear forcePasswordChange flag

**🟡 nit** · `apps/api/src/auth/auth.service.ts:622-625` · confidence: medium · business_invariant

When a user resets their password via the public token endpoint (POST /auth/reset-password), the Serializable transaction updates only passwordHash. If the user account has forcePasswordChange=true, the flag remains set after the reset. On next login, ForcePasswordChangeGuard blocks all routes except PATCH /users/me/change-password, which expects the current password — the user does know this password (they just set it), so recovery is possible but unintuitive.

```
        await tx.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        });
```

- **Root cause**: The data object in the tx.user.update call was not extended with forcePasswordChange: false when the forcePasswordChange mechanic was added. changePassword() (line 1089-1091 in users.service.ts) correctly clears both fields atomically.
- **Impact**: A user who was flagged forcePasswordChange=true (e.g., after an admin reset) and then uses the self-service token flow will land in an unexpected state: they receive no error, but must immediately change their password again via the authenticated changePassword endpoint before any other action. This is recoverable but confusing and inconsistent with the intent of the token-based reset path.
- **Suggested fix**: Add forcePasswordChange: false to the data object: data: { passwordHash, forcePasswordChange: false }
- **Acceptance criteria**:
  - After a successful POST /auth/reset-password, a user previously flagged forcePasswordChange=true can access all routes on next login
  - changePassword() and resetPassword() both clear the flag atomically in the same DB write
- **Verification**: `grep -n 'forcePasswordChange' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/auth.service.ts`
- **Notes**: The admin reset path (users.service.ts resetPassword, line 1176-1179) also omits forcePasswordChange: false — but that is likely intentional (admin sets a temporary password, intending to force a change on first login). Only the user-facing token reset path is flagged here.

#### COR-020 — getUserStats() uses new Date().getFullYear() (local TZ) for default year, inconsistent with LEAVE_TIMEZONE/UTC anchoring used elsewhere

**🟡 nit** · `apps/api/src/telework/telework.service.ts:560` · confidence: medium · cluster C · timezone

When the caller omits the `year` parameter, `getUserStats()` defaults to `new Date().getFullYear()` (local-TZ year). The year-window bounds two lines later use `Date.UTC()` (COR-035) for TZ-independence, but the default year itself is derived from the local clock. On UTC+1 in winter, at 2026-01-01T00:30:00+01:00 (2025-12-31T23:30:00Z), `getFullYear()` returns 2026 while the UTC year is still 2025. `getLeaveBalance()` in `leaves.service.ts` uses `formatInTimeZone(new Date(), LEAVE_TIMEZONE, 'yyyy')` instead — the correct pattern.

```
    const currentYear = year ?? new Date().getFullYear();
```

- **Root cause**: `getFullYear()` reads local-TZ year. For a Paris TZ codebase, the correct default year should use `formatInTimeZone(new Date(), LEAVE_TIMEZONE, 'yyyy')` to match the leave balance year windows.
- **Impact**: During the first hour of Jan 1 in Paris (UTC midnight to UTC+1 midnight), a user calling `getUserStats()` with no year gets year N (the new year's UTC year) but the query bounds via `Date.UTC(currentYear, 0, 1)` etc. are already year N. So on a UTC-running server this is a no-op mismatch window. Practically harmless but inconsistent.
- **Suggested fix**: Use the same pattern as `getLeaveBalance()`:
```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { LEAVE_TIMEZONE } from '../leaves/leave-year-window';
// ...
const currentYear = year ?? parseInt(formatInTimeZone(new Date(), LEAVE_TIMEZONE, 'yyyy'), 10);
```
- **Acceptance criteria**:
  - Default year in getUserStats() uses LEAVE_TIMEZONE-anchored year, matching getLeaveBalance() pattern
- **Verification**: `grep -n 'getFullYear\|formatInTimeZone' apps/api/src/telework/telework.service.ts | head -10`
- **Related**: COR-004, COR-005, COR-022, COR-010, COR-023, COR-026, COR-027, COR-035
- **Notes**: On a UTC prod server (as documented in MEMORY.md), `getFullYear()` equals the UTC year, so there is no live impact. This is a consistency nit relative to the codebase's own conventions.

#### COR-021 — approve() passes hardcoded null for endHalfDay to splitLeaveByYear() — balance gate may be over-strict for cross-year leaves with end half-days

**🟡 nit** · `apps/api/src/leaves/leaves.service.ts:1785-1791` · confidence: medium · balance-math

`endHalfDay` is not persisted in the Prisma schema — it is baked into the `days` float at create/update time. When `approve()` recomputes year buckets for the balance gate, it calls `splitLeaveByYear(..., null, ...)` for `endHalfDay`. For a cross-year leave (e.g., Dec 28 – Jan 3) where the last day has an afternoon half-day, `splitLeaveByYear` with `endHalfDay=null` will count the end date as a full day and allocate 0.5 more days to year N+1 than were originally stored. The balance check in the Serializable transaction tests `balance >= approveYearBuckets[year]`, so an over-inflated bucket makes the gate refuse approval even when the user has sufficient balance.

```
    const approveYearBuckets = splitLeaveByYear(
      leave.startDate,
      leave.endDate,
      leave.halfDay ?? null,
      null,
      approveHolidayKeys,
    );
```

- **Root cause**: `endHalfDay` is not a DB column (COR-015 documents the fraction approach as intentional). `approve()` cannot recover the original `endHalfDay` intent. The COR-015 workaround (`getAvailableDays` uses the stored `days` float directly) was applied to balance display but not to the approval gate.
- **Impact**: Cross-year leaves with an end-half-day will consume 0.5 more days in the balance gate for year N+1 than actually stored. For a user with balance exactly equal to the leave's proportional N+1 share, approval will be incorrectly blocked with InsufficientLeaveBalance. This is an edge case: requires a cross-year leave AND end half-day AND balance exactly at the boundary. The workaround is the approver uses a slightly higher balance.
- **Suggested fix**: Mirror the COR-015 fraction-of-stored-days approach in the approve gate: instead of recomputing via `splitLeaveByYear` (which cannot recover `endHalfDay`), use the stored `leave.days` as the total and derive year fractions from `splitLeaveByYear` proportions:
```typescript
const proportions = splitLeaveByYear(leave.startDate, leave.endDate, leave.halfDay ?? null, null, approveHolidayKeys);
const totalComputed = Object.values(proportions).reduce((s, v) => s + v, 0);
// Scale stored days by proportion
const approveYearBuckets = Object.fromEntries(
  Object.entries(proportions).map(([yr, d]) => [yr, leave.days * (d / totalComputed)])
);
```
Alternatively, persist `endHalfDay` as a nullable DB column to be able to recompute exactly.
- **Acceptance criteria**:
  - Cross-year leave with endHalfDay=AFTERNOON and exact-balance user can be approved
  - Unit test added: splitLeaveByYear with null endHalfDay vs actual endHalfDay produces different N+1 bucket for a cross-year leave
- **Verification**: `grep -n 'approveYearBuckets\|splitLeaveByYear\|endHalfDay' apps/api/src/leaves/leaves.service.ts | head -20`
- **Notes**: Only affects cross-year leaves (rare in French public-sector practice) where `endHalfDay` is set. The over-strict gate means false rejections, not false approvals — conservative direction.

#### COR-022 — captureSnapshots uses setHours(0,0,0,0) — implicit process-local timezone for snapshot date key

**🟡 nit** · `apps/api/src/projects/projects.service.ts:1229-1231` · confidence: medium · cluster C · timezone anchor

setHours(0,0,0,0) sets the hours in the Node.js process's local timezone, not UTC. The snapshot dedup query (line 1234) uses date: startOfDay to find existing snapshots written under the same midnight boundary. If process TZ changes (e.g. a new Docker host running in a non-UTC timezone), a snapshot written at 00:00 UTC will not be found by a query at 00:00 local-TZ, potentially causing double-snapshotting or missed snapshots across the midnight boundary. The MEMORY entry confirms prod runs UTC today, so no production impact currently.

```
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
```

- **Root cause**: setHours() uses the local timezone. The correct approach is to compute midnight UTC explicitly: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).
- **Impact**: Low risk given prod is UTC. If the process TZ is ever changed or the service is deployed in a non-UTC environment, the snapshot date boundary will shift relative to stored records, producing duplicate daily snapshots or skipped days.
- **Suggested fix**: Replace setHours(0,0,0,0) with an explicit UTC midnight: const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
- **Acceptance criteria**:
  - startOfDay is computed as UTC midnight (Date.UTC)
  - Snapshot dedup test: running captureSnapshots twice in the same UTC day creates exactly 1 snapshot per project
- **Verification**: `grep -n 'setHours\|startOfDay\|Date.UTC' apps/api/src/projects/projects.service.ts`
- **Related**: COR-004, COR-005, COR-020, COR-010, COR-023, COR-026, COR-027, COR-035
- **Notes**: MEMORY says prod is UTC, so this is latent risk, not an active bug.

#### COR-023 — Recurrence generation loop uses local-TZ setDate() instead of UTC-safe arithmetic

**🟡 nit** · `apps/api/src/events/events.service.ts:224-243` · confidence: low · cluster C · timezone anchor missing

setDate(getDate() + N) advances the date in local timezone. When DST transitions occur (spring forward / fall back), a weekly recurrence crossing a DST boundary lands on the wrong UTC day. Event dates stored as @db.Date are compared as UTC midnight, so a DST-shifted occurrence may be stored one day off.

```
          let currentDate = new Date(eventDateObj);
          currentDate.setDate(currentDate.getDate() + weekInterval * 7);

          while (currentDate <= endDate) {
            childRows.push({
              id: randomUUID(),
              title: eventData.title || parentEvent.title,
              description: eventData.description ?? null,
              date: new Date(currentDate),
              startTime: eventData.startTime ?? null,
              endTime: eventData.endTime ?? null,
              isAllDay: eventData.isAllDay ?? true,
              isExternalIntervention: eventData.isExternalIntervention ?? false,
              projectId: projectId || null,
              createdById,
              parentEventId: parentEvent.id,
            });
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + weekInterval * 7);
          }
```

- **Root cause**: Date.setDate/getDate operate in the local timezone. The safe pattern for calendar-day arithmetic is to work with UTC ms offsets or use Date.UTC() throughout.
- **Impact**: For bi-annual DST transitions (France: last Sunday March / last Sunday October), a recurring event near the transition could land on the wrong day in the calendar view for all participants. Affects all recurring events created that span a DST boundary.
- **Suggested fix**: Use UTC-safe day advancement:
```ts
function addUTCDays(d: Date, days: number): Date {
  return new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days
  ));
}
let currentDate = addUTCDays(eventDateObj, weekInterval * 7);
while (currentDate <= endDate) {
  childRows.push({ ..., date: new Date(currentDate), ... });
  currentDate = addUTCDays(currentDate, weekInterval * 7);
}
```
- **Acceptance criteria**:
  - Occurrence generation uses UTC-only date arithmetic
  - Test creates a weekly series spanning the spring DST boundary and verifies no occurrence shifts by one day
- **Verification**: `grep -n 'setDate\|getDate' apps/api/src/events/events.service.ts`
- **Related**: COR-004, COR-005, COR-020, COR-022, COR-010, COR-026, COR-027, COR-035
- **Notes**: Low frequency impact (2 transitions/year) but silent and hard to diagnose. [severity normalized from 'low']

#### COR-027 — previewImport() and importIcs(): ICS times extracted with local getHours/getMinutes

**🟡 nit** · `apps/api/src/planning-export/planning-export.service.ts:207, 289` · confidence: low · cluster C · timezone anchor missing

Both previewImport() (line 207) and importIcs() (line 289) extract startTime/endTime from node-ical Date objects using getHours()/getMinutes() which return local-timezone values. node-ical parses DTSTART as a JavaScript Date object in UTC. Calling getHours() on a UTC Date in a non-UTC Node.js process returns the local-adjusted hour, producing a stored HH:MM that is offset by the server's UTC offset.

```
      if (start && !(start as unknown as { dateOnly?: boolean }).dateOnly) {
        startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
      }
```

- **Root cause**: Should use getUTCHours()/getUTCMinutes() to extract the hour components as intended by the ICS file's DTSTART value.
- **Impact**: ICS imports on a non-UTC server store incorrect startTime/endTime in the database. A meeting at 14:00 UTC in the ICS file is stored as '16:00' on a Europe/Paris (+2) server. This also creates a round-trip inconsistency: export then re-import of the same ICS produces different times.
- **Suggested fix**: Replace getHours/getMinutes with getUTCHours/getUTCMinutes in both previewImport and importIcs:
```ts
startTime = `${start.getUTCHours().toString().padStart(2, '0')}:${start.getUTCMinutes().toString().padStart(2, '0')}`;
```
- **Acceptance criteria**:
  - Both previewImport and importIcs use getUTCHours/getUTCMinutes
  - Round-trip test: export an event at 14:00 UTC, re-import, assert stored startTime is '14:00'
- **Verification**: `grep -n 'getHours\|getMinutes\|getUTCHours' apps/api/src/planning-export/planning-export.service.ts`
- **Related**: COR-004, COR-005, COR-020, COR-022, COR-010, COR-023, COR-026, COR-035
- **Notes**: The isAllDay detection logic on lines 279-283 also uses getHours/getMinutes for the all-day check — same issue, slightly different impact (an event at midnight UTC could be misclassified as all-day). [severity normalized from 'minor']

#### COR-033 — bulkCreateRecurringRules always reports `created: allRuleData.length` regardless of actual insertions

**🟡 nit** · `apps/api/src/predefined-tasks/predefined-tasks.service.ts:542` · confidence: medium · data_integrity

The `count` returned by `createMany` is scoped inside the `$transaction` callback and never surfaced to the outer scope. The returned object at line 542 always says `created: allRuleData.length` (the intended count), not the actual DB insertion count. This misreports to callers how many rules were actually created.

```
    const rules = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.predefinedTaskRecurringRule.createMany({
        data: allRuleData,
      });

      if (count === 0) return [];

      // Fetch created records with full includes (createMany has no include support)
      return tx.predefinedTaskRecurringRule.findMany({
```

- **Root cause**: The `count` variable from `createMany` is lexically scoped inside the transaction callback. The outer `rules` variable only receives the `findMany` result (or `[]`), discarding the actual insertion count. There is no unique constraint on `predefined_task_recurring_rules`, so there can be no skip-duplicates behavior, but future errors or constraints could cause the real count to differ.
- **Impact**: API clients receive a consistently inflated `created` count. If an insertion partially fails (e.g., constraint added in future, DB failure mid-batch), callers cannot detect the discrepancy. The `rules` array returned by `findMany` may also include pre-existing rows matching the same filter predicate, not just newly created ones — its length can exceed `allRuleData.length`.
- **Suggested fix**: Return `count` from the transaction: change the callback to return `{ count, rules: ... }`. Update line 542 to `return { created: rules.length, rules }` after capturing the actual count, or restructure so `count` is accessible outside the transaction closure.
- **Acceptance criteria**:
  - When `createMany` inserts 3 out of 5 attempted rows, the API response `created` field equals 3, not 5.
  - The `rules` array contains only records with createdAt >= the request's start (or use a createdAt filter inside the transaction).
- **Verification**: `grep -n 'created: allRuleData.length' apps/api/src/predefined-tasks/predefined-tasks.service.ts`
- **Notes**: The `createBulkAssignment` method (line 368) correctly uses `{ created: count, skipped: totalPairs - count }` with the captured `count`. This method should follow the same pattern.

#### COR-034 — analytics: calculateMetrics uses uncapped tasks while projectDetails is capped at 50 projects — overdue task count is inflated relative to visible details

**🟡 nit** · `apps/api/src/analytics/analytics.service.ts:108-121` · confidence: medium · data_integrity

`getProjects()` applies `take: PROJECT_DETAILS_LIMIT` (50), so `projects` is capped. However, `getTasks()` has no cap — it returns tasks from ALL projects in scope. `calculateMetrics(projects, tasks, ...)` uses `tasks.length` and overdue task counts from ALL projects in scope, while `projectDetails` and `projectProgressData` only show data for the first 50 projects. A user with 51+ projects sees global metrics that include tasks from projects not shown in the details table.

```
    // Fetch projects (progress computed from the shared groupBy), tasks, and users in parallel.
    const [projects, tasks, users] = await Promise.all([
      this.getProjects(projectId, projectWhere, taskStatusGroupBy),
      this.getTasks(projectId, projectWhere),
      this.getActiveUsers(projectWhere),
    ]);

    // Calculate metrics
    const metrics = this.calculateMetrics(projects, tasks, users);
    const projectProgressData = this.getProjectProgressData(
      projects,
      taskStatusGroupBy,
    );
    const taskStatusData = this.getTaskStatusData(taskStatusGroupBy);
    const projectDetails = await this.getProjectDetails(projects, tasks);
```

- **Root cause**: `getProjects` caps at PROJECT_DETAILS_LIMIT for payload size, but `getTasks` is uncapped. The `calculateMetrics` function receives the full uncapped `tasks` array, creating a mismatch between the global KPI tiles and the project-by-project drill-down.
- **Impact**: The `overdueTasks` and `completionRate` metrics KPIs count tasks across all 51+ projects, but the project breakdown table only shows 50. An operator reviewing the dashboard cannot reconcile the KPIs with the project list. This does not cause data corruption but produces misleading analytics.
- **Suggested fix**: Either: (1) cap `getTasks()` to the same project set as `getProjects()` — add `projectId: { in: projects.map(p => p.id) }` after fetching projects; or (2) remove the project cap and accept larger payloads; or (3) add a note in the API response that KPIs are global and project details are limited to top-N.
- **Acceptance criteria**:
  - When a user has >50 in-scope projects, `metrics.overdueTasks` only counts tasks from the same projects listed in `projectDetails`, OR the API response documents the discrepancy explicitly.
- **Verification**: `grep -n 'PROJECT_DETAILS_LIMIT\|take:' apps/api/src/analytics/analytics.service.ts`

#### COR-035 — personal-todos cleanupOldCompleted uses local-time cutoffDate against UTC timestamps

**🟡 nit** · `apps/api/src/personal-todos/personal-todos.service.ts:111-124` · confidence: medium · cluster C · timezone

`cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS)` manipulates the Date using local time methods (`getDate`, `setDate`). If the Node.js process runs in a non-UTC timezone (e.g., `TZ=Europe/Paris`), the cutoff will be off by up to 2 hours (during DST), potentially deleting todos 1 day early or late. The `completedAt` field is stored as a UTC timestamp in PostgreSQL.

```
  private async cleanupOldCompleted(userId: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);

    await this.prisma.personalTodo.deleteMany({
      where: {
        userId,
        completed: true,
        completedAt: {
          lt: cutoffDate,
        },
      },
    });
  }
```

- **Root cause**: `new Date()` gives the current instant, and `getDate()`/`setDate()` operate in local time, not UTC. The code should use UTC-explicit arithmetic.
- **Impact**: In France (UTC+2 in summer), the cleanup runs 2 hours early relative to the intended 7-day boundary. A todo completed at 22:00 Paris time on day N would be in UTC at 20:00 UTC day N; the cutoff is computed in local midnight+offset. In practice this means todos can be deleted up to 2 hours earlier than the intended 7-day window. Low impact for user experience.
- **Suggested fix**: Replace with UTC arithmetic: `const cutoffDate = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);` — this is TZ-independent since `Date.now()` is always UTC epoch milliseconds.
- **Acceptance criteria**:
  - The cutoff calculation is TZ-independent: `new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000)` or equivalent UTC arithmetic.
- **Verification**: `grep -n 'setDate\|getDate\|cutoffDate' apps/api/src/personal-todos/personal-todos.service.ts`
- **Related**: COR-004, COR-005, COR-020, COR-022, COR-010, COR-023, COR-026, COR-027
- **Notes**: The CLEANUP_DAYS boundary is a soft UX feature (hide old completed items), not a hard security boundary, so the practical impact is small.

#### COR-036 — comments.service.ts update() does not handle P2025 (concurrent delete between findOne and update)

**🟡 nit** · `apps/api/src/comments/comments.service.ts:143-158` · confidence: medium · unhandled_error

Between the `findOne(id, currentUser)` call and the `prisma.comment.update({ where: { id } })`, another concurrent request (or the user themselves) could `DELETE` the comment (hard delete, line 183). In that race, Prisma throws `PrismaClientKnownRequestError` with code `P2025` ('Record to update not found'). This is not caught here, so NestJS will surface a 500 Internal Server Error instead of a 404.

```
    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            avatarPreset: true,
          },
        },
      },
    });
```

- **Root cause**: Hard-delete model + read-then-write pattern without a P2025 catch. The `update()` method does not catch Prisma errors.
- **Impact**: A concurrent delete during an update results in a 500 instead of 404. Low-frequency race condition.
- **Suggested fix**: Wrap `prisma.comment.update` in a try/catch that maps `P2025` → `NotFoundException`. Mirrors the pattern already in `documents.service.ts` (lines 252-260).
- **Acceptance criteria**:
  - A `P2025` from `prisma.comment.update` results in a 404 NotFoundException, not a 500.
- **Verification**: `grep -n 'P2025\|NotFoundException' apps/api/src/comments/comments.service.ts`

#### COR-037 — skills.service.ts findUsersBySkill: comment says 'ADVANCED' but enum has 'MASTER'

**🟡 nit** · `apps/api/src/skills/skills.service.ts:484` · confidence: high · documentation

The comment on line 484 documents the level order as `BEGINNER < INTERMEDIATE < ADVANCED < EXPERT`, but the actual `SkillLevel` enum (confirmed in schema.prisma) has values `BEGINNER, INTERMEDIATE, EXPERT, MASTER` — there is no `ADVANCED` level, and `MASTER` is the highest tier, not `EXPERT`. The `levelOrder` object correctly uses `EXPERT: 3, MASTER: 4`, making this purely a documentation error.

```
      // Ordre des niveaux : BEGINNER < INTERMEDIATE < ADVANCED < EXPERT
      const levelOrder = {
        [SkillLevel.BEGINNER]: 1,
        [SkillLevel.INTERMEDIATE]: 2,
        [SkillLevel.EXPERT]: 3,
        [SkillLevel.MASTER]: 4,
      };
```

- **Root cause**: Comment not updated after the enum was finalized. The code itself is correct.
- **Impact**: Misleading to developers reading the code, potential future confusion when adding functionality.
- **Suggested fix**: Update comment to: `// Level order: BEGINNER(1) < INTERMEDIATE(2) < EXPERT(3) < MASTER(4)`
- **Acceptance criteria**:
  - Comment accurately reflects the SkillLevel enum values.
- **Verification**: `grep -n 'ADVANCED\|SkillLevel' apps/api/src/skills/skills.service.ts`

#### COR-038 — skills.service.ts findUsersBySkill: silent empty result if minLevel not in levelOrder

**🟡 nit** · `apps/api/src/skills/skills.service.ts:492-498` · confidence: low · latent_bug

If `minLevel` is a SkillLevel value not present in `levelOrder` (impossible today but possible after a future enum addition without updating this code), `minLevelValue` resolves to `undefined`. `value >= undefined` evaluates to `false` for all entries, producing `in: []`. Prisma with `level: { in: [] }` returns zero rows silently, with no error or warning to the caller.

```
      const minLevelValue = levelOrder[minLevel];

      where.level = {
        in: Object.entries(levelOrder)
          .filter(([, value]) => value >= minLevelValue)
          .map(([key]) => key as SkillLevel),
      };
```

- **Root cause**: The `levelOrder` lookup is not exhaustive-checked. TypeScript would catch a missing key if `levelOrder` were typed as `Record<SkillLevel, number>` instead of a plain object literal.
- **Impact**: Future enum addition without updating this code would silently return no users for any `minLevel` filter. Currently zero impact.
- **Suggested fix**: Type `levelOrder` as `Record<SkillLevel, number>` so TypeScript flags missing enum keys at compile time. Add a guard: `if (minLevelValue === undefined) throw new BadRequestException('Unknown skill level');`
- **Acceptance criteria**:
  - TypeScript compilation fails if a new SkillLevel value is added without updating levelOrder.
  - An unknown minLevel at runtime produces an explicit error rather than an empty result.
- **Verification**: `npx nest build 2>&1 | grep -i 'skilllevel\|levelorder'`

#### COR-039 — cleanDatabase disables audit_logs triggers without a wrapping DB transaction, risking permanent trigger disable on crash

**🟡 nit** · `apps/api/src/prisma/prisma.service.ts:91-102` · confidence: medium · atomicity

`ALTER TABLE … DISABLE TRIGGER USER` is persistent DDL in PostgreSQL — it is NOT session-scoped. The three statements (DISABLE TRIGGER, TRUNCATE, ENABLE TRIGGER) execute as three independent DB round-trips with no wrapping transaction. If the Node process is killed or the DB connection drops after the DISABLE but before the ENABLE, the audit_logs immutability triggers remain permanently disabled in the test database. Subsequent test runs would write to audit_logs without integrity guards until the triggers are manually re-enabled.

```
    await this.$executeRawUnsafe(
      'ALTER TABLE "audit_logs" DISABLE TRIGGER USER',
    );
    try {
      await this.$executeRawUnsafe(
        `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
      );
    } finally {
      await this.$executeRawUnsafe(
        'ALTER TABLE "audit_logs" ENABLE TRIGGER USER',
      );
    }
```

- **Root cause**: The DISABLE TRIGGER and ENABLE TRIGGER DDL is outside any `$transaction` wrapper. PostgreSQL DDL changes are durable after commit; they are not automatically rolled back by connection loss unlike DML inside a transaction.
- **Impact**: A process crash between DISABLE and ENABLE leaves the test DB with audit_logs triggers permanently off. The next test run silently bypasses the immutability guarantee (no UPDATE/DELETE prevention) for all audit rows written during that run, undermining the integrity chain. The risk is limited to test/e2e databases by the `isTestDb` guard above.
- **Suggested fix**: Wrap all three DDL+DML statements in a single `this.$transaction(async (tx) => { ... })` call. Inside the transaction, use `tx.$executeRawUnsafe` for each statement. If the tx is rolled back (crash/exception), PostgreSQL reverts the DISABLE TRIGGER DDL along with the TRUNCATE.
- **Acceptance criteria**:
  - DISABLE TRIGGER USER, TRUNCATE, and ENABLE TRIGGER USER are all inside one $transaction call
  - If the transaction is rolled back, triggers remain enabled
- **Verification**: `grep -n '\$transaction\|DISABLE TRIGGER\|ENABLE TRIGGER\|TRUNCATE' apps/api/src/prisma/prisma.service.ts`
- **Notes**: PostgreSQL DDL (ALTER TABLE) is transactional in Postgres — unlike in MySQL/Oracle. Wrapping in a $transaction would correctly revert the DISABLE if the TRUNCATE fails. [severity normalized from 'low']

### Data integrity (27)

#### DAT-001 — stopRecurrence(): deleteMany + update not wrapped in a transaction

**🔴 blocking** · `apps/api/src/events/events.service.ts:895-905` · confidence: high · cluster D · non-atomic dual write

stopRecurrence() issues two separate Prisma calls with no surrounding $transaction. A crash or connection drop between the two writes leaves the parent event with isRecurring: true but no future children — a permanently inconsistent state where the recurring event appears active but generates no occurrences.

```
    await this.prisma.event.deleteMany({
      where: {
        parentEventId: id,
        date: { gte: today },
      },
    });

    await this.prisma.event.update({
      where: { id },
      data: { isRecurring: false },
    });
```

- **Root cause**: The two writes should be wrapped in a single $transaction([tx => { deleteMany; update }]) call. Similar multi-step mutations elsewhere in the same file (create, update) correctly use $transaction, but stopRecurrence was not given the same treatment.
- **Impact**: On any process interruption between the two awaits, the parent event retains isRecurring=true while all future occurrences have been deleted. The event then appears in recurring-event queries but returns no children, producing silent data corruption visible to all users. Recovery requires manual DB intervention.
- **Suggested fix**: Wrap both writes in a single interactive transaction:
```ts
await this.prisma.$transaction(async (tx) => {
  await tx.event.deleteMany({ where: { parentEventId: id, date: { gte: today } } });
  await tx.event.update({ where: { id }, data: { isRecurring: false } });
});
```
- **Acceptance criteria**:
  - Both deleteMany and update are inside the same $transaction callback
  - A simulated crash between the two operations leaves no inconsistent isRecurring=true parent without children
  - Existing stopRecurrence unit test is updated to assert atomicity
- **Verification**: `grep -n 'stopRecurrence\|\$transaction' apps/api/src/events/events.service.ts`
- **Related**: DAT-002, DAT-003, DAT-004, DAT-006, COR-029, COR-030, COR-031
- **Notes**: Pattern precedent is the same file's create() and update() methods which both use $transaction.

#### DAT-002 — DepartmentsService.remove() reads _count outside a transaction — TOCTOU window before DELETE

**🟠 important** · `apps/api/src/departments/departments.service.ts:250-278` · confidence: high · cluster D · toctou-delete-guard

The guard check (_count read) and the DELETE run as two separate DB round-trips with no enclosing transaction. Between the count read and the delete, a concurrent request can assign a new user to the department. If users are added between the check and the DELETE: the FK constraint (onDelete: Restrict on User.departmentId) will throw a P2003 PrismaClientKnownRequestError that is not mapped to an HttpException, resulting in a 500. If services are added between the check and the DELETE: those services are silently cascade-deleted (onDelete: Cascade on Service.departmentId), bypassing the intended guard.

```
    // Vérifier qu'il n'y a pas d'utilisateurs ou services liés
    if (department._count.users > 0 || department._count.services > 0) {
      throw new BadRequestException(
        "Impossible de supprimer un département qui contient des utilisateurs ou services. Veuillez d'abord les réaffecter.",
      );
    }

    await this.prisma.department.delete({
      where: { id },
    });
```

- **Root cause**: No transaction wrapping the read-check-write sequence. Compare with ClientsService.hardDelete() which correctly wraps this pattern in $transaction (with a comment referencing COR-008).
- **Impact**: Race condition allows: (a) unexpected 500 when a concurrent user assignment races the delete; (b) silent cascade-deletion of services that would have triggered the BadRequest guard had the check been done inside the transaction.
- **Suggested fix**: Wrap the check and delete in a single $transaction(async tx => { ... }) as done in ClientsService.hardDelete(). The FK-Restrict on users means the DB will enforce it regardless, but the count check should be inside the transaction to guarantee consistent behavior and map P2003 to a clean 409/400.
- **Acceptance criteria**:
  - Concurrent POST /services + DELETE /departments/:id does not produce a 500
  - Deleting a department with services returns 400, not silently cascading
  - The check and delete are within the same $transaction call
- **Verification**: `N/A — manual verification`
- **Related**: DAT-003, DAT-004, DAT-006, DAT-001, COR-029, COR-030, COR-031

#### DAT-003 — create() user row committed before service assignments — no $transaction

**🟠 important** · `apps/api/src/users/users.service.ts:163-239` · confidence: high · cluster D · atomicity

UsersService.create() calls prisma.user.create() then prisma.userService.createMany() in two independent statements. If createMany fails (FK violation on a concurrently-deleted service, transient DB error), the user row is already committed to the database with no service assignments. The error propagates as 500 to the caller but leaves a partially-initialised user in DB.

```
    const user = await this.prisma.user
      .create({
        data: { ... },
      })
      .catch((e) => { ... }); // committed here — no tx

    if (createUserDto.serviceIds && createUserDto.serviceIds.length > 0) {
      await this.prisma.userService.createMany({  // ← outside any transaction
        data: createUserDto.serviceIds.map((serviceId) => ({
          userId: user.id,
          serviceId,
        })),
      });
    }
```

- **Root cause**: The identical pattern in update() was wrapped in a $transaction as COR-040, but create() was never updated to match. The two methods drifted.
- **Impact**: On createMany failure the caller receives a 500, but the user exists in DB without service membership. A second create attempt will hit P2002 (unique constraint on email/login) and fail with 409, making the orphan user unrecoverable except via direct admin intervention.
- **Suggested fix**: Wrap prisma.user.create() + prisma.userService.createMany() in a prisma.$transaction() callback, identical to the pattern already used in update(). Move the audit emit after the transaction commits.
- **Acceptance criteria**:
  - user.create and userService.createMany execute inside the same $transaction
  - A simulated createMany failure leaves no committed user row in the database
  - The existing P2002 mapping still works (catch inside or after the transaction)
- **Verification**: `grep -n 'userService.createMany\|prisma.user.create\|\$transaction' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/users/users.service.ts | head -40`
- **Related**: DAT-002, DAT-004, DAT-006, DAT-001, COR-029, COR-030, COR-031
- **Notes**: The serviceIds FK is validated before the create (lines ~135-142), so the failure window is narrow but real: concurrent service deletion or a transient DB error.

#### DAT-004 — importUsers() loop: user row committed before service assignments — ghost users created on per-row errors

**🟠 important** · `apps/api/src/users/users.service.ts:1474-1534` · confidence: high · cluster D · atomicity

For each CSV row, prisma.user.create() commits the user unconditionally. The subsequent userService.createMany() and auditPersistence.log() calls both execute outside any transaction. Any failure in either is caught by the outer catch at line 1528, which increments result.errors and does NOT increment result.created. The committed user is invisible in the import report: not in createdUsers, not counted in created, and has no audit trail row — a 'ghost' user.

```
        const user = await this.prisma.user.create({
          data: { email, login, passwordHash, ... },
        }); // committed — no tx

        if (serviceIds.length > 0) {
          await this.prisma.userService.createMany({
            data: serviceIds.map((serviceId) => ({ userId: user.id, serviceId })),
          });
        }

        await this.auditPersistence.log({ ... }); // if this throws too ...

        result.created++;          // ← never reached if createMany fails
        result.createdUsers.push(user);
      } catch (err) {
        result.errors++;           // ← caller sees 'error', but user IS in DB
```

- **Root cause**: The per-row create+assign block was never wrapped in a $transaction. The audit comment at line 1510-1513 acknowledges the non-blocking audit risk but does not address the committed-user-but-classified-as-error problem.
- **Impact**: After a failed import row the DB contains a user that the calling admin believes was not created. Retrying the import will hit a P2002 conflict (email/login already exists), making the row permanently fail. The user account exists but is invisible to the admin, with no service assignments and no audit record.
- **Suggested fix**: Wrap prisma.user.create() + prisma.userService.createMany() in a $transaction per row. The audit.log() can remain outside (fire-and-forget acceptable for import), but move result.created++ and result.createdUsers.push(user) to after the transaction commit so they only execute when the core write is confirmed.
- **Acceptance criteria**:
  - If userService.createMany fails, the user.create is rolled back within the same row transaction
  - result.errors is incremented only when the transaction itself fails
  - result.created accurately reflects the number of users fully committed to the database
  - Retrying a failed row after a transient error does not produce a P2002 for the user that was rolled back
- **Verification**: `grep -n 'user.create\|userService.createMany\|result.created\|result.errors\|\$transaction' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/users/users.service.ts | grep -A3 -B3 '1474\|1501\|1526'`
- **Related**: DAT-002, DAT-003, DAT-006, DAT-001, COR-029, COR-030, COR-031
- **Notes**: The serviceIds are validated against existing services before the loop (via a findMany), so FK failures require concurrent service deletion. Transient DB timeouts are the more realistic trigger.

#### DAT-005 — importMilestones dedup is case-sensitive; validateImport dedup is case-insensitive — validate rejects what import silently creates

**🟠 important** · `apps/api/src/milestones/milestones.service.ts:226 (import), 311 (validate)` · confidence: high · validate/import dedup inconsistency

The validate endpoint (POST /milestones/project/:id/import/validate) lowercases all existing milestone names before building the dedup set, so a milestone named 'Alpha Release' in the DB causes validateImport to flag any incoming 'alpha release' as a duplicate. The actual import endpoint (POST /milestones/project/:id/import) uses a case-sensitive set, so 'alpha release' does NOT match 'Alpha Release' in the set and will be created — silently producing a case-variant duplicate milestone that validate incorrectly predicted would be skipped.

```
// importMilestones (line ~226):
const existingNames = new Set(existingMilestones.map((m) => m.name));

// validateImport (line ~311):
const existingNames = new Set(
  existingMilestones.map((m) => m.name.toLowerCase()),
);
```

- **Root cause**: Two separate Set construction expressions were written independently. The import path omits .toLowerCase(), while the validate path includes it. There is no shared helper for the dedup logic.
- **Impact**: The validate/import two-step flow is the prescribed safe import path. When a case-difference is involved, validate tells the user 'this row is a duplicate, it will be skipped' but import creates the row — breaking the dry-run contract and introducing duplicate milestone names that share a project.
- **Suggested fix**: Align both paths. The canonical choice is case-insensitive (validateImport is correct). Fix importMilestones: change const existingNames = new Set(existingMilestones.map((m) => m.name)) to const existingNames = new Set(existingMilestones.map((m) => m.name.toLowerCase())), and compare with incoming.name.toLowerCase(). Alternatively extract a shared helper used by both methods.
- **Acceptance criteria**:
  - validateImport and importMilestones use identical case-folding for dedup
  - A milestone named 'Alpha Release' in DB causes an incoming 'alpha release' to be skipped (not created) by importMilestones
  - Unit test: validate + import same payload differing only in case → both report duplicate, import creates 0 rows
- **Verification**: `grep -n 'existingNames\|toLowerCase' apps/api/src/milestones/milestones.service.ts`

#### DAT-006 — projects.remove() (soft-delete to CANCELLED) emits audit log outside any transaction — inconsistent with archive()/unarchive() DAT-006 pattern

**🟠 important** · `apps/api/src/projects/projects.service.ts:722-735` · confidence: high · cluster D · partial write outside transaction

remove() writes the status CANCELLED in one call and the audit log in a separate subsequent call, with no transaction wrapping them. If auditPersistence.log() throws, the project is CANCELLED without an audit record. archive() and unarchive() explicitly wrap both the update and audit inside a $transaction, citing DAT-006 atomicity guarantee. remove() was apparently updated after that pattern was established (OBS-010 comment) but was not brought in line with DAT-006.

```
    await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.CANCELLED },
    });

    // OBS-010 — the soft-delete (status→CANCELLED) is the dominant project
    // removal path and was unaudited; record it with the prior status.
    await this.auditPersistence.log({
      action: AuditAction.PROJECT_CANCELLED,
      entityType: 'Project',
      entityId: id,
      actorId: user?.id ?? null,
      payload: { projectId: id, previousStatus: project.status },
    });
```

- **Root cause**: The audit call was added retroactively to remove() without wrapping the existing update in a transaction first. archive()/unarchive() got the transaction treatment but remove() did not.
- **Impact**: A transient audit-log write failure leaves the project CANCELLED with no audit trail — violating the audit integrity contract. Also: if any code between the two awaits throws (e.g. an interceptor), the project row is mutated but the cancellation is unlogged.
- **Suggested fix**: Wrap the project.update and auditPersistence.log calls in a $transaction the same way archive() and unarchive() do: const result = await this.prisma.$transaction(async (tx) => { await tx.project.update({...}); await this.auditPersistence.log({...}, tx); return ...; });
- **Acceptance criteria**:
  - remove() wraps status update + audit log in a single $transaction
  - If audit log fails (mock to throw), project.status remains unchanged (not CANCELLED)
  - Unit/integration test: mock auditPersistence.log to throw, assert the project was not soft-deleted
- **Verification**: `grep -n '$transaction\|auditPersistence' apps/api/src/projects/projects.service.ts | head -30`
- **Related**: DAT-002, DAT-003, DAT-004, DAT-001, COR-029, COR-030, COR-031

#### DAT-014 — Task.startDate / Task.endDate ordering has no DB-level CHECK constraint

**🟠 important** · `packages/database/prisma/schema.prisma:327-329` · confidence: high · cluster L · missing CHECK constraint

Every other date-bounded entity in the schema has a DB-level `endDate >= startDate` CHECK constraint added via raw SQL migration: projects (`projects_dates_ck`), epics (`epics_dates_ck`), telework_recurring_rules (`telework_recurring_rules_dates_ck`), leave_validation_delegates (`leave_validation_delegates_dates_ck`), school_vacations (`school_vacations_dates_ck`), project_members (`project_members_dates_ck`). The `tasks` table has time-format CHECKs (`tasks_startTime_format_ck`, `tasks_endTime_format_ck`, `tasks_time_order_ck`) but NO corresponding `tasks_dates_ck CHECK (endDate >= startDate)`. A task with `endDate < startDate` can be persisted and will silently produce negative-duration tasks visible on planning views.

```
  estimatedHours         Decimal?   @db.Decimal(5, 2) // hours ; DAT-005
  progress               Int        @default(0) // 0-100%
  startDate              DateTime?
  endDate                DateTime?
  startTime              String? // Horaire de début optionnel (format HH:MM)
```

- **Root cause**: The migration that added the date ordering constraints (20260527120000_dat003_dat004_business_invariants) covers six models but does not include `tasks`. The subsequent phase4c migration (20260606213229) adds `project_members_dates_ck` but also does not add `tasks_dates_ck`.
- **Impact**: A malformed API call or a bulk import can insert a task where `endDate < startDate`. Planning views and analytics would render negative-duration tasks without any DB-level rejection. The gap is consistent across all confirmed migrations.
- **Suggested fix**: Add a raw-SQL migration: `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dates_ck" CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");` (NULL-tolerant, matching the pattern used on epics/leaves/school_vacations).
- **Acceptance criteria**:
  - A migration file exists containing `ADD CONSTRAINT "tasks_dates_ck" CHECK ("endDate" >= "startDate")` (NULL-tolerant variant).
  - `psql -c "INSERT INTO tasks(..., \"startDate\", \"endDate\", ...) VALUES (..., '2026-07-01', '2026-06-01', ...)"` returns a check_violation error.
  - Existing tasks with NULL dates are unaffected.
- **Verification**: `grep -rn 'tasks_dates_ck\|tasks.*endDate.*startDate' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/`
- **Related**: DAT-015, DAT-022, DAT-026, DAT-027

#### DAT-015 — Project.budgetHours and Task.estimatedHours lack non-negative DB-level CHECK constraints

**🟠 important** · `packages/database/prisma/schema.prisma:179-180` · confidence: high · cluster L · missing CHECK constraint

The schema provides `budgetHours Int?` on Project (line 179) and `estimatedHours Decimal? @db.Decimal(5,2)` on Task (line 325). No migration adds a `CHECK (budgetHours >= 0)` or `CHECK (estimatedHours >= 0)` constraint. The analogous `time_entries_hours_ck` constraint (`CHECK (hours >= 0 AND hours <= 24)`) and `leave_balances_totaldays_ck` (`CHECK (totalDays >= 0)`) show the pattern is known and applied elsewhere. A negative budget or estimated hours value would corrupt analytics and capacity planning.

```
  budgetHours     Int?
  icon            String?
  hiddenStatuses  TaskStatus[]  @default([])
```

- **Root cause**: The CHECK constraint sweep in migrations 20260527120000 and 20260528120000 covered leaves/time-entries/subtask position but omitted the planning estimation fields on Project and Task.
- **Impact**: Negative budget or estimated hours can be persisted via the API and would corrupt capacity planning, project progress analytics, and workload dashboards. The `Decimal(5,2)` type allows values down to -999.99.
- **Suggested fix**: Add a migration with: `ALTER TABLE "projects" ADD CONSTRAINT "projects_budgetHours_ck" CHECK ("budgetHours" IS NULL OR "budgetHours" >= 0); ALTER TABLE "tasks" ADD CONSTRAINT "tasks_estimatedHours_ck" CHECK ("estimatedHours" IS NULL OR "estimatedHours" >= 0);`
- **Acceptance criteria**:
  - A migration adds non-negative CHECKs for both `projects.budgetHours` and `tasks.estimatedHours`.
  - Attempting to insert a project with `budgetHours = -1` raises a check_violation.
  - Attempting to insert a task with `estimatedHours = -0.25` raises a check_violation.
- **Verification**: `grep -rn 'budgetHours\|estimatedHours' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/ | grep -iE 'CHECK|constraint'`
- **Related**: DAT-014, DAT-022, DAT-026, DAT-027

#### DAT-016 — setup-cron-backup.sh hard-codes stale local dev path; production backup uses systemd but cron script is diverged

**🟠 important** · `scripts/setup-cron-backup.sh:12-13` · confidence: high · backup_strategy

The cron setup script hard-codes a developer's local home directory (`/home/alex/Documents/Repository/orchestr-a-refonte`). Per the project MEMORY, the production box has no cron daemon and uses a systemd timer (`backup-daily.timer`) instead. This script would fail silently on prod if ever invoked and would register the wrong script path even on a dev box because the repo is at `/home/alex/Documents/REPO/ORCHESTRA`.

```
# Configuration
PROJECT_DIR="/home/alex/Documents/Repository/orchestr-a-refonte"
BACKUP_SCRIPT="${PROJECT_DIR}/scripts/backup-database.sh"
```

- **Root cause**: The script was written for an earlier project layout and never updated to reflect the VPS production topology or the repo rename.
- **Impact**: An operator following this script would install a cron entry pointing at a non-existent path, giving false confidence that automated backups are configured while none actually run.
- **Suggested fix**: Either retire this script (production uses systemd) or update it to use the correct `PROJECT_DIR` and document that it is dev-only.
- **Acceptance criteria**:
  - Script uses the current repo path or is explicitly marked dev-only.
  - Path is not hard-coded to a developer's home directory.
- **Verification**: `grep 'PROJECT_DIR' scripts/setup-cron-backup.sh`

#### DAT-019 — DAT-021 migration breaks existing audit_log row hash chain until a manual recompute script is run

**🟠 important** · `packages/database/prisma/migrations/20260526120000_dat021_audit_payload_schema_version_gin_index/migration.sql:27-34` · confidence: medium · hash_chain_integrity

The migration adds `schemaVersion INTEGER NOT NULL DEFAULT 1` to `audit_logs` and backfills it atomically. However, `computeRowHash` now includes `schemaVersion` in its hash input, which changes the expected hash for every pre-existing row. The migration itself does NOT recompute hashes — it explicitly defers this to `scripts/recompute-chain-on-schema-bump.ts`. Between `prisma migrate deploy` and the manual script execution, any hash-chain verification run against pre-DAT-021 rows will fail.

```
--   computeRowHash now folds schemaVersion into the canonical concat. Backfilling
--   schemaVersion=1 therefore changes every existing row's hash input → every
--   rowHash must be recomputed. That walk runs AFTER this migration via
--   scripts/recompute-chain-on-schema-bump.ts (advisory-lock + trigger-disable
--   inside one transaction, SYSTEM_BACKFILL-bracketed). See the runbook in the
--   DAT-021 closing commit body. Until the recompute runs, freshly inserted rows
--   are self-consistent (they hash with schemaVersion); pre-existing rows verify
--   only after the recompute.
```

- **Root cause**: The recompute step was deliberately decoupled from the migration (the migration comment references the runbook in the DAT-021 closing commit). While this is a conscious design decision, the decoupling creates an operational window where the audit chain is unverifiable. There is no migration-time guard (e.g., a DO block that errors if the recompute is not complete) to enforce sequencing.
- **Impact**: During the window between migration deployment and recompute script execution, any tamper-detection audit that walks the hash chain for pre-DAT-021 rows will produce false positives (every row appears tampered). For a French local government HR system, this could trigger unnecessary incident response. It is also undetectable from the migration log alone whether the recompute was actually run in production.
- **Suggested fix**: Add a post-migration verification step in the deployment runbook: `SELECT COUNT(*) FROM audit_logs WHERE rowHash != computeRowHash(...)` — if non-zero, block the deployment signoff. Alternatively, add a boolean `hashRecomputedAt` column or an entries in a `schema_maintenance` table that the recompute script populates on completion, making the status auditable.
- **Acceptance criteria**:
  - The recompute script `apps/api/src/scripts/recompute-chain-on-schema-bump.ts` has been executed against prod (verifiable via the advisory-lock log or a sentinel DB record).
  - Hash-chain verification query returns 0 mismatches for rows with `schemaVersion = 1`.
  - Deployment runbook or CI post-migrate step documents when the recompute must run relative to `prisma migrate deploy`.
- **Verification**: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM audit_logs WHERE \"schemaVersion\" = 1 AND \"rowHash\" IS NOT NULL" # non-zero means rows exist; run scripts/recompute-chain-on-schema-bump.ts if it was not confirmed executed`
- **Notes**: The script exists at apps/api/src/scripts/recompute-chain-on-schema-bump.ts (confirmed in git at 33f7a9ce). The concern is strictly operational: whether the script was actually run in prod. The git log does not confirm execution. The MEMORY.md prod deploy log does not mention it. Medium confidence because there may be a runbook entry or post-deploy hook not visible in the repo.

#### DAT-020 — backup-database.sh: no encryption, no offsite transfer, no integrity verification

**🟠 important** · `scripts/backup-database.sh:1-55` · confidence: high · backup_strategy

The backup script writes plain-text SQL dumps compressed with gzip only (no encryption). Backups are stored at a relative path (`./backups`) on the same host. There is no offsite transfer (S3, rsync, scp), no WORM destination, and no minimum-size or integrity check (e.g. `gunzip -t`) after compression. A dump that fails mid-stream still produces a partial file that passes the existence check on line 31 (`if [ -f ... ]`).

```
docker exec "${CONTAINER_NAME}" pg_dump -U "${DATABASE_USER}" "${DATABASE_NAME}" > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compresser la sauvegarde
gzip "${BACKUP_DIR}/${BACKUP_FILE}"
```

- **Root cause**: The script was written as a simple operational shortcut and was never hardened for production data-protection requirements. The `set -e` flag catches docker exec failures but not a partial dump that exits 0.
- **Impact**: A successful attacker or accidental host-disk failure destroys both the live DB and the only backup copy simultaneously. A corrupt partial dump is not detected until a restore is attempted. Personal data (audit trail, leave history) is unprotected at rest in the backup file.
- **Suggested fix**: 1. Pipe through `openssl enc` or `age` before writing to disk. 2. After compression, run `gunzip -t` to verify gzip integrity before declaring success. 3. Add `set -o pipefail` so a mid-stream pg_dump failure propagates. 4. Add a minimum-size check (`[ $(stat -c%s ...) -gt $MIN_BYTES ]`). 5. rsync/s3 the encrypted archive to an offsite location. 6. Periodically test restores.
- **Acceptance criteria**:
  - Backups are encrypted at rest (key not stored alongside the backup).
  - Script uses `set -o pipefail` so a failing pg_dump aborts the script.
  - Integrity of each archive is verified with `gunzip -t` before the script exits 0.
  - At least one offsite copy is made after each successful backup.
  - A minimum-size threshold rejects suspiciously small dumps.
- **Verification**: `grep -n 'pipefail\|openssl\|age\|gunzip -t\|rsync\|s3\|stat.*MIN' scripts/backup-database.sh`

#### DAT-021 — RBAC V4 legacy DROP migration lacks inline data backup; only a comment instructs operator to take a backup beforehand

**🟠 important** · `packages/database/prisma/migrations/20260420120000_rbac_v4_drop_legacy/migration.sql:1-18` · confidence: high · migration_safety

This migration irreversibly drops three tables (`role_permissions`, `permissions`, `role_configs`) and a column (`users.role`) plus an enum type. The only safety net is a comment advising the operator to take a backup. There is no inline `CREATE TABLE ... AS SELECT` snapshot (as the DAT-005 pattern demonstrates), no rollback script, and no preflight check script. If the migration applies on a database where `prisma migrate deploy` was not preceded by a backup, the data is permanently lost.

```
-- RBAC V4 — Drop legacy enum + tables + colonne users.role
-- Voir backlog/rbac-refactor/contract/contract-03-type-model.md §9
-- ACTION IRRÉVERSIBLE — Assurer un backup avant déploiement prod.

-- 1. Drop FK contrainte role_permissions
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permissionId_fkey";
...
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "role_configs";
```

- **Root cause**: The DAT-005 backup-before-drop pattern (snapshot table + preflight script + rollback SQL) was developed after this migration was written. This older migration pre-dates that practice.
- **Impact**: If applied on production without a prior backup, all RBAC permission configuration data is permanently lost with no recovery path. Prisma `migrate deploy` is atomic per-migration but cannot roll back a DROP TABLE after commit.
- **Suggested fix**: This migration has already been applied to production, so backfilling a rollback script is moot. Document this in the migration or in a CHANGELOG entry. For future DROP migrations, require the DAT-005 preflight+snapshot+rollback pattern.
- **Acceptance criteria**:
  - A post-mortem note or code comment confirms whether prod data was preserved.
  - A project-level convention document requires preflight+snapshot for all future DROP migrations.
- **Verification**: `N/A — migration already applied; this is a historical finding`

#### DAT-007 — UpsertLeaveBalanceDto.totalDays has no @Max() upper bound

**🟡 nit** · `apps/api/src/leaves/dto/upsert-leave-balance.dto.ts:34-36` · confidence: high · cluster B · input_validation

`totalDays` is validated as a non-negative number but has no upper bound. An admin can set a leave balance to an arbitrarily large value (e.g., 999999 days) without any DTO-level rejection. While this endpoint requires `leaves:manage` (admin/responsable only), there is no semantic cap to prevent accidental or malicious data corruption.

```
  @IsNumber()
  @Min(0)
  totalDays: number;
```

- **Root cause**: `@Max()` is imported in the file (line 2: `import { IsInt, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator'`) but only applied to the `year` field (line 27: `@Max(2100)`). It was not applied to `totalDays`.
- **Impact**: An admin or RESPONSABLE with `leaves:manage` permission can set `totalDays` to extreme values, potentially corrupting leave balance reports and balance-consumption calculations.
- **Suggested fix**: Add `@Max(365)` (or an appropriate business ceiling such as 500 for accumulation edge cases) to `totalDays`.
- **Acceptance criteria**:
  - PATCH /leave-types/:id/balance with totalDays=99999 returns HTTP 400
  - PATCH /leave-types/:id/balance with totalDays=50 continues to succeed
- **Verification**: `grep -n '@Max\|@Min\|totalDays' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leaves/dto/upsert-leave-balance.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### DAT-008 — create-task.dto.ts: description field missing @MaxLength

**🟡 nit** · `apps/api/src/tasks/dto/create-task.dto.ts:72-74` · confidence: high · cluster B · dto-validation

The `description` field has no `@MaxLength` decorator. Every other bounded text field in the project DTOs (task title, project name, comment body, etc.) has an explicit MaxLength. The global `ValidationPipe` with `whitelist: true` strips undeclared props, but does not enforce length on declared string fields without an explicit decorator.

```
  @IsString()
  @IsOptional()
  description?: string;
```

- **Root cause**: Missing decorator — oversight in DTO definition.
- **Impact**: A caller can submit an arbitrarily long description string which is stored verbatim in PostgreSQL. While no hard DB column limit applies (Prisma maps to TEXT), extremely large payloads can inflate row size, slow full-text searches, and waste storage.
- **Suggested fix**: Add `@MaxLength(5000)` (or a project-consistent limit such as 2000, matching `create-project.dto.ts`) to the `description` field.
- **Acceptance criteria**:
  - POST /tasks with description.length > 5000 is rejected with 400
- **Verification**: `grep -n 'description' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/tasks/dto/create-task.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-009, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### DAT-009 — create-subtask.dto.ts: description field missing @MaxLength

**🟡 nit** · `apps/api/src/tasks/dto/create-subtask.dto.ts:24-27` · confidence: high · cluster B · dto-validation

Same issue as create-task.dto.ts: the `description` field has no `@MaxLength` bound.

```
  @ApiProperty({ description: 'Description de la sous-tâche', required: false })
  @IsString()
  @IsOptional()
  description?: string;
```

- **Root cause**: Missing decorator.
- **Impact**: Unbounded description strings can be stored in subtask records.
- **Suggested fix**: Add `@MaxLength(2000)` to match the project-wide convention.
- **Acceptance criteria**:
  - POST /tasks/:id/subtasks with description.length > 2000 is rejected with 400
- **Verification**: `grep -n 'description' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/tasks/dto/create-subtask.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-010, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### DAT-010 — import-tasks.dto.ts: title, description, milestoneName, subtasks fields missing @MaxLength

**🟡 nit** · `apps/api/src/tasks/dto/import-tasks.dto.ts:23-79` · confidence: high · cluster B · dto-validation

Four string fields in `ImportTaskDto` lack `@MaxLength`: `title` (line 25), `description` (line 30), `milestoneName` (line 54), `subtasks` (line 79). The `subtasks` field is split on `|` and each token is used as the `title` of a new subtask row in a DB transaction — without any per-token length enforcement in the service. Note: `assigneeEmail` at line 47 correctly has `@MaxLength(254)`.

```
  @IsString()
  @IsNotEmpty()
  title: string;

  ...

  @IsString()
  @IsOptional()
  description?: string;

  ...

  @IsString()
  @IsOptional()
  milestoneName?: string;

  ...

  @IsString()
  @IsOptional()
  subtasks?: string;
```

- **Root cause**: MaxLength decorators were added selectively. The pipe-delimited `subtasks` field is particularly risky because the service creates subtask DB rows directly from the resulting tokens.
- **Impact**: An attacker importing 500 tasks (the ArrayMaxSize cap) each with a maximally long `subtasks` string containing many `|`-separated tokens can generate a very large number of unbounded subtask title strings, potentially reaching the DB with multi-KB content per row.
- **Suggested fix**: Add `@MaxLength(255)` to `title`, `@MaxLength(2000)` to `description`, `@MaxLength(255)` to `milestoneName`, and `@MaxLength(5000)` to `subtasks`. In the service's import loop, add a per-token length guard when splitting `subtasks` on `|`.
- **Acceptance criteria**:
  - POST /tasks/project/:projectId/import with a title > 255 chars is rejected with 400
  - POST with subtasks string > 5000 chars is rejected with 400
- **Verification**: `grep -n 'MaxLength\|@IsString' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/tasks/dto/import-tasks.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-011, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### DAT-011 — create-project.dto.ts: clientIds uses @IsString not @IsUUID, and lacks @ArrayMaxSize

**🟡 nit** · `apps/api/src/projects/dto/create-project.dto.ts:113-117` · confidence: high · cluster B · dto-validation

The `clientIds` array is validated with `@IsString({ each: true })` rather than `@IsUUID('4', { each: true })`. Non-UUID strings pass DTO validation and then reach the service's `isUUID()` check (a secondary gate), but the DTO-level signal is weaker. Additionally, no `@ArrayMaxSize` is present — an attacker can submit thousands of client IDs in a single request, forcing a large `client.count` query in the service.

```
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  clientIds?: string[];
```

- **Root cause**: Incomplete validator selection for UUID-typed foreign-key arrays.
- **Impact**: Without an ArrayMaxSize cap, excessively large clientIds arrays can cause slow DB queries. The @IsString vs @IsUUID inconsistency reduces early-rejection fidelity and produces less informative 400 error messages.
- **Suggested fix**: Replace `@IsString({ each: true })` with `@IsUUID('4', { each: true })` and add `@ArrayMaxSize(50)` (or a project-appropriate cap).
- **Acceptance criteria**:
  - POST /projects with clientIds containing a non-UUID string returns 400 with a UUID validation error
  - POST /projects with clientIds.length > 50 is rejected with 400
- **Verification**: `grep -n 'clientIds' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/projects/dto/create-project.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-012, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### DAT-012 — create-project.dto.ts: icon field missing @MaxLength

**🟡 nit** · `apps/api/src/projects/dto/create-project.dto.ts:85-88` · confidence: high · cluster B · dto-validation

The `icon` field has `@IsString` and `@IsOptional` but no `@MaxLength`. It is stored directly in the project row. An unbounded icon string could store multi-KB content.

```
  @ApiProperty({ description: "Icône du projet", required: false })
  @IsString()
  @IsOptional()
  icon?: string;
```

- **Root cause**: Missing MaxLength decorator.
- **Impact**: Low: stored in a single column, but bloats project rows and wastes storage if abused.
- **Suggested fix**: Add `@MaxLength(100)` (icon values are expected to be short identifiers like emoji or icon names).
- **Acceptance criteria**:
  - POST /projects with icon.length > 100 is rejected with 400
- **Verification**: `grep -n 'icon' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/projects/dto/create-project.dto.ts`
- **Related**: SEC-002, SEC-014, SEC-015, SEC-016, COR-011, DAT-007, COR-012, DAT-008, DAT-009, DAT-010, DAT-011, COR-014, COR-003, COR-015, COR-016, COR-017, COR-018, SEC-021

#### DAT-017 — Role.isDefault has no partial unique index to enforce a single default role

**🟡 nit** · `packages/database/prisma/schema.prisma:1221-1230` · confidence: medium · missing partial unique index

The schema has a B-tree index `@@index([isDefault])` (line 1229) to speed up lookup of the default role. However there is no partial unique index `CREATE UNIQUE INDEX roles_one_default_idx ON roles (isDefault) WHERE isDefault = true`, which means the database permits multiple rows with `isDefault = true`. The application's RBAC bootstrapping logic likely assumes at most one default role; two concurrent role admin operations could silently create an ambiguous state.

```
  /// Rôle par défaut pour un nouvel utilisateur.
  isDefault Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[] @relation(name: "UserRoleEntity")

  @@index([templateKey])
  @@index([isDefault])
  @@map("roles")
```

- **Root cause**: Prisma PSL cannot express partial unique indexes (`@@unique` with a `WHERE` clause). The convention in this codebase is to add these as raw SQL in migrations (see `leave_balances_global_unique` referenced in a comment on LeaveBalance). No such migration was added for `roles.isDefault`.
- **Impact**: Low probability but non-zero: if two admins simultaneously set different roles as default, both can succeed, leaving a permanently ambiguous 'default role' that is resolved non-deterministically at user creation time. The schema comment says 'Rôle par défaut pour un nouvel utilisateur' — exactly the invariant that breaks.
- **Suggested fix**: Add a raw SQL migration: `CREATE UNIQUE INDEX "roles_one_default_idx" ON "roles" ("isDefault") WHERE "isDefault" = true;` (PostgreSQL partial unique index — only one row with `isDefault = true` is permitted).
- **Acceptance criteria**:
  - A migration adds `CREATE UNIQUE INDEX "roles_one_default_idx" ON "roles" ("isDefault") WHERE "isDefault" = true;`.
  - Attempting to set a second role as `isDefault = true` raises a unique_violation.
  - Roles with `isDefault = false` (the majority) are unaffected.
- **Verification**: `grep -rn 'roles_one_default\|isDefault.*WHERE\|WHERE.*isDefault' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/migrations/`
- **Notes**: Medium confidence because the service layer may enforce single-default via a guard (not checked in this read-only scan); the finding is valid as a DB-level safety net regardless.

#### DAT-018 — users.roleId FK uses ON DELETE SET NULL — silent RBAC nullification when a role is deleted

**🟡 nit** · `packages/database/prisma/migrations/20260419192835_rbac_v0_add_roles_table/migration.sql:34` · confidence: medium · referential_integrity

When a `roles` row is deleted, every user assigned that role has their `roleId` silently set to NULL. Because RBAC V4 resolves permissions compile-time from `ROLE_TEMPLATES[roleCode]`, a NULL roleId returns no permissions for the affected users. This is a silent privilege wipe with no error raised. The schema trend (DAT-007, DAT-022, DAT-028) consistently flipped CASCADE/SET-NULL to RESTRICT on history-sensitive tables — this FK was never revisited.

```
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- **Root cause**: The FK action was set to `ON DELETE SET NULL` at RBAC V0 introduction and was not tightened when V4 made roleId the sole permission source. No later migration converts it to RESTRICT or NO ACTION. `schema.prisma` confirms `roleId String?` remains nullable.
- **Impact**: Deleting any non-system role (possible for ADMIN) silently nullifies permissions for all users assigned to it. Affected users can still authenticate but receive zero permissions. No DB error is raised, so the event may go undetected until a user reports access loss.
- **Suggested fix**: Change the FK to `ON DELETE RESTRICT`. Deleting a role while users are assigned to it should be a hard error at the DB layer, forcing an explicit reassignment step. If soft-delete of roles is desired, add a `deletedAt` column to `roles` and use a partial index on `roleId WHERE deletedAt IS NULL`.
- **Acceptance criteria**:
  - A new migration drops the `users_roleId_fkey` constraint and recreates it with `ON DELETE RESTRICT`.
  - The application's role-deletion endpoint either reassigns users first or raises a 409 when assignees exist.
  - An integration test verifies that DELETE /roles/:id with active assignees returns 409, not 200.
- **Verification**: `psql $DATABASE_URL -c "SELECT rc.constraint_name, rc.delete_rule FROM information_schema.referential_constraints rc JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name WHERE kcu.table_name = 'users' AND kcu.column_name = 'roleId';"`
- **Notes**: Schema.prisma confirms roleId remains String? (nullable). This is distinct from the 'roleId never made NOT NULL' observation — that is an intentional transition state per the migration comment. The ON DELETE SET NULL behavior is the actual integrity gap. [severity normalized from 'low']

#### DAT-022 — project_snapshots missing cross-column CHECK: tasksDone <= tasksTotal

**🟡 nit** · `packages/database/prisma/migrations/20260605192741_dat008_015_check_constraints/migration.sql:13-15` · confidence: high · cluster L · missing_check_constraint

The constraint added by DAT-008/015 only enforces that both counts are non-negative. It does not prevent the business-impossible state where `tasksDone > tasksTotal` (more tasks done than total tasks). This invariant is enforced by application logic but not at the DB layer.

```
ALTER TABLE "project_snapshots"
  ADD CONSTRAINT "project_snapshots_task_counts_ck"
  CHECK ("tasksDone" >= 0 AND "tasksTotal" >= 0);
```

- **Root cause**: The initial CHECK was scoped to the simplest non-negative guard. No subsequent migration adds the cross-column comparison. Checklist item 3 (missing CHECKs that COULD exist but do not) surfaces this gap.
- **Impact**: A faulty snapshot computation, direct DB write, or future service bug could produce rows where `tasksDone > tasksTotal`. Downstream analytics (dashboard KPIs, milestone progress bars) would display progress > 100%. Low risk because snapshots are system-generated, but the DB provides no floor.
- **Suggested fix**: Add a single-migration CHECK: `ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_task_counts_cross_ck" CHECK ("tasksDone" <= "tasksTotal");`
- **Acceptance criteria**:
  - A migration adds `CHECK ("tasksDone" <= "tasksTotal")` to `project_snapshots`.
  - A unit test or integration test verifies that inserting a snapshot with tasksDone > tasksTotal raises a DB error.
- **Verification**: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM project_snapshots WHERE \"tasksDone\" > \"tasksTotal\";"`
- **Related**: DAT-014, DAT-015, DAT-026, DAT-027
- **Notes**: project_snapshots is an analytics/read table generated by a scheduled job, not by direct user input, so exploitation risk is very low. The finding is real but the practical impact is limited.

#### DAT-023 — recompute-chain-on-schema-bump.ts: STARTED SYSTEM_BACKFILL row is emitted before the recompute transaction, then re-hashed inside it — the emitted row's hash is stale after recompute

**🟡 nit** · `apps/api/src/scripts/recompute-chain-on-schema-bump.ts:188-207` · confidence: low · audit_chain

The STARTED row is inserted with a valid chain hash (prevHash = prior tail, rowHash = sha256 of that row). The recompute then walks from genesis and rehashes every row including the STARTED row. The COMPLETED row is inserted after the recompute with the correct new prevHash. This is functionally correct (the code comment says so) but means the STARTED row's `rowHash` as originally computed by `emitSystemBackfill` is discarded and overwritten. An external verifier inspecting the row immediately after the STARTED insert (but before the recompute commits) would see a hash that is valid at that instant but will be overwritten. Not a bug, but creates a window where the trail is temporarily inconsistent.

```
    // STARTED: emitted BEFORE the main transaction (a separate hash-chained insert
    // appended at the tail, with schemaVersion=1 — already chain-correct). It then
    // sits at the tail of the segment the recompute walks and is itself re-hashed.
    await emitSystemBackfill(auditPersistence, 'STARTED', {
      script: SCRIPT_NAME,
      args,
      dryRun,
    });

    const result = await recomputeChainOnSchemaBump({
```

- **Root cause**: The design choice to emit STARTED before the recompute transaction is intentional (it brackets the operation in the trail) but the STARTED row is inevitably rehashed by the walk.
- **Impact**: Minimal: only relevant during the narrow window of the recompute transaction. A monitoring tool that reads audit_logs during the recompute could see a row whose hash was recomputed (changed). No data is permanently wrong.
- **Suggested fix**: Consider emitting STARTED inside the recompute transaction (after the trigger disable but before the walk) to make the STARTED row's position in the chain deterministic. Alternatively, document this ordering clearly in a code comment (it is already partially documented).
- **Acceptance criteria**:
  - Code comment clearly explains that STARTED is re-hashed by the recompute and why this is acceptable.
- **Verification**: `N/A — manual verification`

#### DAT-025 — Leave.leaveTypeId FK has no onDelete in Prisma schema (defaults to NoAction/error in Prisma 5+), but SQL migration shows RESTRICT — inconsistency risks blocking leave-type archival

**🟡 nit** · `packages/database/prisma/schema.prisma:645` · confidence: high · schema_constraints

The `Leave.leaveType` relation carries no explicit `onDelete` in the Prisma PSL. In Prisma 6 with a required (non-nullable) FK, the default is `Restrict`. The migration SQL confirms RESTRICT (`ON DELETE RESTRICT`). `LeaveBalance.leaveType` correctly documents `onDelete: Restrict` explicitly. The asymmetry between the two relations is a documentation/clarity gap. More importantly, RESTRICT means an admin cannot archive (delete) a `LeaveTypeConfig` that has any leave row referencing it, even historical ones — this could silently block administrative operations without a clear application-layer message.

```
  leaveType   LeaveTypeConfig @relation(fields: [leaveTypeId], references: [id])
```

- **Root cause**: The FK onDelete was not specified when the Prisma model was written; the implicit Prisma default matches what the SQL migration installs, but the omission is a maintenance risk when reading the schema.
- **Impact**: Attempting to delete a `LeaveTypeConfig` that is referenced by any `Leave` row will raise a Prisma P2003 error without a typed application-layer guard, surfacing a raw database error to the operator.
- **Suggested fix**: Add explicit `onDelete: Restrict` to the `Leave.leaveType` relation so intent is documented. Add an application-layer ConflictException guard in `LeaveTypeService.delete()` that lists referencing leave rows before attempting the DB delete.
- **Acceptance criteria**:
  - Leave.leaveType has explicit `onDelete: Restrict` in schema.prisma.
  - LeaveTypeService delete operation gives a typed error (not raw P2003) when leaves exist.
- **Verification**: `grep -A2 'leaveType.*LeaveTypeConfig' packages/database/prisma/schema.prisma`
- **Notes**: [severity normalized from 'minor']

#### DAT-013 — third-parties hardDelete(): getDeletionImpact count captured before delete — audit snapshot may be stale

**🔵 suggestion** · `apps/api/src/third-parties/third-parties.service.ts:253-264` · confidence: low · audit impact counts captured before cascade

getDeletionImpact() counts related time entries, task assignments, and project memberships. Between that read and the thirdParty.delete, concurrent writes can add new related rows. The FK cascade on delete then destroys more rows than were counted. The audit record logs a stale (under-counted) impact. OBS-014 comments acknowledge this is intentional ("BEFORE the delete"), but the approach is fundamentally racy.

```
    // OBS-014 — capture the cascade impact BEFORE the delete so the immutable
    // audit row records how many time entries / task assignments / project
    // memberships the FK cascade destroyed.
    const impact = await this.getDeletionImpact(id);
    // Cascade FK handles time_entries, task_third_party_assignees, project_third_party_members
    await this.prisma.thirdParty.delete({ where: { id } });
    // OBS-014 — durable deletion audit (snapshot + cascade counts); actor = the
    // deleting user. Awaited after the delete (no surrounding tx).
    await this.auditPersistence.log({
      action: AuditAction.THIRD_PARTY_DELETED,
      entityType: 'ThirdParty',
      entityId: id,
      actorId: actorId ?? null,
      payload: { snapshot: tp, impact },
    });
```

- **Root cause**: The design choice to read impact before delete is documented (OBS-014). The correct approach for an accurate count is to read impact inside the same transaction as the delete, but AuditPersistenceService.log() must not run inside a SERIALIZABLE tx (risk of deadlock on the hash chain). This creates a genuine tension: inside-tx for accuracy vs outside-tx for audit safety.
- **Impact**: The audit trail for third-party deletions may under-count cascade-destroyed related records if concurrent writes occur in the narrow window. For the hash-chained audit trail used for compliance/RGPD, this means the permanence guarantee is met but the content accuracy is not guaranteed for high-concurrency deployments.
- **Suggested fix**: Read the impact counts inside the delete transaction (using a tx-scoped prisma client) and return them, then pass to audit.log() after commit. This requires the getDeletionImpact() method to accept an optional tx argument:
```ts
await this.prisma.$transaction(async (tx) => {
  const impact = await this.getDeletionImpact(id, tx);
  await tx.thirdParty.delete({ where: { id } });
  // Store impact in closure for post-tx audit log
  capturedImpact = impact;
});
await this.auditPersistence.log({ ..., payload: { snapshot: tp, impact: capturedImpact } });
```
- **Acceptance criteria**:
  - getDeletionImpact is called with a tx-scoped client inside the same transaction as the delete
  - auditPersistence.log is called after the transaction commits with the tx-captured counts
- **Verification**: `grep -n 'getDeletionImpact\|hardDelete\|\$transaction' apps/api/src/third-parties/third-parties.service.ts`
- **Notes**: The OBS-014 comment documents this as intentional pre-delete capture. This finding is flagged as medium confidence since the design trade-off is acknowledged. Impact is audit accuracy not data safety. [severity normalized from 'trivial']

#### DAT-024 — leave_no_overlap EXCLUDE covers only APPROVED status — CANCELLATION_REQUESTED overlap is app-only

**🔵 suggestion** · `packages/database/prisma/migrations/20260527190000_dat023_leave_no_overlap_exclude/migration.sql:54-61` · confidence: low · partial_db_floor

The EXCLUDE constraint intentionally scopes to `status = 'APPROVED'` only. The migration comment (lines 20-24) explains this is deliberate: only the transition `PENDING → APPROVED` is the auditable race path the DB must guard. CANCELLATION_REQUESTED overlap is handled at the app layer by `checkOverlap()` in `leaves.service.ts` which includes CANCELLATION_REQUESTED in its status filter. This means the DB floor is narrower than the app's own overlap semantics: a direct SQL INSERT with status CANCELLATION_REQUESTED that overlaps an existing CANCELLATION_REQUESTED leave would not be rejected by the DB.

```
ALTER TABLE "leaves"
  ADD CONSTRAINT "leaves_no_overlap"
  EXCLUDE USING gist (
    "userId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE (status = 'APPROVED');
```

- **Root cause**: Intentional design trade-off documented in the migration comment. The migration author chose not to include CANCELLATION_REQUESTED in the partial WHERE because it is a transitional state that does not represent a committed leave.
- **Impact**: Very low in practice — CANCELLATION_REQUESTED leaves cannot be created by direct SQL in normal operation, and the app layer check is in place. The gap matters only if a bulk-import or admin tool bypasses the service layer.
- **Suggested fix**: No immediate action required. If a bulk import tool is ever added, ensure it calls the service layer's checkOverlap() or extends the DB EXCLUDE to cover CANCELLATION_REQUESTED status as well.
- **Acceptance criteria**:
  - Document the intentional APPROVED-only scope in the ADR or migration comment (already done in the migration; no action needed).
  - Any future bulk-import tool must invoke service-layer overlap checks.
- **Verification**: `psql $DATABASE_URL -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'leaves' AND indexname = 'leaves_no_overlap';"`
- **Notes**: The migration comment explicitly addresses this design choice. Flagged per checklist item 2 (ON DELETE / ON UPDATE cascade semantics and DB floor completeness) but the intentional design is well-documented. Lowest severity — included for completeness only.

#### DAT-026 — LeaveBalance.year has no CHECK constraint to reject obviously invalid years

**🔵 suggestion** · `packages/database/prisma/schema.prisma:714` · confidence: medium · cluster L · schema_constraints

The `LeaveBalance.year` column stores a calendar year (e.g. 2024). No DB-level CHECK constraint prevents a year of 0, -1, or 9999. A data entry error or a service-layer bug could store an invalid year that would be invisible until a query groups by year and surfaces an anomalous bucket.

```
  year        Int // Année d'application
```

- **Root cause**: Year columns are typically low-risk, and the DAT-004 family focused on numeric magnitude columns. Year range was not included.
- **Impact**: Low: mostly a data quality concern. An invalid year on a leave balance row could cause incorrect balance calculations or confusing display.
- **Suggested fix**: Add: `ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_year_ck" CHECK ("year" >= 2000 AND "year" <= 2100);`
- **Acceptance criteria**:
  - A DB-level CHECK constraint rejects leave_balances rows with year outside a reasonable range.
- **Verification**: `docker exec orchestr-a-db psql -U postgres -d orchestr_a_v2_e2e -c "SELECT conname FROM pg_constraint WHERE conrelid = 'leave_balances'::regclass AND contype = 'c';"`
- **Related**: DAT-014, DAT-015, DAT-022, DAT-027

#### DAT-027 — Leave.days Decimal(6,2) allows values up to 9999.99 — a single leave row spanning 9999 days is logically impossible but not constrained

**🔵 suggestion** · `packages/database/prisma/schema.prisma:629` · confidence: low · cluster L · schema_constraints

The `days` column on `Leave` has a `CHECK (days > 0)` constraint (from DAT-004) but no upper bound. A single leave row of 9999.99 days (~27 years) is technically possible via a direct DB write. The service-layer calculation floors at 0.5 days and computes working days from date range, so the app will never create such a row, but there is no DB-level ceiling.

```
  days        Decimal     @db.Decimal(6, 2) // Jours ouvrés calculés ; DAT-005 (max 9999.99)
```

- **Root cause**: The DAT-004 migration added only a lower bound (`> 0`) for Leave.days and did not add an upper bound.
- **Impact**: Very low in practice. A corrupt leave row with an enormous `days` value could skew leave-balance analytics but would only occur via a direct DB write or a severe service-layer bug.
- **Suggested fix**: Add an upper bound: `ALTER TABLE "leaves" ADD CONSTRAINT "leaves_days_upper_ck" CHECK ("days" <= 365);` (one year of working days is around 260; 365 is a generous ceiling).
- **Acceptance criteria**:
  - An upper bound CHECK on leaves.days is present in the DB schema.
- **Verification**: `docker exec orchestr-a-db psql -U postgres -d orchestr_a_v2_e2e -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'leaves'::regclass AND contype = 'c';"`
- **Related**: DAT-014, DAT-015, DAT-022, DAT-026

### Performance (25)

#### PER-001 — POST /telework/recurring-rules/generate has no date-range cap — unbounded in-memory expansion

**🟠 important** · `apps/api/src/telework/telework.service.ts:1010-1060` · confidence: high · cluster E · resource_exhaustion

The `generateSchedulesFromRules` endpoint accepts arbitrary `startDate`/`endDate` from the DTO and iterates every day between them in memory, building an `expected` Map. There is no cap on the date range span. The `findAll` path (lines 208-213 of the same service) caps the window at 366 days and throws a `BadRequestException` beyond that. A user with `telework:create` can pass e.g. `startDate=2000-01-01, endDate=2099-12-31` (~36500 days × number of active rules) causing a very large in-memory Map and a subsequent `createMany` with tens of thousands of rows.

```
    const start = new Date(dto.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dto.endDate);
    end.setHours(23, 59, 59, 999);
    ...
    let cursorKey = teleworkDayKey(start);
    const endKey = teleworkDayKey(end);

    while (cursorKey <= endKey) {
      ...
      expected.set(key, { userId: rule.userId, dateKey: cursorKey });
      ...
      cursorKey = nextTeleworkDayKey(cursorKey);
    }
```

- **Root cause**: The 366-day guard present in `findAll` was not replicated when `generateSchedulesFromRules` was written or refactored. `GenerateSchedulesDto` has only `@IsDateString()` + `@IsNotEmpty()` — no range constraint.
- **Impact**: Authenticated users with `telework:create` (CONTRIBUTEUR and above, scoped to themselves) can trigger a resource-exhaustion event: large in-memory allocation, and a potentially massive `createMany` insert that saturates the DB connection or PostgreSQL write path. With `telework:manage_any`, the payload is multiplied by all users' active rules.
- **Suggested fix**: 1. Add a date-range validation in `GenerateSchedulesDto` or at the top of `generateSchedulesFromRules`: reject if `(end - start) > 366 days`, matching the `findAll` guard. 2. Optionally add `@Throttle` on the controller endpoint.
- **Acceptance criteria**:
  - POST /telework/recurring-rules/generate with a >366-day range returns HTTP 400
  - POST /telework/recurring-rules/generate with a 90-day range continues to succeed
  - Unit test covers the range-exceeded path
- **Verification**: `grep -n '366\|BadRequestException\|MAX_RANGE\|daysDiff' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/telework/telework.service.ts | head -10`
- **Related**: PER-002

#### PER-002 — Unbounded date span on `/planning/overview` triggers O(N_days × N_rules) in-memory expansion and uncapped bulk DB write in telework service

**🟠 important** · `apps/api/src/planning/dto/planning-overview-query.dto.ts:1-11` · confidence: medium · cluster E · resource-exhaustion-dos

`PlanningOverviewQueryDto` validates that `startDate` and `endDate` are ISO 8601 strings but imposes no maximum span. `planning.service.ts` passes this range directly to `teleworkService.findForPlanningOverview`, which calls `expandRecurringRulesForRange`. That function iterates day-by-day through the full span (`while (cursorKey <= endKey)`) building an in-memory `Map` of all expected (userId, dateKey) pairs, then calls `prisma.teleworkSchedule.createMany` with no row-count cap. A 10-year span with N active recurring telework rules produces ~3,650 × N Map entries and a single DB write of all missing rows. The route requires only `users:read`, reachable by any authenticated user including OBSERVATEUR-tier roles. The global throttler (30/sec, 600/min) does not mitigate a single expensive request.

```
export class PlanningOverviewQueryDto {
  @IsNotEmpty()
  @IsISO8601()
  startDate!: string;
  @IsNotEmpty()
  @IsISO8601()
  endDate!: string;
}
```

- **Root cause**: Missing date-span validation in the DTO (no `@MaxLength`-equivalent for date ranges) combined with an unbounded day-by-day iteration loop in `telework.service.ts` `expandRecurringRulesForRange` (lines 388-401). The planning service calls this indirectly via `findForPlanningOverview` without any guard.
- **Impact**: Any authenticated user can send a single request with a multi-year span and cause: (1) event-loop blocking from the synchronous day-by-day iteration through the `expected` Map; (2) an uncapped `createMany` that may insert thousands of `teleworkSchedule` rows, polluting the database. With multiple concurrent requests, this constitutes a DoS. The route is reachable by all roles with `users:read` (the minimum role permission).
- **Suggested fix**: Add a maximum span validation to `PlanningOverviewQueryDto` (e.g., 90 or 366 days). Example: after `@IsISO8601()`, add a custom `@MaxDateSpanDays(366)` validator or a class-level `@ValidateIf` that checks `endDate - startDate <= 366 days`. Also add a guard in `expandRecurringRulesForRange` that clamps or refuses spans above a threshold to defend in depth.
- **Acceptance criteria**:
  - A request to `GET /planning/overview` with `startDate` and `endDate` more than 366 days apart returns HTTP 400
  - Requests within the allowed span continue to work correctly
  - The span validation is enforced in the DTO (not just the service) so it applies before service execution
- **Verification**: `grep -n 'MaxLength\|MaxDate\|startDate\|endDate' apps/api/src/planning/dto/planning-overview-query.dto.ts`
- **Related**: PER-001
- **Notes**: Cross-reference: telework.service.ts expandRecurringRulesForRange lines 388-401 (day-by-day loop) and lines 430-440 (uncapped createMany). Planning service call at planning.service.ts findForPlanningOverview. The loop is per rule, so the total iterations are N_rules × N_days.

#### PER-003 — checkCircularDependency loads entire task_dependency table with no WHERE clause

**🟠 important** · `apps/api/src/tasks/tasks.service.ts:1424-1473` · confidence: high · cluster F · full-table-scan

Every call to POST /tasks/:id/dependencies fetches the entire `task_dependency` table with no project-scoped or task-scoped WHERE predicate. The comment says 'pre-fetch strategy' (PER-023), but the strategy has no upper bound. In a deployment with thousands of tasks the query materialises the full edge list into the Node.js process on every dependency mutation.

```
const allDeps = await this.prisma.taskDependency.findMany({
  select: { taskId: true, dependsOnTaskId: true },
});
// BFS over allDeps in memory …
```

- **Root cause**: The BFS pre-load was optimised to avoid N round-trips but the WHERE clause was never added. A graph traversal starting from a single task only needs the reachable subgraph, not the global edge set.
- **Impact**: Full table scan on every dependency write. With 10,000 dependency rows the query transfers ~320 KB per call. Memory pressure and query time grow linearly with the total dependency count, not with the task graph size.
- **Suggested fix**: Scope the initial fetch to the same project: add `where: { task: { projectId: startTask.projectId } }`. Alternatively pre-load only direct successors/predecessors lazily during BFS traversal (one indexed lookup per hop). Either approach requires an index on `task_dependency(taskId)` and `task_dependency(dependsOnTaskId)` — verify via `\d task_dependency` in psql.
- **Acceptance criteria**:
  - findMany call includes a WHERE clause scoping to project or relevant task IDs
  - No regression on the existing circular-dependency spec tests
  - Query plan shows Index Scan on task_dependency instead of Seq Scan
- **Verification**: `grep -n 'findMany' apps/api/src/tasks/tasks.service.ts | grep -i 'taskDependency'`
- **Related**: COR-001

#### PER-004 — getLeaveBalance issues 1-2 DB round-trips per leave type via Promise.all(leaveTypes.map(resolveAllocatedDays))

**🟠 important** · `apps/api/src/leaves/leaves.service.ts:2840-2850` · confidence: high · n+1-query

For each active leave type the service calls `resolveAllocatedDays`, which issues a `findUnique` (individual allocation) and optionally a `findFirst` (global default allocation). With N leave types this is N to 2N parallel DB queries. The outer `allLeaves` fetch above this block is correctly batched, making the allocation resolution the dominant query cost.

```
const balancesByType = await Promise.all(
  leaveTypes.map(async (lt) => {
    const totalDays = await this.resolveAllocatedDays(
      userId,
      lt.id,
      currentYear,
    );
    // … per-type used/remaining calcs …
  }),
);
```

- **Root cause**: `resolveAllocatedDays` was designed as a single-item resolver. The call-site maps over all leave types without pre-fetching all relevant allocations in a single query.
- **Impact**: For a user with 10 leave types: 10-20 additional DB round-trips per `/leaves/balance` request. Under concurrent users (e.g., 50 users checking balance simultaneously) this generates 500-1000 DB queries per second for a single endpoint.
- **Suggested fix**: Pre-fetch all relevant allocations in two bulk queries before the map: one `findMany` for individual allocations (`userId + leaveTypeId IN [...]`) and one `findMany` for global defaults (`leaveTypeId IN [...] AND userId IS NULL`). Build lookup Maps, then resolve in-memory inside the loop with zero additional DB calls.
- **Acceptance criteria**:
  - At most 2 DB queries total inside getLeaveBalance (bulk individual + bulk global), regardless of N leave types
  - Existing balance calculation logic and outputs unchanged
  - Unit tests for getLeaveBalance pass
- **Verification**: `grep -n 'resolveAllocatedDays\|findUnique\|findFirst' apps/api/src/leaves/leaves.service.ts | head -40`

#### PER-005 — RecentActivityService.getRecentActivity fetches all active tasks with no take limit

**🟠 important** · `apps/api/src/analytics/advanced/services/recent-activity.service.ts:38-48` · confidence: high · cluster I · unbounded-query

No `take` clause on `task.findMany`. For an ADMIN user `projectScope` is `{}`, so this fetches every task row across all active projects. The select is narrow (4 columns) but the row count is unbounded. This endpoint is called as part of the advanced analytics fan-out.

```
const tasks = await this.prisma.task.findMany({
  where: {
    project: { status: 'ACTIVE', AND: [projectScope, archivedClause] },
  },
  select: {
    status: true,
    createdAt: true,
    updatedAt: true,
    endDate: true,
  },
});
```

- **Root cause**: The service was written to compute recent-activity metrics that need a full status distribution, but no upper bound was added. Analytics endpoints often accept full scans in exchange for caching, but here the caching layer is one level up (analytics controller).
- **Impact**: In a large deployment with 50,000 tasks across active projects an ADMIN request transfers 50,000 rows from Postgres to Node.js on each analytics refresh. Memory spike of several MB per request, potential OOM under concurrent analytics access.
- **Suggested fix**: Add a recency filter (`updatedAt >= thirtyDaysAgo`) matching the 'recent activity' semantic: `where: { updatedAt: { gte: new Date(Date.now() - 30 * 86400_000) }, project: { ... } }`. This aligns the query with the feature's intent and adds an indexable time filter. Alternatively add `take: 5000` as a safety ceiling and document the cap.
- **Acceptance criteria**:
  - Query includes a time-based WHERE predicate (e.g. updatedAt >= 30 days ago) or explicit take cap
  - EXPLAIN ANALYZE shows Index Scan on tasks(updatedAt) rather than Seq Scan
  - Analytics output values remain correct for typical data ranges
- **Verification**: `grep -n 'findMany\|take\|updatedAt' apps/api/src/analytics/advanced/services/recent-activity.service.ts`
- **Related**: PER-016, PER-017, PER-018

#### PER-006 — usersService.getAll() hardcodes limit=1000 — always fetches the entire user table

**🟠 important** · `apps/web/src/services/users.service.ts:11` · confidence: high · cluster G · unbounded payload

When callers omit the `limit` parameter (the common case — 13+ call sites), the default silently becomes 1000. Every page that calls usersService.getAll() (Users, Projects, Tasks, Leaves, Events, Suivi, etc.) downloads the entire user list in a single response.

```
  async getAll(
    page?: number,
    limit?: number,
    roleCode?: string,
  ): Promise<User[] | PaginatedResponse<User>> {
    const params = new URLSearchParams();
    params.append("limit", (limit ?? 1000).toString());
```

- **Root cause**: The default parameter `limit ?? 1000` was chosen as a simple workaround for the backend's 10-row default, but it means any growth in user count (government org with 500+ agents) makes every page render significantly slower.
- **Impact**: At 500 users with their role, department, services, and skills relations eager-loaded, the response payload easily exceeds 100 KB. Every page navigation that involves a user dropdown triggers this download afresh (no TanStack Query cache on most of these raw useEffect calls).
- **Suggested fix**: Add a dedicated `search` or `autocomplete` endpoint (GET /users/autocomplete?q=&limit=50) for dropdowns. For list pages (Users page), use server-side pagination. For lookup dropdowns inside modals (Projects, Tasks), replace with a lazy-search component that fetches on keystroke.
- **Acceptance criteria**:
  - No call site passes limit >100 except an intentional full-export scenario
  - Dropdown pickers use a search-backed component with max 50 results
  - Users page paginates server-side (next/prev buttons)
- **Verification**: `grep -rn 'usersService.getAll' apps/web/app --include='*.tsx' | wc -l`
- **Related**: PER-020, PER-007, PER-008, PER-012, PER-019

#### PER-007 — projectsService.getAll() hardcodes limit=1000 — fetches entire project list on every load

**🟠 important** · `apps/web/src/services/projects.service.ts:22` · confidence: high · cluster G · unbounded payload

Same pattern as users: default limit is 1000. Called without arguments from tasks/page.tsx, events/page.tsx, tasks/[id]/page.tsx, and the reports page's `loadProjects` (via raw `api.get('/projects')` which hits the backend's own default). All project metadata (members, milestones, snapshots partial data) is downloaded at once.

```
  async getAll(
    page?: number,
    limit?: number,
    status?: ProjectStatus,
    archived?: ArchivedFilter,
  ): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams();
    params.append("limit", (limit ?? 1000).toString());
```

- **Root cause**: Defensive workaround for the backend pagination default; no upper bound was set.
- **Impact**: An organisation with hundreds of projects (common in local government) will download a multi-hundred KB payload on every page requiring a project selector dropdown. The tasks page fetches limit=1000 projects AND limit=200 tasks in the same render cycle.
- **Suggested fix**: Use limit=50 or a project search endpoint for dropdowns. The Projects list page already has client-side filters; keep server pagination with a 50-item page size.
- **Acceptance criteria**:
  - projectsService.getAll() with no arguments defaults to limit=50 at most
  - Tasks/Events pages use a lazy-loaded project picker instead of pre-fetching all projects
- **Verification**: `grep -rn 'projectsService.getAll()' apps/web/app --include='*.tsx'`
- **Related**: PER-020, PER-006, PER-008, PER-012, PER-019

#### PER-008 — milestonesService.getAll() and getByProject() both hardcode limit=1000

**🟠 important** · `apps/web/src/services/milestones.service.ts:7-27` · confidence: high · cluster G · unbounded payload

Both the global milestone list and per-project milestone list unconditionally request 1000 rows. Projects with heavy milestone use (roadmaps, legislative cycles) could accumulate thousands of milestones over time.

```
  async getAll(): Promise<PaginatedResponse<Milestone>> {
    const response = await api.get<PaginatedResponse<Milestone>>(
      "/milestones?limit=1000",
    );
    return response.data;
  },

  // ...

      `/milestones?projectId=${projectId}&limit=1000`,
```

- **Root cause**: No upper bound defined; 1000 chosen as a safe upper limit that will hide pagination issues until growth occurs.
- **Impact**: Per-project detail page loads all project milestones in one request. With milestone details (tasks counts, dates, etc.) this can be a large payload for mature projects.
- **Suggested fix**: For the project detail page, limit=200 is a more realistic upper bound. For the global list, add pagination UI or lazy loading.
- **Acceptance criteria**:
  - milestonesService.getByProject() uses limit=200 maximum
  - milestonesService.getAll() is not called in production flows (only used in admin export scenarios)
- **Verification**: `grep -rn 'milestonesService.getAll\|milestonesService.getByProject' apps/web/app --include='*.tsx'`
- **Related**: PER-020, PER-006, PER-007, PER-012, PER-019

#### PER-009 — projects/[id]/page.tsx fetches project, stats, tasks, milestones sequentially (4 serial awaits)

**🟠 important** · `apps/web/app/[locale]/projects/[id]/page.tsx:150-202` · confidence: high · cluster H · request waterfall

The project detail page executes 4 sequential API calls: getById, getStats, getByProject (tasks), getByProject (milestones). Each waits for the previous to complete before starting. Total TTFB-to-data is approximately 4× a single round-trip.

```
        setLoading(true);

        // Fetch project details
        const projectData = await projectsService.getById(projectId);
        setProject(projectData);
        setHiddenStatuses(projectData.hiddenStatuses || []);

        // Fetch project stats
        try {
          const statsData = await projectsService.getStats(projectId);
          setStats(statsData);
        } catch (err) {
```

- **Root cause**: Incremental feature additions placed each fetch in sequence without consolidating into Promise.all.
- **Impact**: On a 100ms RTT connection, the page waits 400ms+ before rendering any content. This affects the core project management workflow — the most-used page in the application.
- **Suggested fix**: Parallelise all 4 calls: `const [projectData, statsData, tasksData, milestonesData] = await Promise.all([projectsService.getById(projectId), projectsService.getStats(projectId), tasksService.getByProject(projectId), milestonesService.getByProject(projectId)])`. Note: hiddenStatuses extraction from projectData still works after the promise resolves.
- **Acceptance criteria**:
  - All 4 fetches fire concurrently using Promise.all
  - Error handling remains isolated per fetch (use Promise.allSettled if partial failures should be non-blocking)
- **Verification**: `N/A — manual verification`
- **Related**: PER-021, PER-010, PER-022, PER-011, PER-013, PER-023, PER-024, PER-025

#### PER-010 — suivi/page.tsx makes sequential usersService.getAll() followed by 7 parallel fetches — extra serial hop

**🟠 important** · `apps/web/app/[locale]/users/[id]/suivi/page.tsx:174-199` · confidence: high · cluster H · request waterfall

The suivi page awaits `usersService.getAll()` (which fetches 1000 users) before launching the 7 parallel data fetches. Since the users dropdown is non-blocking ("// Non-blocking"), all 7 fetches could be started in parallel with the users call.

```
      // Fetch accessible users for the dropdown (scoped to access)
      try {
        const usersData = await usersService.getAll();
        const usersList: User[] = Array.isArray(usersData)
          ? usersData
          : (usersData as { data: User[] }).data || [];
        // Filter to only users the current user can access
        setAllUsers(
          usersList.filter((u: User) => u.isActive && checkAccess(u)),
        );
      } catch {
        // Non-blocking: dropdown just won't work
      }

      // Fetch all related data in parallel
      const { start, end } = periodDates;
      try {
        const results = await Promise.allSettled([
```

- **Root cause**: The users call was placed before the parallel block due to its non-critical nature, but it was not made concurrent.
- **Impact**: Adds one full RTT (plus the time to deserialise potentially 1000 users) before the 7 content fetches start. On a typical LAN, this could add 50–200ms to page load.
- **Suggested fix**: Start the users fetch as a floating promise alongside the `Promise.allSettled` block: fire `usersService.getAll()` in parallel and await it separately only when setting state.
- **Acceptance criteria**:
  - usersService.getAll() and the Promise.allSettled block fire concurrently
  - The users dropdown populates asynchronously after the main data is displayed
- **Verification**: `N/A — manual verification`
- **Related**: PER-021, PER-009, PER-022, PER-011, PER-013, PER-023, PER-024, PER-025

#### PER-011 — Most pages use raw useState+useEffect instead of TanStack Query — no deduplication or cache across pages

**🟠 important** · `apps/web/app/[locale]/projects/page.tsx:85-131` · confidence: high · cluster H · missing TanStack Query cache

While TanStack Query hooks (useProjects, useUsers, useTasks) exist for the common list queries, the majority of pages bypass them and use raw useEffect + setState. This means navigating Projects → Dashboard → Projects triggers three separate `/projects` fetches with no cache reuse.

```
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      let projectsData: Project[] = [];

      // Si ?member=me dans l'URL, on force le scope "mes projets" quel que
      // soit le rôle (pour les CTA du Dashboard notamment).
      if (memberMeFilter && user?.id) {
        try {
          projectsData = await projectsService.getByUser(user.id);
        } catch (err) {
```

- **Root cause**: The TanStack Query hooks were added as a partial refactor but not applied throughout the pages. The pages retain the original manual fetch pattern.
- **Impact**: Every page mount re-fetches the full dataset. The QueryClient cache (30s staleTime) is never hit for page-level data. On a shared dashboard → tasks → projects navigation, the backend receives 3× the API calls needed.
- **Suggested fix**: Replace the raw useEffect fetch in projects/page.tsx, tasks/page.tsx, and users/page.tsx with the existing `useProjects()`, `useTasks()`, and `useUsers()` hooks. Extend the hooks to accept filter parameters and add query key variants.
- **Acceptance criteria**:
  - projects/page.tsx, tasks/page.tsx, users/page.tsx use their respective TanStack Query hooks
  - Back-navigation does not trigger a new network request within the 30s staleTime window
- **Verification**: `grep -rn 'useProjects\|useTasks\|useUsers' apps/web/app --include='*.tsx' | wc -l`
- **Related**: PER-021, PER-009, PER-010, PER-022, PER-013, PER-023, PER-024, PER-025

#### PER-012 — leavesService.getByUser() and getByDateRange() hardcode limit=1000 with no upper bound

**🟠 important** · `apps/web/src/services/leaves.service.ts:113-145` · confidence: high · cluster G · unbounded payload

Both leave-fetching paths request up to 1000 leave records. For a long-tenured employee or a manager viewing a large team's leaves, this could return hundreds of records with full user and leave-type relations embedded.

```
  async getByUser(userId: string): Promise<Leave[]> {
    // The API exposes a user's leaves via the filtered list GET /leaves?userId=
    // (paginated {data,meta} envelope) — there is no /leaves/user/:id path route.
    const response = await api.get<{ data: Leave[] } | Leave[]>(
      `/leaves?userId=${userId}&limit=1000`,
    );
    if (response.data && "data" in response.data) {
      return response.data.data;
    }
```

- **Root cause**: Workaround for the API's default 10-row pagination; no practical upper bound was evaluated.
- **Impact**: The suivi page fetches up to 1000 leaves for one user on page load. The leaves page itself uses limit=100 for getAll (acceptable) but the getByUser path is unbounded.
- **Suggested fix**: Apply a year-scoped filter: `limit=200&year=currentYear` for most UI contexts. For historical data (audit), expose a separate paginated endpoint.
- **Acceptance criteria**:
  - getByUser uses limit=200 maximum
  - suivi page passes a year filter to scope the leave data to the relevant period
- **Verification**: `grep -rn 'limit=1000' apps/web/src/services/leaves.service.ts`
- **Related**: PER-020, PER-006, PER-007, PER-008, PER-019

#### PER-013 — tasks/page.tsx calls fetchData() (5 API calls) on every status change, delete, and date change

**🟠 important** · `apps/web/app/[locale]/tasks/page.tsx:150-195` · confidence: high · cluster H · redundant refetch

After every mutation (status change, delete, date change), the page calls `fetchData()` which re-fetches projects, tasks (up to 200), orphan tasks, users (up to 1000), and services — 5 separate API calls. This happens for every status toggle in the Kanban view.

```
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success(t("messages.statusUpdateSuccess"));
      fetchData();
    } catch {
      toast.error(t("messages.statusUpdateError"));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksService.delete(taskId);
      toast.success(
        t("messages.deleteSuccess", { defaultValue: "Tâche supprimée" }),
      );
      fetchData();
    } catch {
```

- **Root cause**: Full re-fetch pattern as defensive measure; no optimistic updates or targeted cache invalidation.
- **Impact**: A Kanban user dragging 5 tasks between columns triggers 25 API calls. On a slow network this causes visible flicker and server load.
- **Suggested fix**: Use optimistic local state updates for status change and date change. For delete, remove the item from local state. Reserve fetchData() for cases where server-authoritative state is critical (e.g., after import).
- **Acceptance criteria**:
  - handleStatusChange, handleDeleteTask, and handleDateChange apply optimistic state updates
  - fetchData is not called after single-task mutations
- **Verification**: `N/A — manual verification`
- **Related**: PER-021, PER-009, PER-010, PER-022, PER-011, PER-023, PER-024, PER-025

#### PER-014 — milestones.assertProjectMembership fetches all project members into memory (include: { members: true }); epics uses a targeted count query

**🟡 nit** · `apps/api/src/milestones/milestones.service.ts:approx line 430-445` · confidence: high · N+1 / full membership load

assertProjectMembership in milestones.service.ts includes all project_members rows for the project in every membership check. For projects with many members, this returns a large array that is then filtered client-side. The equivalent epics.assertProjectMembership uses a count query (SELECT COUNT WHERE projectId = X AND userId = Y) which is O(1) in DB rows. The inconsistency is a performance hazard at scale and a maintainability risk (two divergent patterns for the same business check).

```
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: { include: { members: true } } },
    });
    const isMember = milestone.project.members.some((m) => m.userId === userId);
```

- **Root cause**: The two assertProjectMembership implementations were written independently.
- **Impact**: Performance degradation for membership checks in projects with large member counts. Not a correctness issue.
- **Suggested fix**: Align milestones.assertProjectMembership with the epics pattern: use a count query (prisma.projectMember.count({ where: { projectId, userId } })) instead of include: { members: true } + Array.some.
- **Acceptance criteria**:
  - milestones.assertProjectMembership uses a count or findFirst query rather than include: { members: true }
  - No behavioral change: still throws ForbiddenException for non-members
- **Verification**: `grep -n 'assertProjectMembership\|members: true\|count' apps/api/src/milestones/milestones.service.ts apps/api/src/epics/epics.service.ts`

#### PER-015 — importTasks inner loop uses sequential await tx.subtask.create instead of createMany

**🟡 nit** · `apps/api/src/tasks/tasks.service.ts:1640-1648` · confidence: high · sequential-await-in-loop

Inside the per-task `$transaction` callback, subtask rows are inserted one by one with sequential `await`. This means a task with 5 subtasks generates 5 sequential round-trips inside the transaction, and the outer loop serialises all tasks. For a CSV import of 100 tasks each with 5 subtasks: 100 × 6 = 600 sequential DB calls.

```
for (let j = 0; j < subtaskTitles.length; j++) {
  await tx.subtask.create({
    data: {
      title: subtaskTitles[j],
      taskId: createdTask.id,
      position: j,
    },
  });
}
```

- **Root cause**: The outer per-task transaction was likely added to ensure atomicity per task. The inner subtask loop was not converted to `createMany` when the feature was implemented.
- **Impact**: Import of 100 tasks with 5 subtasks each is 5× slower than necessary for the subtask insertion step. Perceived as a slow import UX on large CSV files.
- **Suggested fix**: Replace the inner subtask loop with a single `tx.subtask.createMany({ data: subtaskTitles.map((title, j) => ({ title, taskId: createdTask.id, position: j })) })`. Preserves transaction atomicity, reduces round-trips to 1 per task.
- **Acceptance criteria**:
  - Inner subtask loop replaced with a single createMany call
  - Import integration tests pass with subtask counts > 1
  - No change to subtask position ordering
- **Verification**: `grep -n 'subtask.create\b' apps/api/src/tasks/tasks.service.ts`

#### PER-016 — captureSnapshots materialises all task rows for ACTIVE projects instead of using groupBy

**🟡 nit** · `apps/api/src/projects/projects.service.ts:1217-1223` · confidence: high · cluster I · memory-materialisation

Called from a scheduled job, this fetches all task and milestone rows for every active project. With 200 active projects averaging 100 tasks each, 20,000 task rows are transferred to compute status counts. A `groupBy` on `task` grouped by `(projectId, status)` would return the same aggregate with far fewer bytes.

```
const projects = await this.prisma.project.findMany({
  where: { status: ProjectStatus.ACTIVE },
  include: {
    tasks: { select: { status: true } },
    milestones: { select: { status: true, dueDate: true } },
  },
});
```

- **Root cause**: The snapshot logic counts tasks per status in JS after fetching all rows (`tasks.filter(t => t.status === 'DONE').length`). Moving this to a DB-side groupBy would eliminate the materialisation.
- **Impact**: Scheduled job transfers O(all_tasks) per run instead of O(distinct_status × projects). At scale this is a memory spike every cron interval.
- **Suggested fix**: Replace the `include: { tasks }` with a `groupBy` query: `prisma.task.groupBy({ by: ['projectId', 'status'], where: { project: { status: 'ACTIVE' } }, _count: true })`. Build a lookup Map keyed by projectId to reconstruct the snapshot counts in-memory with no task row transfer.
- **Acceptance criteria**:
  - No task rows materialised in Node.js; status counts come from groupBy aggregate
  - Snapshot captured values identical to current implementation
  - Scheduled job memory footprint reduced (verifiable via process.memoryUsage() logging)
- **Verification**: `grep -n 'captureSnapshots\|tasks.*select\|filter.*status' apps/api/src/projects/projects.service.ts | head -20`
- **Related**: PER-005, PER-017, PER-018

#### PER-017 — MilestonesCompletionService fetches all milestone rows with no take cap

**🟡 nit** · `apps/api/src/analytics/advanced/services/milestones-completion.service.ts:39-44` · confidence: high · cluster I · unbounded-query

No `take` clause. An ADMIN user scoped to all projects fetches every milestone row. The `include.project` select is narrow but there is no upper bound on row count.

```
const milestones = await this.prisma.milestone.findMany({
  where: { project: { AND: [projectScope, archivedClause] } },
  include: {
    project: { select: { id: true, name: true } },
  },
});
```

- **Root cause**: Milestones are a smaller table than tasks but the same pattern of missing `take` applies. Analytics services share this anti-pattern.
- **Impact**: Low severity given typical milestone counts per deployment (hundreds not hundreds of thousands), but consistent with the unbounded pattern in sibling analytics services.
- **Suggested fix**: Add `take: 2000` as a safety ceiling, or add a recency filter on `dueDate` / `createdAt` matching the analytics window. Document the cap in a comment.
- **Acceptance criteria**:
  - Query has explicit take cap or date-range filter
  - Analytics output unchanged for data sets within the cap
- **Verification**: `grep -n 'findMany\|take\|milestone' apps/api/src/analytics/advanced/services/milestones-completion.service.ts`
- **Related**: PER-005, PER-016, PER-018

#### PER-018 — TasksBreakdownService fetches all active task rows with no take cap

**🟡 nit** · `apps/api/src/analytics/advanced/services/tasks-breakdown.service.ts:37-46` · confidence: high · cluster I · unbounded-query

Two-column select (`priority`, `status`) but no `take` limit. For ADMIN users this returns every task across all active projects. Similar pattern to RecentActivityService but the 2-column select is even narrower.

```
const tasks = await this.prisma.task.findMany({
  select: { priority: true, status: true },
  where: {
    project: {
      status: 'ACTIVE',
      AND: [projectScope, archivedClause],
    },
  },
});
```

- **Root cause**: The task breakdown is a status/priority distribution — semantically a `groupBy` query. Materialising all rows to count them in JS is the common anti-pattern across these analytics services.
- **Impact**: Transfers O(all_active_tasks) rows per analytics request. With a 2-column select the per-row size is minimal but row count is unbounded.
- **Suggested fix**: Replace `findMany` with `prisma.task.groupBy({ by: ['priority', 'status'], where: { ... }, _count: { _all: true } })`. This computes the breakdown entirely in Postgres and returns O(distinct_priority × distinct_status) rows regardless of total task count.
- **Acceptance criteria**:
  - findMany replaced with groupBy or take cap added
  - Priority/status distribution output unchanged
  - Query plan shows aggregate rather than full table scan
- **Verification**: `grep -n 'findMany\|groupBy\|take' apps/api/src/analytics/advanced/services/tasks-breakdown.service.ts`
- **Related**: PER-005, PER-016, PER-017

#### PER-019 — timeTrackingService.getAll() fetches ALL time entries with no date or user bound

**🟡 nit** · `apps/web/src/services/time-tracking.service.ts:12-20` · confidence: medium · cluster G · unbounded payload

getAll() fetches all time-tracking entries with no pagination or date filter. Fortunately, call sites in app pages (time-tracking/page.tsx) use `getMyEntries()` instead, so getAll() is not called in production page flows. However, the method exists as a footgun for future callers.

```
  async getAll(): Promise<TimeEntry[]> {
    const response = await api.get<{ data: TimeEntry[] } | TimeEntry[]>(
      "/time-tracking",
    );
    // API returns {data: [], meta: {}} - extract the array
    if (response.data && "data" in response.data) {
      return response.data.data;
    }
    return Array.isArray(response.data) ? response.data : [];
```

- **Root cause**: Legacy convenience method; not actively used but presents a risk if wired up.
- **Impact**: Low currently — no active page calls this. Risk if added to a new page without a limit.
- **Suggested fix**: Add a deprecation comment and require callers to use getMyEntries() or getByUser() instead. Alternatively, add a default limit: `GET /time-tracking?limit=100`.
- **Acceptance criteria**:
  - timeTrackingService.getAll() is not called in any page
  - Method has a JSDoc deprecation notice
- **Verification**: `grep -rn 'timeTrackingService.getAll()' apps/web/app --include='*.tsx'`
- **Related**: PER-020, PER-006, PER-007, PER-008, PER-012

#### PER-021 — reports/page.tsx calls loadProjects() serially inside loadAnalytics() — creates a waterfall

**🟡 nit** · `apps/web/app/[locale]/reports/page.tsx:63-81` · confidence: high · cluster H · request waterfall

`loadProjects()` is called inside `loadAnalytics()` after the analytics response is received. While `loadProjects` does not await (it is called without await), it still adds an extra HTTP round-trip that could have been fired in parallel with the analytics call. Furthermore, `loadProjects` is memoized with `useCallback` but called inside `loadAnalytics`'s dependency chain causing double-execution on every dateRange or selectedProject change.

```
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateRange });
      if (selectedProject !== "all") {
        params.append("projectId", selectedProject);
      }

      const response = await api.get(`/analytics?${params.toString()}`);
      const analyticsData = response.data;
      setData(analyticsData);

      // Load projects for filter if not already loaded
      loadProjects();
```

- **Root cause**: Projects fetch was added as a convenience inside analytics loading rather than parallelised at component mount.
- **Impact**: Two serial HTTP round trips on every date range change instead of one parallel pair. On slow connections this adds perceptible latency to the reports page.
- **Suggested fix**: Fire both fetches with `Promise.all([loadAnalytics(), loadProjects()])` inside a top-level effect, or lift `loadProjects` into a mount-only `useEffect(()=>{ loadProjects(); }, [])` (as intended by the comment) and remove it from `loadAnalytics`.
- **Acceptance criteria**:
  - loadProjects and the analytics fetch are initiated in parallel on first render
  - loadProjects is not re-called on every dateRange/selectedProject change
- **Verification**: `N/A — manual verification`
- **Related**: PER-009, PER-010, PER-022, PER-011, PER-013, PER-023, PER-024, PER-025
- **Notes**: [severity normalized from 'minor']

#### PER-022 — dashboard/page.tsx re-fetches all assignee tasks after every status change — full reload on mutation

**🟡 nit** · `apps/web/app/[locale]/dashboard/page.tsx:107-143` · confidence: medium · cluster H · redundant refetch

After a single task status update, the handler fetches the complete task list for the user again. On a page that also renders a PlanningView (itself loading the planning overview), this compounds the request count.

```
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success(t("tasks.success.statusUpdated"));

      // Refresh les tâches
      if (user?.id) {
        const tasks = await tasksService.getByAssignee(user.id);

        const filteredTasks = Array.isArray(tasks)
```

- **Root cause**: Optimistic update was not implemented; full re-fetch chosen for simplicity.
- **Impact**: Each status toggle triggers two API calls (update + getByAssignee). With a user who has 50+ tasks, this fetches the full task list on every checkbox toggle. The handleQuickEntrySuccess callback (line 154) already shows the correct optimistic update pattern.
- **Suggested fix**: Apply the same optimistic update pattern as `handleQuickEntrySuccess`: `setMyTasks(prev => prev.map(t => t.id === taskId ? {...t, status: newStatus} : t))`. Only re-fetch if the mutation fails.
- **Acceptance criteria**:
  - handleStatusChange updates local state optimistically without an extra network request
  - On error, revert the local state and show an error toast
- **Verification**: `N/A — manual verification`
- **Related**: PER-021, PER-009, PER-010, PER-011, PER-013, PER-023, PER-024, PER-025
- **Notes**: [severity normalized from 'minor']

#### PER-023 — Most app pages are "use client" unnecessarily — no RSC data-fetching benefits

**🟡 nit** · `apps/web/app/[locale]/projects/page.tsx:1` · confidence: medium · cluster H · client-side RSC missed opportunity

The majority of list pages (projects, tasks, users, leaves, reports) are marked `use client` and fetch data entirely on the client via useEffect. In Next.js 16 App Router, RSC could pre-render static structure (headers, filters, shell) server-side and stream content, reducing client-side JavaScript bundle size and time-to-first-paint.

```
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
```

- **Root cause**: All pages were authored in the classic CSR pattern; RSC migration was not prioritised when upgrading to Next.js App Router.
- **Impact**: No streaming, no server-side data prefetch, no bundle splitting benefit from RSC for data-heavy pages. All JS is shipped to the client and executed on mount.
- **Suggested fix**: Convert the shell layout and static filter controls to RSC; keep only interactive components (modals, form state) as client components. Use Next.js `loading.tsx` and Suspense boundaries for progressive rendering.
- **Acceptance criteria**:
  - Pages do not have top-level 'use client' if only parts need interactivity
  - Data loading uses server-side fetch or TanStack Query's prefetch pattern
- **Verification**: `grep -rn '^"use client"' apps/web/app --include='*.tsx' | wc -l`
- **Related**: PER-021, PER-009, PER-010, PER-022, PER-011, PER-013, PER-024, PER-025

#### PER-024 — getDayCell() in usePlanningData runs O(N) linear scans over tasks/leaves/events/telework on every cell render

**🟡 nit** · `apps/web/src/hooks/usePlanningData.ts:364-516` · confidence: high · cluster H · client-side linear scan

getDayCell is called once per (user × day) cell in the planning grid. Each call runs a full `.filter()` pass over the tasks array, leaves array, events array, telework array, and holidays array. For a month view with 30 users × 22 working days, this is 660 cell renders × 5 linear scans = 3300 O(N) operations on every render cycle.

```
    const getDayCell = useCallback(
      (userId: string, date: Date): DayCell => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayPredefinedAssignments = predefinedAssignments.filter(
          (a) => a.userId === userId && a.date.slice(0, 10) === dateStr,
        );
        const dayTasks = tasks.filter((t) => {
          // Le filtrage des tâches DONE est délégué au filtre légende côté DayCell
```

- **Root cause**: The data was kept as flat arrays for simplicity; no pre-indexing by (userId, date) was applied.
- **Impact**: On the month view with 30+ users, getDayCell is computationally expensive. Combined with React's reconciliation, this can cause noticeable jank when scrolling or changing filters on large planning grids.
- **Suggested fix**: Pre-index data in a useMemo: build a Map<userId, Map<dateStr, DayCell>> once when the raw arrays change. getDayCell then becomes a O(1) lookup. Example: `const cellIndex = useMemo(() => buildCellIndex(tasks, leaves, events, telework, holidays, predefinedAssignments), [tasks, leaves, events, telework, holidays, predefinedAssignments])`.
- **Acceptance criteria**:
  - getDayCell performs a Map lookup instead of array.filter()
  - The cell index is rebuilt only when source data arrays change (memoized)
- **Verification**: `N/A — manual verification`
- **Related**: PER-021, PER-009, PER-010, PER-022, PER-011, PER-013, PER-023, PER-025

#### PER-020 — planning.getOverview hardcodes take:1000 for users and services — silent truncation above 1000

**🔵 suggestion** · `apps/api/src/planning/planning.service.ts:67-70` · confidence: medium · cluster G · silent-truncation

The planning overview grid fetches up to 1000 users and 1000 services. Any deployment with more than 1000 active users silently receives a truncated planning grid with no error, no warning, and no pagination meta exposed to the frontend.

```
const [usersResult, servicesResult, tasksResult] = await Promise.all([
  this.usersService.findAll(1, 1000, undefined, undefined, {
    allowFullScan: true,
  }),
  this.servicesService.findAll(1, 1000),
```

- **Root cause**: The planning grid was designed for medium-sized public administrations. The 1000 cap was chosen as 'safe enough' but is hardcoded with no overflow detection.
- **Impact**: Silent data loss in the planning view for organisations with >1000 users. The frontend renders a partial grid with no indication that rows are missing. Low probability in typical French local government deployments but correctness risk.
- **Suggested fix**: Add an overflow guard: if `usersResult.meta.total > 1000`, log a warning and optionally surface a `truncated: true` flag in the API response. For large deployments, implement cursor-based pagination or service-scoped filtering for the planning grid.
- **Acceptance criteria**:
  - When total users > 1000, response includes a truncation warning or error
  - Log entry emitted at WARN level when truncation occurs
  - Frontend can display an informational banner when planning data is truncated
- **Verification**: `grep -n 'allowFullScan\|1000\|findAll' apps/api/src/planning/planning.service.ts`
- **Related**: PER-006, PER-007, PER-008, PER-012, PER-019
- **Notes**: MEMORY.md PER-021 explicitly documents a 1000-row cap as intentional for scoped task endpoints. This finding is about the planning grid specifically where truncation is invisible to the user.

#### PER-025 — RecentActivity TanStack Query uses staleTime=60s — may re-fetch on every tab switch between advanced analytics sub-components

**🔵 suggestion** · `apps/web/app/[locale]/reports/components/advanced/RecentActivity.tsx:38-42` · confidence: medium · cluster H · missing cache staleTime on analytics

RecentActivity has staleTime=60s while WorkloadChart and MilestonesCompletion use staleTime=300s. Switching between the Overview tab and Advanced tab (which unmounts/remounts AdvancedAnalyticsTab since it is tab-conditional rendering) causes RecentActivity to re-fetch every minute. The analytics data changes at a much slower cadence than 60s in practice.

```
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "recent-activity", { days }],
    queryFn: () => analyticsService.getAdvancedRecentActivity(days),
    staleTime: 1 * 60 * 1000,
  });
```

- **Root cause**: Conservative staleTime choice to keep the widget feeling fresh.
- **Impact**: Minor: extra unnecessary request on tab switch if >60s has elapsed. Low severity but inconsistent with the 5-minute staleTime used by the other two analytics widgets.
- **Suggested fix**: Align staleTime to 5 * 60 * 1000 (5 minutes) for all advanced analytics widgets, consistent with WorkloadChart and MilestonesCompletion.
- **Acceptance criteria**:
  - All three advanced analytics components use the same staleTime (5 minutes)
- **Verification**: `grep -rn 'staleTime' apps/web/app/[locale]/reports --include='*.tsx'`
- **Related**: PER-021, PER-009, PER-010, PER-022, PER-011, PER-013, PER-023, PER-024

### Observability (14)

#### OBS-001 — importIcs(): outer catch silently swallows DB errors without logging

**🟠 important** · `apps/api/src/planning-export/planning-export.service.ts:326-329` · confidence: high · swallowed exception without logging

The outer catch block around prisma.event.createMany has an empty catch body — no logger.error, no rethrow. A DB connection failure, constraint violation, or Prisma error is swallowed and reported to the caller as { imported: 0, skipped: N } with HTTP 200. The caller has no way to distinguish 'all events were legitimately filtered' from 'DB was unreachable'.

```
    try {
      // PER-011 — single createMany replaces N sequential awaited creates
      const result = await this.prisma.event.createMany({
        data: batch,
        skipDuplicates: true,
      });
      return { imported: result.count, skipped };
    } catch {
      // Batch write failed entirely; count all batch rows as skipped
      return { imported: 0, skipped: skipped + batch.length };
    }
```

- **Root cause**: The comment says 'count all batch rows as skipped' but the intent is resilience for data-quality rejections, not DB infrastructure failures. The empty catch does not distinguish the two error classes.
- **Impact**: DB failures during ICS import return HTTP 200 with zero imports. Operators have no alerting signal. Repeated import failures pass undetected until users notice missing events. The LOGGER is injected (this.logger exists in the class) but unused in this catch.
- **Suggested fix**: Log at error level inside the catch before returning, distinguishing the failure source:
```ts
} catch (err) {
  this.logger.error(`ICS batch createMany failed: ${err instanceof Error ? err.message : String(err)}`);
  return { imported: 0, skipped: skipped + batch.length };
}
```
- **Acceptance criteria**:
  - catch block logs the error with this.logger.error
  - HTTP 200 response is still returned (resilience preserved)
  - Test asserts that a DB error produces a log entry
- **Verification**: `grep -n 'catch\|logger' apps/api/src/planning-export/planning-export.service.ts`
- **Notes**: The per-row catch at line 310 is different — that correctly increments skipped for transformation errors and is fine.

#### OBS-002 — All direct AuditPersistenceService callers produce audit rows with no requestId — correlation between HTTP request and audit trail is impossible for all sensitive mutations

**🟠 important** · `apps/api/src/audit/audit-persistence.service.ts:1-200` · confidence: medium · cluster K · missing-request-id-in-persistence-layer

AuditPersistenceService.log() has no requestId parameter and no AsyncLocalStorage import. requestId is only injected by the higher-level AuditService.log() (auth flows via securityEnvelope), via getRequestId() from ALS context at lines 276-278. All direct callers — leaves (approve, reject, cancel, update, delete, balance adjustment, delegation), users (create, role change, deactivate, reactivate, delete, password reset), rbac (role create/update/delete), documents (create, update, delete), projects (create, update, cancel, archive, delete), tasks, telework, time-tracking, clients, third-parties, settings — produce audit rows without any requestId. For a human auditor or SRE tracing an incident, it is impossible to link an audit row to the originating HTTP request or any correlated logs.

```
  // requestId omitted: no request-id propagation exists yet (OBS-009 open
  // — not implemented inline)
  // (leaves.service.ts line 1905-1906)

  // AuditPersistenceService.log() signature:
  async log(entry: {
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    actorId: string | null;
    payload: Record<string, unknown>;
  }): Promise<void>
```

- **Root cause**: The ALS-based requestId context (getRequestId()) was added to AuditService.log() but was never plumbed into AuditPersistenceService.log(). The gap is documented internally as OBS-009 open. The securityEnvelope schema even has a requestId: optStr field reserved for the day it is implemented, but only AuditService-routed rows currently use it.
- **Impact**: In any post-incident investigation involving a sensitive mutation (leave approval, user deletion, role change, password reset, etc.), an auditor cannot correlate an audit_logs row to an HTTP request or other structured logs. This degrades the audit trail's forensic value to a sequence of events without causal HTTP context. For a French government HR application subject to RGPD audit requirements, this is a material observability gap.
- **Suggested fix**: Add an optional requestId?: string parameter to AuditPersistenceService.log() and persist it into the payload (or as a dedicated column). Populate it via getRequestId() inside log() itself — the ALS context is inherited, so no change to call sites is needed. The securityEnvelope schema already reserves requestId: optStr (payload-schemas.ts line 70); add the same field to all bespoke per-action schemas that lack it, or use a common wrapper schema that adds requestId as an optional pass-through.
- **Acceptance criteria**:
  - AuditPersistenceService.log() reads getRequestId() from ALS and includes requestId in every persisted audit row
  - All audit_logs rows produced by sensitive mutations contain a non-null requestId when the call originates from an HTTP request
  - OBS-009 backlog item is closed
- **Verification**: `grep -n 'requestId\|getRequestId' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/audit-persistence.service.ts`
- **Notes**: Confirmed by grepping for getRequestId in audit-persistence.service.ts (zero results). AuditService.log() at lines 276-278 does inject requestId via getRequestId() for auth-envelope paths only. Code comment at leaves.service.ts lines 1905-1906 explicitly acknowledges the gap.

#### OBS-003 — Department and service CRUD mutations (departments.service.ts, services/services.service.ts) produce no audit rows — organizational perimeter changes that determine leave/user management scope are invisible to the audit trail

**🟠 important** · `apps/api/src/departments/departments.service.ts:1-999` · confidence: high · cluster J · zero-audit-coverage-organizational-perimeter-mutations

departments.service.ts and services/services.service.ts implement full CRUD (create/update/remove) on organizational units that directly control leave-management and user-management scope: every RBAC scope check in AccessScopeService resolves against a user's service and department membership. Renaming or deleting a department silently invalidates the scope assumptions for all users in that department. Neither service imports AuditPersistenceService or AuditAction, and no AuditAction enum members exist for department or service mutations.

```
// departments.service.ts — no AuditPersistenceService import, no AuditAction import
// services.service.ts — no AuditPersistenceService import, no AuditAction import
// grep -rn 'auditPersistence|AuditAction' apps/api/src/departments/departments.service.ts
// (no output)
// grep -rn 'auditPersistence|AuditAction' apps/api/src/services/services.service.ts
// (no output)
```

- **Root cause**: Organizational structure mutations were not identified as audit targets during the initial security backlog triage. The sensitive-mutation checklist focused on leave/user/RBAC actions; the indirect security impact of organizational perimeter changes (which gates who can manage whose data) was not covered.
- **Impact**: An admin can rename, merge, or delete a department or service with zero audit trace. In a French government HR context, organizational restructuring is itself an auditable change — it changes who can see and manage which employees' leaves and data, and is effectively an RBAC-adjacent mutation.
- **Suggested fix**: Add DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED, SERVICE_CREATED, SERVICE_UPDATED, SERVICE_DELETED to AuditAction enum and add corresponding schemas to payload-schemas.ts. Inject AuditPersistenceService into both services and emit on each mutation with before/after snapshots (name, parentId, etc.).
- **Acceptance criteria**:
  - AuditAction enum includes DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED
  - AuditAction enum includes SERVICE_CREATED, SERVICE_UPDATED, SERVICE_DELETED
  - departments.service.ts emits on create/update/remove with before/after
  - services.service.ts emits on create/update/remove with before/after
  - payload-schemas.ts includes strict schemas for each new action
- **Verification**: `grep -rn 'auditPersistence\|AuditAction' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/departments/departments.service.ts /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/services/services.service.ts`
- **Related**: OBS-004, OBS-005, OBS-007, OBS-010, OBS-011, OBS-012
- **Notes**: No AuditAction members for DEPARTMENT_* or SERVICE_* were found in audit-action.enum.ts (185 lines, fully read).

#### OBS-004 — Leave type CRUD mutations (leave-types.service.ts) produce no audit rows — admin changes to leave type configuration (including requiresApproval flag) are invisible to the audit trail

**🟠 important** · `apps/api/src/leave-types/leave-types.service.ts:1-999` · confidence: high · cluster J · zero-audit-coverage-leave-type-configuration

leave-types.service.ts implements create/update/remove for leave type configuration. The requiresApproval field on a leave type is a security-relevant flag: setting it to false removes the approval requirement for all future leaves of that type. Similarly, changing maxDaysPerYear or isActive affects all users' entitlements. These are admin-only mutations with no audit trail. No AuditAction enum members exist for leave type mutations.

```
// leave-types.service.ts — no AuditPersistenceService import, no AuditAction import
// grep -rn 'auditPersistence|AuditAction' apps/api/src/leave-types/leave-types.service.ts
// (no output)
```

- **Root cause**: Configuration mutations (leave types as HR policy configuration) were not included in the sensitive-mutation scope during the security backlog pass. Only transactional leave lifecycle events (approve/reject/cancel) were targeted.
- **Impact**: An admin can change leave type configuration — including disabling approval requirements — with zero audit trace. In a French government HR context, policy configuration changes are typically auditable changes. SETTINGS_CHANGED covers application-level settings but not domain-specific configuration like leave types.
- **Suggested fix**: Add LEAVE_TYPE_CREATED, LEAVE_TYPE_UPDATED, LEAVE_TYPE_DELETED to AuditAction enum. Inject AuditPersistenceService into leave-types.service.ts and emit on each mutation with before/after snapshots including the requiresApproval field.
- **Acceptance criteria**:
  - AuditAction enum includes LEAVE_TYPE_CREATED, LEAVE_TYPE_UPDATED, LEAVE_TYPE_DELETED
  - leave-types.service.ts emits on create/update/remove with before/after snapshots
  - LEAVE_TYPE_UPDATED payload captures the before and after state of requiresApproval
- **Verification**: `grep -rn 'auditPersistence\|AuditAction\|LEAVE_TYPE' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leave-types/leave-types.service.ts /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/audit-action.enum.ts`
- **Related**: OBS-003, OBS-005, OBS-007, OBS-010, OBS-011, OBS-012
- **Notes**: Confirmed by grep returning no output on leave-types.service.ts for auditPersistence/AuditAction. No LEAVE_TYPE_* members in the enum (audit-action.enum.ts fully read).

#### OBS-008 — AllExceptionsFilter: entire HttpException branch exits with no server-side log or Sentry capture

**🟠 important** · `apps/api/src/common/filters/all-exceptions.filter.ts:114-125` · confidence: medium · structured-logging

Every HttpException — including InternalServerErrorException (500), ServiceUnavailableException (503), and service-level ForbiddenException — returns at line 124 with no structured log entry, no requestId, and no Sentry/error-reporter capture. Only non-HttpException throwables reach the structured-log and captureException block. The filter's inline comment claims service-level 403s are covered by guard auditing, but PermissionsGuard only emits ACCESS_DENIED for missing-decorator and missing-permission paths; ForbiddenException thrown by business logic (e.g., milestones.service assertProjectMembership, comments.service remove ownership check) is invisible to both logs and the audit chain.

```
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      // Mirror Nest's default: forward the HttpException response body.
      // This preserves 400/401/403/404 messages for clients.
      const nestResponse = exception.getResponse();
      const body =
        typeof nestResponse === 'object' && nestResponse !== null
          ? nestResponse
          : { message: nestResponse };
      reply.status(status).send(body);
      return;
    }
```

- **Root cause**: The early-return HttpException fast-path was designed to forward NestJS error bodies verbatim. The structured logging block was added later only for the non-HttpException (unexpected-error) case, leaving the fast-path unlogged.
- **Impact**: Server-side 5xx errors raised as HttpException subclasses are never logged server-side, breaking checklist item 3 (every error path → structured log + requestId). Service-level authorization refusals leave no audit trace and no log entry, creating a forensic blind spot beyond what PermissionsGuard covers.
- **Suggested fix**: After sending the reply, emit a structured log using the NestJS logger for any HttpException with status >= 500 (at minimum). For service-level 4xx (especially ForbiddenException thrown inside services), log a WARN with requestId so cross-correlation with audit rows is possible. Example: `this.logger.warn({ requestId: getRequestId(), status, message: body?.message }, 'HttpException')`.
- **Acceptance criteria**:
  - A test throwing InternalServerErrorException from a controller produces a structured server-side log entry containing requestId.
  - A ForbiddenException thrown from a service (not from the permissions guard) appears in structured logs with requestId and HTTP status.
  - 4xx errors that are by-design (validation, not-found) are logged at WARN; 5xx at ERROR.
- **Verification**: `grep -n 'HttpException\|return;' apps/api/src/common/filters/all-exceptions.filter.ts | head -20`
- **Notes**: The filter's structured-log block at lines 130-150 (approx.) only activates for non-HttpException. Fastify access-log may partially compensate via response status codes, but carries no structured error detail or requestId. [severity normalized from 'moderate']

#### OBS-009 — AUTH events (LOGIN_*, ACCOUNT_LOCKED, ACCESS_DENIED) are fire-and-forget — silently dropped on DB outage

**🟠 important** · `apps/api/src/audit/audit.service.ts:252-257` · confidence: high · audit-trail

AuditService.log() persists auth and RBAC events (LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_LOCKED, LOGOUT, ACCESS_DENIED) via a fire-and-forget void call to AuditPersistenceService. A DB error causes the .catch() to log to stdout only — the immutable audit chain receives no row. Business-critical events (TASK_UPDATED, PROJECT_CREATED) go through the transactional direct-call path and are durable; auth events, which are most sensitive from a security audit perspective, are not. This is acknowledged (PERF-001) but the durability asymmetry is undocumented in the security posture.

```
    void this.auditPersistence
      .log({
        action: event.action,
        entityType: ENTITY_TYPE_BY_ACTION[event.action] ?? 'Auth',
        entityId: this.resolveEntityId(event),
        actorId: event.userId ?? null,
```

- **Root cause**: AuditService was designed for non-blocking auth event emission to avoid slowing down the login path. The PERF-001 note acknowledges the tradeoff but does not document a compensating control (e.g., a WAL queue or a retry mechanism).
- **Impact**: Under a DB outage or connection-pool saturation event, an attacker could trigger LOGIN_FAILURE / ACCOUNT_LOCKED events that never land in the audit trail. The chain retains no record of the security event; only rotating container stdout provides evidence. This is a Cour des Comptes audit risk.
- **Suggested fix**: At minimum, document the compensating control in a runbook: auth events must be retrieved from structured container logs when the DB is unavailable. Longer term: use a transactional outbox pattern (write auth events to a durable outbox table in the same transaction as the login result, then a background worker promotes to audit_logs).
- **Acceptance criteria**:
  - A runbook documents the recovery procedure for auth audit rows missing due to DB outage.
  - Or: auth events are written to the audit chain in the same transaction as the auth response (replacing the void fire-and-forget).
- **Verification**: `grep -n 'void this.auditPersistence\|\.catch' apps/api/src/audit/audit.service.ts | head -10`
- **Notes**: This is a known architectural trade-off (PERF-001). The finding stands as an adversarial observation because the auth path is highest-value from an attacker's perspective — precisely the events where DB pressure correlates with attack scenarios (brute-force triggering lockouts that flood the DB).

#### OBS-010 — Milestone lifecycle (create/update/delete/complete/import) produces zero audit rows — inconsistent with sibling task/project auditing

**🟠 important** · `apps/api/src/milestones/milestones.service.ts:113-154` · confidence: high · cluster J · audit-trail

MilestonesService imports AuditPersistenceService (for emitDataExported CSV export only) but emits no audit rows on create(), update(), remove(), complete(), or importMilestones(). The AuditAction enum contains no MILESTONE_* codes. The enum comment at line 134-137 explicitly states 'status/assignee/priority changes are material for project governance' when justifying TASK_* actions, making the omission of milestone lifecycle audit a direct inconsistency by the codebase's own stated standard. importMilestones() can bulk-insert up to 1000 rows with no trace.

```
  async update(
    id: string,
    updateMilestoneDto: UpdateMilestoneDto,
    currentUserId?: string,
    currentUserRole?: string | null,
  ) {
    if (currentUserId) {
      await this.assertProjectMembership(id, currentUserId, currentUserRole);
    }
    await this.findOne(id);
    const { dueDate, ...data } = updateMilestoneDto;

    try {
      return await this.prisma.milestone.update({
```

- **Root cause**: Milestones were audited for data-export only (OBS-007). Lifecycle auditing was added to tasks (OBS-012) and projects (OBS-010/OBS-024) but not extended to milestones.
- **Impact**: Project governance milestones (due dates, status completions, bulk imports) leave no immutable trace. A forensic audit cannot determine who created, moved, or deleted a milestone. The 1000-row bulk import path is a particularly significant blind spot.
- **Suggested fix**: Add MILESTONE_CREATED, MILESTONE_UPDATED (before/after), MILESTONE_DELETED (snapshot), MILESTONE_COMPLETED, MILESTONE_IMPORTED (count) to AuditAction enum. Call auditPersistence.log() inside each service method, mirroring the tasks pattern.
- **Acceptance criteria**:
  - MILESTONE_CREATED, MILESTONE_UPDATED, MILESTONE_DELETED, MILESTONE_COMPLETED, MILESTONE_IMPORTED exist in audit-action.enum.ts.
  - Each MilestonesService mutation calls auditPersistence.log() with the correct action and payload.
  - A spec test verifies the audit row is created on each lifecycle operation.
- **Verification**: `grep -n 'auditPersistence\|MILESTONE' apps/api/src/milestones/milestones.service.ts && grep -n 'MILESTONE' apps/api/src/audit/audit-action.enum.ts`
- **Related**: OBS-003, OBS-004, OBS-005, OBS-007, OBS-011, OBS-012

#### OBS-011 — Epic lifecycle (create/update/delete) produces zero audit rows

**🟠 important** · `apps/api/src/epics/epics.service.ts:1-17` · confidence: high · cluster J · audit-trail

EpicsService has no AuditPersistenceService or AuditService in its constructor. The AuditAction enum has no EPIC_* codes. Epics are project-governance entities that structure task groupings. By the codebase's own rationale for TASK_* (OBS-012, 'material for project governance'), epic lifecycle should be audited.

```
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { Prisma } from 'database';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';

@Injectable()
export class EpicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}
```

- **Root cause**: Epics may have been added before the audit-coverage expansion began. No OBS ticket targeted epics.
- **Impact**: Epic creation, renaming, and deletion are untraced. A project manager who restructures the epic hierarchy leaves no audit footprint.
- **Suggested fix**: Add EPIC_CREATED, EPIC_UPDATED (before/after), EPIC_DELETED (snapshot) to the enum. Inject AuditPersistenceService into EpicsService and emit on create/update/remove.
- **Acceptance criteria**:
  - EPIC_CREATED, EPIC_UPDATED, EPIC_DELETED exist in audit-action.enum.ts.
  - EpicsService.create/update/remove each emit an audit row via auditPersistence.log().
- **Verification**: `grep -n 'auditPersistence\|AuditPersistence\|EPIC' apps/api/src/epics/epics.service.ts && grep 'EPIC' apps/api/src/audit/audit-action.enum.ts`
- **Related**: OBS-003, OBS-004, OBS-005, OBS-007, OBS-010, OBS-012

#### OBS-012 — Admin cross-user comment deletion leaves no audit row

**🟠 important** · `apps/api/src/comments/comments.service.ts:160-184` · confidence: high · cluster J · audit-trail

When an admin or manager deletes another user's comment via comments:delete_any / projects:manage_any / tasks:manage_any, the operation succeeds silently with no audit row. CommentsService has no AuditService or AuditPersistenceService in its constructor. The deleted comment content is permanently gone with no snapshot. This is a privileged data-destruction operation with no accountability trail.

```
  async remove(id: string, userId: string, currentUser?: AccessUser) {
    const comment = await this.findOne(id, currentUser);

    // Seul l'auteur ou un rôle de gestion globale peut supprimer le commentaire d'autrui.
    if (comment.authorId !== userId) {
      const permissions = (await this.permissionsService.getPermissionsForRole(
        currentUser?.role
          ? typeof currentUser.role === 'string'
            ? currentUser.role
            : currentUser.role.code
          : null,
      )) as readonly string[];
      const canDeleteAny =
        permissions.includes('comments:delete_any') ||
        permissions.includes('projects:manage_any') ||
        permissions.includes('tasks:manage_any');
      if (!canDeleteAny) {
        throw new ForbiddenException(
          'Vous ne pouvez supprimer que vos propres commentaires',
        );
      }
    }

    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Commentaire supprimé avec succès' };
  }
```

- **Root cause**: Comments were treated as ephemeral content without sensitivity review during the audit-coverage expansion.
- **Impact**: An actor with comments:delete_any can expunge another user's comment — including potentially evidence of misconduct — with no immutable record. French public sector accountability requirements make this a compliance gap.
- **Suggested fix**: Add a COMMENT_DELETED audit row (with a payload snapshot of the comment text, authorId, taskId, and actorId) when the deleter is not the comment author. Self-deletion of own comments is lower priority.
- **Acceptance criteria**:
  - CommentsService.remove() emits an audit row when actorId != comment.authorId.
  - The payload includes a snapshot of the comment content, authorId, and taskId before deletion.
  - A spec verifies the audit row is created for the cross-user deletion path.
- **Verification**: `grep -n 'auditPersistence\|AuditService\|AuditPersistence' apps/api/src/comments/comments.service.ts`
- **Related**: OBS-003, OBS-004, OBS-005, OBS-007, OBS-010, OBS-011

#### OBS-005 — revokeAllForUser() in refresh-token.service.ts — bulk forced session termination triggered by password reset — produces no audit row

**🟡 nit** · `apps/api/src/auth/refresh-token.service.ts:176-181` · confidence: low · cluster J · no-audit-coverage-refresh-token-forced-revocation

revokeAllForUser() bulk-revokes all active refresh tokens for a user. It is called from auth.service.ts line 631 as part of the password-reset flow (SEC-019), after the password has been changed. The password change itself emits PASSWORD_CHANGED, but the forced session termination (which ends all active sessions for that user) produces no audit row. For a forensic trail, knowing that sessions were forcibly terminated as part of a password reset is complementary to knowing the password changed.

```
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
```

- **Root cause**: The password-reset audit trail was designed around the credential-change event (PASSWORD_CHANGED, PASSWORD_RESET_BY_ADMIN), not around the session-lifecycle consequence (forced logout). No TOKEN_REVOKED or SESSION_TERMINATED AuditAction exists.
- **Impact**: Low: the password-change event is audited, so the forced revocation is implied. However, a dedicated row would allow an auditor to distinguish between a user voluntarily logging out (LOGOUT) and a forced session termination by an admin (which is what password reset does). Low severity because the parent PASSWORD_RESET_BY_ADMIN row provides the causal link.
- **Suggested fix**: Add an optional SESSIONS_REVOKED AuditAction and emit it from auth.service.ts after revokeAllForUser() in the password-reset path, with payload { reason: 'password_reset', revokedCount: N }. Alternatively, document in PASSWORD_RESET_BY_ADMIN payload that token revocation is implied.
- **Acceptance criteria**:
  - Either a dedicated audit row records the forced session termination, or the PASSWORD_RESET_BY_ADMIN payload explicitly documents the revocation
  - An auditor can distinguish forced session termination from voluntary logout in the audit trail
- **Verification**: `grep -n 'revokeAllForUser\|PASSWORD_RESET' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/auth.service.ts`
- **Related**: OBS-003, OBS-004, OBS-007, OBS-010, OBS-011, OBS-012
- **Notes**: Lower severity because PASSWORD_RESET_BY_ADMIN is already emitted and the causal link to revocation is clear from the code. This is a completeness gap, not a functional breakage.

#### OBS-013 — audit_logs schema captures no actorRole snapshot — role changes make history unresolvable

**🟡 nit** · `packages/database/prisma/schema.prisma:1241-1265` · confidence: high · audit-trail

The schema captures actorEmail and actorLabel as point-in-time snapshots (correct RGPD pattern) but omits the actor's role at the time of the action. Because ORCHESTRA uses RBAC with mutable roles (role reassignment is itself an audited action), an actor's current role may differ from their role at the time of a historical event. Forensic reconstruction of 'did user X have the authority to perform action Y at time T' requires joining audit_logs with role-change events to reconstruct the role timeline, which is complex and error-prone.

```
model AuditLog {
  id         String   @id @default(uuid())
  action     String
  entityType String
  entityId   String
  actorId    String?
  actor      User?    @relation("AuditActor", fields: [actorId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  /// Email de l'acteur figé au moment du log (RGPD : snapshot, pas de JOIN). NULL si action système.
  actorEmail String?
  /// Libellé lisible de l'acteur (prénom + nom) figé au moment du log. NULL si action système.
  actorLabel String?
  payload    Json?
```

- **Root cause**: The schema design prioritised identity (who) over authority (under what role). Role-snapshot was not included in the initial audit design.
- **Impact**: Compliance queries like 'list all actions taken by users who held the MANAGER role in Q1' require reconstructing role history from ROLE_CHANGE events, which is fragile. The Cour des Comptes expects point-in-time authority evidence.
- **Suggested fix**: Add an optional actorRole String? column to AuditLog and populate it in AuditPersistenceService.log() by reading the actor's current role at write time (already available in most call sites as currentUserRole). Include it in the hash input.
- **Acceptance criteria**:
  - AuditLog Prisma model gains actorRole String? field.
  - AuditPersistenceService.log() accepts and persists actorRole.
  - All call sites that have currentUserRole pass it through.
- **Verification**: `grep -n 'actorRole\|actorEmail\|actorLabel' packages/database/prisma/schema.prisma`

#### OBS-014 — CI 'Deploy Notification' job is echo-only — provides no signal about actual production state

**🟡 nit** · `.github/workflows/ci.yml:614-627` · confidence: high · ci-cd

The CI pipeline's final 'Deploy Notification' step emits echo statements only. It does not trigger a real deployment, send a webhook, update a deployment record, or integrate with any observability system. The actual production deploy is performed manually via SSH on the VPS (documented in MEMORY.md). This means CI success gives no information about whether master has been deployed to production, and there is no automated deploy-status signal in the workflow history.

```
      - name: Notify success
        run: |
          echo "All checks passed!"
          echo "Branch: ${{ github.ref_name }}"
          echo "Commit: ${{ github.sha }}"
          echo "Status: SUCCESS"
```

- **Root cause**: Intentional design decision: deploy is manual. The CI job name ('Notify') is honest, but it contributes no observability value.
- **Impact**: Low operational impact since the manual deploy process is documented. However, the CI run history cannot be used to answer 'is this commit deployed?' — a gap for on-call operators.
- **Suggested fix**: Either: (a) remove the echo-only step to avoid misleading readers, or (b) replace it with a deployment record update (GitHub deployment API via gh api) so production state is queryable from the repo. docker-publish.yml (which does the real image push on tags) should be the signal source for 'image available for deploy'.
- **Acceptance criteria**:
  - The CI workflow either drops the misleading 'Deploy Notification' step or replaces it with a real GitHub Deployment status update.
  - docker-publish.yml push success is the canonical signal that a version is ready for manual production deployment.
- **Verification**: `grep -n 'echo\|deploy\|SSH\|push' .github/workflows/ci.yml | tail -20`
- **Notes**: docker-publish.yml is correctly wired: push: true, multi-arch, GHCR. The gap is in the CI main pipeline only.

#### OBS-006 — audit_logs table has no retention policy — append-only forever with no TTL, partition, or purge; RGPD-required retention period is undeclared

**🔵 suggestion** · `packages/database/prisma/schema.prisma:1240-1280` · confidence: medium · no-audit-retention-policy

The audit_logs table is append-only (enforced by a DB-level BEFORE UPDATE/DELETE trigger that raises an exception). There is no TTL column, no partition by date, no purge job, and no declared retention period in any configuration or documentation file. For a French government application subject to RGPD, audit logs containing personal data (actorEmail, actorLabel, entityId referencing user data) must be retained for a defined period and then purged or anonymized. An unbounded append-only table also creates operational risk: no query plan or index decay protection as the table grows.

```
model AuditLog {
  id            String   @id @default(uuid())
  action        String
  entityType    String
  entityId      String?
  actorId       String?
  actorEmail    String?
  actorLabel    String?
  payload       Json
  schemaVersion Int      @default(1)
  prevHash      String?
  rowHash       String
  createdAt     DateTime @default(now())

  @@map("audit_logs")
}
```

- **Root cause**: The audit persistence design prioritized immutability and tamper-evidence (hash chain, advisory lock, DB trigger) but did not address the retention lifecycle. RGPD's right to erasure conflicts with the immutability enforcement and requires a declared policy.
- **Impact**: Without a declared retention policy: (1) personal data in audit logs is retained indefinitely, which may conflict with RGPD Article 5(1)(e) storage limitation; (2) the table grows unbounded, degrading query performance over time; (3) there is no documented procedure for auditors to confirm compliance with a retention policy.
- **Suggested fix**: Declare a retention period (e.g., 7 years for French government HR records under the applicable archival law). Implement a scheduled purge or anonymization job that redacts actorEmail/actorLabel after the retention period while preserving the hash chain integrity (replace with a sentinel like '[RGPD-purged]'). Consider partitioning audit_logs by month for operational query performance.
- **Acceptance criteria**:
  - A retention period is declared in documentation or configuration
  - A purge/anonymization job exists for data older than the retention period
  - The purge job preserves hash chain integrity (does not break prevHash/rowHash linking)
- **Verification**: `grep -rn 'retention\|purge\|ttl\|partition' /home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/schema.prisma /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/`
- **Notes**: No retention-related keywords found anywhere in the audit module or schema. The DB trigger is confirmed (referenced in codebase comments). This is a governance requirement for French government applications, not just an operational optimization.

#### OBS-007 — predefined-tasks.service.ts — createAssignment/removeAssignment/createBulkAssignment and recurring rule CRUD produce no audit rows despite ASSIGNMENT_STATUS_CHANGED being referenced in schema comments

**🔵 suggestion** · `apps/api/src/predefined-tasks/predefined-tasks.service.ts:267-593` · confidence: medium · cluster J · predefined-task-assignment-mutations-not-audited

predefined-tasks.service.ts exposes create/update/remove for predefined task templates, createAssignment/removeAssignment/createBulkAssignment for user-task assignments, and createRecurringRule/updateRecurringRule/removeRecurringRule for scheduling rules. None of these methods import or call AuditPersistenceService or AuditAction. No AuditAction enum members exist for predefined task mutations. Assignments to predefined tasks determine who performs recurring administrative work — changes to these assignments are operationally significant.

```
  async createAssignment(assignedById: string, dto: CreateAssignmentDto) {
    // ... (no auditPersistence call)
  }

  async removeAssignment(id: string) {
    // ... (no auditPersistence call)
  }

  async createBulkAssignment(assignedById: string, dto: BulkAssignmentDto) {
    // ... (no auditPersistence call)
  }
```

- **Root cause**: Predefined tasks were not in the initial sensitive-mutation scope. The TASK_CREATED/TASK_UPDATED/TASK_DELETED actions cover project tasks (tasks.service.ts) but not predefined/recurring task templates and their assignments.
- **Impact**: Assignment changes to predefined recurring tasks (e.g., who performs a weekly recurring administrative task) leave no audit trace. This is lower severity than leave/user mutations but represents an operational governance gap for French government work scheduling.
- **Suggested fix**: Add PREDEFINED_TASK_ASSIGNMENT_CREATED and PREDEFINED_TASK_ASSIGNMENT_REMOVED to AuditAction enum. Inject AuditPersistenceService into predefined-tasks.service.ts and emit on createAssignment/removeAssignment/createBulkAssignment with actorId and targetUserId.
- **Acceptance criteria**:
  - AuditAction enum includes PREDEFINED_TASK_ASSIGNMENT_CREATED and PREDEFINED_TASK_ASSIGNMENT_REMOVED
  - predefined-tasks.service.ts emits on assignment mutations
- **Verification**: `grep -rn 'auditPersistence\|AuditAction\|PREDEFINED_TASK' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/predefined-tasks/predefined-tasks.service.ts /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/audit/audit-action.enum.ts`
- **Related**: OBS-003, OBS-004, OBS-005, OBS-010, OBS-011, OBS-012
- **Notes**: The schema.prisma comment referencing ASSIGNMENT_STATUS_CHANGED was mentioned in session context but that action is NOT in the AuditAction enum — no such enum member was found. Predefined task assignment is a suggestion-level gap, not blocking.

### Tests (9)

#### TST-001 — 5 legacy E2E specs use UI form login instead of storage-state tokens

**🟠 important** · `e2e/helpers.ts:3-12` · confidence: high · cluster N · e2e-auth-convention

Five root-level E2E specs import and call `login()` from `e2e/helpers.ts`, which navigates to `/login` and fills the form. The project convention (documented in CLAUDE.md and implemented in all `e2e/tests/` specs) is authentication via storage-state tokens extracted by `auth.setup.ts`. The UI-login path is slow, couples tests to the login-form selector, and counts against the SEC-006 rate-limit bucket (5/min), causing flakiness when specs run in parallel. The chromium project has `dependencies: ["setup"]` so the storage states ARE available; the 5 files simply never adopted the new pattern.

```
export async function login(page: Page, username = "admin", password = "admin123") {
  await page.goto("/login");
  await page.locator('input[id="login"]').fill(username);
  await page.locator('input[id="password"]').fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}
```

- **Root cause**: These are legacy files predating the `asRole()` fixture and `auth.setup.ts` storage-state convention. They were carried forward when the `chromium` project was added to `playwright.config.ts` but were never migrated.
- **Impact**: Parallel test runs hit the login rate-limit (SEC-006: 5 req/min), causing sporadic 429s and flaky test results. UI-form coupling means a selector rename breaks all 5 specs. Single-role only (always admin/admin123) so RBAC negative-path coverage is absent from these files.
- **Suggested fix**: Migrate to the storage-state pattern used in `e2e/tests/` specs: read the token from `ROLE_STORAGE_PATHS` via `getToken()`, inject as `Authorization: Bearer` header on `page.request`. Remove `e2e/helpers.ts` once all consumers are migrated. Files to update: e2e/tasks.spec.ts, e2e/projects.spec.ts, e2e/leaves.spec.ts, e2e/planning.spec.ts, e2e/full-workflow.spec.ts.
- **Acceptance criteria**:
  - No call to `login()` from `e2e/helpers.ts` remains in any spec
  - `e2e/helpers.ts` is removed or the `login()` function is removed from it
  - All 5 migrated specs pass with `pnpm run test:e2e --project=chromium` without needing `--no-deps`
  - No 429 errors observed on the auth endpoint when running all specs in parallel
- **Verification**: `grep -rn 'from.*helpers' /home/alex/Documents/REPO/ORCHESTRA/e2e/*.spec.ts`
- **Related**: TST-002, TST-003, TST-004, TST-005, TST-006, TST-007, TST-008, TST-009
- **Notes**: Affected files confirmed: e2e/tasks.spec.ts:2, e2e/projects.spec.ts:2, e2e/leaves.spec.ts:2, e2e/planning.spec.ts:2, e2e/full-workflow.spec.ts:2. clients.spec.ts already uses storage-state and is NOT affected.

#### TST-002 — school-vacations.controller.ts has no unit spec — only a service spec

**🟠 important** · `apps/api/src/school-vacations/school-vacations.controller.ts:1` · confidence: medium · cluster N · controller-coverage

`school-vacations.spec.ts` tests `SchoolVacationsService` directly (happy + negative paths). The controller wires 7 `@RequirePermissions` endpoints (create, read list, read by year, read one, update, delete, getByZone). There is no `school-vacations.controller.spec.ts`. The permission-matrix E2E (api-permissions.spec.ts) does cover all 4 CRUD actions at the HTTP level, providing a compensating layer, but the controller dispatch layer (DTO validation pipeline, guard resolution order, parameter binding) is untested at the unit level.

```
// apps/api/src/school-vacations/
// school-vacations.spec.ts  ← tests SchoolVacationsService only
// school-vacations.controller.ts  ← 7 @RequirePermissions endpoints, no controller spec
```

- **Root cause**: The spec was written as a service-only test and never had a matching controller spec created alongside it.
- **Impact**: A regression in controller-level DTO transformation, query-param binding, or guard ordering would not be caught until the slower E2E suite runs. Medium residual risk given E2E compensates for RBAC; higher for DTO/validation regressions.
- **Suggested fix**: Add `school-vacations.controller.spec.ts` following the `tasks/tasks.controller.spec.ts` pattern: mock `SchoolVacationsService`, assert delegation for each endpoint, add at least one NotFoundException path for getOne/update/delete.
- **Acceptance criteria**:
  - `apps/api/src/school-vacations/school-vacations.controller.spec.ts` exists and passes `pnpm run test`
  - Spec covers all 7 controller methods (create, findAll, findByYear, findOne, update, remove, findByZone)
  - At least one NotFoundException negative path is included
  - No new `.skip` without condition
- **Verification**: `find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/school-vacations -name '*.controller.spec.ts'`
- **Related**: TST-001, TST-003, TST-004, TST-005, TST-006, TST-007, TST-008, TST-009

#### TST-003 — projects-clients.controller.ts has no spec — controller-layer coverage gap

**🟡 nit** · `apps/api/src/clients/projects-clients.controller.ts:1` · confidence: high · cluster N · controller-coverage

`projects-clients.controller.ts` handles project↔client association with 3 `@RequirePermissions` decorators. `clients.controller.spec.ts` exists but only tests `ClientsController` (the base clients CRUD). The permission-matrix E2E covers all 3 routes at lines 659, 675, and 688. `clients.service.spec.ts` covers the service logic. This is a nit because both E2E and service-level coverage exist; only the controller dispatch layer is uncovered at unit level.

```
// apps/api/src/clients/
// clients.controller.spec.ts  ← covers ClientsController only
// projects-clients.controller.ts  ← 3 @RequirePermissions, no spec
@RequirePermissions('clients:read')       // GET /projects/:id/clients
@RequirePermissions('clients:assign_to_project') // POST /projects/:id/clients
@RequirePermissions('clients:assign_to_project') // DELETE /projects/:id/clients/:clientId
```

- **Root cause**: Sub-controllers on nested routes (projects/:id/clients) were not given their own spec when the parent clients spec was written.
- **Impact**: Low, given E2E compensates. A regression in route-parameter extraction (`:projectId`) or guard wiring would be caught by E2E but not unit tests.
- **Suggested fix**: Add a thin `projects-clients.controller.spec.ts` that mocks `ClientsService` and asserts the 3 delegation calls pass projectId/clientId correctly.
- **Acceptance criteria**:
  - `apps/api/src/clients/projects-clients.controller.spec.ts` exists
  - Covers all 3 methods with correct parameter passing assertions
- **Verification**: `find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/clients -name '*.spec.ts'`
- **Related**: TST-001, TST-002, TST-004, TST-005, TST-006, TST-007, TST-008, TST-009

#### TST-004 — 5 controller specs have happy-path delegation only — no error-path assertions

**🟡 nit** · `apps/api/src/:N/A` · confidence: high · cluster N · negative-path-coverage

In `analytics`, `clients`, `events`, `planning-export`, and `third-parties` controller specs, every test asserts that the controller returns what the service returns (happy-path delegation). None assert what happens when the service throws `NotFoundException`, `ForbiddenException`, or `BadRequestException`. These are thin delegators so the error paths are lightweight, but the absence means a regression that swallows an exception (e.g., wrapping it in a 200 response) would pass unit tests. The RBAC/authorization negative paths are covered by E2E; this gap is specifically about exception propagation in the controller layer.

For `planning-export.controller.spec.ts`: `exportIcs` uses Fastify `@Res()` injection and is never exercised in the spec at all (the mock exists but no test calls it). This is a functional coverage hole, not just a style gap.

```
// analytics.controller.spec.ts (88 lines) — 2 tests, both happy path delegation
// clients.controller.spec.ts — all tests assert service return value, none throw
// events.controller.spec.ts (297 lines) — all describe blocks happy path only
// planning-export.controller.spec.ts (39 lines) — previewImport+importIcs tested, exportIcs mocked but never called
// third-parties.controller.spec.ts — delegation only, no NotFoundException paths
```

- **Root cause**: Specs were written to verify delegation and were not extended with negative paths. The Fastify `@Res()` pattern for `exportIcs` requires a mock `FastifyReply` object, which adds boilerplate that was apparently deferred.
- **Impact**: Low for the error-path omission in thin delegators (E2E compensates). Medium for `exportIcs` specifically: a regression in the Content-Type header or Content-Disposition attachment filename would not be caught by any test.
- **Suggested fix**: For each spec: add one `it('propagates NotFoundException', ...)` test where the mock service throws and the controller test asserts the exception re-throws (no swallowing). For `planning-export.controller.spec.ts`: add a test for `exportIcs` using a mock `FastifyReply` with `header` and `send` spies and assert the Content-Type and Content-Disposition headers are set correctly.
- **Acceptance criteria**:
  - Each of the 5 controller specs has at least one negative-path test asserting exception propagation
  - `planning-export.controller.spec.ts` has a test that calls `exportIcs` and asserts `res.header('Content-Type', 'text/calendar; charset=utf-8')` and `res.header('Content-Disposition', 'attachment; filename="planning.ics"')` are called
- **Verification**: `grep -c 'throw\|rejects\|toThrow\|NotFoundException\|ForbiddenException' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/analytics/analytics.controller.spec.ts /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/events/events.controller.spec.ts /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/planning-export/planning-export.controller.spec.ts`
- **Related**: TST-001, TST-002, TST-003, TST-005, TST-006, TST-007, TST-008, TST-009

#### TST-005 — $transaction mock pattern hides prisma vs tx reference bugs

**🟡 nit** · `apps/api/src/:N/A` · confidence: medium · cluster N · prisma-mock-semantics

The standard `$transaction` mock forwards `mockPrismaService` as the `tx` callback argument. Because `tx === mockPrismaService` in the test, a production bug where the service incorrectly uses `this.prisma.*` (the outer Prisma client) instead of `tx.*` (the transaction handle) would be invisible to unit tests — both references resolve to the same mock, so the test passes. The repository mitigates this with `apps/api/src/leaves/leaves-balance-gating.int.spec.ts` and other integration specs that run against a real DB. The mitigation is real and documented, but the unit-test blind spot remains.

```
// Typical pattern in events.service.spec.ts, leaves.service.spec.ts, etc.:
$transaction: vi.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(mockPrismaService)),
// The `tx` argument forwarded IS mockPrismaService — same object reference.
// A production bug: `this.prisma.event.create(...)` instead of `tx.event.create(...)`
// would produce identical behaviour in the unit test.
```

- **Root cause**: The NestJS testing module pattern injects a single mock object; forwarding it as `tx` is the simplest correct implementation. Making `tx` a distinct object would require duplicating the mock structure.
- **Impact**: A `this.prisma.x` vs `tx.x` confusion inside a transaction callback would be silently masked in all unit specs. The integration test layer (`*.int.spec.ts`) is the actual safety net. If `pnpm test:integration` is skipped in CI, this class of bug can reach production undetected.
- **Suggested fix**: Two mitigations: (1) In any service test where transaction correctness is critical (balance updates, audit-log writes), create a separate `mockTx` object with `vi.fn()` stubs and assert the spy on `mockTx` (not `mockPrismaService`) was called — this forces a distinction. (2) Ensure `pnpm test:integration` is a required step in CI for modules that contain `$transaction` calls.
- **Acceptance criteria**:
  - For leave balance mutation paths (`leaves.service.spec.ts` balance-update tests): `$transaction` mock uses a distinct `mockTx` object and asserts calls on `mockTx`, not `mockPrismaService`
  - `pnpm test:integration` is included in the CI pipeline (`.github/workflows/`) as a required check
- **Verification**: `grep -rn '\$transaction.*cb.*mockPrisma\|mockImplementation.*cb.*mockPrisma' /home/alex/Documents/REPO/ORCHESTRA/apps/api/src/ | head -10`
- **Related**: TST-001, TST-002, TST-003, TST-004, TST-006, TST-007, TST-008, TST-009
- **Notes**: This is a known limitation of the pattern, not a newly discovered bug. The integration test harness (vitest.int.config.ts) exists precisely to cover this. Severity is nit because the mitigation exists; it becomes important only if CI skips integration tests.

#### TST-006 — rbac-escalation.spec.ts Accepts 404 as a Blocked-Access Status, Masking Missing Guards

**🟡 nit** · `e2e/tests/multi-role/rbac-escalation.spec.ts:113-120` · confidence: medium · cluster N · false-assurance

Three test cases for DELETE /api/projects/:id and PATCH /api/users/:id/role accept 404 as a valid 'blocked' response (lines 117, 136, 157, 265). The spec comment itself says '403 doit précéder la vérification d'existence' (guard must run before existence check). Accepting 404 contradicts this: if the @RequirePermissions guard were accidentally removed, the controller would look up the non-existent fake UUID and return 404 — the test would still pass, silently masking the security regression. There is also one test that accepts [400, 401, 403, 422] for POST /api/leaves (line 176), which is overly broad.

```
// Suppression de projet interdite aux contributeurs → 403 ou 401
//  vérifient d'abord le guard → 403)
expect([401, 403, 404]).toContain(response.status());

expect(response.status()).not.toBe(200);
expect(response.status()).not.toBe(204);
```

- **Root cause**: The tests use a non-existent UUID PLACEHOLDER_UUID ('00000000-0000-0000-0000-000000000001') for DELETE/PATCH endpoints. Because the resource does not exist, if the guard is ever bypassed, the handler returns 404. The [401, 403, 404] union incorrectly treats this as equivalent to a guard rejection.
- **Impact**: If @RequirePermissions is removed from DELETE /projects/:id or PATCH /users/:id/role, the corresponding tests continue to pass (404 from resource-not-found). Security regressions on these endpoints go undetected by the E2E suite.
- **Suggested fix**: Seed a real project/user ID before running these tests (or use the admin token to create one in beforeAll), then assert `expect(response.status()).toBe(403)` exactly. Alternatively use PLACEHOLDER_UUID_V4 with a seeded record so the guard is always exercised before the existence check.
- **Acceptance criteria**:
  - No test for a guard-protected endpoint accepts 404 as a valid 'access denied' status
  - DELETE /projects/:id and PATCH /users/:id/role assertions assert exactly 403
  - The test seeding strategy ensures the resource exists so guard vs not-found paths are unambiguous
- **Verification**: `grep -n '\[401, 403, 404\]\|\[400, 401, 403' /home/alex/Documents/REPO/ORCHESTRA/e2e/tests/multi-role/rbac-escalation.spec.ts`
- **Related**: TST-001, TST-002, TST-003, TST-004, TST-005, TST-007, TST-008, TST-009
- **Notes**: Lines 117, 136, 157, 176, 265 all accept broader status sets than 403. The spec file's own preamble (line 16) says '403 doit précéder la vérification d'existence' — the tests contradict their own stated intent.

#### TST-007 — @smoke Kanban Tests Can Pass Green With No Data, Masking Broken Drag-and-Drop

**🟡 nit** · `e2e/tests/kanban.spec.ts:5-29` · confidence: medium · cluster N · false-assurance

All three @smoke kanban tests contain data-guard `if (!visible) test.skip(true, ...)` blocks (lines 25, 64, 102). When the database has no TODO tasks, all three tests skip and report green. In CI, if the seed fails silently or is not run, the entire kanban smoke suite will pass as 'skipped' rather than failing. Skipped tests are counted as passed in most CI reporters.

```
test.describe("@smoke Kanban drop-zones", () => {
  test("drop is accepted on column header (full-column drop-zone)", async ({
    asRole,
  }) => {
    ...
    if (!(await todoCard.isVisible().catch(() => false))) {
      test.skip(
        true,
        "No TODO task to drag — seed the DB before running smoke",
      );
      return;
    }
```

- **Root cause**: The tests guard against missing seed data at runtime rather than asserting that seed data is present. This is a reasonable defensive pattern for non-smoke tests, but for @smoke tests it inverts the expected behavior: smoke tests should fail when the environment is missing prerequisites, not silently skip.
- **Impact**: A broken drag-and-drop feature will not be caught by CI if seed data is absent. The @smoke tag implies these tests are a build quality gate, but the skip behavior neutralizes that guarantee.
- **Suggested fix**: Either: (1) remove the @smoke tag and document these as data-dependent tests that require a seeded DB; or (2) replace the conditional skip with a hard `expect(todoCard).toBeVisible()` failure so that missing data becomes a test failure rather than a skip.
- **Acceptance criteria**:
  - Either @smoke tests never skip due to missing data (they fail instead), or the @smoke tag is removed from these tests
  - The CI pipeline treats a 'skipped' smoke test as a warning/failure, not a pass
- **Verification**: `grep -n 'test.skip\|@smoke' /home/alex/Documents/REPO/ORCHESTRA/e2e/tests/kanban.spec.ts`
- **Related**: TST-001, TST-002, TST-003, TST-004, TST-005, TST-006, TST-008, TST-009
- **Notes**: Same pattern exists in e2e/tests/multi-role/activity-grid-add-users.spec.ts (lines 79, 98, 140, 186) but those tests are not @smoke tagged.

#### TST-008 — 12 API Controllers Have No controller.spec.ts — 34% of API Surface Has No Unit Tests

**🟡 nit** · `apps/api/src/analytics/advanced/analytics-advanced.controller.ts:1` · confidence: high · cluster N · missing-coverage

12 out of 35 controllers (34%) have no corresponding controller.spec.ts. Each is compensated by integration or E2E coverage, so this is not a coverage gap in isolation, but missing unit specs means no fast feedback on DTO validation errors, guard invocation logic, or exception mapping at the controller layer. Controllers missing specs: analytics-advanced.controller.ts (6 @RequirePermissions), holidays.controller.ts (9), leave-types.controller.ts (7), metrics.controller.ts, personal-todos.controller.ts, planning.controller.ts, projects-clients.controller.ts, projects-third-party-members.controller.ts, roles.controller.ts (6, including users:manage_roles), school-vacations.controller.ts, settings.controller.ts (8 @RequirePermissions), tasks-third-party-assignees.controller.ts.

```
@Get('snapshots')
@RequirePermissions('reports:view')
@ApiOperation({ summary: 'Multi-series snapshots per project + portfolio average (blocs 1 & 2)' })
async getSnapshots(@Query() query: SnapshotsQueryDto, @CurrentUser() currentUser: AuthenticatedUser)
```

- **Root cause**: Incremental feature development without unit test coverage requirements enforced at the controller layer. Some modules (roles, settings) have higher permission complexity and would benefit most from unit specs.
- **Impact**: No direct runtime risk since E2E RBAC matrix covers all permission codes. However, controller-level regression (wrong HTTP status code, missing exception mapping, DTO validation bypass) can only be caught by slower E2E runs. Roles controller (users:manage_roles) and settings controller (8 permission codes) are the highest-priority gaps.
- **Suggested fix**: Add controller.spec.ts for at minimum: roles.controller.ts (tests assertRoleHierarchy guard path), settings.controller.ts (tests 8 permission gates), and analytics-advanced.controller.ts (tests query DTO validation). Use the tasks.controller.spec.ts as the reference pattern.
- **Acceptance criteria**:
  - roles.controller.spec.ts created with happy-path and guard-rejection tests
  - settings.controller.spec.ts created with at least CRUD happy-path tests
  - analytics-advanced.controller.spec.ts created with DTO validation tests
- **Verification**: `diff <(find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src -name '*.controller.ts' | sed 's/.controller.ts//' | sort) <(find /home/alex/Documents/REPO/ORCHESTRA/apps/api/src -name '*.controller.spec.ts' | sed 's/.controller.spec.ts//' | sort)`
- **Related**: TST-001, TST-002, TST-003, TST-004, TST-005, TST-006, TST-007, TST-009
- **Notes**: Compensating E2E coverage: analytics-advanced → e2e/tests/reports/analytics-advanced.spec.ts; RBAC matrix covers all 94 permission codes including those from controllers without specs.

#### TST-009 — 15 Web Service Test Files Have No Negative-Path Tests (Network Errors, 4xx Responses Untested)

**🟡 nit** · `apps/web/src/services/__tests__/leaves.service.test.ts:1-355` · confidence: high · cluster N · missing-coverage

15 of 16 web service test files have no negative-path tests. Only auth.service.test.ts tests error scenarios (lines 117-122: mockRejectedValue, .rejects.toThrow, network error). The other 15 files (leaves, tasks, projects, milestones, telework, time-tracking, clients, departments, leave-types, personal-todos, settings, skills, services, users, export) have zero mockRejectedValue or .rejects assertions. Since these are thin Axios wrappers, the impact is low for the wrapper logic itself, but missing error tests mean any error-handling code added later (retry logic, error normalization, toast triggers) will lack coverage.

```
// In leaves.service.test.ts — zero occurrences of mockRejectedValue, rejects, or Error
// 15 describe blocks (getAll, getByStatus, create, update, approve, reject, etc.)
// All assertions: expect(result).toEqual(...) on resolved values only
```

- **Root cause**: Service tests were written to verify the happy-path API contract (correct endpoint called, correct payload serialized) without accompanying error-path coverage.
- **Impact**: Low for current code (wrappers are simple). Higher risk if error-handling middleware or interceptors are added to the Axios client — those code paths would be entirely untested at the service layer.
- **Suggested fix**: Add at minimum one `mockRejectedValue(new AxiosError('Network Error'))` test per service to verify that errors propagate (or are normalized) correctly. Use auth.service.test.ts lines 117-122 as the reference pattern.
- **Acceptance criteria**:
  - Each web service test file has at least one mockRejectedValue test verifying error propagation
  - auth.service.test.ts error test pattern is documented as the reference
- **Verification**: `grep -rL 'mockRejectedValue\|\.rejects' /home/alex/Documents/REPO/ORCHESTRA/apps/web/src/services/__tests__/`
- **Related**: TST-001, TST-002, TST-003, TST-004, TST-005, TST-006, TST-007, TST-008
- **Notes**: Auth service is the only exception — it correctly tests invalid credentials (line 117) and network errors (line 212). The other 15 files exclusively test resolved values.

---

*Generated by the adversarial-review dynamic workflow. Source of truth: `findings.json`, `clusters.json`, `summary.json`, `agents/*.json` in this directory. All findings were adversarially refuted (re-read at `file:line`, attempt-to-disprove); blocking findings passed an additional independent refutation. Read-only audit — no source files were modified.*
