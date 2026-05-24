# PROGRESS_LOG.md — Session-by-session audit remediation log

Append a new entry at the bottom after each Claude Code session that touched the backlog.

## Schema (one entry per session)

```
## YYYY-MM-DD — <one-line session summary>

- **Session ID:** <claude-code session uuid or short timestamp>
- **Tasks closed:** <comma-separated task IDs>
- **Tasks moved to BLOCKED:** <task IDs if any, with reason>
- **Commits:** <commit SHAs>
- **Duration:** <approximate minutes>
- **Learnings (non-trivial):**
  - <bullet, optional>
  - <bullet, optional>
- **Open questions for next session:** <none / list>
```

## Entries

<!-- New entries go below this line. Most recent at the bottom. -->

## 2026-05-24 — SEC-001 closed (RBAC guard fail-closed by default)

- **Session ID:** 2026-05-24-sec-001
- **Tasks closed:** SEC-001
- **Tasks moved to BLOCKED:** none
- **Commits:** 97e2636 (in_progress anchor), 507d755 (fix), <pending> (closeout)
- **Duration:** ~25 minutes
- **Learnings (non-trivial):**
  - The audit's suggested fix is an OR (default flip OR boot-assert + docs). Implementing both is cheap and the example commit-message shape in `CLAUDE_SESSION_CONTRACT.md` ("enforce RBAC guard default + boot-assert in prod") confirms this is the intended belt-and-suspenders approach.
  - The pre-existing test file already covered the explicit-enforce path. The missing coverage was the env-unset path — which is precisely the regression vector. Always test the default branch, not just the configured branches.
  - `docker-compose.prod.yml` already sets `RBAC_GUARD_MODE: enforce`; the boot-assert hardens against any future deployment that bypasses that compose file.
  - Workflow: stayed on master (per saved "no feature branches" preference) after explicit confirmation; staged only SEC-001 files despite a dirty working tree.
- **Open questions for next session:** none


## 2026-05-24 — SEC-002 closed (horizontal scope on user update/remove)

- **Session ID:** 2026-05-24-sec-002
- **Tasks closed:** SEC-002
- **Tasks moved to BLOCKED:** none
- **Commits:** 01f6d06 (in_progress anchor), 24bbfe7 (fix), <pending> (closeout)
- **Duration:** ~35 minutes
- **Learnings (non-trivial):**
  - The audit named `AccessScopeService.assertCanManageUser` as the call site; the service existed but the method did not. Implementing the named method was treated as in-scope (it is the fix). The BLOCKED branch in the session contract was reserved for "service doesn't exist yet" — not "method on existing service doesn't exist yet."
  - `AccessUser.role` type widened to optionally carry `templateKey`, since the new ADMIN-bypass branch needs the template, not the code (institutional roles vary per collectivité; only templateKey is stable — same rationale as in `RoleHierarchyService`).
  - Existing `users.service.spec.ts` tests call `service.update(id, dto, 'ROLE')` without a 4th argument — backwards-compatible: when `caller` is undefined the scope guard is skipped, so legacy tests still pass. New tests pass a real caller to exercise the gate.
  - Acceptance criterion 4 (audit_logs) was reviewed: the listed audit-sensitive paths don't include `users:update`. Skipped intentionally; documented in `Learnings`.
  - Peer ADMIN_DELEGATED case: scope check doesn't prevent two peer ADMIN_DELEGATEDs sharing a service from editing each other. That's a hierarchy concern (vertical), not scope (horizontal); not in this audit finding. Future task if threat model justifies.
- **Open questions for next session:** Should a follow-up task add `users:update` to audit_logs (acceptance criterion 4 is broad — "audit-sensitive code")? Not required by SEC-002 wording but cheap to add to SEC-003's commit since it touches the same area.


## 2026-05-24 — SEC-003 closed (hierarchy + self-reset guard on admin password reset)

- **Session ID:** 2026-05-24-sec-003
- **Tasks closed:** SEC-003
- **Tasks moved to BLOCKED:** none
- **Commits:** b70f040 (in_progress anchor), 2763552 (fix), <pending> (closeout)
- **Duration:** ~30 minutes
- **Learnings (non-trivial):**
  - `assertCanAssignRole` alone does NOT cover self-reset: for an ADMIN caller it returns early before the rank comparison, so ADMIN-self would pass the hierarchy check. The explicit `callerId === userId` ForbiddenException is what closes the self-reset attack surface. Both gates are needed, not just one.
  - Peer-ADMIN reset (ADMIN A resets ADMIN B) is mentioned in the audit Description but the Suggested fix does NOT mandate blocking it — `assertCanAssignRole` returns OK for ADMIN→ADMIN. Stayed literal to the session contract; flagged for a follow-up like SEC-002's peer-edit note.
  - Acceptance criterion #4 (audit_logs entry) used AuditPersistenceService (durable, writes to `audit_logs` table) — not blocked by OBS-001 (which is about migrating AuditService's console-only path to durable storage). SEC-003's audit entry is durable today, independent of OBS-001's resolution. The AuditService console emit is kept in parallel for parity with AuthService.generateResetToken.
  - The audit payload deliberately excludes both the raw password and the bcrypt hash. Used `updatedAt` (auto-touched by Prisma) as a non-leaky before/after marker rather than adding a `passwordChangedAt` schema field (out of scope).
  - The `callerId` parameter on `UsersService.resetPassword` is optional to keep one legacy test green and avoid breaking any non-controller call site; the production attack surface (the controller) always provides it via `@CurrentUser('id')`. The hierarchy and self-reset gates short-circuit only when callerId is undefined — acceptable because the only entry without a caller is internal/test code.
