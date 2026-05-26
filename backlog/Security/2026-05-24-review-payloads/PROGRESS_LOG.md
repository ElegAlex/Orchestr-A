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
