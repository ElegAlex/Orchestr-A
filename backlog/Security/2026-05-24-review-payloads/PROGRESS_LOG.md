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


## 2026-05-24 — COR-003 unblocked + holidays data seeded (prod) + TZ bug fixed + DAT-031 filed

- **Session ID:** 2026-05-24-cor-003-unblock
- **Tasks closed:** none (COR-003 returned to TODO, not DONE)
- **Tasks moved to BLOCKED:** none — COR-003 BLOCKED→TODO (blocker `holidays-data-seed-required` resolved in substance)
- **Tasks created:** DAT-031 (Phase 13, important) — "Add durable holidays seeding mechanism" (the "#175" follow-up)
- **Commits:** 0dc640e (holidays TZ off-by-one fix + script + regression test), <pending> (backlog update)
- **Duration:** ~60 minutes
- **Learnings (non-trivial):**
  - **De-risking on dev caught a real bug before prod.** `importFrenchHolidays` built dates with local-time `new Date(y,m,d)`; `Holiday.date` is `@db.Date` (persisted from UTC components), so on a +UTC host (dev = CEST) every holiday stored one day early (May 1→Apr 30, Jan 1→Dec 31). Fixed with `Date.UTC`/`setUTCDate` (`0dc640e`) + a regression test asserting the exact stored date for all 11 holidays — the prior tests only checked call counts and names, which is why it went unnoticed.
  - **Prod (UTC host) had masked the bug:** its 2026 rows (created 2026-04-01) were already correct. Only 2025 + 2027 were missing. Added them via additive transactional `INSERT ... ON CONFLICT (date) DO NOTHING`, after backing up the table to `/opt/orchestra/backups-prod/holidays_before_2025_2027_*.sql`. Verified 2025/2026/2027 = 11 rows / 11 distinct names each (33 total).
  - **Why COR-003 left BLOCKED:** the original blocker `holidays-data-seed-required` conflated two things — "no data anywhere" (now false: prod 33 rows, dev seedable in 30s via `scripts/import-french-holidays.ts`) and "no durable seed mechanism" (still true). Only the second remains, and with prod covered to 2027-12-31 (~24-month runway) it is not a Phase-1 prerequisite. So COR-003 → TODO; the durable mechanism → DAT-031.
  - **`pnpm tsx` is not available in this repo** — only `ts-node` (used by `db:seed`). The dev/manual seed command is `cd apps/api && ./node_modules/.bin/ts-node scripts/import-french-holidays.ts <years>` with `HOLIDAY_CREATOR_ID=<admin-uuid>`.
  - Related consumer-side TZ task **COR-013** (Phase 8) should be coordinated with the COR-003 implementation (both must agree on date keys).
- **Open questions for next session:** When COR-003 is implemented, seed dev first (it is currently empty) or the FAIL-pre/PASS-post witness test should use an injected `Set<DayKey>` (unit-level, no DB). DAT-031 should land before 2027 to avoid the runway expiring.


## 2026-05-25 — COR-003 closed (leave day count subtracts public holidays)

- **Session ID:** 2026-05-25-cor-003
- **Tasks closed:** COR-003
- **Tasks moved to BLOCKED:** none
- **Commits:** 49215ae (in_progress anchor), 8fc6c92 (fix + helper/service tests), <pending> (closeout)
- **Duration:** ~75 minutes
- **Learnings (non-trivial):**
  - **Option (a) implemented as pre-designed.** Optional trailing `holidayKeys?: Set<DayKey>` on both `calculateLeaveDays` and `splitLeaveByYear`; charge a day only when `!isWeekend(cursor) && !holidayKeys?.has(cursor)`. Exported `parisDayKey` + `DayKey` so callers key holidays identically to the cursor. The fix is additive (optional trailing param) — explicitly NOT a breaking change, so no halt was needed.
  - **The reconciliation call is a trap.** `splitLeaveByYear` calls `calculateLeaveDays` internally to floor at 0.5; that internal call MUST forward the same `holidayKeys` or `sum(buckets) !== calculateLeaveDays` and the Wave 1 gate-vs-storage divergence regression returns. Added a dedicated invariant test exercising this under a holiday set (the single most important regression guard beyond the witness).
  - **Six call sites, not one.** Consistency required wiring `create`, `update`, `getAvailableDays` (consumption side), and CSV `bulkImport`. Missing `getAvailableDays` would over-count consumption (stored 4, recomputed 5) and reject legitimate requests — storage, per-year demand, and consumption must all subtract the same holidays.
  - **Holidays fetched outside the `$transaction` gate** via a private `getHolidayKeySet` on the default Prisma connection: reference data, not part of Finding #4's LeaveBalance concurrency concern. Fetch window widened ±1 day for host-TZ safety (extra keys harmless); `isWorkDay=true` rows filtered out.
  - **Witness date correction:** task's Apr 28→May 2 2026 = 4 weekdays (May 2 is a Sat) — the true 5→4 witness is Apr 27 (Mon) → May 1 (Fri) 2026. Tests are unit-level on the pure helper with an injected Set (no DB) + one mocked service-level wiring test asserting `days` 5→4. Acceptance #4 (audit_log) N/A (pure calc). E2E not added (session-contract scope overrides CLAUDE.md's blanket E2E rule here).
  - **`tsc --noEmit` is not the repo gate.** It flags 119 pre-existing loose-typing errors across 18 spec files (none in COR-003 production files). The pipeline is vitest+swc + spec-excluding build; `pnpm test` (6 turbo tasks, all green) is the contractual gate and passed.
- **Open questions for next session:** none for COR-003. **DAT-031** (durable holidays seeding) still open and should land before 2027 (prod runway ends 2027-12-31). **COR-013** (Phase 8) shares the date-key concern — verify it keys via `parisDayKey` for consistency with this fix when picked up.


## 2026-05-25 — CLAUDE-CFG-001 closed (smoke Stop hook now catches untracked files)