- **Open questions for next session:** Peer-ADMIN reset (e.g., ADMIN A resets ADMIN B): not covered by SEC-003 per the literal Suggested fix scope. Worth a separate audit finding if the threat model treats peer-admin compromise as in-scope (parallels SEC-002's open peer-edit question).


## 2026-05-24 — DAT-001 closed (transactional approve/reject/cancel + durable audit)

- **Session ID:** 2026-05-24-dat-001
- **Tasks closed:** DAT-001
- **Tasks moved to BLOCKED:** none
- **Commits:** 4a30c7a (in_progress anchor), b14cdd5 (fix), <pending> (closeout)
- **Duration:** ~40 minutes
- **Learnings (non-trivial):**
  - First transactional wrap for `approve()`/`reject()`/`cancel()`: Wave 3 only landed the $tx pattern on `create()`/`update()`. The status-transition methods were never migrated. Reused the same ReadCommitted + re-read pattern literally (re-fetch inside the tx, re-assert status invariant, raise ConflictException on a concurrent transition).
  - Audit migration was a `switch` (not parallel emit). The audit's criticism is that `AuditService.log` is the ONLY persistence and is logger-only — keeping it post-fix would muddy the contract. Diverges from SEC-003's parallel-emit pattern intentionally (SEC-003 had a separate reason: parity with `AuthService.generateResetToken`). When DAT-002 dual-writes `AuditService` itself, the SecurityAudit stream visibility returns for free.
  - Audit's Suggested fix scope "Same for reject, cancel, validator changes": grep showed no separate validator-mutation code path — `validatorId` is set at create() and replaced via the approve/reject `validatedById` field. Treating "validator changes" as not-applicable is defensible and was documented in Learnings.
  - `cancel()` had NO audit emission pre-fix (only `approve`/`reject` did). Adding `LEAVE_CANCELLED` audit emission is in scope per the literal Suggested fix; it now writes audit_logs where it did not before. Defensive choice given cross-validation with Codex.
  - `selfApproved` (Wave 3 column) is reused as the discriminator — no new column. For approve(), the PENDING gate guarantees `selfApproved=false` at runtime (selfApproved=true is only written at create() when status goes directly to APPROVED), but the value is surfaced from the DB row rather than hardcoded, in case an import/seed ever breaks the invariant.
  - Test design: the `$transaction` mock is a passthrough (forwards the same client to the callback), so real rollback isn't observable in unit tests. Instead, the conflict-path test verifies the tx callback aborts before reaching update — proving atomicity at the code-flow level. The mock-injection cost was non-trivial: needed `AuditPersistenceService` in providers AND a `mockResolvedValue(undefined)` restoration in `afterEach` because `vi.resetAllMocks()` clears the implementation along with call history.
  - canValidate() calls `leave.findUnique` again — the concurrency-race test had to mock 3 sequential returns (pre-tx gate, canValidate, in-tx re-read), not 2.
  - Out-of-scope flag: `create()` line 545-553 still emits self-approval LEAVE_APPROVED through `AuditService.log` (logger-only). Same bug class but a different code path — DAT-002 territory (which migrates `AuditService` itself).
- **Open questions for next session:** When DAT-002 lands, decide whether the `create()` self-approval audit emit should also gain a parallel `AuditPersistenceService.log` call (it currently relies entirely on `AuditService.log` even post-fix here, which is logger-only until DAT-002 migrates).


## 2026-05-24 — DAT-005 closed (Float → Decimal HR/precision conversion + migrations)

- **Session ID:** 2026-05-24-dat-005
- **Tasks closed:** DAT-005
- **Tasks moved to BLOCKED:** none
- **Commits:** bc42556 (in_progress anchor), bcb7ec3 (fix + migrations + scripts + tests), <pending> (closeout)
- **Duration:** ~75 minutes
- **Learnings (non-trivial):**
  - Five Float columns audited and all converted: `TimeEntry.hours` Decimal(5,2), `Leave.days` Decimal(6,2), `LeaveBalance.totalDays` Decimal(6,2), `Task.estimatedHours` Decimal(5,2), `ProjectSnapshot.progress` Decimal(5,2). No monetary columns exist (audit's "money" hint did not apply; verified by enumerating every Float occurrence in `schema.prisma`).
  - **Two-migration pattern is load-bearing.** Backup snapshot in `20260524100000_dat005_backup_float_columns/migration.sql` runs BEFORE the conversion in `20260524100100_dat005_convert_float_to_decimal/migration.sql`. Same-migration backup + ALTER would atomically roll back the snapshot on conversion failure, defeating the safety net. Splitting them preserves the backup tables independently of whether the conversion succeeds.
  - **`Prisma.Decimal.toJSON` returns a STRING** — the silent breaking change nobody catches in TS because the HTTP layer is JSON-stringified. Fixed by overriding `Decimal.prototype.toJSON` at module load in `PrismaService` to return `.toNumber()`. Import path is `@prisma/client/runtime/library` because the `Prisma` namespace re-export from `database` tree-shakes under vitest+swc and `Prisma.Decimal` resolves to undefined at module-load time, while `Prisma.PrismaClientKnownRequestError` survives — partial namespace evaluation is the actual root cause.
  - **`number + Decimal` is silent string concat in TS** because Decimal has `.toString()`. TS only flags it indirectly via the consumer-side `number | Decimal` assignability error, not the operator itself. `tsc --noEmit` was the only reliable way to enumerate contamination sites (42 of them, fixed with `Number(...)` coercion at the Prisma read boundary).
  - **`Prisma.dmmf` is also undefined under vitest+swc** in this repo. First-pass schema test failed; rewrote using `schema.prisma` text parsing with regex. Source of truth either way and avoids bundler edge cases.
  - **Verification command divergence (documented).** BACKLOG entry's verification was `pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy && pnpm test`. Per explicit user instruction, did NOT run migrations against the dev DB. Substitute verification: full `pnpm test` (1545 passing including 12 new), plus the operator-facing `scripts/db/preflight-decimal-conversion.sh` for staging-dump precision verification before applying to prod.
  - **Acceptance criterion #4 explicitly skipped** per the user's task instructions: DAT-005 is a schema migration, not an audit-sensitive business mutation, so no `audit_logs` entry is created.
- **Open questions for next session:** Operator must run `scripts/db/preflight-decimal-conversion.sh` against a staging dump and `pnpm prisma migrate deploy` against the dev DB before merging — neither was executed in this session by design. If preflight reports lossy rows, those rows must be reconciled (rounded or rejected) before the conversion lands in prod.


## 2026-05-24 — COR-003 BLOCKED (holidays table empty — no data to consume)

- **Session ID:** 2026-05-24-cor-003
- **Tasks closed:** none
- **Tasks moved to BLOCKED:** COR-003 — `Blocked_by: holidays-data-seed-required`
- **Commits:** <pending> (blocked-state record)
- **Duration:** ~20 minutes (orientation only; no code written)
- **Learnings (non-trivial):**
  - Discovered the blocker during orientation, before touching code: `SELECT count(*) FROM holidays` = 0 on the dev DB (`orchestr-a-db`, host :5433), no rows for any year. `packages/database/prisma/seed.ts` has zero holiday references — seeding never populates the table. `HolidaysService.importFrenchHolidays` exists but has no scheduled/seed/bootstrap caller (admin-controller-on-demand only). Per the task's explicit override, an empty holidays table → BLOCKED, not implement: the day-counting fix is correct code but consumes an empty Set, so it changes nothing and cannot be demonstrated end-to-end.
  - Skipped the IN_PROGRESS anchor deliberately: the anchor exists to make in-flight code work resumable; this was a discovery-time gate before any code, so the closest contract analog is the "When the audit is wrong or outdated → set BLOCKED, flag for human" branch. Went straight to BLOCKED in a single BACKLOG+LOG commit.
  - Recorded the full design decision in COR-003's `Learnings` (option (a): optional `Set<DayKey>` param into the pure functions; rejected (b) because `splitLeaveByYear` needs per-year buckets that `countWorkingDays` can't give and the pure functions must stay sync/testable) so the next executor inherits it without re-deriving.
  - No downstream cascade: nothing has `Blocked_by: COR-003`.
- **Open questions for next session:** A new backlog item is needed BEFORE COR-003 can resume — a durable holiday-seeding mechanism (seed.ts populates via `importFrenchHolidays`, or a year-boundary cron, or a deploy-time bootstrap script). Human decision: which mechanism, and which year range to backfill (current + next at minimum). Also confirm prod's `holidays` table state — dev is empty but prod may differ; the fix's value depends on real holiday data existing wherever leaves are calculated.