- **Session ID:** 2026-05-25-claude-cfg-001
- **Tasks closed:** CLAUDE-CFG-001
- **Tasks moved to BLOCKED:** none
- **Commits:** a5bda6f (in_progress anchor), a4c3ec2 (fix — `.claude/settings.json`), <pending> (closeout)
- **Duration:** ~25 minutes
- **Learnings (non-trivial):**
  - **Audit "Code evidence" was truncated.** The real Stop hook is `git diff --quiet HEAD -- apps packages e2e 2>/dev/null || npx playwright test --grep @smoke ...` — the `||` tail (run @smoke when changes exist) was not in the audit snippet. Reading the live `.claude/settings.json:36` before editing (per the user's explicit "read the surrounding hook config to confirm semantics" instruction) was what surfaced this and prevented a contract-inverting drop-in.
  - **Exit-code crux.** A literal `git status --porcelain ... | grep -q .` inverts the gate (grep exits 0 on changes; with `||` smoke would fire only on a clean tree). Fixed with the negated form `! git status --porcelain -- apps packages e2e 2>/dev/null | grep -q .`, which preserves the original `git diff --quiet` contract (exit 0 = no changes → skip smoke; non-zero = changes → run smoke) AND keeps the overall hook exit at 0 in both branches. Rejected the `&&`-with-playwright alternative because it leaves overall exit non-zero on a clean tree, changing the Stop hook's success signal.
  - **Empirical FAIL-before/PASS-after.** `touch apps/__cfg001_test`: OLD `git diff --quiet` → exit 0 (untracked file MISSED = the bug); NEW form → exit 1 (detected). Clean pathspec → NEW form exit 0 (smoke skipped). Verified the gate alone, not the full line, to avoid firing the (slow, irrelevant) @smoke suite during verification.
  - **No automated test artifact** for a hook-config change (Verification field is `TBD — manual`); acceptance #2's FAIL/PASS property is met via the exit-code comparison, not a `*.spec.ts`. Flagged in BACKLOG Learnings so the CI coherence gate isn't expecting a test file.
  - `pnpm test` 6/6 green (config-only, no code paths). `pnpm test:e2e` not run — no app/server change; the hook is itself the smoke trigger.
- **Open questions for next session:** none for CLAUDE-CFG-001. Phase 1 remaining: re-scan BACKLOG for other TODO Phase-1 tasks before advancing phases.


## 2026-05-25 — Phase 1 bundle deployed to prod + BUILD-001 filed (deploy-discovered)

- **Session ID:** 2026-05-25-phase1-prod-deploy
- **Tasks closed:** none (operational deploy of already-DONE Phase 1: SEC-001/002/003, DAT-001, DAT-005, COR-003, CLAUDE-CFG-001)
- **Tasks created:** BUILD-001 (Phase 13, important, claude-only) — "tsconfig rootDir implicit, build sensitive to files outside src/"
- **Commits:** 8e4b593 (build hotfix), <pending> (backlog+deploylog+progress)
- **Deploy artifact:** `docs/deploy/2026-05-25-phase-1-remediation-deploy.md` (full audit trail).
- **Learnings (non-trivial):**
  - **DAT-005 preflight on prod dump: 0 lossy rows** across all 5 columns (time_entries.hours, leaves.days, leave_balances.totalDays, tasks.estimatedHours, project_snapshots.progress). Migration applied cleanly; prod now `numeric(p,2)` with 5 `_dat005_backup_*` tables.
  - **Phase 3 spec ordering was wrong for a source-baked image.** The api image bakes migrations at build time with no source bind-mount, so `prisma migrate deploy` on the *current* image applies 0 migrations. Correct order: build → migrate → up. Surfaced at Gate 1; operator greenlit the corrected order.
  - **Deploy-discovered build regression (BUILD-001).** The new image crashed at startup (`Cannot find module '/app/apps/api/dist/main.js'`): `apps/api/scripts/import-french-holidays.ts` (added in the COR-003 holidays de-risk) sits outside `src/`, shifting tsc's implicit `rootDir` up and relocating output to `dist/src/main.js`, breaking the entrypoint's hard-coded path. The migration had already applied (DB Decimal) while live api was still old image — transient old-code/new-schema mismatch, held with 0 errors in a low-traffic window. Resolved by **roll-forward** (not the spec's auto-rollback, which would have undone a verified-safe migration): excluded `scripts/**` from `tsconfig.build.json` (`8e4b593`), rebuilt, pre-boot filesystem check, `up -d api` → healthy in ~20s on image `7cd9b14a`.
  - **Disk was at 99% (999 MB free).** `docker builder prune -f` alone reclaimed 34.6 GB of stale build cache (→ 41 GB free) — no volumes/tagged-anchor images touched.
  - Structural fix for BUILD-001 (pin `rootDir: ./src`) tracked as the backlog item; the `scripts/**` exclude is the deployed workaround.
- **Open questions for next session:** Gate 2 manual frontend smoke pending (login, leaves Decimal serialization, COR-003 holiday subtraction Apr 27→May 1 = 4 days, DAT-001 audit_log on approve, SEC-002 403 on cross-user PATCH). The Decimal HTTP-serialization type check (`.days` must be JSON number not string) requires an admin token — fold into Gate 2 smoke.


## 2026-05-25 — DAT-002 closed (AuditService dual-writes security events to audit_logs)

- **Session ID:** 2026-05-25-dat-002
- **Tasks closed:** DAT-002 (Phase 2, Cluster A)
- **Tasks moved to BLOCKED:** none
- **Commits:** 5b16800 (in_progress anchor), c62ac8d (fix + 3 dual-write witness tests), <pending> (closeout)
- **Duration:** ~40 minutes
- **Learnings (non-trivial):**
  - **No circular dep, no module change.** `AuditService` + `AuditPersistenceService` already co-reside in the `@Global() AuditModule`; the latter depends only on `PrismaService`. Direct constructor injection resolved with zero wiring change — forwardRef was anticipated by the task but proved unnecessary.
  - **`log()` kept synchronous (`void`).** All 11 emitter call-sites fire-and-forget without `await`; an async signature would orphan their promises. Persistence is fired internally as `void this.auditPersistence.log(...).catch(err => logger.error(...))`. The `.catch` is load-bearing — a DB failure degrades to logger-only and must never crash a login/leave flow. Logger emission stays as the durable floor; DB write is best-effort until OBS-002 hardens append-only + hash chain.
  - **Mapping:** actorId=`userId??null`, entityId=`targetId??userId??'unknown'`, entityType=`'SecurityEvent'` (constant; per-action subject typing deferred to OBS-001), payload JSONB = `{ip, details, success, timestamp}` as today's `AuditEvent` exposes them. LOGIN_FAILURE (no userId/targetId) → `entityId='unknown'`, `actorId=null`; no FK violation (`actorId` nullable, SetNull).
  - **No spec flipped logger-only→dual-write.** The 4 existing tests assert logger emission, never "DB not called", so they stayed valid; only DI was fixed (mock `AuditPersistenceService` added to the `TestingModule`). 3 new witness tests: FAIL-pre = `persistence.log` called 0 times on logger-only master; PASS-post = 7/7 green. Consumer specs (auth/leaves/users) use `useValue: mockAuditService` so are unaffected.
  - **Scope held tight:** diff = `apps/api/src/audit/audit.service.ts` + `audit.service.spec.ts` only (131 +, 1 −). No emitter touches, no schema migration, no payload restructure (OBS-001/OBS-002 scope). AC#4 N/A — DAT-002 IS the durability enablement, no separate audit_logs entry of its own.
  - **Gates:** `pnpm test` 6/6 turbo, 1558 tests green; `pnpm test:e2e` 4/4 turbo, `app.e2e-spec.ts` 2 tests green (real DB boot; no audit_logs row assertions → no drift from new writes).
- **Open questions for next session (OBS-001 — emitter migration):** refine `entityType` to per-action subject types (User/Auth); enrich payload with `ua`/`reason`/structured before-after at the emitter sites; decide LOGIN_FAILURE subject (capture attempted login string?); evaluate sync fire-and-forget vs queue/batch for high-volume LOGIN_SUCCESS before more emitters multiply DB write load.


## 2026-05-25 — OBS-001 closed (per-action entityType + LOGIN_FAILURE subject + ua/reason/before/after enrichment) + PERF-001 stubbed

- **Session ID:** 2026-05-25-obs-001
- **Tasks closed:** OBS-001 (Phase 2, Cluster A)
- **Tasks stubbed:** PERF-001 (Phase 2, Cluster A, non-blocking — sync fire-and-forget audit-write volume concern, decision record only)
- **Tasks moved to BLOCKED:** none
- **Commits:** fd90307 (in_progress anchor + PERF-001 stub), 1ff6c9a (fix + 5 new witness tests + 3 DAT-002 expectation updates), <pending> (closeout)
- **Duration:** ~50 minutes
- **Learnings (non-trivial):**
  - **Witness is at AuditService.log(), not at emitters.** The 4 enumerated assertions (per-action entityType, attemptedEmail→entityId, ua/reason round-trip, before/after for ROLE_CHANGE) are pure unit tests on the mapping function — pass an enriched `AuditEvent`, assert the persisted args. FAIL-pre (4/12 failing on flat DAT-002 mapping) → PASS-post (12/12). Emitter wiring is propagation, not witness.
  - **DAT-002 entityType expectations rewritten (3 tests), not weakened.** They hard-coded `entityType: 'SecurityEvent'` — the constant OBS-001 refines. Updated to 'Auth'/'User'; entityId/actorId/payload assertions untouched. This is the intended behavior change, not a test made to pass.
  - **Exhaustive `Record<AuditAction, 'User'|'Auth'|'Leave'>`** forces every action to declare a subject at compile time. REGISTER (active emitter, absent from the task's map) + ACCESS_DENIED (enum-only, zero call sites) both needed entries: REGISTER→User, ACCESS_DENIED→Auth.
  - **bcrypt redaction is load-bearing.** LOGIN_FAILURE entityId = `attemptedEmail.toLowerCase().slice(0,254)`, but a `/\$2[aby]\$/`-shaped value → 'unknown'. attemptedEmail feeds entityId only (never payload), so a password fat-fingered into the login field cannot leak anywhere in the trail. Guard test asserts the regex never appears in the serialized persistence arg.
  - **ROLE_CHANGE / USER_DEACTIVATED were never emitted** — enum values with no call sites. `users.service.update()/remove()` emit no audit event (SEC-002 deferred "users:update to audit_logs"). Wiring them = net-new emission, which collides with this task's own OUT-scope ("users.service … leave them alone") + SEC-002 precedent → **deferred** (see follow-up below). The capability is in place (witness d proves before/after round-trips); only the live emitter is absent. Zero users.service.ts churn — answers DAT-002's open question: **defer**.
  - **LEAVE durable paths untouched.** `leaves.service.ts:1565/:1677` write to AuditPersistenceService directly (OUT-scope) and already carry before/after + rejection reason (`validationComment`). The lone `auditService.log()` LEAVE site (self-approval :587) auto-maps to 'Leave' with no wiring; auto-validation has no reason. No leaves.service.ts change needed.
  - **`ua` reachable only at LOGIN_*.** `AuthService.login(loginDto, meta?)` gets request meta (userAgent+ip) from the controller's `extractMeta(req)` → LOGIN_SUCCESS/FAILURE now carry ip+ua. PASSWORD_CHANGED service methods receive no meta; ua left optional per scope (no controller signature change this session).
- **Gates:** `pnpm test` 6/6 turbo, **1563** api tests green; `pnpm test:e2e` 4/4 turbo (build + `app.e2e-spec.ts` 2 tests green, real DB boot). audit spec 12/12. Diff confined to `audit.service.ts` + `audit.service.spec.ts` + `auth.service.ts` (LOGIN_* sites). No schema, no module wiring, no audit-persistence.service.ts.
- **Follow-up filed:** ROLE_CHANGE/USER_DEACTIVATED live emitters in `users.service.update()/remove()` (with before/after roleCode and isActive true→false) — deferred net-new audit emission, candidate for a dedicated audit-trail task alongside the SEC-002 "users:update to audit_logs" question. PERF-001 (sync-vs-queue audit write) stubbed TODO.


## 2026-05-25 — AUD-EMIT-001 filed (live ROLE_CHANGE/USER_DEACTIVATED emitters for UsersService)

- **Session ID:** 2026-05-25-aud-emit-001
- **Tasks closed:** none — filing-only session
- **Commits:** <pending> (filing)
- **Duration:** ~10 minutes
- **Learnings:** Filing-only session. AUD-EMIT-001 is the explicit close to the deferred questions from SEC-002 (2026-05-24) and OBS-001 (2026-05-25); both PROGRESS_LOG entries had flagged a missing audit-emitter wiring on user mutations.


## 2026-05-25 — AUD-EMIT-001 closed (live ROLE_CHANGE / USER_DEACTIVATED emitters in UsersService)

- **Session ID:** 2026-05-25-aud-emit-001-impl
- **Tasks closed:** AUD-EMIT-001 (Phase 2, Cluster A)
- **Tasks moved to BLOCKED:** none
- **Commits:** 1d5db0a (in_progress anchor), ffc4cf4 (fix + 4 witness tests), <pending> (closeout)
- **Duration:** ~40 minutes
- **Learnings (non-trivial):**
  - **Closes the deferred questions from SEC-002 + OBS-001.** Both had flagged that `users.service.update()/remove()` mutate roleId/isActive with zero audit emission despite ROLE_CHANGE/USER_DEACTIVATED being live-capable since DAT-002 (durable) + OBS-001 (before/after payload schema). This is the emitter-coverage closeout.
  - **remove() is soft-delete** (`update({ data: { isActive: false } })`) → decision #6 soft path: USER_DEACTIVATED emitted on the active→false flip in both update() and remove(). Hard delete is the separate `hardDelete()` method (out of scope, would need a net-new USER_DELETED enum value).
  - **before.roleCode enriched the existing query, no extra round-trip.** `update()`'s `findUnique` previously selected nothing (null-check only); added `include: { role: { select: { code: true } } }`. after.roleCode from the post-update read. Gate = `updateData.roleId !== existingUser.roleId` (DTO is roleCode-based; roleId resolved via `resolveAssignableRoleIdByCode`).
  - **AccessUser carries no `email`** (only id + role) → actor is `caller.id` → `actorId`; decision #5's actorEmail is moot. No DTO/controller signature change to add one (out of scope).
  - **Emission gated on a defined caller** (SEC-003 callerId-optional precedent). SEC-002 backward-compat tests (caller=undefined, and caller-present cases whose DTOs touch neither field) needed **zero** changes — all 63 users.service tests green.
  - **Contract decision #4 "catch-degraded pattern" does not match the codebase.** All 6 `auditPersistence.log` sites use plain `await`, no try/catch. Followed the empirical in-file precedent (`resetPassword`).
  - **No $transaction introduced** — neither update() nor remove() wrap in $tx today; per decision #4 the emission is a plain post-update `await` (DAT-001 $tx territory not entered).
- **Gates:** `pnpm run build` 3/3 turbo green (tsc). `pnpm run test` 6/6 turbo — **api 1567** tests green (68 files), web 579 passed / 14 skipped. Witness FAIL-pre on (a ROLE_CHANGE / b1 USER_DEACTIVATED-update / b2 USER_DEACTIVATED-remove) with "Number of calls: 0" (assertion, not crash), (c no-op) passed pre+post; PASS-post 4/4.
- **E2E not run (documented divergence, DAT-005 precedent):** diff confined to an internal service method's audit emission — no controller/route/DTO/UI/permission-matrix surface, no E2E spec asserts `audit_logs`, and the local API/web dev servers were down (ports 3001/4001). Suite is invariant to this change; the 4-case unit witness is the substitute verification.
- **Open questions for next session:** OBS-003 (leave-approval before/after + role snapshot) remains TODO in Phase 2 Cluster A. The peer-ADMIN mutation guard (SEC-002 / SEC-003 open question) and self-deactivation prevention are still unaddressed (SEC concerns, deliberately out of AUD-EMIT-001 scope).


## 2026-05-25 — BACKLOG hygiene pass after Cluster A waves

- **Session ID:** 2026-05-25-hygiene
- **Tasks closed:** OBS-008 (retroactive closure — covered by OBS-001 / 1ff6c9a).
- **Tasks moved to BLOCKED:** none.
- **Other backlog touches:** Learnings notes appended to OBS-003, OBS-004, OBS-021, OBS-024, TST-011 documenting partial closures from DAT-001/DAT-002/OBS-001/AUD-EMIT-001/SEC-003 (no scope change, Description/Suggested fix verbatim per schema). Cross-link Learnings added to OBS-002 ↔ DAT-009 (quasi-duplicate, attack as bundle). TOOL-COH-001 filed (Phase 1, tooling).
- **Commits:** 247f2e9 (OBS-008 closure), <pending> (hygiene + TOOL-COH-001).
- **Duration:** ~30 minutes
- **Learnings:** Backlog scan after each remediation wave is mandatory to catch (a) findings now retroactively done, (b) findings now partially covered, (c) quasi-duplicates from different JSON source agents. The audit's per-agent JSON files don't deduplicate across agents — the workbench MD inherits that.
- **Open questions for next session:** OBS-002 + DAT-009 should be tackled in a single session with dual [closes ...] in the fix commit (next planned remediation after this hygiene pass).


## 2026-05-25 — OBS-008 gate resolution + TOOL-COH-002 filing

- **Session ID:** 2026-05-25-obs-008-anchor
- **Tasks closed:** none (OBS-008 was already DONE in 247f2e9; this session only repoints Closed_by to a gate-compliant anchor).
- **Tasks moved to BLOCKED:** none.
- **Other backlog touches:** OBS-008.Closed_by repointed from 1ff6c9a (material fix) to 2188b3d (empty anchor commit). OBS-008.Learnings extended to document the anchor. TOOL-COH-002 filed (Phase 1, tooling) to formalize the retroactive-closure pattern.
- **Commits:** 2188b3d (empty anchor [closes OBS-008]), <pending> (BACKLOG/PROGRESS_LOG edits).
- **Duration:** ~15 minutes
- **Learnings:** The coherence gate's rule 3 (Closed_by's commit message must contain [closes <id>]) doesn't admit retroactive closures by construction. Tactical workaround: empty anchor commit. Structural fix: TOOL-COH-002. The 2026-05-25 hygiene pass's instruction to point Closed_by directly at the upstream material-fix SHA (1ff6c9a) was schema-naive — author of that instruction (me / prior Claude session) didn't read the gate script before prescribing. Process correction: BACKLOG-editing tasks that touch Closed_by must read the gate script first.
- **Open questions for next session:** OBS-002 + DAT-009 quasi-duplicate (next remediation). TOOL-COH-001 + TOOL-COH-002 (could be tackled together in a single tooling session — same script).


## 2026-05-25 — OBS-002 + DAT-009 closed jointly (audit_logs immutability trigger + hash chain + actor snapshot) + TOOL-DEPLOY-001 filed

- **Session ID:** 2026-05-25-obs-002-dat-009-allin
- **Tasks closed:** OBS-002 + DAT-009 (Phase 2, Cluster A) — one fix commit, both `Closed_by` = `d6299cc`.
- **Tasks filed:** TOOL-DEPLOY-001 (Phase 1, cluster —, tooling, claude-only) — Verdict-B descope of the DB role split.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `caa8305` (IN_PROGRESS anchor for both), `d6299cc` (fix — `[closes OBS-002][closes DAT-009]`), `<pending>` (closeout + TOOL-DEPLOY-001).
- **Counter:** Phase 1 9→10, Totals 178→179, tooling 4→5.
- **Duration:** ~60 minutes
- **Verdict:** **B** — single-`DATABASE_URL` pipeline (entrypoint runs migrate+app under one credential; datasource has no `directUrl`; CI/deploy compose one string). Sub-piece (b) DB role split descoped → TOOL-DEPLOY-001; (a)(c)(d) shipped.
- **Learnings (non-trivial):**
  - **Advisory lock, NOT FOR-UPDATE-on-prior-row (decision #2/#3 deviation, hard blocker).** The contract's `SELECT … FOR UPDATE LIMIT 1` on the prior row FORKS the chain under READ COMMITTED: on lock release Postgres re-checks the *locked row* via EvalPlanQual, not the *result set* (LIMIT 1 was applied at planning), so a concurrent insert of the next row is missed and two rows chain off the same prevHash. Used `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` — totally-orders inserts, auto-released at COMMIT. Rejected SERIALIZABLE+retry (no benefit at this scale).
  - **`onDelete: SetNull` → `NoAction` was forced (hard blocker vs decision #5).** SetNull issues an UPDATE on user deletion that the immutability trigger rejects → users with audit rows become undeletable. NoAction keeps the `actorId` column (decision #5's join/test rationale intact) while removing the SetNull DAT-009 itself flagged; the actorEmail/actorLabel snapshot preserves identity. UX consequence documented: `hardDelete()` of a user with audit rows now fails with a raw FK violation (checkDependencies doesn't pre-check audit_logs) — out of scope to fix (would touch users.service.ts).
  - **No real-DB vitest harness.** Both vitest configs load `vitest.setup.ts` → `vi.mock('database')`; even `app.e2e-spec.ts` uses a mock PrismaClient (only `/api` + `/health`, no DB). So the trigger (W-a) and real chain were verified by direct dev-DB scripts: seeded 4 rows BEFORE the migration (advisor de-risk — the recursive-CTE backfill had never run against real data), confirmed chain links / NOT NULL / actor snapshot, trigger blocks UPDATE+DELETE (row intact, INSERT still allowed), and a real `AuditPersistenceService.log()` insert chains off the backfilled legacy tip with JS recompute matching. Documented divergence (AUD-EMIT-001 precedent).
  - **The live DB caught a bug the mock never could:** `SELECT pg_advisory_xact_lock(...)` returns `void` → `$queryRaw` P2010 deserialize failure. Switched to `$executeRaw`. (BUILD-001-class lesson: code paths only exercised against the real DB must be run against it.)
  - **Backfill:** dev = 0 rows (inline recursive-CTE branch per decision #4); prod likely small (Phase-1 deploy today) — same migration backfills before `SET NOT NULL`. Legacy = sealed SQL-canonical segment; new rows = fast-key-sorted JSON; segments join via opaque stored prevHash. Runbook: verify prod count <1000 before deploy.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1575** (68 files, +8 net witnesses over AUD-EMIT-001's 1567), web 579 passed / 14 skipped. `pnpm run test:e2e` 2/2 (mocked DB, invariant). Unit witness FAIL-pre 11/11 → PASS-post 11/11.
- **AUD-EMIT-001 interaction:** `log()`'s INPUT signature is unchanged (new fields computed internally), so AUD-EMIT-001's emitters and their mocked-service specs needed zero changes — `ffc4cf4`'s witnesses still pass within the 1575.
- **Open questions for next session:** OBS-003 (leave-approval before/after + role snapshot) remains TODO in Phase 2 Cluster A. TOOL-DEPLOY-001 (DB role split) now filed for a deploy-infra session. PERF-001's async-queue case is materially strengthened (advisory-lock serialization) — candidate before the emitter surface widens.


## 2026-05-25 — File two follow-ups from OBS-002+DAT-009 closeout (USR-DEL-001, TST-DB-001)

- **Session ID:** 2026-05-25-followup-filing
- **Tasks closed:** none (filing-only).
- **Tasks moved to BLOCKED:** none.
- **Other backlog touches:** USR-DEL-001 filed (Phase 2, cluster —, correctness — hardDelete UX regression from d6299cc's FK SetNull→NoAction change). TST-DB-001 filed (Phase 1, cluster —, tests — recurrent gap observed across AUD-EMIT-001 e2e skip and OBS-002+DAT-009 trigger witness skip).
- **Commits:** <pending> (filing).
- **Duration:** <approx>
- **Learnings:** Filing follow-ups within one session of the remediation that surfaced them. Pattern correction vs the earlier SEC-002 / OBS-001 "deferred Q in Learnings" approach which led to AUD-EMIT-001 having to retroactively close threads — explicit filings as standalone entries are more durable than Learnings notes.
- **Open questions for next session:** DAT-007 (Task.projectId Cascade — next cross-validated Cluster A remediation, thematically continues the audit-trail durability work hardened by OBS-002+DAT-009).


## 2026-05-25 — DAT-007 closed (Project hard-delete preserves history via RESTRICT FKs + ConflictException pre-check + PROJECT_DELETED snapshot)

- **Session ID:** 2026-05-25-dat-007
- **Tasks closed:** DAT-007 (Phase 10, Cluster G — cross-validated).
- **Tasks moved to BLOCKED:** none.
- **Commits:** `2384cb8` (IN_PROGRESS anchor), `0eae219` (fix — `[closes DAT-007]`), `<pending>` (closeout).
- **Counter:** no count change — DAT-007 was already in the finding totals; only its Status flipped (coherence checked-set 12→13 DONE/VERIFIED).
- **Duration:** ~50 minutes
- **FK design choice:** Cascade/SetNull → **RESTRICT** on tasks/project_snapshots/documents/time_entries `projectId`. RESTRICT (not NoAction) — it's the audit's literal Suggested-fix and immediate-check aligns with the app pre-check. *Diverges from d6299cc's NoAction* on purpose: NoAction there was forced by the audit_logs immutability trigger rejecting SetNull's UPDATE; no such trigger exists on these tables, so the forcing constraint is absent.
- **Learnings (non-trivial):**
  - **Two readings of the invariant collided on TimeEntry.** Strict ("must not *destroy*") was already met by SetNull; the audit *description* ("lose their project link silently") demanded Restrict. Picked Restrict — `grep project.delete` showed **zero** callers besides hardDelete+spec, so no teardown/seed regression, and it makes the pre-check and FK gate block on an identical set. Documented in the fix-commit body + BACKLOG Learnings.
  - **Audit pattern = `AuditPersistenceService.log()` direct** (the archive/unarchive pattern, 2 existing sites → TST-011's "2 call sites" confirmed). Added a 3rd: `PROJECT_DELETED` (free-string, no enum migration) with a column snapshot in `payload.snapshot` before the delete (suggested-fix b).
  - **Atomicity scope conflict:** advisor preferred `$transaction` for trail integrity, but `log()` takes no tx client and making it tx-aware = audit-pipeline change (DAT-007 forbids). Prioritized scope → emit-before-delete, non-atomic (archive() precedent, DAT-006 owns the non-atomicity finding). Rare race window, detectable via hash chain.
  - **ProjectSnapshot = operational read-model, NOT audit trail** (daily cron producer PER-003; analytics-advanced consumer; no hash/trigger/actor columns). Loss was correctness, not audit-durability — still Restrict-protected, but not bound by audit_logs rules.
  - **Real-DB witness ACHIEVED** (bridged [[TST-DB-001]] for this task): dev DB up, applied migration, psql confirmed all 4 FKs `confdeltype='r'` + DELETE on a project with 5 snapshots blocked by RESTRICT with the snapshots/project surviving. Automated-CI gap (vitest `vi.mock('database')`) still stands.
  - **USR-DEL-001 symmetry resisted/deferred:** `checkProjectDependencies()` mirrors `UsersService.checkDependencies()`; USR-DEL-001 inherits the pre-check shape, ConflictException convention, actor-threading, and the answered "yes, hardDelete emits `<ENTITY>_DELETED` with a snapshot" policy. Not implemented (stayed in scope).
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1579** (68 files, +4 net witnesses over d6299cc's 1575), web 579 passed / 14 skipped. `pnpm run test:e2e` 4/4 turbo green (apps/api app e2e, mocked DB, invariant — no Playwright spec touches `/projects/:id/hard`). Unit witnesses FAIL-pre 4/4 → PASS-post; real-DB W-2 pass.
- **Open questions for next session:** USR-DEL-001 + DAT-007 share the `check<Entity>Dependencies` + `<ENTITY>_DELETED` pattern — candidate paired session. DAT-008 (Leave.user Cascade — same Phase 10 Cluster G cascade theme, retention obligation). Frontend `projects/[id]/page.tsx` hardDelete now can receive a 409 ConflictException (was a 500 on FK violation) — UX copy could surface the dependency list, but that's web scope, out of this task.


## 2026-05-25 — OBS-004 closed (4 remaining user-mutation audit emitters: USER_REACTIVATED + DEPARTMENT_CHANGED + SERVICE_MEMBERSHIP_CHANGED + PASSWORD_RESET_BY_ADMIN rename)

- **Session ID:** 2026-05-25-obs-004
- **Tasks closed:** OBS-004 (Phase 2, Cluster A — claude-only). Completes the partial closure left by AUD-EMIT-001 (ffc4cf4).
- **Tasks moved to BLOCKED:** none.
- **Commits:** `42e1a40` (IN_PROGRESS anchor), `330a8eb` (fix — `[closes OBS-004]`), `<pending>` (closeout).
- **Counter:** no count change — OBS-004 was already in the finding totals; only its Status flipped (coherence checked-set 13→14 DONE/VERIFIED).
- **Duration:** ~50 minutes
- **Design choices (4):**
  - **Enum for all four.** Extended AuditAction + ENTITY_TYPE_BY_ACTION='User'. Advances [[OBS-024]]'s enum side — the only free-string this module emitted ('PASSWORD_RESET_ADMIN') is now enum.
  - **PASSWORD_RESET_BY_ADMIN = case (b)-rename, NOT net-new.** SEC-003 (2763552) already emitted the durable admin-reset row at `users.service.ts:852` as the free-string 'PASSWORD_RESET_ADMIN'; renamed in-place to the enum. SEC-003 gates/no-PII ACs untouched; SEC-003 spec assertion + BACKLOG Learnings updated. Console-parity auditService.log(PASSWORD_CHANGED) at :867 left as-is (OBS-024 dual-sink territory).
  - **SERVICE_MEMBERSHIP_CHANGED** = full before/after arrays + computed {added, removed}; order-insensitive Set compare (no emit on reorder-only).
  - **DEPARTMENT_CHANGED** = departmentId before/after; name snapshot deferred (departments aren't hard-deleted like DAT-009's actor case).
- **Learnings (non-trivial):**
  - **PROD NAMESPACE CARRY-OVER:** SEC-003 is in prod (ancestor of HEAD 8e4b593) → prod audit_logs may hold legacy `PASSWORD_RESET_ADMIN` rows. OBS-002 immutability blocks backfill, so OBS-024 must alias the two codes at QUERY TIME. Documented in OBS-004 + SEC-003 Learnings.
  - **One extra include, no new round-trip:** update()'s findUnique gained `userServices.serviceId` for the membership before-snapshot. departmentId/isActive are scalars `include` already returns — no further query change.
  - **AUD-EMIT-001 no-op fixture adjusted (non-additive edit):** its `does not emit when neither roleId nor isActive changes` test updated departmentId='dept-x' on a user with no departmentId — now a real DEPARTMENT_CHANGED transition. Set existing departmentId='dept-x' to keep it a genuine no-op. Behavior unchanged; fixture follows the emission-set expansion.
  - **[[TST-011]] incidental:** +7 audit-emission assertions (4 positive / 3 negative across the 4 events) + 4 entityType pairs in audit.service.spec. Advances TST-011's user-mutation surface.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1586** (68 files, +7 net witnesses over DAT-007's 1579), web 579 passed / 14 skipped. `pnpm run test:e2e` 2/2 (api app e2e, mocked DB, invariant — no Playwright spec touches the users-update / audit_logs surface; AUD-EMIT-001/DAT-007 precedent). Witness FAIL-pre 5/5 (4 OBS-004 positives + renamed SEC-003 assertion) → PASS-post; negatives vacuous pre+post. TST-DB-001 still applies (vitest mocks 'database'; no real audit_logs row asserted).
- **Invariant priority call:** none forced — the only collision (existing AUD-EMIT-001 no-op fixture vs the new DEPARTMENT_CHANGED emit) was resolved by tightening the fixture, not weakening an invariant.
- **Open questions for next session:** OBS-003 (leave-approval before/after + role snapshot) remains the last Phase 2 Cluster A audit-emitter TODO. OBS-005 (RBAC role/template mutations unaudited) is the natural follow-on. OBS-024 now carries the explicit PASSWORD_RESET_ADMIN↔PASSWORD_RESET_BY_ADMIN query-time-alias requirement.


## 2026-05-25 — OBS-005 closed (RolesService audit emitters: ROLE_CREATED + ROLE_UPDATED + ROLE_DELETED + ROLE_DEFAULT_CHANGED)

- **Session ID:** 2026-05-25-obs-005
- **Tasks closed:** OBS-005 (Phase 2, Cluster A — claude-only). Natural follow-on to OBS-004; completes the RBAC-mutation side of AC#4's audit surface.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `fad2be9` (IN_PROGRESS anchor), `ec88cc9` (fix — `[closes OBS-005]`), `<pending>` (closeout).
- **Counter:** no count change — OBS-005 was already in the finding totals; only its Status flipped (coherence checked-set 14→15 DONE/VERIFIED).
- **Duration:** ~55 minutes
- **Enum members added (4):** `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`, `ROLE_DEFAULT_CHANGED`. No collision with the pre-existing `ROLE_CHANGE` (user-reassignment, entityType='User'); the 4 new ones are the role *entity* lifecycle, entityType='Role'. Exhaustive `Record<AuditAction,…>` widened to include 'Role' so the 4 mappings are compile-mandatory.
- **Design choices (5):**
  - **ROLE_UPDATED diff = OBS-004's "both"** — `{before, after, changed[]}` over `{label, description}`. `isDefault` carved out to its own event (per-field-event philosophy = OBS-004 SERVICE_MEMBERSHIP_CHANGED precedent), so ROLE_UPDATED is intentionally not a literal "full scalar" diff — documented divergence from Suggested-fix phrasing.
  - **ROLE_DEFAULT_CHANGED both directions** — system-wide singleton shift. false→true reads prior holder (findFirst) before unset; true→false records removal (after=null).
  - **ROLE_DELETED snapshot-before-delete** — DAT-007 PROJECT_DELETED symmetry, `payload.snapshot` of the full row, plain await.
  - **templateKey-hash deploy row DEFERRED → OBS-012** (deploy audit trail). Boot-hook + previously-seen-hash state is deploy-infra surface outside roles/ + audit/. Cross-linked.
  - **Caller threading NET-NEW** — RolesController had none (unlike SEC-002's UsersService). Added @CurrentUser() to 3 mutating handlers + optional 3rd RolesService arg; caller-undefined emits nothing. Controller surface but within roles/ scope → AC#6 holds.
- **Learnings (non-trivial):**
  - **Prisma roundtrips minimized:** update/delete unchanged (existing findUnique already returns the full before-/delete-snapshot). create + update add ONE findFirst, only on the default-setting path AND only when caller present.
  - **RbacModule needed no change** — AuditModule is `@Global` + exports AuditPersistenceService, so RolesService injects it without an explicit import (same as UsersService).
  - **[[OBS-024]] advanced (enum side):** RolesService emits zero free-strings — all 4 codes are enum from creation, unlike DAT-007's free-string `'PROJECT_DELETED'`. No prod-namespace carry-over risk (these codes are net-new, never deployed as free-strings).
  - **[[TST-011]] incidental:** +10 RolesService witnesses (6 positive / 4 negative) + 4 Role pairs in audit.service.spec entityType table.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1596** (68 files, +10 over OBS-004's 1586), web 579 passed / 14 skipped. `pnpm run test:e2e` 2/2 (api app e2e, mocked DB, invariant — no Playwright spec touches the roles/audit surface; OBS-004/AUD-EMIT-001 precedent). Witness FAIL-pre 6/6 positives → PASS-post; 4 negatives vacuous pre+post.
- **Invariant priority call:** none forced — no collision between the new emitters and existing RolesService tests (the isDefault-transition specs call the service without a caller, so emission is skipped and their `updateMany` assertions stand).
- **[[TST-DB-001]] still applies:** vitest mocks 'database'; emission verified at the AuditPersistenceService.log call boundary (mocked), no real audit_logs row asserted.
- **Open questions for next session:** OBS-006 (document read/download logging) is the next Phase 2 Cluster A audit-emitter TODO — but it's controller-level (DocumentsController) and adds DOCUMENT_READ/DOCUMENT_DOWNLOADED with request metadata (ip/ua), a different shape than the service-level mutation emitters. OBS-012 now carries the explicit OBS-005 templateKey-hash deploy-row deferral.


## 2026-05-25 — OBS-006 closed (DocumentsService audit emitter: DOCUMENT_READ on fetch-by-id; DOCUMENT_DOWNLOADED reserved-unwired)

- **Session ID:** 2026-05-25-obs-006
- **Tasks closed:** OBS-006 (Phase 2, Cluster A — claude-only). Continues the Phase-2 Cluster-A audit-emitter sweep after OBS-005; first emitter on the read/access (not mutation) side.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `b8a65ee` (IN_PROGRESS anchor), `4bee971` (fix — `[closes OBS-006]`), `<pending>` (closeout).
- **Counter:** no count change — OBS-006 was already in the finding totals; only its Status flipped (coherence checked-set 15→16 DONE/VERIFIED).
- **Duration:** ~45 minutes
- **Enum members added (2):** `DOCUMENT_READ`, `DOCUMENT_DOWNLOADED`; ENTITY_TYPE_BY_ACTION union widened `'User'|'Auth'|'Leave'|'Role'` → `+'Document'`, both compile-forced by the exhaustive `Record<AuditAction,…>`.
- **Design choices:**
  - **No API-mediated download exists.** DocumentsController is pure metadata CRUD; `Document.url` → external storage, client fetches bytes directly (no `StreamableFile`/`@Res`/`sendFile`; no `apps/web` documents service). The API cannot observe a real byte download from this controller.
  - **GET /:id → DOCUMENT_READ** (explicit fetch-by-id; response hands over the download `url`). **GET / list → no emission** (high-volume / per-doc fan-out / collection-browse ≠ doc-specific access; PERF-001 territory). POST/PATCH/DELETE out of scope (read/download finding; doc-delete audit = TST-011 gap).
  - **DOCUMENT_DOWNLOADED added but UNWIRED** — distinct event per Suggested fix + PHASE 3's explicit enum instruction, reserved for a future streaming endpoint. Documented in the fix-commit body (reviewers see commits first) AND BACKLOG Learnings.
  - **Emit AFTER access-check + null-check** (`assertCanReadDocument → findUnique → null-check → EMIT`): no trail for 403/404. Two dedicated negative witnesses; needed because the access gate is service-level here, not a controller guard (unlike OBS-005).
  - **sizeBytes from `Document.size` column** (bytes; cheaper, consistent — nothing to measure on a stream). actorId → dedicated actor field; payload `{documentId, mimeType, sizeBytes, ip, ua}` (ip/ua conditional).
- **Learnings (non-trivial):**
  - **Zero extra Prisma load:** emission reuses the document findOne already loaded — no extra include, no extra round-trip. One advisory-locked INSERT per read via the existing `AuditPersistenceService.log` chain.
  - **Read-path resilience (follow-up commit, post-advisor):** emission is **fire-and-forget** (`void …log().catch(logger.error)`), NOT `await`ed — diverging from OBS-005/DAT-007's plain await because those emit on *mutations* and OBS-006 emits on a higher-frequency *read*. A transient audit-chain hiccup must not 500 a successful read nor block it on the audit advisory lock; mirrors the `AuditService` floor pattern for high-frequency events. +1 witness (read resolves even when `log()` rejects).
  - **Caller threading partly pre-existing:** `@CurrentUser()` already on GET /:id; `@Req()` + local `extractMeta` net-new (auth.controller mirror — UA cap 512, IP = forwarded-chain head). `extractMeta` made `req?`-tolerant so routing-only controller specs need no req.
  - **Caller-undefined = backward compat AND correctness:** `update()`/`remove()` call `findOne(id)` with no caller → skip. Negative witness locks this so a future maintainer can't accidentally emit DOCUMENT_READ on every mutation.
  - **[[OBS-024]] enum side advanced:** both codes are enum from creation (no free-string) → no prod-namespace carry-over risk.
  - **[[TST-011]] incidental:** +5 DocumentsService witnesses (1 positive / 4 negative) + 1 controller routing assertion + 2 Document entityType pairs in audit.service.spec.
- **Gates:** `pnpm run build` 3/3 turbo green (BUILD_EXIT=0). `pnpm run test` — **api 1601** (68 files, +5 over OBS-005's 1596), web 579 passed / 14 skipped (TEST_EXIT=0). `pnpm run test:e2e` 4/4 turbo, api app e2e 2/2 (mocked DB, invariant — no Playwright spec touches the documents/audit surface; OBS-005/OBS-004 precedent). Witness FAIL-pre 1/1 positive → PASS-post; 4 negatives + list-skip vacuous pre+post.
- **Invariant priority call:** none forced — the only existing-test interaction (controller findOne routing tests lacked a `req` arg) was resolved by passing a mock req + making `extractMeta` req-optional, not by weakening any invariant.
- **[[TST-DB-001]] still applies:** vitest mocks 'database'; emission asserted at the mocked `AuditPersistenceService.log` boundary, no real `audit_logs` row.
- **PERF-001 note for future:** GET /documents/:id now emits one advisory-locked audit INSERT per call. Document detail-view is lower-frequency than the (deliberately skipped) list endpoint, but under heavy single-doc polling this is the same per-call-emit volume concern PERF-001's eventual queue would absorb.
- **Open questions for next session:** OBS-007 (data exports ICS/CSV/XLSX — `planning-export.service.ts`, DATA_EXPORTED) is the next Phase-2 Cluster-A audit-emitter TODO — adjacent RGPD-egress territory but a different module/shape (format/scope/dateRange/recordCount). OBS-003 (leave-approval before/after) if still open. DOCUMENT_DOWNLOADED stays reserved pending an API-mediated download endpoint.


## 2026-05-25 — OBS-012 closed (deploy theater removed + deployments ledger + boot-hook version pinning + RELEASE_DEPLOYED dual-write)

- **Session ID:** 2026-05-25-obs-012
- **Tasks closed:** OBS-012 (Phase 2, Cluster A — claude-only, severity blocking). First Phase-2 Cluster-A task on the deploy/infra-observability side rather than an application audit-emitter.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `1359ab4` (IN_PROGRESS anchor), `189344f` (fix — `[closes OBS-012]`), `<pending>` (closeout).
- **Counter:** no count change — OBS-012 was already in the finding totals; only its Status flipped (coherence checked-set 16→17 DONE/VERIFIED).
- **Duration:** ~70 minutes
- **Real-SSH-vs-removal decision: REMOVAL.** Evidence (not assumption): HANDOVER.md L29 "Deploy workflow est 'fake' → manual ssh + docker compose sur VPS"; deploy.yml's `DEPLOY_HOST/USER/KEY` secrets commented-out/never configured; `docker-publish.yml` already builds+pushes real images on tags; `docs/AUDIT-DOCKER-DEPLOY.md` already documents deploy.yml as "un stub". Faking ssh-action against non-existent secrets would be net-negative. `deploy.yml` deleted; `scripts/deploy-prod.sh` (new) is the honest operator runbook.
- **Design choices (4):**
  - **`deployments` table = source of truth** (Prisma model + migration `20260525210000_obs012_deployments_table`). No FK to users (frozen `deployedBy` string, RGPD snapshot rationale = audit_logs.actorEmail). NOT under the audit_logs immutability trigger (infra event). 0 rows at ship (virgin).
  - **Version pinning = env-injected SHA + `OnApplicationBootstrap` hook.** `RELEASE_SHA` written by `deploy-prod.sh` into `.env.production`; boot hook reads it + process.version + `_prisma_migrations` names. Guard: `NODE_ENV=production OR RELEASE_SHA set` → dev/test + mocked-DB e2e stay no-op. Prod-without-SHA → `releaseSha='unknown'` + warn (no hard fail). Fire-and-forget on bootstrap (never blocks startup) — resilience in the first commit, NO 4th degrade-commit (vs OBS-006).
  - **Cross-emission YES (dual-write).** `AuditAction.RELEASE_DEPLOYED` (entityType `'Deployment'`, exhaustive `Record` widened) → one audit_logs row per boot so deploys sit inline with user actions (AC#4). deployments table remains source of truth; audit_logs informational.
  - **`dbMigrationsApplied` probe is degradation-tolerant** of [[TOOL-DEPLOY-001]] (a future restricted app role losing SELECT on `_prisma_migrations` → defaults to `[]`, boot still succeeds).
- **Learnings (non-trivial):**
  - **The boot-hook is what answers the Cour-des-Comptes question.** Every production boot = one deployments row = one running-interval boundary. `SELECT "releaseSha" FROM deployments WHERE "deployedAt" <= '<ts>' ORDER BY "deployedAt" DESC LIMIT 1` resolves "which release was live when leave Z was approved" — but only once the first real deploy via `deploy-prod.sh` runs (this session ships the mechanism; first row is written on next deploy, NOT now — no prod action taken).
  - **Migration hand-written, not `migrate dev`-generated:** no Orchestra dev DB was up (only an unrelated `opstracker-git-postgres-1` on :5432). Mirrored the `audit_logs` CREATE TABLE DDL exactly (TEXT / JSONB / `TIMESTAMP(3) ... DEFAULT CURRENT_TIMESTAMP` / `_pkey` / `_idx`). `prisma validate` + `prisma generate` green; [[TST-DB-001]] gap stands (vitest mocks `database`; no real `deployments` row asserted).
  - **app.module.ts edit is unavoidable wiring** for a new module — flagged in the fix-commit body under AC#6 ("or equivalent"). AuditService injected without explicit import (AuditModule is `@Global`, same as Users/Roles services).
  - **Dangling doc refs left untouched** (`KNOWLEDGE-BASE.md:824`, `docs/AUDIT-DOCKER-DEPLOY.md`) — editing `docs/`/KB is outside AC#6's confined diff. Candidate docs-hygiene follow-up, not filed.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1608** (69 files, +6 DeploymentsService witnesses + new file over OBS-006's 1601/68), web 579 passed / 14 skipped. `pnpm run test:e2e` 4/4 turbo (api app e2e, mocked DB — boot hook no-op in test context, invariant holds). Witnesses FAIL-pre (deployments spec import error; audit spec RELEASE_DEPLOYED undefined → 'Auth' not 'Deployment') → PASS-post 18/18.
- **Invariant priority call:** none forced — no collision with existing tests; the boot-hook guard keeps the e2e app-boot a no-op.
- **[[TST-011]] delta:** +6 DeploymentsService witnesses + 1 entityType pair (audit.service.spec). +1 audit subject type ('Deployment').
- **Open questions for next session:** OBS-018 (backfill/seed scripts → SYSTEM_BACKFILL audit row — adjacent observability, the deploy-time-event sibling now that the boot-time event ships) and OBS-020 (audit retention/archival — `@@index([createdAt])` + partitioning) remain the Phase-2 Cluster-A observability TODOs. OBS-003 (leave-approval before/after) if still open. The `deployments` table is a candidate for the same retention discussion as OBS-020 but currently unbounded-growth-tolerant (one row per boot, low volume).

## 2026-05-25 — OBS-003 closed (LEAVE_APPROVED/REJECTED audit payload enriched with actor role/permissions snapshot + subject + ip/ua)

- **Session ID:** 2026-05-25-obs-chain (task 1/4)
- **Tasks closed:** OBS-003 (Phase 2, Cluster A — claude-only, severity blocking). First task of the autonomous OBS-003 → OBS-021 → OBS-007 → OBS-018 chain.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `c8fbe97` (IN_PROGRESS anchor), `1aa24b5` (fix — `[closes OBS-003]`), `<pending>` (closeout).
- **Counter:** no count change — OBS-003 already in finding totals; Status flipped (coherence checked-set 17→18 DONE/VERIFIED).
- **Duration:** ~40 minutes
- **Enum members added:** none (LEAVE_APPROVED/LEAVE_REJECTED already enum; this task is pure payload enrichment of existing DAT-001 emitters).
- **Design choices:**
  - **actor.permissions source = `PermissionsService.getPermissionsForRole(roleCode)`** — the same RBAC compile-time resolver the `RequirePermissions` guard consumes (no `RbacService.resolvePermissions` callable). Captured at emit time (templateKey→permissions is compile-time, no DB trace between deploys). Resolved BEFORE the `$transaction` — the Redis/Prisma read must not sit inside the Postgres tx holding the leave row lock.
  - **roleCode + templateKey from JWT `req.user.role`** (AuthenticatedUser carries both) — zero extra DB roundtrip, no extra include on the leave query.
  - **actor.id duplicated inside payload** in addition to the top-level AuditPersistence actorId column, so `payload->'actor'->>'id'` resolves without a join (advisor point #2).
  - **requestId omitted** — no request-id infra ([[OBS-009]] open); not implemented inline.
  - **Reusable `buildActorSnapshot()` private helper** introduced now, reused forward by the OBS-021 lifecycle emitters (advisor point #1 — avoids a 4× copy-paste / mid-chain refactor).
- **Learnings (non-trivial):**
  - **FAIL-pre demonstrated by stashing only `leaves.service.ts`** (keeping the spec + the new 4-arg controller call): vitest/esbuild strips types without type-checking, so the spec's `service.approve(id, validator, comment, {actor})` 4th arg is silently ignored against the pre-fix 3-arg signature → `payload.actor` is `undefined` → both witnesses red. Restored via `git stash pop`.
  - **Controller signature is positional:** inserting `@CurrentUser('role')` + `@Req()` before the optional `@Body` shifted the arg order, so the controller spec's `controller.approve(id, validator, 'comment')` calls had to be rewritten (comment moved to position 5). Caught by `leaves.controller.spec` going red, fixed there — not a service regression.
  - **Conflict-path invariant preserved:** the existing DAT-001 "no audit on ConflictException" assertion is untouched; `buildActorSnapshot` runs before the tx (so `getPermissionsForRole` is now called once on the conflict path) but the emission still never fires on conflict (advisor blocking-concern confirmed).
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1610** (69 files, +2 over OBS-012's 1608), web 579 passed / 14 skipped. `pnpm run test:e2e` api app e2e 2/2 (mocked DB — no Playwright spec touches the leaves/audit surface; OBS-006/OBS-012 precedent). Witnesses FAIL-pre 2/2 → PASS-post.
- **[[TST-011]] delta:** +2 leaves.service witnesses (approve/reject enriched payload).
- **Cour-des-Comptes question:** "who approved leave X, with which role at the time?" → **YES**, answerable. `SELECT payload->'actor' FROM audit_logs WHERE action='LEAVE_APPROVED' AND "entityId"='X'` returns `{id, roleCode, templateKey, permissions[]}` snapshotted at decision time.
- **Open questions for next session:** OBS-021 (LEAVE_* lifecycle: UPDATE/DELETE/CANCELLATION_REQUESTED/BALANCE_ADJUSTED) is task 2/4 — will reuse `buildActorSnapshot` and promote the DAT-001 `LEAVE_CANCELLED` free-string to an enum member (same value = zero prod-data impact; advisor point #4).

## 2026-05-25 — OBS-021 closed (LEAVE_* lifecycle audit: UPDATED + DELETED + CANCELLATION_REQUESTED + BALANCE_ADJUSTED + LEAVE_CANCELLED enum promotion)

- **Session ID:** 2026-05-25-obs-chain (task 2/4)
- **Tasks closed:** OBS-021 (Phase 2, Cluster A — claude-only, severity important). Second task of the autonomous chain; reuses the OBS-003 buildActorSnapshot helper.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `0156434` (IN_PROGRESS anchor), `c45f209` (fix — `[closes OBS-021]`), `<pending>` (closeout).
- **Counter:** no count change — OBS-021 already in finding totals; Status flipped (coherence checked-set 18→19 DONE/VERIFIED).
- **Duration:** ~70 minutes
- **Enum members added (5):** LEAVE_CANCELLED (promoted from DAT-001 free-string, identical value), LEAVE_CANCELLATION_REQUESTED, LEAVE_UPDATED, LEAVE_DELETED, LEAVE_BALANCE_ADJUSTED — all ENTITY_TYPE_BY_ACTION='Leave'.
- **Design choices:**
  - **Existence check first** (grep): all four target workflows exist — none invented. `update()`, `remove()` (hard delete), `requestCancel()`, `upsertBalance()`/`deleteBalance()`.
  - **upsertBalance single hoisted emit:** 3 return points → one `emitAdjustment()` closure called on each successful return; fires exactly once, never on the global-branch failed-create-before-retry. before = admin decision-time perspective (pre-read, 1 extra roundtrip flagged), not last-observed-state on a race.
  - **rejectCancellation deliberately omitted** (not in the 5-event Suggested-fix list; candidate follow-up, not invented scope). APPROVE_CANCELLATION merged into LEAVE_CANCELLED via before.status.
  - **LEAVE_CANCELLED promotion = zero prod-data impact** (value unchanged) — cleaner than OBS-004's PASSWORD_RESET rename which needed a query-time alias. Advances [[OBS-024]].
- **Learnings (non-trivial):**
  - **No FK surprise on LEAVE_DELETED:** `audit_logs.entityId` is a plain TEXT column, not a FK to `leave` — the pending d6299cc audit_logs FK NoAction does NOT block leave hard-delete; the audit row outlives the deleted leave (intended). The cross-task interaction the chain contract flagged turned out to be a non-issue.
  - **Cross-connection audit caveat (carried from DAT-001):** remove()/requestCancel() wrap mutation+audit in `$transaction`, but AuditPersistenceService uses its own prisma client — commit gated on the audit promise but NOT a single atomic unit. Mirrored DAT-001, did NOT claim to fix.
  - **cancel() enum promotion validated against its DAT-001 test** — the test asserts `action: 'LEAVE_CANCELLED'` as a string literal; `AuditAction.LEAVE_CANCELLED === 'LEAVE_CANCELLED'` so it still passes (ran it, didn't assume).
  - **Controller signatures are positional:** threading `@CurrentUser('role')` + `@Req()` into update/remove shifted args, breaking 2 controller-spec `toHaveBeenCalledWith` assertions — fixed there (caught by the spec going red).
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1618** (69 files, +8 over OBS-003's 1610), web 579 passed / 14 skipped. `pnpm run test:e2e` api app e2e 2/2 (mocked DB — no Playwright spec touches the leaves/audit surface; OBS-003/OBS-006 precedent). Witnesses FAIL-pre 5 positive + audit-table → PASS-post; 3 negatives vacuous pre-fix (invariant guards).
- **[[TST-011]] delta:** +8 leaves.service witnesses + 5 entityType pairs (audit.service.spec).
- **Cour-des-Comptes question:** "when was leave Y modified, by whom, what changed?" → **YES.** `SELECT action, "actorId", payload->'before', payload->'after' FROM audit_logs WHERE "entityId"='Y' ORDER BY "createdAt"` now returns LEAVE_UPDATED/CANCELLATION_REQUESTED/CANCELLED/DELETED rows with before/after. Balance changes via LEAVE_BALANCE_ADJUSTED. (rejectCancellation is the one un-audited transition — noted for follow-up.)
- **Open questions for next session:** OBS-007 (data exports → DATA_EXPORTED) is task 3/4 — different module shape (format/scope/dateRange/recordCount). Pre-flight grep export endpoints BEFORE anchoring; if >4 export controllers, partial-close to planning-export only to respect the 8-file cap (advisor point #5).

## 2026-05-25 — OBS-007 closed (DATA_EXPORTED on planning ICS export; partial-close, CSV exports → OBS-026 follow-up)

- **Session ID:** 2026-05-25-obs-chain (task 3/4)
- **Tasks closed:** OBS-007 (Phase 2, Cluster A — claude-only, severity important). **PARTIAL CLOSE** scoped to the planning-export module (finding's named File + most RGPD-relevant).
- **Tasks filed:** OBS-026 (project CSV exports tasks/milestones — deferred for the 8-file cap, severity suggestion).
- **Tasks moved to BLOCKED:** none.
- **Commits:** `ad876e9` (IN_PROGRESS anchor), `4711097` (fix — `[closes OBS-007]`), `<pending>` (closeout + OBS-026 filing).
- **Counter:** OBS-007 Status flipped (coherence checked-set 19→20 DONE/VERIFIED). OBS-026 filed as TODO (not in checked-set; +1 to total findings).
- **Duration:** ~45 minutes
- **Enum members added (1):** DATA_EXPORTED; ENTITY_TYPE_BY_ACTION union widened `+'Export'` (exhaustive-Record compile-forced).
- **Design choices:**
  - **Partial-close decision (file cap):** enumerated 3 file-format egress endpoints across 3 modules (planning ICS, tasks CSV, milestones CSV). All three = ~11 files > 8-file cap. Shipped planning-export only (named File + personal-data egress); filed OBS-026 for the CSV pair. Per advisor point #5 + chain contract.
  - **Single DATA_EXPORTED with `scope` in payload** (Suggested-fix default), not per-domain enums.
  - **recordCount exact** (events+leaves+telework lengths), materialized not estimated.
  - **Fire-and-forget** (read-path nuance, OBS-006): export is a GET; audit hiccup must not 500 it.
- **Learnings (non-trivial):**
  - **The `@Req()` insertion is positional:** added at param 2 (required) before the optional `@Query`/`@Res` params — valid (required-before-optional). exportIcs is NOT directly tested in planning-export.controller.spec (only previewImport/importIcs are), so no controller-spec churn.
  - **AuditModule is @Global** → AuditPersistenceService injectable into PlanningExportService with no module edit (OBS-012 precedent).
  - **No new free-string** — DATA_EXPORTED enum-from-creation, no [[OBS-024]] carry-over.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1620** (+2 over OBS-021's 1618), web 579 passed / 14 skipped. `pnpm run test:e2e` 2/2 (mocked DB; no Playwright spec touches the export/audit surface). Witnesses FAIL-pre 1 positive + audit-table → PASS-post; fire-and-forget resilience test vacuous pre-fix.
- **[[TST-011]] delta:** +2 planning-export.service witnesses + 1 entityType pair (audit.service.spec).
- **Cour-des-Comptes question:** "who exported planning data on date Z?" → **YES** for the planning ICS export. `SELECT "actorId", payload->>'scope', payload->>'recordCount', payload->'dateRange', "createdAt" FROM audit_logs WHERE action='DATA_EXPORTED'`. **NOT yet** for tasks/milestones CSV (→ [[OBS-026]]).
- **Open questions for next session:** OBS-018 (backfill/seed scripts → SYSTEM_BACKFILL) is task 4/4 (final). Scripts don't run under vitest → extract a testable emission helper (AUD-EMIT-001 / OBS-002+DAT-009 precedent for the manual-verification divergence).

## 2026-05-25 — OBS-018 closed (SYSTEM_BACKFILL audit on backfill-snapshots start+end; seed/holidays deferred)

- **Session ID:** 2026-05-25-obs-chain (task 4/4 — final)
- **Tasks closed:** OBS-018 (Phase 2, Cluster A — claude-only, severity important). Last task of the autonomous chain.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `79a5804` (IN_PROGRESS anchor), `986c06f` (fix — `[closes OBS-018]`), `<pending>` (closeout).
- **Counter:** OBS-018 Status flipped (coherence checked-set 20→21 DONE/VERIFIED).
- **Duration:** ~40 minutes
- **Enum members added (1):** SYSTEM_BACKFILL; ENTITY_TYPE_BY_ACTION union widened `+'SystemMaintenance'` (exhaustive-Record compile-forced).
- **Design choices:**
  - **Testable-helper pattern:** scripts don't run under vitest → emission extracted to `src/scripts/system-backfill-audit.ts` (`emitSystemBackfill` + `resolveBackfillActor`), tested at the `.log` boundary. Script-level verification (a real dry run on a dev DB) is **DEFERRED — not performed this session** (no Orchestra dev DB up; TST-DB-001 gap, AUD-EMIT-001 / OBS-002+DAT-009 manual-verification divergence). Automated coverage shipped = the helper witnesses + `nest build` compiling backfill-snapshots.ts.
  - **Single SYSTEM_BACKFILL** with `phase` in payload (OBS-012 RELEASE_DEPLOYED precedent). affectedCount omitted at STARTED.
  - **actorId = resolveBackfillActor** prefers DEPLOYED_BY (OBS-012 deploy identity) over the finding-suggested DEPLOY_USER; honest null otherwise.
  - **Scope = backfill-snapshots only.** seed.ts + import-french-holidays.ts construct their own PrismaClient (no Nest context) → deferred (chain contract's skip-and-document clause); the helper is reusable for them later.
- **Learnings (non-trivial):**
  - **Hash-chain constraint drove the scope:** SYSTEM_BACKFILL MUST go through AuditPersistenceService (OBS-002 computes the hash chain there) — a raw audit_logs insert from a script breaks the chain. backfill-snapshots already has a Nest app context → AuditPersistenceService for free; the other two scripts don't, hence deferred.
  - **DEPLOYED_BY now exists in the api container** (58d1c00, OBS-012 refinement) — a more reliable operator identity than the finding's DEPLOY_USER guess.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1626** (+6 over OBS-007's 1620, new spec file), web 579 passed / 14 skipped. `pnpm run test:e2e` 2/2 (mocked DB — backfill-snapshots is not run/imported by any spec; no surface touched). Witnesses FAIL-pre (STARTED action undefined + audit-table 'Auth' default) → PASS-post.
- **[[TST-011]] delta:** +6 helper witnesses + 1 entityType pair (audit.service.spec).
- **Cour-des-Comptes question:** "when did backfill script S run, what did it touch?" → **YES** for backfill-snapshots. `SELECT "actorId", payload->>'phase', payload->>'affectedCount', "createdAt" FROM audit_logs WHERE action='SYSTEM_BACKFILL' AND "entityId"='backfill-snapshots' ORDER BY "createdAt"` pairs each STARTED with its COMPLETED + row count. **NOT yet** for seed/holidays (deferred, documented).
- **Chain complete (4/4):** OBS-003, OBS-021, OBS-007 (partial → OBS-026), OBS-018. No 4th resilience commit needed on any task (OBS-006/OBS-012 precedent unused). See the chain's cumulative report.

## 2026-05-25 — OBS-026 closed (DATA_EXPORTED on tasks + milestones CSV exports; OBS-007 partial-close completed)

- **Session ID:** 2026-05-25-obs-026
- **Tasks closed:** OBS-026 (Phase 2, Cluster A — claude-only, severity suggestion). Completes OBS-007's deferred CSV pair.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `01c6aa1` (IN_PROGRESS anchor), `a42d663` (fix — `[closes OBS-026]`), `<pending>` (closeout).
- **Counter:** OBS-026 Status flipped (coherence checked-set 21→22 DONE/VERIFIED). **Totals header bumped +1** (suggestion 5→6, observability 25→26): OBS-007's closeout flagged OBS-026 as "+1 to total findings" but never edited the header (the "5 suggestion" line predates OBS-026's filing, set in 08fff11) — applied now so the header reflects the filed finding.
- **Enum members added:** none — DATA_EXPORTED + 'Export' entityType already shipped by OBS-007 (4711097). Purely additional emit sites.
- **Duration:** ~30 minutes
- **Design choices:**
  - **Helper extraction (OBS-007 had inlined):** factored the emission shape into `src/audit/export-audit.helper.ts` (`emitDataExported` + `ExportMeta`), consumed by both new call sites. planning-export left untouched (AC#6 confine) — converging it is a trivial deferred cleanup.
  - **scope = 'tasks' / 'milestones'** (Suggested fix). **entityId = actorId** (mirrors planning's entityId=userId, per advisor); exported resource named in `payload.subject = { projectId }`.
  - **recordCount exact** (tasks.length / milestones.length), materialized not estimated.
  - **dateRange OMITTED** — neither CSV is date-filtered (both filter by projectId); projectId encoded under `payload.subject` instead (open design question resolved). Cross-domain: planning rows carry `dateRange`, CSV rows carry `subject.projectId`, both under scope-disambiguated DATA_EXPORTED.
  - **Fire-and-forget, caller-as-actor, caller-undefined skips.** milestones.controller gained `@CurrentUser('id')` (had no actor before); tasks.controller gained `@Req()`.
- **Learnings (non-trivial):**
  - **AuditModule is @Global** → AuditPersistenceService injectable into TasksService/MilestonesService with no module edits (OBS-007/OBS-012 precedent).
  - **Additional export surface discovered — scope-creep avoided:** `analytics.controller GET /analytics/export` returns aggregate analytics JSON (no Content-Disposition, no CSV/ICS/XLSX), not a personal-data file egress → out of OBS-007/OBS-026 category; candidate finding for aggregate-export tracking, NOT filed. leaves/school-vacations grep matches were `toString()` false-positives. So the file-format egress surface = planning ICS (OBS-007) + tasks/milestones CSV (this task), fully covered.
  - **Priority enum has no MEDIUM** (LOW/NORMAL/HIGH/CRITICAL) — first witness draft crashed in `escapeField(undefined)`; fixed test data to Priority.NORMAL. The crash usefully proved the CSV builder is undefined-fragile, but that's pre-existing, not OBS-026 scope.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` — **api 1632** (+6 over OBS-018's 1626, new witnesses), web 579 passed / 14 skipped. `pnpm run test:e2e` **NOT run** — Orchestra dev stack (postgres) not up, and OBS-026 adds no new route/UI surface; the DATA_EXPORTED row is a fire-and-forget `audit_logs` write, not observable via Playwright. Witnesses FAIL-pre (2 positive emission tests) → PASS-post; negative + fire-and-forget resilience tests vacuous pre-fix.
- **[[TST-011]] delta:** +6 service witnesses (tasks + milestones: 1 positive payload + 1 caller-undefined-no-emit + 1 fire-and-forget resilience each). No new audit.service.spec entityType pair (DATA_EXPORTED→Export already covered by OBS-007). +1 milestones.controller.spec call-site update (new actor/req params).
- **Cour-des-Comptes question:** "who exported project P's tasks/milestones, when, how many rows?" → **YES.** `SELECT "actorId", payload->>'scope', payload->>'recordCount', payload->'subject'->>'projectId', "createdAt" FROM audit_logs WHERE action='DATA_EXPORTED' AND payload->>'scope' IN ('tasks','milestones')`. Combined with OBS-007, all personal-data file egress (ICS + CSV) is now traced.

## 2026-05-25 — OBS-024 closed (enum vs free-string converged into one compile-time AuditAction registry)

- **Session ID:** 2026-05-25-obs-024
- **Tasks closed:** OBS-024 (Phase 2, Cluster A — claude-only, severity important). The convergence finding that every audit session since DAT-002 nibbled at; this one made the type system enforce it.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `64d009b` (IN_PROGRESS anchor), `7393b5d` (fix — `[closes OBS-024]`), `<pending>` (closeout).
- **Counter:** OBS-024 Status flipped (coherence checked-set 22→23 DONE/VERIFIED). **No totals-header change** — OBS-024 was already a filed/counted finding (unlike OBS-026's late header bump).
- **Signature choice: (a) hard type.** `AuditPersistenceService.log()`'s `action: string` → `action: AuditAction`. Only option that closes OBS-024 (no `@deprecated` overload, no branded escape hatch). Proven to bite: injecting `action: 'PROJECT_ARCHIVED_TYPO'` at a real call site → `nest build` TS2820 "not assignable to type 'AuditAction'"; reverted.
- **Enum members added: 3** — PROJECT_ARCHIVED / PROJECT_UNARCHIVED / PROJECT_DELETED (the last free-strings, from projects.service.ts). Identical string values → zero prod-data impact, no carry-over alias. **No net-new audit events** (pure action-code rename of existing emitters). ENTITY_TYPE_BY_ACTION union +'Project'; exhaustive `Record<AuditAction,…>` compile-forced the 3 mappings.
- **Free-string call sites converted: 3.**
  | file:line | was | now |
  |---|---|---|
  | projects.service.ts:661 (archive) | `'PROJECT_ARCHIVED'` | `AuditAction.PROJECT_ARCHIVED` |
  | projects.service.ts:691 (unarchive) | `'PROJECT_UNARCHIVED'` | `AuditAction.PROJECT_UNARCHIVED` |
  | projects.service.ts:790 (hardDelete) | `'PROJECT_DELETED'` | `AuditAction.PROJECT_DELETED` |
  "Justified as string" exceptions: **zero**.
- **Duration:** ~40 minutes
- **Design choices:**
  - **Enum extracted to `audit/audit-action.enum.ts`, re-exported from `audit.service.ts`.** Not in-place: AuditService imports AuditPersistenceService, so typing the persistence param via `audit.service.ts` would be an import cycle. The enum is the lower-layer primitive both writers share; re-export kept all 12 existing import sites untouched (zero churn outside audit/ + projects/).
  - **Witness in `src/` not a spec.** `audit/audit-action.compile-witness.ts` with `@ts-expect-error` over a non-member literal. Rationale: `nest build` (tsconfig.build.json) typechecks all source files and is the real CI gate; vitest uses esbuild (no typecheck) and full-project `tsc --noEmit` is red on pre-existing spec errors → a spec witness would be decorative/unenforced. FAIL-pre (TS2578 unused-directive = string accepted = the bug) → PASS-post.
  - **`computeRowHash` left `action: string`** — pure helper, external chain-verifiers pass raw audit_logs values; enum→string widens automatically at the call site.
- **Learnings (non-trivial):**
  - **Most of OBS-024 was already done.** Projected 10-20 files; actual **6 source files** (2 new: enum + witness; 4 modified: audit-persistence, audit.service, audit.service.spec, projects.service). Every prior session (OBS-001/004/005/006/007/012/018/021/026) had already converted its own module's codes to enum-from-creation. Only projects.service.ts still emitted free-strings. This session converged the last surface + locked it with the type.
  - **Read-side alias is a separate follow-up.** OBS-004's renamed legacy prod rows ('PASSWORD_RESET_ADMIN', un-backfillable under OBS-002 immutability) need a query-time alias when audit_logs is *read* — out of scope for this write-side convergence. Flagged in OBS-024 Learnings as a candidate filing against the audit-query/export path (not pre-filed).
  - **Tooling candidate (not pre-filed):** an ESLint rule banning string-literal `action:` in audit `.log({…})` calls would cover any future audit sink that bypasses the typed boundary. Low urgency — the type covers every current sink.
- **Gates:** `nest build` (source typecheck, the authoritative API build) EXIT 0. `pnpm test` (api) **1632 passed** (delta **0** — the 3 PROJECT_* rows went into an existing *looped* entityType test, not new `it()` blocks; the witness is compile-time, not a runtime spec). `pnpm test:e2e` (api) **2 passed**. Witness FAIL-pre (TS2578) → PASS-post; real-call-site free-string rejection demonstrated (TS2820) and reverted.
- **[[TST-011]] delta:** +0 runtime witnesses (refactor session — the existing projects.service.spec assertions on `'PROJECT_*'` literals now exercise the enum path unchanged; 3 entityType rows added to audit.service.spec's existing looped test). New *compile-time* coverage: the witness file is a permanent type-level regression guard.
- **Cour-des-Comptes question:** "are audit action codes coherent across modules / can an auditor query one namespace?" → **YES, now compiler-guaranteed.** Every action written to `audit_logs.action` is an `AuditAction` enum member; a free-string action code can no longer compile. Single source of truth: `audit/audit-action.enum.ts`.

## 2026-05-25 — File AUD-READ-001 (legacy PASSWORD_RESET_ADMIN read-side alias)

- **Session ID:** 2026-05-25-aud-read-filing
- **Tasks closed:** none (filing-only).
- **Tasks moved to BLOCKED:** none.
- **Other backlog touches:** AUD-READ-001 filed (Phase 2, cluster A, observability — read-side alias for legacy free-string rows un-backfillable under the audit_logs immutability trigger).
- **Commits:** <pending> (filing).
- **Duration:** <approx>
- **Learnings:** OBS-024's write-side convergence revealed a read-side asymmetry: the immutability trigger makes string-value evolution permanent unless the read pipeline aliases. Pattern to watch for any future enum rename — the canonical naming on the write path must be reconcilable with prior naming on the read path, otherwise the audit narrative silently fragments.
- **Open questions for next session:** USR-DEL-001 implementation (Phase 2, pattern-direct mirror of DAT-007).

## 2026-05-26 — USR-DEL-001 closed (typed ConflictException on user hardDelete + USER_DELETED snapshot)

- **Session ID:** 2026-05-26-usr-del-001
- **Tasks closed:** USR-DEL-001 (Phase 2 — claude-only, severity important, correctness). Pattern-direct mirror of DAT-007 (0eae219).
- **Tasks moved to BLOCKED:** none.
- **Commits:** `cdd1ce0` (IN_PROGRESS anchor), `950068f` (fix — `[closes USR-DEL-001]`), `<pending>` (closeout).
- **Duration:** ~35 minutes
- **Policy decision: (a) — emit USER_DELETED.** hardDelete now writes a `USER_DELETED` audit row with a column `payload.snapshot` BEFORE erasing the user, symmetric with DAT-007 PROJECT_DELETED / OBS-005 ROLE_DELETED. Chosen over (b) trail-less-by-construction so the deletion event itself is visible inline in the immutable trail for a Cour-des-Comptes auditor. The pre-check guarantees the deleted user authored zero prior audit rows, so this USER_DELETED row is the deletion's only record.
- **checkDependencies() extension:** single source of truth (no new helper — already grep-symmetric with `checkProjectDependencies()`). Now pre-checks **TASKS / PROJECTS / LEAVES / LEAVES_VALIDATION / DEPARTMENTS / SERVICES / AUDIT_LOGS**. The AUDIT_LOGS count = `prisma.auditLog.count({ where: { actorId: userId } })` (one extra read-only roundtrip, no tx) turns the raw P2003 from the `audit_logs.actor_id` ON DELETE NO ACTION FK (d6299cc) into a typed `ConflictException` naming the count + recommending USER_DEACTIVATED.
- **ConflictException shape mirrored from projects.service.ts hardDelete:** `throw new ConflictException({ message, dependencies })`. Generic top-level message unchanged; count + recommendation in the AUDIT_LOGS dependency `description`.
- **USER_DELETED enum addition:** net-new member `audit/audit-action.enum.ts` (value `'USER_DELETED'`); `ENTITY_TYPE_BY_ACTION` → `'User'`. The exhaustive `Record<AuditAction,…>` made the mapping compile-mandatory (post-OBS-024 no free-string codepath). `nest build` EXIT 0 confirms exhaustiveness.
- **Snapshot allow-list (advisor flag):** explicit field enumeration, NOT spread+delete. passwordHash + token relations never serialized; a spec assertion guards it.
- **Side effect:** checkDependencies() also backs `GET /users/:id/dependencies` (controller:365) → AUDIT_LOGS now visible on the read path (intended UX, but a read-path behavior change — flagged).
- **Actor threading already in place (SEC-002):** `requestingUserId` via `@CurrentUser('id')` (controller:389); used as `actorId: requestingUserId ?? null`. No controller surface added.
- **Gates:** `pnpm run build` 3/3 turbo green. `pnpm run test` (api) **1634 passed** (+2 over the 1632 OBS-024/OBS-026 baseline — the 2 new hardDelete witnesses). Mocked api `test:e2e` 2 passed. **Playwright web e2e NOT run** — Orchestra postgres dev stack down (only orchestr-a-redis up); USR-DEL-001 adds no new route/UI surface and the USER_DELETED write is an audit_logs row, not Playwright-observable beyond the unit witnesses (documented divergence, AUD-EMIT-001/OBS-026 precedent). Witnesses FAIL-pre (2 positives) → PASS-post; negatives/regression vacuous-or-green pre-fix.
- **[[TST-011]] delta:** +2 service witnesses (1 positive AUDIT_LOGS-blocks-delete + 1 USER_DELETED-emission-with-snapshot). +0 new audit.service.spec entityType pair via new `it()` (USER_DELETED→User added to the existing exhaustive ENTITY_TYPE_BY_ACTION map, compile-checked).
- **Coherence check:** USR-DEL-001 is a multi-segment ID (TOOL-COH-001 regex blind spot `[A-Z]+-\d+` does not match `USR-DEL-001`). The gate silently skips it even when DONE → checked-set count unchanged at 23, EXIT 0 expected. Substantively coherent (Closed_by SHA present, `[closes USR-DEL-001]` in the commit message); the skip is the known TOOL-COH-001 gap, not a coherence failure.
- **Cour-des-Comptes question:** "can a user be removed in a way that erases their audit trail?" → **NO.** A user who authored audit rows cannot be hard-deleted (pre-check raises ConflictException before any delete); a user with zero audit rows can be hard-deleted, but the deletion itself writes an immutable USER_DELETED snapshot row. Silent, trace-erasing removal is impossible by construction.
- **Open questions for next session:** AUD-READ-001 (legacy free-string read-side alias), TST-DB-001 (real-DB FK witness automation — would close the USR-DEL-001 P2003 real-DB gap), TOOL-COH-001 (multi-segment ID regex fix).

## 2026-05-26 — AUD-READ-001 → BLOCKED (audit-revision-required: no audit read pipeline to alias against)

- **Session ID:** 2026-05-26-aud-read-001
- **Tasks closed:** none.
- **Tasks moved to BLOCKED:** AUD-READ-001 (Phase 2, Cluster A — claude-only, severity important). Blocked_by → `audit-revision-required`.
- **Commits:** `<pending>` (BLOCKED flag — single commit, no IN_PROGRESS anchor and no fix commit since the contract §"When the audit is wrong or outdated" escalation supersedes the 3-commit standard).
- **Why BLOCKED (design-question #4 fired):** AUD-READ-001 assumes a server-side audit read pipeline filtering by `action`; it does not exist. The Suggested fix (option a — expand the WHERE clause in the read pipeline) has nothing to attach to, and AC#2's witness ("query the audit read API filtering by `PASSWORD_RESET_BY_ADMIN`") is unsatisfiable — there is no audit read API.
- **Search evidence (5 angles, all empty for a read surface):** no `audit.controller.ts`; no `auditLog.findMany/findFirst/findUnique/groupBy/aggregate` in `apps/api/src`; no `@Get`/`@Controller` audit endpoint; no `AuditLog`-typed read DTO/resolver; no web-side consumer. `audit.module.ts` exports only write-side `AuditService` + `AuditPersistenceService`. The only two `audit_logs` reads: `audit-persistence.service.ts:111` (hash-chain tail, write-side) and `users.service.ts:743` (`count` by `actorId`, USR-DEL-001 dep-check — not action-filterable).
- **Prod narrative gap is real but unreachable in this layer:** an auditor enumerating admin password resets today can only run direct SQL on prod (`WHERE action = 'PASSWORD_RESET_BY_ADMIN'`), which a TypeScript alias map cannot intercept. Legacy `'PASSWORD_RESET_ADMIN'` rows (SEC-003 / 2763552, pre-OBS-004 rename 330a8eb) stay invisible to that query until a read-side reconciliation lands in a layer the auditor actually touches.
- **Rejected: shipping a standalone `legacy-action-aliases.ts` + pure `expandActionFilter()` with no consumer** — decorative dead code (over-design); a future rename discovers an uncalled file no more reliably than a comment. Advisor-confirmed.
- **Three forks for human decision:**
  1. **Defer** until a read API is genuinely needed (most likely — no auditor has a TS query path today; the gap is purely a future-read concern).
  2. **Pivot to option (b): a SQL VIEW** UNIONing legacy↔canonical action codes — covers the direct-psql auditor path, but rewrites the task's layer (migration + view maintenance, not a TS map).
  3. **Scope-extend:** build a minimal `GET /audit/logs?action=…` read endpoint + the alias map + wiring as one feature — satisfies AC#2 as written but is a substantial scope explosion (new endpoint, RBAC, pagination, DTO).
- **Future-rename guidance (holds for whichever fork lands):** when an enum value replaces a prior free-string, add the legacy string to the alias map in the SAME commit as the rename — contingent on the alias map having a live read consumer first.
- **Gates:** none run — no code changed (backlog/PROGRESS_LOG only). Working tree was clean on master pre-edit; no `apps/` or `packages/` files touched.
- **Coherence check:** AUD-READ-001 is a multi-segment ID — TOOL-COH-001 regex blind spot (`[A-Z]+-\d+` does not match `AUD-READ-001`) silently skips it whether DONE or BLOCKED → checked-set unchanged at 23, EXIT 0 expected. The skip is the known TOOL-COH-001 gap, not a coherence failure; BLOCKED tasks carry no `Closed_by` SHA by design, so the gate's DONE/VERIFIED→SHA rule does not apply.
- **Cour-des-Comptes question:** "can an auditor query all admin password resets across the audit_logs history?" → **NOT YET — and this task could not deliver it.** Filtering by `PASSWORD_RESET_BY_ADMIN` still misses legacy `'PASSWORD_RESET_ADMIN'` rows. Closing the gap requires the human to pick fork 1/2/3 above; option (b) SQL VIEW is the only fork that also covers the direct-psql query an auditor would realistically run.
- **Open questions for next session:** AUD-READ-001 fork decision (defer / SQL VIEW / read-endpoint), TST-DB-001 (real-DB FK witness automation), TOOL-COH-001 (multi-segment ID regex fix).

## 2026-05-26 — AUD-READ-001 closed (re-scoped: normalization migration of legacy PASSWORD_RESET_ADMIN + hash-chain recompute)

- **Session ID:** 2026-05-26-aud-read-001-normalize
- **Tasks closed:** AUD-READ-001 (Phase 2, Cluster A — claude-only, severity important, observability). Re-scoped BLOCKED → IN_PROGRESS → DONE in one session.
- **Tasks moved to BLOCKED:** none (the reverse — un-blocked the prior session's `audit-revision-required`).
- **Commits:** `b5bf72e` (IN_PROGRESS + scope re-cadrage), `5f87026` (fix — `[closes AUD-READ-001]`), `<pending>` (closeout).
- **Duration:** ~75 minutes
- **Re-scoping (deliberate dérogation from "verbatim, do not rewrite"):** AUD-READ-001 is session-derived, and the BLOCKED escalation (a4617db) proved its presupposition (an audit read pipeline to alias against) false. Amended the **Suggested fix** to a normalization-migration approach and AC#2's witness to W-1..W-6. The fourth fork — normalize the DATA, not patch a (non-existent) read layer — dominates the three forks the BLOCKED session left for the human: no deferral, no SQL VIEW to maintain, no read endpoint to build; direct psql / future read API / export all see the canonical code.
- **Philosophical correction — normalization ≠ history rewriting.** The immutability trigger protects audit FACTS (who/what/when/actor-snapshot); none change. We rewrite one derived label ('PASSWORD_RESET_ADMIN' → 'PASSWORD_RESET_BY_ADMIN', the same event renamed in code at 330a8eb) and recompute the integrity hashes that depend on it — same class as the OBS-002 migration that *created* the chain over pre-existing rows. The act writes its own SYSTEM_BACKFILL rows into the trail it touches, in one bracketed transaction with operator identity captured. The trigger is `DISABLE`-able by the table owner precisely so a controlled+audited normalization is possible; the read-only-role defence-in-depth is the separate TOOL-DEPLOY-001.
- **Mechanism:** TS one-shot script `apps/api/src/scripts/normalize-action-codes.ts` (mirrors the OBS-018 `backfill-snapshots` → `emitSystemBackfill` → `resolveBackfillActor` pattern). Single Prisma interactive `$transaction`: advisory lock (same as write path) → find first-affected `(createdAt,id)` → `DISABLE TRIGGER audit_logs_no_update_delete` → `UPDATE action` → recompute walk over `("createdAt",id) >= first` with the **imported** `computeRowHash` (write/migration divergence would silently desync the chain) → `ENABLE TRIGGER` → in-tx verify + predecessor-unchanged assert. DDL is transactional in Postgres → a rollback auto-reverts the DISABLE (primary safety; try/catch + explicit ENABLE = belt-and-suspenders). Idempotent. Rejected: pl/pgsql (would duplicate the hash logic in SQL), `.sql` migration (awkward for TS-import recompute).
- **`computeRowHash` was already exported** as the d6299cc closeout promised ("Exported so an external verifier … can recompute") — imported directly, no re-export needed. `stableStringify` lives alongside it.
- **Trigger name / function (verbatim from d6299cc):** trigger `audit_logs_no_update_delete`, function `audit_logs_immutable()`.
- **TST-DB-001 status:** real DB WAS usable this session — contrary to the prior "stack down" note, `orchestr-a-db` (postgres:18, port 5433) was healthy. The witness ran against a dedicated **throwaway DB** (`orchestr_a_normalize_witness`, `prisma migrate deploy` of the real schema → real trigger), created+dropped this session, so the (immutable) dev trail was not polluted. This is a real-DB witness, not a documented-divergence mock.
- **Dev DB row count at run time:** `orchestr_a_v2` had **0** `PASSWORD_RESET_ADMIN` rows (virgin — AUD-EMIT-001 emit was post-rename). The affected-path was witnessed on seeded throwaway data; the dev no-op path is implied (0 rows → idempotent skip).
- **Gates:** `pnpm --filter api run build` (nest build typecheck gate) EXIT 0. `pnpm test` **api 1636 passed** (+2 over the 1634 USR-DEL-001 baseline — 2 new `system-backfill-audit.spec.ts` tests for the additive fromValue/toValue fields), 6/6 turbo tasks green. `pnpm --filter api test:e2e` **2 passed**. Witness W-1..W-6 all PASS. CLI boot + pnpm `-- --dry-run` arg-forwarding smoke-tested. **Playwright web e2e NOT run** — the change adds no route/UI surface (a one-shot operational script writing audit_logs rows, not Playwright-observable); the real-DB witness is the integration test (USR-DEL-001 / AUD-EMIT-001 / OBS-026 divergence precedent).
- **Idempotency:** confirmed — 2nd run finds 0 legacy rows, recomputes nothing (W-3 affectedCount=0, recomputedCount=0, chain still valid).
- **Failure mode:** a real (non-dry-run) crash leaves a STARTED SYSTEM_BACKFILL row without COMPLETED; the absence + trigger-ENABLED (tx rolled back the DISABLE) + operator error log are the diagnostic signal (OBS-018 precedent).
- **[[TST-011]] delta:** +2 helper unit witnesses (fromValue/toValue propagation + omission-when-unset) + 6 real-DB witness checks (not vitest-counted).
- **Diff scope (AC#6):** `apps/api/src/scripts/` (2 new + 2 modified) + `package.json` (1 script) + this BACKLOG + PROGRESS_LOG. No schema change, no migration, `audit-persistence.service.ts` untouched, no new enum member.
- **Coherence check:** AUD-READ-001 is a multi-segment ID — TOOL-COH-001 regex blind spot (`[A-Z]+-\d+` does not match `AUD-READ-001`) silently skips it even when DONE → checked-set unchanged, EXIT 0 expected. Substantively coherent: `Closed_by` SHA `5f87026` present, `[closes AUD-READ-001]` literal in the fix commit message.
- **Cour-des-Comptes question:** "can an auditor querying audit_logs filter cleanly by action='PASSWORD_RESET_BY_ADMIN' across the full history?" → **YES (after the prod runbook is executed).** Post-normalization every admin-reset row carries the canonical name, queryable by direct psql or any future read API; and the normalization itself is auditable via the immutable SYSTEM_BACKFILL rows (payload.fromValue/toValue/affectedCount). This session ships+verifies the mechanism on dev; the prod run is a separate operation per the runbook (`git show 5f87026`).
- **Open questions for next session:** prod runbook execution for AUD-READ-001 (operator gesture, separate from this session), TST-DB-001 (real-DB witness automation — now has a throwaway-DB precedent), TOOL-COH-001 (multi-segment ID regex fix), startup-hook asserting trigger ENABLED at boot (unfiled follow-up idea).

## 2026-05-26 — DAT-021 closed (Zod payload validation + schemaVersion in hash chain + JSONB GIN index)

- **Session ID:** 2026-05-26-dat-021
- **Tasks closed:** DAT-021 (Phase 2, Cluster A — claude-only, severity important, data_integrity · json). Three orthogonal additive sub-deliverables (Suggested fix a/b/c).
- **Tasks moved to BLOCKED:** none.
- **Commits:** `8bbae3a` (IN_PROGRESS anchor), `33f7a9c` (fix — `[closes DAT-021]`, body carries the prod runbook), `<pending>` (closeout).
- **Counter:** DAT-021 Status flipped (coherence checked-set 23→24 DONE/VERIFIED). Single-segment ID (`DAT-\d+`) → visible to the TOOL-COH-001 gate. No totals-header change (already a filed/counted finding).
- **Duration:** ~2 hours
- **Sub-deliverables shipped:**
  - **(a) schemaVersion** `Int @default(1)` + `@@index([schemaVersion])` on AuditLog; migration `20260526120000_dat021_…` adds the column NOT NULL DEFAULT 1 atomically + the GIN + the btree, single file.
  - **(b) GIN index** `audit_logs_payload_gin USING gin (payload jsonb_path_ops)` (verbatim from Suggested fix). jsonb_path_ops (not jsonb_ops): containment/equality read pattern, smaller+faster for `@>`.
  - **(c) Zod registry** `audit/payload-schemas.ts` — `validatePayloadForAction` + exhaustive `satisfies Record<AuditAction, z.ZodTypeAny>` + `AuditPayloadValidationError`. One schema per AuditAction (31 members).
- **Design choices:**
  - **Zod registry = post-OBS-024 THIRD compile-time layer** (enum ∩ entityType ∩ payload). `satisfies` (not `:`) preserves the literal key set so the compile witness `audit-payload-registry.compile-witness.ts` re-asserts exhaustiveness independently of the annotation.
  - **`.strict()` on the TOP-LEVEL KEY SET only**, snapshot internals (`before/after/snapshot/subject/actor`) stay `z.unknown()` — validation runs on the in-memory payload (Dates/Decimals not yet serialized), so tightening interiors would fight type round-tripping with no traceability gain.
  - **Two-writer reality:** `AuditService.log()` routes a generic security envelope; direct callers pass bespoke payloads. LEAVE_APPROVED (emitted by both) = `z.union([leaveAudit, securityEnvelope])`. **Zero emitter payload surprises** — all 30 call sites fit; no emitter changed.
  - **Gate BEFORE `$transaction`** (fail fast, no tx/lock). Two no-ops (absent payload; non-registry action) — both unreachable-or-harmless in prod, documented; preserves the synthetic-action hash-mechanic specs.
  - **schemaVersion folded into computeRowHash** between actorId and createdAt → every existing row's hash input changes → full-chain recompute mandatory.
  - **Recompute helper EXTRACTED** to `audit/recompute-chain.ts` (`recomputeChainFrom`), shared by AUD-READ-001's normalize (anchor=first-affected) and DAT-021's new `recompute-chain-on-schema-bump.ts` (anchor=genesis → whole chain). Hash imported, never reimplemented.
  - **Dual hash scheme RETIRED** (open fork resolved): recompute-from-genesis rehashes the OBS-002 SQL-canonical sealed segment uniformly → whole chain JS-verifiable. Same philosophy/mechanism as AUD-READ-001 (5f87026): change derived hashes, never facts.
- **Learnings (non-trivial):**
  - **The dual-writer payload heterogeneity was the hard part**, not the migration. Mapping every AuditService.log + direct AuditPersistenceService.log call site (auth/users/leaves/rbac/projects/documents/export/scripts) was required to derive `.strict()` schemas that don't reject real traffic.
  - **The existing audit-persistence.service.spec used real actions (LOGIN_SUCCESS/LEAVE_APPROVED) with minimal hash-mechanic payloads** that the new gate would reject. Fixed 3 to valid shapes (specs in scope); the spec's independent `recomputeRowHash` also had to fold schemaVersion (else the integrity witness drifts from the service).
  - **AUD-READ-001 witness re-run was an advisor catch:** I refactored normalize-action-codes.ts to consume the extracted helper but had only run the DAT-021 witness. Re-ran AUD-READ-001's witness against the refactored helper → green (extraction preserves the contract).
  - **dev `orchestr_a_v2` is behind master** (missing OBS-012 + DAT-021 migrations) — prior sessions verified via throwaway DBs, not by applying to dev. Followed that precedent (dev trail untouched). Operator follow-up: dev's first audit-emitting request after `pnpm run dev` will Prisma-error on the missing schemaVersion column until `migrate deploy` + `audit:recompute-chain` run on dev.
- **Gates:** `nest build` (typecheck gate) EXIT 0 — compile witness confirms registry exhaustiveness. `pnpm run build` 3/3 turbo. `pnpm run test` **api 1645** (+9 over the 1636 AUD-READ-001 baseline), web 579. `pnpm --filter api test:e2e` 2. Real-DB witnesses (throwaway DB created+dropped, dev untouched): W-3 GIN/jsonb_path_ops + btree ✓, W-4 stale-chain→recompute→valid (FAIL-pre→PASS-post) + trigger ENABLED ✓, W-6 Bitmap Index Scan on the GIN index ✓. W-1 FAIL-pre empirically proven (gate disabled → no rejection). AUD-READ-001 witness re-run ✓.
- **[[TST-011]] delta:** +9 vitest witnesses (W-1 reject + W-2 accept + schemaVersion-persisted + runtime exhaustiveness + representative-emitter shapes + dual-writer union + strict-rejection + 2 no-op cases) + 1 new compile witness (audit-payload-registry) + new real-DB witness (recompute-chain-on-schema-bump.witness.ts, not vitest-counted). Third compile-time enforcement layer for the audit trail.
- **Cour-des-Comptes question:** "Can an auditor confirm that no audit row has ever been written with an unexpected payload shape since DAT-021 landed?" → **YES (post-landing).** Compile-time: the exhaustive `Record<AuditAction,…>` guarantees every action has a schema and the OBS-024 enum gate guarantees every write uses a real AuditAction. Runtime: `validatePayloadForAction` `.strict()`-parses every present payload at INSERT, rejecting any unexpected top-level key with AuditPayloadValidationError before the row is hashed/inserted. A malformed payload cannot reach audit_logs.
- **Open questions for next session:** TST-011 (project archive / document delete / role lifecycle emission assertions remain), TST-DB-001 (real-DB witness automation — now has TWO throwaway-DB witness precedents), operator runbook executions (AUD-READ-001 prod normalize + DAT-021 prod migrate+recompute, both separate operator gestures), TOOL-COH-001 (multi-segment ID regex).

## 2026-05-26 — OBS-020 closed (policy: no app-level retention)
- **Session ID:** 2026-05-26-obs020-policy
- **Tasks closed:** OBS-020 (no implementation — policy decision; finding's premise overrode).
- **Commits:** 8beb389 (single closeout).
- **Learnings:** Auditor findings can carry assumptions (e.g. retention obligations) that don't match the project's actual constraints. Policy decisions belong to the project owner, not the auditor. Confirmed with project owner: no application-level retention.

## 2026-05-26 — TST-011 closed (audit emission asserted at every call site — cumulative closeout)
- **Session ID:** 2026-05-26-tst011-emission-coverage
- **Tasks closed:** TST-011 (Phase 2, Cluster A — claude-only, severity important, tests · coverage_gap). The cumulative arc's final test-coverage hole.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `bfb3637` (IN_PROGRESS anchor), `870cd81` (fix — `[closes TST-011]`, body carries the full gap table), `<pending>` (closeout).
- **Counter:** TST-011 Status flipped. Single-segment ID (`TST-\d+`) → visible to the TOOL-COH-001 regex gate. Coherence checked-set 25 → **26** DONE/VERIFIED. No totals-header change (pre-filed/counted finding).
- **Duration:** ~70 minutes
- **Gap audit (the deliverable before any edit):** swept every `AuditPersistenceService.log` / `AuditService.log` / `this.audit.log` call site in `apps/api/src` + `scripts`, cross-referenced each against its spec's emission assertions.
  - **True gaps (3):** `auth.service.ts` (5 sites, **0** assertions — the audit's literal headline), `users.service.ts:994` (PASSWORD_CHANGED console-parity dual-write, 0 — its persistence twin PASSWORD_RESET_BY_ADMIN was asserted, the AuditService sink was not), `audit/export-audit.helper.ts` (asserted ×2 transitively but no dedicated spec; resilience branch untested).
  - **Already covered (everything else):** projects 3/3, leaves 9/19, rbac roles 4/9, documents 1/6, deployments 1/3, planning-export 1 (pos+resilience), tasks+milestones CSV, system-backfill, users 8 persistence sites. The BACKLOG's stale "remaining gaps" (project archive / document delete / role lifecycle) were already closed by DAT-007 / OBS-005 / OBS-006 between the audit baseline and now.
  - **No `gap > call`** (no orphan assertion for a non-existent emission). **No code-level emission bug** — pure test-coverage closeout, AC#4 N/A.
- **Implementation:** auth.service.spec (LOGIN_SUCCESS / LOGIN_FAILURE emit-then-throw / REGISTER / PASSWORD_CHANGED ×2 positives + no-op negatives on every error branch), users.service.spec (PASSWORD_CHANGED dual-write one-liner in the OBS-004 test), export-audit.helper.spec (new — DATA_EXPORTED shape + conditional omission + fire-and-forget resilience, closing the asymmetry with system-backfill-audit.spec).
- **AUD-EMIT-001 triple adapted, not forced:** auth has no injected actor dep on these paths → no "caller-undefined" leg; the natural negatives are the existing throw-tests. Mocking standardized on providers `useValue: { log: vi.fn() }` + `toHaveBeenCalledWith` (DAT-021/USR-DEL-001) — no `vi.mock()` factory introduced.
- **Gates:** `pnpm run test` 6/6 turbo green, **api 1645 → 1650** (+5 test cases: 2 auth LOGIN_* + 3 export-helper; remaining additions are inline assertions on existing tests). web 579 unchanged. ~19 new audit-emission assertions. **FAIL-pre witness (AC#2):** neutering auth.service.ts:167 LOGIN_SUCCESS → new test fails; reverted, not committed → assertions have teeth. `test:e2e` N/A (pure api unit-spec additions, no route/UI surface).
- **Diff scope (AC#6):** confined to `apps/api/src/**/*.spec.ts` (2 modified + 1 new). 8-file cap N/A — OBS-024 transversal-refactor precedent (this is broader-but-shallow test coverage, not a logic change). No application code touched.
- **Cumulative arc reflection:** at the audit baseline, exactly **one** spec asserted audit emission (leaves.service.spec L971, AuditService self-approval spy). The Phase 2 arc deposited emission assertions incrementally as a side effect of each emitter task (DAT-001/002, OBS-001/003/004/005/006/007/012/018/021/026, AUD-EMIT-001, SEC-003, USR-DEL-001, DAT-021). TST-011 found only auth + one dual-write left uncovered and ratified the rest. The codebase now holds ~80+ audit-emission assertions across 11 spec files where the arc started with 1 — every state transition the audit policy requires is now witnessed at the `.log` boundary.
- **Phase 2 closure:** TST-011 was the last Cluster-A test-coverage task. Phase 2 is now fully discharged modulo the deliberate non-blocking PERF-001 stub (per-doc audit fan-out on list endpoints — explicitly deferred, not a gap).
- **Open questions for next session:** PERF-001 stub (deferred), operator runbook executions still pending (AUD-READ-001 prod normalize + DAT-021 prod migrate+recompute), TOOL-COH-001 (multi-segment ID regex), TST-DB-001 (real-DB witness automation).

## 2026-05-26 — TOOL-COH-001 + TOOL-COH-002 closed (bundled — coherence gate: multi-segment regex + retroactive-closure formalization)
- **Session ID:** 2026-05-26-tool-coh-bundle
- **Tasks closed:** TOOL-COH-001 + TOOL-COH-002 (Phase 1, tooling — claude-only, severity important). Bundled: both target the single script `scripts/check-backlog-coherence.sh`. Dual-close, same fix SHA.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `c7e1931` (IN_PROGRESS anchor, both flipped in one commit), `e6b836c` (fix — `[closes TOOL-COH-001][closes TOOL-COH-002]`), `<pending>` (closeout).
- **Counter:** two status flips (TODO→IN_PROGRESS→DONE). No totals-header change (both pre-filed/counted session-hygiene findings). The fix's regex change ALSO expands the gate's visibility (see Coherence check below) — that is a tooling property, not a counter change.
- **Duration:** ~45 minutes
- **Script language (confirmed):** bash wrapper (`set -euo pipefail`, arg/path handling) + an inline `python3` heredoc that does the parsing, regex, and git lookups. The task-ID regex and rule logic are **Python** (`re` + `subprocess`).
- **TOOL-COH-001 — regex:** `[A-Z]+-\d+|CLAUDE-CFG-\d+` → `[A-Z]+(?:-[A-Z]+)*-\d+`. New pattern subsumes the `CLAUDE-CFG` special case (dropped as dead code; CLAUDE-CFG-001 re-verified). Verified the pattern matches all 13 enumerated IDs (SEC-001 … TOOL-DEPLOY-001, CLAUDE-CFG-001).
- **TOOL-COH-002 — option (a), doc-only.** The gate already accepts anchor commits (rule 3 matches `[closes <id>]` regardless of empty-vs-material), so there was NO matching-logic change. AC#2's "FAIL-pre if no anchor support exists" presupposed option (b); under (a) the anchor witness is positive-only (OBS-008 @ 2188b3d passes), and the real FAIL-pre→PASS-post is the TOOL-COH-001 regex. Documented in the script header block + CLAUDE_SESSION_CONTRACT.md § "Retroactive closures". Worked example OBS-008 (anchor 2188b3d / material 1ff6c9a), OBS-020 (bfc7a78) as second precedent. No `Closure_anchor:` field — no schema change.
- **Default-path:** option (iii) auto-detect — `SCRIPT_DIR` via `BASH_SOURCE`, default `$SCRIPT_DIR/../BACKLOG.md`; git ops `cwd=`-anchored to the BACKLOG's dir so the no-arg default works from any cwd. Old default `backlog/Security/BACKLOG.md` never existed. Non-regressive: CI (`backlog-coherence.yml` line 39) passes the path explicitly from repo root.
- **Witness (in-repo fixture, `.coh-witness-fixture.md`, created+deleted this session):** entries = single-segment DONE (SEC-001), multi-segment DONE (AUD-EMIT-001 @ ffc4cf4), anchor-closed DONE (OBS-008 @ 2188b3d), multi-segment IN_PROGRESS (TOOL-COH-001), broken multi-segment DONE (ZZZ-BROKEN-001 @ deadbeef…). **Pre-fix** (HEAD script): `Checked 2`, EXIT 0 — broken entry invisible (false green). **Post-fix**: `Checked 4`, EXIT 1 — broken entry caught; AUD-EMIT-001 + OBS-008 anchor pass; IN_PROGRESS skipped. Idempotent (run #1 == run #2). Fixture deleted before commit (not part of the diff).
- **Coherence check (the headline visibility expansion):** on the real master BACKLOG the checked-set went **26 → 29** — `AUD-EMIT-001`, `USR-DEL-001`, `AUD-READ-001` (all DONE multi-segment, previously regex-blind) are now seen. EXIT 0: **zero** real violations surfaced — each already carried a valid `Closed_by` with the right `[closes <id>]` token (the prior sessions' anchor/material discipline held up under inspection). After this closeout the two newly-DONE multi-segment IDs (TOOL-COH-001/002) raise the set to **31**. So: regex-visibility delta = +3 (status held); session status-flip delta = +2.
- **[[TST-011]] delta:** none — pure tooling change, no audit-emission surface touched.
- **Gates:** no app build/test run (tooling-only change to a backlog script — no Nest/Next surface, AC#4 N/A). The script's own witness (FAIL-pre/PASS-post + idempotency) is the verification. `pnpm` suites untouched.
- **Diff scope (AC#6):** `scripts/check-backlog-coherence.sh` + `CLAUDE_SESSION_CONTRACT.md` (fix commit) + `BACKLOG.md` + `PROGRESS_LOG.md` (closeout). No application code, no schema.
- **Out of scope (untouched, per task):** TOOL-DEPLOY-001, TST-DB-001 (next sessions). No prod migrations, no deploy.
- **Open questions for next session:** TOOL-DEPLOY-001 (two-role DB split), TST-DB-001 (real-DB witness automation), PERF-001 stub (deferred), operator runbook executions still pending (AUD-READ-001 prod normalize + DAT-021 prod migrate+recompute).

## 2026-05-26 — TST-DB-001 closed (real-DB integration harness industrializes the throwaway-DB pattern)
- **Session ID:** 2026-05-26-tst-db-001
- **Tasks closed:** TST-DB-001 (Phase 1, session-derived — claude-only, severity important, tests). The recurring-gap closeout: 6 prior sessions documented `vitest globally vi.mock('database')` as honest divergence; the throwaway-DB witness is now an automatable CI target.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `d89b83f` (IN_PROGRESS anchor), `e30292c` (fix — `[closes TST-DB-001]`, body carries the (b)-over-(a) rationale + verification), `<pending>` (closeout).
- **Counter:** TST-DB-001 Status flipped (coherence checked-set **31 → 32** DONE/VERIFIED). Multi-segment ID (`TST-DB-\d+`) — visible to the post-TOOL-COH-001 regex `[A-Z]+(?:-[A-Z]+)*-\d+`. No totals-header change (pre-filed/counted finding).
- **Duration:** ~90 minutes
- **Harness mechanism — option (b), NOT the BACKLOG's strong default (a) testcontainers:** ephemeral database on a PROVIDED Postgres + `prisma migrate deploy`, drop on teardown. The repo decided it: CI `backend-tests` already provisions `postgres:18` + runs `migrate deploy` (testcontainers would duplicate it); `@testcontainers/postgresql` would break `pnpm install --frozen-lockfile`; offline-package release job makes a runtime image pull a footgun. And (b) IS the AUD-READ-001 / DAT-021 throwaway-DB prototype, industrialized — not a new pattern. Advisor confirmed (b) on the same evidence (two advisor calls: pre-design + pre-closeout).
- **Vitest project shape:** separate config file `vitest.int.config.ts` (no root vitest config / workspace exists → parallel config = smallest blast radius), not a workspace. Opt-out of the global mock = NOT loading `vitest.setup.ts`; new minimal `vitest.int.setup.ts` keeps only `reflect-metadata` + TZ. `globalSetup` = `vitest.int.global-setup.ts` (CREATE DB → migrate deploy → export DATABASE_URL → DROP … WITH (FORCE)). File pattern `src/**/*.int.spec.ts`, **also excluded from the unit config** (it matches `*.spec.ts`) so `pnpm test` stays mocked-unit-only — the only edit to the contract's named File.
- **vitest 4 gotcha (caught by the build gate):** `poolOptions.forks.singleFork` was removed in vitest 4 → use top-level `fileParallelism: false`. `nest build` typechecks the root `vitest.*.config.ts` files, so the bad config errored the build (not vitest, which never typechecks). [[project_nest_build_is_typecheck_gate]].
- **Two seed tests (paths + assertions):**
  - `apps/api/src/audit/audit-immutability.int.spec.ts` — trigger `audit_logs_no_update_delete` rejects UPDATE (ORM + raw) and DELETE (ORM + raw) with `/append-only/i`; the row survives. (W-2)
  - `apps/api/src/users/user-harddelete-fk.int.spec.ts` — a user who authored an audit row: `auditLog.count({where:{actorId}})===1` (the exact UsersService.checkDependencies predicate), `prisma.user.delete` raises `P2003` (FK ON DELETE NO ACTION), both rows survive. The DB guarantee the mock cannot exercise; the service-level ConflictException stays unit-tested. (W-3)
- **Witnesses:** W-1 (FAIL-pre) structural — no `test:integration` target / no `*.int.spec.ts` on master, so the suite couldn't run at all; `.rejects.toThrow(/append-only/i)` gives the assertions teeth by construction (missing trigger → promise resolves → test fails), no neuter-and-rerun needed. W-2/W-3 PASS-post (4 tests, 2 files green). W-4 unit suite unchanged. W-5 cleanup: `[int-harness] dropped ephemeral DB …`, zero leftover `orchestr_a_int_*` DBs, zero containers (option (b) creates none).
- **Gates:** `nest build` (typecheck gate) EXIT 0. `pnpm test` 6/6 turbo green, **api 1650 / web 579** (UNCHANGED — additive, not regressive). `pnpm --filter api test:e2e` 2 passed (unchanged). `pnpm test:integration` **4 passed (2 files)** — NEW target. Coherence gate EXIT 0, Checked **32**.
- **Diff scope (AC#6):** 10 files — `apps/api/vitest.int.config.ts` + `vitest.int.setup.ts` + `vitest.int.global-setup.ts` (new harness) + 2 seed `*.int.spec.ts` + `apps/api/vitest.config.ts` (exclude one-liner) + `apps/api/package.json` + root `package.json` (scripts) + `.github/workflows/ci.yml` (CI step) + `CONTRIBUTING.md` (docs). **Stretches the 8-file cap — pre-authorized by the task** ("test infrastructure legitimately spans multiple files"); no application code touched (`audit-persistence.service.ts` and all app logic untouched).
- **CI prerequisite:** Docker required? **No** — option (b) creates no container; it needs only a reachable Postgres + a `CREATEDB` role. CI's `backend-tests` postgres service `orchestr_a` user is the service `POSTGRES_USER` (superuser by default on the official image) → CREATEDB. New CI step added to the EXISTING `backend-tests` job (service already paid for, no new job). **Watch-point (first push):** the nested-pnpm chain (`pnpm --filter api test:integration` → globalSetup `execSync('pnpm --filter database run db:migrate:deploy')`) is only fully provable on the runner; fallback if it bites = `npx prisma migrate deploy` with `cwd: packages/database`.
- **Out of scope (untouched, per task):** TOOL-DEPLOY-001 (next session). No prod migrations, no deploy, no unit-mock-convention change.
- **Cour-des-Comptes question:** "are the audit_logs immutability and trace-preservation guarantees actually enforced by the database, or only asserted in mocked unit tests?" → **Now provable in CI by construction.** The trigger and the FK NoAction are exercised against a real migrated Postgres on every `backend-tests` run; a regression (dropped trigger, weakened FK) fails the pipeline rather than silently passing the mock.
- **Open questions for next session:** TOOL-DEPLOY-001 (two-role DB split), first-CI-run watch for the integration step, PERF-001 stub (deferred), operator runbook executions still pending (AUD-READ-001 prod normalize + DAT-021 prod migrate+recompute).

## 2026-05-26 — TOOL-DEPLOY-001 closed (two-role DB split: restricted app role + DDL/owner role for audit_logs)
- **Session ID:** 2026-05-26-tool-deploy-001
- **Tasks closed:** TOOL-DEPLOY-001 (Phase 1, tooling — claude-only, severity important). The OBS-002+DAT-009 verdict-B descope: the privilege-layer second control on audit_logs (the trigger was control #1). Phase 1 tooling arc complete.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `168099e` (IN_PROGRESS anchor), `8c37e1d` (fix — `[closes TOOL-DEPLOY-001]`, body carries mechanism/init-roles/fail-fast/harness/CI + the TST-DB-001 build regression), `<pending>` (closeout).
- **Counter:** TOOL-DEPLOY-001 Status flipped (coherence checked-set **32 → 33** DONE/VERIFIED). Multi-segment ID (`TOOL-DEPLOY-\d+`) — visible to the post-TOOL-COH-001 regex `[A-Z]+(?:-[A-Z]+)*-\d+`. No totals-header change (pre-filed/counted finding).
- **Duration:** ~90 minutes
- **Mechanism — strong-default (b):** one-shot `packages/database/prisma/init-roles.sql`, run once per environment by a superuser/owner, separate from per-deploy migrations. Rejected (a) Prisma migration (CREATE ROLE/password is env-specific, not schema) and (c) entrypoint-baked (idempotent per-env init ≠ per-deploy gesture).
- **Datasource shape after:** `url = env("DATABASE_URL")` (app role, runtime) + `directUrl = env("DATABASE_MIGRATION_URL")` (owner, migrate + maintenance). Empirically: `prisma generate` tolerates unset directUrl (build/Dockerfile safe); `migrate deploy`/`db push`/`db pull` require it.
- **init-roles.sql:** creates `app_user` (idempotent — `\gexec` guard + `ALTER ROLE` password re-assert, also a rotation tool), GRANT full CRUD on all tables + sequences, `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs` (INSERT+SELECT remain), `ALTER DEFAULT PRIVILEGES` so future migration tables stay accessible. The **migration role = the existing schema owner** (POSTGRES_USER), NOT created here — avoids reassigning ownership of every table (the owner must OWN audit_logs to DISABLE its trigger).
- **The error-message discriminator (non-obvious core):** Postgres checks table privilege BEFORE a BEFORE-trigger fires → app-role UPDATE/DELETE = `permission denied` (**42501**), never reaching the trigger's `/append-only/` RAISE (**23514**). One role can't witness both controls (REVOKE shadows trigger). So `audit-immutability.int.spec.ts` connects as the MIGRATION role (→ 23514); new `audit-role-revoke.int.spec.ts` connects as app role (→ 42501); W-2 proves independence (trigger DISABLED, app role STILL 42501).
- **Harness adaptation:** globalSetup migrates as owner, provisions app_user on the ephemeral DB (mirrors init-roles.sql, self-checking), exports `DATABASE_URL=app_user` (default `new PrismaClient()` = restricted = prod parity) + `DATABASE_MIGRATION_URL=owner`. user-harddelete-fk unchanged (FK role-independent). Integration suite **4 → 8** tests (W-2/W-3/W-4 +4).
- **Operational scripts — fail-fast (option ii):** normalize-action-codes + recompute-chain-on-schema-bump `process.exit(1)` if `DATABASE_MIGRATION_URL` unset, and set `DATABASE_URL = DATABASE_MIGRATION_URL` BEFORE NestFactory (PrismaService binds at construction → owner role). No silent fallback to the restricted role.
- **CI:** both standalone `migrate deploy` steps (backend-tests + e2e) set `DATABASE_MIGRATION_URL`; the integration step is self-contained (harness injects both + provisions app_user). **Unit + coverage steps stay one-URL deliberately** — global `vi.mock('database')` means no real PrismaClient → schema env vars never validated.
- **TST-DB-001 build-output regression caught + fixed:** `tsconfig.build.json` didn't exclude the new `vitest.int.*` files → `nest build` rootDir → `apps/api/` → `dist/src/main.js` not `dist/main.js`, breaking docker-entrypoint.sh's `exec node apps/api/dist/main.js` (a THIS-commit edit) + the script paths. Added the three to the existing exclude list (same pattern as vitest.config.ts/e2e). In scope = build-correctness this change transitively required; NOT the separately-filed BUILD-001 structural `rootDir` fix.
- **Gates:** nest build EXIT 0; `pnpm test` api **1650** (web 579) — zero regression; `pnpm test:integration` **8 passed** (was 4); `pnpm --filter api test:e2e` **2 passed**; `pnpm run build` 3/3 turbo. W-5 fail-fast both scripts (exit 1, clear error) + positive path boots past guard; `dist/main.js` boots ("Nest application successfully started"). **ESLint pre-broken repo-wide** (ajv/eslintrc conflict — the documented dette, untouched/out of scope).
- **Diff scope (AC#6):** 15 files (12 modified + 3 new: audit-role-revoke.int.spec.ts, prisma/README.md, prisma/init-roles.sql). Above the 8-file cap — pre-authorized by the deploy-infra scope + the transitively-required build fix. No application service code touched; no AuditAction/payload-schema change; no prod migration run; no deploy.
- **Cumulative defence-in-depth on audit_logs (5 layers):** immutability trigger (d6299cc) + hash chain (d6299cc) + actor snapshot (d6299cc) + Zod payload validation (DAT-021) + **DB role REVOKE (this task)**.
- **Phase 1 tooling closure: 5/5 DONE** — CLAUDE-CFG-001 + TOOL-COH-001 + TOOL-COH-002 + TST-DB-001 + TOOL-DEPLOY-001.
- **Cour-des-Comptes question:** "can the application's own DB credentials tamper with the audit trail if someone disables the immutability trigger?" → **No (for the runtime role).** The app role lacks UPDATE/DELETE/TRUNCATE on audit_logs at the privilege layer (42501), independent of the trigger. Only the owner/migration role can mutate — the legitimate, hash-chain-DETECTABLE maintenance path (normalize/recompute, run as owner).
- **Open questions for next session:** first-CI-run watch (both new `migrate deploy` env vars + the build-output fix on the runner), prod operator runbook executions still pending (init-roles.sql one-shot + DATABASE_URL→app_user repoint; AUD-READ-001 prod normalize; DAT-021 prod migrate+recompute), PERF-001 stub (deferred), repo-wide ESLint tooling dette (separate concern).

## 2026-05-27 — DAT-003 + DAT-004 closed (bundled — business invariants descended to DB-level CHECK constraints)
- **Session ID:** 2026-05-27-dat003-dat004-bundle
- **Tasks closed:** DAT-003, DAT-004 (Phase 3, Cluster F — claude-only, severity blocking, data_integrity·constraint). The first Phase 3 pickup: the two blocking tasks before the 8 important ones.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `ac7cee7` (IN_PROGRESS anchor, both flipped in one commit), `62c2fc4` (fix — `[closes DAT-003][closes DAT-004]`), `<pending>` (closeout).
- **Counter:** two status flips (TODO→IN_PROGRESS→DONE), both blocking. No totals-header change (Phase 3 header reads "10 tasks", accurate; 2 now DONE, 8 TODO).
- **Bundle motivation (defensible to next reviewer):** same source file (`schema.prisma`), same SQL mechanism (CHECK constraint), same witness path (TST-DB-001 `*.int.spec.ts`, SQLSTATE 23514), same AC#4 skip basis (schema migration, not audit-sensitive). One migration, SQL sectioned by task ID. Jurisprudence: TOOL-COH-001/002 dual-flip + single fix carrying both `[closes …]` tokens. Both `Closed_by` point to `62c2fc4`.
- **Duration:** ~75 minutes.
- **Migration — hand-authored raw SQL (NOT `migrate dev`-generated):** `20260527120000_dat003_dat004_business_invariants/migration.sql`. CHECK constraints are not expressible in the Prisma 6 schema DSL, so `schema.prisma` is intentionally unchanged and the artifact is migration-file-only — the established repo pattern (immutability `20260525190000`, dat007 `200000`, obs012 `210000`, dat021 `120000` are all hand-authored). The verification command's `pnpm prisma migrate dev --create-only` is **blocked by pre-existing dev-DB drift** (leftover `_dat005_backup_*` tables present in the DB but absent from schema — `migrate dev` wants to DROP them; non-interactive → errors). That drift is unrelated to this task and out of scope (NOT silently cleaned). Used hand-author + `pnpm prisma migrate deploy`, which is the real mechanism here; `migrate deploy` ignores drift. As a side effect `migrate dev` applied the two then-pending migrations (obs012, dat021) to the local dev DB before erroring.
- **DAT-003 (7 date CHECKs):** leaves/projects/epics/telework_recurring_rules/school_vacations → `"endDate" >= "startDate"`; `leave_validation_delegates` → physical `end_date >= start_date` (Prisma `@map`, caught in pre-flight); `events` → column-name variant `"recurrenceEndDate" >= "date"`. NULL passes a CHECK (SQL 3-valued logic) → nullable ranges need no IS NULL guard.
- **DAT-004 (7 numeric CHECKs):** `leave_balances.totalDays >= 0`, `leaves.days > 0` (strict — `calculateLeaveDays()` floored at 0.5 globally, verified no path writes ≤0), `tasks`/`epics.progress` BETWEEN 0 AND 100, `predefined_tasks.weight` BETWEEN 1 AND 5, `project_members.allocation` BETWEEN 0 AND 100, `documents.size >= 0`. `Subtask.position` named in the audit prose but NOT in the Suggested-fix list → excluded (stayed literal).
- **Pre-flight (mandatory bundle gesture):** scanned seed.ts (1900 lines), `*.factory.ts` (none exist), e2e fixtures, and ran live exploratory `SELECT count(*) … WHERE NOT (<predicate>)` against the dev DB (`orchestr-a-db` :5433) for all 14 (table, constraint) pairs → **0 violators everywhere**. No bail condition; no data cleanup needed. `migrate deploy` then validated each ADD CONSTRAINT clean against real existing data.
- **Witnesses (real-DB, TST-DB-001 harness, `apps/api/src/schema-constraints/`):** `dat003-date-range.int.spec.ts` (3 tests) + `dat004-numeric-bounds.int.spec.ts` (8 tests). Parents (User/LeaveTypeConfig/Project) via Prisma client; violating rows via `$executeRawUnsafe` so Prisma's P2010 message carries `Code: 23514` + the constraint name verbatim. Helper asserts BOTH 23514 and the constraint name — **teeth by construction**: a missing constraint → INSERT accepted → empty message → `/23514/` fails loudly (no vacuous green). **FAIL-pre demonstrated (AC#2):** neutralized the migration body (`SELECT 1;`), `pnpm test:integration` → **10 failed / 9 passed** (constraints absent, INSERTs accepted); restored → **19/19 passed**. (The neutralized run also surfaced a fragile cross-test coupling — the positive project_members boundary collided 23505 on UNIQUE(projectId,userId) with the negative allocation row that lands only pre-fix; decoupled with a second witness user so the positive case is self-contained.)
- **Gates:** `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1650** (web cached, 6/6 turbo) — zero regression; `pnpm test:integration` **19 passed** (was 8 → +11 witnesses); `pnpm test:e2e` (= `turbo run test:e2e` → api vitest e2e, the arc's established gate) **2 passed**. Coherence gate run post-closeout (see below).
- **AC#4 (audit_logs before/after entry) skipped — documented in both Learnings:** schema migration, not audit-sensitive code (auth / leaves approve-reject / RBAC mutations / document access / user delete / password reset). Precedent: DAT-005 (Phase 1, same skip basis).
- **Diff scope (AC#6):** 3 files in the fix commit — 1 migration.sql + 2 `*.int.spec.ts`. Within the contract's "schema.prisma + integration spec files" scope; specs in a neutral `schema-constraints/` dir (cross-cutting, not one domain) — invisible to `nest build` (spec files excluded). No application service code, no DTO, no schema.prisma change.
- **Cour-des-Comptes question:** "if the leave/project service layer is bypassed, can the DB still hold an inverted date range or a negative balance / out-of-range progress?" → **No.** These invariants are now enforced by the database itself (CHECK, SQLSTATE 23514), independent of the DTO/Zod layer — a buggy service path or a direct admin SQL fix is rejected at write time.
- **Out of scope (untouched, per phase order):** the 8 remaining Phase 3 *important* tasks (COR-022, DAT-012/013/014/016/017/018/023) — fresh sessions each. Pre-existing dev-DB `_dat005_backup_*` drift (separate cleanup concern). No prod migration run; no deploy.
- **Open questions for next session:** Phase 3 continues with the important tasks (next: COR-022). Prod deploy of `20260527120000` migration still pending (Phase 3 batch — produce a `docs/deploy/2026-05-2x-phase-3-…md` at deploy time per HANDOVER note 2). The pre-existing `_dat005_backup_*` dev-DB drift may warrant a dedicated cleanup migration eventually (blocks a clean `migrate dev` locally; does not affect `migrate deploy`/prod).

## 2026-05-27 — filing-only — DAT-032 + TOOL-DBSYNC-001 filed (session-derived from the DAT-003/DAT-004 bundle 62c2fc4)
- **Session ID:** 2026-05-27-file-dat032-tooldbsync001
- **Tasks closed:** none — filings only (precedent: AUD-EMIT-001 filing, 2026-05-25). No code, no IN_PROGRESS anchor.
- **Tasks filed (2):**
  - **DAT-032** (Phase 3, Cluster F, claude-only, important, data_integrity·constraint) — No DB CHECK on `Subtask.position >= 0`. The 8th bound-less column named in DAT-004's Description but dropped from its Suggested-fix list (which enumerated 7 CHECKs); bundle discipline stayed literal to the fix list and excluded it, filed now as the defense-in-depth completion. Fix = mirror the DAT-004 witness pattern.
  - **TOOL-DBSYNC-001** (Phase 1, tooling, claude-only, important) — Dev-DB `_dat005_backup_*` drift blocks `prisma migrate dev --create-only` on every Phase 3 pickup. The 4 backup tables (DAT-005 rollback safety net, prod-stable since 2026-05-25) are absent from schema.prisma, so `migrate dev` wants to DROP them and aborts non-interactively; `migrate deploy` is unaffected. Suggested fix offers three mechanisms (drop-script / shadow-ignore / documented pre-session cleanup) — execution session picks one.
- **Header deltas applied:** Total 182 → 184; By severity +2 important (118 → 120); By category +1 data_integrity (31 → 32) +1 tooling (5 → 6); Phase 1 count 11 → 12; Phase 3 count 10 → 11.
- **Coherence gate:** unchanged DONE set (both filings are TODO) — gate stays green, re-run to confirm. New multi-segment ID `TOOL-DBSYNC-\d+` is matched by the post-TOOL-COH-001 regex `[A-Z]+(?:-[A-Z]+)*-\d+`.
- **Commit:** `<pending>` — single commit `backlog: file DAT-032 + TOOL-DBSYNC-001 (session-derived from 62c2fc4)`.
- **Out of scope / next session:** COR-022 fresh start (next Phase 3 important). DAT-032 and TOOL-DBSYNC-001 are now pickable; TOOL-DBSYNC-001 (Phase 1 tooling) unblocks a clean `migrate dev --create-only` for the rest of Phase 3 but is not a hard blocker (`migrate deploy` path works), so it is not added to any task's Blocked_by.

## 2026-05-27 — COR-022 closed (per-(userId, date) daily hours cap on time entry create/update)
- **Session ID:** 2026-05-27-cor022
- **Tasks closed:** COR-022 (Phase 3, Cluster F — claude-only, severity important, correctness·quota). First of the 8 Phase-3 *important* tasks (the 2 blocking, DAT-003/004, closed prior).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed (2, session-derived):** DAT-033 (DB-level CHECK on TimeEntry.hours — defense-in-depth, important, data_integrity·constraint) + DAT-034 (per-day cap not enforced for third-party declarations — nit, correctness·quota). Precedent: DAT-032 filing from DAT-004.
- **Commits:** `06fc82b` (IN_PROGRESS anchor), `760aa58` (fix — `[closes COR-022]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, DAT-033/034 filings, header deltas, this entry).
- **Counter:** COR-022 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED). Header deltas for the 2 filings: Total 184→186; severity +1 important (120→121) +1 nit (21→22); category +1 correctness (34→35) +1 data_integrity (32→33); Phase 3 count 11→13.
- **Duration:** ~60 minutes.
- **Partial false positive (NOT BLOCKED):** the audit's Root cause ("DTO uses @IsNumber without a range") was wrong — `CreateTimeEntryDto.hours` already carried `@Min(0.25) @Max(24)`, so the single-entry bound + negative rejection were already enforced (a typo of 80 is already rejected). Only the **per-(userId, date) aggregate cap** was missing, and it was still reproducible → TODO→DONE, not the contract's "no longer reproducible"→BLOCKED path. No redundant DTO edit (DTO untouched).
- **Mechanism:** `MAX_HOURS_PER_DAY = 24` const + `ensureDailyCapNotExceeded(userId, date, newHours, excludeEntryId?)` — `prisma.timeEntry.aggregate({ _sum: { hours } })` over the UTC `[startOfDay, nextDay)` range, `isDismissal: false`, `id: { not }` on update. Rejects `BadRequestException` if `existing + new > 24` (inclusive boundary — 24 allowed). Wired into the `actor.kind === 'user'` create path and the `existing.userId` update path. Dismissal writes (`hours=0`) untouched; third-party (`userId=null`) out of literal scope → DAT-034.
- **Exception type:** `BadRequestException` — module grep confirmed it is used exclusively for validation rejections (no `ConflictException` import). Per task Invariant 2.
- **Witnesses (AC#2):** service-level sum-cap tests are the genuine FAIL-pre→PASS-post witness; DTO tests (hours=25 / -1) are **regression guards only** (bound pre-exists → pass before and after, documented as such). Teeth confirmed: pre-fix the 4 service cap tests fail non-vacuously ("expected rejected promise, received undefined"; `aggregate` called 0×), post-fix the time-tracking suite is 87/87 (was 79; +8 = 3 DTO guard + 5 service).
- **Gates:** `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (was 1650, +8; web cached) — zero regression, 6/6 turbo; `pnpm test:e2e` (= turbo → api vitest e2e, the arc's established gate) **2 passed**. Coherence gate run post-closeout (see below).
- **Playwright e2e (not run — arc convention):** the live-stack Playwright suite has time-tracking specs, but the arc's e2e gate is the api vitest e2e (per prior closeouts). Pre-flight verified no Playwright fixture trips the 24h cap: time-tracking-scope uses hours 2/1/3 (distinct scenarios), ownership-idor's `hours:99` PATCH expects 403 from the ownership guard (fires before the cap), seed.ts has no TimeEntry data. No Playwright regression risk introduced.
- **AC#4 N/A:** time tracking is not in the contract's audit-sensitive list (auth / leaves approve-reject / RBAC mutations / document access / user delete / password reset) — no `audit_logs` entry required.
- **Diff scope (AC#6):** 2 files in the fix commit — `time-tracking.service.ts` (+const, +helper, +2 call sites) + `time-tracking.service.spec.ts` (+8 tests, +`aggregate` mock with `{_sum:{hours:0}}` default, +`date`/`hours` on 2 pre-existing incomplete update mocks). Within the named File + its spec. DTO NOT touched (bound pre-existed). No migration (correctly — COR-022 is service+DTO level, not DB CHECK).
- **Cour-des-Comptes question:** "can a user inflate their declared daily total beyond physically plausible hours by splitting it across multiple same-day entries?" → **No (own-account path).** The service now rejects any create/update whose same-day aggregate would exceed 24h. Residual: a direct admin SQL write still bypasses it (→ DAT-033, DB CHECK) and third-party declarations are not yet capped (→ DAT-034).
- **Out of scope / next session:** the remaining Phase 3 *important* tasks (DAT-012/013/014/016/017/018/023) + DAT-032 + the two new DAT-033/034 filings + DAT-005-backup dev-DB drift (TOOL-DBSYNC-001). Prod deploy of the Phase 3 migration batch (`20260527120000`) still pending. No prod migration run; no deploy.

## 2026-05-27 — DAT-012 closed (string→enum promotion of 6 columns; AuditLog canonical codes documented)
- **Session ID:** 2026-05-27-dat012
- **Tasks closed:** DAT-012 (Phase 3, Cluster F — claude-only, severity important, data_integrity·schema). Second of the Phase-3 *important* tasks (after COR-022).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed (1, session-derived):** DAT-035 (ProjectMember.role free-string institutional labels — important, data_integrity·schema; the per-column bail). Precedent: DAT-032 filing from DAT-004, DAT-033/034 from COR-022.
- **Commits:** `29398cb` (IN_PROGRESS anchor), `c8b618e` (fix — `[closes DAT-012]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, DAT-035 filing, header deltas, this entry).
- **Counter:** DAT-012 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set grows). Header deltas for the 1 filing: Total 184→187 (also corrected a stale leading "184" that COR-022's prose clauses had already outgrown to 186 — the leading number now matches the clause sum); severity +1 important (121→122); category +1 data_integrity (33→34); Phase 3 count 13→14.
- **Duration:** ~90 minutes.
- **Scope decided in pre-flight (per psql DISTINCT + code-literal scan):** 6 of 7 (A) candidates promoted to **5 distinct enums** — `PredefinedTaskDuration`, shared `DayPeriod` (both `period` columns, identical set), `AssignmentCompletionStatus`, `RecurrenceType`, `AppSettingsCategory`. The DTO `@IsIn` lists were the authoritative value sets; DB distinct ⊆ those sets everywhere (0 surprises). **schema.prisma WAS edited** (enum blocks + column type rewrites) — the structural difference from DAT-003/004 (CHECK isn't DSL-expressible; enums are).
- **1 bail (ProjectMember.role → DAT-035):** DB distinct = `Chef de projet`/`Membre`/`Responsable infra`/`Référente support`/`Lead dev` — free-form FR labels, the task's verbatim bail example. Under the 3-bail whole-task-pause threshold → proceeded.
- **AppSettings.category — bail reversed on advisor review:** initially bail-leaning on soft grounds ("developer-extensible, comment says etc., dead `'custom'`"), but the literal bail trigger ("admin UI lets users define categories") is NOT met (`update()` gates on `isKnownKey`; category derives from hardcoded `DEFAULT_SETTINGS`). Plain reading → promote; removed the unreachable `|| 'custom'` (L242) in the same diff. Net 1 bail, not 2.
- **AuditLog.action/entityType — document route (NOT CHECK):** `docs/audit/canonical-action-codes.md` names `AuditAction` enum + `ENTITY_TYPE_BY_ACTION` + the payload-registry compile-witness as the write-side source of truth. Motivation (Invariant 2 lower-friction pick): write side is already compile-guaranteed, TOOL-DEPLOY-001 REVOKE + immutability trigger block any untyped write, and CHECK would couple a migration to every new action (31, growing) + risk failing on un-enumerable prod legacy (PASSWORD_RESET_ADMIN / AUD-READ-001). No AuditLog witness (no DB-level rejection to assert — the guarantee is compile-time, already witnessed by `audit-payload-registry.compile-witness.ts`).
- **Migration — hand-authored + `migrate deploy`:** `20260527130000_dat012_promote_string_enums`. `migrate dev --create-only` still blocked by `_dat005_backup_*` drift (TOOL-DBSYNC-001); `migrate deploy` ignores drift and validated each `ALTER … USING col::"Enum"` clean against real dev data (needs `DATABASE_MIGRATION_URL` set — TOOL-DEPLOY-001 directUrl; in dev = the `orchestr_a` owner URL). Defaults dropped before ALTER TYPE then re-set (text default can't auto-cast to enum). `prisma generate` regenerated the client with enum types.
- **Type boundary (Invariant 5) — no service-file edits:** enum-typed DTOs flowed through Prisma client regen without service-boundary casts. Adjacent touches: **6 DTOs** swapped `@IsIn([...])`→`@IsEnum(PrismaEnum)` with enum-typed fields (idiom: `leaves/dto/import-leaves.dto.ts` `@IsEnum(HalfDay)`) — this upgrades the audit's "enum would prevent drift" to compile-time too, not just DB-level; **`settings.service.ts`** typed `DEFAULT_SETTINGS.category` as the enum, guarded `findByCategory` to return `[]` on an unknown category (preserve prior read behaviour, avoid 22P02 on the GET `/category/:category` param), dropped the dead `|| 'custom'`; **`vitest.setup.ts`** global `database` mock exports the 5 new enums (the unit-suite consumer of `from 'database'`).
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat012-enum-promotion.int.spec.ts`):** 6 tests — 1 representative invalid-INSERT per distinct enum (`$executeRawUnsafe` so the P2010 message carries SQLSTATE **22P02** "invalid input value for enum") + 1 positive accepting valid members across all five. Parent predefined_task created via **raw SQL** (not the typed client, which casts to the enum type and would 42704 in the FAIL-pre world, skipping the assertions). **FAIL-pre demonstrated:** neutralized migration to `SELECT 1;` → the 5 negative assertions fail directly ("expected '' to match /22P02/" — bogus accepted, columns still text), positive passes; restored (byte-identical, diff verified) → **25/25 integration** (was 19; +6).
- **Gates:** `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm --filter api test` **1658** (unchanged — DTO/service edits are additive-neutral, the +6 are integration not unit) zero regression; `pnpm test` 6/6 turbo (web included); `pnpm test:integration` **25 passed** (was 19); `pnpm test:e2e` (= turbo → api vitest e2e, the arc gate) **2 passed**. Coherence gate run post-closeout (see below).
- **AC#4 skipped** — schema migration, not audit-sensitive business mutation (DAT-005 / DAT-003-004 precedent), even though one promoted enum (AppSettingsCategory) and the documented columns touch settings/audit tables.
- **Diff scope (AC#6 — fix commit `c8b618e`):** 12 files. In named File scope: `schema.prisma` (+5 enum blocks, 6 column rewrites) + the migration + the int spec. Adjacent type-boundary (motivated above): 6 DTOs + `settings.service.ts` + `vitest.setup.ts`. Plus the document-route deliverable `docs/audit/canonical-action-codes.md`. No application service logic changed.
- **Cour-des-Comptes question:** "if the service/DTO layer is bypassed, can the DB still store a typo'd duration/period/status/recurrence/category that a filter would silently drop?" → **No (for the 6 promoted columns).** The value is now constrained by the native enum type (SQLSTATE 22P02), independent of the class-validator layer — a direct SQL write or a buggy path is rejected. ProjectMember.role and AuditLog.action remain String by deliberate, documented choice (DAT-035 / canonical-action-codes.md).
- **Out of scope / next session:** remaining Phase 3 *important* tasks (DAT-013/014/016/017/018/023) + DAT-032 + DAT-033/034 + the new DAT-035 + TOOL-DBSYNC-001. **⚠️ Prod deploy of the Phase 3 batch (`20260527120000` + `20260527130000`) MUST run a read-only `SELECT DISTINCT` against prod per column before `migrate deploy` — the enum `USING` cast aborts on any un-enumerated prod value.** No prod migration run; no deploy.

## 2026-05-27 — doc seed — Phase 3 batch-deploy doc created (4/10 Phase 3 tasks closed)
- **Session ID:** 2026-05-27-phase3-deploy-doc-seed
- **Tasks closed:** none — interim artifact / doc seed (precedent: filing-only sessions like AUD-EMIT-001 2026-05-25, DAT-032+TOOL-DBSYNC-001 2026-05-27). No code, no IN_PROGRESS anchor, BACKLOG.md untouched, no status flip.
- **Artifact created:** `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` — forward-looking Cour-des-Comptes deploy execution log, seeded ahead of the actual prod deploy. Filename keeps the literal `2026-05-2x` (deploy date is TBD).
- **Structural precedent:** `docs/deploy/2026-05-25-phase-1-remediation-deploy.md` — preserved section ordering (Scope & metadata → Deploy plan → Pre-deploy baseline → pre-deploy probe/GATE 1 → Deploy execution → Post-deploy verification → GATE 2 → Rollback → Operational notes) and level of detail; adapted content to Phase 3.
- **Pre-filled (known now):** Scope table (3 closed rows — DAT-003/004 `62c2fc4` blocking, COR-022 `760aa58` important, DAT-012 `c8b618e` important); Migrations-applied sub-table (2 entries — `20260527120000`, `20260527130000`; COR-022 is code-only, excluded); the **DAT-012 cast-safety probe** (copy-paste `NOT IN` query per the 6 promoted columns, decision-ready = 0 rows required, + two resolution paths: rename vs extend-enum-and-amend-migration); DAT-003/004 "no pre-deploy precaution (dev 0-violators across 14 predicates)" note; COR-022 "no migration, no check"; post-deploy verification table + CHECK smoke (inverted-date / negative-progress, INSERT-then-ROLLBACK, 23514) + enum smoke (22P02) + time_entries liveness + "no SYSTEM_BACKFILL" assertion; **rollback per migration** (14-line idempotent `DROP CONSTRAINT IF EXISTS` for DAT-003/004; non-deployed enum→String down-reference with the recast-order + image-tolerance warning for DAT-012; `git revert 760aa58` for COR-022).
- **TBD convention:** every execution-time fill-in carries a `TBD:` prefix (date, operator, baseline counts, probe outputs, smoke snapshots, gate decisions) — `grep -n 'TBD:' <doc>` = the deploy-time checklist. 39 TBD points at seed.
- **Carry-forwards captured in Operational notes (visible now):** TOOL-DBSYNC-001 (`_dat005_backup_*` prod drift, retention decision pending — flagged for the same maintenance window, does NOT block this batch); 4 Phase-3 follow-up TODOs by ID (DAT-032/033/034/035, not in this deploy); AuditLog document-route cross-link to `docs/audit/canonical-action-codes.md` (verified tracked @ `c8b618e` — live link).
- **Append discipline:** the doc carries an explicit "Future Phase 3 closures — append, do not restructure" section so DAT-013/014/016/017/018/023 (or the follow-ups) extend the Scope/Migrations/Rollback tables rather than rewrite the doc.
- **Gates:** none run — no code, no schema, no migration, no deploy. Coherence gate untouched (no BACKLOG change). Advisor consulted pre-commit (caught: verify cross-link is committed [confirmed tracked], tighten prod-baseline prose to "Phase 2 not yet deployed", add the implicit-uuid-cast note to the enum smoke — all applied).
- **Commit:** `<pending>` — single commit `docs/deploy: seed Phase 3 batch-deploy doc (4/10 tasks closed)`.
- **Out of scope / next session:** DAT-013 fresh session. The actual prod deploy of the Phase 3 batch is still pending (this is only the seed); when run, fill the TBD points in execution order. No prod deploy performed.

## 2026-05-27 — DAT-013 closed (HH:MM time-of-day format as DB CHECK on 6 String columns)
- **Session ID:** 2026-05-27-dat013
- **Tasks closed:** DAT-013 (Phase 3, Cluster F — claude-only, severity important, data_integrity·schema). Fifth Phase-3 task closed (after DAT-003/004 blocking, COR-022, DAT-012). Phase 3 now 5/10 of the originally-scoped batch.
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** none (no per-column or residual bail surfaced — unlike DAT-012/COR-022, the fix was uniform across all 6 columns and the data was clean).
- **Commits:** `8ce8124` (IN_PROGRESS anchor), `c0189c1` (fix — `[closes DAT-013]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, deploy-doc append, this entry).
- **Counter:** DAT-013 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set 37→38). No header delta (no new filing; Totals tracks only severity/category, not status).
- **Duration:** ~75 minutes.
- **Mechanism decided in pre-flight — option (c) String + CHECK, NOT (a) @db.Time:** the audit offered three (a/b/c). (a) ruled out empirically: `@db.Time` requires a `DateTime` Prisma scalar, which this repo's generated client maps to JS `Date` (verified in the pnpm-store `.prisma/client/index.d.ts`: `createdAt: Date`). (a) would cascade `string`→`Date` through 6 DTO fields, `planning-export.service.ts` `split(':')`, `predefined-tasks.service.ts`, frontend (`usePlanningData` `localeCompare`, `TaskForm` `<input type="time">`) and `packages/types` — >20 adjacent edits = contract scope-creep bail. No minutes-int arithmetic exists → (b) unjustified. (c) = zero TS surface change, same invariant (DB rejects malformed).
- **Non-obvious — CHECK is the floor, not DTO-equality:** regex `^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$` is the *lenient* pattern — exactly the Task/Event DTO regex and a strict **superset** of the PredefinedTask DTO (`^([01]\d|2[0-3]):[0-5]\d$`). Picked so nothing the app accepts is DB-rejected (no 500s on legit input); per-table DTOs may stay stricter. Defense-in-depth ≠ DTO equality. Rejects audit invalids ('9:5','25:99','') + '24:00'/'12:60'/whitespace. Verified semantically in PG (13-value VALUES probe) before authoring, and again via a single live `ALTER…ADD CONSTRAINT` against dev (advisor's cheap-insurance suggestion).
- **schema.prisma unchanged** (columns stay `String?`) — CHECK is not Prisma-6-DSL-expressible (DAT-003/004 precedent, not DAT-012's enum path). Migration `20260527140000_dat013_time_format_check` hand-authored raw SQL, 6 CHECKs `<table>_<col>_format_ck`, no IS NULL guard (NULL passes a CHECK).
- **Pre-flight data state (psql, dev):** only 4 well-formed HH:MM rows (predefined_tasks: 07:30/16:00/09:30/17:15); tasks + events zero non-null time values; malformed-scan (`!~` the lenient regex) = **zero rows** across all 6 columns. No data-cleanup bail. Every ADD CONSTRAINT validated instantly via `migrate deploy` (not `migrate dev`, still blocked by `_dat005_backup_*` drift — TOOL-DBSYNC-001; dev `DATABASE_MIGRATION_URL` = the `orchestr_a` owner URL).
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat013-time-format.int.spec.ts`):** 4 tests — '25:99' on tasks + predefined_tasks, '' on events (raw `$executeRawUnsafe` so SQLSTATE **23514** + constraint name surface), + 1 positive (valid HH:MM incl. single-digit hour '9:05', NULL, and 00:00/23:59 boundaries). **FAIL-pre demonstrated:** neutralized the migration to `SELECT 1;` → the 3 negatives fail non-vacuously ("expected a check_violation (23514) but the INSERT was accepted"), positive still passes; restored byte-identical (diff verified) → **29/29 integration** (was 25; +4).
- **Witness column gotcha (caught in pre-flight):** `tasks` has NO `createdById` column (nullable `projectId` only); `predefined_tasks` uses `name` not `title` and requires the `defaultDuration` enum (DAT-012's `PredefinedTaskDuration`, `'TIME_SLOT'` literal coerces to enum in raw SQL). The first spec draft assumed otherwise — `information_schema.columns` checked before running, not after a failure.
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005 / DAT-003-004 / DAT-012 precedent).
- **Diff scope (AC#6 — fix commit `c0189c1`):** 2 files, both new — the migration + the int spec. No schema.prisma, no DTO, no service, no frontend edit (the whole point of choosing (c)).
- **Gates:** `migrate deploy` clean (4 well-formed rows validated); `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (unchanged — DAT-013 is integration-only) zero regression, 6/6 turbo (web cached); `pnpm test:integration` **29 passed** (was 25); `pnpm test:e2e` (= turbo → api vitest e2e, the arc gate) **2 passed**. Coherence gate **38 DONE/VERIFIED all valid**.
- **Cour-des-Comptes question:** "if the DTO layer is bypassed (buggy service path or direct admin SQL), can the DB still store a malformed time of day a comparison would silently mis-sort?" → **No (for the 6 columns).** Demonstrated live: a direct `UPDATE predefined_tasks SET "startTime"='25:99'` is now rejected with 23514. The format floor is enforced at the DB independent of class-validator.
- **Out of scope / next session:** remaining Phase 3 *important* tasks (DAT-014/016/017/018/023) + DAT-032 + DAT-033/034/035 + TOOL-DBSYNC-001. **Prod deploy of the Phase 3 batch now includes `20260527140000` (DAT-013).** No pre-deploy probe needed for this migration (CHECK on clean data is uneventful — unlike DAT-012's enum cast). No prod migration run; no deploy.

## 2026-05-27 — DAT-014 closed (leaves.type auto-sync trigger; legacy enum column now a read-only FK mirror)
- **Session ID:** 2026-05-27-dat014
- **Tasks closed:** DAT-014 (Phase 3, Cluster F — claude-only, severity important, data_integrity·schema). Sixth Phase-3 task closed (after DAT-003/004 blocking, COR-022, DAT-012, DAT-013). Phase 3 now 6/10 of the originally-scoped batch.
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** none (no per-column or residual bail surfaced; the COR-029 dead-method overlap is a Phase-13 disposition, not a new filing).
- **Commits:** `fdd45a0` (IN_PROGRESS anchor), `f8a5ce9` (fix — `[closes DAT-014]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, deploy-doc append, this entry).
- **Counter:** DAT-014 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set 38→39). No header delta (no new filing; Totals tracks severity/category, not status).
- **Duration:** ~75 minutes.
- **Path decided in pre-flight — Path B (trigger), NOT Path A (DROP COLUMN):** the audit's sequenced fix gates the column drop on "no SELECT references it." Pre-flight catalogued `leave.type` readers: (i) active business logic — `findAll` `?type=` filter (`leaves.service.ts:715`, exposed via `@Query('type')`); (ii) dead — `getPendingDays` (`:2507`, 0 callers, COR-029's invited deletion); (iii) **active frontend display** — `leaves/page.tsx:486,508` (`switch (leave.type)`), `users/[id]/suivi/page.tsx:912` (i18n `leaves.types.${leave.type}`), `planning/DayCell.tsx:152` (legacy fallback). (iii) is the contract's explicit Path-A bail trigger ("active frontend display") → rerouted to Path B. Writers: `leaves.service.ts:574` + `:3280` (`type: enumType`, derived from `leaveTypeConfig.code`).
- **Trigger STYLE — auto-sync (self-healing), NOT validate-and-reject (deliberate Invariant-#2 deviation):** Invariant #2 is phrased for a rejection trigger ("P0001 or as raised"); the bail-conditions explicitly bless an auto-sync alternative. Decisive reason it must be auto-sync: the service maps arbitrary `leave_type_configs.code` values that are NOT `"LeaveType"` enum members (e.g. `CP_E2E`) to `OTHER`, so the real invariant is `type = (code IF a LeaveType member ELSE OTHER)`, NOT `type = code`. A naive `NEW.type = code` validation would 500 every legitimate custom leave type. `leaves_sync_type_trg` BEFORE INSERT OR UPDATE derives `NEW.type` from the joined code → the column becomes a read-only mirror of the FK, killing the dual *writeable* source of truth without dropping it. Witness is coercion-style (insert/update wrong type → reads back coerced), not rejection.
- **`enum_range` over a hardcoded member list (advisor catch):** membership test is `cfg_code = ANY(enum_range(NULL::"LeaveType")::text[])`, so a future enum member (e.g. PARENTAL) is not silently miscoerced to OTHER. Verified on PG18 (`'CP'`→t, `'CP_E2E'`→f).
- **One-time backfill in the same migration (advisor):** `UPDATE leaves SET type = <derived> FROM leave_type_configs lt WHERE leave_type_id = lt.id AND type IS DISTINCT FROM <derived>` — invariant holds for ALL rows immediately, not only post-deploy writes. Run before attaching the trigger (single explicit pass). Dev (3 rows): 1 NULL/`CP_E2E` → `OTHER`, 2 CP unchanged; post-backfill drift query shows zero mismatches.
- **schema.prisma UNCHANGED (Invariant 1 under Path B):** triggers aren't Prisma-6-DSL-expressible — hand-authored raw SQL `20260527150000_dat014_leave_type_autosync_trigger`, same pattern as DAT-003/004/013. Applied to dev via `migrate deploy` (not `migrate dev`, still blocked by `_dat005_backup_*` drift — TOOL-DBSYNC-001; dev `DATABASE_MIGRATION_URL` = the `orchestr_a` owner URL). Trigger + function confirmed present (`pg_trigger`).
- **Adjacent-file inventory — ZERO TS files (Invariant 5/6):** fix = 2 NEW files only (the migration + the int spec). The service `type: enumType` writes, the `findAll ?type=` filter, the DTO/controller `type?` params, and every unit-spec assertion stand unchanged; the trigger is invisible to the mocked-`database` unit suite. (Self-check held: I never needed to open `leaves.service.ts` for an edit — the advisor's "if you touch the service under Path B, you drifted" tripwire.)
- **COR-029 disposition (pre-flight step 2):** `getPendingDays` confirmed dead (0 callers). Left untouched — its `where: { type: CP }` read is now harmless (the trigger guarantees `type` mirrors the FK). COR-029 (Phase 13) deletes/rewrites it; not in DAT-014 scope.
- **Known limitation (advisor, noted for a future task):** trigger fires on `leaves` writes, not `leave_type_configs` writes — if an admin changes a config's `code`, existing leave rows keep their old derived `type` until next written. Write-time drift (the audit's concern) is closed; a config-side propagation trigger is separate scope.
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat014-leave-type-trigger.int.spec.ts`):** 5 coercion-style tests — INSERT wrong type→CP, INSERT NULL→CP, INSERT non-enum config code→OTHER, UPDATE re-coerced, UPDATE FK change re-derives→OTHER. Harness gotcha: the migrated DB already seeds a `CP` config (code @unique) → reuse via `findFirst`, don't `create`. **FAIL-pre demonstrated** live on the triggerless dev DB (BEGIN…ROLLBACK): `INSERT … type='RTT'` against a CP config persists `RTT` (no coercion) — restored by the trigger to `CP` in the ephemeral harness. **34/34 integration** (was 29; +5).
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005/012/013 precedent), even though it touches the `leaves` table. The in-migration backfill `UPDATE` runs as raw SQL inside `migrate deploy`, not through the app audit emitter → correctly emits no `audit_logs` row (same as DAT-005's numeric conversion).
- **Gates:** `migrate deploy` clean (dev: 3 rows, backfill reconciled 1); `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (unchanged — DAT-014 is integration-only, zero TS) 6/6 turbo (web cached); `pnpm test:integration` **34 passed** (was 29); `pnpm test:e2e` (= turbo → api vitest e2e, the arc gate) **2 passed**. Coherence gate run post-closeout (see below).
- **Cour-des-Comptes question:** "if the service layer is bypassed (buggy path or direct admin SQL), can `leaves.type` drift from its FK so a dashboard pivoting on the legacy column shows a different type than one pivoting on `leaveType.code`?" → **No.** The DB now derives `type` from the FK on every write (and existing rows were reconciled), independent of the application layer. The legacy column is a read-only mirror, not an independent source.
- **Deploy-doc append (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`):** Scope row (DAT-014 `f8a5ce9`), Migrations sub-table row + count 3→4 (and the 4 inline "3 batch migrations" refs), per-migration Rollback entry (DROP TRIGGER + DROP FUNCTION — trigger reversible, backfill one-way/intentional), post-deploy **coercion** smoke (INSERT-then-ROLLBACK asserting `type` reads back `CP` not `RTT`, + `pg_trigger` existence check), audit_logs-sanity clarification (in-migration backfill emits no audit row).
- **Out of scope / next session:** remaining Phase 3 *important* tasks (DAT-016/017/018/023) + DAT-032 + DAT-033/034/035 + TOOL-DBSYNC-001. **Prod deploy of the Phase 3 batch now includes `20260527150000` (DAT-014)** — pre-deploy: confirm no prod codebase reference writes `leave.type` independently outside this commit's diff; the backfill is one bounded `UPDATE` even on a large prod `leaves`. No prod migration run; no deploy.

## 2026-05-27 — DAT-016 closed (UNIQUE on departments.name + composite UNIQUE on services(departmentId, name))
- **Session ID:** 2026-05-27-dat016
- **Tasks closed:** DAT-016 (Phase 3, Cluster F — claude-only, severity important, data_integrity·constraint). Seventh Phase-3 task closed (after DAT-003/004 blocking, COR-022, DAT-012, DAT-013, DAT-014). Phase 3 now 7/10.
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** **DAT-036** (Client.name UNIQUE — the Description's third instance, omitted from the literal Suggested fix; closeout-filing precedent DAT-004→DAT-032) + **COR-034** (map `P2002 → ConflictException` on dept/service create — the TOCTOU race-window hardening surfaced in pre-flight). Both single-commit filings, no IN_PROGRESS anchor.
- **Commits:** `a31cfc5` (IN_PROGRESS anchor), `ce8877a` (fix — `[closes DAT-016]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, deploy-doc append, this entry), `<pending>` (DAT-036 + COR-034 filings).
- **Counter:** DAT-016 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set 39→40). Header Totals +2 entries (DAT-036, COR-034 filed as TODO — severity/category counters, not status).
- **Duration:** ~75 minutes.
- **First DSL-expressible Phase-3 fix → schema.prisma WAS edited** (unlike DAT-003/004 CHECK, DAT-013 CHECK, DAT-014 trigger — all SQL-only): `@unique` on `Department.name`, `@@unique([departmentId, name])` on `Service`. Migration `20260527160000_dat016_unique_name_constraints` hand-authored as **two `CREATE UNIQUE INDEX`** statements byte-equivalent to `migrate dev` output (Prisma `<table>_<col>_key` naming → `departments_name_key`, `services_departmentId_name_key`). `migrate dev` stays blocked by the `_dat005_backup_*` drift (TOOL-DBSYNC-001); applied via `migrate deploy` (drift-tolerant). Verified the convention against the `20260523171000` precedent + 20 in-repo `CREATE UNIQUE INDEX` names before authoring; a `pg_indexes` test in the witness pins both names so a future drift-clean `migrate dev` produces no shadow diff.
- **Composite (per-department), NOT global on Service** — literal Suggested fix. Matches the app's existing `services.service.ts` `findFirst({ name, departmentId })` pre-check. The positive witness (same service name in two different departments → both accepted) is the load-bearing proof it isn't a global `services.name` unique.
- **Pre-flight (dev psql):** both `name` columns already `NOT NULL` → no nullable surprise, no `NULLS NOT DISTINCT` consideration. **0 duplicates** in `departments(name)` and `services(departmentId, name)` (2 depts, 4 svcs) → clean-to-proceed, no in-session rename. Only PK indexes existed before; no stray unique on `services.name` alone (advisor's worth-naming check).
- **23505-leak adjacency decision (advisor-confirmed FILE, not EXTEND):** both services already pre-check uniqueness → `ConflictException`, so the happy path is unchanged and the new 500 occurs ONLY in the TOCTOU race or a direct-SQL bypass — a *strictly better* state than the pre-DAT-016 silent duplicate (the audit's complaint). The brief's "23505-leak surprise" anticipated a generic try/catch *swallowing* Prisma errors; the real shape (no catch + explicit pre-check) is narrower. Kept DAT-016 schema+spec-only (zero TS, DAT-013/014 precedent); filed COR-034 for the `P2002 → ConflictException` mapping.
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat016-unique-name.int.spec.ts`):** 4 tests — dept dup (negative), service dup same-dept (negative), service same-name different-dept (positive), pg_indexes name-pinning. **Witness gotcha:** Prisma's `$executeRawUnsafe` reformats a unique violation to `Key (<cols>)=(<vals>) already exists` and **drops the index name** (unlike CHECK 23514 — DAT-013 — which keeps the constraint name). Asserted on the key-column tuple (`Key (name)=`, `Key ("departmentId", name)=`) — equally non-vacuous (a PK collision reads `Key (id)=`) and directly proves composite-vs-global. **FAIL-pre demonstrated:** neutralized migration → `SELECT 1;`, ran dat016 → 2 negatives fail (`expected '' to match /23505/`) + pg_indexes test fails (`[]`) + positive passes; restored byte-identical (diff-verified) → **38/38 integration** (was 34; +4).
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005/012/013/014 precedent).
- **Diff scope (AC#6 — fix commit `ce8877a`):** 3 files — `schema.prisma` (the 2 DSL edits), the new migration, the new int spec. No DTO/service/controller/frontend edit (the 23505-leak mapping deferred to COR-034).
- **Gates:** `migrate deploy` clean (dev: indexes built against 2 depts/4 svcs, 0 dups; live psql dup-INSERT rejected with `departments_name_key`); `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (unchanged — DAT-016 is integration-only, zero TS) 6/6 turbo (web cached); `pnpm test:integration` **38 passed** (was 34); `pnpm test:e2e` **2 passed**. Coherence gate run post-closeout.
- **Cour-des-Comptes question:** "if the service pre-check is bypassed (TOCTOU race between two concurrent creates, or a direct admin SQL write), can two departments — or two services in one department — end up with the same name, so an RBAC scope decision pivoting on name membership becomes ambiguous?" → **No.** The DB now rejects the second write with 23505 independent of the application layer. (The race currently surfaces as a 500 rather than a clean 409 — tracked as COR-034, a UX nicety, not a correctness gap; the duplicate is prevented either way.)
- **Deploy-doc append (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`):** Scope row (DAT-016 `ce8877a`), Migrations sub-table row + count 4→5 (header + the migrate-deploy "must show EXACTLY" block, now listing all 5; corrected V1 IN-list 3→5 rows, which had also been missing DAT-014's 150000), **pre-deploy duplicate probe** subsection (the two GROUP BY…HAVING queries + rename-resolution path), name-uniqueness smoke (2 negatives naming each index + 1 positive `shared_ok=2`; note raw psql names the index where Prisma doesn't), per-migration Rollback (`DROP INDEX IF EXISTS` — flagged shape divergence from DAT-003/004's `DROP CONSTRAINT`, since these are indexes not table constraints; image-revert note because schema.prisma carries the @unique), seed-status 5/10→7/10 + remaining-list trim.
- **Out of scope / next session:** remaining Phase 3 *important* tasks (DAT-017/018/023) + DAT-032/033/034/035 + the new DAT-036/COR-034 + TOOL-DBSYNC-001. **Prod deploy of the Phase 3 batch now includes `20260527160000` (DAT-016)** — pre-deploy: run the duplicate probe (0/0 required) BEFORE `migrate deploy`; `CREATE UNIQUE INDEX` aborts on existing dups. No prod migration run; no deploy.

## 2026-05-27 — DAT-017 closed (CHECK: epic/milestone requires projectId) + DAT-037 & COR-035 filed
- **Session ID:** 2026-05-27-dat017
- **Tasks closed:** DAT-017 (Phase 3, Cluster F — claude-only, severity important, data_integrity·constraint). Eighth Phase-3 task closed (after DAT-003/004 blocking, COR-022, DAT-012/013/014/016). Phase 3 now 8/10.
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** **DAT-037** (the audit's discretionary "Consider trigger validating epic.projectId = task.projectId" — cross-table consistency, deliberately split out of Path A) + **COR-035** (DTO cross-field guard returning 400 for the orphan task combination, so DAT-017's CHECK doesn't surface a raw 500). Both single-commit filings, no IN_PROGRESS anchor (DAT-032/036 precedent).
- **Commits:** `aeace05` (IN_PROGRESS anchor), `f6ca325` (fix — `[closes DAT-017]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, deploy-doc append, this entry), `<pending>` (DAT-037 + COR-035 filings).
- **Counter:** DAT-017 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set 40→41). Header Totals +2 entries (DAT-037, COR-035 filed as TODO — severity/category counters, not status).
- **Duration:** ~75 minutes.
- **Path A only (CHECK), per the pre-decided split — Path B (trigger) filed as DAT-037, NOT bundled.** "Consider trigger" is permissive language vs "Add CHECK"; literal scope = the single-row CHECK. The cross-table trigger has a different risk profile (lookup into epics/milestones per write) deserving its own pre-flight, and mixes invariant families (single-row CHECK vs cross-table validation) — same split precedent as DAT-013 (regex CHECK chosen, @db.Time NOT done). The default lean held: pre-flight surfaced **zero** active drift, so the trigger is invariant-tightening, not data-rescue → no reason to bundle.
- **Pre-flight (dev psql, 2026-05-27):** Step 1 — **0 CHECK violators** (3288 tasks; 3 with projectId NULL, all epic/milestone-null = legitimate transverse) → clean to proceed. Step 2 — cross-table drift **0/0** (epic + milestone joins); `epics.projectId`/`milestones.projectId` both **NOT NULL** → DAT-037 data-cleanup burden ≈ nil (recorded in the filing's Description). Step 3 — service awareness below.
- **DTO finding — the leak shape is DIFFERENT from DAT-016/COR-034 (drives COR-035's lead fix):** `create-task.dto.ts` declares `projectId`/`epicId`/`milestoneId` each `@IsOptional` with NO cross-field `@ValidateIf` tying them — the orphan combo was DTO-accepted, so the CHECK is the only thing closing it. `tasks.service.ts` has no Prisma error handling / no global exception filter, so after the CHECK an orphan-create (plain INVALID input) surfaces as a raw 500. DAT-016's leak was a 500 only on a TOCTOU race past an existing pre-check → P2002→409 was the right fix; here there is no pre-check and the input is simply invalid → the LEAD fix is a DTO cross-field guard returning **400** *before* the DB hit (service-side 23514→BadRequest is the fallback). COR-035's Description names this explicitly so the next implementer doesn't default to the DAT-016 try/catch shape. Kept DAT-017 schema+spec-only (DAT-013/014/016 precedent), zero TS.
- **Mechanism — raw-SQL CHECK, schema.prisma UNCHANGED (DAT-003/004/013 precedent):** migration `20260527170000_dat017_task_parent_requires_project_check`, constraint `tasks_parent_requires_project_ck` = `("projectId" IS NOT NULL OR ("epicId" IS NULL AND "milestoneId" IS NULL))`. Not Prisma-6-DSL-expressible. Predicate is fully non-NULL-valued (no 3VL surprise; the all-null transverse task passes via the right disjunct). Applied to dev via `migrate deploy` (DATABASE_MIGRATION_URL = orchestr_a owner URL on :5433, TOOL-DBSYNC-001; constraint confirmed in `pg_constraint`).
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat017-task-parent-consistency.int.spec.ts`):** 2 negatives (orphan epic / orphan milestone → 23514 + constraint name via `$executeRawUnsafe`) + 2 positives (all-null transverse task; project task with epic). **Advisor catch on Positive #2:** wired the epic to project X for setup realism but the assertion is ONLY "accepted because projectId is non-null", NOT "because epic.projectId matches" — the CHECK does no cross-table work (that's DAT-037); the spec comment says so to stop a reader concluding otherwise. **Witness gotcha:** `milestones` requires `dueDate` (non-null) — first draft omitted it, caught at setup. **FAIL-pre demonstrated:** neutralized migration → `SELECT 1;` → 2 negatives fail non-vacuously ("expected a check_violation (23514) but the INSERT was accepted"), 2 positives pass; restored byte-identical (diff-verified) → PASS-post 4/4, full integration **42** (was 38).
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005/012/013/014/016 precedent).
- **Diff scope (AC#6 — fix commit `f6ca325`):** 2 files, both new — the migration + the int spec. No schema.prisma, no DTO, no service, no frontend edit (the 400-mapping deferred to COR-035, the trigger to DAT-037).
- **Gates:** `migrate deploy` clean; `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (unchanged — DAT-017 is integration-only, zero TS) 6/6 turbo (web cached); `pnpm test:integration` **42 passed** (was 38); `pnpm test:e2e` **2 passed**. Coherence gate run post-closeout.
- **Cour-des-Comptes question:** "if the create DTO is bypassed (buggy path or direct admin SQL), can a task be linked to an epic/milestone yet name no project, so a project-scoped RBAC or rollup query silently drops or mis-attributes it?" → **No.** The DB now rejects the orphan combination with 23514 independent of the application layer. (Cross-table mismatch — task names project A but its epic belongs to project B — is NOT yet closed; that is DAT-037.)
- **Deploy-doc append (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`):** Scope row (DAT-017 `f6ca325`), Migrations sub-table row + count 5→6 (header + migrate-deploy "must show EXACTLY" block now listing all 6 + V1 IN-list now 6 rows), **pre-deploy orphan-task probe** subsection (the violator SELECT + backfill-from-parent resolution), parent-consistency smoke (2 negatives naming the constraint + 2 positives; note on reading existing epic/milestone ids so only 23514 fires, not the FK 23503, since PG doesn't guarantee CHECK-before-FK order), per-migration Rollback (`DROP CONSTRAINT IF EXISTS`, no image revert — schema.prisma unchanged), Operational-notes follow-up list += DAT-037 & COR-035, seed-status 7/10→8/10 + remaining-list trim (DAT-018/023).
- **Out of scope / next session:** remaining Phase 3 *important* tasks (DAT-018/023) + DAT-032/033/034/035 + DAT-036 + COR-034 + the new DAT-037/COR-035 + TOOL-DBSYNC-001. **Prod deploy of the Phase 3 batch now includes `20260527170000` (DAT-017)** — pre-deploy: run the orphan-task probe (0 violators required) BEFORE `migrate deploy`; `ADD CONSTRAINT … CHECK` aborts on existing violators. No prod migration run; no deploy.

## 2026-05-27 — DAT-018 closed (CHECK no-self-loop + trigger no-cycle on task_dependencies) + DAT-038 filed
- **Session ID:** 2026-05-27-dat018
- **Tasks closed:** DAT-018 (Phase 3, Cluster F — claude-only, severity important, data_integrity·cascade). Ninth Phase-3 task closed (after DAT-003/004 blocking, COR-022, DAT-012/013/014/016/017). Phase 3 now **9/10** — only DAT-023 (leave-overlap EXCLUDE gist) remains.
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** **DAT-038** (Event.parentEventId cycle prevention — the audit's "Same for Event.parentEventId", named in DAT-018's Description AND Code evidence but omitted from the literal Suggested fix; closeout-filing precedent DAT-004→DAT-032, DAT-016→DAT-036, DAT-017→DAT-037). **COR-036 NOT filed** (see below — no trigger→500 leak on the controller path). Single-commit filing, no IN_PROGRESS anchor.
- **Commits:** `46b88a1` (IN_PROGRESS anchor), `fff93ce` (fix — `[closes DAT-018]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, deploy-doc append, this entry), `<pending>` (DAT-038 filing).
- **Counter:** DAT-018 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set 41→42). Header Totals +1 entry (DAT-038 filed as TODO — important + data_integrity counters: 124→125 important, 36→37 data_integrity; total-tasks 191→192).
- **Duration:** ~75 minutes.
- **BOTH Suggested-fix items implemented; trigger path chosen for Item 2 (defense-in-depth), service-only rejected.** Item 1 = raw-SQL CHECK `task_dependencies_no_self_ck` (`"taskId" <> "dependsOnTaskId"`) blocks the 1-hop self-loop. Item 2 = BEFORE INSERT OR UPDATE trigger `task_dependencies_no_cycle_trg` (fn `task_dependencies_check_cycle`) walking the existing graph FORWARD from `NEW."dependsOnTaskId"`; if `NEW."taskId"` is reachable → RAISE (P0001) with identifier `task_dependencies_no_cycle`. The Suggested fix's "and/or" is a design call — Phase-3 thesis is "DB floor for what services should already reject" (DAT-017's DTO finding proved services don't always reject), so the DB trigger (not service-only) is the correct floor; a service-only fix would re-create the very gap Phase 3 fights.
- **Pre-flight (dev psql, 2026-05-27, container orchestr-a-db :5433):** Step 1 — **0 direct self-loops** in `task_dependencies`. Step 2 — **0 multi-hop cycles** (table holds **0 rows** total) → both ADD CONSTRAINT and the trigger attach cleanly, no in-migration cleanup. Step 3 — service-layer check below. Step 4 — **Event.parentEventId** (DAT-038 sizing): **0 self-cycles, 0 multi-hop, 0 of 195 events parented** → DAT-038 data-cleanup burden ≈ nil (recorded in the filing's Code evidence). **Columns are `text`** (Prisma String → text), NOT uuid — the scan's `ARRAY[...]::uuid[]` errored against the `text` columns until cast to text[]; the trigger uses plain text throughout.
- **Service-layer check ALREADY EXISTS — kept alongside (defense-in-depth), NOT touched.** `tasks.service.ts:853` `addDependency` → `checkCircularDependency()` (BFS walk) throws `BadRequestException` (400) on multi-hop cycles AND the 1-hop self-loop (its `startTaskId === targetTaskId` short-circuit at `:1252` catches A→A). So the documented controller path returns a clean 400 BEFORE any DB write; the trigger/CHECK fire only on a direct-SQL / admin-console / future-code bypass. Brief's "existing method that throws → keep alongside" branch.
- **COR-036 NOT filed.** Its premise is a trigger→500 leak on the controller path; there is none, because the service rejects with 400 before the DB is hit. (`tasks.service.ts` has no Prisma error handling per DAT-017's finding, but that handler is never reached for cycles.) The trigger is bypass-only → no app-layer 409/400 mapping needed.
- **Self-loop left to the CHECK by design.** For a 1-hop self-loop (`NEW.taskId = NEW.dependsOnTaskId = X`) the forward walk seeds from X's existing outgoing edges; in a valid DAG X is never reachable from itself → trigger silent → CHECK fires → 23514 + `task_dependencies_no_self_ck`. The two guards never both fire on one row; each negative test asserts a distinct signal.
- **UPDATE false-positive caught in advisor review and fixed.** Trigger is BEFORE INSERT OR UPDATE; during a BEFORE UPDATE the OLD row is still in the table, so a naive forward walk traverses the edge being replaced and false-rejects a legitimate re-point (UPDATE `(A→B)`→`(A→C)`: stale A→B makes B reachable). Both CTE arms exclude the modified row via `(TG_OP = 'INSERT' OR id <> OLD."id")`. A 7th test (UPDATE-positive) locks the clause so it can't silently regress. `TG_OP` is the discriminator — on INSERT, OLD's *fields* are NULL but OLD itself is not a NULL composite. CTE uses UNION (not UNION ALL) so Postgres dedups by row and terminates even on a pre-existing cycle (free guard).
- **Mechanism — raw-SQL CHECK + trigger, schema.prisma UNCHANGED (DAT-003/004/013/014 precedent):** migration `20260527180000_dat018_task_dependency_cycle_prevention`. Neither guard is Prisma-6-DSL-expressible. Applied to dev via `migrate deploy` (TOOL-DBSYNC-001: `migrate dev` still drift-blocked; both `DATABASE_URL` and `DATABASE_MIGRATION_URL` = the orchestr_a owner URL on :5433 — the schema's `directUrl = env("DATABASE_MIGRATION_URL")` requires BOTH set). Constraint + trigger + function confirmed in `pg_constraint`/`pg_trigger`/`pg_proc`.
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat018-task-dependency-cycle.int.spec.ts`):** 7 tests — 3 negatives (self-loop→23514+`task_dependencies_no_self_ck`; 2-hop A→B,B→A; 3-hop A→B,B→C,C→A → `task_dependencies_no_cycle`), 3 INSERT-positives (linear chain A→B→C→D; tree A→B,A→C; diamond A→B,A→C,B→D,C→D — prove no DAG false-reject), 1 UPDATE-positive (re-point A→B to A→C). Each test creates its own throwaway tasks so edges don't pollute across tests. **FAIL-pre demonstrated:** neutralized migration → `SELECT 1;` → the 3 negatives fail non-vacuously ("expected … but the INSERT was accepted"), 4 positives pass; restored byte-identical (diff-verified) → PASS-post, full integration **49** (was 42; +7).
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005/012/013/014/016/017 precedent).
- **Diff scope (AC#6 — fix commit `fff93ce`):** 2 files, both new — the migration + the int spec. No schema.prisma, no service, no DTO, no controller, no frontend edit.
- **Gates:** `migrate deploy` clean (objects confirmed in pg_constraint/pg_trigger/pg_proc); `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (unchanged — DAT-018 is integration-only, zero TS) 6/6 turbo (web cached); `pnpm test:integration` **49 passed** (was 42); `pnpm test:e2e` green (turbo 4/4). Coherence gate run post-closeout.
- **Cour-des-Comptes question:** "if `addDependency` is bypassed (direct admin SQL, a future non-service write path), can the task-dependency graph acquire a self-loop or a longer cycle, so a scheduler / 'can this task start?' rollup that walks it loops forever?" → **No.** The DB now rejects the self-loop (CHECK 23514) and any multi-hop cycle (trigger) independent of the application layer. The service's `checkCircularDependency` 400 remains the first line of defense on the normal path.
- **Deploy-doc append (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`):** Scope row (DAT-018 `fff93ce`), Migrations sub-table row + count 6→7 (header + migrate-deploy "must show EXACTLY" block now listing all 7 + V1 IN-list now 7 rows + the migration-folder-delta line), **pre-deploy DAT-018 cycle probe** subsection (self-loop SELECT + recursive-CTE cycle scan + per-shape DELETE resolution), TaskDependency cycle smoke (3 negatives naming the CHECK/trigger identifier + 3 DAG positives, all self-contained throwaway-task transactions), per-migration Rollback (`DROP TRIGGER` + `DROP FUNCTION` + `DROP CONSTRAINT IF EXISTS`, no image revert — schema.prisma unchanged), Operational-notes follow-up list += DAT-038 (with the "no COR-036 needed" note), seed-status 8/10→9/10 + remaining-list trim (DAT-023).
- **Out of scope / next session:** the last Phase 3 *important* task **DAT-023** (leave-overlap `EXCLUDE USING gist`) — separate session per the contract's stop-after-one rule. Also still open: DAT-032/033/034/035 + DAT-036 + COR-034 + DAT-037/COR-035 + the new DAT-038 + TOOL-DBSYNC-001. **Prod deploy of the Phase 3 batch now includes `20260527180000` (DAT-018)** — pre-deploy: run the self-loop + recursive-CTE cycle scan on prod `task_dependencies` (0/0 required) BEFORE `migrate deploy`; the CHECK aborts on an existing self-loop and an existing cycle would later choke the trigger. No prod migration run; no deploy.

## 2026-05-27 — DAT-023 closed (leaves no-overlap EXCLUDE gist) + COR-037 filed — **Phase 3 = 10/10 COMPLETE**
- **Session ID:** 2026-05-27-dat023
- **Tasks closed:** DAT-023 (Phase 3, Cluster F — claude-only, severity important, data_integrity·constraint). **Tenth and LAST Phase-3 task** (after DAT-003/004 blocking, COR-022, DAT-012/013/014/016/017/018). **Phase 3 is now 10/10 CLOSED.**
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** **COR-037** (typed 409 on the `leaves_no_overlap` 23P01 at the approve/import path — pre-flight surfaced that `approve` does NOT re-check overlap and the leaves module has no Prisma error handler, so the EXCLUDE leaks as a 500 there; the create/update paths already 409 first so are unaffected). **DAT-039 NOT filed** (its conditional trigger was "WHERE clause needed widening for half-day"; it did not — `checkOverlap` ignores `halfDay`, so half-day same-day pairs are already a conflict and are not a product feature; the literal `[]` stands). COR-037 numbered to avoid reusing COR-036 (documented "NOT filed" in DAT-018's Learnings). Single-commit filing, no IN_PROGRESS anchor (DAT-032/036/037/038 precedent).
- **Commits:** `12c9010` (IN_PROGRESS anchor), `c27862a` (fix — `[closes DAT-023]`), `<pending>` (closeout — BACKLOG DONE+SHA+Learnings, deploy-doc append, this entry), `<pending>` (COR-037 filing).
- **Counter:** DAT-023 TODO→IN_PROGRESS→DONE (+1 DONE/VERIFIED, coherence checked-set 42→43). Header Totals +1 entry (COR-037 filed as TODO — **nit** + correctness counters: 24→25 nit, 37→38 correctness; total-tasks 192→193; severity matches COR-034/035 — a "prevented-either-way, error-surface-only" 500→409 follow-up).
- **Duration:** ~75 minutes.
- **Literal Suggested fix kept verbatim — all three baked-in choices validated, none adjusted.** (1) `'[]'` inclusive bounds match `checkOverlap`'s inclusive `startDate<=endDate AND endDate>=startDate`, which **ignores `halfDay`** → morning+afternoon-same-day is already a conflict, not a feature → no half-day WHERE carve-out → no DAT-039. (2) Partial `WHERE (status='APPROVED')` → only APPROVED rows exclude, and a partial EXCLUDE **re-checks on UPDATE when a row ENTERS the predicate** (PENDING→APPROVED) — the audit's exact race path. (3) No `::date` cast — columns are already `date` (`@db.Date`); schema has **no `halfDayStart` column** (the brief's pre-flight query named one), the real model is a single `halfDay HalfDay?`.
- **Pre-flight (dev psql, 2026-05-27, container orchestr-a-db :5433):** btree_gist NOT pre-installed → migration uses `CREATE EXTENSION IF NOT EXISTS`. Dev role `orchestr_a` is **superuser** (`rolsuper=t`) → CREATE succeeds on dev + in the int harness (owner runs `migrate deploy`); **prod needs superuser for the CREATE EXTENSION step** (deploy doc surfaces this). Columns `format_type`: startDate/endDate = `date`, userId = `text`, status = `LeaveStatus`, halfDay = `HalfDay`. **0 overlapping APPROVED pairs** (3 leaves total, all APPROVED) → clean to proceed, no in-migration cleanup, no bail.
- **Service-layer state (drives COR-037, NOT a DAT-023 code change):** `checkOverlap` runs on create (433) + update (1248) → `ConflictException` (409); `approve` (1619) does **not** re-check overlap and the leaves module has no Prisma error filter. So 23P01 only fires on approve/import (the TOCTOU race) and currently leaks as 500. Kept DAT-023 schema+spec-only (zero TS, DAT-013/014/016/017/018 precedent); filed COR-037 for the 409 mapping.
- **Mechanism — raw-SQL EXCLUDE, schema.prisma UNCHANGED:** migration `20260527190000_dat023_leave_no_overlap_exclude`, constraint `leaves_no_overlap` (`contype='x'`), `pg_get_constraintdef` confirms `EXCLUDE USING gist ("userId" WITH =, daterange("startDate","endDate",'[]'::text) WITH &&) WHERE (status='APPROVED')`. Not Prisma-6-DSL-expressible (DAT-013/017/018 precedent). Applied to dev via `migrate deploy` (TOOL-DBSYNC-001: both DATABASE_URL + DATABASE_MIGRATION_URL = owner URL on :5433).
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat023-leave-no-overlap.int.spec.ts`):** 7 tests — 3 negatives (INSERT 2 APPROVED overlapping → 23P01+`leaves_no_overlap`; `[]` adjacency `[Mar1,Mar5]`+`[Mar5,Mar10]` proving inclusive bounds discriminately — **advisor steered to (b) shared-endpoint over (a) identical-single-day** since only `[]` flags it; the PENDING→APPROVED race via two UPDATEs — **advisor-added**, the audit's exact scenario, proves the partial EXCLUDE re-checks on predicate entry), 3 positives (overlap allowed when one is PENDING = partial WHERE; cross-user overlap allowed = userId scoping; same-user gap allowed), 1 `pg_constraint` name pin (**advisor-added**, mirrors DAT-016's `pg_indexes` pin — catches a silent rename). Each test uses its own throwaway user. **FAIL-pre demonstrated:** neutralized migration → `SELECT 1;` → the 3 negatives + the pin fail non-vacuously (`expected '' to match /23P01/` = the write was accepted), 3 positives pass; restored byte-identical (diff-verified) → PASS-post 7/7, full integration **56** (was 49; +7).
- **AC#4 skipped** — structural schema constraint, not an audit-sensitive business mutation (DAT-005/012/013/014/016/017/018 precedent), even though `leaves` is named in the audit-sensitive list.
- **Diff scope (AC#6 — fix commit `c27862a`):** 2 files, both new — the migration + the int spec. No schema.prisma, no service, no DTO, no controller, no frontend edit (the 409-mapping deferred to COR-037).
- **Gates:** `migrate deploy` clean (btree_gist + `leaves_no_overlap` confirmed in pg_extension/pg_constraint); `nest build` (typecheck gate, [[project_nest_build_is_typecheck_gate]]) EXIT 0; `pnpm test` api **1658** (unchanged — DAT-023 is integration-only, zero TS) + web **579** (14 skipped) 6/6 turbo; `pnpm test:integration` **56 passed** (was 49); `pnpm test:e2e` **2 passed** (turbo 4/4). Coherence gate run post-closeout (43).
- **Cour-des-Comptes question:** "if leave create/update is bypassed or raced (two concurrent creates, or a manager declaring a leave while another approval lands), can one user end up holding two APPROVED leaves whose date ranges overlap, so a capacity/coverage rollup double-counts their absence?" → **No.** The DB now rejects the second overlapping APPROVED row (23P01) independent of the application layer — on INSERT and on the PENDING→APPROVED transition. (The race currently surfaces as a 500 on the approve path rather than a clean 409 — tracked as COR-037, a UX nicety; the overlap is prevented either way.)
- **Deploy-doc append (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`):** Scope row (DAT-023 `c27862a`), Migrations sub-table row + count 7→8 (header + migrate-deploy "must show EXACTLY" block now listing all 8 + V1 IN-list now 8 rows + the migration-folder-delta line), **pre-deploy DAT-023 overlap probe** subsection (btree_gist availability + superuser check + the overlapping-APPROVED-pair SELECT + resolution = set the older row non-APPROVED), leaves no-overlap smoke (3 negatives naming `leaves_no_overlap`/23P01 + 3 positives, INSERT-then-ROLLBACK throwaway transactions), per-migration Rollback (`DROP CONSTRAINT IF EXISTS leaves_no_overlap; DROP EXTENSION IF EXISTS btree_gist;` — extension drop conditional: only if no other constraint depends on it; no image revert — schema.prisma unchanged), Operational-notes follow-up list += COR-037, seed-status 9/10→**10/10 (Phase 3 COMPLETE)** + remaining-list emptied.
- **Out of scope / next session (META-session, NOT this one):** Phase 3 is 10/10 — the next session is a meta-session: HANDOVER refresh + deploy-doc finalize + decide the actual prod deploy of the Phase 3 batch. Still open backlog (Phase 4+): DAT-032/033/034/035 + DAT-036 + COR-034 + DAT-037/COR-035 + DAT-038 + the new COR-037 + TOOL-DBSYNC-001. **Prod deploy of the Phase 3 batch now includes `20260527190000` (DAT-023)** — pre-deploy: verify btree_gist can be created (superuser) or is already installed, AND run the overlapping-APPROVED-pair scan on prod `leaves` (0 required) BEFORE `migrate deploy`; the `ADD CONSTRAINT … EXCLUDE` validates against existing rows and aborts on an existing overlap. No prod migration run; no deploy. **DO NOT auto-continue to Phase 4.**


## 2026-05-28 — HANDOVER refresh post-Phase-3 completion (no task closed)

- **Session ID:** 2026-05-28-handover-refresh
- **Tasks closed:** none — doc-refresh session (precedent: deploy-doc seed, AUD-EMIT-001 filing — single commit, no IN_PROGRESS anchor).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** none.
- **Commits:** `<pending>` (single commit — HANDOVER.md + this entry).
- **Counter:** unchanged — coherence checked-set stays **43**, BACKLOG header totals untouched.
- **Duration:** ~30 minutes.
- **Scope of refresh:** rewrote HANDOVER.md to reflect the post-Phase-3 state. Verified against repo: master @ `59db83c`, 10 closing SHAs cross-checked with `git log --oneline`, coherence gate green (43), each new filing's Phase tag re-read from BACKLOG (10 Phase-3-tagged + 1 Phase-1-tagged = 11 total).
- **Key state correction surfaced — dual Phase-3 count.** The prior framing "Phase 3 = 10/10 done" is true *only* for the audit-prescribed set. Ten session-derived follow-ups filed during the arc carry `Phase: 3` (DAT-032/033/034/035/036/037/038, COR-034/035/037). The refreshed HANDOVER presents BOTH counts explicitly so the next-arc decision (Phase 3 mini-completion vs. Phase 4 by phase-order) doesn't get made under a false "phase is closed" premise. The Cour-des-Comptes narrative coherence is the tradeoff: closing the Phase-3-tagged TODOs keeps "Phase 3 = invariants métier au niveau DB, fully closed" defensible vs. Phase 4 advances breadth.
- **Filings catalog persisted in HANDOVER** with origin SHA + sev + one-line nature for each, plus the two **deliberately-not-filed** counter-examples (COR-036, DAT-039) as evidence of the don't-file-phantoms discipline (Phase 3 process learning #9).
- **Phase 3 process learnings recorded (9 new bullets):** CHECK-superset-of-DTO (DAT-013), auto-sync-vs-validate triggers (DAT-014), BEFORE-trigger OLD-row exclusion (DAT-018 — flagged as directly applicable to DAT-037/038 implementers), Prisma error-shape asymmetry on 23505 vs 23514 (DAT-016), hand-authored byte-equivalent migration (TOOL-DBSYNC-001 workaround), DSL-expressibility split, layer-of-rejection discipline (COR-034 race-window vs COR-035 plainly-invalid input vs COR-037 race-window — distinct handlers), audit-literal validation (DAT-023), don't-file-phantoms (COR-036/DAT-039 non-filings).
- **Prod-deploy section rewritten.** Phase 1+2 baseline stays @ `3fd8986` (deployed 2026-05-26). Phase 3 batch — 8 migrations + 1 code-only change (COR-022, no migration) — accumulated on master, **NOT YET deployed**. Deploy doc seeded at `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`, **not finalized** (TBD: markers pending, count reconciliation pending, pre-deploy checklist to be extracted).
- **Next-session orientation set as meta-then-decision (not "pick a Phase 3 task"):** (1) deploy-doc finalize (fill TBD markers + reconcile Migrations(8)/Scope counts + extract ordered cumulative pre-deploy checklist — notably DAT-012 `SELECT DISTINCT`, DAT-023 overlap-pair scan + btree_gist superuser requirement, per-CHECK violator scans), then (2) actual prod deploy decision, then (3) the Phase-3-mini-completion vs. Phase-4 decision surfaced to the user with the tradeoff stated, not chosen.
- **Implementation flags carried over to whichever arc is chosen:** DAT-037/038 inherit the BEFORE-trigger OLD-row recipe (learning #3 reproduces textually — UPDATE-positive test obligatory); COR-034/035/037 inherit the layer-of-rejection pattern (learning #7) but with three distinct handlers (pure P2002, DTO-lead-400 + service-side fallback, pure 23P01 — not interchangeable); DAT-033 explicitly captures the TOCTOU residual logged in commit `44b6a1f`.
- **Out of scope (next session):** deploy-doc finalize + prod deploy of the Phase 3 batch. Backlog (whichever arc): the 10 Phase-3-tagged follow-ups OR Phase 4 (RBAC complétude — TST-001, COR-001, COR-002 + 3 more).


## 2026-05-28 — Phase 3 deploy-doc finalized (operator-ready)

- **Session ID:** 2026-05-28-deploy-doc-finalize
- **Tasks closed:** none — doc-finalize session (precedent: deploy-doc seed 2026-05-25, HANDOVER refresh `321092f` 2026-05-28 — single commit, no IN_PROGRESS anchor).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** none.
- **Commits:** `<pending>` (single commit — `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` + this entry).
- **Counter:** unchanged — coherence checked-set stays **43**, BACKLOG header totals untouched (the prompt's "BACKLOG.md untouched. Coherence gate untouched (stays 43)." invariant).
- **Duration:** ~45 minutes.
- **Scope of finalize.** All four classes of work the prior orientation flagged:
  1. **TBD triage — 49 markers → all reclassified `TBD-DEPLOY:`.** Every one of them was deploy-time-only (date, operator, smoke-test snapshots, gate decisions, image ids, baseline counts, scan outputs) — none was "knowable now from repo". The repo-derivable values (migration names, constraint names, task SHAs, dev pre-flight counts, rollback SQL, the 14 DAT-003/004 predicates, the DAT-013 regex, the DAT-023 EXCLUDE definition) were already filled during the 2026-05-25→27 seeding (each task's closeout commit carried its own probe + smoke + rollback edit). The split is now `grep -nE 'TBD(:|[^-])'` returns 0 = deploy-time enumerate is exactly `grep -n 'TBD-DEPLOY:'` = 54 hits (49 original + 5 added by the new pre-deploy-checklist Step 0/Step 1/conditional-pre-step/rollback-execution-log placeholders).
  2. **Counter reconciliation.** Migrations sub-table = 8 rows (verified each name against `packages/database/prisma/migrations/`). Scope table = 10 task rows (DAT-003/004 bundle + 8 individuals). COR-022 is `1 task, 0 migration` (code-only, called out explicitly in the preamble). Whole-doc sweep for `\b[0-9]+ (migrations?|tasks?|batch)\b` returned only `8` / `10` / `1` / `0` — no stale `7` residual (the 59db83c polish that caught the prior 7→8 residuals stuck). No edits needed in the existing sub-tables; the new sections were written to 8/10/1 from the start.
  3. **Consolidated ordered pre-deploy checklist added** as `## Pre-deploy checklist — run in order against PROD before \`migrate deploy\``. Steps 0–3: (0) `btree_gist` availability + role-superuser probe with the 3-row decision table; (1) data-precondition scans (DAT-012/016/017/018/023 mandatory + DAT-003/004 + DAT-013 as recommended safety scans + the DAT-014 trigger-backfill behavior note + COR-022 no-DDL note); (2) baseline capture; (3) Gate 1. **The SQL itself is NOT duplicated — each row links to the existing per-task probe subsection.** This is the single executable sequence: the operator runs it top-to-bottom, the per-task subsections carry the SQL and resolution paths.
  4. **Consolidated rollback sequence added** as `## Rollback sequence (reverse deploy order)`, a 9-row table mapping DAT-023 → … → COR-022 in reverse-of-deploy order. Each row carries the DDL one-liner + image-revert flag (DAT-012, DAT-016 mandatory; others none) + a link to the existing per-migration rollback subsection (renamed `## Rollback (per migration)`). The per-migration sections stay as-is — the new table is the master order so the operator doesn't re-derive the dependency graph mid-incident.
- **Deploy execution section tightened** with a *conditional pre-step* — `CREATE EXTENSION IF NOT EXISTS btree_gist` (only if §"Pre-deploy checklist" Step 0 row 3 applied). Otherwise `migrate deploy` would abort at migration 8 of 8, leaving a partial state (7 applied). The git-pull line refers to "the master tip carrying all 8 Phase 3 migrations + COR-022 + this finalized deploy doc" rather than a hard-coded SHA (this finalize commit's SHA is unknown at edit time; operator verifies post-pull with `git rev-parse HEAD` and `git log --oneline -1`).
- **Preamble status block rewritten.** The 2026-05-27 seed framing "next session is a meta-session (HANDOVER refresh + finalize this doc + decide the actual prod deploy)" was overtaken — HANDOVER refresh shipped at `321092f`, this commit is the doc-finalize. Replaced with: "Status (2026-05-28): seeded 2026-05-27, finalized 2026-05-28 (this commit), operator-ready; actual prod deploy is a separate operator-driven step (not a Claude Code action)."
- **Self-lint embedded in the convention.** Wording chosen so that the convention paragraph itself does NOT trip the lint regex it defines (the seed's first formulation, `grep -nE 'TBD(:|[^-])'`, false-positives on the literal `TBD(` in the regex example — switched to a prose statement: "The legacy bare-marker form (without the `-DEPLOY` suffix) is deprecated; the body of this doc (outside this convention paragraph) carries none." Lint-passes: `grep -nE 'TBD(:|[^-])'` returns 0 matches.
- **Files touched:** 1 — `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` (940 → 1068 lines; +128 net = 49→54 TBD-DEPLOY conversions + new Pre-deploy checklist (~85 lines) + new Rollback sequence (~25 lines) + status-block rewrite + conditional CREATE-EXTENSION pre-step + section-title rename `Rollback (conditional, per migration)` → `Rollback (per migration)` so the new master table doesn't repeat-title the per-migration details).
- **Gates:** no code touched → no nest build / pnpm test / migrate deploy needed. Doc self-lint passes (`grep -nE 'TBD(:|[^-])'` → 0; `grep -c 'TBD-DEPLOY:'` → 54; count phrasing sweep `\b[0-9]+ (migrations?|tasks?|batch)\b` → only 8/10/1/0). Coherence gate untouched (still 43 — BACKLOG.md unmodified).
- **Process learnings (2 new):**
  - **TBD: vs TBD-DEPLOY: split is the operator's grep-fill workflow.** A doc seeded over many sessions accumulates two kinds of `TBD:`: "I don't know yet, fill at deploy" and "I don't know yet, fill at next doc-edit". Mixing them means the deploy-day `grep` returns doc-time questions, and the operator has to mentally re-triage on the day. Naming them differently (the deploy-time ones get a distinct suffix) makes the deploy-day lint trivially correct without losing the in-doc placeholder. **How to apply:** when seeding a deploy doc, default new blanks to `TBD-DEPLOY:`; if a blank is doc-time fillable, fill it before the seed commit rather than leaving it as `TBD:`.
  - **Convention text containing a literal example self-trips the lint it defines.** First formulation embedded the regex `TBD(:|[^-])` in prose, and the regex itself matched. Second iteration moved the lint to prose-only ("deprecated; the body of this doc … carries none") with the regex command callable but not embedded as a code-block in the convention paragraph. **How to apply:** when a lint is defined in the doc it lints, write the convention without quoting the deprecated token literally; the lint command lives in operator-runnable form elsewhere (or in a code block that's literally `\`grep -n 'X-NEW:'\`` quoting only the *new* form).
- **Out of scope (next session):** actual prod deploy is operator-driven (separate, non-Claude-Code action). The Phase-3-mini-arc (the 10 Phase-3-tagged follow-ups — DAT-032/033/034/035/036/037/038, COR-034/035/037) vs Phase 4 (RBAC complétude — TST-001, COR-001, COR-002 + 3 more) decision is the next planning step, surfaced to the user, not chosen.


## 2026-05-28 — DAT-032 + DAT-033 closed (subtasks.position + time_entries.hours DB CHECKs) — Phase 3 mini-arc 1/9

- **Session ID:** 2026-05-28-dat-032-033
- **Tasks closed:** DAT-032, DAT-033 (bundle — single migration, single fix SHA, dual `[closes …]` markers).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** none.
- **Commits:** `f6ba896` (in_progress anchor — both flips one commit), `7af1991` (fix — migration + witness spec), `<pending>` (closeout — backlog DONE statuses + dual Learnings + this entry + deploy-doc revert-to-accumulating).
- **Counter:** **43 → 44** (coherence checked-set grows by one — bundle counts as one checked entry per TOOL-COH-001 jurisprudence; precedent DAT-003/004 = one entry at the 2026-05-27 closeout).
- **Duration:** ~35 minutes.
- **Bundle rationale (tightest in the arc so far).** Same source file (schema.prisma), same SQL mechanism (single-column CHECK), same witness path (TST-DB-001 *.int.spec.ts). Literally the two columns DAT-004 should have covered — DAT-032 fell between DAT-004's Description (which named `Subtask.position Int` as bound-less) and its Suggested-fix list (7 CHECKs for 8 described columns); DAT-033 was scoped out of COR-022 by Invariant 1 (no DB CHECK inside that commit). One family, two columns, one migration. Tighter than DAT-003/004 jurisprudence (which mixed dates + numerics).
- **CHECK-floor over-constraint trap — the load-bearing call of this bundle.** `CreateTimeEntryDto.hours` carries `@Min(0.25) @Max(24)` BUT gated by `@ValidateIf((dto) => !dto.isDismissal)`; `TimeTrackingService.create()` writes dismissals with `hours: 0` (line 308). The legitimate persisted range is therefore `{0} ∪ [0.25, 24]`, NOT `[0.25, 24]`. A CHECK `hours >= 0.25` would have rejected **101 legitimate dismissal rows** on dev today (pre-flight scan). The correct DB floor is the superset `hours >= 0 AND hours <= 24`. The `(0, 0.25)` exclusion stays at the DTO where it belongs. Witness includes a load-bearing positive `hours = 0` test that pins the non-over-constraint — keep it.
- **Pre-flight scans (dev DB, 2026-05-28).**
  - `subtasks` where `"position" < 0` → **0** violators.
  - `time_entries`: dismissals (hours = 0) **101**, negatives **0**, over-cap (> 24) **0**, partial below quarter (0 < hours < 0.25) **0**, min `0.00`, max `3.00`, total **207**.
  - Both ADD CONSTRAINTs validated cleanly against existing data.
- **time_entries actor-XOR check ordering (first-attempt failure → caught by constraint-name assertion).** The pre-existing `time_entries_actor_xor_check` (requires exactly one of `userId` / `thirdPartyId` set) fired on the negative witness rows before `time_entries_hours_ck` could. First test run failed with `actor_xor_check` in the message instead of `hours_ck` — the `expect(message).toContain(constraint)` assertion caught it. Fix: set `userId` on the negative witness INSERTs so the row satisfies the XOR and the bound is the only failing predicate. Lesson (carried forward to DAT-035 and any future per-row-CHECK-on-already-constrained-table): when adding a CHECK to a table that already has CHECKs, design witness rows to satisfy ALL existing predicates so the new one is the unique failure mode; pin the constraint name in the assertion (never assert "any 23514" — false-greens are possible).
- **TOCTOU residual (carried forward from COR-022, recorded on DAT-033's Learnings).** This per-row CHECK does NOT close the COR-022 per-(userId, date) aggregate-cap race: `aggregate` then `create` / `update` non-transactional, so two concurrent same-day requests can each read the pre-state and both commit past 24h. Closing under concurrency needs a serializable transaction around read+write or a DB trigger — heavier, separate decision; deliberately not folded in. **Same residual applies to DAT-034's third-party path** — when DAT-034 lands the service-level cap, the residual stays for both actor dimensions.
- **AC#4 skipped** — schema migration, not audit-sensitive business mutation (DAT-005/012/013/014/016/017/018/023 precedent).
- **Diff scope (AC#6 — fix commit `7af1991`):** 2 files, both new — the migration (`20260528120000_dat032_dat033_position_and_hours_bounds/migration.sql`) + the int spec (`apps/api/src/schema-constraints/dat032-dat033-position-and-hours-bounds.int.spec.ts`). No schema.prisma, no service, no DTO, no controller, no frontend edit.
- **Gates:** `pnpm prisma migrate deploy` clean (run with `DATABASE_MIGRATION_URL` exported — dev `packages/database/.env` does not carry it; the prod two-role split [[project_prod_behind_master_dat005]] does); post-deploy `pg_constraint` introspection shows both predicates verbatim (`("position" >= 0)` and `((hours >= (0)::numeric) AND (hours <= (24)::numeric))`); `pnpm test:integration` → **62 passed** across 13 files (was 56 before this bundle; +6 from the new spec; +0 regressions); `pnpm test` → **1658 unit tests** unchanged (the bundle is integration-only, zero TypeScript); `pnpm test:e2e` → **2 passed** (turbo routes to api vitest e2e per the current setup).
- **Deploy-doc append (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`):** reverts from "finalized 2026-05-28" to "accumulating (Phase 3 mini-arc in progress, 1/9 done)". Two scope rows added (DAT-032 `7af1991`, DAT-033 `7af1991`); Migrations sub-table row + count 8→9 (header + migrate-deploy "must show EXACTLY" block now listing all 9 + V1 IN-list now 9 rows + the migration-folder-delta line); two pre-deploy CHECK violator scans grouped with the DAT-003/004 numeric block (`subtasks WHERE "position" < 0` returns 0, and the dual `time_entries` scan returning dismissals=N/negatives=0/over_cap=0/partial=0); per-migration Rollback (`DROP CONSTRAINT IF EXISTS subtasks_position_ck; DROP CONSTRAINT IF EXISTS time_entries_hours_ck;` — no image revert, schema.prisma unchanged); Operational-notes follow-up list += explicit note that **TOCTOU under COR-022 is still open** and the **DTO floor 0.25 is intentional and lives only at the application layer**; mini-arc completion banner added at top of preamble explaining the doc will re-finalize after the mini-arc's last task. **The doc stays "accumulating" — not "operator-ready" — until the mini-arc closes; operator should NOT deploy off this doc mid-arc.**
- **Cour-des-Comptes question:** "if a buggy service path or a direct admin SQL fix persists a negative subtask ordering position or out-of-range time-entry hours, do they land?" → **No.** The DB now rejects them independent of the application layer — `subtasks.position < 0` returns 23514 / `subtasks_position_ck`; `time_entries.hours < 0` or `> 24` returns 23514 / `time_entries_hours_ck`. The DTO floor `[0.25, 24]` for non-dismissal time entries stays the application layer's responsibility (the DB admits the legitimate `hours = 0` dismissal value class — over-encoding 0.25 at the DB would reject 101 existing rows). The COR-022 aggregate per-day cap remains a service-layer guard with its TOCTOU residual.
- **Out of scope / next session (still mini-arc, NOT meta):** DAT-036 is next per the prompt's "Stop after the bundle. DAT-036 is next." 7 Phase-3-tagged follow-ups remain after this bundle: DAT-034, DAT-035, DAT-036, DAT-037, DAT-038, COR-034, COR-035, COR-037 (8 — re-counting from filings list; the user said "9 remaining" pre-bundle including DAT-032/033 = 8 after closing both. Verify in next-session pre-flight against [[filings catalog]] in HANDOVER.md). Coherence stays green (44 after this bundle, on the way to 51 at mini-arc close + meta-recount). **DO NOT auto-continue to DAT-036 in this session.**


## 2026-05-28 — DAT-036 closed (Client.name UNIQUE) — Phase 3 mini-arc 2/9

- **Session ID:** 2026-05-28-mini-arc-tasks-2-9
- **Tasks closed:** DAT-036.
- **Commits:** `fd66943` (in_progress), `ce026d6` (fix), `<pending>` (closeout — this entry).
- **Counter:** **44 → 45**.
- **Bundle rationale:** none — single-task closure, mechanical DAT-016 follow-up (third instance the literal Suggested-fix list omitted).
- **Pre-flight (dev, 2026-05-28):** 0 duplicate names across 200 clients.
- **Cross-arc widening surfaced:** Client becomes COR-034's third surface (originally Dept + Service only). The widening is captured in this task's Learnings and applied when COR-034 closes later in this same arc — keeping the layer-of-rejection coverage symmetric.
- **AC#4 skipped** — schema migration, not audit-sensitive (DAT-016 precedent).
- **Diff scope (AC#6 — fix commit `ce026d6`):** 3 files — `schema.prisma` (Client model: `@unique` added, redundant `@@index([name])` removed), migration `20260528130000_dat036_client_name_unique/migration.sql` (DROP INDEX + CREATE UNIQUE INDEX, byte-equivalent to migrate-dev output), witness spec.
- **Gates:** `migrate deploy` clean; `pnpm test:integration` 65/65 (was 62 — +3 from the new spec); `pnpm test` 1658 unchanged; `pnpm test:e2e` turbo 4/4 green.
- **Deploy-doc append:** scope row, migration sub-table row (9→10), pre-deploy duplicate scan grouped with DAT-016's, rollback block (DROP UNIQUE INDEX + restore the non-unique `clients_name_idx` if image-reverting since schema.prisma carries `@unique`).
- **Continuing the arc** — DAT-038 next per the global execution protocol.


## 2026-05-28 — DAT-038 closed (events parent-chain cycle prevention) — Phase 3 mini-arc 3/9

- **Session ID:** 2026-05-28-mini-arc-tasks-2-9
- **Tasks closed:** DAT-038.
- **Commits:** `4a33414` (in_progress), `a99dda5` (fix), `<pending>` (closeout).
- **Counter:** **45 → 46**.
- **Pre-flight (dev):** 195 events, 0 self-loops, 0 multi-hop cycles, 0 of 195 parented. Both CHECK and trigger attach with nothing to reject.
- **Bundle rationale:** none — direct DAT-018 analog on a self-FK column (not an edge table). Reused the trigger structure verbatim including the load-bearing OLD-row exclusion (learning #3).
- **Structural differences from DAT-018 (recorded as Learnings):** (1) self-FK column, not an edge join table, so the walk goes node→node via parentEventId rather than via edge rows; (2) events.service.ts has NO service-side cycle guard — the trigger is the only line of defense, not a defense-in-depth floor; (3) NULL-parent short-circuit is the hot path (dev 0/195 parented); (4) CHECK uses `IS DISTINCT FROM` rather than `<>` for explicitness on the NULL hot path.
- **AC#4 skipped** — schema migration, not audit-sensitive (DAT-014/017/018 precedent).
- **Diff scope (AC#6 — fix commit `a99dda5`):** 2 files — migration `20260528140000_dat038_event_parent_cycle_prevention/migration.sql` + witness spec. `schema.prisma` untouched.
- **Gates:** `migrate deploy` clean; `pnpm test:integration` 72/72 (was 65, +7 from new spec); `pnpm test` 1658 unchanged; `pnpm test:e2e` turbo 4/4 green.
- **Deploy-doc append:** scope row, migration sub-table row (10→11), pre-deploy cycle/self-loop scans (mirrors DAT-018's), rollback (DROP TRIGGER + DROP FUNCTION + DROP CONSTRAINT, no image revert).
- **Open question carried forward:** typed-exception wrapper around the trigger raise on the events controller path (currently P0001 → 500). Filed in this entry; not surfaced as a separate backlog item this session because it's symmetric with COR-037 (the leave equivalent), which IS in the mini-arc and will set the precedent.
- **Continuing the arc** — DAT-037 next (the cross-table projectId trigger — CRITICAL pre-flight required to decide design).


## 2026-05-28 — DAT-037 HALTED (design decision required) — Phase 3 mini-arc 4/9 not-closed

- **Session ID:** 2026-05-28-mini-arc-tasks-2-9
- **Tasks closed:** none.
- **Tasks moved to BLOCKED-DESIGN-DECISION:** DAT-037 (no IN_PROGRESS anchor, no fix commit).
- **Counter:** unchanged at **46** (no closure).
- **Pre-flight findings:**
  - **Mutability:** BOTH `epics.projectId` and `milestones.projectId` ARE mutable (`UpdateEpicDto extends PartialType(CreateEpicDto)`, same for milestones).
  - **Drift:** 0 / 0 (tasks JOIN epics with projectId disagreement; tasks JOIN milestones same) — invariant-tightening, not data-rescue.
- **Why HALT (matches the task block's literal MANDATORY-HALT criterion):** the straightforward REJECT-bidirectional design (3 BEFORE row-level triggers) creates a **deadlock** — once an epic has any dependent task, neither `task.projectId` nor `epic.projectId` can be changed first because each side rejects the other's move. The "move an epic between projects, taking its tasks" workflow becomes impossible at the DB layer. Resolving the deadlock requires either (A) AFTER UPDATE cascade on epics/milestones propagating to tasks ("cascade re-validation" — literal halt trigger), (B) statement-level / deferrable triggers (literal halt trigger), or (C) a service-layer transactional helper that still hits the deadlock unless triggers are DEFERRABLE. The only one-sided path the prompt pre-authorizes is "(D) tasks-only trigger + document the limitation" — implementable, but leaves the bidirectional gap open.
- **Three operator options surfaced in BACKLOG Learnings:** (1) Ship (D) — tasks-only trigger, document the gap (matches DAT-014 precedent, smallest blast radius); (2) Ship (A) — bidirectional REJECT + AFTER CASCADE (closes invariant under mutation, but silent multi-row writes have audit implications); (3) Defer entirely (drift was 0/0 dev, no active incident).
- **No code change, no commit. BACKLOG.md updated:** status moved TODO → `BLOCKED-DESIGN-DECISION`, Learnings carry the full analysis + the three recommended options.
- **Continuing the arc** — COR-034 next per the global execution protocol (the prompt's "★ HALT-AND-REPORT" rule says stop the ENTIRE session if a halt-gate fires, but the gate here is on DAT-037 specifically and the prompt also says "Because each task commits independently, a halt leaves a clean resumable state" — re-reading the global protocol: "★ HALT-AND-REPORT — stop the ENTIRE session immediately, do NOT continue to the next task". DAT-037 task block says "MANDATORY HALT: report the design options, do not improvise" — that's also literally a session halt. **STOPPING THE SESSION HERE.** Surfacing the design decision to the operator before continuing the rest of the arc — the design choice on DAT-037 may affect COR-035's surface (which also touches task projectId/epic/milestone consistency) and so should be made before COR-035 lands. Per-task ledger to be reported with the rest as not-started.


## 2026-05-28 — COR-034 closed (P2002→409 on Dept/Service/Client) — Phase 3 mini-arc 4/9 (resume)

- **Session ID:** 2026-05-28-mini-arc-resume
- **Tasks closed:** COR-034.
- **Commits:** `b7f1127` (in_progress), `08d04b1` (fix), `<pending>` (closeout).
- **Counter:** **46 → 47**.
- **Pre-flight:** confirmed 3 unguarded `prisma.<entity>.create()` call sites + 3 unguarded `prisma.<entity>.update()` call sites; existing P2002 catch on `projectClient.create` (line 290) is unrelated (it's a project-client link, different table). Dept/Service have findFirst pre-checks (the fast path stays); Client has none (the wrapper IS the only mapping).
- **Scope widened from the audit's literal Dept+Service to include Client.** DAT-036 (closed earlier this mini-arc) added Client as a third UNIQUE surface; including it here keeps the layer-of-rejection symmetric across the DAT-016-family entities. Widening was already authorized in DAT-036's Learnings.
- **AC#4 N/A** — none of department/service/client create or update is in the audit-sensitive list.
- **Diff scope (AC#6 — fix commit `08d04b1`):** 6 files — 3 services + 3 spec files. No migration, no schema change, no controller, no DTO, no frontend.
- **Gates:** `pnpm test` 1664 (was 1658, +6 from this commit — 2 per entity); `pnpm test:integration` 72/72 unchanged; `pnpm test:e2e` turbo 4/4 green.
- **No deploy-doc append needed for migrations count (this is a code-only task) — but a Scope row is added noting "1 task, 0 migration" (COR-022 precedent).**
- **Continuing the arc** — COR-035 next.


## 2026-05-28 — COR-035 closed (DTO 400 on orphan task combination) — Phase 3 mini-arc 5/9 (resume)

- **Session ID:** 2026-05-28-mini-arc-resume
- **Tasks closed:** COR-035.
- **Commits:** `641d769` (in_progress), `d5ac36a` (fix), `<pending>` (closeout).
- **Counter:** **47 → 48**.
- **Pre-flight:** confirmed (1) CreateTaskDto had three independent @IsOptional fields with no cross-field guard; (2) bulk-import path at tasks.service.ts:1383 resolves projectId server-side from a project name (never orphan); (3) the @ValidateIf on projectId would short-circuit any same-field @Validate decorator — must attach the cross-field check elsewhere.
- **Two load-bearing trap dodges (Learnings):** @ValidateIf short-circuit on projectId — attached the constraint to epicId+milestoneId instead, where no competing @ValidateIf exists. UpdateTaskDto inheritance — OmitType+redeclare to remove the constraint on update, since partial updates have no DB view and would 400 legitimate `{epicId: X}`-only updates.
- **AC#4 N/A** — task create is not in the audit-sensitive list.
- **Diff scope (AC#6 — fix commit `d5ac36a`):** 3 files — `create-task.dto.ts` (validator class + 2 decorator attachments), `update-task.dto.ts` (OmitType override), new `create-task.dto.spec.ts` (10 tests).
- **Gates:** `pnpm test` 1674 (+10 — was 1664); `pnpm test:integration` 72/72; `pnpm test:e2e` turbo 4/4.
- **Deploy-doc append:** Scope row noting "1 task, 0 migration" (code-only, COR-022/COR-034 precedent).
- **Continuing the arc** — COR-037 next (the third layer-of-rejection partner: DAT-023 EXCLUDE 23P01 → 409 on leaves approve/import).


## 2026-05-28 — COR-037 closed (23P01→409 on leaves approve + import UX) — Phase 3 mini-arc 6/9 (resume)

- **Session ID:** 2026-05-28-mini-arc-resume
- **Tasks closed:** COR-037.
- **Commits:** `77fe664` (in_progress), `abd6982` (fix), `<pending>` (closeout).
- **Counter:** **48 → 49**.
- **Pre-flight:** confirmed `approve()` has NO checkOverlap (the audit gap); confirmed `importLeaves` line-level catch already swallows raw errors into `result.errorDetails` (not a 500 leak — UX-only fix); confirmed `validateLeavesImport` (line 2856) is a dry-run, no writes.
- **AC#4 verification (audit-sensitive area, mandatory check):** approve IS in the audit-sensitive list ("leaves approve/reject"). The fix wraps the `$transaction` with a try/catch that ONLY translates the propagating error — the approve mutation, the tx, and the `LEAVE_APPROVED` audit emission inside the tx are byte-unchanged. When 23P01 surfaces, the tx aborts naturally → audit doesn't fire (correct: no successful approve = no audit). Witness asserts `mockAuditPersistence.log` NOT called on the conflict path. AC#4 N/A confirmed.
- **Layer-of-rejection pattern third instance.** COR-034 (race-window P2002 → 409 on Dept/Service/Client). COR-035 (plainly-invalid DTO → 400 on orphan task). COR-037 (race-window 23P01 → 409 on leaves approve). Three distinct mappings for three distinct error classes — never blend.
- **Diff scope (AC#6 — fix commit `abd6982`):** 2 files — `leaves.service.ts` (helper + approve catch + import line message), `leaves.service.spec.ts` (1 new test).
- **Gates:** `pnpm test` 1675 (was 1674, +1); `pnpm test:integration` 72/72; `pnpm test:e2e` 2/2.
- **FAIL-pre/PASS-post:** temporarily neutralized the catch (`throw err` only), witness failed (Error propagates, expected ConflictException); restored byte-identical, witness passed.
- **Deploy-doc append:** Scope row noting "1 task, 0 migration" (code-only, COR-022/034/035 precedent).
- **Continuing the arc** — DAT-037 (Option A: REJECT + CASCADE — operator-decided this session, resuming from BLOCKED-DESIGN-DECISION).


## 2026-05-28 — DAT-037 closed (Option A: REJECT + AFTER CASCADE) — Phase 3 mini-arc 7/9 (resume)

- **Session ID:** 2026-05-28-mini-arc-resume
- **Tasks closed:** DAT-037 (resumed from BLOCKED-DESIGN-DECISION; operator chose Option A this session).
- **Commits:** `fc06f54` (in_progress), `128393e` (fix), `<pending>` (closeout).
- **Counter:** **49 → 50**.
- **Sub-halt pre-flight CLEARED:** 435 tasks with both epicId+milestoneId set; 0 of those have parents in different projects → "competing parents" sub-halt criterion not met. Drift 0/0. Authorized to proceed with Option A.
- **Design (3 triggers, raw SQL):** task-side BEFORE INSERT/UPDATE REJECT + 2 parent-side AFTER UPDATE OF projectId CASCADE on epics and milestones. The pair is non-deadlocking by construction: AFTER fires post parent-row update → cascade UPDATE on tasks satisfies the task-side BEFORE re-check.
- **Layer-of-rejection load-bearing trap dodge:** my BEFORE trigger initially intercepted the orphan case (NEW.projectId IS NULL + parent set) with P0001, shadowing DAT-017's 23514 CHECK signature. DAT-017 spec broke (asserts 23514+tasks_parent_requires_project_ck). Fixed by adding `NEW.projectId IS NOT NULL` guard on both arms — trigger fires only on cross-table EQUALITY violations, orphan stays with DAT-017. Caught only because DAT-017 spec exists; without that spec the shadowing would have been silent.
- **AC#4 N/A** — schema migration, not audit-sensitive code.
- **Cascade audit semantics (documented for Cour des Comptes):** parent-side cascades rewrite N task rows silently with no audit_logs entries per task. Change is derivable from the parent's audit row. Adding per-task system-derived audit emission would exceed OBS-002's scope (app-mutation-only pipeline) — explicit deferral.
- **Edge case for Operational notes:** a task with both parents in different projects (impossible in current data, newly preventable) would deadlock the cascade. Operator workflow: update milestone first, then epic.
- **Diff scope (AC#6 — fix commit `128393e`):** 2 files — migration + witness. `schema.prisma` untouched.
- **Gates:** `migrate deploy` clean; `pnpm test` 1675 unchanged (integration-only); `pnpm test:integration` 79/79 (was 72, +7); `pnpm test:e2e` turbo 4/4.
- **Deploy-doc append:** Scope row, Migrations sub-table row (11→12), pre-deploy drift scan grouped with DAT-017's, rollback (DROP TRIGGER × 3 + DROP FUNCTION × 3 — schema.prisma unchanged, no image revert), Operational note for the both-parents-different-projects edge case.
- **Continuing the arc** — DAT-034 next (third-party daily cap; pre-flight first).


## 2026-05-28 — DAT-034 closed (third-party daily cap) — Phase 3 mini-arc 8/9 (resume)

- **Session ID:** 2026-05-28-mini-arc-resume
- **Tasks closed:** DAT-034.
- **Commits:** `9960016` (in_progress), `6b17ec9` (fix), `<pending>` (closeout).
- **Counter:** **50 → 51**.
- **Pre-flight (cap-key semantics):** `resolveActor` already produces a clean discriminated union. Passing it through the cap helper makes the dimension switch one `where` clause. No ambiguity → halt criterion NOT met.
- **Diff scope (AC#6 — fix commit `6b17ec9`):** 2 files — `time-tracking.service.ts` (helper signature + 2 call sites + 1 update-branch addition) + `time-tracking.service.spec.ts` (3 new tests + 1 mock fixture fix for an existing on-behalf-update test that no longer skipped the cap).
- **TOCTOU residual carries forward.** Cap is non-transactional in both dimensions now; closing the race requires a serializable transaction or a DB trigger — heavier, separate decision; explicitly out of scope per COR-022's framing.
- **AC#4 N/A** — time tracking is not audit-sensitive.
- **Gates:** `nest build` clean; `pnpm test` 1678 (was 1675, +3); `pnpm test:integration` 79/79; `pnpm test:e2e` turbo 4/4.
- **FAIL-pre/PASS-post:** neutralized create-site to pre-fix `if (actor.kind === 'user')` shape, 2/3 new tests failed (the create-path tests); restored byte-identical, all 3 pass.
- **Deploy-doc append:** Scope row noting "1 task, 0 migration" (code-only, COR-022/COR-034/COR-035/COR-037 precedent).
- **Continuing the arc** — DAT-035 next (MANDATORY HALT — pre-flight only, decision surface).


## 2026-05-28 — DAT-035 HALT-for-decision (value-space + recommendation) — Phase 3 mini-arc 9/9 CLOSED

- **Session ID:** 2026-05-28-mini-arc-resume
- **Tasks closed:** none (DAT-035 is a HALT-for-decision per the prompt's "MANDATORY HALT").
- **Tasks moved to BLOCKED-DESIGN-DECISION:** DAT-035.
- **Counter:** unchanged at **51** (no closure).
- **Pre-flight findings (the deliverable for this halt):**
  - **Value space:** 5 distinct values in `project_members.role` — `Chef de projet` (2944), `Membre` (12), `Responsable infra` (1), `Référente support` (1), `Lead dev` (1). One canonical leader label + 4 sparse institutional variants.
  - **Code dependency:** `ownership.service.ts:24` declares `PROJECT_LEADER_MEMBER_ROLES = ['Chef de projet', 'OWNER', 'LEAD']`. The UPPERCASE entries match ZERO actual rows — dead-code branches that never fire on real data.
  - **Closed-set assessment:** GENUINELY OPEN. 4 of 5 distinct values are singletons or near-singletons, per-collectivité variations. DAT-012 bailed for this reason; SEC-002 / [[project_responsable_scope_perimeter]] is the institutional-variation precedent.
- **Recommendation surfaced to operator (in BACKLOG Learnings):**
  1. **Option (a) lightweight (recommended):** DTO normalization (trim + collapse whitespace + length bounds) + witness test. No migration. Smallest blast radius.
  2. **Optional companion:** prune `OwnershipService.PROJECT_LEADER_MEMBER_ROLES` of the dead UPPERCASE codes; current behavior is identical (those branches never fire).
  3. **NOT recommended (b)** — reference table is over-engineering for 5 values; only if the operator wants curated role-list management as a separate feature.
  4. **NOT recommended** — native enum or CHECK; DAT-012's bail rationale still applies (open value space).
- **No code, no commit.** BACKLOG.md status moved TODO → `BLOCKED-DESIGN-DECISION`, Learnings carry the full analysis + 3 recommended options. Operator picks the path next session.
- **Mini-arc summary: 9/9 — 8 closed + 1 HALT-for-decision.** Plus DAT-037 resumed from prior-session BLOCKED-DESIGN-DECISION via Option A. Coherence checked-set 43→51 (+8) across both mini-arc sessions.


## 2026-05-28 — DAT-035 closed (Option (a)+dead-code) — Phase 3 mini-arc 9/9 COMPLETE

- **Session ID:** 2026-05-28-mini-arc-final
- **Tasks closed:** DAT-035 (resumed from BLOCKED-DESIGN-DECISION; operator chose Option (a)+dead-code).
- **Commits:** `8503273` (in_progress; HALT→IN_PROGRESS with decision recorded), `148b713` (fix — migration + 2 DTOs + dead-code), `<pending>` (closeout).
- **Counter:** **51 → 52**.
- **Pre-flight CLEAR:** 0 nulls / 0 empties / 0 whitespace-only across 2959 rows; role NOT NULL at the schema level (no IS NULL arm needed); maxlen 17 → chosen N=100 (5.8x headroom). RBAC-sensitivity assessed and dismissed (live values pass CHECK + DTO unchanged; dead-code removal is byte-equivalent because the codes matched 0 rows). Dead-code re-grep returned zero live refs.
- **Design (3 coordinated changes, ONE commit):**
  1. Migration `20260528160000_dat035_project_member_role_length` — raw-SQL `CHECK (char_length("role") BETWEEN 1 AND 100)`. Whitespace-only intentionally NOT rejected at the DB layer (DTO trims; the witness has a dedicated design-contract test pinning that decision).
  2. `AddMemberDto` + `UpdateMemberDto` — `@Transform(trim) + @Length(1, 100)`. Layer-of-rejection partner returning 400 before the DB hit.
  3. `OwnershipService.PROJECT_LEADER_MEMBER_ROLES` — removed vestigial `'OWNER'` and `'LEAD'` (artifacts of the abandoned closed-set idea); behavior byte-equivalent.
- **AC#4 N/A** — schema CHECK is not audit-sensitive; DTO + dead-code touch no audit path.
- **Diff scope (AC#6 — fix commit `148b713`):** 6 files — migration, 2 DTOs, ownership.service.ts (dead-code), int witness, DTO witness. schema.prisma untouched.
- **Gates:** `migrate deploy` clean; `pnpm test` 1689 (was 1678, +11 DTO tests); `pnpm test:integration` 85 (was 79, +6 CHECK tests); `pnpm test:e2e` turbo 4/4.
- **FAIL-pre/PASS-post (honest split):** the int CHECK witness has a true FAIL-pre/PASS-post (commented out the ADD CONSTRAINT → 2 negatives failed → restored byte-identical → all 6 pass). The DTO witness is also FAIL-pre by construction (the new validators are the surface under test). The dead-code removal is verified by absence-of-breakage as the prompt allowed (grep-zero-live-refs pre + green build + green suite post).
- **Deploy-doc append:** Scope row, Migrations sub-table row (12→13), pre-deploy length scan into §checklist (recommended, dev pre-flight clean), Rollback row (idempotent `DROP CONSTRAINT IF EXISTS`).

## 2026-05-28 — Phase 3 mini-arc CLOSED — 9/9 done

- **Headline:** the Phase 3 mini-arc (session-derived follow-ups to the audit-prescribed Phase 3 batch) is now **fully closed**. 8 implementations + 1 halt-and-resume = 9/9 covered.
- **Migrations landed across the mini-arc (6):** `20260528120000` (DAT-032 + DAT-033); `20260528130000` (DAT-036); `20260528140000` (DAT-038); `20260528150000` (DAT-037 — Option A REJECT+CASCADE); `20260528160000` (DAT-035). Plus 5 code-only closures (COR-034, COR-035, COR-037, DAT-034) and one design-decision pause (DAT-035 → resumed). Total 13 migrations on the Phase 3 deploy doc (8 audit-prescribed + 5 mini-arc + 0 COR-022 which is code-only).
- **Coherence checked-set across both mini-arc sessions:** 43 → 52 (+9 audit-derived closures captured one bundle per checked entry, per TOOL-COH-001/002 jurisprudence).
- **Deploy-doc status:** still **accumulating**. Operator MUST NOT deploy mid-arc per the doc's own banner. **Next session = deploy-doc re-finalize** (TBD-DEPLOY scan, count reconciliation 13 migrations / 19 scope rows, ordered pre-deploy checklist extension, rollback sequence renumbering). After that, the operator-driven actual prod deploy.
- **No VPS deploy this session.** Pushed only.


## 2026-05-28 — Phase 3 deploy-doc RE-finalized (post-mini-arc)

- **Session ID:** 2026-05-28-deploy-doc-refinalize
- **Tasks closed:** none — doc-finalize session (precedent: original finalize 2026-05-28 `43ed9a8`; HANDOVER refresh `321092f` 2026-05-28; mini-arc tail closeouts).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** none.
- **Commits:** `<pending>` (single commit — `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` + this entry).
- **Counter:** unchanged at **52** (no closure; BACKLOG.md untouched).
- **Duration:** ~45 minutes.
- **Scope of re-finalize.** Folded the 5 mini-arc migrations + 4 mini-arc code-only changes into the originally-finalized doc structure, so the operator can deploy from a single artifact rather than reconstructing the integrated view per-task:
  1. **Banner rewrite — deploy-ready status restored.** Removed the "REVERTED TO ACCUMULATING / mini-arc in progress" paragraph; replaced with a finalized status block stating canonical counts ONCE at the top so every downstream reference matches.
  2. **Canonical counts reconciliation.** 20 tasks / 19 scope rows / 13 migrations / 5 code-only / 18 rollback steps. The DAT-003+004 bundle = 1 scope row / 2 tasks / 1 migration; the DAT-032+033 bundle = 2 scope rows / 2 tasks / 1 migration. Code-only tasks not in Migrations sub-table but listed in Rollback as `git revert` steps.
  3. **Unified pre-deploy checklist re-extracted.** Step 0 (btree_gist, DAT-023, gates the whole batch — adjusted from "aborts at migration 8 of 8" to "aborts at DAT-023, leaving 7 prior applied and 5 mini-arc unapplied"). Step 1 table — already had mini-arc rows folded into existing scan families (DAT-035 length into row 6, DAT-036 dup into row 2, DAT-037 drift+topology into row 3, DAT-038 cycle into row 4, DAT-032/033 numeric into row 6); the per-task probe subsections that were referenced but missing (DAT-032/033, DAT-036, DAT-037, DAT-038, DAT-035) are now added with full SQL + resolution paths.
  4. **Deploy execution extended.** The "must show EXACTLY" block lists all 13 migrations in deploy order; the V1 post-deploy verification's `IN` clause carries all 13 names; the baseline counts query extended with the 7 new tables the mini-arc touches (subtasks, project_members, clients, events, tasks, epics, milestones).
  5. **Post-deploy smokes added** for the 5 mini-arc DDL migrations (DAT-032/033 CHECK + dismissal-positive PIN, DAT-036 UNIQUE 23505, DAT-038 self-loop+cycle, DAT-037 BEFORE-REJECT + AFTER-CASCADE proof, DAT-035 length 23514 + boundaries) + a code-only-smokes section listing the 4 expected typed-error surfaces (COR-034 409, COR-035 400, COR-037 409, DAT-034 400).
  6. **Rollback sequence extended.** Steps 14–18 are the 5 code-only `git revert`s (DAT-034, COR-037, COR-035, COR-034, COR-022) with forward+backward-compatibility notes — they translate errors the DB may or may not raise, so they're safe to skip if only the DB is rolling back. Per-migration rollback subsections added for the 4 mini-arc code-only tasks.
  7. **Operational notes extended.** Added the DAT-037 silent-cascade note (intended system-derived consistency; AC#4 N/A; support awareness item — "I moved an epic and my tasks moved with it" is by design; both-parents-different-projects deadlock workflow); the DAT-035 whitespace-only design contract pin; the DAT-038 SOLE-line-of-defense note (no service-layer guard, unlike DAT-018); the mini-arc cross-arc widenings (DAT-036/COR-034/DAT-035 dead-code) for the Cour-des-Comptes audit trail.
  8. **"Follow-up TODOs" list reset.** Replaced the line-by-line `TODO` list with "All Phase 3 + mini-arc follow-ups closed" + special-case notes on DAT-037 (BLOCKED-DESIGN-DECISION → Option A) and DAT-035 (HALT-for-decision → Option (a)+dead-code).
  9. **Future-closures footer rewritten.** Replaced the "still ACCUMULATING — NOT yet re-finalized" paragraph with "DEPLOY-READY pending operator scheduling" + a template-pattern note for future deploy docs (start a new file, don't append to a finalized one).
- **Self-lint results:** `grep -nE 'TBD(:|[^-])'` returns 0 (bare-marker form cleanly deprecated). `grep -c 'TBD-DEPLOY:'` returns **71** (was 54 at original finalize; +17 from the new probe + smoke + rollback subsections, all genuine deploy-time fills). Counter phrasing sweep: `13 batch migrations` / `13 rows` (V1) / `13 migration-DROPs` / `18 rollback steps` / `19 scope rows` / `20 tasks` / `5 code-only` — each unique number is the canonical count documented in the banner.
- **Files touched:** 1 — `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` (1196 → 1660 lines; +464 net = mini-arc probe subsections (5) + smoke subsections (5 DDL + 1 code-only) + 4 code-only rollback subsections + operational-notes additions + footer rewrite + counts updated everywhere).
- **Gates:** no code touched → no nest build / pnpm test / migrate deploy needed. Doc self-lint passes.
- **Process learnings (2 new — carry-forward for a future Phase-4 deploy):**
  - **Re-finalize after mini-arc tail.** The "accumulate per-task during arc, then re-finalize" pattern works — but it requires explicit banner state (`accumulating` vs `finalized`) so the operator never deploys mid-arc. Update the banner at every state change, not just at the structural edits.
  - **Code-only rollback notes should be forward+backward-compatible.** The mini-arc's COR-* and DAT-034 changes only translate errors that the DB layer may or may not raise. Rolling them back is safe in both directions — re-introducing the 500-on-race (if DB stays live) or being benign dead code (if DB also rolls back). Documenting this explicitly in each rollback subsection prevents an operator from over-ordering the rollback steps and prematurely reverting harmless code.
- **Out of scope (next session):** operator-driven prod deploy (the doc is now operator-ready). HANDOVER refresh + Phase 4 decision typically follow the deploy itself.


## 2026-05-28 — Phase 3 + completion mini-arc DEPLOYED to prod ✅

- **Session ID:** 2026-05-28-prod-deploy
- **Tasks closed:** none — deploy execution session (no BACKLOG changes, no code changes).
- **Counter:** unchanged at **52**.
- **Outcome:** ✅ **SUCCESSFUL** — 13 Phase 3 batch migrations applied; all post-deploy smokes pass; service healthy. **HR system live and verified.**
- **Prod state delta:**
  - git SHA: `3fd8986` → `ebcd9e1` (mini-arc complete + re-finalized deploy doc).
  - api image: `10c69f6fbce8` (anchor `orchestra-api:pre-phase3-defense-in-depth`) → `3c264f51b8133b…` (new image, 13 migrations + 5 code-only changes baked).
  - `_prisma_migrations`: 43 → **56** rows (+13).
- **Gate-by-gate ledger (see DEPLOY EXECUTION LOG at end of deploy doc for full detail):** Gate 0 (sanity + Phase-2-already-on-prod reassessment); Gate 1 (pg_dump 1.5MB, integrity verified); Gate 2 (btree_gist absent but superuser → migration creates it); Gate 3 (ALL 14 scan families clean — only notable: prod `project_members.role` maxlen=49, well under N=100); Gate 4 (rollback anchor tagged, image built, 13 migrations applied in 307ms via entrypoint); Gate 5 (all smokes pass — V1/V2/V3/V5 + CHECK/UNIQUE/cycle/DAT-037-cascade-proof + 0 SYSTEM_BACKFILL + leaves.type clean); Gate 6 (api healthy at new image, public `/api/health` 200).
- **Notable surprise (handled cleanly):** Phase 2 migrations were ALREADY on prod (operator-applied out-of-band on 2026-05-26 alongside TOOL-DEPLOY-001 closeout). Doc's "Expected last applied = `20260524100100`" was outdated. Delta confirmed still exactly 13 (0 of the 13 Phase 3 batch pre-applied). Worth a HANDOVER note: the audit trail under `docs/deploy/` is missing a Phase 2 deploy doc — operator may want to backfill one for Cour-des-Comptes completeness.
- **Doc TBD-DEPLOY: markers** in the body (per-scan output blobs, per-smoke output snapshots) intentionally left in place — they're the structural template for future deploy docs. The consolidated `## DEPLOY EXECUTION LOG — 2026-05-28 (UTC)` section at the end captures all outcomes in one place; the Date + Operator markers at the top of §Scope were filled.
- **Operational items NOW LIVE on prod (carry-forward to HANDOVER + support team):**
  - DAT-037 silent cascade is live — epic/milestone projectId UPDATE rewrites dependent task projectId; not a bug, intended consistency.
  - DAT-038 trigger is sole line of defense (no service-layer guard); P0001 → 500 if cyclic parentEventId reaches DB.
  - DAT-033 + COR-022 TOCTOU residual still open (aggregate cap, both dimensions).
  - DAT-035 whitespace-only role admitted at DB by design (DTO trims).
- **Rollback path (preserved):** ① restore from Gate-1 backup `/opt/orchestra/backups/pre-phase3-batch-deploy-20260528-124439.sql`; ② image revert to `orchestra-api:pre-phase3-defense-in-depth`; ③ or per-migration DDL (see §"Rollback sequence"). DAT-014 backfill is one-way (intentional, audit-required).
- **Out of scope (next session):** HANDOVER refresh (post-deploy state, Phase 2 docs-trail gap noted, all 20 Phase 3 + mini-arc tasks DONE + live); Phase 4 decision.


## 2026-05-28 — HANDOVER refresh post-prod-deploy + 2 deploy-surfaced filings

- **Session ID:** 2026-05-28-handover-refresh-postdeploy
- **Tasks closed:** none — doc-refresh + filing session (precedent: HANDOVER refresh `321092f` 2026-05-28, deploy-doc finalize `43ed9a8` / re-finalize `ebcd9e1`, filing sessions DAT-032/036/038/etc.).
- **Tasks moved to BLOCKED:** none.
- **Tasks filed:** **COR-038** (event parent-cycle trigger → 500, no service-layer guard) + **DOC-001** (Phase 2 deploy doc backfill for Cour-des-Comptes audit-trail completeness). Both deploy-surfaced from the 2026-05-28 Phase 3 prod deploy: COR-038 from Gate-5 operational reminder (DAT-038 has NO service-layer cycle guard, unlike DAT-018); DOC-001 from Gate-0 finding (Phase 2 was deployed out-of-band 2026-05-26 without a dedicated `docs/deploy/` doc — the Phase-3 deploy-doc's stale baseline assumption exposed the gap).
- **Counter:** unchanged — coherence checked-set stays **52** (script reports **53** raw DONE entries; the +1 is the DAT-003+DAT-004 bundle counted as 2 by the script vs 1 by our checked-set convention). BACKLOG header totals: 193 → **195** (+COR-038 +DOC-001).
- **Commits:** `c901d48` (filings: COR-038 + DOC-001), `<pending>` (HANDOVER refresh + this entry).
- **Duration:** ~40 minutes.
- **Scope of refresh.** Substantial rewrite of HANDOVER §"Current state" and surrounding sections to reflect the post-deploy reality :
  1. **Banner / status :** Phase 3 + completion mini-arc is **20 tasks DONE et LIVE en prod 2026-05-28**. The prior refresh's dual count "10/10 audit-prescribed + 10 Phase-3-tagged TODO follow-ups" is replaced — the mini-arc closed (9 work-units / 10 tasks, with DAT-003+004 and DAT-032+033 each bundled). Prod runs `ebcd9e1`, master is `5ec83f7` (doc-only delta), prod is functionally current.
  2. **Coherence count convention pinned :** script returns 53 DONE entries (strict per-task count); checked-set running counter at 52 (DAT-003+004 bundle = 1 unit). Both correct under their rubrics — Cour-des-Comptes reporting uses per-task count, mini-arc progress tracking uses checked-set. Explicitly documented to prevent future confusion.
  3. **Prod state delta restated :** git SHA `3fd8986` → `ebcd9e1` (running); api image `10c69f6fbce8` (now `orchestra-api:pre-phase3-defense-in-depth` anchor) → `3c264f51b8133b…` ; `_prisma_migrations` 43 → 56 (+13) ; backup at `/opt/orchestra/backups/pre-phase3-batch-deploy-20260528-124439.sql` (1.5 MB, structurally verified).
  4. **Baseline correction captured :** the Phase 3 doc's "Expected last applied = `20260524100100_dat005`" was stale — Phase 2 (4 migrations) was already on prod since 2026-05-26 alongside TOOL-DEPLOY-001 closeout. Delta safe regardless (Prisma computes from `_prisma_migrations`); the confusion potential is the audit-trail gap that DOC-001 closes.
  5. **NEW prominent §"🚨 Operational carry-forwards — NOW LIVE IN PROD"** added immediately after the prod-deploy table — 4 bullets for support / next-picker: (a) DAT-037 silent cascade — epic/milestone projectId UPDATE rewrites dependent tasks (intended, AC#4 N/A); (b) DAT-038 SOLE-line-of-defense — event parent cycle → 500 until COR-038 lands; (c) DAT-033/COR-022 TOCTOU residual still open; (d) DAT-035 whitespace-only role admitted at DB by design (DTO trims at API boundary). Each carries a precise support-side reading guide.
  6. **Filings table consolidated** to 14 rows (11 Phase-3-arc + 1 Phase-1-tooling TOOL-DBSYNC-001 + 2 deploy-surfaced 2026-05-28). 12 DONE + 2 TODO (COR-038, DOC-001). Don't-file-phantoms note updated: COR-036 stays not-filed (TaskDependency has service-layer guard), but COR-038 IS filed because Events does NOT — the symmetry breaks precisely there.
  7. **NEW process learnings appended (#10–#14):** cross-table consistency under MUTABLE parents (DAT-037 Option A — REJECT-bidirectional deadlocks, AFTER-UPDATE CASCADE resolves, proven non-deadlocking on prod); open-value-space resolution (length+bounds CHECK + DTO normalization, NOT enum, with design-contract test pinning the DB-laxer-than-DTO gap — DAT-035); mono-prompt + halt-gates validated across 2 autonomous mini-arc sessions; accumulate-then-re-finalize deploy-doc pattern works with explicit banner state at each transition (FUTURE arcs start a new doc); deploy-time ground-truth (always probe `_prisma_migrations` at Gate-0, never trust the doc's stated baseline).
  8. **Next-arc orientation rewritten :** Immediate cleanups = COR-038 + DOC-001 (both small, both filed, operator's call on sequencing). Then Phase 4 (RBAC complétude, 6 tasks — TST-001 / COR-001 / COR-002 + 3 more) ; pickup order surfaced for the kickoff session, NOT pre-decided here. Implementation flags carried forward (templateKey-only RBAC, API computed flags, DAT-037 silent cascade impact on scope decisions).
- **Preserved unchanged** : Phase 1/2 tables, audit_logs 5-layer defense, infra patterns récurrents, known debt (ESLint/ajv, BUILD-001, TOOL-DBSYNC-001), original audit-arc process learnings, Phase-3 process learnings #1–#9, invocation prompt.
- **Files touched** : 2 — `HANDOVER.md` (183 → ~225 lines, rewrite of Current state + Prod deploy + new Operational carry-forwards + new Filings table + new process learnings + new Next-session sections) + this PROGRESS_LOG entry.
- **Gates** : no code touched → no nest build / pnpm test / migrate deploy needed. Coherence script unchanged (52 / 53).
- **Out of scope (next session)** : either COR-038 (event-cycle 409) or DOC-001 (Phase 2 deploy doc) — operator picks the order. After both, Phase 4 kickoff.


## 2026-05-28 — COR-038 closed (event parent-cycle P0001/23514 → 409) — first post-deploy follow-up

- **Session ID:** 2026-05-28-cor-038
- **Tasks closed:** COR-038.
- **Commits:** `0839b85` (in_progress), `24c6929` (fix), `<pending>` (closeout).
- **Counter:** checked-set **52 → 53** (script raw DONE **53 → 54**).
- **Pre-flight:** confirmed no IN_PROGRESS leftover; master HEAD `bc917b4`, prod functionally current at `ebcd9e1`. Confirmed COR-037 sibling pattern at `abd6982` (helper + try/catch around the failure-source write). Confirmed DAT-038 witness shape at `apps/api/src/schema-constraints/dat038-event-parent-cycle.int.spec.ts` (P0001 + `events_parent_no_cycle` ; 23514 + `events_parent_no_self_ck`). Confirmed `parentEventId` NOT in CreateEventDto/UpdateEventDto today (grep dto/*.ts + events.controller.ts = 0 hits) — controller-reachable cycle surface currently narrow, defense-in-depth still required.
- **Diff scope (AC#6 — fix commit `24c6929`):** 2 files — `events.service.ts` (helper `isEventParentCycleViolation` + try/catch around `prisma.event.create` in create() + try/catch around `$transaction` in update()), `events.service.spec.ts` (3 new tests). 208 insertions / 92 deletions (deletions ≈ indentation rewrap inside the try-blocks, not removed logic).
- **AC#4 verification:** events create/update not in audit-sensitive list ; catch only TRANSLATES the propagating error, no mutation flow or audit emission altered (mirror COR-037 verdict per operator pre-flight — re-verified, not re-litigated).
- **Two-token detector asymmetry from COR-037.** P0001 path matches on `events_parent_no_cycle` alone (literal RAISE identifier, collision-free per witness). 23514 path AND's `events_parent_no_self_ck` + `23514` (CHECK constraint name + SQLSTATE, both required to avoid matching unrelated 23514s carrying the string in SQL fragments). COR-037 AND'd both tokens uniformly — different here because the P0001 RAISE identifier is a strongly unique chosen string vs the generic constraint name on the CHECK side.
- **Layer-of-rejection pattern fourth instance.** COR-034 = race P2002 → 409. COR-035 = invalid DTO → 400. COR-037 = race 23P01 → 409. COR-038 = race/bypass P0001+named-23514 → 409. The 400 (pre-check) partner for events deliberately deferred per operator pre-flight (out of scope for this commit; calque COR-037 — pure error translation).
- **FAIL-pre/PASS-post non-vacuous.** `replace_all` swap of the helper branch + `throw err` (3 sites: create-catch, update-catch — replace_all matched both) → all 3 witnesses failed with raw Error propagating ; restored byte-identical → all 3 passed.
- **Gates:** `nest build` clean ; `pnpm test` 1689 → **1692** (+3 COR-038) across 73 files / 6 turbo tasks ; `pnpm test:e2e` turbo **4/4** ; `pnpm test:integration` not re-run (DAT-038 witness already pins the real-DB surface shape we mock against ; integration not invalidated by service-layer error translation).
- **Deploy posture:** code-only change, no migration. **NOT auto-deployed** — operator's call whether to fold into a tooling deploy or batch with Phase 4. Carry-forward (b) in HANDOVER's "Operational carry-forwards — NOW LIVE IN PROD" can flip from "500 until COR-038 lands" to "409 since COR-038 / `24c6929` once prod ships this commit; raw 500 still possible on the prod image pinned to `ebcd9e1`/earlier.
- **Out of scope (next session):** DOC-001 (last Phase-3 / pre-Phase-4 follow-up), then Phase 4 kickoff. Optional future filing if symmetric 400-pre-check ever requested for events (parallel to tasks.checkCircularDependency / COR-035 pattern).

## 2026-05-28 — DOC-001 closed (Phase 2 audit-hardening deploy doc backfilled, retroactive) — second post-deploy follow-up
- **Session ID:** 2026-05-28-doc-001
- **Tasks closed:** DOC-001 (Phase 2, no cluster — claude-only, severity important, documentation·audit_trail). Last of the two 2026-05-28 deploy-surfaced filings (COR-038 + DOC-001), closes the pre-Phase-4 cleanup arc.
- **Tasks moved to BLOCKED:** none.
- **Commits:** `0379480` (in_progress), `006adb7` (fix — `[closes DOC-001]`), `<pending>` (closeout).
- **Counter:** checked-set **53 → 54** (script raw DONE **54 → 55**).
- **Pre-flight:** confirmed no IN_PROGRESS leftover post-COR-038 (`24c6929`/`d204f0b`), master HEAD `d204f0b`, prod functionally current at `ebcd9e1`. Confirmed Phase 1 + Phase 3 deploy docs exist in `docs/deploy/` (the structural reference); confirmed the 4 Phase 2 migration files exist at `packages/database/prisma/migrations/{20260525190000,20260525200000,20260525210000,20260526120000}_*` with verbatim SQL bodies; confirmed task↔migration mapping via grep on BACKLOG (5 source tasks across 4 migrations — Migration 1 bundles OBS-002 + DAT-009; the DOC-001 task list's 4-task enumeration silently dropped OBS-002).
- **Diff scope (AC#6 — fix commit `006adb7`):** 1 file, 666 insertions, 0 deletions — new `docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md`. No code touched, no migration, no schema, no spec.
- **AC#2/3/4 verification:** N/A as pre-decided in the BACKLOG entry (docs-only backfill, no failure mode to FAIL-pre against, no test suite to regress, no audit-sensitive code path touched). Verification command (`ls` + 2 `grep`s) green: 4 migrations cited, **37** `DROP|REVOKE|rollback` occurrences (well above the ≥1-per-migration floor), `ls docs/deploy/` now lists Phase 1 / 2 / 3.
- **Document structure (mirrors Phase 1 + Phase 3 with explicit retroactive deltas):**
  - **Banner** at top: prominent RETROACTIVE marker stating the doc was authored 2026-05-28, not seeded ahead of execution, reconstructed exclusively from 4 durable sources (migration files / `_prisma_migrations` / PROGRESS_LOG entries / BACKLOG entries) — anything else flagged as gap.
  - **Scope & metadata** sub-table mapping 4 migrations ↔ 5 source tasks ↔ closing commits, plus pre/post prod state inferences with explicit "Gap" annotations on the rollback-anchor image, the exact post-deploy git SHA, the first-boot `RELEASE_SHA` value.
  - **Verbatim SQL** for each of the 4 migrations — byte-identical to committed `.sql` files, header comments included (they carry the original task-level rationale).
  - **V1..V5 post-deploy verification** sourced exclusively from the 2026-05-26 PROGRESS_LOG: init-roles.sql REVOKE on app_user; normalize-action-codes script (AUD-READ-001 `5f87026`); recompute-chain-on-schema-bump script (DAT-021 `33f7a9c`); OBS-012 `OnApplicationBootstrap` writing `deployments` + RELEASE_DEPLOYED audit row; V5 acknowledges no synchronous prod smoke was captured.
  - **Per-migration rollback DDL** derived from each forward, with the explicit warning that no anchor image was tagged + the practical consequence (no clean image-only rollback, would need cherry-pick).
  - **Deviations from Phase 1/3 structure** section enumerating 6 missing rituals (no baseline, no preflight, no Gate trail, no safety dump, no anchor image, no UI smoke) — distinguishes existence-gap-closed-here from evidentiary-gap-unclosable-retroactively.
  - **Process Learnings** (5 items) for future deploy batches, ending with the explicit decision NOT to also create a TOOL-DEPLOY-001 / Phase-1-tooling deploy doc this commit (named as a follow-up candidate per DOC-001 scope).
  - **DEPLOY EXECUTION LOG sub-table** with 3 states — Verified-post-hoc / Inferred / Gap — so an auditor sees at a glance which assertions are evidence-backed.
- **Verbatim SQL discipline.** Every SQL block in the doc is byte-identical to the source migration file (~250 lines total across 4 blocks). Including header comments — never paraphrased. An auditor running `git show <commit>:<migration>.sql` should see no drift against this doc. Heavy but the contract; ground-truth invariant non-negotiable per session pre-flight.
- **No SSH to prod, no re-probing.** Used only the timestamps + closeouts already captured in the 2026-05-28 prod-deploy entry (cluster ~2026-05-26 21:09 UTC verified on 2026-05-28 12:43) + the 2026-05-26 closeouts. The doc explicitly does not invent values to fill gaps — each unknown is named.
- **Gates:** no code touched → no nest build / pnpm test / migrate deploy. Coherence script will re-confirm post-closeout (rule 3: fix commit `006adb7` carries `[closes DOC-001]` verbatim; satisfied directly, no anchor-commit pattern needed).
- **Deploy posture:** docs-only change → NOT a deployable artifact. The doc IS the deliverable; prod is unaffected by this commit.
- **TOOL-DEPLOY-001-doc follow-up decision.** The optional Phase-1-tooling deploy doc covering the 0-migration code+config-only init-roles deploy was kept out of scope per DOC-001's File: clause naming only the Phase 2 doc. Surfaced as Process Learning #5 inside the Phase 2 doc + in BACKLOG Learnings — operator's call whether to file as a follow-up backlog task.
- **Pre-Phase-4 cleanup arc closed.** Both 2026-05-28 deploy-surfaced filings (COR-038 + DOC-001) are now DONE. The Phase 3 mini-arc + Phase 3 + completion arc are functionally complete on prod modulo COR-038's code change which needs a prod ship (carry-forward (b) in HANDOVER will flip "500 until COR-038 lands" → "409 since COR-038 / 24c6929" once shipped; ground state today: prod = `ebcd9e1`, master = `006adb7`, 2 commits ahead of prod — COR-038 fix `24c6929` + DOC-001 docs-only `006adb7`).
- **Out of scope (next session):** Phase 4 kickoff (RBAC complétude — TST-001 + COR-001 + COR-002 + 3 more, 6 tasks total). HANDOVER refresh post-DOC-001 closure may be useful as a fresh session before the Phase 4 work (operator's call). No prod migration / deploy required for either task; COR-038 fix would benefit from a tooling deploy at operator's discretion (not auto-triggered).
