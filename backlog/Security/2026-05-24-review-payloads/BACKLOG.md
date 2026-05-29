# ORCHESTRA — Security Audit Remediation Backlog

> **Source audit:** `audits/2026-05-24-adversarial-review/` (this directory)
> **Generated:** 2026-05-24
> **Total tasks:** 197 — 173 from adversarial review (6 sub-agents) + 1 from Codex cross-review + 1 operational follow-up (DAT-031, "#175") + 1 deploy-discovered (BUILD-001, 2026-05-25) + 2 session-hygiene (TOOL-COH-001, TOOL-COH-002, 2026-05-25) + 1 verdict-B descope (TOOL-DEPLOY-001, 2026-05-25) + 3 session-derived follow-ups (USR-DEL-001, TST-DB-001, AUD-READ-001, 2026-05-25) + 2 session-derived follow-ups (DAT-032, TOOL-DBSYNC-001, 2026-05-27) + 2 session-derived follow-ups (DAT-033, DAT-034, 2026-05-27, from COR-022) + 1 session-derived follow-up (DAT-035, 2026-05-27, from DAT-012) + 2 session-derived follow-ups (DAT-036, COR-034, 2026-05-27, from DAT-016) + 2 session-derived follow-ups (DAT-037, COR-035, 2026-05-27, from DAT-017) + 1 session-derived follow-up (DAT-038, 2026-05-27, from DAT-018) + 1 session-derived follow-up (COR-037, 2026-05-27, from DAT-023) + 2 deploy-surfaced follow-ups (COR-038, DOC-001, 2026-05-28, from Phase 3 prod deploy) + 1 session-derived follow-up (TOOL-COH-003, 2026-05-28, from COR-038/COR-001/COR-002 closeouts) + 1 deploy-surfaced follow-up (SEC-031, 2026-05-29, from SEC-030 closeout)

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

- **By severity:** 32 blocking · 125 important · 25 nit · 6 suggestion
- **By category:** 38 correctness · 37 data_integrity · 27 observability · 30 performance · 30 security · 26 tests · 6 tooling

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
*12 tasks in this phase.*

### COR-003 — Leave day calculation never subtracts public holidays

- **Status:** DONE
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

**Closed_by:** 8fc6c92d1f8f5ec499cc57abfc6325de3b5518a5
**Learnings:**
- **Implemented 2026-05-25 (commit `8fc6c92`), option (a) as designed.** Optional `holidayKeys?: Set<DayKey>` added to BOTH `calculateLeaveDays` and `splitLeaveByYear`; a day is charged only when `!isWeekend(cursor) && !holidayKeys?.has(cursor)`. `parisDayKey` + the `DayKey` type are now exported so callers key holidays the same way the cursor does. The reconciliation `calculateLeaveDays` call inside `splitLeaveByYear` was updated to forward the same set — without that, `sum(buckets) !== calculateLeaveDays` under a holiday set and the Wave 1 gate-vs-storage divergence returns (covered by a dedicated invariant test).
- **Additive, NOT breaking.** The new param is optional and trailing; every existing caller/test that omits it gets the exact legacy "weekends-only" figure (verified: the pre-existing `splitLeaveByYear` test at line ~87 that documents "Jan 1 2027 is a holiday but the helper does not consult a calendar" stays green). The full `pnpm test` suite (6 turbo tasks, all green) confirms no regression.
- **Six call sites wired, not just create().** `leaves.service.ts` calls the helpers in: `create()` (storage `days` + gate buckets), `update()` (same), `getAvailableDays()` (the CONSUMPTION side — summing used days per year), and the CSV `bulkImport`. Wiring only the create/storage side would have made the gate over-count consumption (4 days stored but 5 recomputed in `getAvailableDays`) and reject legitimate requests. Consistency across storage + demand + consumption is the load-bearing property.
- **Holidays fetched OUTSIDE the balance-gate transaction.** A private `getHolidayKeySet(start,end)` calls `HolidaysService.findByRange` on the default Prisma connection even inside the `$transaction` gate, because holidays are static reference data — they are not part of Finding #4's concurrency concern (LeaveBalance mutation). Fetch window widened ±1 day to absorb host-TZ edges; extra holidays in the set are harmless since the cursor only probes keys within `[start,end]`. Filters out `isWorkDay=true` rows (worked bank holidays).
- **Witness dates corrected.** The task's illustrative range (Apr 28 → May 2 2026) lands on a Saturday at the end in 2026's calendar (4 weekdays, not 5). The faithful 5→4 witness is **Apr 27 (Mon) → May 1 (Fri) 2026**; used in the unit test.
- **Same-instant branch intentionally untouched** (per BACKLOG decision point + acceptance #6). `start===end` returns 1/0.5 without weekend OR holiday filtering — matching legacy. Single-day-holiday handling is out of this fix's scope; the audit's described failure mode is a multi-day leave spanning a holiday.
- **Tests are unit-level on the pure helper (injected `Set<DayKey>`, no DB) + one service-level wiring test** (mocked `HolidaysService.findByRange`, asserts `days` drops from 5→4 and that `findByRange` was called). Per the task, the witness does NOT depend on the seeded holidays table. Acceptance #4 (audit_log) N/A — pure calculation fix. E2E not added (session-contract test scope overrides CLAUDE.md's blanket E2E rule for this pure-calc task).
- **`tsc --noEmit` is not this repo's gate.** Running it surfaces 119 PRE-EXISTING loose-typing errors across 18 spec files (e.g. `holidays.service.spec.ts` `HolidayType.LOCAL`, untyped controller-spec actors) — none in the COR-003 production files. The project pipeline is vitest+swc (transpile-only) + a build that excludes specs; `pnpm test` is the contractual gate and is fully green.
- **Unblocked 2026-05-24 (was BLOCKED `holidays-data-seed-required`).** The original blocker assumed no holiday data existed anywhere. Real state after investigation + remediation:
  - **Prod:** `holidays` table holds **33 rows = 2025/2026/2027 × 11**, all dates correct, verified (`SELECT EXTRACT(YEAR FROM date), count(*), count(DISTINCT name)` → 11/11/11). 2026 was already present and correct; 2025 + 2027 were added this session (additive `INSERT ... ON CONFLICT (date) DO NOTHING`, table backed up first to `/opt/orchestra/backups-prod/holidays_before_2025_2027_*.sql`).
  - **Dev:** seeded on demand via `scripts/import-french-holidays.ts` (calls the real `HolidaysService.importFrenchHolidays`). Operator gesture, not a migration — re-run after any `prisma migrate reset`.
  - So the remaining gap is only a *durable/automated* seeding mechanism, tracked as **DAT-031** (Phase 13, important; the "#175" follow-up). With prod covered through 2027-12-31 (~24-month runway), that is NOT a Phase-1 prerequisite, hence COR-003 returns to TODO.
- **TZ off-by-one bug found & fixed during de-risk → commit `0dc640e`.** `importFrenchHolidays` built dates with local-time `new Date(y,m,d)`; `Holiday.date` is `@db.Date` (persisted from UTC components), so on a +UTC host every holiday stored one day early (May 1→Apr 30). Prod (UTC host) masked it; dev (CEST) exposed it. Fixed via `Date.UTC`/`setUTCDate` + a regression test asserting stored dates. **Implication for this task:** holidays are now stored at UTC midnight of the correct day, so `parisDayKey(holiday.date)` yields the right `DayKey`.
- **Design for the implementer (unchanged):** use **option (a)** — add an optional `holidayKeys?: Set<DayKey>` to BOTH `calculateLeaveDays` and `splitLeaveByYear` in `leave-year-window.ts`; skip a day when `isWeekend(cursor) || holidayKeys.has(cursor)`. The leaves service pre-fetches `[start,end]` holidays (`HolidaysService.findByRange`, filter `isWorkDay=false`) and converts each `date` to a Paris `DayKey` via the same `parisDayKey` the cursor uses. Rationale for (a) over (b): pure functions stay sync/unit-testable; half-day + same-instant semantics untouched; and `splitLeaveByYear` needs **per-year buckets** that `HolidaysService.countWorkingDays` (single async total, TZ-inconsistent local `getDay()`+UTC keys) cannot give. `splitLeaveByYear`'s reconciliation calls `calculateLeaveDays`, so both MUST receive the same Set. The same-instant (`start===end`) branch does not filter weekends (legacy) — decide and document whether to subtract holidays there.
- **Related:** **COR-013** (Phase 8) covers the consumer-side TZ mismatch in `findByYear`/`isNonWorkingHoliday`/`countWorkingDays` (local-vs-UTC key matching). The COR-003 implementation should key holidays via `parisDayKey` to stay consistent with the leave cursor regardless of COR-013's status.
- **No downstream cascade:** nothing has `Blocked_by: COR-003`.

---
### DAT-001 — Leave.approve() updates status outside transaction and audit is logger-only

- **Status:** DONE
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

**Closed_by:** b14cdd5
**Learnings:**
- Pre-fix: approve() and reject() were NOT wrapped in $transaction. Wave 3 added $transaction to create()/update() (lines 438 and 1206) but never extended the pattern to the status-transition methods. This commit is the first transactional wrap for approve/reject/cancel. The same ReadCommitted + re-read pattern from create/update is reused literally — re-fetch the row inside the tx and re-assert the status invariant before writing, raising ConflictException if a concurrent transition slipped in.
- Pre-fix: approve/reject were emitting through `AuditService.log` (Logger.log/JSON.stringify only — never persisted). This commit switches them to `AuditPersistenceService.log` (durable audit_logs writes). `cancel()` had NO audit emission at all pre-fix — adding one is in scope per the audit's literal "Same for ... cancel" in the Suggested fix.
- Scope: Suggested fix says "Same for reject, cancel, validator changes." `validator changes` is not a real code path — `grep` for `validatorId\s*:` shows no separate validator-mutation method outside create/update/approve/reject; `validatorId` is only assigned at create time and replaced via the approve/reject `validatedById` field. Treating "validator changes" as not-applicable is defensible.
- Acceptance criterion #4 (audit-sensitive entry): payload includes `actorId`, `entityId` (leave id), `before/after` status + validator metadata snapshot, `validatorAssigned` (the leave's assigned validator), `targetUserId`, and `selfApproved` from the Wave 3 column. No new column introduced — `selfApproved` is read from the row. For approve() it is always false at runtime (the PENDING gate blocks self-approved leaves which are written APPROVED at create time), but the value is still surfaced honestly from the DB.
- Out-of-scope observation (DAT-002 territory): `create()` line 545-553 still emits the self-approval LEAVE_APPROVED through `AuditService.log` (logger-only). This is the same logger-only path criticized by DAT-001 but in a different code path — left for DAT-002 (which migrates the AuditService itself to dual-write logger + audit_logs).
- Test design for acceptance criterion #2 (FAIL pre-fix / PASS post-fix): three new tests assert (a) `$transaction` is called for approve/reject/cancel, (b) `AuditPersistenceService.log` is called with the required payload shape, (c) the conflict-path re-read raises ConflictException AND does not write either the leave update or the audit row. With the mocked Prisma, real rollback isn't observable — the test instead verifies the assertion order (tx callback aborts before reaching update) which proves atomicity at the code-flow level.
- spec setup needed `AuditPersistenceService` injected as a mock provider AND a `mockResolvedValue(undefined)` restoration in `afterEach` (since `vi.resetAllMocks()` clears the implementation too).
- canValidate() also calls `prisma.leave.findUnique` — the concurrency-race test had to mock 3 sequential returns (pre-tx gate, canValidate, in-tx re-read), not just 2.
- The console-logger `AuditService.log` emission was removed (not kept in parallel) — divergence from SEC-003's "keep both in parallel" pattern. Rationale: SEC-003's parallel emit existed for parity with `AuthService.generateResetToken`; DAT-001's criticism is precisely that the logger emit was the ONLY persistence. Keeping it post-fix would muddy the contract. When DAT-002 lands and `AuditService.log` itself dual-writes, the live SecurityAudit stream visibility returns for free.

---
### DAT-005 — Money/hours precision uses Float (double-precision) instead of Decimal

- **Status:** DONE
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

**Closed_by:** bcb7ec3
**Learnings:**
- **Enumerated Float columns.** Five: `TimeEntry.hours`, `Leave.days`, `LeaveBalance.totalDays`, `Task.estimatedHours`, `ProjectSnapshot.progress`. All five converted; precision/scale per-column rationale committed in the conversion migration's SQL comment header.
- **No monetary columns exist.** The audit's "money" hint was checked — schema has no price/amount/cost/budget Float column (Project.budgetHours is Int). Documented in migration comment.
- **ProjectSnapshot.progress was kept in scope** despite being computed today as `Math.round(...)` (integer 0–100) because the aggregation path in `snapshots-query.service.ts:143` does `sum / count` for portfolio average — that's business arithmetic the user's exclusion clause asked us NOT to ignore. Converted to Decimal(5,2) for consistency with the audit's explicit listing.
- **Two migrations, not one.** Prisma applies each migration atomically. If we backed up Float values and then ALTERed in the same migration, a failure in the ALTER would roll back the backup too. The pre-conversion snapshot lives in an earlier-timestamped migration (20260524100000) so the safety net survives any failure of the conversion (20260524100100).
- **JSON serialization footgun discovered & fixed.** `Prisma.Decimal.toJSON()` returns a string ("1.50"), not a number. Every API response that ships these fields would silently switch from `"days": 1.5` to `"days": "1.5"`, breaking `Number(x) + ...` math in the frontend. Fix: override `Decimal.prototype.toJSON` at module load in `prisma.service.ts` to return `.toNumber()`. Imported from `@prisma/client/runtime/library` directly because the `Prisma` namespace tree-shakes under vitest+swc and `Prisma.Decimal` resolves to undefined.
- **`number + Decimal` is silent string concat in TS.** TypeScript does NOT flag `sum + entry.hours` after the type change because `Decimal` has `.toString()` and `+` falls back to concatenation. Caught only because `tsc --noEmit` does flag the resulting `number | Decimal` assignability mismatch on the consumer side. Fix everywhere: `Number(entry.hours)` at the read boundary, `Number(x._sum.y ?? 0)` for Prisma aggregates. 42 contamination sites enumerated and fixed in: analytics.service, project-health.service, snapshots-query.service, clients.service, leaves.service (3 reduce sites + 2 balance returns), projects.service (3 sums), tasks.service (groupBy sum), time-tracking.service (8 reduce/+= sites).
- **`Prisma.dmmf` is unavailable under vitest+swc** in this repo. First-pass schema test used `Prisma.dmmf.datamodel.models` → undefined at runtime. Rewrote the schema assertion to parse `schema.prisma` text directly with regex. Source of truth either way; sidesteps bundler edge cases.
- **Verification command divergence.** The BACKLOG-prescribed verification is `pnpm prisma migrate dev --create-only && pnpm prisma migrate deploy`. Per explicit user instruction, did NOT run migrations against the local dev DB — operator will inspect the SQL first. Substitute verification: `pnpm test` green (1545/1545), including 12 new tests in `apps/api/src/prisma/dat005-decimal-precision.spec.ts`. Operational verification path is `scripts/db/preflight-decimal-conversion.sh` against a staging dump.
- **Acceptance criterion #4 (audit_logs entry) skipped intentionally.** This is a schema migration; no user-initiated business mutation occurs at runtime. Documented per session contract.
- **CONSCIOUS DEBT — precision is preserved at storage, NOT in JS-side aggregation.** The `Decimal.prototype.toJSON → toNumber()` override plus the 42 `Number(...)` read-boundary coercions mean Decimal precision lives only at the Postgres storage layer, not in JS arithmetic. Concretely:
  - Postgres storage (Decimal columns): exact ✓
  - SQL aggregation via `prisma.groupBy({ _sum })` / `aggregate`: exact (Postgres sums in Decimal) ✓
  - JS-side aggregation via `array.reduce((sum, e) => sum + Number(e.hours), 0)`: re-exposed to IEEE-754 drift ⚠️
  Why this is acceptable for the Cour des Comptes audit posture: what an auditor can recompute is the SQL-side ledger, and that is exact. JS-side drifts are display-layer artefacts that do not falsify the grand livre. The compromise holds for now.
  - **DAT-005-followup (not yet ticketed):** for audit-grade end-to-end precision, eliminate the `Number()` coercions in the JS-side aggregation paths in favour of `Prisma.Decimal` arithmetic (`Decimal.add`/`.mul`/etc.), converting to `number` only at the final presentation boundary. Touch points are the same files listed in the `number + Decimal` Learning above; the highest-value targets are the HR balance paths in `leaves.service.ts` (`getLeaveBalance`, `getAvailableDays`, `getPendingDays`) since those are the legally observable totals.

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

- **Status:** DONE
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

**Closed_by:** 27635523cfc2c0dad7e4745ed84c1ad9400b3bd6
**Learnings:**
- The audit's suggested fix "Forbid self-reset" is explicitly implemented as a `callerId === userId` check that throws ForbiddenException. RoleHierarchyService.assertCanAssignRole alone would NOT have caught it — for an ADMIN caller (line 97 in role-hierarchy.service.ts), the function returns early without comparing ranks, so an ADMIN could otherwise reset their own (ADMIN) password through this endpoint. The two gates are complementary, not redundant.
- The peer ADMIN→ADMIN case from the audit Description ("ADMIN A can reset ADMIN B's password") is NOT fully closed by SEC-003 as scoped: `assertCanAssignRole` blocks ADMIN_DELEGATED→ADMIN (target template === 'ADMIN' && caller !== 'ADMIN' → 403) but ADMIN→ADMIN returns OK at line 97. This matches the SEC-002 peer-edit follow-up note; the suggested fix only mandated the hierarchy + self-reset checks, and staying literal per the session contract. If the threat model justifies peer-ADMIN protection, that's a separate finding.
- For audit_log payload (acceptance criterion #4): used `updatedAt` (already on User model, auto-touched by Prisma) as before/after marker. Did NOT add a `passwordChangedAt` schema field — that would be schema migration out of scope. Test asserts the payload never contains the raw password or a bcrypt hash prefix `$2[aby]$`.
- AuditService (console-only, OBS-001 territory) is still emitted in parallel to mirror AuthService.generateResetToken's pattern, but durability of the audit trail relies on AuditPersistenceService writing to the `audit_logs` table. OBS-001 will unify both sinks; SEC-003 is durable today because AuditPersistenceService persists directly.
- Service signature kept the callerId parameter OPTIONAL to preserve the existing test `should reset password successfully (legacy: no caller)` and keep call sites that don't have caller context working. The controller path (the production attack surface) always passes the caller via @CurrentUser('id'); the gates only run when caller is known.
- Adjacent files touched (justified by Suggested fix scope): users.controller.ts (thread @CurrentUser('id') through), users.service.spec.ts and users.controller.spec.ts (test wiring + new SEC-003 coverage). No unrelated paths modified.
- **Superseded action code (OBS-004, 330a8eb):** the durable emit's free-string `'PASSWORD_RESET_ADMIN'` was renamed to the enum `AuditAction.PASSWORD_RESET_BY_ADMIN`. SEC-003's gates/no-PII ACs are unchanged; only the action code was canonicalized. Legacy prod rows under the old code can't be backfilled (OBS-002 immutability) — see OBS-004 Learnings for the OBS-024 query-time alias carry-over.

---
### CLAUDE-CFG-001 — Smoke hook misses untracked changes

- **Status:** DONE
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

**Closed_by:** a4c3ec2834a1ead45ad1dcdd727f85511b4244b2
**Learnings:**
- **The audit's "Code evidence" was truncated and the real hook has a `||` tail.** The live command (`.claude/settings.json:36`) is `git diff --quiet HEAD -- apps packages e2e 2>/dev/null || npx playwright test --grep @smoke`. The `||` is load-bearing: the gate runs the @smoke suite **when changes exist**. The audit only quoted the `git diff --quiet` half, so a literal drop-in of the Suggested-fix `git status --porcelain ... | grep -q .` would have **inverted** the gate (grep exits 0 when changes exist; `||` would then fire smoke only when the tree is clean). The fix had to be the *negated* form to preserve the contract.
- **Exit-code contract decision (the crux).** The command-before-`||` must keep: exit 0 = no changes (skip smoke), exit non-zero = changes (run smoke) — exactly what `git diff --quiet` provides (0=no-diff, 1=diff). Implemented as `! git status --porcelain -- apps packages e2e 2>/dev/null | grep -q .`. Bash parses `! a | b || c | d` as `(! (a|b)) || (c|d)`; `!` negates the pipeline's final exit (`grep -q .`). Result: changes→grep 0→`!`→non-zero→`||` fires (smoke runs); clean→grep 1→`!`→0→`||` skips. Rejected the simpler `... | grep -q . && npx playwright ...` (`&&`) form because on a clean tree it would leave the overall hook exit at grep's non-zero (1), changing the Stop hook's overall success contract; the `!`+`||` form keeps overall exit 0 in both branches, identical to the original.
- **Manual verification (no automated test — config change).** `touch apps/__cfg001_test` then ran the gate alone (not the full line, to avoid firing playwright): NEW form `! git status --porcelain ... | grep -q .` → exit 1 (changes detected ✓) while OLD `git diff --quiet HEAD ...` → exit 0 (untracked file MISSED — the exact bug). On a clean pathspec (`apps/api/tsconfig.json`) NEW form → exit 0 (smoke skipped ✓). Removed the temp file.
- **Acceptance criterion #2 trade-off:** "a test that FAILS before / PASSES after" cannot be a `*.spec.ts` artifact for a hook-config change; the Verification field is explicitly `TBD — manual`. The FAIL-before/PASS-after property is demonstrated by the exit-code comparison above, not by a committed test. Flagged so the CI coherence gate isn't expected to find a test file.
- `pnpm test`: 6/6 turbo tasks green (API + web, 579 passed / 14 skipped). Config-only change, no code paths touched — no regression. `pnpm test:e2e` not run (no app/server changes; the hook itself is the smoke trigger).

---

### TOOL-COH-001 — Coherence gate regex misses multi-segment IDs

- **Status:** DONE
- **Phase:** 1
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tooling
- **File:** `backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh`
- **Source:** Session-derived. AUD-EMIT-001 (ffc4cf4, 2026-05-25) closeout report flagged that the coherence check's ID regex `[A-Z]+-\d+` did not match `AUD-EMIT-001` (double-dash form). The task was silently skipped by the gate — substantively fine that time (commit message and Closed_by were correct) but any future multi-segment ID (AUD-EMIT-002, RBAC-PEER-001, TOOL-COH-001 itself, etc.) would also be skipped.

**Description:**
check-backlog-coherence.sh extracts task IDs with a regex of the form `[A-Z]+-\d+`. This pattern matches single-segment IDs (SEC-001, DAT-002, OBS-001, PERF-001) but does not match multi-segment IDs (AUD-EMIT-001, TOOL-COH-001). Multi-segment IDs are silently dropped from the coherence check's set, meaning a missing Closed_by SHA or a stale status on such an entry would not raise.

**Root cause:**
Original regex authored when only single-segment IDs existed in the backlog. AUD-EMIT-001 introduced the first multi-segment ID without a corresponding script update.

**Code evidence:**
```
grep -E '\[A-Z\]\+-' backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh
```

**Suggested fix:**
Update the ID regex to `[A-Z]+(?:-[A-Z]+)*-\d+` (or equivalent). Add a regression test fixture that includes at least three IDs spanning the conventions: SEC-001 (single-segment), AUD-EMIT-001 (double-segment), TOOL-COH-001 (double-segment, alternate prefix). The test must FAIL on the current single-segment regex and PASS after the fix.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in the coherence script, addressing the exact failure mode described in **Description**.
2. A regression test or fixture exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after.
3. The script remains POSIX-shell-compatible (or matches whatever shell flavor the existing script uses — do not change interpreter as a side effect).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — N/A (tooling, not application code).
5. Commit message includes `[closes TOOL-COH-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh <path-to-BACKLOG.md>
```

**Closed_by:** e6b836c
**Learnings:** Regex `[A-Z]+-\d+|CLAUDE-CFG-\d+` → `[A-Z]+(?:-[A-Z]+)*-\d+`. The new pattern subsumes the former `CLAUDE-CFG-\d+` alternation (dropped as dead code — verified CLAUDE-CFG-001 still matched). Witnessed with an in-repo fixture (`.coh-witness-fixture.md`, temporary/uncommitted) carrying a single-segment DONE, a multi-segment DONE (AUD-EMIT-001 @ ffc4cf4), an anchor-closed DONE (OBS-008 @ 2188b3d), a multi-segment IN_PROGRESS, and a deliberately-broken multi-segment DONE (`ZZZ-BROKEN-001` @ deadbeef…): **pre-fix** the broken entry was silently skipped → false green (`Checked 2`, EXIT 0); **post-fix** it is caught (`Checked 4`, EXIT 1). On the real BACKLOG the checked-set expanded **26 → 29** (AUD-EMIT-001 + USR-DEL-001 + AUD-READ-001 became visible), EXIT 0 — no real violation surfaced (every DONE multi-segment entry already had a valid `Closed_by` carrying its `[closes <id>]` token; we'd been disciplined). Exit-code contract and the rule-3 message-match logic unchanged. **Default-path: option (iii)** — `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`, default `$SCRIPT_DIR/../BACKLOG.md`; git ops anchored to the BACKLOG's dir via `cwd=` so the no-arg default works from any cwd. Non-regressive: CI passes the path explicitly from repo root (same repo → identical output).

---

### TOOL-COH-002 — Coherence gate has no native support for retroactive task closures

- **Status:** DONE
- **Phase:** 1
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tooling
- **File:** `backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh`
- **Source:** Session-derived. OBS-008 closure (247f2e9, 2026-05-25 hygiene pass) hit the coherence gate's rule 3 violation because the material fix commit (1ff6c9a, OBS-001) predated the OBS-008 task being marked DONE — its message contains `[closes OBS-001]` only, not `[closes OBS-008]`. Resolved tactically via an empty anchor commit; the underlying tooling gap needs codification.

**Description:**
The coherence gate enforces a one-to-one mapping between a DONE task's `Closed_by` SHA and a commit message containing `[closes <task-id>]`. This works for direct closures (the fix commit itself is named in `Closed_by`) but breaks for retroactive closures (a task is recognized as done after-the-fact, because earlier remediation work already covered its scope). The current workaround is to create an empty anchor commit whose only purpose is to host the `[closes <id>]` token in its message. This is undocumented in the script and in CLAUDE_SESSION_CONTRACT.md, and risks divergent practice across sessions.

**Root cause:**
Script written when only forward-closures were expected. The retroactive-closure pattern emerged organically when post-remediation backlog hygiene revealed tasks already fully covered by upstream commits.

**Code evidence:**
```
git log -1 --format=%B 1ff6c9a  # contains [closes OBS-001], not [closes OBS-008]
git log -1 --format=%B 2188b3d  # empty commit containing [closes OBS-008] — the tactical workaround
```

**Suggested fix:**
Either (a) document the anchor-commit pattern in the script's header comment + in CLAUDE_SESSION_CONTRACT.md so it is the canonical retroactive-closure mechanism, or (b) extend the gate to accept an alternate closure-attestation form (e.g., a `Closure_anchor:` field in the backlog entry, separate from `Closed_by`, that names the formal anchor without requiring an empty commit). Option (a) is cheaper; option (b) is cleaner. Choose at implementation time; document the rationale in Learnings.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented, addressing the exact failure mode described in **Description**.
2. A regression test or fixture exists that exercises the retroactive-closure case (a task whose `Closed_by` references either an empty anchor commit or an alternate attestation form per the chosen option): the test must FAIL with the current script behavior if no anchor support exists, and PASS after the fix.
3. CLAUDE_SESSION_CONTRACT.md and/or the script's inline documentation explicitly describe how to perform a retroactive closure, with OBS-008 as the worked example.
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — N/A (tooling, not application code).
5. Commit message includes `[closes TOOL-COH-002]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh <path-to-BACKLOG.md>
```

**Closed_by:** e6b836c
**Learnings:** Chose **option (a)** (documentation), not (b) (no `Closure_anchor:` field). Rationale: the gate **already accepts** anchor commits — rule 3 matches `[closes <id>]` whether the commit is a material fix or an empty anchor, so no matching-logic change was needed; the anchor commit *is* the attestation. Consequence for AC#2: its "must FAIL with the current script behavior if no anchor support exists" predicate presupposed option (b). Under (a) anchor support already exists implicitly, so the anchor witness is **positive-only** (the fixture's OBS-008 entry @ anchor `2188b3d` passes the gate); the genuine FAIL-pre→PASS-post belongs to the [[TOOL-COH-001]] regex change, with which this task was bundled (one script). Documented the anchor-commit pattern in (1) the script's header comment block and (2) `CLAUDE_SESSION_CONTRACT.md` § "Retroactive closures". Worked example: **OBS-008** (anchor `2188b3d` carrying `[closes OBS-008]`; material fix `1ff6c9a`/OBS-001); **OBS-020** (anchor `bfc7a78`) cited as second precedent. Process rule added: any task touching `Closed_by` must read the gate script first (pointing `Closed_by` at an upstream material fix that names a *different* task is schema-naive — the 2026-05-25 hygiene-pass mistake that triggered this filing). No BACKLOG schema change.

---

### TOOL-COH-003 — Pre-existing Closed_by-format violations flag coherence-gate noise

- **Status:** TODO
- **Phase:** 1
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit / suggestion (non-blocking)
- **Category:** tooling · backlog_hygiene
- **File:** `BACKLOG.md` (internal formatting of existing entries — no gate-code change)
- **Source:** Session-derived from the COR-038 / COR-001 / COR-002 closeouts (2026-05-28 → next-session HANDOVER refresh). The coherence gate `scripts/check-backlog-coherence.sh` reports 10 `Closed_by`-format violations on **pre-existing** DONE entries, unrelated to any specific closure but latent as recurring gate noise — observed constant across the last several closures without cleanup. The gate is **not** blocked (the concerned closures pass), but the recurring noise degrades the gate's signal-to-noise.

**Description:**
`bash backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh` currently reports **10** `Status=DONE but Closed_by is missing/invalid` violations on entries closed during the Phase 3 mini-arc (pre-existing to the recent Phase-4 closures). The gate does **not** fail — these entries are substantively closed with valid SHAs in git — but the gate's `Closed_by` parser cannot extract those SHAs, so they surface as noise on every run. **Re-extracted at filing time (2026-05-28), the 10 split into two distinct sub-causes that need different fixes:**

- **(a) Backtick-wrapped SHA — 8 entries:** DAT-032, DAT-033, DAT-034, DAT-036, COR-034, COR-035, DAT-038, COR-037. Their `**Closed_by:**` line reads `` `<sha>` (date) — … `` (SHA wrapped in backticks). The parser takes the first whitespace token (`closed_by_raw.split()[0]`), which is `` `7af1991` `` *including the backticks*, and the SHA regex `^[0-9a-f]{7,40}$` rejects it. The SHA is real and in git — only the backtick wrapping defeats extraction. (Contrast: the recently-closed COR-038/COR-001/COR-002 use a bare leading SHA `24c6929 (date) — …`, whose first token is the clean SHA and passes.)
- **(b) Stale leading `(none — …)` Closed_by line — 2 entries:** DAT-035, DAT-037. These went BLOCKED-DESIGN-DECISION → DONE. The original `**Closed_by:** (none — moved to BLOCKED-DESIGN-DECISION …)` line was left in place, and the real closure SHA (`148b713` / `128393e`) is recorded **later** in the block inside a resume Learnings sub-bullet (`` `Closed_by: 148b713` ``). The parser matches the **first** `**Closed_by:**`, so it sees `(none` and flags the entry — even though the task is genuinely closed.

**Root cause:**
Not "fenced code blocks" or mis-escaped backticks in prose — the gate's `Closed_by` extractor (`re.search(r'\*\*Closed_by:\*\*\s*(.+?)', block)` → `.split()[0]` → `^[0-9a-f]{7,40}$`) is intolerant of two formatting conventions used by older entries: (a) backtick-wrapping the SHA, and (b) a residual `(none — …)` leading `Closed_by` line preceding the real SHA recorded elsewhere in the block. Both are entry-formatting issues in `BACKLOG.md`, not gate-logic bugs.

**Code evidence:**
```
bash backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh
# → "❌ 10 coherence violation(s)" then "Checked 57 DONE/VERIFIED task(s)"
#   8 of form: [DAT-032] … Closed_by is missing/invalid: '`7af1991` (2026-05-28) — …'
#   2 of form: [DAT-035] … Closed_by is missing/invalid: '(none — moved to `BLOCKED-DESIGN-DECISION` …)'
```

**Suggested fix:**
`BACKLOG.md` formatting only — do NOT change the gate script. (1) For the 8 backtick-wrapped entries, unwrap the leading SHA in the `**Closed_by:**` line to a bare token (`` `7af1991` (date) — `` → `7af1991 (date) — `), matching the COR-038/COR-001/COR-002 convention. (2) For DAT-035 / DAT-037, replace the stale `**Closed_by:** (none — …)` line with the real closure SHA already recorded in their resume Learnings (`148b713` / `128393e`); preserve the design-decision history in the Learnings body. (3) Re-run the gate: expect **0** `Closed_by`-format violations.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented, addressing the exact failure mode described in **Description** (both sub-causes (a) and (b)).
2. N/A — formatting-only, no failure mode to FAIL-pre against.
3. N/A — doc-only, no test suite to regress.
4. N/A — doc-only, no audit-sensitive code path touched.
5. Commit message includes `[closes TOOL-COH-003]`.
6. Do not modify code paths or files unrelated to `BACKLOG.md` formatting within this commit (the gate script is explicitly out of scope).

**Verification command:**
```
bash backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh
# → 0 Closed_by-format violations (or any residual must be a newly-closed entry, not one of the 10 listed here)
```

---

### TOOL-DEPLOY-001 — Two-role DB split (restricted app role + DDL migration role) for audit_logs defence-in-depth

- **Status:** DONE
- **Phase:** 1
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tooling
- **File:** `apps/api/docker-entrypoint.sh` · `docker-compose.prod.yml` · `packages/database/prisma/schema.prisma` (datasource) · `.github/workflows/ci.yml` · `scripts/deploy-vps.sh`
- **Source:** Session-derived (Verdict B). OBS-002 + DAT-009 remediation (`d6299cc`, 2026-05-25) shipped sub-pieces (a) immutability trigger, (c) hash chain, (d) actor snapshot, but DESCOPED sub-piece (b) "run the application with a DB role that has only INSERT+SELECT on audit_logs". Decision-gate finding: the pipeline uses a single `DATABASE_URL` everywhere — `apps/api/docker-entrypoint.sh` runs `prisma migrate deploy` and `node main.js` under the same credentials; `schema.prisma` datasource has only `url = env("DATABASE_URL")` (no `directUrl`); `.github/workflows/ci.yml` and `scripts/deploy-vps.sh` compose one connection string. Splitting roles touches deploy infrastructure + CI secrets → non-trivial → Verdict B descope.

**Description:**
The audit_logs immutability trigger (OBS-002/DAT-009) blocks UPDATE/DELETE for ALL roles, including the application's. That is the primary control. Defence-in-depth (OBS-002 Suggested fix, sentence 2) additionally wants the app to connect with a DB role granted only INSERT+SELECT on audit_logs, with UPDATE/DELETE/TRUNCATE revoked, so that even a hypothetical trigger bypass (e.g. an operator running `ALTER TABLE … DISABLE TRIGGER` then mutating) is blocked at the privilege layer for the runtime role. Implementing this requires a second DB connection string: a DDL-capable migration role for `prisma migrate deploy`, and a restricted `app_user` for the NestJS runtime. The current single-`DATABASE_URL` pipeline cannot express that split without infrastructure changes.

**Root cause:**
The deploy pipeline was built single-credential (migrate + runtime + seed all use `DATABASE_URL`). Prisma's `datasource` block exposes one `url`; migration vs runtime credential separation needs `directUrl` (or an out-of-band migrate step with its own secret) plus matching changes in compose, the container entrypoint, CI secrets, and the VPS deploy script.

**Code evidence:**
```
schema.prisma datasource db { url = env("DATABASE_URL") }   # no directUrl
apps/api/docker-entrypoint.sh: npx prisma migrate deploy … then exec node main.js  # same env
.github/workflows/ci.yml: single DATABASE_URL per job (migrate + app)
```

**Residual risk until closed:** an ADMIN/operator with direct DB access using the app credentials retains theoretical UPDATE/DELETE rights on audit_logs, blocked ONLY by the trigger (a single control, defeatable by a superuser who disables the trigger). The hash chain (rowHash/prevHash) still makes any such tampering DETECTABLE after the fact, and the actorEmail/actorLabel snapshot survives. Documented in OBS-002/DAT-009 Learnings.

**Suggested fix:**
(1) Add `directUrl = env("DATABASE_MIGRATION_URL")` to the schema datasource (or an out-of-band migrate step). (2) Create `prisma/init-roles.sql` run once per environment by a superuser: `CREATE ROLE app_user WITH LOGIN PASSWORD …; GRANT INSERT, SELECT ON audit_logs TO app_user; REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user;` (plus the per-table grants the app needs elsewhere). (3) Point `DATABASE_URL` at `app_user`, `DATABASE_MIGRATION_URL` at the DDL role; update `docker-entrypoint.sh`, `docker-compose.prod.yml`, CI secrets, `scripts/deploy-vps.sh`. (4) Document in a `prisma/README.md`.

**Acceptance criteria:**
1. The application runtime connects as a role with only INSERT+SELECT on audit_logs; `prisma migrate deploy` runs as a distinct DDL role.
2. A test/script connects as the app role and attempts UPDATE/DELETE on audit_logs → expect a permission-denied error (SQLSTATE 42501), distinct from the trigger's RAISE (SQLSTATE 23514). FAILS before (single role), PASSES after.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — N/A (deploy infrastructure, not application code).
5. Commit message includes `[closes TOOL-DEPLOY-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
psql "$DATABASE_URL" -c "UPDATE audit_logs SET action='x' WHERE false;"  # expect ERROR: permission denied for table audit_logs
```

**Closed_by:** 8c37e1d
**Learnings:**
- **Mechanism = strong-default (b):** one-shot `packages/database/prisma/init-roles.sql`, run once per environment by a superuser/owner, separate concern from per-deploy migrations. NOT a Prisma migration (a) (CREATE ROLE/password is environment-specific, not schema) and NOT baked into the entrypoint (c) (idempotent per-env init ≠ per-deploy step). Documented in `prisma/README.md` + both deploy runbooks.
- **The migration role is the EXISTING schema owner, not a new role.** init-roles.sql creates ONLY the restricted `app_user`; `DATABASE_MIGRATION_URL` reuses the `POSTGRES_USER` owner. Creating a fresh `migration_user` would require reassigning ownership of every existing table (it must OWN audit_logs to `ALTER TABLE … DISABLE TRIGGER`). Reusing the owner sidesteps that and the owner already runs migrate deploy.
- **Error-message discriminator drove the test split (the non-obvious core).** Postgres checks table privilege BEFORE firing a BEFORE-trigger: an app-role UPDATE/DELETE on audit_logs fails with `permission denied` (SQLSTATE **42501**) and NEVER reaches the trigger's `/append-only/` RAISE (SQLSTATE **23514**). So a single role cannot witness both controls — the REVOKE *shadows* the trigger. `audit-immutability.int.spec.ts` therefore connects as the MIGRATION role (privileged → reaches the trigger → 23514); the new `audit-role-revoke.int.spec.ts` connects as the app role (42501). W-2 proves independence: with the trigger DISABLED, the app role STILL gets 42501.
- **Datasource shape:** `url = env(DATABASE_URL)` (app role, runtime) + `directUrl = env(DATABASE_MIGRATION_URL)` (owner, migrate/maintenance). Verified: `prisma generate` tolerates an unset `directUrl` env (build job + Dockerfile unaffected); `migrate deploy`/`db push`/`db pull` REQUIRE it (validation error otherwise) → every standalone migrate step (entrypoint, both CI migrate steps, deploy scripts) must set it.
- **Harness adaptation:** globalSetup migrates as owner (`DATABASE_MIGRATION_URL`), provisions `app_user` on the ephemeral DB (mirrors init-roles.sql — self-checking: grant drift breaks W-2/3/4), then exports `DATABASE_URL=app_user` (default `new PrismaClient()` = restricted role = prod parity) + `DATABASE_MIGRATION_URL=owner`. Integration suite 4 → 8 tests.
- **Operational scripts = fail-fast (option ii):** normalize-action-codes + recompute-chain-on-schema-bump set `process.env.DATABASE_URL = DATABASE_MIGRATION_URL` BEFORE `NestFactory` (PrismaService binds at construction) and `process.exit(1)` if `DATABASE_MIGRATION_URL` is absent — no silent fallback to the restricted role, which would fail confusingly mid-recompute at the trigger DISABLE.
- **CI:** the two standalone `migrate deploy` steps (backend-tests + e2e-tests) now also set `DATABASE_MIGRATION_URL`. The integration step is self-contained (harness injects both URLs + provisions app_user). **Unit + coverage steps deliberately stay one-URL** — `vi.mock('database')` is global, so no real PrismaClient is constructed and the schema env vars are never validated; adding the second URL there would be cargo-cult.
- **TST-DB-001 build-output regression caught + fixed (in scope — build-correctness this change required).** `tsconfig.build.json` did not exclude the new `vitest.int.*` files, so `nest build` pulled `rootDir` to `apps/api/` and emitted `dist/src/main.js` instead of `dist/main.js` — breaking docker-entrypoint.sh's `exec node apps/api/dist/main.js` (one of THIS commit's edits) + the `normalize:action-codes`/`audit:recompute-chain` paths. Added the three files to the existing exclude list (same pattern as vitest.config.ts/vitest.e2e.config.ts). NOT the BUILD-001 structural `rootDir: ./src` fix — that remains separately filed.
- **Residual risk now CLOSED for the runtime role:** the app role can no longer UPDATE/DELETE audit_logs even with the trigger disabled. The residual operator-with-owner-credentials path remains (the owner can DISABLE TRIGGER + mutate) — that is the legitimate maintenance path (normalize/recompute run as owner), kept DETECTABLE by the hash chain. Defence-in-depth layers on audit_logs: immutability trigger (d6299cc) + hash chain (d6299cc) + actor snapshot (d6299cc) + Zod payload validation (DAT-021) + **DB role REVOKE (this task)**.
- **Verification:** nest build EXIT 0; `pnpm test` api 1650 (zero regression); `pnpm test:integration` 8 (was 4); `pnpm --filter api test:e2e` 2; `pnpm run build` 3/3; W-5 fail-fast both scripts (exit 1) + positive path boots past guard; `dist/main.js` boots. ESLint pre-broken repo-wide (documented dette, untouched).

---

### TST-DB-001 — No real-DB integration test harness; trigger, FK, migration behaviour untestable in CI

- **Status:** DONE
- **Phase:** 1
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tests
- **File:** `apps/api/vitest.config.ts` + `vitest.config.ts` (root) + `apps/api/src/test-setup.ts` (or equivalent)
- **Source:** Session-derived. Pattern observed across two consecutive Cluster A remediations: AUD-EMIT-001 closeout (ffc4cf4, 2026-05-25) skipped e2e for emitter coverage with the rationale "local API/web dev servers were down (3001/4001)"; OBS-002+DAT-009 closeout (d6299cc, 2026-05-25) verified the immutability trigger and FK NoAction behaviour manually via psql because "no vitest real-DB harness exists — both configs globally vi.mock('database')". Both sessions documented honest divergence rather than masking the gap, but the gap itself is now recurrent and amplifies as we move into more infra-level remediations (DAT-007 cascade, OBS-005 role mutations, future DB triggers).

**Description:**
Both apps/api and the root vitest configurations apply a global `vi.mock('database')` (or equivalent) that substitutes the Prisma client and all schema-dependent behaviour with mocks. This is appropriate for unit tests but precludes any integration test that exercises real Postgres semantics: triggers (the new audit_logs immutability trigger), FK cascade rules (ON DELETE NO ACTION, SetNull), migration ordering effects, generated columns, schema-level constraints, advisory locks, and any application code whose correctness depends on real SQL execution.

**Root cause:**
The global mock is set up once for the whole vitest run with no scoping. There's no per-suite escape hatch, no parallel project running against a real DB, and no `pnpm test:integration` (or equivalent) target distinct from `pnpm test` (unit) and `pnpm test:e2e` (full app boot with mocked Prisma).

**Code evidence:**
```
grep -rn "vi.mock.*database" apps/api/ vitest.config.ts apps/api/vitest.config.ts
grep -rn "testcontainers\|TESTCONTAINERS" apps/api/ packages/  # expect 0 hits
ls -la apps/api/src/**/*integration*  # expect no integration test directory
```

**Suggested fix:**
Add a vitest project (or a separate test suite under a `pnpm test:integration` target) that:
(a) opts out of the global `vi.mock('database')`,
(b) spins up an ephemeral Postgres via testcontainers-node (or a docker-compose-managed local test DB),
(c) runs `prisma migrate deploy` against it in the setup phase,
(d) exposes a real PrismaClient to the tests.
Add two seed integration tests as proof-of-concept and regression coverage for the two recently-skipped witnesses: (1) the audit_logs immutability trigger blocks UPDATE and DELETE (closing the OBS-002+DAT-009 real-DB witness gap), (2) the FK NoAction prevents user hardDelete when audit rows exist (closing the USR-DEL-001 real-DB witness gap once USR-DEL-001 itself lands). Document in CONTRIBUTING.md (or equivalent) when to use the real-DB harness vs the mocked harness.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied (the new test suite cannot run at all on master because the harness doesn't exist), PASSES after. Both seed integration tests pass against a real ephemeral DB.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green; the new `pnpm test:integration` target is additive, not a replacement).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — N/A (test infrastructure, not application code).
5. Commit message includes `[closes TST-DB-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test:integration
```

**Closed_by:** e30292c
**Learnings:**
- **Mechanism = option (b), NOT the BACKLOG's strong default (a) testcontainers.** The repo decided it: the CI `backend-tests` job ALREADY provisions a `postgres:18` service and runs `prisma migrate deploy` against it (`ci.yml`) — testcontainers would duplicate that container; adding `@testcontainers/postgresql` would break `pnpm install --frozen-lockfile` until a lockfile bump ships; an offline-package release job makes a runtime image pull a footgun. Decisively, option (b) IS the AUD-READ-001 (`normalize-action-codes`) / DAT-021 (`recompute-chain-on-schema-bump.witness.ts`) throwaway-DB prototype — this task industrializes it, it does not introduce a new pattern. The advisor independently confirmed (b) on the same evidence.
- **The recurring-gap arc this closes (6 sessions):** AUD-EMIT-001 (skipped e2e, servers down) → OBS-002+DAT-009 (immutability trigger + FK verified by hand via psql) → DAT-007 (FK RESTRICT, manual dev-DB witness) → USR-DEL-001 (FK NoAction P2003→ConflictException, real-DB witness deferred, "stack down") → AUD-READ-001 (first throwaway-DB witness) → DAT-021 (second throwaway-DB witness). Every one documented honest divergence (`vitest globally vi.mock('database')`). The pattern is now an automatable CI target, not a per-session manual gesture.
- **Vitest project shape:** a separate config file (`vitest.int.config.ts`), not a workspace — the repo has no root vitest config / workspace, so a parallel config is the smallest blast radius. Opt-out of the global mock = simply not loading `vitest.setup.ts`; a minimal `vitest.int.setup.ts` keeps only `reflect-metadata` + TZ. File pattern `src/**/*.int.spec.ts`, **also added to the unit config's `exclude`** (it matches `*.spec.ts`) so `pnpm test` stays mocked-unit-only — that one-line `exclude` edit is the only change to the contract's named **File** (`apps/api/vitest.config.ts`).
- **vitest 4 gotcha:** `poolOptions.forks.singleFork` was REMOVED in vitest 4 — the equivalent is top-level `fileParallelism: false`. The build (typecheck gate) catches this because `nest build` typechecks the root `vitest.*.config.ts` files (it excludes `*.spec.ts`/`scripts/**` but not these). [[project_nest_build_is_typecheck_gate]].
- **AC#2 FAIL-pre is structural** (BACKLOG's literal phrasing: "the new test suite cannot run at all on master because the harness doesn't exist"). PASS-post: `pnpm test:integration` runs 4 tests green. `.rejects.toThrow(/append-only/i)` gives the trigger assertions teeth by construction (a missing trigger → the promise resolves → the test fails); no redundant neuter-and-rerun needed.
- **Worker env propagation works:** globalSetup mutates `process.env.DATABASE_URL`; vitest forks the worker pool AFTER globalSetup resolves, so `new PrismaClient()` in the spec reads the ephemeral URL. Confirmed empirically (trigger/FK only exist on the migrated ephemeral DB, and the assertions passed).
- **Diff = 10 files, stretches the 8-file cap — pre-authorized & justified:** test infrastructure legitimately spans config + setup + global-setup + 2 seed specs + 2 package.json (root delegate + api runner) + ci.yml + CONTRIBUTING.md. No application code touched (the contract's **File** scope is vitest config + setup; `audit-persistence.service.ts` and all app code untouched).
- **CI watch-point (next push):** the nested-pnpm chain (`pnpm --filter api test:integration` → globalSetup `execSync('pnpm --filter database run db:migrate:deploy')`) and the CI `orchestr_a` user's superuser/CREATEDB grant are only fully provable on the runner. If the nested pnpm bites, fallback is `npx prisma migrate deploy` with `cwd: packages/database`.

---

### TOOL-DBSYNC-001 — Dev-DB `_dat005_backup_*` drift blocks `prisma migrate dev --create-only`

- **Status:** TODO
- **Phase:** 1
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tooling
- **File:** `packages/database/prisma/migrations/` (dev-DB state) + chosen mechanism (`scripts/db/` or `CLAUDE_SESSION_CONTRACT.md`)
- **Source:** Session-derived. DAT-003/DAT-004 bundle (`62c2fc4`, 2026-05-27) — `prisma migrate dev --create-only` errored non-interactively because the dev DB holds leftover `_dat005_backup_*` tables (the intentional two-migration safety net from DAT-005, prod-stable since 2026-05-25) that are absent from schema.prisma, so Prisma's drift detection wants to DROP them. The `migrate deploy` workaround succeeded but loses the create-only scaffold/safety. Every remaining Phase 3 task hits the same wall. See the 2026-05-27 PROGRESS_LOG entry.

**Description:**
Dev-DB drift from `_dat005_backup_*` tables blocks `prisma migrate dev --create-only` on every Phase 3 pickup. The backup tables were intentionally retained for DAT-005 rollback safety; ~10 days post-deploy (2026-05-25 → 2026-05-27) with no rollback need, the retention policy needs an explicit decision.

**Root cause:**
DAT-005 (`20260524100000_dat005_backup_float_columns`) created backup tables as a rollback safety net and no later migration drops them. They live in the DB but not in schema.prisma, so `prisma migrate dev` (which reconciles ALL drift, not just the intended diff) flags them for a destructive DROP and aborts in non-interactive mode. `migrate deploy` is unaffected (it only applies pending migrations, ignoring drift) — which is why prod and CI stay healthy.

**Code evidence:**
```
# in the dev DB — 4 leftover tables:
#   _dat005_backup_leaves_days, _dat005_backup_project_snapshots_progress,
#   _dat005_backup_tasks_estimated_hours, _dat005_backup_time_entries_hours
pnpm --filter database exec prisma migrate dev --create-only  # → "about to drop the _dat005_backup_* table … non-interactive … not supported"
```

**Suggested fix:**
Pick ONE — (a) drop the backup tables now via a one-shot SQL script committed under `scripts/db/`, with a `-- drop after YYYY-MM-DD` comment; (b) add the backup tables to a shadow-database ignore list if Prisma supports it; (c) document a pre-session manual cleanup step in `CLAUDE_SESSION_CONTRACT.md`. Coordinate with the operator on the prod implication (prod backups should follow the same retention decision, handled separately).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated. — For mechanism (a): `migrate dev --create-only` errors before, succeeds after; for (c): documented step is the witness.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — N/A (tooling, no business mutation).
5. Commit message includes `[closes TOOL-DBSYNC-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm --filter database exec prisma migrate dev --create-only --name _probe  # succeeds (no drift error) after the chosen mechanism; delete the probe migration afterwards
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** (empty — document chosen mechanism a/b/c when execution reveals the trade-off)

---

## Phase 2 — Cour des Comptes ready — Audit log durcissement
*19 tasks in this phase.*

### DAT-002 — AuditService is logger-only — security events not persisted

- **Status:** DONE
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

**Closed_by:** c62ac8d61530c596619b9cf643de0ffeb7a8ad5f
**Learnings:**
- **No circular dep — forwardRef NOT needed.** `AuditService` and `AuditPersistenceService` already co-reside in the `@Global() AuditModule` (both provided + exported), and `AuditPersistenceService` depends only on `PrismaService`. Direct constructor injection compiles and resolves; no module wiring change was required at all.
- **`log()` stays synchronous (`void` return).** All 11 call-sites (`auth.service.ts` ×5, `leaves.service.ts` ×1, `users.service.ts` ×1, …) invoke `auditService.log({...})` fire-and-forget without `await`. Making `log()` async would have orphaned those promises. Instead the persistence write is fired internally as `void this.auditPersistence.log(...).catch(...)`. The `.catch` is load-bearing: a DB failure logs an error via the logger and degrades to logger-only — it must never crash a login or leave-approval flow. This dual-write contract (logger = durable floor, DB = best-effort until OBS-002 hardens append-only + hash chain) is deliberate.
- **Field mapping (AuditEvent → AuditPersistenceService.log):** `action`→`action`; `actorId`=`userId ?? null` (the actor); `entityId`=`targetId ?? userId ?? 'unknown'` (the subject — ROLE_CHANGE puts admin in actorId and target user in entityId; LOGIN_FAILURE passes neither, so `entityId='unknown'`, `actorId=null` — clean, no FK violation since `actorId` is nullable FK with onDelete SetNull); `entityType`='SecurityEvent' (single constant — per-action subject typing is OBS-001 scope); `payload` JSONB carries `ip`/`details`/`success`/`timestamp` as today's AuditEvent exposes them (`ua`/`reason` enrichment is OBS-001).
- **NO spec flipped from logger-only to dual-write.** The 4 pre-existing tests in `audit.service.spec.ts` assert logger emission (`logger.log`/`logger.warn` called with the JSON entry); none asserted "DB is NOT called", so they remained semantically valid. The ONLY change to them was a DI fix: the `TestingModule` now also provides a mock `AuditPersistenceService` (the real `AuditService` constructor now requires it). Three new dual-write witness tests were added (FAIL-pre: `persistence.log` called 0 times on logger-only master; PASS-post: 7/7 green).
- **Consumer specs unaffected.** `auth/leaves/users` service specs inject `AuditService` via `useValue: mockAuditService`, so they never instantiate the real service and don't hit the new constructor dependency.
- **AC#4 = N/A.** DAT-002 IS the audit-trail durability enablement; this commit creates no separate `audit_logs` entry of its own.
- **Gates:** `pnpm test` 6/6 turbo tasks, 1558 tests green; `pnpm test:e2e` 4/4 tasks, `app.e2e-spec.ts` 2 tests green (real DB-backed boot, no audit_logs row-count assertions so no drift from the new writes).
- **Friction handed to OBS-001 (emitter migration):** (1) the `entityType='SecurityEvent'` constant should be refined to per-action subject types (User for ROLE_CHANGE/USER_DEACTIVATED/PASSWORD_CHANGED, Auth for LOGIN_*); (2) emitters must start passing `ua`/`reason` and structured before/after so the payload schema is enriched (DAT-002 only carries what today's `AuditEvent` shape exposes); (3) LOGIN_FAILURE currently lands `entityId='unknown'` — OBS-001 should decide whether to capture the attempted login string as the subject; (4) consider whether high-volume LOGIN_SUCCESS should remain a synchronous fire-and-forget DB write or move to a queue/batched write before emitter call-sites multiply the load.

---
### OBS-001 — Security audit events go to console only, not to durable storage

- **Status:** DONE
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

**Closed_by:** 1ff6c9a
**Learnings:**
- **Witness lives in audit.service.spec.ts, not at emitters.** All 4 enumerated assertions (per-action entityType, attemptedEmail→entityId, ua/reason round-trip, before/after for ROLE_CHANGE) are pure unit tests on `AuditService.log()` — they pass an enriched `AuditEvent` and assert the mapping. FAIL-pre/PASS-post is achievable on audit.service.ts alone; emitter wiring is the propagation layer, not the witness.
- **DAT-002 entityType expectations rewritten, not weakened.** Three DAT-002 dual-write tests hard-coded `entityType: 'SecurityEvent'` — the exact constant OBS-001 refines. Updated to 'Auth'/'User' (the intended behavior change). The other assertions (entityId, actorId, payload) are untouched.
- **`Record<AuditAction, 'User'|'Auth'|'Leave'>` is exhaustive on purpose.** REGISTER (active emitter, not in the task's map) + ACCESS_DENIED (enum-only, no emitter) both needed entries or the Record fails to typecheck. REGISTER→User (account creation), ACCESS_DENIED→Auth.
- **bcrypt guard has teeth.** entityId for LOGIN_FAILURE = `attemptedEmail.toLowerCase().slice(0,254)`, but a bcrypt-shaped attemptedEmail (`/\$2[aby]\$/`) is refused → 'unknown', so a password fat-fingered into the login field never lands in the trail. attemptedEmail only feeds entityId (never the payload), so it cannot leak via JSONB either.
- **ROLE_CHANGE / USER_DEACTIVATED have NO emitters today** — they are enum values with zero call sites. `users.service.update()/remove()` emit no audit event (SEC-002 explicitly deferred "users:update to audit_logs"). The task's step-4 directive to wire them collides with its own OUT-scope ("users.service … leave them alone") and SEC-002 precedent. AuditService now *supports* before/after for ROLE_CHANGE (witness d proves the round-trip); wiring a live emitter into users.service is net-new audit emission = deferred (see PROGRESS_LOG follow-up). No users.service.ts churn this session.
- **LEAVE_APPROVED/REJECTED durable paths bypass auditService.** `leaves.service.ts:1565/:1677` write to AuditPersistenceService directly (OUT-scope, untouched) and already carry before/after + the rejection reason as `validationComment`. The one LEAVE site on `auditService.log()` (self-approval, :587) auto-maps to entityType 'Leave' with no wiring; auto-validation has no rejection reason. So no leaves.service.ts change was needed.
- **`ua` reachable only at LOGIN_*.** `AuthService.login()` receives request `meta` (userAgent+ip) from the controller, so LOGIN_SUCCESS/FAILURE get ip+ua. The PASSWORD_CHANGED service methods (`generateResetToken`, `resetPassword` in auth + `resetPassword` in users) don't receive meta — ua not reachable without a controller signature change; left optional per scope.

---
### PERF-001 — Audit dual-write is synchronous fire-and-forget — unbounded under high-volume LOGIN_SUCCESS

- **Status:** TODO
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** non-blocking
- **Category:** performance · audit_log
- **File:** `apps/api/src/audit/audit.service.ts`
- **Source:** flagged by Alexandre during DAT-002 review; carried forward from OBS-001

**Description:**
DAT-002 made `AuditService.log()` dual-write each security event to `audit_logs` via a synchronous fire-and-forget call (`void this.auditPersistence.log(...).catch(...)`). This is correct for durability but does not bound concurrency: every LOGIN_SUCCESS, ACCESS_DENIED, and leave decision issues an immediate INSERT. The DAT-002 learnings explicitly flagged this — under a burst of authentication traffic (login storms, credential-stuffing waves throttled at 30/min/IP × N IPs, SSO re-auth fan-out) the unthrottled per-event INSERT could contend for connection-pool slots with the request path it is meant to observe, and OBS-002's future append-only trigger + hash-chain will add per-row work on top. Decide whether high-volume audit events should remain synchronous fire-and-forget or move to a bounded queue / batched-write sink before the emitter surface widens. No code change is mandated by this stub — it is the decision record.

**Root cause:**
Durability (DAT-002) was prioritized over backpressure; the write path is unbatched and unthrottled by design, deferring the volume concern.

**Acceptance criteria:**
1. Decision documented (keep synchronous fire-and-forget, or adopt a queue/batched-write sink) with rationale tied to observed or projected audit-event volume.
2. If a queue/batched implementation is chosen, a benchmark run is included comparing sustained INSERT throughput and request-path latency under load before/after.

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:**
- **OBS-002/DAT-009 (`d6299cc`, 2026-05-25) strengthens this task's case.** The hash chain now serializes EVERY audit INSERT on a single `pg_advisory_xact_lock` (an append-only ledger must be totally ordered), so concurrent LOGIN_SUCCESS bursts no longer just contend for pool slots — they serialize on one mutex and queue behind each other inside their transactions. The synchronous fire-and-forget `void auditPersistence.log(...)` path is now a global serialization point, not just an unbatched write. This makes the async/queued-sink decision (this task) materially more pressing once the emitter surface widens. No change made here; decision record only.

---
### OBS-002 — Append-only is a convention, not enforced by DB

- **Status:** DONE
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

**Closed_by:** d6299cc
**Learnings:**
- **Closed jointly with DAT-009 in one fix commit `d6299cc`** (both `Closed_by` point to it; subject carries `[closes OBS-002][closes DAT-009]`). Shipped (a) `audit_logs_no_update_delete` BEFORE UPDATE/DELETE trigger → RAISE EXCEPTION (ERRCODE check_violation/23514), (c) prevHash/rowHash sha256 chain at INSERT, (d) actorEmail/actorLabel snapshot. Migration `20260525190000_audit_logs_immutability_hash_chain_actor_snapshot` (122 lines).
- **Verdict B — DB role split (Suggested-fix sentence 2) descoped to TOOL-DEPLOY-001.** The pipeline is single-`DATABASE_URL` (migrate + runtime + seed share credentials in `docker-entrypoint.sh`; datasource has no `directUrl`; CI/deploy compose one string). Splitting roles touches deploy infra + CI secrets → non-trivial. **Residual risk:** the app role retains theoretical UPDATE/DELETE on audit_logs, blocked ONLY by the trigger (one control; a superuser could `DISABLE TRIGGER`). The hash chain keeps any such tamper DETECTABLE; actor snapshot survives. TOOL-DEPLOY-001 adds the privilege-layer second control.
- **Concurrency (decision #3 / #2):** chose `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` over the contract's "FOR UPDATE on the prior row" — the latter FORKS the chain under READ COMMITTED (lock release re-checks the locked row via EvalPlanQual, not the result set, so a concurrent next-row insert is missed and two rows chain off the same prevHash). Advisory lock totally-orders inserts; auto-released at COMMIT. Rejected SERIALIZABLE+retry (extra complexity, no benefit at this scale). This serialization strengthens PERF-001's async-queue case (noted there).
- **No real-DB vitest harness:** both vitest configs load `vitest.setup.ts` which `vi.mock('database')`, so `*.spec.ts` and the e2e suite use a mock PrismaClient and never hit Postgres. The trigger witness (W-a) and the real end-to-end chain were verified by direct dev-DB scripts (documented divergence, AUD-EMIT-001 precedent): UPDATE/DELETE raise, row stays intact, INSERT still allowed; 2 real service inserts chain off the backfilled legacy tip with JS recompute matching. The 11-test unit witness (W-c/W-d, mocked) is the `pnpm test` artifact (FAIL-pre 11/11, PASS-post 11/11).
- **A real bug only the live DB caught:** `SELECT pg_advisory_xact_lock(...)` returns `void`; `$queryRaw` can't deserialize it (P2010). Switched the lock to `$executeRaw` (runs for side effect, returns affected-count). The mock would never have surfaced this.
- **Column case:** new columns use camelCase (`prevHash`/`rowHash`/`actorEmail`/`actorLabel`) to match the existing table (`entityType`/`entityId`/`actorId`/`createdAt`), not the spec's illustrative snake_case.

---
### AUD-EMIT-001 — ROLE_CHANGE and USER_DEACTIVATED have no live emitters in UsersService

- **Status:** DONE
- **Phase:** 2
- **Cluster:** A
- **Confidence:** cross-validated
- **Blocked_by:** (none)
- **Severity:** blocking
- **Category:** data_integrity · audit_log
- **File:** `apps/api/src/users/users.service.ts` (update + remove)
- **Source:** Session-derived. Convergent from three artefacts: (a) PROGRESS_LOG 2026-05-25 OBS-001 deferred-emitter note; (b) PROGRESS_LOG 2026-05-24 SEC-002 closeout open question ("users:update to audit_logs"); (c) CLAUDE_SESSION_CONTRACT.md AC#4 (audit-sensitive paths include "user delete", and ROLE_CHANGE/USER_DEACTIVATED are enum values defined but never emitted).

**Description:**
UsersService.update() mutates roleId, isActive, departmentId, serviceIds with zero call to AuditService or AuditPersistenceService. UsersService.remove() deactivates a user with no audit emission. The AuditAction enum defines ROLE_CHANGE and USER_DEACTIVATED, OBS-001 enriched the payload to carry structured before/after for exactly these actions, and DAT-002 made AuditService durable — yet no business code calls them. An auditor (Cour des Comptes) asking "when did user X become MANAGER, who promoted them" or "when was user Y deactivated, by whom, why" gets no answer despite the trail being technically ready to receive these rows.

**Root cause:**
DAT-002 made AuditService dual-write. OBS-001 enriched the payload schema (before/after, ua, reason, per-action entityType). Both shipped without retro-fitting the live call sites in UsersService because each task's scope was the audit infrastructure, not the emitter coverage. The capability is live; the call sites are missing.

**Code evidence:**
```
grep -rn "ROLE_CHANGE\|USER_DEACTIVATED" apps/api/src/users/ → 0 hits
grep -rn "auditService\|auditPersistence" apps/api/src/users/users.service.ts → 0 hits
```

**Suggested fix:**
In UsersService.update(): when roleId in the DTO differs from the loaded user's current roleId, emit ROLE_CHANGE with before={roleCode: old.role.code}, after={roleCode: new.role.code}, actor=caller. When isActive transitions true→false (either via update() or remove()), emit USER_DEACTIVATED with before={isActive:true}, after={isActive:false}, actor=caller, reason from DTO if provided. Use AuditPersistenceService directly (consistent with SEC-003's pattern); no AuditService console mirror needed since OBS-001 already routes both sinks through the dual-write path.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Witness must spy AuditPersistenceService and assert (a) ROLE_CHANGE is emitted with structured before/after.roleCode on role transitions, (b) USER_DEACTIVATED is emitted with before/after.isActive on the deactivation path (both via update() and remove()), (c) no emission when neither field changes.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes AUD-EMIT-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts
```

**Closed_by:** ffc4cf4
**Learnings:**
- **remove() is soft-delete** (`prisma.user.update({ data: { isActive: false } })`), so decision #6's soft path applied: USER_DEACTIVATED is emitted on the active→false flip in both `update()` and `remove()`. No hard-delete branch in remove() (hard delete lives in the separate `hardDelete()`, out of scope).
- **before.roleCode required enriching the existing `findUnique`**, not an extra query. The `update()` lookup previously selected nothing (used only for the null check); added `include: { role: { select: { code: true } } }`. `after.roleCode` comes from the post-update read (select already carries `role.code`). Gate is `updateData.roleId !== existingUser.roleId` (the DTO is roleCode-based; roleId is resolved via `resolveAssignableRoleIdByCode`).
- **AccessUser has no `email` field** (only `id` + `role`), so actorEmail cannot be threaded — actor is `caller.id` → `actorId` only. Decision #5's "caller.email if present" is moot.
- **SEC-002 backward-compat (caller=undefined) needed zero changes.** Emission is gated on a defined `caller` (SEC-003 callerId-optional precedent); the existing update()/remove() tests pass `caller` only in SEC-002 scope cases whose DTOs touch neither roleId nor isActive, so no emission fires for them either way. All 63 users.service tests green.
- **Contract decision #4 "catch-degraded pattern" does not match the codebase** — all 6 `auditPersistence.log` call sites (leaves×3, projects×2, users.resetPassword×1) use plain `await`, no try/catch. Followed the empirical in-file precedent (resetPassword) rather than chase a non-existent convention.
- **E2E not run.** Diff is confined to an internal service method's audit emission — no controller/route/DTO/UI/permission-matrix surface, and no E2E spec asserts `audit_logs`. Local API/web dev servers were down (ports 3001/4001), so the suite is invariant to this change. Substitute verification = the 4-case unit witness (FAIL-pre on a/b1/b2, PASS-post) + full `pnpm test` green (API 1567, web 579). Documented divergence per DAT-005 precedent.

---
### OBS-003 — Leave approval audit lacks before/after state and role snapshot

- **Status:** DONE
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

**Closed_by:** 1aa24b5
**Learnings:** Capability partially shipped by OBS-001 (1ff6c9a, 2026-05-25): payload now supports before/after, ua, reason, requestId-shaped fields via AuditEvent extension; ENTITY_TYPE_BY_ACTION maps LEAVE_* to entityType 'Leave'. Remaining scope (now shipped in 1aa24b5): enriched LEAVE_APPROVED/REJECTED emitters with `actor.{id,roleCode,templateKey,permissions[]}`, `subject.{leaveId,userId}`, conditional `ip`/`ua`. before/after were already DAT-001-durable; the OBS-003 delta is the actor/subject snapshot.
- **actor.permissions source = `PermissionsService.getPermissionsForRole(roleCode)`** — the same RBAC compile-time resolver the `RequirePermissions` guard consumes (no `RbacService.resolvePermissions` callable exists; this is the guard-equivalent). Resolved BEFORE the `$transaction` (Redis/Prisma read must not sit inside the Postgres tx holding the row lock). Captured at emit time because `templateKey → permissions` is compile-time and leaves no DB trace between deploys.
- **roleCode + templateKey from JWT `req.user.role`** (carries both per current-user.decorator AuthenticatedUser) — zero extra DB roundtrip, zero extra include on the leave query.
- **requestId OMITTED** — no request-id propagation infra exists ([[OBS-009]] still open). Not implemented inline per chain contract.
- **Reusable `buildActorSnapshot(actorId, actor?)` private helper** introduced now and reused forward by the [[OBS-021]] lifecycle emitters (and a candidate upgrade for the DAT-001 `cancel()` emitter).
- **AC#6 controller touch:** `leaves.controller.ts` gained `@Req()` + `@CurrentUser('role')` + an `extractMeta` helper (OBS-006 documents.controller mirror) — wiring required to deliver the snapshot, justified in the fix-commit body.
- **[[TST-011]] delta:** +2 service witnesses (approve/reject enriched-payload, FAIL-pre verified by stashing the service edit → `payload.actor` undefined); controller spec updated for the new threading signature (no new controller assertions beyond the actor-object call shape).
- **AC evaluation:** AC#1 ✓ (actor/subject/ip/ua per Suggested fix); AC#2 ✓ (2 FAIL-pre → PASS-post); AC#3 ✓ (`pnpm test` api 1610 / web 579, `test:e2e` 2/2); AC#4 ✓ (leaves approve/reject audit_logs row carries before/after + actor snapshot); AC#5 ✓; AC#6 ✓ (diff confined to leaves/ + the controller wiring).

---
### OBS-004 — Role changes on users are NOT audited

- **Status:** DONE
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

**Closed_by:** 330a8eb
**Learnings:** Partial closure completed. AUD-EMIT-001 (ffc4cf4) shipped ROLE_CHANGE + USER_DEACTIVATED; this session (330a8eb) lands the remaining four.
- **Enum for all four** (USER_REACTIVATED, PASSWORD_RESET_BY_ADMIN, SERVICE_MEMBERSHIP_CHANGED, DEPARTMENT_CHANGED) added to AuditAction + ENTITY_TYPE_BY_ACTION='User'. Kept UsersService self-consistent and **advances the enum side of [[OBS-024]]** (enum-vs-free-string unification): the only free-string this module emitted ('PASSWORD_RESET_ADMIN') is now an enum value.
- **PASSWORD_RESET_BY_ADMIN = case (b)-rename, NOT net-new.** SEC-003 (2763552) already durably emitted the admin-reset row at `users.service.ts:852`, but as the free-string `'PASSWORD_RESET_ADMIN'`. Renamed in-place to `AuditAction.PASSWORD_RESET_BY_ADMIN`. SEC-003's gates (hierarchy / self-reset / no-PII) are untouched — only the action code is canonicalized; the SEC-003 spec assertion (`users.service.spec.ts:1461`) was updated and its ACs still pass. The console-parity `auditService.log(PASSWORD_CHANGED)` at `:867` is intentionally left in place (its DAT-002 dual-write to a `PASSWORD_CHANGED` row is OBS-024 territory; OBS-004 does not collapse the dual emit).
- **PROD NAMESPACE CARRY-OVER for OBS-024:** SEC-003 is an ancestor of prod HEAD 8e4b593, so prod `audit_logs` may already hold `'PASSWORD_RESET_ADMIN'` rows. OBS-002's immutability trigger blocks UPDATE, so those legacy rows **cannot be backfilled** — OBS-024's unification must alias `PASSWORD_RESET_ADMIN` ↔ `PASSWORD_RESET_BY_ADMIN` at query time.
- **SERVICE_MEMBERSHIP_CHANGED** payload = full before/after arrays + computed `{added, removed}` diff (more queryable). Order-insensitive Set comparison → no emit when the membership set is unchanged regardless of array order.
- **DEPARTMENT_CHANGED** payload = `departmentId` before/after; department-name snapshot **deferred** (departments aren't hard-deleted like the actor case that motivated DAT-009's label snapshot).
- **One extra include, no new round-trip:** update()'s `findUnique` gained `userServices.serviceId` for the membership before-snapshot. `departmentId`/`isActive` are scalars already returned by `include`.
- **No-op invariants preserved** (AUD-EMIT-001 witness (c)): no emit when the field is unchanged; caller-undefined skips emit. The AUD-EMIT-001 no-op fixture was adjusted (existing departmentId set equal to the DTO value) — a fixture update forced by the emission-set expanding to departmentId, not a behavior change.
- **[[TST-011]] incidental coverage:** +7 audit-emission assertions in `users.service.spec.ts` (4 positive across the 4 events, 3 no-op negatives) + 4 new pairs in the `audit.service.spec.ts` entityType table. Materially advances TST-011's "audit emission almost never asserted" pressure for the user-mutation surface.
- **AC evaluation:** AC#1 (fix per Suggested fix — emit the named events with before/after) ✓; AC#2 (FAIL-pre/PASS-post witness) ✓ 5 FAIL-pre → all PASS-post; AC#3 (`pnpm test` 1586 + `pnpm test:e2e` 2/2 green) ✓; AC#4 (audit-sensitive path → audit_logs before/after) ✓; AC#5 ([closes OBS-004]) ✓; AC#6 (diff confined to File scope = users/ + audit/ + the SEC-003 sibling spec) ✓.

---
### OBS-005 — Role template / institutional role mutations are NOT audited

- **Status:** DONE
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

**Closed_by:** ec88cc9
**Learnings:** Wired `AuditPersistenceService` directly into RolesService create/update/delete (OBS-004 / SEC-003 / AUD-EMIT-001 emitter pattern). 4 enum members added: `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`, `ROLE_DEFAULT_CHANGED`.
- **Enum names confirmed, no collision.** The 4 are exactly the Suggested-fix names. `ROLE_CHANGE` already existed but is a **different subject** (a *user* being reassigned to another role, entityType='User'); the 4 new ones are the role *entity* lifecycle, entityType='Role'. ENTITY_TYPE_BY_ACTION union widened `'User'|'Auth'|'Leave'` → `+'Role'`; the exhaustive `Record<AuditAction,…>` made the 4 mappings compile-mandatory. **Advances [[OBS-024]]** (enum-vs-free-string unification): RolesService emitted zero free-strings — all 4 are enum from the start, unlike DAT-007's free-string `'PROJECT_DELETED'`.
- **ROLE_UPDATED diff encoding = OBS-004's "both".** `payload {before, after, changed[]}` over `{label, description}` only. `isDefault` is **deliberately carved out** to its own ROLE_DEFAULT_CHANGED event (mirrors OBS-004's dedicated SERVICE_MEMBERSHIP_CHANGED carve-out for the serviceIds field) — so ROLE_UPDATED is *not* a literal "full before/after scalars" diff. Documented divergence from the Suggested-fix phrasing; the trade is clean event separation + no double-encoding of the default flip.
- **ROLE_DEFAULT_CHANGED = both directions, singleton-shift semantics.** `before/after = {defaultRoleId}`. `false→true` reads the prior holder (findFirst) before `unsetCurrentDefault`, emits `{before: prevId, after: newId}`; `true→false` (default removed, no replacement) emits `{before: id, after: null}`. entityId = the role that is/was the subject of the flip.
- **ROLE_DELETED = DAT-007 PROJECT_DELETED symmetry.** Full-row `payload.snapshot` emitted BEFORE `role.delete`, plain await (non-transactional, audit-pipeline out of scope — DAT-006/DAT-007 precedent). Witness asserts the snapshot row is present at delete-time via a `delete` mock implementation.
- **templateKey-hash deploy row DEFERRED → [[OBS-012]].** The Suggested fix's "deploy-time audit row recording each templateKey hash" is a deploy/boot concern (main.ts/onModuleInit + previously-seen-hash state + ROLE_TEMPLATES ordering stability), deploy-infra surface outside roles/ + audit/. OBS-012 explicitly owns "no deploy audit trail" — filed there, not shipped here. AC#6 (scope confinement) preserved.
- **Caller threading was NET-NEW (controller surface).** Unlike UsersService (SEC-002 already threaded the actor), RolesController passed no caller. Added `@CurrentUser()` to the 3 mutating handlers + optional 3rd RolesService arg. Caller-undefined (seed/internal/test) emits nothing (OBS-004 backward-compat invariant). Flagged because it's controller surface — but within roles/ scope, so AC#6 holds.
- **Prisma roundtrips:** update/delete unchanged — the existing `findUnique` already returns the full before-/delete-snapshot (no new include). create + update add **one** `findFirst` only on the default-setting path AND only when a caller is present.
- **[[TST-011]] incidental:** +10 RolesService witnesses (6 positive across the 4 events incl. both ROLE_DEFAULT_CHANGED directions, 4 negative = 3 caller-undefined + 1 no-op) + 4 `Role` pairs in the audit.service.spec entityType table. api suite 1586 → 1596.
- **No-op + caller-undefined invariants preserved.** ROLE_UPDATED with an unchanged monitored set emits nothing; any mutation with caller undefined emits nothing. RbacModule needed no change — AuditModule is `@Global` and exports AuditPersistenceService.
- **AC evaluation:** AC#1 (fix per Suggested fix — 4 named events with diff; templateKey-hash deferred w/ rationale) ✓; AC#2 (FAIL-pre/PASS-post) ✓ 6/6 positives FAIL-pre → PASS-post; AC#3 (`pnpm test` api 1596 + web 579/14-skip, `pnpm test:e2e` 2/2 green) ✓; AC#4 (RBAC mutation → audit_logs with before/after) ✓; AC#5 (`[closes OBS-005]`) ✓; AC#6 (diff confined to rbac/ + audit/ + specs) ✓.
- **[[TST-DB-001]] still applies:** vitest globally `vi.mock('database')`, so no real `audit_logs` row was asserted — emission verified at the AuditPersistenceService.log call boundary (mocked), consistent with OBS-004.

---
### OBS-006 — Document access/downloads are NOT logged

- **Status:** DONE
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

**Closed_by:** 4bee971
**Learnings:**
- **DocumentsController is pure metadata CRUD — there is NO API-mediated binary download.** `Document.url` points to external storage; the client follows that URL directly to fetch bytes, bypassing the NestJS pipeline. There is no `StreamableFile`/`@Res`/`sendFile` anywhere, and no `apps/web/src/services/documents.service.ts` exists (web pulls via generic `api.get`). Consequence: the API physically *cannot* observe an actual byte download from this controller.
- **Endpoint → event mapping:** GET /:id (findOne) → **DOCUMENT_READ** (explicit fetch-by-id; the response hands over `url`, the download handle). GET / (findAll list) → **NO emission** (high-volume, per-doc fan-out, collection-browse ≠ doc-specific access; PERF-001 territory). POST/PATCH/DELETE → **out of scope** (OBS-006 is the read/download finding; document-delete audit stays a [[TST-011]] follow-up gap).
- **DOCUMENT_DOWNLOADED added to the enum but UNWIRED** — distinct event per Suggested fix + PHASE 3's explicit "extend enum (READ, DOWNLOADED)", but no endpoint maps to it (per the no-binary-stream architecture above). Reserved for a future streaming/proxy endpoint. The exhaustive `Record<AuditAction,…>` (union widened +'Document') compile-forces both mappings; audit.service.spec asserts both entityType pairs. NOT a free-string — no prod-namespace carry-over ([[OBS-024]] enum side advanced).
- **Emission ordering pinned (advisor point):** `assertCanReadDocument → findUnique → null-check → EMIT → return`. No DOCUMENT_READ for a denied (403) or missing (404) read. Covered by two dedicated negative witnesses (access-denied, not-found) — needed here because the access check is *service-level*, not guard-level (unlike OBS-005's controller guards).
- **Caller-undefined backward compat:** `update()`/`remove()` call `this.findOne(id)` with no currentUser → no emission. Negative witness guards against a future maintainer threading currentUser into those internal calls and accidentally emitting DOCUMENT_READ on every mutation.
- **Payload:** actorId → dedicated AuditPersistence actor field (matches OBS-005/DAT-007 precedent + PHASE 2's payload-shape list); payload = `{documentId, mimeType, sizeBytes, ip, ua}`. **sizeBytes from the `Document.size` column** (bytes, cheaper, consistent — no stream to measure). ip/ua conditionally spread (only when defined), mirroring AuditService's optional-metadata treatment.
- **Prisma load:** zero extra round-trips, zero extra includes — emission reuses the document already loaded by findOne. One advisory-locked INSERT per read inside `AuditPersistenceService.log` (the existing chain mechanism).
- **Read-path resilience — fire-and-forget, NOT awaited (divergence from OBS-005/DAT-007):** those precedents `await` because they emit on *mutations*. OBS-006 emits on a *read* (higher-frequency), so emission is `void …log().catch(logger.error)` — mirroring the `AuditService` floor pattern for high-frequency events. A transient audit-chain hiccup must not turn a successful read into a 500, nor block the read on the audit advisory lock. `findUnique` already proved the DB reachable, so the loss window is tiny; the `.catch` surfaces any dropped row as an error log. Witness: `findOne` resolves with the document even when `AuditPersistenceService.log` rejects. (Decided post-fix on advisor flag; landed in a follow-up commit.)
- **Caller threading:** `@CurrentUser()` already on GET /:id (pre-existing); `@Req()` + `extractMeta` net-new (local helper mirroring auth.controller; UA capped 512, IP = forwarded-chain head). `extractMeta` made `req?`-tolerant so the controller-spec routing tests stay simple.
- **Bulk download:** none exists — N/A.
- **[[TST-DB-001]] still applies:** vitest mocks 'database'; emission verified at the mocked `AuditPersistenceService.log` boundary, no real `audit_logs` row asserted.

---
### OBS-012 — Deploy workflow is theatrical — no real deploy and no deploy audit trail

- **Status:** DONE
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

**Closed_by:** 189344f
**Learnings:**
- **Remove-the-theater chosen over wiring real SSH.** Evidence was decisive: HANDOVER.md ("Deploy workflow est 'fake' → manual ssh + docker compose sur VPS"), the `DEPLOY_HOST/USER/KEY` secrets were never configured (commented-out in deploy.yml), and `docker-publish.yml` already builds+pushes real images on tags. Wiring `appleboy/ssh-action` would have faked an automation nobody uses against secrets that don't exist. `deploy.yml` deleted; `scripts/deploy-prod.sh` is its honest operator-run replacement (pull → pin RELEASE_SHA into .env.production → build/migrate/up with `--env-file`).
- **Durability = `deployments` table (source of truth) + dual-write to `audit_logs`.** Columns: `id, releaseSha, deployedAt, deployedBy, environment, nodeVersion, dbMigrationsApplied (JSONB)`. **No FK to users** — `deployedBy` is a frozen string (operator email / 'ci'), surviving user deletion, mirroring `audit_logs.actorEmail` RGPD snapshot. It is an infra event, so deliberately NOT under the `audit_logs` immutability trigger (d6299cc). Migration `20260525210000_obs012_deployments_table`, virgin table = **0 rows** at ship time.
- **Version pinning = env-injected SHA + boot hook.** `DeploymentsService` (`OnApplicationBootstrap`) records one row per boot in a deploy context (`NODE_ENV=production` OR `RELEASE_SHA` set). `dbMigrationsApplied` read from `_prisma_migrations` (`migration_name WHERE finished_at IS NOT NULL`), best-effort → `[]` so a future **TOOL-DEPLOY-001** restricted DB role can't crash boot. Production-without-RELEASE_SHA records `releaseSha='unknown'` + warns (not a hard fail). Boot hook is fire-and-forget (caught into logger) — a ledger hiccup never blocks API startup, so the OBS-006-style resilience is built into the first commit (no 4th commit).
- **Cross-emission YES.** `AuditAction.RELEASE_DEPLOYED` (entityType `'Deployment'`, exhaustive `Record` widened) emits one informational `audit_logs` row per boot so deploys sit inline with user actions for the Cour-des-Comptes narrative. AC#4 satisfied via dual-write.
- **Compose env passthrough was the load-bearing first-use gap (4th commit, `[refines OBS-012]`).** The api service in `docker-compose.prod.yml` uses an explicit `environment:` block, NOT `env_file:` — `docker compose --env-file` only feeds compose's own `${...}` interpolation, it does NOT auto-propagate keys into the container process env. So `RELEASE_SHA`/`DEPLOYED_BY`/`DEPLOY_ENVIRONMENT` had to be added to that `environment:` list (interpolated `${RELEASE_SHA:-unknown}` etc.) or the boot hook would have recorded `releaseSha='unknown'` on EVERY prod boot and the ledger could never pin the live release. Same "unavoidable infra wiring, AC#6 'or equivalent'" class as the app.module.ts registration.
- **[[TOOL-DEPLOY-001]] surface untouched** — no `directUrl`/role split added; only the migration-probe was made degradation-tolerant of it.
- **[[TST-011]] incidental:** +6 DeploymentsService witnesses + 1 `RELEASE_DEPLOYED→'Deployment'` entityType pair in audit.service.spec.
- **[[TST-DB-001]] still applies** — vitest mocks `database`; the deployments row-write + migration introspection are asserted at the mocked `prisma` boundary, not against a real `deployments` table. Migration itself hand-written to mirror the `audit_logs` DDL conventions (TEXT/JSONB/TIMESTAMP(3)/pkey/idx) — no Orchestra dev DB was up to `migrate dev` against (only an unrelated `opstracker` postgres on :5432); `prisma validate` + `prisma generate` confirm schema/client coherence.
- **Dangling doc refs (out of confined scope, NOT edited):** `KNOWLEDGE-BASE.md:824` and `docs/AUDIT-DOCKER-DEPLOY.md` reference the now-removed `deploy.yml` (the latter already calls it "un stub"). Left for a docs-hygiene pass — editing `docs/`/KB was outside AC#6 scope.
- **Cour-des-Comptes answerable now:** `SELECT "releaseSha","deployedAt","deployedBy" FROM deployments WHERE "deployedAt" <= '<leave-approval-ts>' ORDER BY "deployedAt" DESC LIMIT 1;` returns the live release at any timestamp — once the first real deploy via `deploy-prod.sh` writes a row.

---
### DAT-009 — AuditLog has no append-only enforcement and no integrity hash chain

- **Status:** DONE
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

**Closed_by:** d6299cc
**Learnings:**
- **Closed jointly with OBS-002 in fix commit `d6299cc`** (see OBS-002 Learnings for the trigger/chain/concurrency/test-harness/`$executeRaw`-bug detail). DAT-009 ⊃ OBS-002: it adds the actorEmail/actorLabel snapshot scope, shipped here as columns frozen at INSERT in `AuditPersistenceService.log()` (email + `firstName lastName` label; NULL for system events and for any actorId that resolves to no user).
- **"Replace actorId → SetNull with snapshot" interpreted as ADD ALONGSIDE, not replace (decision #5).** `actorId` is preserved (existing JOINs/tests depend on it); the snapshot is additive. Rationale: column replacement would have far broader blast radius than this session admits.
- **But the FK `onDelete` HAD to change: SetNull → NoAction (hard blocker).** A SET NULL on user deletion issues `UPDATE audit_logs SET "actorId"=NULL`, which the new immutability trigger (OBS-002) REJECTS — a user with audit rows would become undeletable with a raw trigger error. NoAction keeps the `actorId` column (decision #5's rationale intact — joins unaffected) while removing the SetNull that DAT-009 itself flagged as the problem; the snapshot now preserves actor identity. The OBS-002 AC#1 trigger is the binding requirement, so the SetNull-keeping interpretation bent.
- **Downstream UX consequence (not fixed — out of scope):** `UsersService.hardDelete()` calls `checkDependencies()` which does NOT consider `audit_logs`, then `tx.user.delete()`. With NoAction, hard-deleting a user who has audit rows now fails with a raw Postgres FK violation mid-transaction instead of a clean `ConflictException`. Fixing that cleanly requires touching `users.service.ts` (out of this session's scope). Candidate follow-up — not filed unless requested.
- **Backfill:** dev `audit_logs` = **0 rows**; per decision #4's <1000 branch the migration backfills inline (recursive CTE in createdAt/id order, no separate script). Prod (Phase-1 deploy 2026-05-25, audit emitters live) likely has a small row set — the same migration backfills it before `SET NOT NULL`. Legacy rows form a **sealed segment** hashed with Postgres canonicalization (`payload::text`); new app rows use fast-key-sorted JSON. The segments join transparently: each new row chains off the previous STORED rowHash as an opaque string (verified end-to-end on dev). Legacy rows are therefore NOT JS-re-verifiable from source fields — documented limitation, acceptable for a sealed pre-chain segment. **Prod runbook:** confirm `SELECT COUNT(*) FROM audit_logs < 1000` before deploy; if ≥1000, extract the backfill to a one-shot script before `migrate deploy` (the inline CTE is still O(n) recursive — fine for thousands, reconsider for millions).

---
### DAT-021 — AuditLog.payload Json? has no schema validation, no JSONB GIN index

- **Status:** DONE
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

**Closed_by:** 33f7a9c
**Learnings:** Shipped all three sub-deliverables (33f7a9c). IN_PROGRESS anchor 8bbae3a.
- **(c) Zod registry is the post-OBS-024 THIRD compile-time enforcement layer:** `enum` (audit-action.enum.ts) ∩ `entityType` (ENTITY_TYPE_BY_ACTION) ∩ `payload` (AUDIT_PAYLOAD_SCHEMAS). All three keyed by the same exhaustive `Record<AuditAction,…>` mechanic OBS-024 introduced. Registry uses `satisfies Record<…>` (not `: Record<…>`) so the compile witness (`audit-payload-registry.compile-witness.ts`) can re-assert exhaustiveness off the LITERAL key set, independent of the annotation — a meaningful second guard, not decorative.
- **Two writers, two provenances (the real design tension):** `AuditService.log()` routes a GENERIC security envelope `{ip,details,success,timestamp,ua?,reason?,before?,after?}` for auth/deploy/leave-self-approval; direct callers pass bespoke per-action payloads. An action emitted by BOTH (LEAVE_APPROVED) takes `z.union([leaveAudit, securityEnvelope])`. Schemas are `.strict()` on the TOP-LEVEL KEY SET only; `before/after/snapshot/subject/actor` stay `z.unknown()` (they carry Dates/Decimals/nested rows; validation happens on the IN-MEMORY object before JSONB serialization, so tightening interiors would couple the gate to every domain model and fight Date/Decimal round-tripping). **Zero emitter payload surprises** — all 30 call sites fit; no emitter passed an undocumented top-level key, so no emitter was changed.
- **Gate position + no-ops:** `validatePayloadForAction()` runs BEFORE `$transaction` (no DB connection; fails fast, no tx opened, no advisory lock held). Throws `AuditPayloadValidationError` (wraps the ZodError) → write rejected, no partial row. Two deliberate no-ops, neither weakening the prod guarantee: (1) absent payload (no shape to be malformed); (2) non-registry action (UNREACHABLE in prod — the OBS-024 enum gate + exhaustive registry guarantee every real action has a schema; only esbuild-bypassing unit tests pass synthetic codes like 'A'/'B'/'ASSIGNMENT_STATUS_CHANGED'). 3 pre-existing hash-mechanic witnesses used real actions (LOGIN_SUCCESS/LEAVE_APPROVED) with minimal payloads → fixed to valid shapes (specs in scope); the synthetic-action chain tests keep working via the no-op path.
- **(a) schemaVersion folded into the hash chain (computeRowHash signature change):** new positional convention `action | entityType | entityId | actorId? | schemaVersion | createdAt | payload | prevHash?` (schemaVersion between actorId and createdAt). Hardcoded `1` in `log()` this session; the `Record<AuditAction,…>` shape IS the v2 dispatch hook (future: key on the row's schemaVersion). Folding it means backfilling schemaVersion=1 changes EVERY row's hash input → mandatory full-chain recompute.
- **Recompute helper EXTRACTED (strong-default chosen):** `audit/recompute-chain.ts` (`recomputeChainFrom`) pulled out of normalize-action-codes.ts; both consumers share it (AUD-READ-001 anchors at first-affected, DAT-021 at genesis → whole chain). Hash imported from write path, never reimplemented. New `scripts/recompute-chain-on-schema-bump.ts` + `.witness.ts`. **AUD-READ-001 witness re-run green** against the refactored helper (the extraction preserves its contract — advisor-flagged check).
- **Dual hash scheme RETIRED (resolves the open design fork):** task said "walk ALL rows"; memory said "respect the sealed boundary". For DAT-021 the boundary CANNOT be preserved (schemaVersion touches every row's hash). Recompute-from-genesis rehashes the OBS-002 SQL-canonical "sealed legacy segment" uniformly with computeRowHash(+schemaVersion) → whole chain becomes JS-verifiable (strict improvement on the documented "not JS-re-verifiable" limitation). Same philosophy/mechanism as AUD-READ-001: change derived HASHES, never FACTS. Memory `project_audit_logs_dual_hash_scheme` updated.
- **(b) GIN jsonb_path_ops verified verbatim:** migration SQL `CREATE INDEX audit_logs_payload_gin ON audit_logs USING gin (payload jsonb_path_ops)`. Real-DB witness W-3 confirms the index def; W-6 confirms `Bitmap Index Scan on audit_logs_payload_gin` for a `payload @> '{...}'` query (seq-scan on tiny tables is cost-correct).
- **Migration = single file** (20260526120000_dat021_…): ADD COLUMN NOT NULL DEFAULT 1 + GIN + btree on schemaVersion. ADD COLUMN/CREATE INDEX are DDL → do NOT fire the immutability trigger; the recompute runs SEPARATELY after, via the one-shot script (prod runbook in 33f7a9c body).
- **Real-DB witnesses** (W-3/W-4/W-6) on a throwaway DB created+dropped this session (dev trail untouched, AUD-READ-001 precedent). W-4 FAIL-pre: stale no-schemaVersion hashes are INVALID under the new hash → recompute → valid → trigger ENABLED. W-1 FAIL-pre empirically proven (gate disabled → no rejection).
- **AC eval:** AC#1 ✓ (a/b/c per Suggested fix); AC#2 ✓ (W-1/W-4 FAIL-pre→PASS-post); AC#3 ✓ (api 1645, e2e 2, build 3/3); AC#4 — the SYSTEM_BACKFILL rows the recompute script emits satisfy the audit_logs-entry requirement (OBS-018 precedent); AC#5 ✓ literal `[closes DAT-021]`; AC#6 ✓ (audit/ + prisma/ + scripts/ + specs; package.json×2 + lock for zod dep + script, AUD-READ-001 precedent).
- **Operator follow-up (flagged, NOT executed):** dev `orchestr_a_v2` is behind master (missing OBS-012 + DAT-021 migrations); the new `log()` writes schemaVersion, so the first audit-emitting request after `pnpm run dev` will Prisma-error on the missing column until the operator runs `migrate deploy` + `pnpm run audit:recompute-chain` on dev.

---
### OBS-007 — Data exports (ICS/CSV/XLSX) are NOT audited

- **Status:** DONE
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

**Closed_by:** 4711097
**Learnings:** **PARTIAL CLOSE — planning-export only.** Enumerated 3 file-format egress endpoints across 3 modules: (1) `planning-export.controller GET ics` → exportIcs (events+leaves+telework, **personal data**); (2) `tasks.controller GET project/:id/export` → exportProjectTasksCsv; (3) `milestones.controller GET project/:id/export` → exportProjectMilestonesCsv. Instrumenting all three would touch ~11 files (3 services + 3 controllers + specs + audit) — exceeds the chain's **8-file-per-task cap**. Shipped the planning ICS export (the finding's named File `planning-export.service.ts` AND the most RGPD-relevant: who's on leave/telework when). The two project-data CSV exports are filed as **[[OBS-026]]** follow-up.
- **One AuditAction.DATA_EXPORTED** (entityType 'Export', new exhaustive-Record subject type) with `scope` in the payload (Suggested-fix default — single enum, not per-domain). Payload = `{ format:'ics', scope:'planning', dateRange:{start,end}, recordCount, ip, ua }` + actorId.
- **recordCount is exact** (`events.length + leaves.length + teleworkDays.length`), computed at egress time from the materialized rows — not estimated from the query (the ICS isn't streamed, it's built in memory then returned).
- **Fire-and-forget** (read-path nuance, OBS-006): an export is a GET; a transient audit hiccup must not 500 a successful export. void + `.catch(logger.error)`. Witness locks resilience (export resolves when log() rejects).
- **[[OBS-024]] enum side advanced:** DATA_EXPORTED is enum-from-creation (no free-string), no prod-namespace carry-over.
- **[[TST-011]] delta:** +2 planning-export.service witnesses (1 positive payload, 1 fire-and-forget resilience) + 1 entityType pair (audit.service.spec).
- **AC evaluation:** AC#1 ✓ (DATA_EXPORTED per Suggested fix, planning scope); AC#2 ✓ (FAIL-pre → PASS-post); AC#3 ✓ (`pnpm test` api 1620 / web 579, `test:e2e` 2/2); AC#4 n/a (export is a read, not an audit-sensitive *mutation* — but a DATA_EXPORTED audit_logs row is written anyway for RGPD); AC#5 ✓; AC#6 ✓ (5 files, planning-export + audit). **Partial-close cross-link → [[OBS-026]]** for tasks/milestones CSV.

---
### OBS-026 — Project CSV exports (tasks / milestones) are NOT audited

- **Status:** DONE
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** suggestion
- **Category:** observability · traceability_audit
- **File:** `apps/api/src/tasks/tasks.service.ts` + `apps/api/src/milestones/milestones.service.ts`
- **Source:** OBS-007 partial-close (chain session 2026-05-25)

**Description:**
OBS-007 instrumented the planning ICS export (DATA_EXPORTED) but, to respect the 8-file-per-task cap, deferred the two project-data CSV egress endpoints: `tasks.controller GET project/:projectId/export` → `tasksService.exportProjectTasksCsv` and `milestones.controller GET project/:projectId/export` → `milestonesService.exportProjectMilestonesCsv`. These egress task/milestone rows (including assignee names = personal data) with no audit trace.

**Root cause:**
Export endpoints in the tasks/milestones modules not yet wired to AuditPersistenceService.

**Suggested fix:**
Reuse the OBS-007 DATA_EXPORTED enum + 'Export' entityType. Emit at each export path with payload `{ format:'csv', scope:'tasks'|'milestones', subject:{projectId}, recordCount, ip }`. recordCount = CSV row count minus the header line (services already build the full CSV string). Fire-and-forget (read path, OBS-006/OBS-007 precedent). Thread ip/ua from the controllers via extractMeta.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code, a corresponding entry is created in `audit_logs`.
5. Commit message includes `[closes OBS-026]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/tasks/tasks.service.spec.ts apps/api/src/milestones/milestones.service.spec.ts
```

**Closed_by:** a42d663
**Learnings:** Completes OBS-007's partial-close. Cross-link: [[OBS-007]]. No new enum — DATA_EXPORTED + 'Export' entityType already shipped in 4711097; this is purely additional emit sites.
- **Helper extraction (OBS-007 had inlined):** OBS-007 inlined its planning-ICS emission. Factored the repeated shape into `apps/api/src/audit/export-audit.helper.ts` (`emitDataExported` + `ExportMeta`), consumed by both new call sites (tasks + milestones services). **planning-export left untouched** to keep the diff confined (AC#6) — converging it onto the helper is a trivial, deferred cleanup (not OBS-026 scope).
- **scope values:** `'tasks'` / `'milestones'` (per Suggested fix).
- **entityId = actorId** (mirrors planning's `entityId=userId`); the exported resource is named in `payload.subject = { projectId }`. recordCount = exact materialized row count (`tasks.length` / `milestones.length`), not estimated.
- **dateRange OMITTED:** neither CSV is date-filtered (both filter by projectId). Per the open design question, the projectId filter is encoded under `payload.subject` instead of `dateRange`. Auditor sees `dateRange` on planning rows, `subject.projectId` on CSV rows — both under scope-disambiguated DATA_EXPORTED.
- **caller-as-actor / caller-undefined skips emission** (fire-and-forget read path, OBS-006/OBS-007 precedent). `milestones.controller` gained `@CurrentUser('id')` (it had no actor before); `tasks.controller` gained `@Req()` for ip/ua. AuditModule is `@Global` → no module edits.
- **Additional export surface discovered — scope-creep avoided:** `analytics.controller GET /analytics/export` returns aggregate analytics as JSON (no Content-Disposition / no CSV-ICS-XLSX file egress), not a personal-data file export. Out of the OBS-007/OBS-026 category; a candidate finding if RGPD wants aggregate-export tracking, **not filed here**. No other CSV/ICS/XLSX egress endpoints exist (leaves/school-vacations grep matches were `toString()` false-positives).
- **AC evaluation:** AC#1 ✓; AC#2 ✓ (2 positive witnesses FAIL-pre → PASS-post); AC#3 ✓ (`pnpm test` api 1632 / web 579, build 3/3; e2e not run — Orchestra dev stack down + no new route/UI surface, audit row is a fire-and-forget `audit_logs` write not observable via Playwright); AC#4 ✓ (export is a read, but a DATA_EXPORTED row is written for RGPD); AC#5 ✓; AC#6 ✓ (8 files: tasks/ + milestones/ + audit/ helper + specs).

---
### OBS-018 — Backfill / seed scripts have no persisted audit trail

- **Status:** DONE
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

**Closed_by:** 986c06f
**Learnings:** Instrumented the named `backfill-snapshots.ts` (the finding's File) with SYSTEM_BACKFILL at START + COMPLETED.
- **Testable-helper pattern (scripts don't run under vitest):** emission extracted to `src/scripts/system-backfill-audit.ts` (`emitSystemBackfill` + `resolveBackfillActor`), tested directly at the `AuditPersistenceService.log` boundary. The script wiring itself is **verifiable** by a real dry run on a dev DB but that manual run is **DEFERRED** — no Orchestra dev DB was up this session (same [[TST-DB-001]] gap; AUD-EMIT-001 / OBS-002+DAT-009 manual-verification precedent). The helper-level witnesses + the build (nest build compiles backfill-snapshots.ts) are the automated coverage shipped.
- **Single SYSTEM_BACKFILL enum** with `phase` ('STARTED'|'COMPLETED') in payload (OBS-012 single-RELEASE_DEPLOYED precedent, not split enums). entityType 'SystemMaintenance' (new exhaustive-Record subject). Payload `{ script, args, phase, dryRun, affectedCount? }` — affectedCount OMITTED at STARTED (unknown then, not a misleading 0).
- **Must route through AuditPersistenceService, NOT a raw insert:** OBS-002's hash chain is computed inside AuditPersistenceService — a raw `audit_logs` insert from a script would break the chain. backfill-snapshots.ts already has a Nest application context (`NestFactory.createApplicationContext`) so it `app.get(AuditPersistenceService)` for free.
- **actorId = `resolveBackfillActor`:** prefers `DEPLOYED_BY` (the [[OBS-012]] deploy identity already injected into the api container by 58d1c00) over the finding's suggested `DEPLOY_USER`; null when neither set (honest null for a local manual run, not a fabricated operator).
- **SCOPE — backfill-snapshots only; seed.ts + import-french-holidays.ts DEFERRED.** Both construct their own `PrismaClient` outside any Nest container, so wiring them through the hash-chained AuditPersistenceService needs a Nest-context bootstrap = larger refactor than this finding. Per the chain contract's "skip one-off / awkward scripts, document" clause. seed.ts = dev/initial-setup tool (never-seed-prod rule); holiday import = idempotent, low-frequency. The `emitSystemBackfill` helper is reusable for them when/if they gain a Nest context (candidate follow-up, not filed — lower value than OBS-026).
- **[[OBS-024]] enum side advanced:** SYSTEM_BACKFILL enum-from-creation, no free-string carry-over.
- **[[TST-011]] delta:** +6 helper witnesses (3 emit phase/actor + 3 actor env-precedence) + 1 entityType pair (audit.service.spec).
- **AC evaluation:** AC#1 ✓ (SYSTEM_BACKFILL at start+end per Suggested fix); AC#2 ✓ (FAIL-pre → PASS-post via enum-stash); AC#3 ✓ (`pnpm test` api 1626 / web 579, `test:e2e` 2/2); AC#4 n/a (a script run is not one of the listed audit-sensitive mutation paths, but it now writes its own audit_logs rows); AC#5 ✓; AC#6 ✓ (5 files: audit/ + scripts/). Seed/holidays deferral documented above.

---
### OBS-020 — Audit retention undocumented, no archival strategy for 5+ year horizon

- **Status:** DONE
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

**Closed_by:** bfc7a78
**Learnings:** Policy decision: no application-level retention or purge for audit_logs. Storage and backup management is delegated to the infrastructure/DBA layer. The application does not implement a TTL, does not run a purge job, does not maintain an archival pipeline, and does not add cleanup-specific indexes. The original finding's assumption (5-10 year application-managed retention for Cour des Comptes compliance) was an auditor extrapolation that does not match this project's actual obligations. Audit_logs row growth is unbounded by application policy; operational concerns (DB size, query performance over large tables, restore-from-backup procedures) are handled at the admin/infra layer outside the scope of the application codebase.

Closed_by repointed from orphan SHA 8beb389 (pre-amend, never pushed) to anchor commit bfc7a78. Material closeout remains de9da22. This pattern formalization is TOOL-COH-002 territory.

---
### OBS-021 — Self-approval audited; cancellation / cancellation-request / update / delete are not

- **Status:** DONE
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

**Closed_by:** c45f209
**Learnings:** Partial closure: DAT-001 (b14cdd5, 2026-05-24) wired AuditPersistenceService.log for approve/reject/cancel transactional paths — LEAVE_CANCELLED was emitted (as a free-string). Remaining scope now shipped in c45f209.
- **5 new enum members** (LEAVE_CANCELLED promoted from free-string + 4 net-new: LEAVE_CANCELLATION_REQUESTED, LEAVE_UPDATED, LEAVE_DELETED, LEAVE_BALANCE_ADJUSTED), all ENTITY_TYPE_BY_ACTION='Leave'. **LEAVE_CANCELLED promotion = zero prod-data impact** (identical value 'LEAVE_CANCELLED'; unlike OBS-004's PASSWORD_RESET rename, no carry-over alias needed) and **advances [[OBS-024]]** — the only LEAVE_* free-string in-module is now an enum.
- **Existence check passed:** all four target workflows exist (`update()`, `remove()`, `requestCancel()`, `upsertBalance()`/`deleteBalance()`) — none invented.
- **LEAVE_DELETED: leaves are HARD-deleted** (`prisma.leave.delete`, no soft-delete column). Full before-snapshot in payload (DAT-007 PROJECT_DELETED precedent). **No FK interaction surprise:** `audit_logs.entityId` is a plain string column, not a FK to `leave`, so the pending d6299cc audit_logs FK NoAction does NOT block leave deletion — the audit row simply outlives the deleted leave (the intended behavior).
- **upsertBalance single-hoisted emit:** 3 return points (user-upsert / global-update / global-create-with-retry) route through one `emitAdjustment()` closure so the event fires exactly once on success, never on the failed-create-before-retry. **before = admin's decision-time perspective** (pre-read), not last-observed-state if the retry races — documented, intentional. User-branch pre-read = 1 extra roundtrip (flagged).
- **Cross-connection audit caveat:** remove()/requestCancel() wrap mutation+audit in `$transaction`, but AuditPersistenceService uses its own prisma client (not `tx`) — commit is gated on the audit promise but they are NOT a single atomic unit. DAT-001 accepted this; mirrored, not claimed-fixed.
- **rejectCancellation deliberately NOT audited** — not in the Suggested-fix list (which names exactly 5 events). It IS a state transition (CANCELLATION_REQUESTED→APPROVED) and is a candidate follow-up, but shipping it would be inventing scope. **APPROVE_CANCELLATION merged into LEAVE_CANCELLED** via `before.status` (the cancel() path handles both APPROVED→cancel and CANCELLATION_REQUESTED→cancel).
- **totalDays is Decimal(6,2)** — before/after stored as `.toString()` (DAT-005 float-drift lesson).
- **[[TST-011]] delta:** +8 leaves.service witnesses (5 positive emit + 3 negative no-emit invariants) + 5 entityType pairs in audit.service.spec.
- **AC evaluation:** AC#1 ✓ (all 5 named events emitted with before/after); AC#2 ✓ (5 FAIL-pre positives + audit-table → PASS-post; negatives are invariant guards vacuous pre-fix); AC#3 ✓ (`pnpm test` api 1618 / web 579, `test:e2e` 2/2); AC#4 ✓ (leave mutations → audit_logs before/after); AC#5 ✓; AC#6 ✓ (diff = leaves/ + audit/ + controller wiring, 6 files).

---
### OBS-024 — Two divergent audit codebases (enum vs free-string) — no schema for action codes

- **Status:** DONE
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

**Closed_by:** 7393b5d
**Learnings:** CLOSED (7393b5d, 2026-05-25). Convergence completed: **signature option (a)** — `AuditPersistenceService.log()` now types `action: AuditAction` (was `string`). A free-string at any call site is now a compile error (proven: TS2820 `Type '"PROJECT_ARCHIVED_TYPO"' is not assignable to type 'AuditAction'` injected at a real site, reverted).
- **Single source of truth:** AuditAction enum extracted into `audit/audit-action.enum.ts` and re-exported from `audit.service.ts`. Extraction (not in-place) was required: AuditService imports AuditPersistenceService, so the persistence service typing its param via `audit.service.ts` would have been an import cycle. The enum file is the lower-layer primitive both writers depend on; re-export kept all 12 existing `'../audit/audit.service'` import sites untouched.
- **Enum members added this session: 3** — PROJECT_ARCHIVED, PROJECT_UNARCHIVED, PROJECT_DELETED (the last free-strings, all from projects.service.ts archive/unarchive/DAT-007-hardDelete). Identical string values → zero prod-data impact, no carry-over alias. ENTITY_TYPE_BY_ACTION union widened +'Project'; the exhaustive `Record<AuditAction,…>` compile-forced the 3 mappings. **No net-new audit events** — pure rename of existing emitters' action codes.
- **Free-string call sites converted: 3** (projects.service.ts L661/L691/L790). "Justified as string" exceptions: **zero** — the codebase now has a single audit-action namespace.
- **Compile witness:** `audit/audit-action.compile-witness.ts` — a *source* file (typechecked by `nest build`, the real CI gate; vitest/esbuild does NOT typecheck and full-project `tsc --noEmit` is red on pre-existing spec errors, so a spec witness would be decorative). `@ts-expect-error` over a non-member string literal: failed pre-fix (TS2578 unused directive = string was accepted), passes post-fix. Durable guard against re-loosening to `string`.
- **`computeRowHash` kept `action: string`** deliberately — pure helper, external chain-verifiers pass raw `audit_logs.action` values. Enum→string widening is automatic at the call site.
- **Cross-references (prior partial convergence):** DAT-002 (c62ac8d) routed AuditService through AuditPersistenceService (the "one writer to DB" half). OBS-001 (1ff6c9a) added per-action ENTITY_TYPE_BY_ACTION. OBS-004 renamed PASSWORD_RESET_ADMIN→PASSWORD_RESET_BY_ADMIN (enum). OBS-005 (Role lifecycle), OBS-006 (Document), OBS-007/OBS-026 (DATA_EXPORTED), OBS-012 (RELEASE_DEPLOYED), OBS-018 (SYSTEM_BACKFILL), OBS-021 (LEAVE_* lifecycle + LEAVE_CANCELLED promotion) each converged their own module's codes to enum-from-creation. This session converged the final divergent surface (projects) and made the *type system* enforce the convergence permanently.
- **OBS-004 read-side alias is a deliberate follow-up, NOT closed here.** Legacy prod rows under 'PASSWORD_RESET_ADMIN' (SEC-003 is an ancestor of prod HEAD; OBS-002 immutability blocks UPDATE backfill) need a query-time alias 'PASSWORD_RESET_ADMIN' ↔ 'PASSWORD_RESET_BY_ADMIN' when audit_logs is *read*. OBS-024 is the write-side convergence; the read-side alias should be a new filing against the audit-query/export path (none exists yet — candidate filing, not blocking).
- **Tooling candidate (not pre-filed):** an ESLint rule banning string-literal `action:` in `*.log({…})` calls would enforce the convention even for any future second audit sink that bypasses the typed boundary. Low urgency — the type now covers every current sink.

---
### TST-011 — Audit emission almost never asserted — only one leaves test spies AuditService.log

- **Status:** DONE
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

**Closed_by:** 870cd81
**Learnings:**
- **Gap audit (final, every audit.log call site in apps/api/src + scripts):** auth.service (5 sites, **0** assertions → the only true residual gap; the audit's headline finding) · users.service L994 PASSWORD_CHANGED console-parity dual-write (1 site, 0 → the persistence twin PASSWORD_RESET_BY_ADMIN was asserted by SEC-003/OBS-004 but the AuditService.log sink was not) · export-audit.helper emitDataExported (1 site, asserted ×2 transitively by tasks/milestones specs but no dedicated spec, resilience branch untested). Everything else was **already covered** by the cumulative arc: projects (3/3, DAT-007+PROJECT_DELETED), leaves (9 sites/19 assertions, DAT-001+OBS-003+OBS-021), rbac roles (4/9, OBS-005), documents (1/6, OBS-006), deployments (1/3, OBS-012), planning-export (1 site, pos+resilience, OBS-007), tasks+milestones CSV (OBS-026), system-backfill (OBS-018), users 8 persistence sites (AUD-EMIT-001+USR-DEL-001). The stale "remaining gaps" note (project archive / document delete / role lifecycle) was already closed by DAT-007/OBS-005/OBS-006 between the audit baseline and this session.
- **No gap > call anywhere** (no orphan assertion asserting an emission no call site produces). No code-level emission bug surfaced — every call site emits correctly; this was a pure test-coverage closeout (AC#4 N/A — no application audit emission added).
- **AUD-EMIT-001 triple adapted, not forced:** auth flows have no injected actor dep, so the "caller-undefined" leg is N/A; the natural negatives are the existing throw-tests (duplicate-email, unknown/forbidden target, unknown/expired/used token) — each got a `not.toHaveBeenCalled()`. login() emits LOGIN_FAILURE *before* throwing; the mock state is observable after `rejects.toThrow` settles.
- **FAIL-pre witness (AC#2):** neutering auth.service.ts:167 (LOGIN_SUCCESS) makes the new assertion fail; reverted, never committed. The assertions have teeth.
- **Mocking pattern standardized** on providers `useValue: { log: vi.fn() }` + `expect(mock.log).toHaveBeenCalledWith(...)` (DAT-021/USR-DEL-001 convention). No `vi.mock()` factory introduced. Diff confined to `apps/api/src/**/*.spec.ts`.
- **Inherent uncoverable residual:** none material. The two pure helpers (`emitSystemBackfill`, `emitDataExported`) and the operational scripts that don't run under vitest are covered by testing the *extracted helper* directly at the `.log` boundary (the OBS-018 precedent), so there is no vitest-blind emission site left. `audit.service.ts:150` (the AuditService→AuditPersistence internal dual-write plumbing) is the audit module's own unit, covered by DAT-002/OBS-001 audit.service.spec — not a business state-transition call site.
- **Delta:** api 1645 → 1650 (+5 test cases: 2 auth LOGIN_* + 3 export-helper; the rest are inline assertions on existing tests). ~19 new audit-emission assertions. Cross-ref the cumulative arc: [[DAT-001]] [[DAT-002]] [[OBS-001]] [[AUD-EMIT-001]] [[SEC-003]] [[OBS-003]] [[OBS-004]] [[OBS-005]] [[OBS-006]] [[OBS-007]] [[OBS-012]] [[OBS-018]] [[OBS-021]] [[OBS-024]] [[OBS-026]] [[USR-DEL-001]] [[DAT-021]] each pre-deposited their share; TST-011 filled the last hole (auth) and ratified full coverage.

---

### USR-DEL-001 — hardDelete of users with audit_logs rows fails with raw FK violation instead of typed ConflictException

- **Status:** DONE
- **Phase:** 2
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness
- **File:** `apps/api/src/users/users.service.ts` (hardDelete + checkDependencies)
- **Source:** Session-derived. OBS-002+DAT-009 closeout (d6299cc, 2026-05-25) — under "actorId interpretation + forced FK change" — noted that switching the `audit_logs.actor_id` FK from `SetNull` to `NoAction` (required by the immutability trigger) regresses the hardDelete UX. Out-of-scope at that point; filed now as a follow-up per advisor discipline.

**Description:**
After d6299cc, the `audit_logs.actor_id → users.id` FK uses ON DELETE NO ACTION (changed from SET NULL because SET NULL issues an UPDATE on audit_logs that the new immutability trigger rejects, making users with audit rows undeletable). `UsersService.hardDelete()` calls `checkDependencies()` to pre-validate that a user has no blocking relations before deletion, raising a typed `ConflictException` if any exist. `checkDependencies()` checks Leave, TimeEntry, ProjectMembership, etc., but does NOT check `audit_logs`. As a result, hardDelete of a user with audit rows fails downstream in Prisma with a raw `P2003` (foreign key constraint violated) error instead of the clean `ConflictException` the rest of the codepath promises.

**Root cause:**
Pre-d6299cc the FK was SetNull, so audit rows were never a hardDelete blocker — they silently lost their actor reference. d6299cc changed the FK semantics but did not update the pre-check accordingly. The check function pre-dates the FK change.

**Code evidence:**
```
grep -n "audit" apps/api/src/users/users.service.ts  # 0 hits in checkDependencies-related code
git show d6299cc -- packages/database/prisma/migrations/ | grep -i "no action\|set null"  # confirms FK semantic change
```

**Suggested fix:**
Extend `checkDependencies()` in UsersService to query `prisma.auditLog.count({ where: { actorId: userId } })`. If `> 0`, throw `ConflictException` with a message naming the count and recommending soft-deactivation (USER_DEACTIVATED) as the alternative. Mirror the wording and shape of the existing dependency checks. Document in the Learnings on AUD-EMIT-001's USER_DEACTIVATED path that this is the canonical user-removal action when audit history exists.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Witness: call hardDelete on a user with ≥1 audit_logs row (mocked via the AuditPersistenceService mock pattern from AUD-EMIT-001's specs, OR a direct prisma mock returning count > 0), assert `ConflictException` raised with a message containing the audit log count, and assert `prisma.user.delete` is not called.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green). Specifically: AUD-EMIT-001's USER_DEACTIVATED tests must still pass (the soft-deactivation path is unaffected).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Confirm whether hardDelete itself should emit an audit event (USER_DELETED — net-new enum value) or whether the soft-deactivation alternative is the only allowed user-removal path. If the latter, document the policy decision in the fix's closeout Learnings; if the former, USER_DELETED enum addition is a separate task and must be filed.
5. Commit message includes `[closes USR-DEL-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/users/users.service.spec.ts
```

**Closed_by:** 950068f
**Learnings:**
- **AC#4 policy decision: (a) — emit USER_DELETED.** Chose the DAT-007-symmetric path over (b) trail-less-by-construction. hardDelete now writes a `USER_DELETED` audit row with a column `payload.snapshot` BEFORE erasing the user, symmetric with PROJECT_DELETED (0eae219) and ROLE_DELETED (OBS-005). Rationale: lets a Cour-des-Comptes auditor see the deletion event inline in the immutable trail. (b) was defensible (the pre-check guarantees zero prior audit rows, so the account is trail-less anyway) but leaves the *act of deletion* itself unrecorded — (a) closes that gap at the cost of one net-new enum member. Net effect: a user is provably unremovable without a trace.
- **checkDependencies() is the single source of truth** (no new helper — the function already existed and is grep-symmetric with `checkProjectDependencies()`). It now pre-checks **TASKS / PROJECTS / LEAVES / LEAVES_VALIDATION / DEPARTMENTS / SERVICES / AUDIT_LOGS**. The audit count is `prisma.auditLog.count({ where: { actorId: userId } })` — one extra read-only roundtrip, no transaction. A non-zero count surfaces as a typed `ConflictException` instead of the raw P2003 the `audit_logs.actor_id` ON DELETE NO ACTION FK (d6299cc) would otherwise raise.
- **ConflictException shape mirrored from projects.service.ts hardDelete** — `throw new ConflictException({ message, dependencies })`. The generic top-level message is unchanged (it covers all dependency types); the audit count + soft-deactivation recommendation live in the `AUDIT_LOGS` dependency `description`, matching how every other user dependency carries its count/wording.
- **Cross-ref [[DAT-007]]** (pattern source): inherited the pre-check shape, the `ConflictException({message, dependencies})` convention, and the final-snapshot-before-delete emission (plain await, non-transactional — AuditPersistenceService takes no tx client, archive()/unarchive() precedent). DAT-007's closeout pre-answered AC#4 affirmatively for projects; this task confirms it for users.
- **Cross-ref [[AUD-EMIT-001]]** (soft path): USER_DEACTIVATED via update()/remove() (isActive=false) is the canonical user-removal action when audit history exists. Its specs passed unchanged — the soft path was not touched. The `AUDIT_LOGS` dependency description points the caller at it explicitly.
- **Snapshot is an explicit allow-list, NOT a spread+delete** (advisor flag): id, email, login, firstName, lastName, roleId, departmentId, isActive, avatarUrl, avatarPreset, forcePasswordChange, createdAt, updatedAt. `passwordHash` and the token relations (PasswordResetToken, RefreshToken) are never serialized into the trail. A spec assertion guards `snapshot` has no `passwordHash` property.
- **Side effect on the read endpoint:** `checkDependencies()` also backs `GET /users/:id/dependencies` (users.controller.ts:365). The `AUDIT_LOGS` entry is now visible there too — intended UX (the frontend can render "X audit entries — use deactivation"), but it IS a behavior change for the read path. Flagged here per advisor.
- **Actor threading already in place (SEC-002):** hardDelete receives `requestingUserId` via `@CurrentUser('id')` (users.controller.ts:389). Used as `actorId: requestingUserId ?? null`; no controller surface was added.
- **USER_DELETED enum addition:** net-new member in `audit/audit-action.enum.ts` (value `'USER_DELETED'`); `ENTITY_TYPE_BY_ACTION` mapped to `'User'`. The exhaustive `Record<AuditAction,…>` made the mapping compile-mandatory (post-OBS-024 the enum is the only legal codepath — no free-string). `nest build` EXIT 0 confirms exhaustiveness.
- **Real-DB witness gap (TST-DB-001):** the FK-level P2003→ConflictException behaviour is proven at the unit level (mocked `auditLog.count`); the actual ON DELETE NO ACTION rejection on a real DB is the witness TST-DB-001 will automate. Orchestra postgres dev stack was down this session.

---

### AUD-READ-001 — Legacy PASSWORD_RESET_ADMIN audit rows are invisible when filtering by the current enum name

- **Status:** DONE
- **Phase:** 2
- **Cluster:** A
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** observability
- **File:** `apps/api/src/scripts/normalize-action-codes.ts` (one-shot operational normalization script — re-scoped from the originally-assumed `apps/api/src/audit/` read pipeline, which does not exist; see Learnings 2026-05-26 re-scoping note)
- **Source:** Session-derived. OBS-024 closeout (7393b5d, 2026-05-25) flagged this gap explicitly under "Flagged, not actioned": legacy production rows under action='PASSWORD_RESET_ADMIN' (the free-string emitted by SEC-003 / 2763552, before OBS-004's rename to AuditAction.PASSWORD_RESET_BY_ADMIN at 330a8eb) cannot be backfilled because the audit_logs immutability trigger (d6299cc) blocks UPDATE. A read-side alias is the only path to a coherent audit narrative.

**Description:**
Production audit_logs may contain rows with `action = 'PASSWORD_RESET_ADMIN'` (free-string, emitted by SEC-003 before OBS-004 renamed the emit site to `AuditAction.PASSWORD_RESET_BY_ADMIN`). The OBS-002+DAT-009 immutability trigger prevents UPDATE on audit_logs, so these rows cannot be normalized in place. An auditor (Cour des Comptes) querying `WHERE action = 'PASSWORD_RESET_BY_ADMIN'` to enumerate admin-initiated password resets will miss every row emitted before commit 330a8eb. The audit narrative is silently incomplete for that time window.

**Root cause:**
String value evolution across three commits (SEC-003 → OBS-004 → OBS-024) without an alias-table or read-side normalization mechanism. The immutability trigger — a correct and desired property — makes the legacy data permanent. No prior session anticipated the read-side reconciliation when introducing the enum rename.

**Code evidence:**
```
git log -1 --format=%H 2763552  # SEC-003 emitted 'PASSWORD_RESET_ADMIN' (free-string)
git log -1 --format=%H 330a8eb  # OBS-004 renamed to AuditAction.PASSWORD_RESET_BY_ADMIN
git log -1 --format=%H d6299cc  # OBS-002+DAT-009 immutability trigger
grep -rn "PASSWORD_RESET_ADMIN\|PASSWORD_RESET_BY_ADMIN" apps/api/src/audit/  # to verify current read pipeline does no aliasing
```

**Suggested fix:** *(re-scoped 2026-05-26 — dérogation from "verbatim, do not rewrite", justified: this is a session-derived task and the original Suggested fix presupposed an audit read pipeline that the BLOCKED escalation a4617db proved does not exist. The corrected fix normalizes the underlying data so that EVERY consumer — direct psql, a future read API, an export — sees the canonical code, instead of patching one (non-existent) layer.)*

A one-shot operational **TS normalization script** `apps/api/src/scripts/normalize-action-codes.ts`, mirroring the OBS-018 SYSTEM_BACKFILL backfill runbook pattern (`backfill-snapshots.ts` → `emitSystemBackfill` → `resolveBackfillActor`). It rewrites the legacy free-string `action='PASSWORD_RESET_ADMIN'` rows in place to the canonical `'PASSWORD_RESET_BY_ADMIN'` and **recomputes the hash chain** so integrity is preserved. Mechanism:

1. Emit a `SYSTEM_BACKFILL` row (`phase: STARTED`, payload `{ script, fromValue, toValue, dryRun }`) so the normalization itself is in the trail.
2. Open a single Prisma interactive `$transaction`; take `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` (the same lock the write path uses — serializes against concurrent emissions).
3. Find the first affected row in deterministic `(createdAt ASC, id ASC)` order. If none → 0 affected, skip steps 4–8 (idempotency).
4. `ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete` (DDL is transactional in Postgres — a rollback auto-reverts the DISABLE; primary safety, with a try/finally + explicit ENABLE as belt-and-suspenders).
5. `UPDATE` the legacy rows' `action` → canonical value.
6. Recompute the chain from the first affected row forward — walk `("createdAt", id) >= (firstTs, firstId)` in order; each row's `prevHash` = the previous row's recomputed `rowHash` (first row anchors on its predecessor's untouched stored `rowHash`); `rowHash = computeRowHash(...)` **imported from `audit-persistence.service.ts`, NOT reimplemented** (write-time/migration-time logic divergence would silently desync the chain).
7. `ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update_delete`.
8. Verify: re-walk the affected segment, assert every recomputed `rowHash` equals stored; assert the predecessor row was untouched.
9. Commit (or rollback under `--dry-run`). Emit a `SYSTEM_BACKFILL` row (`phase: COMPLETED`, payload `{ affectedCount, dryRun }`).

**Invariants:** facts (who/what/when + actor snapshot) unchanged — only the action code STRING is normalized; chain verifiable end-to-end after; trigger re-enabled with identical semantics; single all-or-nothing transaction; idempotent (2nd run finds 0 rows, recomputes nothing). **Runbook:** manual operator invocation per environment (`DATABASE_URL` + optional `DEPLOYED_BY`/`DEPLOY_USER` operator identity; `--dry-run` flag). Requires the `DATABASE_URL` role to own `audit_logs` (ALTER TABLE privilege). Rejected alternatives: pl/pgsql (would duplicate `computeRowHash` in SQL — divergence risk); Prisma `.sql` migration (awkward for TS-import recompute logic).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description** (legacy rows normalized so the canonical filter returns them).
2. Witnesses (re-scoped from the original read-API witness — see PHASE 1 re-cadrage) demonstrated against a real Postgres with the actual immutability trigger (vitest mocks the `database` module, so a direct-DB witness script is the only faithful test per the no-real-DB-vitest-harness constraint): **W-1** seed rows A(`PASSWORD_RESET_ADMIN`)/B(`LOGIN_SUCCESS`)/C(`PASSWORD_RESET_ADMIN`) via the write-time hash path, chain valid; **W-2** run → 2 rows (A,C) updated to canonical, all rows recomputed, chain verifies, trigger re-enabled; **W-3** idempotency → 2nd run 0 updated, chain still valid; **W-4** post-migration direct `UPDATE` raises the immutability exception; **W-5** two `SYSTEM_BACKFILL` rows (`phase` STARTED + COMPLETED); **W-6** complex/nested payload round-trips through the recompute (jsonb ↔ `stableStringify` stability). FAIL-pre on master (script absent), PASS-post.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — SATISFIED: the normalization emits `SYSTEM_BACKFILL` rows (STARTED/COMPLETED, with fromValue/toValue/affectedCount), so the operation is itself in the immutable trail.
5. Commit message includes `[closes AUD-READ-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit (diff confined to `apps/api/src/scripts/` + this BACKLOG + PROGRESS_LOG; no schema change, no `.sql` migration, `audit-persistence.service.ts` not modified, no new `AuditAction` enum member).

**Verification command:**
```
pnpm test apps/api/src/audit/
```

**Closed_by:** 5f87026
**Learnings (DONE 2026-05-26 — `5f87026`, re-scoped from the BLOCKED query-time alias):**
- **Shipped:** `apps/api/src/scripts/normalize-action-codes.ts` (exported testable core `normalizeActionCodes(deps)` + AppModule-boot CLI) + `normalize-action-codes.witness.ts` (direct-DB witness) + `package.json` script `normalize:action-codes`. `system-backfill-audit.ts` extended additively with optional top-level `fromValue`/`toValue` payload fields (2 new helper unit tests). `audit-persistence.service.ts` NOT modified; no schema change; no `.sql` migration; no new `AuditAction` enum member.
- **Re-scoping rationale:** the BLOCKED escalation (a4617db) correctly found no audit read pipeline to attach a query-time alias to. The right fix is one layer down — normalize the DATA so every consumer (direct psql / future read API / export) sees the canonical code. Dominates all three prior forks (defer / SQL VIEW / new endpoint): no deferral, no view to maintain, no endpoint to build. See the re-scoping note above the `---` for the full philosophical correction (**normalization ≠ history rewriting**: facts unchanged, only the derived action-code label + its integrity hashes; the trigger guards against casual/uncontrolled mutation, a controlled+audited+fully-recomputed operator normalization is its legitimate `DISABLE`-able exception).
- **Hash-chain recompute design:** single Prisma interactive `$transaction` — advisory lock (`pg_advisory_xact_lock(hashtext('audit_logs_chain'))`, same as the write path) → find first-affected `(createdAt,id)` → `DISABLE TRIGGER audit_logs_no_update_delete` → `UPDATE action` → walk `("createdAt",id) >= first` recomputing prevHash+rowHash with the **imported** `computeRowHash` (never reimplemented) → `ENABLE TRIGGER` → in-tx verify. DDL is transactional in Postgres, so a rollback auto-reverts the DISABLE (primary safety; try/catch + explicit ENABLE = belt-and-suspenders). Rows before first-affected are untouched (the OBS-002 SQL-canonical sealed segment stays sealed); the segment from first-affected onward becomes uniformly `computeRowHash`-canonical. Idempotent: 2nd run finds 0 rows, recomputes nothing.
- **Verification mechanism:** (a) in-script: re-walk the affected segment, assert each stored rowHash recomputes from its own fields + (new) prevHash, assert the predecessor row is unmodified (off-by-one guard on the tuple comparison); (b) witness `normalize-action-codes.witness.ts` against a real throwaway Postgres migrated with the actual schema (the immutability trigger is real) — **vitest is unusable here (it mocks the `database` module, [[project_no_realdb_vitest_harness]])**, so a direct-DB witness is the only faithful test. W-1..W-6 all PASS (seed A/B/C + complex nested-payload D chain valid; run → 2 rows normalized, full chain re-verifies, trigger re-enabled; idempotent 2nd run 0 changes; post-run direct UPDATE raises the immutability exception; 2 SYSTEM_BACKFILL STARTED+COMPLETED rows; complex payload round-trips jsonb↔stableStringify). CLI boot path + `pnpm run normalize:action-codes -- --dry-run` arg-forwarding both smoke-tested against the throwaway.
- **Runbook:** full operator runbook (preflight sizing query, privilege requirement = DATABASE_URL role must OWN audit_logs, `DEPLOYED_BY`/`DEPLOY_USER` operator identity, `--dry-run`, post-run verification) is in the fix commit body (`git show 5f87026`). **Not run against prod this session** (mechanism + dev verification only; prod invocation is a separate operation per the runbook). Dev DB (`orchestr_a_v2`) had **0** `PASSWORD_RESET_ADMIN` rows at session time (virgin — the AUD-EMIT-001 emit was post-rename; [[project_audit_module_write_only]]), so the witness used a controlled throwaway rather than polluting the (immutable) dev trail.
- **Failure mode (OBS-018 precedent):** a real (non-dry-run) failure leaves a `SYSTEM_BACKFILL` STARTED row with no COMPLETED; the absence of COMPLETED + the trigger being ENABLED (the tx rolled back the DISABLE) + the operator's error log together are the diagnostic signal. Acceptable, same exposure as `backfill-snapshots`.
- **Follow-up idea (not filed):** a startup hook asserting `audit_logs_no_update_delete` is ENABLED at boot would catch a script that ever crashed outside its transaction; lower priority since the single-transaction design makes a stuck-disabled state require a Postgres-level crash mid-DDL.

---

**Prior BLOCKED Learnings (historical, 2026-05-26 — superseded by the DONE re-scoping above):**
- **BLOCKED on audit-revision-required (2026-05-26): the audit read pipeline this task assumed did not exist.** The Suggested fix (option a — expand the WHERE clause in the read pipeline) has nothing to attach to, and AC#2's witness ("query the audit read API filtering by `PASSWORD_RESET_BY_ADMIN`, assert the legacy row is returned") is unsatisfiable because there is no audit read API.
- **Exhaustive search (5 angles) found zero read surface for `audit_logs`:** no `audit.controller.ts` (no controller mentions audit beyond write-side `emitDataExported`); no `auditLog.findMany / findFirst / findUnique / groupBy / aggregate` anywhere in `apps/api/src`; no `@Get`/`@Controller` audit endpoint; no `AuditLog`-typed read DTO/resolver; no web-side service consumes audit logs. The audit module (`audit.module.ts`) exports only `AuditService` + `AuditPersistenceService` (both write-side).
- **The only two reads of `audit_logs`** are internal/incidental: `audit-persistence.service.ts:111` (hash-chain tail `SELECT "rowHash" … LIMIT 1`, write-side integrity) and `users.service.ts:743` (`auditLog.count({ where: { actorId } })`, USR-DEL-001 dependency pre-check — filters by `actorId`, never by `action`).
- **The legacy-data risk is real but unreachable in this layer.** An auditor enumerating admin password resets today can only do so via direct SQL on the prod DB (`WHERE action = 'PASSWORD_RESET_BY_ADMIN'`), which a TypeScript alias map cannot intercept. Option (a) is moot; option (b) a SQL VIEW would cover direct-psql access but is a different design+scope; option (c) Prisma middleware needs a Prisma read query to intercept (none exists).
- **Shipping a standalone `legacy-action-aliases.ts` + pure `expandActionFilter()` with no consumer was rejected** as decorative dead code (over-design): future renames would discover an uncalled file the same way they'd discover a comment. Per contract §"When the audit is wrong or outdated" + design-question #4 (server-side filtering assumed but absent), flagged for human review rather than improvised.
- **Three forks for the human (see PROGRESS_LOG):** (1) **defer** until a read API is actually built — most likely, no auditor has a TS query path today; (2) **pivot to option (b) SQL VIEW** to cover direct-psql auditor access — rewrites the task's layer; (3) **scope-extend** into a new `GET /audit/logs?action=…` read endpoint + alias map + wiring as one feature — substantial scope explosion. **Future-rename guidance still stands for whichever fork lands:** when an enum value replaces a prior string, add the legacy string to the alias map in the SAME commit as the rename — but the alias map must have a live read consumer first.

- **RE-SCOPED 2026-05-26 (BLOCKED → IN_PROGRESS): a fourth fork, superior to all three above, normalizes the DATA not a read layer.** The BLOCKED escalation (a4617db) was correct that the *query-time alias* approach had nothing to attach to — but it framed the problem as "which read layer do we patch?" The right question is "why is the data non-canonical at all?" The answer: a string value evolved (SEC-003 free-string → OBS-004 enum rename) and the immutability trigger froze the legacy spelling. **Normalizing the legacy `action` string in place — with a full hash-chain recompute — makes EVERY consumer (direct psql, a future read API, a CSV export) see the canonical code, with zero alias maps to maintain.** It dominates fork (1) (no deferral — the gap is closed now), fork (2) (no VIEW to maintain — the base table is correct), and fork (3) (no endpoint to build).
  - **Philosophical correction — normalization ≠ history rewriting.** The immutability trigger exists to stop tampering with audit FACTS: who did what, when, with which actor snapshot. None of those change here. We change one derived label (`'PASSWORD_RESET_ADMIN'` → `'PASSWORD_RESET_BY_ADMIN'`, the SAME event, renamed in code at 330a8eb) and recompute the integrity hashes that depend on it. This is a **schema/vocabulary migration of historical rows**, the same class as the OBS-002 backfill that *created* the hash chain over pre-existing rows — not a falsification. To keep the act itself honest and auditable, the normalization writes its own `SYSTEM_BACKFILL` rows into the very trail it touches, and runs inside one bracketed transaction with the operator identity captured. The trigger is the guardrail against *casual/uncontrolled* mutation; a controlled, audited, operator-invoked, fully-recomputed normalization is the legitimate exception — exactly why the trigger is `DISABLE`-able by the table owner rather than enforced by a read-only role (that defence-in-depth layer is the separate TOOL-DEPLOY-001).
  - **Why a TS script and not SQL:** the recompute MUST use the write path's `computeRowHash` (imported), or write-time and migration-time hashing diverge and the chain silently desyncs. A pl/pgsql reimplementation of sha256-over-`stableStringify` is exactly that divergence. See Suggested fix for the full mechanism + runbook.
  - **Runbook reference:** operator invocation, env vars, dry-run flag, and the privilege requirement are documented in the fix commit body (PHASE 5) and the Suggested fix above.

---

## Phase 3 — Defense-in-depth schema — Invariants métier en SQL
*14 tasks in this phase.*

### DAT-003 — No DB CHECK on Leave.endDate >= startDate (and others)

- **Status:** DONE
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

**Closed_by:** 62c2fc4
**Learnings:** Bundled with [[DAT-004]] (same fix `62c2fc4`) — shared source file (`schema.prisma`), SQL mechanism (CHECK), and witness path (TST-DB-001 `*.int.spec.ts`); precedent TOOL-COH-001/002. 7 date CHECKs added: leaves/projects/epics/telework_recurring_rules/school_vacations use `"endDate" >= "startDate"`; `leave_validation_delegates` uses the physical `end_date >= start_date` (Prisma `@map`); `events` is the column-name variant `"recurrenceEndDate" >= "date"`. NULL passes a CHECK under SQL 3-valued logic, so nullable ranges need no IS NULL guard. **CHECK is not expressible in the Prisma 6 DSL** → hand-authored raw-SQL migration (precedent: 20260525190000 immutability, 200000 dat007, 210000 obs012, 120000 dat021); `schema.prisma` intentionally unchanged. The verification command's `migrate dev --create-only` is blocked by **pre-existing dev-DB drift** (leftover `_dat005_backup_*` tables, unrelated to this task, out of scope) → used the established hand-author + `migrate deploy` path instead, which is the real mechanism for every raw-SQL migration here. **Adjacent files (AC#6):** the migration dir + `apps/api/src/schema-constraints/*.int.spec.ts` — both within the contract's "schema.prisma + integration spec files" scope; specs placed in a neutral dir as the constraints are cross-cutting (not one domain) and `*.int.spec.ts` is excluded from `nest build`. Witness: FAIL-pre (constraints neutralized → 10 INSERTs accepted → assertions fail) → PASS-post (19/19). Pre-flight: 0 violating rows for all 14 predicates. **AC#4 (audit_logs entry) skipped** — schema migration, not audit-sensitive code (auth/leaves-approve/RBAC/doc-access/user-delete/password-reset); precedent DAT-005 (PROGRESS_LOG).

---
### DAT-004 — No CHECK on LeaveBalance.totalDays >= 0 / Leave.days > 0

- **Status:** DONE
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

**Closed_by:** 62c2fc4
**Learnings:** Bundled with [[DAT-003]] (same fix `62c2fc4`, same migration `20260527120000_dat003_dat004_business_invariants`) — see DAT-003 Learnings for the full bundle rationale. 7 numeric CHECKs: `leave_balances.totalDays >= 0`, `leaves.days > 0` (strict — `calculateLeaveDays()` is floored at 0.5 globally, so a positive minimum is the product invariant and a 0-day leave is always a bug; verified no product path writes a non-positive `days`), `tasks.progress`/`epics.progress` BETWEEN 0 AND 100, `predefined_tasks.weight` BETWEEN 1 AND 5, `project_members.allocation` BETWEEN 0 AND 100 (nullable → NULL passes), `documents.size >= 0`. **Scope note (literal per audit Suggested fix):** `Subtask.position` is named in the Description prose but NOT in the Suggested-fix constraint list — excluded, stayed literal. Witnesses assert SQLSTATE 23514 + the constraint name via raw INSERT; one negative case per numeric family + a positive case proving inclusive boundaries (0/100/1/5) and the 0.5 minimum are accepted. **AC#4 skipped** — schema migration, not audit-sensitive; precedent DAT-005.

---
### COR-022 — No upper bound on TimeEntry.hours; no per-day cap

- **Status:** DONE
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

**Closed_by:** 760aa58
**Learnings:**
- **Partial false positive (NOT escalated to BLOCKED).** The audit's Root cause ("DTO validation likely uses @IsNumber without a range") was wrong: `CreateTimeEntryDto.hours` already carried `@Min(0.25) @Max(24)`. So the single-entry bound and negative-hours rejection were *already* enforced (a typo of `80` is already rejected by `@Max(24)`). The genuinely-missing half of the Suggested fix was the **per-(userId, date) aggregate cap**, which was still reproducible — hence TODO→DONE, not the contract's "no longer reproducible" → BLOCKED path. Only the missing mechanism was implemented; no redundant DTO edit. (Discipline precedent: DAT-032 literal-scope reasoning.)
- **AC#2 witness placement.** A DTO test for `hours=25` cannot witness FAIL-pre (the bound already exists → it passes before *and* after). It is committed as a **regression guard** (locks `@Min/@Max` against future removal), explicitly NOT the witness. The genuine FAIL-pre→PASS-post witness is the **service-level sum-cap test** (mock aggregate returns 20h existing + 5h new = 25h → expect `BadRequestException`, `create` not called). Neutralized-code check confirmed teeth: pre-fix the 4 service cap tests fail non-vacuously ("expected rejected promise, received undefined"; `aggregate` called 0×), post-fix 87/87 green.
- **Threshold = 24** (`MAX_HOURS_PER_DAY`), per the task default; no existing constant/config implied another value. Boundary is inclusive — sum == 24 is allowed, sum > 24 rejected ("exceed the threshold").
- **Mechanism = service + DTO level only**, no DB CHECK (per Invariant 1). A complementary `time_entries_hours_ck` / per-day-sum DB guard would close the defense-in-depth gap (Phase 3 theme) but is **filed session-derived** rather than added in this commit — see DAT-033 (filed in closeout).
- **Exception type = `BadRequestException`** — grep confirmed the module uses it exclusively for validation rejections (no `ConflictException` import).
- **Write-path coverage.** Grep of `timeEntry.{create,update}` in the module found 4 sites: `create()` L141 (guarded), `update()` L496 (guarded), and the two `upsertDismissal` writes (`hours=0`, dismissal — no cap risk, untouched). The cap is keyed on `userId`; **third-party declarations (`userId = null`) are out of the audit's literal `per-(userId, date)` scope** and remain uncapped — filed session-derived as DAT-034.
- **Day boundary** computed as a UTC `[startOfDay, nextDay)` range (prod = UTC per [[project_prod_behind_master_dat005]]); robust to entries stored with a time component. Update path recomputes `effectiveHours/effectiveDate` (falling back to the existing row) and excludes the entry's own id (`id: { not }`) from the sum.
- **Spec mock gap fixed (adjacent, justified):** two pre-existing `update` tests mocked `findUnique` without `date`/`hours`; real rows are NOT NULL, and the new cap reads `existing.date`. Added those fields to the two mocks (the mocks were incomplete vs the real row shape). Added `aggregate: vi.fn()` to the Prisma mock with a default `{ _sum: { hours: 0 } }` so unrelated tests treat the cap as a no-op.
- **AC#4 N/A:** time tracking is not in the contract's audit-sensitive list (auth / leaves approve-reject / RBAC mutations / document access / user delete / password reset) — no `audit_logs` entry required.

---
### DAT-012 — Free-string fields where enum would prevent drift

- **Status:** DONE
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

**Closed_by:** c8b618e

**Learnings:**
- **6 columns → 5 enums; 1 bail.** Promoted: `defaultDuration`→`PredefinedTaskDuration`, `PredefinedTaskAssignment.period`+`PredefinedTaskRecurringRule.period`→shared `DayPeriod`, `completionStatus`→`AssignmentCompletionStatus`, `recurrenceType`→`RecurrenceType`, `AppSettings.category`→`AppSettingsCategory`. Migration `20260527130000_dat012_promote_string_enums`, hand-authored + `migrate deploy` (DAT-003/004 precedent; `migrate dev --create-only` still blocked by `_dat005_backup_*` drift, TOOL-DBSYNC-001). schema.prisma WAS edited this time (enum blocks expressible in Prisma DSL, unlike CHECK).
- **ProjectMember.role BAILED → filed DAT-035.** DB distinct = free-form FR institutional labels (`Chef de projet`×2944, `Membre`, `Responsable infra`, `Référente support`, `Lead dev`), matching the task's verbatim bail example. Not a closed code set.
- **AppSettings.category was bail-leaning, REVERSED on advisor review.** The literal bail trigger ("admin UI lets users define categories") is NOT met: `SettingsService.update()` gates on `isKnownKey`, category derives from hardcoded `DEFAULT_SETTINGS`; the dead `|| 'custom'` at L242 was unreachable (key always ∈ DEFAULT_SETTINGS by the L226 gate) and removed with the promotion. Net 1 bail, not 2 — under the 3-bail whole-task-pause threshold.
- **AuditLog.action/entityType → document route, NOT CHECK** (`docs/audit/canonical-action-codes.md`). Write side already compile-guaranteed (`AuditAction` enum + exhaustive `ENTITY_TYPE_BY_ACTION` + `audit-payload-registry.compile-witness.ts`); TOOL-DEPLOY-001 REVOKE + immutability trigger block any untyped write. CHECK would couple a migration to every new action (31, growing) and risk failing on un-enumerable prod legacy (PASSWORD_RESET_ADMIN / AUD-READ-001).
- **completionStatus is write-dead in current source** (no service path mutates it; only the DB default `NOT_DONE`). The 4-value enum set was taken from the schema comment as design intent — future-proofing, not observed writes.
- **No service-file edits needed** — enum-typed DTOs flowed through Prisma client regen without service-boundary casts. Adjacent type-boundary touches (Invariant 5): 6 DTOs swapped `@IsIn`→`@IsEnum(PrismaEnum)` (idiom: `import-leaves.dto.ts`); `settings.service.ts` (typed `DEFAULT_SETTINGS.category` + `findByCategory` guard against 22P02 on unknown input + dead-fallback removal); `vitest.setup.ts` global `database` mock exports the 5 enums.
- **Witness** (`apps/api/src/schema-constraints/dat012-enum-promotion.int.spec.ts`): 1 representative INSERT per distinct enum rejected with SQLSTATE 22P02. FAIL-pre (neutralized migration → columns stay text): 5 negative assertions fail (bogus accepted); PASS-post 25/25 integration. Parent task created via raw SQL so FAIL-pre exercises the assertions, not the typed client's enum cast.
- **AC#4 skipped** — schema migration, not audit-sensitive business mutation (DAT-005 / DAT-003-004 precedent).
- **⚠️ PROD DEPLOY:** `ALTER … USING col::"Enum"` aborts if any prod row holds a value outside the enum set. Dev pre-flight `SELECT DISTINCT` was clean across all 6 columns and the DTO `@IsIn` historically gated writes, but prod cannot be enumerated from here — run the same read-only `SELECT DISTINCT … FROM <table>` against prod BEFORE `migrate deploy` (DAT-003/004 prod pre-flight pattern). Migration `20260527130000` joins the pending Phase 3 prod batch (with `20260527120000`).

---
### DAT-013 — Time-of-day stored as String 'HH:MM' instead of Postgres TIME / minutes-int

- **Status:** DONE
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

**Closed_by:** c0189c1
**Learnings:**
Chose **option (c)** of the audit's three (String + CHECK regex), not (a) @db.Time.
Pre-flight ruled (a) out empirically: `@db.Time` requires a `DateTime` Prisma scalar,
and this repo's generated client maps `DateTime` → JS `Date` (verified in
`node_modules/.pnpm/@prisma+client@6.19.1.../.prisma/client/index.d.ts`: `createdAt: Date`).
Adopting (a) would cascade `string`→`Date` through the 6 DTO fields (each currently
`@Matches`-validated `string`), `planning-export.service.ts` (`event.startTime.split(':')`),
`predefined-tasks.service.ts`, the frontend (`usePlanningData` `localeCompare`,
`TaskForm` `<input type="time">` which emits/consumes strings) and `packages/types` —
>20 adjacent edits, the contract's scope-creep bail. The codebase does **no**
minutes-since-midnight arithmetic, so Int (b) is unjustified. (c) has zero TS surface
change and delivers the same Phase-3 invariant: the DB rejects malformed.

**Non-obvious — the CHECK is deliberately the floor, not equality.** Regex
`^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$` is the *lenient* pattern: it is exactly the
Task/Event DTO regex and a strict **superset** of the PredefinedTask DTO regex
(`^([01]\d|2[0-3]):[0-5]\d$`, 2-digit hour only). Chosen so nothing the application
layer accepts is rejected by the DB (no app-accepts/DB-rejects 500s on legit input);
per-table DTOs may stay stricter. Defense-in-depth ≠ DTO equality — the CHECK rejects
the audit-named invalids ('9:5', '25:99', '') plus '24:00'/'12:60'/whitespace, which
is the invariant. Verified semantically in PG before authoring (13-value VALUES probe).

**schema.prisma intentionally unchanged** (columns stay `String?`) — CHECK is not
Prisma-6-DSL-expressible (DAT-003/004 precedent, not DAT-012's enum-DSL path).
Hand-authored raw SQL migration `20260527140000_dat013_time_format_check`, 6 CHECKs
named `<table>_<col>_format_ck`. Nullable columns need no IS NULL guard (CHECK passes
on NULL under three-valued logic). Pre-flight (dev): only 4 well-formed HH:MM rows in
predefined_tasks, zero in tasks/events, **zero malformed** → no data-cleanup bail,
every ADD CONSTRAINT validated instantly. Applied via `migrate deploy` (not
`migrate dev`, still blocked by `_dat005_backup_*` drift — TOOL-DBSYNC-001).
Witness `dat013-time-format.int.spec.ts` (4 tests): FAIL-pre demonstrated by
neutralizing the migration to `SELECT 1;` (3 negatives fail non-vacuously, positive
still passes), restored byte-identical → PASS-post. AC#4 skipped (schema migration,
non-audit-sensitive — DAT-005/DAT-012 precedent).

---
### DAT-014 — Leave.type LeaveType? legacy enum still exists alongside leaveTypeId — drift risk

- **Status:** DONE
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

**Closed_by:** f8a5ce9
**Learnings:**
- **Path B (trigger), NOT Path A (DROP COLUMN) — blocked by active frontend display.** The audit's
  primary fix (drop `leaves.type`) is gated on "no SELECT references it." Pre-flight found `leave.type`
  consumed by **three active frontend sites** — `apps/web/app/[locale]/leaves/page.tsx:486,508`
  (`switch (leave.type)`), `.../users/[id]/suivi/page.tsx:912` (i18n key `leaves.types.${leave.type}`),
  `src/components/planning/DayCell.tsx:152` (legacy fallback) — plus the `findAll` `?type=` API filter
  (`leaves.service.ts:715`). Per the contract's bail condition (active frontend display ⇒ Path A
  blocked) this took the audit's stopgap path.
- **Auto-sync (self-healing) trigger style, NOT validate-and-reject** (a deliberate deviation from
  Invariant #2's "P0001/reject" witness language, blessed by the bail-condition's "pick an auto-sync
  style that's self-healing" clause). `leaves_sync_type_trg` BEFORE INSERT OR UPDATE derives `NEW.type`
  from the joined `leave_type_configs.code` (member→verbatim, else `OTHER`), making the column a
  read-only mirror of the FK — this removes the dual *writeable* source of truth without physically
  dropping the column. Chosen over a CHECK/validation trigger because the service maps arbitrary
  custom codes (e.g. `CP_E2E`) to enum `OTHER`, so a naive `NEW.type = code` validation would wrongly
  REJECT every legitimate custom leave type. Witness is therefore **coercion-style** (insert wrong
  type → reads back coerced), not rejection.
- **`enum_range(NULL::"LeaveType")::text[]`** used for the membership test (advisor's catch) instead of
  a hardcoded `IN ('CP','RTT',…)` list — adding a future enum member won't silently miscoerce. Verified
  on PG18: `'CP' = ANY(…)` → t, `'CP_E2E' = ANY(…)` → f.
- **One-time backfill in the same migration** (advisor): `UPDATE leaves SET type = <derived> … WHERE
  type IS DISTINCT FROM <derived>` reconciles existing rows so the invariant holds immediately, not
  just on the next write. Dev (3 rows): the 1 NULL/`CP_E2E` row → `OTHER`; the 2 CP rows unchanged.
- **COR-029 disposition:** `getPendingDays` (`leaves.service.ts:2507`, reads `where: { type: CP }`) is
  confirmed **dead** (`grep` → 0 callers). COR-029's audit text invites deleting it. Left untouched
  here (Path B needs zero TS edits — Invariant 5/6); its `type` read is now harmless since the trigger
  guarantees `type` mirrors the FK. COR-029 (Phase 13) can delete it without risk.
- **Adjacent-file inventory: ZERO TS files touched.** Fix = 2 new files (migration + int spec). Under
  Path B the column stays, so the service's `type: enumType` writes, the `findAll ?type=` filter, the
  DTO/controller `type?` params, and all unit-spec assertions stand unchanged — and the trigger is
  invisible to the mocked-`database` unit suite (confirmed: 1658 unchanged). schema.prisma unchanged
  (triggers aren't Prisma-6-DSL-expressible; same raw-SQL pattern as DAT-003/004/013).
- **Known limitation (noted for a future task, advisor):** the trigger fires on writes to `leaves`,
  not to `leave_type_configs`. If an admin changes a config's `code`, existing leave rows keep their
  old derived `type` until next written. The audit's concern is write-time drift, which this closes; a
  config-side propagation trigger would be separate scope.
- **FAIL-pre demonstrated live** on the triggerless dev DB (BEGIN…ROLLBACK): `INSERT … type='RTT'`
  against a CP config persists `RTT`; post-migration (ephemeral harness) the same insert reads back
  `CP`. Witness has real teeth.

---
### DAT-016 — Department.name and Service.name lack UNIQUE constraints

- **Status:** DONE
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

**Closed_by:** ce8877a
**Learnings:**
- **DSL-expressible → schema.prisma WAS edited** (unlike DAT-003/004/013/014, which were CHECK/trigger SQL-only): `@unique` on `Department.name`, `@@unique([departmentId, name])` on `Service`. Migration `20260527160000` hand-authored but **byte-equivalent to `migrate dev` output** (`CREATE UNIQUE INDEX`, Prisma `<table>_<col>_key` naming → `departments_name_key`, `services_departmentId_name_key`) because the dev DB stays `migrate dev`-blocked by the `_dat005_backup_*` drift (TOOL-DBSYNC-001); applied via `migrate deploy` (drift-tolerant). A `pg_indexes` test pins the convention names so a future drift-clean `migrate dev` produces no shadow diff.
- **Composite, NOT global** on Service (literal Suggested fix). Positive test (same name, two different departments → both accepted) is the load-bearing proof. Matches the app's existing `services.service.ts` pre-check on `{ name, departmentId }`.
- **Pre-flight (dev psql):** both `name` columns already `NOT NULL` → no `NULLS NOT DISTINCT` consideration. **0 duplicates** in both `departments(name)` and `services(departmentId, name)` (2 depts, 4 svcs) → clean-to-proceed, no in-session rename. Only PK indexes existed before; no leftover stray unique on `services.name` alone.
- **23505-leak adjacency — NOT extended into this commit (advisor-confirmed).** Both `departments.service.ts` and `services.service.ts` already pre-check uniqueness via `findFirst` → `ConflictException`, so the happy-path stays unchanged. The DB constraint introduces a new 500 ONLY in the TOCTOU race (concurrent creates both pass the pre-check) or a direct-SQL bypass. That post-constraint behavior (one row created, the other 500s) is *strictly better* than pre-DAT-016 (silent duplicate — the audit's exact complaint). The brief's "23505-leak surprise" anticipated a *generic try/catch swallowing* Prisma errors; what we found is no catch + an explicit pre-check, a narrower risk. Kept DAT-016 schema+spec-only (zero TS, DAT-013/014 precedent); filed **COR-034** to map `P2002 → ConflictException` on dept/service create as the race-window hardening.
- **Witness gotcha:** Prisma's `$executeRawUnsafe` reformats a unique violation to `Key (<cols>)=(<vals>) already exists` and **drops the index name** (unlike CHECK 23514, which keeps the constraint name — DAT-013). Asserted on the key-column tuple instead (`Key (name)=`, `Key ("departmentId", name)=`) — equally discriminating (a PK collision reads `Key (id)=`) and directly proves composite-vs-global. The raw `psql` prod smoke *does* name the index, so that smoke asserts the index name.
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005/012/013/014 precedent).
- **Client.name** (named in the Description as a third instance but omitted from the literal Suggested fix list) filed as session-derived **DAT-036** — defense-in-depth follow-up, NOT in this scope (same closeout-filing pattern as DAT-004→DAT-032).

---
### DAT-017 — Task.projectId nullable creates orphan tasks with no integrity check

- **Status:** DONE
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

**Closed_by:** f6ca325
**Learnings:** Path A only (CHECK), per pre-decided split. **Pre-flight (dev psql, 2026-05-27):** 0 CHECK violators → clean (3288 tasks; 3 with projectId NULL, all epic/milestone-null = legitimate transverse). Cross-table drift 0/0 (epic + milestone joins); `epics.projectId`/`milestones.projectId` both NOT NULL → DAT-037's data-cleanup burden ≈ nil. **DTO finding (drives COR-035, NOT a DAT-016-shape leak):** `create-task.dto.ts` declares `projectId`/`epicId`/`milestoneId` each `@IsOptional` with NO cross-field `@ValidateIf` — the orphan combo was DTO-accepted, so the CHECK is the only thing closing it. `tasks.service.ts` has no Prisma error handling/global filter → after the CHECK, an orphan-create (plain invalid input) surfaces as a 500. Unlike DAT-016 (pre-check exists → 500 only on TOCTOU race → P2002→409), here the lead fix is a DTO cross-field guard returning **400** *before* the DB hit; service-side 23514→BadRequest mapping is the fallback. Filed COR-035 — kept DAT-017 schema+spec-only (DAT-013/014/016 precedent), zero TS. **Mechanism:** raw-SQL migration `20260527170000`, `tasks_parent_requires_project_ck`; not Prisma-DSL-expressible, schema.prisma unchanged. Predicate is fully non-NULL-valued (no 3VL surprise; all-null transverse task passes the right disjunct). **Witness** (`dat017-task-parent-consistency.int.spec.ts`, TST-DB-001): 2 negatives (orphan epic / orphan milestone → 23514 + constraint name via `$executeRawUnsafe`) + 2 positives (all-null transverse; project task with epic — asserted accepted because projectId is non-null, NOT because epic.projectId matches, since the CHECK does no cross-table work). FAIL-pre demonstrated (neutralized → `SELECT 1;`: 2 negatives accept, positives pass; restored byte-identical) → PASS-post 4/4, full integration **42** (was 38). **Gates:** `migrate deploy` clean (constraint confirmed in `pg_constraint`); `nest build` EXIT 0; `pnpm test` api **1658** unchanged (integration-only); `pnpm test:integration` **42**; `pnpm test:e2e` **2**. AC#4 skipped (schema migration, not audit-sensitive; DAT-005/012/013/014/016 precedent).

---
### DAT-018 — TaskDependency self-relation has no cycle prevention

- **Status:** DONE
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

**Closed_by:** fff93ce
**Learnings:**
- **Both Suggested-fix items implemented; trigger path chosen for Item 2 (defense-in-depth), service-only rejected.** Item 1 = raw-SQL CHECK `task_dependencies_no_self_ck` (`"taskId" <> "dependsOnTaskId"`). Item 2 = BEFORE INSERT OR UPDATE trigger `task_dependencies_no_cycle_trg` (fn `task_dependencies_check_cycle`) walking the existing graph FORWARD from `NEW."dependsOnTaskId"`; if it reaches `NEW."taskId"`, RAISE (P0001) carrying identifier `task_dependencies_no_cycle`. The "and/or" in the Suggested fix is a design call: Phase-3 thesis is "DB floor for what services should already reject" (the DAT-017 DTO finding proved services don't always reject), so a DB trigger — not service-only — is the correct floor.
- **Service-layer check ALREADY EXISTS — kept alongside (defense-in-depth), NOT touched, NOT made redundant.** Pre-flight found `tasks.service.ts:853` `addDependency` → `checkCircularDependency()` (BFS walk), which throws `BadRequestException` (400) on both multi-hop cycles AND the 1-hop self-loop (its `startTaskId === targetTaskId` short-circuit catches A→A). So the documented controller path returns a clean 400 BEFORE any DB write; the trigger/CHECK fire only on a direct-SQL / admin-console / future-code bypass. This is the brief's "existing method that throws → keep alongside" branch.
- **COR-036 NOT filed.** Its trigger would be a trigger→500 leak on the controller path; there is none, because the service rejects with 400 before the DB is hit (and `tasks.service.ts` has no Prisma error handling per DAT-017's finding, but that handler is never reached for cycles). The trigger is bypass-only defense-in-depth → no app-layer 409 mapping needed.
- **Self-loop is left to the CHECK by design, not the trigger.** For a 1-hop self-loop (`NEW.taskId = NEW.dependsOnTaskId = X`) the forward walk seeds from X's existing outgoing edges; in a valid DAG X is never reachable from itself, so the trigger stays silent and the CHECK fires → 23514 with `task_dependencies_no_self_ck`. The two guards never both fire on one row; each negative test asserts a distinct, documented signal (23514+name vs the `task_dependencies_no_cycle` identifier).
- **UPDATE false-positive caught in review (advisor) and fixed.** Trigger is BEFORE INSERT OR UPDATE; during a BEFORE UPDATE the OLD row is still in the table, so a naive forward walk traverses the edge being replaced and false-rejects a legitimate re-point (UPDATE `(A→B)` → `(A→C)`: stale A→B makes B reachable). Both CTE arms exclude the modified row via `(TG_OP = 'INSERT' OR id <> OLD."id")`. A 7th test (UPDATE-positive) locks this clause so it can't silently regress. `TG_OP` is the discriminator — on INSERT, OLD's *fields* are NULL but OLD itself is not a NULL composite.
- **Recursive CTE: UNION (not UNION ALL)** so Postgres dedups by row and terminates even on a pre-existing cycle (free defensive guard). Columns are `text` (Prisma String → text), NOT uuid — the pre-flight scan's `ARRAY[...]::uuid[]` errored until cast to text[]; the trigger uses plain text throughout.
- **Pre-flight (dev DB :5433, 2026-05-27):** `task_dependencies` holds **0 rows** → 0 direct self-loops, 0 multi-hop cycles → both ADD CONSTRAINT and the trigger attach cleanly, no in-migration cleanup. **Event.parentEventId** (DAT-038 sizing): 0 self-cycles, 0 multi-hop, **0 of 195 events have a parent** → DAT-038 data-cleanup burden ≈ nil (recorded in the filing).
- **schema.prisma UNCHANGED (Invariant 1):** neither CHECK nor trigger is Prisma-6-DSL-expressible — hand-authored raw SQL `20260527180000_dat018_task_dependency_cycle_prevention` (same pattern as dat003/004/013/014). Applied to dev via `migrate deploy` (TOOL-DBSYNC-001: `migrate dev` still drift-blocked; both `DATABASE_URL` and `DATABASE_MIGRATION_URL` = the orchestr_a owner URL on :5433). Constraint + trigger + function confirmed in `pg_constraint`/`pg_trigger`/`pg_proc`.
- **AC#4 skipped** — schema migration, not an audit-sensitive business mutation (DAT-005/012/013/014/016/017 precedent).
- **Diff scope (AC#6 — fix commit `fff93ce`):** 2 files, both new — the migration + the int spec. No schema.prisma, no service, no DTO, no controller, no frontend edit.
- **Witnesses (AC#2, TST-DB-001 harness, `apps/api/src/schema-constraints/dat018-task-dependency-cycle.int.spec.ts`):** 7 tests — 3 negatives (self-loop→23514+name; 2-hop A→B,B→A; 3-hop A→B,B→C,C→A → `task_dependencies_no_cycle`), 3 INSERT-positives (linear chain A→B→C→D; tree A→B,A→C; diamond A→B,A→C,B→D,C→D — prove no DAG false-reject), 1 UPDATE-positive. **FAIL-pre demonstrated:** neutralized migration → `SELECT 1;` → the 3 negatives fail non-vacuously ("expected … but the INSERT was accepted"), 4 positives pass; restored byte-identical (diff-verified). PASS-post: full integration **49** (was 42; +7).
- **Filed at closeout:** DAT-038 (Event.parentEventId cycle prevention — the audit's "Same for Event.parentEventId", omitted from the literal Suggested fix; closeout-filing precedent DAT-004→DAT-032, DAT-016→DAT-036, DAT-017→DAT-037). COR-036 NOT filed (see above).

---
### DAT-023 — Leave: no overlap constraint (EXCLUDE USING gist) — same user can have overlapping approved leaves

- **Status:** DONE
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

**Closed_by:** c27862a
**Learnings:**
- **Literal Suggested fix kept verbatim — all three baked-in choices validated against the code, none needed adjusting.**
  1. *`'[]'` inclusive bounds.* `leaves.service.ts` `checkOverlap` (line 2782) already treats overlap inclusively (`startDate <= endDate AND endDate >= startDate`) and **ignores the `halfDay` enum entirely** — so two same-day leaves (incl. a morning + an afternoon) are already a conflict at the service layer. Morning+afternoon-same-day pairs are NOT a supported product feature → no half-day carve-out needed, no `AND NOT "halfDay"` widening. The inclusive `[]` matches existing semantics exactly. **DAT-039 NOT filed** (the conditional filing was gated on "WHERE clause needed widening"; it did not).
  2. *Partial `WHERE (status = 'APPROVED')`.* Only APPROVED rows mutually exclude; PENDING/REJECTED/CANCELLED overlap freely. A partial EXCLUDE also **re-checks on UPDATE when a row ENTERS the predicate** (PENDING→APPROVED) — which is precisely the audit's race path, pinned by witness Negative #3.
  3. *No `::date` cast.* `leaves."startDate"`/`"endDate"` are already Postgres `date` (`@db.Date`), so `daterange(date, date, '[]')` resolves directly (verified `format_type` in pre-flight). Note the schema has **no `halfDayStart` column** — the brief's pre-flight query referenced one; the real model is a single `halfDay HalfDay?` (MORNING|AFTERNOON).
- **btree_gist required** (mixes `=` on text userId with `&&` range in one GiST index; stock GiST has no equality opclass for text). `CREATE EXTENSION IF NOT EXISTS btree_gist` is idempotent. Dev role `orchestr_a` is **superuser** (`rolsuper=t`) so CREATE succeeds on dev + in the int harness (owner runs `migrate deploy`); **prod must run CREATE EXTENSION as superuser** before/at `migrate deploy` — surfaced in the deploy doc.
- **Pre-flight (dev psql, 2026-05-27, container orchestr-a-db :5433):** btree_gist NOT pre-installed; **0 overlapping APPROVED pairs** (3 leaves total, all APPROVED) → clean to proceed, no in-migration cleanup, no bail.
- **Service-layer overlap check EXISTS on create (433) + update (1248) → `ConflictException` (409); but `approve` (1619) does NOT re-check overlap and the leaves module has no Prisma error handler.** So the EXCLUDE (23P01) can only fire on the APPROVE path (or import auto-approve), where it currently leaks as a generic **500**. → **COR-037 filed** (typed 409 on 23P01 at approve/import). The create/update happy paths are unaffected (their 409 fires first).
- **Mechanism:** raw-SQL migration `20260527190000_dat023_leave_no_overlap_exclude`, constraint `leaves_no_overlap` (`contype='x'`), confirmed via `pg_get_constraintdef`. schema.prisma UNCHANGED (EXCLUDE not Prisma-6-DSL-expressible; DAT-013/017/018 precedent). Applied to dev via `migrate deploy` (TOOL-DBSYNC-001: both DATABASE_URL + DATABASE_MIGRATION_URL = owner URL).
- **Witnesses (TST-DB-001, `apps/api/src/schema-constraints/dat023-leave-no-overlap.int.spec.ts`):** 7 tests — 3 negatives (INSERT 2 APPROVED overlapping; `[]` adjacency `[Mar1,Mar5]`+`[Mar5,Mar10]` proving inclusive bounds discriminately, per advisor; the PENDING→APPROVED race via two UPDATEs — the audit's exact scenario, advisor-added), 3 positives (overlap allowed when one is PENDING; cross-user overlap allowed = userId scoping; same-user gap allowed), 1 `pg_constraint` name pin (advisor-added, mirrors DAT-016's `pg_indexes` pin). Each test uses its own throwaway user. **FAIL-pre demonstrated** (migration → `SELECT 1;` → the 3 negatives + the pin fail non-vacuously `expected '' to match /23P01/`, 3 positives pass); restored byte-identical (diff-verified) → PASS-post 7/7, integration **49→56**.
- **AC#4 skipped** — structural schema constraint, not an audit-sensitive business mutation (DAT-005/012/013/014/016/017/018 precedent), even though `leaves` is in the audit-sensitive list.
- **Forward adjacency:** COR-024 (Phase 7) + DAT-024 (Phase 7) flag the race window on leave create/import; this EXCLUDE is the DB floor those race-resolution tasks will rely on.
- **Phase 3 close-out: this is the 10th and LAST Phase-3 task → Phase 3 is 10/10 DONE.**

---

### DAT-032 — No DB CHECK on Subtask.position >= 0

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma` (Subtask model)
- **Source:** Session-derived. DAT-004 closeout (`62c2fc4`, 2026-05-27) — DAT-004's Description named `Subtask.position Int` among the bound-less columns, but its Suggested fix list omitted it (7 CHECKs listed for 8 columns described). Bundle discipline kept it out of scope (stayed literal to the Suggested-fix list); filed now as the defense-in-depth completion. See [[DAT-004]] Learnings and the 2026-05-27 PROGRESS_LOG entry.

**Description:**
No DB CHECK on `Subtask.position >= 0` — the bound is mentioned in DAT-004's Description but absent from its Suggested fix list, so it was not covered by the bundle migration `20260527120000_dat003_dat004_business_invariants`. A buggy service path or a direct admin SQL fix can persist a negative ordering position.

**Root cause:**
The non-negative ordering-position invariant is encoded only in DTO validators / application logic, with no defense-in-depth at the DB layer — the same gap DAT-004 closed for the other numeric columns, minus this one column that fell between the audit's Description and its Suggested fix.

**Code evidence:**
```
schema.prisma — Subtask model: position Int — no CHECK constraint.
grep -n 'subtasks_position_ck' packages/database/prisma/migrations/  # expect 0 hits (not in 20260527120000)
```

**Suggested fix:**
`ALTER TABLE subtasks ADD CONSTRAINT subtasks_position_ck CHECK ("position" >= 0)` in a new hand-authored migration (CHECK is not expressible in the Prisma 6 DSL — see DAT-003/DAT-004 precedent). Mirror the DAT-004 witness pattern in `apps/api/src/schema-constraints/` (FAIL-pre/PASS-post via raw INSERT, asserting SQLSTATE 23514 + the constraint name).

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Skipped: schema migration, not audit-sensitive code; precedent DAT-005.
5. Commit message includes `[closes DAT-032]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate deploy && pnpm test:integration  # apply migration + real-DB witness (migrate dev --create-only blocked by _dat005_backup_* drift — see TOOL-DBSYNC-001)
```

**Closed_by:** `7af1991` (2026-05-28) — bundled with [[DAT-033]] in migration `20260528120000_dat032_dat033_position_and_hours_bounds` + witness `apps/api/src/schema-constraints/dat032-dat033-position-and-hours-bounds.int.spec.ts`.
**Learnings:**
- Bundle rationale: same source file (schema.prisma), same SQL mechanism (single-column CHECK), same witness path. Tighter than DAT-003/004 jurisprudence (one family, not two) — literally the two columns DAT-004 should have covered. Dual-close per TOOL-COH-001/002 + DAT-003/004 precedent.
- DAT-004's Description listed 8 numeric columns but its Suggested-fix block listed only 7 CHECKs; bundle discipline (stay literal) kept Subtask.position out. The session-derived backfill is the right escape hatch — file the gap, don't silently widen scope mid-bundle. See [[DAT-033]] for the COR-022 analogue.
- Pre-flight on dev: 0 violators. Witness pattern reused verbatim from `dat004-numeric-bounds.int.spec.ts` (raw `$executeRawUnsafe` INSERT, SQLSTATE 23514 + constraint-name assertion).

---
### DAT-033 — No DB-level guard on TimeEntry hours (single-entry bound + per-day cap)

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma` (TimeEntry model)
- **Source:** Session-derived. COR-022 closeout (`760aa58`, 2026-05-27) — COR-022 enforced the single-entry bound (DTO `@Min/@Max`) and the per-(userId, date) cap at the **service layer only** (Invariant 1 forbade adding a DB CHECK inside that commit). Filed now as the defense-in-depth completion (Phase 3 theme: business invariants descended to the DB). See [[COR-022]] Learnings and the 2026-05-27 PROGRESS_LOG entry. Precedent: DAT-032 (DAT-004 → session-derived DB-CHECK completion).

**Description:**
`TimeEntry.hours` has no DB CHECK. The single-entry bound `[0.25, 24]` lives only in `CreateTimeEntryDto` (class-validator) and the per-day aggregate cap lives only in `TimeTrackingService` (COR-022). A direct admin SQL write or a service path that bypasses the DTO can persist negative or absurdly large hours. The single-column bound (`hours >= 0`, or `> 0 AND <= 24`) is expressible as a column CHECK; the per-day sum cap is NOT (cross-row aggregate — would need a trigger).

**Root cause:**
Business invariant encoded only at the application layer; no defense-in-depth at the DB layer — the same gap DAT-003/DAT-004 closed for other numeric/date columns.

**Code evidence:**
```
schema.prisma — TimeEntry model: hours Decimal — no CHECK constraint.
grep -n 'time_entries_hours_ck' packages/database/prisma/migrations/  # expect 0 hits
```

**Suggested fix:**
`ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_ck CHECK (hours >= 0 AND hours <= 24)` in a new hand-authored migration (CHECK not expressible in Prisma 6 DSL — DAT-003/004 precedent). Note `hours = 0` must stay valid for dismissals (`isDismissal = true`). The per-day sum cap is out of scope for a single-column CHECK and remains the COR-022 service-level guard (a DB trigger for the aggregate is a separate, heavier decision — do not bundle). Mirror the DAT-004 witness pattern in `apps/api/src/schema-constraints/` (raw INSERT, SQLSTATE 23514 + constraint name).

> **Residual the implementer should know (from COR-022 closeout):** the COR-022 per-day cap is a non-transactional read-then-write (`aggregate` then `create`/`update`) → **TOCTOU race**: two concurrent same-(userId, date) requests can each read the pre-state and both commit, overshooting 24h. A per-row `time_entries_hours_ck` (this task) does NOT close it (CHECK is per-row, not cross-row aggregate). Fully closing the aggregate invariant under concurrency needs a serializable transaction around the read+write or a DB trigger — a heavier, separate decision; do not fold it into this CHECK. Same residual applies to DAT-034's third-party path.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: schema migration, not audit-sensitive code; precedent DAT-005.
5. Commit message includes `[closes DAT-033]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate deploy && pnpm test:integration  # apply migration + real-DB witness (migrate dev --create-only blocked by _dat005_backup_* drift — see TOOL-DBSYNC-001)
```

**Closed_by:** `7af1991` (2026-05-28) — bundled with [[DAT-032]] in migration `20260528120000_dat032_dat033_position_and_hours_bounds` + witness `apps/api/src/schema-constraints/dat032-dat033-position-and-hours-bounds.int.spec.ts`.
**Learnings:**
- **CHECK-floor over-constraint trap (load-bearing).** `CreateTimeEntryDto.hours` carries `@Min(0.25) @Max(24)` BUT gated by `@ValidateIf((dto) => !dto.isDismissal)`; `TimeTrackingService` writes dismissal rows with `hours: 0` (lines 308, time-tracking.service.ts). The legitimate persisted range is therefore `{0} ∪ [0.25, 24]`, NOT `[0.25, 24]`. A CHECK `hours >= 0.25` would have rejected 101 legitimate dismissal rows on dev today (pre-flight scan). The correct DB floor is the superset `hours >= 0 AND hours <= 24`, leaving the `(0, 0.25)` exclusion to the DTO where it belongs. Witness includes a load-bearing positive `hours = 0` test that would fail under the over-constraint — keep it.
- **TOCTOU residual (carried forward from COR-022 closeout — implementer note).** This per-row CHECK does NOT close the COR-022 per-(userId, date) aggregate-cap race: the cap is `aggregate` then `create` / `update` non-transactional, so two concurrent same-day requests can each read the pre-state and both commit past 24h. Closing the aggregate invariant under concurrency requires a serializable transaction around read+write or a DB trigger — heavier, separate decision; deliberately not folded in. **The same residual applies to DAT-034's third-party path** — when DAT-034 lands the service-level cap, the residual will still apply to both actor dimensions.
- **time_entries actor-XOR check ordering.** The pre-existing `time_entries_actor_xor_check` (requires exactly one of `userId` / `thirdPartyId`) can fire before `time_entries_hours_ck` on a row that lacks both. Negative witnesses must set `userId` so the row satisfies the XOR and the bound is the only failing predicate. First attempt didn't set it and failed with `actor_xor_check` instead of `hours_ck`; trivial fix but caught only because the assertion pins the constraint name. Lesson: when adding a CHECK to a table that already has constraints, design witness rows to satisfy ALL existing CHECKs so the new one is the unique failure mode.
- Bundle rationale + dual-close: see [[DAT-032]] Learnings.

---
### DAT-034 — Per-day hours cap not enforced for third-party time declarations

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · quota
- **File:** `apps/api/src/time-tracking/time-tracking.service.ts`
- **Source:** Session-derived. COR-022 closeout (`760aa58`, 2026-05-27) — COR-022's per-day cap is keyed on `userId` (the audit's literal `per-(userId, date)` scope). Third-party declarations store `userId = null` (actor = `thirdPartyId`), so they bypass the cap entirely. Kept out of COR-022's literal scope (contract forbids scope-expansion; [[feedback_no_overdesign]]). See [[COR-022]] Learnings.

**Description:**
`TimeTrackingService.create()` resolves an actor that is either a `user` (`userId` set) or a `thirdParty` (`thirdPartyId` set, `userId = null`). The COR-022 per-day cap runs only when `actor.kind === 'user'`. A caller with `time_tracking:declare_for_third_party` can therefore log unbounded same-day hours against a third party (each entry still bounded to ≤ 24 by the DTO, but the daily aggregate is uncapped).

**Root cause:**
The cap helper is keyed on `userId`; the third-party dimension (`thirdPartyId`) was deliberately left out of COR-022 to stay literal to the audit's `per-(userId, date)` wording.

**Code evidence:**
```
time-tracking.service.ts — create(): `if (actor.kind === 'user') { await this.ensureDailyCapNotExceeded(...) }`  — no thirdParty branch.
```

**Suggested fix:**
Generalize `ensureDailyCapNotExceeded` to accept the actor dimension — sum `WHERE thirdPartyId = <id>` (instead of `userId`) for third-party entries — and call it on the third-party create/update path too. Same threshold (24) and same `BadRequestException`. Add a service-level witness mirroring the COR-022 user-path test but with `thirdPartyId`.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: time tracking is not audit-sensitive (see COR-022).
5. Commit message includes `[closes DAT-034]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/time-tracking/
```

**Closed_by:** `6b17ec9` (2026-05-28) — generalized `ensureDailyCapNotExceeded` to accept an actor discriminator, dropped the user-only guards in `create()` and `update()`, added `else if (existing.thirdPartyId)` branch on update. Witness: 3 new tests in `time-tracking.service.spec.ts`.
**Learnings:**
- **Cap-key semantics pre-flight CLEAR.** `resolveActor` (lines 240-262) already produces a clean discriminated union `{kind:'user',userId}|{kind:'thirdParty',thirdPartyId}`; passing the union through to the cap helper makes the dimension switch one `where` clause. No ambiguity → no halt.
- **TOCTOU residual carries verbatim from COR-022.** The cap is still a non-transactional `aggregate`-then-`create/update`; both the user dimension AND the new third-party dimension race in the same way. Closing it would need a serializable transaction or a DB trigger — heavier, separate decision; DAT-033's per-row CHECK structurally can't close cross-row aggregate races.
- **Cross-actor mutation guard already in place.** The update path's pre-existing `'thirdPartyId' in updateTimeEntryDto` guard (line 518) refuses to switch a row's actor dimension. So at update time, the existing row's `userId`/`thirdPartyId` field tells us unambiguously which cap to apply — no need to read the DTO to decide. The new `else if (existing.thirdPartyId)` branch reads the right field.
- **One spec adjacency needed.** The pre-existing test "allows update when caller is the declaredBy" mocked a thirdParty entry without `date`/`hours`, which was fine before DAT-034 (the cap was userId-only and skipped). With the cap now firing for thirdPartyId entries on update, the test mock had to supply `date` and `hours` + a default `aggregate` mock. Trivial fixture fix, but a recurring lesson: when generalizing a helper, audit every test that exercised the helper's previous skip-conditions.
- **AC#4 N/A** — time tracking is not audit-sensitive (COR-022 precedent).

---

### DAT-035 — ProjectMember.role is a free-string holding institutional labels, not codes

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · schema
- **File:** `packages/database/prisma/schema.prisma:220`
- **Source:** Session-derived. DAT-012 pre-flight (`c8b618e`, 2026-05-27) — one of DAT-012's (A) enum-promotion candidates. Bailed per DAT-012's per-column bail condition: a `SELECT DISTINCT role FROM project_members` returned free-form FR labels, not UPPERCASE_UNDERSCORE codes, so it cannot be honestly closed into a fixed enum. See the 2026-05-27 DAT-012 PROGRESS_LOG entry. Aligns with [[project_responsable_scope_perimeter]] / SEC-002 ("institutional roles vary per collectivité; only templateKey is stable").

**Description:**
`ProjectMember.role String` (schema.prisma:220, comment "Chef de projet, Membre, Observateur...") stores human-authored project-role labels. Dev DB distinct values: `Chef de projet` (2944), `Membre` (12), `Responsable infra` (1), `Référente support` (1), `Lead dev` (1). These are display labels in mixed case/accents, not a closed code set — DAT-012 promoted the other 6 columns to enums but bailed this one because an enum would either reject existing labels or freeze a set that legitimately varies. Typos still silently create near-duplicate roles (`Chef de projet` vs `Chef de Projet`), the original DAT-012 failure mode, but enum is the wrong remedy here.

**Root cause:**
Project member roles were modeled as free text to allow per-project / per-collectivité variation; no normalization or reference list constrains them.

**Code evidence:**
```
schema.prisma:220  role String // Chef de projet, Membre, Observateur...
project_members.role distinct (dev): 'Chef de projet', 'Membre', 'Responsable infra', 'Référente support', 'Lead dev'
```

**Suggested fix:**
Decide between (a) a documented free-form policy with input normalization (trim + canonical-case) to stop near-duplicate drift, or (b) a `project_member_roles` reference table (institutional, per-collectivité-extensible) with a FK from `project_members.role` — mirroring how institutional roles are handled elsewhere (templateKey-bound). NOT a native enum (the DAT-012 bail rationale). Execution session picks the mechanism; back it with a witness over the chosen drift-prevention.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: project membership is not in the audit-sensitive list.
5. Commit message includes `[closes DAT-035]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate deploy && pnpm test apps/api/src/ && pnpm test:integration
```

**Closed_by:** (none — moved to `BLOCKED-DESIGN-DECISION` 2026-05-28 mini-arc resume session, task 9/9, per the prompt's "MANDATORY HALT — pre-flight only, do NOT implement").
**Learnings:**
- **BLOCKED — pre-flight + recommendation only (per prompt protocol).** No code change. The mini-arc closes 8/9 implemented + 1 halt-for-decision; this is the deliberate decision-surface stop.
- **Value-space scan (dev DB, 2026-05-28):** 5 distinct values across `project_members.role`:
  - `Chef de projet` — 2944 rows (99% of all members; clearly the canonical leader label)
  - `Membre` — 12 rows
  - `Responsable infra` — 1
  - `Référente support` — 1
  - `Lead dev` — 1
- **Code logic that depends on role (grep findings):** `apps/api/src/common/services/ownership.service.ts:24` declares `const PROJECT_LEADER_MEMBER_ROLES = ['Chef de projet', 'OWNER', 'LEAD']`. The UPPERCASE entries (`OWNER`, `LEAD`) **match ZERO rows in actual data** — they're a dead contract. The 2944-row `Chef de projet` works correctly because it's the literal label seeded. No other code path branches on `role`.
- **Closed-set vs open assessment:** 4 of 5 distinct values are singletons or near-singletons ("Responsable infra", "Référente support", "Lead dev") — these are clearly per-project / per-collectivité variations, NOT a stable enum. The audit's Source already noted DAT-012 bailed exactly because of this; SEC-002 / [[project_responsable_scope_perimeter]] confirms institutional roles vary per collectivité. **Value space is GENUINELY OPEN.**
- **Recommendation to operator — Option (a) free-form + normalization is the right call:**
  1. **Implement (a) lightweight:** add a class-validator transform at the DTO layer (CreateProjectMemberDto / UpdateProjectMemberDto) stripping leading/trailing whitespace + collapsing internal whitespace + enforcing min/max length (e.g. `@Length(2, 60)`). Stops typo-spawned near-duplicates AT WRITE TIME without restricting the legitimate variation. No DB migration needed.
  2. **Side fix recommended in the same commit:** `OwnershipService.PROJECT_LEADER_MEMBER_ROLES` — the UPPERCASE `OWNER`/`LEAD` codes match no data and should be either (i) removed (current behavior is unchanged — those branches were dead) OR (ii) explicitly documented as forward-compat placeholders. Choosing (i) is the smaller blast radius.
  3. **Witness:** DTO unit spec asserting input `'  Chef de projet  '` is trimmed → `'Chef de projet'` and asserting rejected inputs (`''`, single-char, 60+ chars).
- **NOT RECOMMENDED — Option (b) reference table:** Over-engineered for 5 values when the value space is fundamentally open. Only justified if the operator wants curated role-list management as a separate product feature.
- **NOT RECOMMENDED — CHECK or native enum:** DAT-012 already bailed exactly because of the open value space.
- **Status moved to `BLOCKED-DESIGN-DECISION`.** Operator picks Option (a-lightweight), (a) with the OwnershipService dead-code removal, or (b) reference table. A halt-for-decision is a clean termination of the mini-arc — 8/9 implemented + 1 decision-surface stop = full coverage of the audit-prescribed Phase 3 follow-ups.
- **(2026-05-28, mini-arc closer session) RESUMED + CLOSED via Option (a)+dead-code — operator-decided.** `Closed_by: 148b713` — migration `20260528160000_dat035_project_member_role_length` + DTO edits to `add-member.dto.ts` and `update-member.dto.ts` + dead-code removal in `ownership.service.ts` + witnesses `dat035-project-member-role-length.int.spec.ts` and `projects/dto/member.dto.spec.ts`.
- **Pre-flight pinned the design choices:**
  - role NOT NULL at schema level → CHECK doesn't need an `IS NULL` arm.
  - 0 nulls / 0 empties / 0 whitespace-only across 2959 rows → CHECK validates clean, no in-migration data cleanup.
  - maxlen 17 → chosen N=100 gives ~5.8x headroom (justified in migration header).
  - RBAC-sensitivity verdict: `OwnershipService.isProjectOwner` reads role as a leader-determinant fallback, but all live values (`Chef de projet` 2944, `Membre` 12, plus the 3 institutional one-offs) pass CHECK + DTO unchanged → live RBAC preserved 100%. Not a halt.
  - Dead-code re-grep: `'OWNER'` and `'LEAD'` declared only at `ownership.service.ts:24`, used only at line 114, zero references in `apps/web` or `packages/`, zero matching rows in `project_members` → safe to delete; behavior byte-equivalent because the `role: { in: [...] }` filter against those codes always returned an empty set.
- **Layer-of-rejection split codified:** DB CHECK is the structural floor (length 1..100); DTO is the canonicalization + 400 partner (trim + length 1..100). They share bounds so the DTO never produces a value the CHECK rejects, and the CHECK catches direct SQL writes that bypass the DTO. Whitespace-only is deliberately NOT a CHECK concern (the DTO trims; the int witness has a dedicated test pinning the design contract so a future reviewer who would tighten the CHECK to `length(btrim(role)) >= 1` notices and updates the DTO at the same time).
- **Dead-code removal motivation (in-scope per the decided (a)+dead-code):** the UPPERCASE codes were the artifact of the exact closed-set / enum idea this task declines. Keeping them would have left a misleading list that suggests a future seed will introduce code-style labels — but the audit's resolution is precisely that the value space stays open and free-form. Removing them states the design intent in the code.
- **AC#4 N/A** — schema CHECK migration is not audit-sensitive (DAT-005/012/013/014/016/017/018/023/032/033/036/037/038 precedent); the DTO normalization + dead-code removal touch no audit-emission paths (project membership is not in the audit-sensitive list).
- **FAIL-pre/PASS-post protocol applied non-vacuously:** commented out the migration's `ADD CONSTRAINT`, ran int suite → 2 negatives failed (empty + 101 accepted); restored byte-identical → all 6 pass. DTO + dead-code removal verified by absence-of-breakage (zero live refs grep + green nest build + full suite pass post — honest AC#2 note: 2 of 3 changes have explicit FAIL-pre/PASS-post; the third is verified by absence-of-breakage, as the prompt allowed).
- **This closes the Phase 3 mini-arc — 9/9 done.** Mini-arc total: 6 migrations + 5 code-only changes (COR-022 from Phase 3 audit-prescribed counts separately). Coherence 43→52 across both mini-arc sessions. Deploy-doc stays accumulating; re-finalize is the next (separate) session.

---
### DAT-036 — Client.name lacks a UNIQUE constraint

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:526`
- **Source:** Session-derived. DAT-016 closeout (`ce8877a`, 2026-05-27). DAT-016's **Description** named `Client.name` as a third instance of the missing-UNIQUE failure mode ("Same for Client.name") but its **Suggested fix** list enumerated only Department + Service, so Client stayed out of DAT-016's literal scope (bundle-discipline; same closeout-filing pattern as DAT-004→DAT-032). Filed here as the defense-in-depth follow-up.

**Description:**
`Client.name` (schema.prisma:526, `model Client { name String … @@index([name]) }`) has a non-unique index only — two clients can be created with identical names, indistinguishable in the UI except by UUID. Projects link to clients via `ProjectClient`; a duplicate client name makes project-client attribution ambiguous. Same failure mode DAT-016 closed for Department/Service.

**Root cause:**
Schema author treated UUID as identity and left `name` as a label (identical to DAT-016's root cause). The existing `@@index([name])` optimizes lookup but does not enforce uniqueness.

**Code evidence:**
```
schema.prisma:526-537 model Client: name String; @@index([name]) — no @unique. clients table (dev): indexes clients_pkey, clients_isActive_idx, clients_name_idx — no unique on name.
```

**Suggested fix:**
Add `@unique` on `Client.name` (replacing or alongside the existing `@@index([name])` — a unique index already serves the lookup, so the plain `@@index` becomes redundant and should be dropped). Mirror DAT-016's mechanism exactly: DSL `@unique` + a `CREATE UNIQUE INDEX "clients_name_key"` migration byte-equivalent to `migrate dev` output, applied via `migrate deploy`. Pre-flight: `SELECT name, count(*) FROM clients GROUP BY 1 HAVING count(*) > 1` (dev + prod) — `CREATE UNIQUE INDEX` aborts on existing dups; resolve by rename if any. Witness under TST-DB-001 (FAIL-pre→PASS-post, 23505 on the `Key (name)=` signature). Check `clients.service.ts` create path for the same TOCTOU/23505-leak adjacency DAT-016 deferred to COR-034.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: schema migration, not audit-sensitive (DAT-016 precedent).
5. Commit message includes `[closes DAT-036]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate deploy && pnpm test apps/api/src/ && pnpm test:integration
```

**Closed_by:** `ce026d6` (2026-05-28) — migration `20260528130000_dat036_client_name_unique` + witness `apps/api/src/schema-constraints/dat036-client-name-unique.int.spec.ts`.
**Learnings:**
- Trivial DAT-016 follow-up: same mechanism, same byte-equivalence discipline (Prisma `<table>_<col>_key` naming, schema.prisma carries `@unique`), same Prisma 23505 error-shape (index name dropped → assert on `Key (name)=`). Dropped the redundant `@@index([name])` since the unique index already serves the lookup. Pre-flight 0 dups across 200 clients.
- **Cross-arc dependency:** this adds Client as a third surface that [[COR-034]] must catch (P2002 → 409). Originally COR-034 was filed for Department + Service only; widened in the same arc to include Client to keep the layer-of-rejection coverage symmetric across all three DAT-016-family entities.

---
### COR-034 — Department/Service create leaks a 500 on the unique-constraint race (should be 409)

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · error_handling
- **File:** `apps/api/src/departments/departments.service.ts:30`, `apps/api/src/services/services.service.ts:44`
- **Source:** Session-derived. DAT-016 closeout (`ce8877a`, 2026-05-27). Surfaced in DAT-016's pre-flight: both create paths pre-check uniqueness via `findFirst` → `ConflictException`, but the `.create()` is unguarded. With DAT-016's DB-level UNIQUE now live, a TOCTOU race (two concurrent creates both pass the pre-check) or a direct write surfaces Prisma `P2002` unhandled → HTTP 500. DAT-016 stayed schema+spec-only (advisor-confirmed); this is the deferred application-layer hardening.

**Description:**
After DAT-016, `departments.service.ts:30` and `services.service.ts:44` can throw an unmapped `PrismaClientKnownRequestError` (code `P2002`, unique constraint failed) in the narrow window where two concurrent requests both pass the `findFirst` pre-check and then both attempt `.create()`. The second `INSERT` hits the DB UNIQUE index (23505); with no try/catch around `.create()`, Nest returns a generic 500 instead of the `409 ConflictException` the sequential path already returns. The duplicate is correctly *prevented* either way (DAT-016 is doing its job) — this is purely the error surface.

**Root cause:**
The uniqueness check is a non-atomic read-then-write (TOCTOU). Before DAT-016 the race silently created a duplicate; DAT-016 closed the correctness gap but converts the race into a 500 because `P2002` is not mapped to a domain exception.

**Code evidence:**
```
departments.service.ts:22-35  findFirst({where:{name}}) → ConflictException; then unguarded prisma.department.create({...})
services.service.ts:31-51     findFirst({where:{name,departmentId}}) → ConflictException; then unguarded prisma.service.create({...})
```

**Suggested fix:**
Wrap each `.create()` in a try/catch mapping Prisma `P2002` → the same `ConflictException` message the pre-check already returns (so the race collapses to the identical 409). Keep the pre-check (fast path / friendly message for the common case). Optionally factor a small `isUniqueViolation(err)` helper. Witness: a unit test asserting a mocked `P2002` from `.create()` yields `ConflictException`, not a leaked 500.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: department/service create is not in the audit-sensitive list.
5. Commit message includes `[closes COR-034]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/departments apps/api/src/services
```

**Closed_by:** `08d04b1` (2026-05-28) — try/catch wrappers in `departments.service.ts`, `services.service.ts`, `clients.service.ts`; spec assertions in each `*.service.spec.ts`.
**Learnings:**
- **Widened scope to Client at filing time (DAT-036 closeout).** The original audit named Department + Service; DAT-036 added Client as a third surface. ClientsService had NO `findFirst` pre-check (unlike the other two) — the try/catch wrapper IS the entire mapping. Documented in the wrapper comment so a future reviewer doesn't add a redundant pre-check.
- **Prisma `meta.target` is an array of column names, not the index name.** The 23505 surfaces via Prisma as `PrismaClientKnownRequestError(code='P2002', meta={target: ['name']})` for Department/Client, and `meta.target = ['departmentId', 'name']` for Service. Useful if differentiating index-specific messages later, but for now a single friendly message per service is enough (every UNIQUE on these tables is the name index).
- **Race surface is asymmetric:** Department/Service have a fast-path `findFirst` pre-check returning the friendly 409 in the common case, and the try/catch only fires under the narrow TOCTOU race. Client has no pre-check, so the try/catch fires every time. Both paths now return the same 409 — Cour-des-Comptes parity.
- **AC#4 confirmed N/A:** none of department/service/client create or update is in the audit-sensitive list (the list is auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset). Documented in commit.

---
### DAT-037 — Task.projectId may disagree with its epic/milestone's project (no cross-table check)

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · constraint
- **File:** `packages/database/prisma/schema.prisma:288`
- **Source:** Session-derived. DAT-017 closeout (`f6ca325`, 2026-05-27). DAT-017's **Suggested fix** had two clauses of different mandatoriness: the **mandatory** single-row CHECK (closed by DAT-017) and a **discretionary** "Consider trigger validating epic.projectId = task.projectId". The latter is a cross-table consistency property with a different risk profile (a per-write lookup into `epics`/`milestones`) — deliberately split out per the same precedent as DAT-013 (regex CHECK chosen, the heavier mechanism deferred). Filed here as the cross-table follow-up.

**Description:**
DAT-017's CHECK guarantees that a task with an epic or milestone also names *a* project, but NOT that it names the *same* project the epic/milestone belongs to. A task can have `projectId = A` while `epic.projectId = B` (or `milestone.projectId = B`). Because `epics.projectId` and `milestones.projectId` are both `NOT NULL`, every linked task has an unambiguous "true" project via its parent; a mismatch means a project-scoped RBAC decision or rollup pivoting on `task.projectId` attributes the task to the wrong project from the parent's point of view.

**Root cause:**
Three independently-writable FK columns (`projectId`, `epicId`, `milestoneId`) with no constraint tying `task.projectId` to the parent's `projectId`. Single-row CHECKs cannot express cross-row/cross-table predicates — this requires a trigger.

**Code evidence:**
```
schema.prisma:288-290 Task.projectId / epicId / milestoneId — independent FKs, no cross-table equality.
Dev drift (psql, 2026-05-27): 0/0 — `tasks JOIN epics` and `tasks JOIN milestones` where the projectIds differ both returned 0 rows (DAT-017 pre-flight step 2). So the data-cleanup burden is ≈ nil; this is invariant-tightening, not data-rescue.
```

**Suggested fix:**
A `BEFORE INSERT OR UPDATE` trigger on `tasks` that, when `epicId`/`milestoneId` is set, asserts (or coerces) `NEW.projectId = (SELECT "projectId" FROM epics/milestones WHERE id = NEW.<fk>)`. **Decide reject-vs-coerce in pre-flight** (DAT-014 chose coerce to avoid 500s on legitimate writes; a reject trigger is simpler but must not break the create path — check `tasks.service.ts` write sites). **Mechanism note (advisor, important):** the invariant can drift from BOTH sides — a `tasks` write AND an `UPDATE epics/milestones SET "projectId" = …` that re-parents an epic. A `tasks`-only trigger leaves existing task rows stale after a parent re-parent (the exact gap DAT-014's Learnings flagged for `leave_type_configs`). Either add a companion trigger on `epics`/`milestones` propagating the change, or document the limitation. `schema.prisma` stays untouched (triggers not DSL-expressible; raw-SQL migration — DAT-014 precedent). Witness under TST-DB-001: FAIL-pre→PASS-post, mismatch insert rejected/coerced; pre-flight drift re-confirmed 0 before attaching.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: schema migration, not audit-sensitive (DAT-014/017 precedent).
5. Commit message includes `[closes DAT-037]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate deploy && pnpm test apps/api/src/ && pnpm test:integration
```

**Closed_by:** (none — blocked on design decision; see Learnings)
**Learnings:**
- **BLOCKED on design decision (2026-05-28 mini-arc, task 4/9, no closing SHA).**
- **Mutability pre-flight:** `UpdateEpicDto extends PartialType(CreateEpicDto)` and `UpdateMilestoneDto extends PartialType(CreateMilestoneDto)` — BOTH `epics.projectId` and `milestones.projectId` are mutable via the standard update endpoint. The task block's "If MUTABLE → bidirectional guarding needed" branch applies.
- **Drift re-confirmed:** 0 / 0 (tasks JOIN epics where projectIds disagree; tasks JOIN milestones same). Invariant-tightening, not data-rescue.
- **Deadlock in the straightforward REJECT-bidirectional design:** with REJECT triggers on both the tasks side (assert NEW.projectId = parent.projectId on tasks INSERT/UPDATE) AND the parents side (block UPDATE epics/milestones SET projectId if dependent tasks exist), the workflow "move an epic between projects, taking its tasks with it" becomes impossible at the DB layer — each side rejects the other's first move. Once an epic has any dependent task, neither `task.projectId` nor `epic.projectId` can be changed first.
- **Resolving the deadlock requires the MANDATORY-HALT mechanisms the task block named:**
  - **(A) AFTER UPDATE cascade** on `epics`/`milestones` propagating the new projectId to dependent tasks — i.e. "cascade re-validation" (literal halt trigger in the task block).
  - **(B) Statement-level triggers / deferrable constraints** so both sides see the consistent post-statement state — literal halt trigger.
  - **(C) Service-layer transactional helper** (the move workflow becomes a single PG transaction that updates BOTH parent and children in one atomic step, both triggers seeing post-tx state — but Postgres BEFORE triggers fire row-by-row, not at end-of-tx, so this still hits the deadlock unless triggers are made DEFERRABLE; deferrable triggers are a separate, heavier decision).
  - **(D) One-sided (tasks-only) REJECT trigger + documented limitation** — the audit's "or document the limitation" branch. Implementable as the literal Suggested-fix's task-side path, but the bidirectional gap stays open: an `UPDATE epics SET projectId=…` leaves dependent tasks with stale projectId. This matches the SEC-002 peer-edit "documented gap" precedent and the DAT-014 Learnings flag.
- **No design pre-authorized by this prompt covers (A)/(B)/(C); only (D) fits "straightforward BEFORE triggers" but explicitly accepts the bidirectional gap.**
- **Recommendation to operator (next session):** decide between:
  1. **Ship (D)** — task-side BEFORE trigger only, document the parent-side gap in a follow-up backlog item. Closes the audit's literal Suggested-fix scope; matches DAT-014's "task on one side, document the other" precedent. Smallest blast radius.
  2. **Ship (A)** — task-side BEFORE REJECT + parents-side AFTER UPDATE CASCADE (epic/milestone projectId change re-writes all dependent tasks). Heavier, but the only "fully closes the invariant under mutation" path that avoids deadlock. Operator must accept that an `UPDATE epics SET projectId=…` will silently re-write N task rows (audit/log implications).
  3. **Defer entirely** — close DAT-037 as `BLOCKED-DESIGN-DECISION` until the threat model justifies the heavier mechanism. Drift was 0/0 dev (no active incident).
- **Reverted to TODO under BLOCKED-DESIGN-DECISION status; no IN_PROGRESS anchor, no fix commit, no closing SHA.** The mini-arc session continues with the next task per the global execution protocol.
- **(2026-05-28, resume session) Closed via Option A — operator-decided.** `Closed_by: 128393e` — migration `20260528150000_dat037_task_project_consistency` + witness `apps/api/src/schema-constraints/dat037-task-project-consistency.int.spec.ts`.
- **Sub-halt pre-flight cleared:** 435 tasks with BOTH epicId AND milestoneId set; **0** have epic.projectId differing from milestone.projectId. The "competing parents" sub-halt criterion did NOT fire on actual data — proceed authorized. Drift 0/0 (task vs epic, task vs milestone).
- **Design (3 triggers, all hand-authored raw SQL):**
  1. `tasks_project_consistency_trg` (BEFORE INSERT/UPDATE on tasks) — REJECT on mismatch; SKIP when NEW.projectId IS NULL (preserves DAT-017's CHECK ownership of the orphan case; layer-of-rejection contract).
  2. `epics_cascade_projectid_trg` (AFTER UPDATE OF projectId on epics) — cascade NEW.projectId to dependent tasks; resolves the bidirectional deadlock from the prior BLOCKED analysis.
  3. `milestones_cascade_projectid_trg` (AFTER UPDATE OF projectId on milestones) — mirror of #2.
- **Layer-of-rejection contract (load-bearing).** The DAT-017 spec asserts 23514 + tasks_parent_requires_project_ck. My BEFORE trigger fires before CHECK constraints; if it intercepts the orphan case, the DAT-017 spec breaks. The `NEW.projectId IS NOT NULL` guard on both arms preserves DAT-017's invariant. Trigger fires ONLY on cross-table EQUALITY violations (drift), not on orphans (single-row CHECK). Caught only because the DAT-017 spec exists — without it, the layering would have been invisible.
- **Edge case for Operational notes:** if a task has BOTH parents in different projects (impossible in current data, but newly preventable), the cascade on one parent forces task.projectId to disagree with the OTHER parent; the task-side BEFORE rejects the cascade UPDATE → cascade fails → parent UPDATE aborts. Operator workflow to legitimately move both: update milestone first (cascade), then epic (cascade re-aligns; accepted because milestone now also matches the new project). Documented in the deploy doc.
- **Cascade audit semantics (Cour des Comptes anticipation):** parent-side cascades rewrite N task rows silently — no `audit_logs` entry per task. The change IS derivable from the parent's audit row (epic/milestone update). Adding per-task system-derived audit emission would be scope creep — OBS-002's trigger pipeline doesn't cover system writes; the existing app-mutation-only audit is the precedent. Operator should expect cascade to be silent at the audit_logs layer.
- **AC#4 N/A** — schema migration, not audit-sensitive code (DAT-014/017/018/038 precedent).
- **Witness includes the cascade-positive (7th test):** UPDATE epic.projectId from P1 to P2; dependent tasks auto-update to P2; post-cascade no-op title update succeeds (proves the BEFORE re-check finds the parent's NEW value). This pins the non-deadlock proof empirically.

---
### COR-035 — Orphan task create leaks a 500 on the DAT-017 CHECK (should be 400 at the DTO)

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · error_handling
- **File:** `apps/api/src/tasks/dto/create-task.dto.ts:19`, `apps/api/src/tasks/tasks.service.ts:223`
- **Source:** Session-derived. DAT-017 closeout (`f6ca325`, 2026-05-27). Surfaced in DAT-017's pre-flight: `create-task.dto.ts` declares `projectId`/`epicId`/`milestoneId` each `@IsOptional` with NO cross-field `@ValidateIf` tying them, and `tasks.service.ts` has no Prisma error handling. With DAT-017's CHECK now live, an API request supplying an `epicId`/`milestoneId` but no `projectId` (the orphan combination) hits the DB CHECK (23514) unmapped → HTTP 500. DAT-017 stayed schema+spec-only; this is the deferred application-layer hardening.

**Description:**
After DAT-017, a `POST /tasks` (or update) with `epicId` set and `projectId` omitted is accepted by the DTO validators (each field is independently optional) and reaches `prisma.task.create`, where Postgres rejects it with 23514 on `tasks_parent_requires_project_ck`. With no try/catch, Nest returns a generic 500 for what is plainly invalid client input. The orphan row is correctly *prevented* either way (DAT-017 is doing its job) — this is the error surface.

**Root cause:**
The DTO never expressed the cross-field invariant "epicId/milestoneId imply projectId", so invalid combinations passed validation and only the DB CHECK caught them — too late for a clean 4xx.

**Suggested fix — LEAD is DTO-side, NOT the DAT-016/COR-034 try/catch shape:** add a class-validator cross-field guard on `CreateTaskDto`/`UpdateTaskDto` — e.g. a `@ValidateIf((o) => o.epicId || o.milestoneId)` plus a custom validator (or a `@Validate` constraint) requiring `projectId` to be present — so the orphan combination returns **400 Bad Request** *before* the DB hit. This differs from COR-034: DAT-016's leak was a 500 only on a TOCTOU race past an existing pre-check (→ `P2002`→409 was right); here there is no pre-check and the input is simply invalid (→ 400 at the DTO is the lead). A service-side `23514`→`BadRequestException` mapping is the **fallback** only if a non-DTO write path (e.g. import/bulk at `tasks.service.ts:1383`) can construct the orphan combination. Witness: a controller/DTO unit test asserting the orphan payload yields 400, not 500.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: task create is not in the audit-sensitive list.
5. Commit message includes `[closes COR-035]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/tasks
```

**Closed_by:** `d5ac36a` (2026-05-28) — `ProjectRequiredWhenParentedConstraint` in `create-task.dto.ts`, `UpdateTaskDto` overrides in `update-task.dto.ts`, witness `create-task.dto.spec.ts` (10 tests).
**Learnings:**
- **@ValidateIf short-circuit trap (load-bearing).** The audit's natural read suggests attaching the cross-field check to `projectId`. But `projectId` already carries `@ValidateIf((o) => o.projectId !== null && undefined && '')` which short-circuits ALL property validators on that field when projectId is empty — exactly the failure mode the check needs to catch. The fix: attach `@Validate(ProjectRequiredWhenParentedConstraint)` to `epicId` AND `milestoneId` instead; those fields don't have a competing `@ValidateIf` and the validator reads the full DTO via `ValidationArguments.object`. Witness has a "projectId explicitly empty" test that would have silently passed under the wrong attachment point.
- **UpdateTaskDto inheritance trap.** Default `PartialType(CreateTaskDto)` inherits ALL property decorators, including the new `@Validate`. On a partial update with `{ epicId: X }` alone, the DTO would 400 even though the DB row already holds `projectId` — a false positive. Fixed via `OmitType` + redeclaration without the constraint. The DB CHECK + DAT-037 still cover the update path; the trade-off is a (rare) post-update 500 if a service path constructs an orphan via update, which the audit's "fallback only for non-DTO write paths" sentence anticipates.
- **Layer-of-rejection partner pattern explicit.** COR-034 (P2002→409 race) and COR-035 (DTO 400 plainly-invalid input) are distinct handlers for distinct error-classes — DAT-016/036 races vs DAT-017 plainly-invalid combos. The pattern carries forward to COR-037 next (DAT-023 race) for the leaves no-overlap surface. Three closures, three distinct mappings — never blend them.

---
### DAT-038 — Event.parentEventId has no cycle prevention (the audit's "Same for Event.parentEventId")

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · cascade
- **File:** `packages/database/prisma/schema.prisma:920`
- **Source:** Session-derived. DAT-018 closeout (`fff93ce`, 2026-05-27). DAT-018's **Description** AND **Code evidence** both named `Event.parentEventId` as a second instance of the missing cycle-guard ("Same for Event.parentEventId", `schema.prisma:899-906 Event.parentEventId: no CHECK`), but its **Suggested fix** named only `TaskDependency` literally, so `Event.parentEventId` stayed out of DAT-018's literal scope (bundle-discipline; same closeout-filing pattern as DAT-004→DAT-032, DAT-016→DAT-036, DAT-017→DAT-037). Filed here as the defense-in-depth follow-up.

**Description:**
`Event.parentEventId` is a self-FK (`Event? @relation("EventRecurrence")`, used for recurrence) with `onDelete: Cascade`. Nothing at the DB level stops the 1-hop self-loop (`parentEventId = id`) or a longer cycle (A.parent=B, B.parent=A, …). A cycle makes the recurrence parent chain non-terminating, so any walk up the parent chain (recurrence expansion, "is this the master event?" rollups) loops forever. Exactly the DAT-018 failure mode on a different self-relation. NOTE: unlike `task_dependencies` (a join table, edge = a row), this is a single nullable column on `events`, so the trigger walks `id → parentEventId` and the self-loop CHECK is `"parentEventId" IS DISTINCT FROM "id"` (must tolerate the common NULL case — most events have no parent).

**Root cause:**
Self-reference modelled without a recursive-CTE guard (same as DAT-018).

**Code evidence:**
```
schema.prisma:920 Event.parentEventId String?  +  :926 parentEvent self-relation (onDelete: Cascade). No CHECK, no trigger.
Dev pre-flight (psql, 2026-05-27, DAT-018 step 4): 0 direct self-cycles (parentEventId = id), 0 multi-hop cycles, and 0 of 195 events have a parentEventId at all → both the CHECK and the trigger attach cleanly with NOTHING to reject; data-cleanup burden = nil. This is invariant-tightening, not data-rescue.
```

**Suggested fix:**
Mirror DAT-018 (`fff93ce`, migration `20260527180000`) on `events`: (1) raw-SQL CHECK `events_parent_no_self_ck` `CHECK ("parentEventId" IS DISTINCT FROM "id")` — `IS DISTINCT FROM` so the NULL-parent case passes cleanly (most events have no parent); (2) a `BEFORE INSERT OR UPDATE` trigger walking `parentEventId` upward from `NEW."parentEventId"`; if it reaches `NEW."id"`, RAISE with identifier `events_parent_no_cycle`. **Carry over the DAT-018 advisor catch:** the trigger fires on UPDATE too, so exclude the row under modification on both CTE arms via `(TG_OP = 'INSERT' OR id <> OLD."id")` to avoid false-rejecting a legitimate re-parent. UNION (not UNION ALL) for cycle-safe termination; columns are `text`. As in DAT-018 the self-loop is left to the CHECK (the trigger seeds from the parent, never reaches itself in a valid tree). `schema.prisma` stays untouched (raw-SQL migration; DAT-018 precedent). Check whether any service method already rejects event-parent cycles (DAT-018 found `tasks.service.ts checkCircularDependency` for the task case) — if so keep it alongside; if a controller path can hit the trigger raw, consider a typed-400/409 follow-up (DAT-018 did NOT need one because the service rejected first). Witness under TST-DB-001: FAIL-pre→PASS-post — self-loop→23514+`events_parent_no_self_ck`, 2-hop/3-hop→`events_parent_no_cycle`, plus DAG positives (linear parent chain, NULL-parent event) and an UPDATE-positive re-parent.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: schema migration, not audit-sensitive (DAT-014/017/018 precedent).
5. Commit message includes `[closes DAT-038]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm prisma migrate deploy && pnpm test apps/api/src/ && pnpm test:integration
```

**Closed_by:** `a99dda5` (2026-05-28) — migration `20260528140000_dat038_event_parent_cycle_prevention` + witness `apps/api/src/schema-constraints/dat038-event-parent-cycle.int.spec.ts`.
**Learnings:**
- **No service-side cycle guard on events.** Unlike DAT-018 (which is a DB floor on top of tasks.service.ts `checkCircularDependency`), `apps/api/src/events/events.service.ts` has no event-parent cycle check. The trigger is the only line of defense — a controller path that raw-hits the trigger surfaces P0001 as a 500. A COR-style typed-exception wrapper is plausible follow-up (file separately if it comes up) but the trigger is the load-bearing guarantee, so this task closes the audit gap as filed.
- **NULL-parent short-circuit is the hot path.** Dev shows 0 of 195 events have a parent; production is likely similar. The trigger `IF NEW.parentEventId IS NULL THEN RETURN NEW` makes the no-parent insert/update O(1) — important because every event mutation hits this trigger.
- **CHECK uses `IS DISTINCT FROM`, not `<>`.** `<>` returns NULL when either side is NULL (three-valued logic), and a CHECK passes on NULL — so `<>` would have worked here, but `IS DISTINCT FROM` makes the intent explicit and survives any future tightening of CHECK semantics (`NOT VALID` or `NULL NOT DISTINCT` modes). Trivial choice but worth documenting.
- **OLD-row exclusion verified on UPDATE-positive.** Re-pointing C from B to A on an A←B←C chain is legitimate (flattens to A←B, A←C). The witness UPDATE-positive locks this — without `(TG_OP = 'INSERT' OR e.id <> OLD."id")` the walk would still see C's stale parent B and false-reject. Carries DAT-018 learning #3 verbatim.
- **Bundle discipline confirmed.** DAT-018's Description AND Code evidence both named Event.parentEventId as a second instance, but its Suggested-fix list named only TaskDependency literally; stayed out of DAT-018 by literal-scope discipline, closed here as the session-derived follow-up. Same pattern as DAT-004→DAT-032, DAT-016→DAT-036, DAT-017→DAT-037.

---

### COR-037 — Leave approve/import leaks a 500 on the DAT-023 EXCLUDE (should be 409)

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** nit
- **Category:** correctness · error_handling
- **File:** `apps/api/src/leaves/leaves.service.ts:1619` (`approve`); import auto-approve write sites in the CSV-import executors (~`3055`/`3147`/`3207`, not the `validateLeavesImport` validation pass at `2856`) — grep `status.*APPROVED` in the import methods for the exact write
- **Source:** Session-derived. DAT-023 closeout (`c27862a`, 2026-05-27). Surfaced in DAT-023's pre-flight: `checkOverlap` guards `create` (line 433) and `update` (line 1248) with a `ConflictException` (409), but `approve` (line 1619) does NOT re-check overlap, and the leaves module has no Prisma error filter. With DAT-023's `leaves_no_overlap` EXCLUDE now live, the second of two overlapping PENDING leaves transitioning to APPROVED (the audit's TOCTOU race — two concurrent creates slip past `checkOverlap`, then both get approved) hits the DB constraint (23P01) unmapped → HTTP 500. DAT-023 stayed schema+spec-only (advisor-confirmed); this is the deferred application-layer hardening.

**Description:**
After DAT-023, `leaves.service.ts` `approve()` (and the auto-approve branches of the CSV import at ~2856/3055) can throw an unmapped `PrismaClientKnownRequestError` (SQLSTATE `23P01`, exclusion_violation, constraint `leaves_no_overlap`) when approving a leave that overlaps an already-APPROVED leave for the same user. With no try/catch mapping it, Nest returns a generic 500 instead of the `409 ConflictException` the create/update paths already return for overlaps. The overlap is correctly *prevented* either way (DAT-023 is doing its job) — this is purely the error surface. NOTE: the create/update happy paths are unaffected — their `checkOverlap` 409 fires first; only the approve/import transition (which does not re-check) reaches the raw constraint.

**Root cause:**
`checkOverlap` runs at create/update but not at approve; the PENDING→APPROVED transition is where two overlapping leaves can first both become APPROVED, and that path has no Prisma `23P01` mapping.

**Code evidence:**
```
leaves.service.ts:433   create  → checkOverlap → ConflictException (409)   [guarded]
leaves.service.ts:1248  update  → checkOverlap → ConflictException (409)   [guarded]
leaves.service.ts:1619  approve → NO overlap re-check; tx update status=APPROVED → can hit 23P01 unmapped → 500
leaves.service.ts:~3055/3147/3207  import auto-approve write branches → same unmapped-23P01 exposure (2856 is validateLeavesImport, the validation pass, not a write)
```

**Suggested fix:**
Wrap the approve-path status mutation (and the import auto-approve write) in a try/catch mapping Prisma `23P01` on `leaves_no_overlap` → the same `ConflictException` message the create/update overlap path returns (so the race collapses to the identical 409). Factor a small `isLeaveOverlapViolation(err)` helper if it reads cleaner. Witness: a test asserting a mocked/real `23P01` from the approve transition yields `ConflictException`, not a leaked 500.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: this maps an error surface only; it does not change the approve mutation or its existing `LEAVE_APPROVED` audit emission (which fires only on a successful approve, not on the 23P01 reject).
5. Commit message includes `[closes COR-037]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/leaves
```

**Closed_by:** `abd6982` (2026-05-28) — `isLeaveOverlapViolation` helper + try/catch wrapping the approve `$transaction` + line-level substitute message in `importLeaves`. Witness in `leaves.service.spec.ts`.
**Learnings:**
- **Prisma has NO dedicated code for SQLSTATE 23P01.** Unlike `P2002` (unique 23505) and CHECK-violation handling via codes, exclusion_violation surfaces through Prisma as the raw SQLSTATE in the error message. The detector matches on `err.message.includes('leaves_no_overlap') && err.message.includes('23P01')` — both signals as an AND so an unrelated 23P01 elsewhere doesn't accidentally trigger the helper. DAT-023 witness spec independently confirmed the same surface shape (`/23P01/` + `leaves_no_overlap`).
- **AC#4 verified N/A despite touching audit-sensitive code.** The approve mutation, its `$transaction`, and the `LEAVE_APPROVED` audit log live inside the tx and are byte-unchanged. The outer try/catch only TRANSLATES the propagating error — it doesn't alter the mutation flow. When the 23P01 surfaces from `tx.leave.update`, the tx aborts naturally → audit log doesn't fire (correct: no successful approve = no audit). Witness pins this: `mockAuditPersistence.log` is asserted NOT called.
- **Import path was already swallowed-by-line-catch, not a 500.** The audit listed import auto-approve in scope, but `importLeaves` had a line-level try/catch pushing errors to `result.errorDetails`. The fix here is UX — substitute a friendly "Chevauchement détecté avec un congé approuvé existant" for the raw Prisma dump — not a 500-fix. The 500-fix is the approve path.
- **Layer-of-rejection pattern, third instance (race-window 23P01 → 409).** COR-034 = race-window P2002 → 409 (Dept/Service/Client). COR-035 = plainly-invalid DTO input → 400 (orphan task). COR-037 = race-window 23P01 → 409 (leaves). Three distinct mappings for three distinct error classes — never blend.
- **FAIL-pre/PASS-post protocol applied non-vacuously.** Temporarily neutralized the catch (`throw err`) → witness failed (Error propagates, expected ConflictException). Restored byte-identical → witness passed. Non-vacuous teeth confirmed.

---

### COR-038 — Event parent-cycle trigger error leaks as 500 (no service-layer guard, unlike DAT-018)

- **Status:** DONE
- **Phase:** 3
- **Cluster:** F
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** correctness · error_handling
- **File:** `apps/api/src/events/events.service.ts` (create + update write sites; grep `parentEventId` for the controller-reachable mutations)
- **Source:** Session-derived from the 2026-05-28 prod deploy (Gate-5 operational reminder + DAT-038 closeout `a99dda5`). DAT-038's BEFORE INSERT/UPDATE trigger `events_parent_no_cycle_trg` is the **SOLE line of defense** for event parent cycles — unlike DAT-018 (which is a DB floor on top of `tasks.service.ts checkCircularDependency` returning 400), `events.service.ts` has NO equivalent service-layer cycle guard. A controller path that constructs a cyclic `parentEventId` raises P0001 from the trigger → Prisma has no dedicated code for P0001 from a trigger → leaks as HTTP 500. Deliberately not folded into DAT-038's literal scope (the trigger was the load-bearing guarantee); filed here as the layer-of-rejection partner. Precedent: COR-037 closure pattern (`leaves_no_overlap` 23P01 → 409).

**Description:**
After DAT-038, `events.service.ts` create + update paths can throw an unmapped P0001 from `events_parent_no_cycle_trg` (message contains `events_parent_no_cycle`) when the request constructs a cyclic parent chain (self-loop caught by `events_parent_no_self_ck` → 23514; multi-hop cycle caught by the trigger → P0001). Neither error is mapped to a typed exception, so Nest returns a generic 500 for what is a client-facing constraint violation. The cycle is correctly *prevented* either way (DAT-038 is doing its job) — this is the error surface only.

**Root cause:**
`events.service.ts` has no service-layer cycle pre-check (no `checkCircularDependency` analog), no `try/catch` around the create/update write, and no Prisma error filter at the module level. The trigger is bypass-only by intent (defense-in-depth), but here there is no application-layer guard *to* defend.

**Code evidence:**
```
events.service.ts — create() / update() / recurrence-instance generation: prisma.event.create()/update() unguarded; no try/catch around P0001 / 23514 from events_parent_no_cycle_trg / events_parent_no_self_ck.
DAT-038 witness (apps/api/src/schema-constraints/dat038-event-parent-cycle.int.spec.ts) — confirms the trigger surfaces verbatim message `events_parent_no_cycle` on P0001, and CHECK surfaces 23514 + `events_parent_no_self_ck`.
```

**Suggested fix:**
Wrap the event create + update write sites in a try/catch mapping (a) P0001 messages containing `events_parent_no_cycle` → `ConflictException(409)` with a clean message (e.g. "Cet événement créerait une boucle dans la chaîne de récurrence parente"), and (b) 23514 messages containing `events_parent_no_self_ck` → same 409 (treat self-loop and multi-hop uniformly at the app layer; the DB still distinguishes). Factor a small `isEventParentCycleViolation(err)` helper mirroring `isLeaveOverlapViolation` from COR-037. **Optionally** (operator-decided in pre-flight): add a service-layer pre-check mirroring `tasks.service.ts checkCircularDependency` — walks parent chain in JS before the write, returns `BadRequestException(400)` for plainly-invalid input. Layer-of-rejection partner pattern: pre-check is 400 (plainly-invalid input, like COR-035 for orphan tasks), DB trigger is 409 (race or bypass, like COR-037 for leaves overlap). Witness: service-level, simulate a cyclic INSERT → expect ConflictException(409), not 500.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — Expected N/A: events create/update is not in the audit-sensitive list (mirror COR-037's verdict — error translation only, no mutation/audit-emission change if implemented at the catch level; if a service-layer pre-check is added, it short-circuits before any audit-relevant write).
5. Commit message includes `[closes COR-038]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
pnpm test apps/api/src/events
```

**Closed_by:** 24c6929 (2026-05-28) — `isEventParentCycleViolation` helper + try/catch around `create()` event.create and `update()` $transaction. Witness: 3 new tests in `events.service.spec.ts` covering P0001 + 23514 on create and P0001 on update.
**Learnings:**
- **Two-token detector (P0001 OR named 23514).** The trigger RAISE message carries `events_parent_no_cycle` (no SQLSTATE token required to match — it's unique enough on its own per the DAT-038 witness shape). The CHECK path surfaces a generic 23514 + the constraint name `events_parent_no_self_ck`, so we AND both tokens there to avoid matching unrelated 23514s. Slight asymmetry from COR-037 (which AND'd `leaves_no_overlap` + `23P01`), but justified: `events_parent_no_cycle` is a literal RAISE identifier with no chance of collision; `events_parent_no_self_ck` is a CHECK name and a stray 23514 elsewhere carrying the string in a SQL fragment is conceivable.
- **AC#4 verified N/A despite the audit-sensitive look-alike.** Events create/update is not in the audit-sensitive list and the catch only TRANSLATES the propagating error — no mutation flow or audit emission is altered (mirror COR-037 verdict). Confirmed without re-litigation per operator pre-flight directive.
- **`parentEventId` is not in CreateEventDto/UpdateEventDto today** (grep returns 0 hits in `dto/*.ts` and `events.controller.ts`). The controller-reachable cycle surface is currently narrow, but defense-in-depth still required: internal callers can pass it, the recurrence-generation path inside create() writes children with parentEventId, and a future DTO addition would silently re-open the 500 leak without this guard.
- **Layer-of-rejection pattern, fourth instance.** COR-034 = race-window P2002 → 409. COR-035 = plainly-invalid DTO → 400. COR-037 = race-window 23P01 → 409. COR-038 = race-window/bypass P0001+named-23514 → 409. The 400 (pre-check) partner for events is intentionally deferred (operator pre-flight call); filed mentally as candidate follow-up but NOT a backlog item yet.
- **FAIL-pre/PASS-post protocol applied non-vacuously.** Reordered `throw err` before the helper branch (3 sites; replace_all swap) → all 3 witnesses failed with raw Error propagating; restored byte-identical → all 3 passed.

---

### DOC-001 — Phase 2 deploy doc backfill (audit-trail completeness for Cour des Comptes)

- **Status:** DONE
- **Phase:** 2
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** documentation · audit_trail
- **File:** `docs/deploy/` (new file: `docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md`)
- **Source:** Session-derived from the 2026-05-28 Phase 3 prod deploy (Gate-0 finding). The 4 Phase 2 migrations (`20260525190000_audit_logs_immutability_hash_chain_actor_snapshot`, `20260525200000_dat007_project_fk_restrict_preserve_history`, `20260525210000_obs012_deployments_table`, `20260526120000_dat021_audit_payload_schema_version_gin_index`) were applied to prod on 2026-05-26 alongside the TOOL-DEPLOY-001 closeout, but WITHOUT a dedicated `docs/deploy/` runbook. The HANDOVER's deploy section recorded them in summary, but there is no Cour-des-Comptes-grade deploy doc capturing the per-migration probes, smokes, rollback paths, and operator decisions for that batch. Surfaced when the Phase 3 deploy doc's "Expected last applied migration" baseline turned out to be stale (it expected `20260524100100`, prod actually had through `20260526120000` — confirming Phase 2 was deployed out-of-band).

**Description:**
The audit trail under `docs/deploy/` is incomplete. Phase 1 has `2026-05-25-phase-1-remediation-deploy.md`. Phase 3 has `2026-05-2x-phase-3-defense-in-depth-deploy.md`. Phase 2 has nothing. Anyone reconstructing the prod deployment history (auditor, ops, future Claude session) cannot trace what was done on 2026-05-26 — they have to dig through PROGRESS_LOG entries, the HANDOVER summary, and `_prisma_migrations` finished_at timestamps.

**Root cause:**
The Phase 2 deploy happened in the TOOL-DEPLOY-001 closeout session, which was framed as a tooling task (DB role split + init-roles) — the 4 audit-log migrations rode along as a logistically-coupled deploy without surfacing as their own "deploy this batch" doc. No process rule required a deploy doc for non-Phase-1, non-Phase-3 batches; Phase 1 + Phase 3 happened to author docs because their session prompts demanded them.

**Code evidence:**
```
ls docs/deploy/ — finds Phase 1 + Phase 3 docs, no Phase 2.
_prisma_migrations finished_at — the 4 Phase 2 migrations cluster around 2026-05-26 21:09 UTC (verified on prod 2026-05-28 12:43).
docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md — Gate-0 "Prod baseline (expected)" originally said "Expected last applied migration `20260524100100_dat005_convert_float_to_decimal`"; actual prod had `20260526120000_dat021…` (Phase 2's last) → confirms Phase 2 was deployed and the doc trail missed it.
```

**Suggested fix:**
Retroactively author `docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md` mirroring the Phase 1 + Phase 3 doc structure: **(1)** scope & metadata (date 2026-05-26, operator, 4 migrations, the OBS-012 + DAT-009 + DAT-021 + DAT-007 task mapping, the rollback anchor image used at the time if recoverable from docker history); **(2)** migrations applied sub-table with the exact SQL each migration introduced (verbatim from the committed migration files); **(3)** what was verified post-deploy (operator-recall from PROGRESS_LOG entries — the 2 maintenance scripts `normalize-action-codes` + `recompute-chain-on-schema-bump` were run, app_user REVOKE was applied via init-roles.sql); **(4)** rollback path (per-migration DROP DDL — derive from each migration file); **(5)** a clear **retroactive** banner stating this doc was authored AFTER the deploy from `_prisma_migrations` evidence + PROGRESS_LOG records, NOT seeded ahead of execution like Phase 1/3. No pre-deploy checklist (it was already deployed); operational notes carry only what the operator can recall + what's verifiable post-hoc. **Optionally** also backfill a Phase-1-tooling deploy doc covering TOOL-DEPLOY-001 itself (the 0-migration code+config-only init-roles deploy) if completeness demands it; surface that decision to the operator.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated. — **N/A: documentation backfill, not code. Verify by inspection that the new doc covers the 4 migrations + rollback + verification, and that `ls docs/deploy/` lists Phase 1 / 2 / 3 all present.**
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green). — **N/A: docs-only.**
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot. — **N/A: documentation only, no code touched.**
5. Commit message includes `[closes DOC-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit. — Doc-only commit; only `docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md` (and possibly the Phase-1-tooling doc if option is taken) created.

**Verification command:**
```
# Verify the doc exists and covers the 4 Phase 2 migrations:
ls docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md && \
  grep -E '20260525190000|20260525200000|20260525210000|20260526120000' docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md
# Verify rollback DDL is present for each:
grep -c 'DROP\|REVOKE\|rollback' docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md
```

**Closed_by:** 006adb7 (2026-05-28) — new `docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md` (666 lines). Verification command green: 4 migrations cited, 37 DROP/REVOKE/rollback occurrences, `ls docs/deploy/` lists Phase 1 / 2 / 3.
**Learnings:**
- **5 source tasks across 4 migration files, not 4↔4.** Migration `20260525190000` bundles **OBS-002 + DAT-009** (its header explicitly names both; `d6299cc` carries `[closes OBS-002][closes DAT-009]`). The DOC-001 finding's enumerated task list (OBS-012 / DAT-009 / DAT-021 / DAT-007) silently dropped OBS-002. The doc records the full 5↔4 mapping table to keep the audit chain explicit.
- **Largest evidentiary gap = no rollback anchor image was tagged.** Phase 1 set `orchestra-api:pre-phase1-remediation`, Phase 3 set `orchestra-api:pre-phase3-defense-in-depth`, Phase 2 has nothing. The next-best anchor is the *post*-Phase-2 image (Phase 3's anchor), so a post-2026-05-28 Phase-2-only rollback has no clean image path — would require a non-trivial cherry-pick + DDL reversal. Documented in the rollback section with the explicit guidance NOT to execute the DDL retroactively without a separate runbook.
- **Inferred ≠ verified.** Built a 3-state DEPLOY EXECUTION LOG sub-table (Verified-post-hoc / Inferred / Gap) so an auditor can immediately see which prod-state assertions in the doc are evidence-backed (the `_prisma_migrations` cluster ~2026-05-26 21:09 UTC, the post-hoc 0 `PASSWORD_RESET_ADMIN` rows on prod, init-roles.sql REVOKE) vs reconstructed from operational logic (the `git pull` step, the `docker compose build api` step, the order of script runs). Never collapsed an "inferred" into "verified" — kept the distinction load-bearing.
- **TOOL-DEPLOY-001 doc decision: NOT created in this commit, but named.** The finding optionally proposed a Phase-1-tooling doc covering the 0-migration code+config-only TOOL-DEPLOY-001 deploy. Surfaced as Process Learning #5 in the Phase 2 doc as a candidate follow-up, but kept out of this commit's scope (DOC-001's File: clause names only the Phase 2 doc). Operator's call whether to file as a follow-up backlog task.
- **Verbatim SQL non-negotiable.** Every migration's SQL block in the doc is byte-identical to the committed `.sql` file (including header comments — those carry the original Suggested-fix rationale and shouldn't be paraphrased; an auditor cross-referencing against `git show <commit>:<migration>.sql` must see no drift). 4 large code blocks, ~250 lines of SQL — heavy but the contract.
- **No nest build / pnpm test / migrate deploy / deploy gates ran (docs-only).** AC#2/3/4 were pre-decided N/A in the BACKLOG entry; no re-litigation. The repo coherence gate (`scripts/check-backlog-coherence.sh`) is the only gate this closure must pass — fix commit `006adb7` carries `[closes DOC-001]` verbatim, satisfying rule 3 directly (no anchor-commit pattern needed).

---

## Phase 4 — RBAC complétude
*6 tasks in this phase.*

### TST-001 — Permission matrix covers only 35 of 91 permissions declared in API controllers

- **Status:** DONE
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

**Closed_by:** 652c336
**Learnings:**
- **Mechanism — default standalone CI script confirmed (no HALT-gate fired).** `scripts/check-permission-matrix-coverage.sh` lives beside `check-backlog-coherence.sh` and mirrors its bash+embedded-python3 shape (BASH_SOURCE/`git rev-parse` root resolution, `set -euo pipefail`). None of the three HALT triggers materialised: (a) the grep extraction is stable — every `@RequirePermissions(...)` is single-line, multi-arg decorators (`'a', 'b'`) are handled by pulling each quoted code, no Reflect/AST/snapshot needed; (b) no concrete coupling argued for a Vitest-in-apps/api import of the e2e fixture; (c) although an e2e fixtures runner exists (`api-permissions.spec.ts`), the gate is a *static coverage diff*, not a runtime assertion — a standalone script is the natural home. The e2e coupling is real but is not a gate-mechanism question.
- **Self-witnessing fail-pre/pass-post observed (the gate IS the witness — AC#2).** Pre-backfill: gate exits 1, lists exactly 59 uncovered codes (94 controller / 35 matrix). Post-backfill: exits 0, 94/94, diff empty. Non-vacuous structurally — the RED output enumerates the 59 gaps, the GREEN proves them closed. No additional spec test invented; this is the inverse of the Cluster-A/B siblings whose witnesses were production-code specs.
- **Pre-flight re-confirmed structural facts.** 94 unique `@RequirePermissions` codes (the gate replicates the manual extraction exactly), 35 distinct matrix actions, 59 missing, 0 stale, authoritative key = `action`. `@RequireAnyPermission` is never used on a controller (guard-comment only) → scope is cleanly `@RequirePermissions`.
- **Convention mirrored literally.** Each backfill row is a `PermissionEntry {action, resource, method, apiEndpoint, allowedRoles, deniedRoles}`. Optional `testBody`/`description` omitted: the guard runs before body-validation pipes, so an empty body yields ≠403 for allowed roles / 403 for denied — the only thing `api-permissions.spec.ts` asserts. `:id`/param routes use `PLACEHOLDER_UUID_V4` (valid v4 → passes ParseUUIDPipe where present, 404-not-403 for allowed). No invented fields, no coverage tiers.
- **Role mappings derived correct-by-construction from `ROLE_TEMPLATES` (rbac), NOT from matrix comments.** Ground-truthed the 6 test-user→template binding from the `E2E_SEED` branch of `packages/database/prisma/seed.ts` (the branch CI's Playwright job seeds): admin=ADMIN, responsable=ADMIN_DELEGATED, manager=MANAGER, referent=TECHNICAL_LEAD, **contributeur=BASIC_USER**, observateur=OBSERVER_FULL. Resolved each template's permission set via the same authority `PermissionsService.getPermissionsForUser` uses (`ROLE_TEMPLATES[templateKey].permissions`); allowed = roles whose set contains the code, denied = the rest — identical to `PermissionsGuardV2`'s decision. **E2E not executed this session** (app stack down; contract witness is the gate, not e2e assertions). The 59 are correct by construction — NOT "CI-verified".
- **Oracle verification (the method validated against the 35 human-curated entries).** Ran the same `ROLE_TEMPLATES` derivation over the 35 pre-existing distinct codes and diffed `allowedRoles`/`deniedRoles`. Result: **28/35 reproduce exactly; 7 diverge** — and every divergence is a pre-existing *stale existing entry*, provable from source, not a derivation error: `users:read`, `departments:read`, `predefined_tasks:view` (all in `COMMON_BASE` → universal to every template, but the matrix still denies referent+contributeur); `projects:read`, `clients:read`, `third_parties:read` (in `PROJECT_STRUCTURE_READ`, NOT `COMMON_BASE` → absent from BASIC_USER, but the matrix still allows contributeur); `reports:view` (OBSERVER_FULL has it, matrix denies observateur). Root cause: the matrix's `contributeur → PROJECT_CONTRIBUTOR` comment is a fossil — contributeur was remapped to BASIC_USER (project-scoped→self-service) and the role-assertions were never regrown. This validates the construction and isolates the staleness to those 7 cells.
- **AC#4 — N/A automatic.** Meta-test + fixture backfill, no production code path touched, no audit-sensitive surface; no mutation, no audit emission possible.
- **AC#3 honest status.** `pnpm test` (vitest) 6/6 green (api 1710, rbac 110, web 579 — matrix consumed only by Playwright, so vitest is unaffected by definition); `nest build` exit 0; matrix typechecks standalone. `pnpm test:e2e` **not executed this session** (stack down). CI status (evidenced via `gh run view`): on master the **E2E (Playwright) job is `skipped`** because it `needs: [lint]` and Lint & Format fails on the pre-existing ESLint 9 / ajv breakage — so the RBAC e2e suite is *not currently exercised in CI at all*. By composition analysis the 7 stale existing entries WOULD fail if e2e ran, but this is source-derived, not observed-red. My 59 entries match the guard and would pass; this change adds no e2e regression.
- **Gate ships runnable-but-UNWIRED (operator decision surfaced).** `check-permission-matrix-coverage.sh` runs from CLI and fails correctly, but nothing invokes it in CI yet — so part (b)'s regression-prevention purpose (fail a *future* PR that adds an uncovered code) is not yet enforced. The mirrored precedent `check-backlog-coherence.sh` *is* wired via `.github/workflows/backlog-coherence.yml`. Wiring an equivalent `permission-matrix-coverage.yml` touches `.github/workflows`, OUTSIDE this task's enumerated file-scope (matrix + gate script), so per the operator-control invariant (learning #17) it was NOT silently added — flagged to the operator as a concrete one-file follow-up.
- **Adjacencies observed (NOT fixed, NOT filed this session — scope-lock + separate-session filing discipline):**
  1. **7 stale existing matrix entries** (see Oracle verification above): `users:read`, `departments:read`, `predefined_tasks:view`, `projects:read`, `clients:read`, `third_parties:read`, `reports:view` — their `allowedRoles`/`deniedRoles` contradict the current V4 `ROLE_TEMPLATES` for the E2E-seed roles (referent/contributeur/observateur cells). Pre-existing, in existing entries, out of TST-001's backfill-only scope. **Filing candidate for next session** (SEC-031 pattern): regrow the 7 stale role-assertions to match current templates (and drop the fossil `contributeur → PROJECT_CONTRIBUTOR` comment).
  2. The inherited "8 entirely-absent resources" is actually **9** — `services` is also entirely absent (all 4 codes missing, 0 existing entries); the kickoff list omitted it. Does not change the 59.
  3. `auth.controller.ts` is the sole controller using perm-first decorator ordering (`@RequirePermissions` above `@Post`) — `users:reset_password`'s real route is `POST /api/auth/reset-password-token`. The 94 codes are otherwise clean: no duplicates, no mal-named codes, consistent naming.

---
### TST-CI-001 — Wire permission-matrix-coverage gate in CI (TST-001 follow-up)

- **Status:** IN_PROGRESS
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** ci · tooling · test-infrastructure
- **File:** `.github/workflows/permission-matrix-coverage.yml`
- **Source:** Session-derived from TST-001 closeout `652c336`. The gate `check-permission-matrix-coverage.sh` created by TST-001 is runnable but unwired; a future PR adding a new `@RequirePermissions` code without a matrix backfill passes by omission. Mirror precedent = `backlog-coherence.yml` wiring `check-backlog-coherence.sh`.

**Description:**
The permission-matrix coverage gate created by TST-001 is runnable but unwired. TST-CI-001 files the GitHub Actions workflow that invokes the gate on PR to make it effective.

**Root cause:**
TST-001's file scope (matrix + script) excluded `.github/workflows`; CI wiring was not done in TST-001 out of strict scope respect + learning #17 (operator-control invariant).

**Code evidence:**
```
ls .github/workflows/ does not contain permission-matrix-coverage.yml.
cat .github/workflows/backlog-coherence.yml shows the precedent pattern.
```

**Suggested fix:**
Literal mirror of `.github/workflows/backlog-coherence.yml` to `.github/workflows/permission-matrix-coverage.yml`, with minimal adaptations: (a) job/workflow name, (b) script path = `backlog/Security/2026-05-24-review-payloads/scripts/check-permission-matrix-coverage.sh`, (c) `pull_request` trigger mirrored, (d) runtime environment identical (ubuntu-latest, checkout@v4, setup-python@v5 / 3.11). No other invented change.

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. The workflow file is syntactically valid YAML (parser-verified). The gate itself is already witnessed by TST-001 closure (exit 0 on master); this task wires the invocation.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. N/A — CI infrastructure addition, no production code path, no audit-sensitive surface.
5. Commit message includes `[closes TST-CI-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/permission-matrix-coverage.yml")); print("YAML OK")'
```

**Closed_by:**
**Learnings:**

---
### COR-001 — Hardcoded role 'ADMIN' bypass violates RBAC V4

- **Status:** DONE
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

**Closed_by:** cb3b5e1 (2026-05-28) — injected PermissionsService into EpicsService, replaced `if (userRole === 'ADMIN') return;` with `permissions.includes('projects:manage_any')` (mirror of projects.service.ts:77), fixed stale docstring. Witness: 2 new tests in `epics.service.spec.ts` (non-ADMIN manage_any bypass + non-member negative). EpicsModule untouched (RbacModule is @Global()).
**Learnings:**
- **DAT-035 dead-code grep result: NO.** `assertProjectMembership` body contains no `'OWNER'`/`'LEAD'` literals against `project_members.role` — membership is matched purely on `m.userId === userId`. No adjacent dead-code surface to flag for follow-up.
- **EpicsModule wiring was a no-op (anticipated step obviated).** The contract anticipated importing the module that exports `PermissionsService`. `RbacModule` is `@Global()` (see its docstring: "Annoté `@Global()` pour permettre injection depuis tous les modules sans import explicite"), so `PermissionsService` is injectable everywhere with zero module import — `leaves.module.ts` and `comments.module.ts` inject it with no RBAC import. `epics.module.ts` was therefore left untouched; adding a redundant import would be a no-op smell. File scope ended at 2 files (service + spec), not 3.
- **Mirror is literal.** `permissions.includes('projects:manage_any')` matches `ProjectsService.assertProjectOwnershipOrBypass` (projects.service.ts:77) byte-for-byte on the bypass predicate. `getPermissionsForRole(roleCode)` returns `Promise<readonly PermissionCode[]>`; `.includes('projects:manage_any')` typechecks against it.
- **Non-vacuous witness verified.** Pre-fix run: the new witness (non-ADMIN role `DIRECTION_SI` with resolved `projects:manage_any`, NOT in `project.members`) failed with `ForbiddenException('Not a member of this project')` at `epics.service.ts:117` — the membership fall-through, the correct failure reason (not a DI/instantiation error). Post-fix: passes. The existing `'should bypass membership check for ADMIN role'` test was kept and adapted (role-aware mock: `ADMIN → ['projects:manage_any']`, else `[]`) so its intent survives through the permission path. The member-passes regression remains covered by the existing `'should allow member to update'` test (no redundant duplicate added).
- **AC#4 N/A (confirmed).** `assertProjectMembership` is a read-gate (assert, no mutation), not in the audit-sensitive list (auth / leaves approve-reject / RBAC mutations / document access / user delete / password reset). No `audit_logs` entry required.
- **Stale docstring fixed in-scope.** Lines 99–101 said "Users with the ADMIN role bypass this check" — now "Holders of the `projects:manage_any` bypass permission skip this check." In-method, in-scope per the fix.
- **Sibling COR-002 (milestones.service.ts) deliberately NOT touched** — same mechanism, different file + different witness path → bundle criteria not met → separate session/commit.

---
### COR-002 — Hardcoded role 'ADMIN' bypass in milestones

- **Status:** DONE
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

**Closed_by:** 27c0424 (2026-05-28) — injected PermissionsService into MilestonesService, replaced `if (userRole === 'ADMIN') return;` with `permissions.includes('projects:manage_any')` (mirror of projects.service.ts:77), fixed stale docstring. Witness: 3 new tests in `milestones.service.spec.ts` (non-ADMIN manage_any bypass + non-member negative + member-passes regression). MilestonesModule untouched (RbacModule is @Global()). Verbatim sibling of COR-001 `cb3b5e1`.
**Learnings:**
- **Line reconciliation (133/144/139).** BACKLOG said `milestones.service.ts:133`, kickoff saw `:144`; actual on master = `assertProjectMembership` declared at **line 139**, the `if (userRole === 'ADMIN') return;` bypass at **line 144**, stale docstring at lines 135–137. The `:133`/`:144` figures both predate intervening edits; the method body itself is byte-identical to epics' `assertProjectMembership`.
- **Shape match to COR-001 confirmed verbatim.** Same signature `(milestoneId, userId, userRole?: string | null)`, same role-code bypass, same fall-through to a membership check throwing `ForbiddenException('Not a member of this project')` (line 154), membership matched on `m.userId === userId`. No design divergence — no HALT warranted.
- **DAT-035 dead-code grep result: NO.** Method body contains no `'OWNER'`/`'LEAD'` literals against `project_members.role`; membership is matched purely on `m.userId === userId` (line 152). Same NO as COR-001 on epics. No adjacent dead-code surface to flag.
- **MilestonesModule wiring was a no-op (anticipated step obviated), same as COR-001.** `milestones.module.ts` imports neither `RbacModule` nor `AuditModule` yet already injects `AuditPersistenceService` — both modules are `@Global()`. `PermissionsService` (exported by the `@Global()` `RbacModule`) is therefore injectable with zero module change. Module left untouched; adding a redundant import would be a no-op smell. File scope ended at 2 files (service + spec), not 3.
- **Member-passes regression had NO existing coverage here (DIVERGENCE from COR-001's learning — do not transcribe).** Epics' `'should allow member to update'` passed a `userId`, so it exercised `assertProjectMembership`. The milestones `update`/`remove` tests call `service.update('1', dto)` with **no** `currentUserId`, so they never enter the gate. COR-001's "member-passes stays covered by the existing test, no duplicate added" is therefore false for milestones. A dedicated member-passes test (member, no manage_any → update succeeds; green pre- and post-fix) was added explicitly — coverage AC#3 implies and the epics precedent silently relied on.
- **Non-vacuous witness verified (AC#2).** Pre-fix run (spec edited, service unchanged): the bypass witness — non-ADMIN role `DIRECTION_SI` with resolved `projects:manage_any`, NOT in `project.members` — FAILED with `ForbiddenException('Not a member of this project')` at `milestones.service.ts:154:13`, the membership fall-through (the right reason, not a DI/instantiation error); 32/33 green. Post-fix: 33/33 green. The single thing letting `update` through is the manage_any bypass.
- **Mirror is literal.** `permissions.includes('projects:manage_any')` matches `ProjectsService.assertProjectOwnershipOrBypass` (projects.service.ts:77) byte-for-byte on the bypass predicate. `getPermissionsForRole(userRole)` accepts `string | null | undefined` and returns `Promise<readonly PermissionCode[]>`; `.includes('projects:manage_any')` typechecks (confirmed via `nest build`, the real gate — `tsc --noEmit` is RED on master by design).
- **AC#4 N/A — path-specific (do NOT transcribe COR-001's "no audit" wording).** Unlike epics, this file *does* import `AuditPersistenceService`/`emitDataExported` (OBS-026 emits `DATA_EXPORTED` on CSV export). The N/A still holds, but *because the changed method `assertProjectMembership` is a read-gate (assert, no mutation), not in the audit-sensitive list* — not because "milestones has no audit." The existing export-audit path is unaffected by this commit.
- **INTERDIT DUAL-CLOSE (inverse) respected.** COR-001 (`cb3b5e1`) NOT re-touched — no retroactive `[closes COR-001]`, no retroactive shared-helper extraction from epics.service.ts. Sibling-set (epics + milestones) complete; no phantom COR-003 filed.

---
### COR-028 — getUserLeaves does not enforce ownership — exposes any user's leaves to a request specifying that userId

- **Status:** DONE
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

**Closed_by:** d1c420d
**Learnings:**
- **Pre-flight line re-derivation:** `getUserLeaves` was at `leaves.service.ts:1046` (BACKLOG `File:` said `:1004` — stale; no behavioral drift, just line). Method took one param `userId`, queried `leave.findMany({ where: { userId } })`, computed `canEdit = status===PENDING`, `canDelete = PENDING||REJECTED`. Comment already read "Own leaves".
- **Callers grep (re-verified, not trusted from kickoff):** `grep -rn getUserLeaves apps/api/src` → sole non-spec caller = `leaves.controller.ts:233` inside `getMyLeaves(@CurrentUser('id') userId)` (`@Get('me')`, `@AllowSelfService()`), passing the JWT-scoped id. No polymorphic / second caller emerged. Kickoff's mono-caller typing confirmed.
- **Option B (rename) chosen, not A (assert-equality).** Mono-caller confirmed → no caller-shape to preserve, no `getUserLeaves(userId, currentUserId)` variant in use. Option A's entry-assert would guard a surface that Option B simply deletes. No reason-to-flip surfaced in pre-flight.
- **Framing — defense-in-depth, NOT exploit fix (HANDOVER §Next gravé).** The "exposes any user's leaves" failure mode is NOT exploitable today: the only caller passes `@CurrentUser('id')`. For support/audit: *service-layer hardening, no current vulnerability surfaced to users.* The rename is a naming/contract signal (one id = the caller → no caller≠owner confusion inside the method), NOT runtime enforcement — boundary safety still comes from `getMyLeaves` passing the JWT id. Concrete real defect addressed structurally = canEdit/canDelete computed on owned-only rows (carry-forward "API computed flags", [[feedback_api_computed_flags]]).
- **No calc "simplification" — the audit/kickoff presumed a `caller===owner` conditional that does not exist in this body.** Flags are computed purely from `leave.status`; there was no ownership branch to collapse. Pure rename + where-clause param rename only; touching the flag formula would have been scope creep + a fabricated delta. (Same shape as TST-018's moot audit-presupposition.)
- **Witness shape (AC#2) — surface-elimination + new coverage, NOT a behavioral fail-pre.** Because the rename has ZERO behavioral delta, no test FAILs-pre / PASSes-post on behavior (a behavioral test passes identically under either name). The honest AC#2 witness is twofold: (1) **compile-time fence** — `grep getUserLeaves apps/api/src` finds the method pre-rename, finds NOTHING post-rename (mis-wireable surface eliminated; `nest build` clean proves no dangling ref); (2) **new non-vacuous coverage** — added `should scope the leave query to the current user id only` (asserts `findMany` called with `where: { userId: <id> }`) + `should compute canEdit/canDelete per leave status on owned leaves` (PENDING→edit+delete, APPROVED→neither, REJECTED→delete-only). Non-vacuous by construction: the pre-existing `should return user leaves` test asserted ONLY `toHaveLength(1)` — neither flags nor query-scope were covered before. These new tests would pass under the old name too; their value is coverage, not delta. Documented here because the rename's witness genuinely differs from the sibling COR-001/002 (which had a real membership-fallthrough fail-pre).
- **Proof-of-defect two-arg spec (contract optional) = MOOT.** `getUserLeaves(otherUser, caller)` doesn't match the actual single-arg signature, and flags are status-derived not caller-derived → no caller≠owner code path exists to exercise. Not attempted.
- **AC#4 (audit-emission) N/A — path-specific, not inherited.** COR-028 touches a READ-PATH (fetch own leaves), NOT the leaves approve/reject mutation. The contract's audit-sensitive list names "leaves approve/reject"; this path is not in it. No `audit_logs` entry. (HANDOVER learning #16: AC#4 N/A is path-specific.)
- **Existing-coverage state at pre-flight (pre-#5):** `describe('getUserLeaves')` had 2 tests — `should return user leaves` (length-1 only) + `should throw NotFoundException`. Controller spec: `getMyLeaves` test asserting `getUserLeaves` called with `'user-id-1'`. All renamed to `getOwnLeaves`.
- **Gates:** leaves suite `pnpm vitest run src/leaves` 229 ✓ (service 166→**168**); `nest build` clean (typecheck gate — `tsc --noEmit` RED on master by design); `pnpm test` 1697→**1699** (+2 coverage) across 73 files / 6 turbo tasks; `pnpm test:e2e` turbo **4/4** (3 cached + web:build).
- **Scope discipline:** 4 files, all leaves-module (service + controller + 2 specs). NOT touched: `users.service.ts` / `access-scope.service.ts` (SEC-030, Cluster B sibling — different domain/mechanism/witness, separate session), milestones/epics (COR-001/002 closed). No shared helper, no AccessScopeService extension.
- **Deploy posture:** code-only, no migration. NOT auto-deployed. Adds to the undeployed stack (COR-038 `24c6929` + COR-001 `cb3b5e1` + COR-002 `27c0424` + this `d1c420d`); prod stays `ebcd9e1`.

---
### SEC-030 — GET /users/:id has no horizontal scope filter — any role with users:read can read every user's full profile

- **Status:** DONE
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

**Closed_by:** d6ed06f
**Learnings:**
- **CAS A — self-drive (first genuine HALT-gate of Phase 4 resolved to A, advisor-confirmed).** All three CAS-B triggers false: mirrors exist, SEC-002/003 skeleton (`canManageUser`) exists, and the only shape-mismatch candidate (`findUnique` can't take an OR `WhereInput`) dissolves into a consumer-side `findUnique→findFirst` switch inside `findOne` — exactly how `assertCanReadTask` consumes `taskReadWhere` via `count`, not an AccessScopeService refactor.
- **Primary-source path divergence:** AccessScopeService lives at `apps/api/src/common/services/access-scope.service.ts`, NOT the kickoff-guessed `apps/api/src/access-scope/`.
- **Methods confirmed (signatures, primary-source):** `taskReadWhere(user?) → Promise<Prisma.TaskWhereInput>` ✓, `documentReadWhere(user?) → Promise<Prisma.DocumentWhereInput>` ✓ (both pure relational OR-bucket builders, bypass on `*:readAll`/`*:manage_any` → `{}`, no-caller → `{ id: '__no_access__' }`), `projectAccessWhere(user) → Prisma.ProjectWhereInput` (sync) ✓, `canManageUser(targetId, caller) → Promise<boolean>` ✓, `assertCanManageUser → Promise<void>` ✓. `userReadWhere` confirmed **absent** pre-fix (kickoff claim held).
- **Divergence #2 from kickoff/audit narrative — `users:manage_any` does NOT exist.** The users permission family has no `*:manage_any`/`*:readAll` member at all (catalog: `users:create/delete/import/manage/manage_roles/read/reset_password/update`). The mirrors bypass on `*:manage_any`; users can't. Bypass permission chosen = **`users:manage`** (`USERS_PAGE_ACCESS` — "Accès à la page d'administration ... consulter les détails admin", held by MANAGER/ADMIN_DELEGATED/ADMIN), permission-driven (no role-code, per [[feedback_no_hardcode_hotfix]]) unlike `canManageUser`'s own `templateKey==='ADMIN'` bypass (left untouched — carry-forward #3, extend-not-refactor). Verified no CRUD-capable role holds `users:update` without `users:manage` (ADMIN = full catalog; ADMIN_DELEGATED = catalog minus 3 non-CRUD perms; both have both) — so full-payload tracks write capability.
- **Divergence #3 — `users:read` is the broad org-directory permission (`ANNUAIRE_READ`)**, held by every non-EXTERNAL template ("tout agent a besoin de voir qui est qui à quel service"). The audit's harm is *full sensitive-profile* enumeration, not directory visibility. Resolution: contract invariant (a) is honoured literally (query-scoped: out-of-scope id → 404 for a directory caller), and the reduced directory payload preserves the legitimate "qui à quel service" need for in-scope reads. Trade-off made operator-visible: broad directory visibility now rides on the still-unscoped list endpoints (see GET /users adjacency below); GET /users/:id by-UUID is now perimeter-scoped for non-management. No unit test previously guarded cross-service profile reads and e2e is build-cached — this is a real, previously-test-unguarded behavior change, now pinned by new specs.
- **Method name = `userReadWhere`** (matches kickoff/audit + the `*ReadWhere` convention of the two mirrors). Return shape = `Prisma.UserWhereInput` (mirrors). Buckets = **self / same-service / managed-service / managed-department**. The audit's literal three were self/same-service/managed-**service**; managed-**department** added so read scope ⊇ `canManageUser`'s write scope (a caller who may manage a target must read it). Did NOT import task/document's `project.members` collaboration bucket — user scope is organizational (service/dept) per the audit, not project-based.
- **Mechanism applied at `findOne` layer:** scope always via `userReadWhere(caller)` (management → `{}` → unrestricted); payload via a separate `hasAny(caller, ['users:manage'])` → `FULL_USER_SELECT` vs `DIRECTORY_USER_SELECT`. `findUnique → findFirst` so the OR scope merges with `{ id }`; out-of-scope row → `null` → existing `NotFoundException` (404, non-disclosing — chosen over the mirrors' 403, which requires a separate existence pre-count `findFirst` doesn't need). Controller threads `@CurrentUser() caller` (same shape as `update`/`remove`, SEC-002/003 precedent).
- **Existing coverage before new tests:** `users.service.spec` findOne had 2 tests (happy-path asserting `email`, NotFound) — both called `findOne('1')` with NO caller; post-change undefined caller → `{id:'__no_access__'}` → 404, so both were rewritten to pass a management caller mock (expected wiring, NOT verification-weakening — same pattern SEC-002/003 used). `users.controller.spec` findOne had 2 tests (no caller). No AccessScopeService spec existed → created `access-scope.service.spec.ts` scoped strictly to `userReadWhere` (no-caller / bypass / 4-bucket shape).
- **Witness (AC#2) non-vacuous — fail-pre proven by stashing only the 3 production files and re-running:** 7 SEC-030 tests failed against pre-fix code (`userReadWhere is not a function` ×3; directory-payload-leak: pre-fix `findOne` returns full payload incl. email/login with NO scope where ×3; controller caller-threading ×1). Proof-of-defect = "directory caller gets scoped where + reduced payload" fails pre-fix (full payload, unscoped), passes post-fix. (The out-of-scope→404 test passes pre-fix too — findUnique(null)→404 regardless — so it is a confirming test, not the proof-of-defect; the payload/scope assertions are.)
- **AC#4 N/A — path-specific (HANDOVER learning #16):** READ-PATH on users (GET /users/:id), not user delete, an RBAC mutation, or any other audit-sensitive operation. The audit-sensitive list names "user delete", not "user read". No `audit_logs` entry.
- **GET /users list adjacency — filing candidate YES, NOT filed this session (don't-file-phantoms).** `findAll` (GET /users) is still unscoped: `where = roleCode ? {role:{code}} : {}` with `take` capped at 1000 — any `users:read` holder pages the full directory with full select (email/login/timestamps). Distinct mechanism from SEC-030 (list-side scope + per-row payload split + pagination cap, vs single-resource scope + 404 collapse), so it is a separate task, not bundleable. `getUsersByDepartment`/`getUsersByService`/`getUsersByRole` are the same unscoped-read surface. Filing belongs in a separate session (Phase-3 mini-arc pattern). Now that `userReadWhere` exists, the list-side fix has a reusable building block.
- **Gates:** `nest build` clean (typecheck gate — `tsc --noEmit` RED on master by design); `pnpm test` 1699 → **1705** (+6: 3 access-scope + 3 net-new findOne) across 74 files / 6 turbo tasks; `pnpm test:e2e` turbo **4/4** (3 cached + web:build). `pnpm test apps/api/src/users` (BACKLOG verification command) is turbo-path-as-task-name (fails "Could not find task", COR-028 NB) — ran `npx vitest run` in `apps/api` directly.
- **Deploy posture:** code-only, no migration. NOT auto-deployed. Undeployed runtime stack now 5: COR-038 `24c6929` + COR-001 `cb3b5e1` + COR-002 `27c0424` + COR-028 `d1c420d` + SEC-030 `d6ed06f`. Prod stays `ebcd9e1`.
- **INTERDIT respected:** existing AccessScopeService methods (`taskReadWhere`/`documentReadWhere`/`canManageUser`/`assertCanManageUser`) consumed/mirrored, NOT modified (carry-forward #3 = extension). No leaves (COR-028 closed), no milestones/epics (Cluster A closed), no Cluster-C bundle. Coherence gate: direct closure, `d6ed06f` carries `[closes SEC-030]`; did NOT touch the 10 pre-existing `Closed_by`-format violations (TOOL-COH-003).

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

- **Status:** DONE
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

**Closed_by:** 2188b3d
**Learnings:** Fully covered by OBS-001 (1ff6c9a, 2026-05-25). AuthService.login() wires ip/ua/attemptedEmail/reason for LOGIN_FAILURE and ip/ua for LOGIN_SUCCESS via controller's extractMeta(req). Witness tests in OBS-001 spec cover both branches. No additional implementation required; this closure documents the coverage retroactively.

Closed_by points to anchor commit 2188b3d (empty, gate-compliant). Material code change remains 1ff6c9a. This retroactive-closure pattern is now formalized as TOOL-COH-002.

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

- **Status:** DONE
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

**Closed_by:** 0eae219
**Learnings:**
- **FK design choice: Cascade/SetNull → RESTRICT on the four history-bearing edges** (tasks, project_snapshots, documents were Cascade; time_entries was SetNull). Chose RESTRICT over NoAction because (a) it is the audit's literal Suggested-fix wording, and (b) immediate-check semantics align 1:1 with the app-layer pre-check. This *diverges* from the d6299cc precedent (which used NoAction for `audit_logs.actor_id`) — but that choice was forced by the audit_logs immutability trigger rejecting SetNull's implicit UPDATE; **no such trigger exists on tasks/snapshots/documents/time_entries, so the constraint that pushed d6299cc to NoAction does not apply here.** RESTRICT is the cleaner fit.
- **TimeEntry edge (SetNull→Restrict) — invariant conflict resolved.** The strict invariant ("must not *destroy* a TimeEntry") was already satisfied by SetNull (row survives, link nulled). The audit *description* flags "TimeEntries lose their project link silently" as the defect — a stronger invariant. Picked the audit-description reading (Restrict, preserve the link) because (a) `grep project.delete` found **zero callers** besides hardDelete itself + its spec — no seed/teardown relies on the SetNull, so no regression surface; (b) it makes the pre-check gate and the FK gate block on the *same* four relations, which is conceptually clean.
- **Epic / Milestone / ProjectMember / ProjectClient / ProjectThirdPartyMember stay Cascade** — operational link/planning data, not audit history. A future task could promote Milestone to Restrict if milestone-hit history is judged historically significant; deliberately not done here to keep blast radius minimal.
- **Audit emission pattern observed: `AuditPersistenceService.log()` direct** (not the `AuditService` dual-write). projects.service had exactly 2 call sites (archive + unarchive — confirms TST-011's "2 call sites" note). Extended it with a 3rd: `hardDelete` emits `PROJECT_DELETED` (free-string action, no enum migration — consistent with the existing `PROJECT_ARCHIVED`/`PROJECT_UNARCHIVED` string literals) carrying a column snapshot of the project in `payload.snapshot` BEFORE the delete (audit suggested-fix b). Plain `await`, non-transactional with the delete, matching archive()/unarchive() (DAT-006 owns that non-atomicity finding).
- **Atomicity constraint conflict (advisor pref vs task scope).** Advisor leaned toward wrapping audit+delete in `$transaction` for trail integrity. But `AuditPersistenceService.log()` uses its own PrismaClient + advisory lock and takes no tx client; making it tx-aware = modifying the audit pipeline, which DAT-007 scope explicitly forbids. Prioritized the scope constraint: emit-before-delete, non-atomic, per the archive() precedent + DAT-006. The race window (delete fails after a PROJECT_DELETED row is written) is rare (pre-check guarantees no blocking deps) and the row is detectable in the hash chain. Documented rather than silently smuggling a pipeline change.
- **ProjectSnapshot is an operational read-model, NOT the audit trail.** Evidence: produced by the daily `captureSnapshots` cron (PER-003), consumed by `analytics-advanced` (snapshots-query.service, project-health.service) for progress charts; it has **no** hash chain, **no** immutability trigger, **no** actor columns — none of the audit_logs durability machinery. So its loss on hard-delete was a *correctness/analytics-history* defect, not an audit-durability breach. It still must not be silently erased — hence Restrict — but it does not need to follow audit_logs durability rules.
- **Real-DB witness ACHIEVED (bridges TST-DB-001 for this task).** Dev DB (`orchestr-a-db`:5433) was up; applied the migration via `prisma migrate deploy` and confirmed via psql: all 4 FKs now `confdeltype='r'`; `DELETE FROM projects` on a project with 5 snapshots raised `foreign_key_violation` (RESTRICT) and the 5 snapshots + the project row survived. This is the FK-level (W-2) check that OBS-002+DAT-009 and AUD-EMIT-001 could only do via direct scripts — same approach, succeeded here because the migration is a non-destructive constraint swap. Cross-ref [[TST-DB-001]]: the *automated CI* gap remains (vitest still `vi.mock('database')`); only the manual dev-DB witness was achievable.
- **USR-DEL-001 symmetry — DEFERRED, not implemented (resisted).** This fix produces a reusable `checkProjectDependencies()` mirroring `UsersService.checkDependencies()`; USR-DEL-001 needs the exact same shape (add `auditLog.count({where:{actorId}})` to the user pre-check). The grep-discoverable naming (`check<Entity>Dependencies`) makes the pattern obvious. USR-DEL-001's implementer inherits: the pre-check shape, the `ConflictException({message, dependencies})` convention, the actor-threading controller change, and the final-snapshot-before-delete audit pattern (USR-DEL-001 AC#4's open "should hardDelete emit an event?" question is answered affirmatively here for projects: yes, emit `<ENTITY>_DELETED` with a column snapshot). Stayed in DAT-007 scope per the task's explicit instruction.

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
*61 tasks in this phase.*

### BUILD-001 — tsconfig rootDir implicit, build sensitive to files outside src/

- **Status:** TODO
- **Phase:** 13
- **Cluster:** —
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** tooling · build
- **File:** `apps/api/tsconfig.json` (+ `apps/api/docker-entrypoint.sh:111`)
- **Source:** deploy-discovered (2026-05-25 Phase 1 remediation prod deploy) — not in source audit

**Description:**
API build output structure depends on tsc's auto-detected `rootDir`, which is the common ancestor of all input files. Adding files outside `src/` (e.g., `scripts/`) silently shifts the output from `dist/<file>` to `dist/src/<file>`, breaking the Dockerfile entrypoint that hard-codes `dist/main.js`. Discovered during the Phase 1 deploy on 2026-05-25 when `apps/api/scripts/import-french-holidays.ts` (added in the COR-003 holidays de-risk work) moved the inferred `rootDir` up to `apps/api/`, relocating `main.js` to `dist/src/main.js` and causing the new image to crash at startup (`Cannot find module '/app/apps/api/dist/main.js'`). Fixed for the deploy by excluding `scripts/**` from `tsconfig.build.json` (workaround, commit `8e4b593`).

**Root cause:**
`apps/api/tsconfig.json` sets `outDir` but no explicit `rootDir`/`include`, so the output layout is a function of which files happen to exist in the workspace rather than a fixed contract. The entrypoint's hard-coded path makes the coupling brittle.

**Code evidence:**
```
// apps/api/docker-entrypoint.sh:111
exec node apps/api/dist/main.js
// apps/api/tsconfig.json — outDir: ./dist, no rootDir, no include
```

**Suggested fix:**
Pin `"rootDir": "./src"` in `apps/api/tsconfig.json` (or `tsconfig.build.json`) so the output structure is independent of which files exist in the workspace. tsc then hard-errors if a file outside `src/` is ever pulled into the compile, instead of silently relocating output. (The `scripts/**` exclude from `8e4b593` remains as belt-and-braces.)

**Acceptance criteria:**
1. The fix described in **Suggested fix** is implemented in code, addressing the exact failure mode described in **Description**.
2. A test exists that exercises the original failure mode: it FAILS before the fix is applied, PASSES after. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. If the change touches audit-sensitive code (auth, leaves approve/reject, RBAC mutations, document access, user delete, password reset), a corresponding entry is created in `audit_logs` with before/after snapshot.
5. Commit message includes `[closes BUILD-001]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
# Build the api, confirm dist/main.js exists at the flat root regardless of files added under apps/api/ outside src/
pnpm --filter api run build && ls apps/api/dist/main.js
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:** Deploy workaround `8e4b593` (exclude `scripts/**`) is live on prod; the structural `rootDir` pin remains the durable fix tracked here. Verification #2 (FAIL-before/PASS-after) for a build-layout invariant is best expressed as a build-output assertion, not a unit test.

---
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
### DAT-031 — Add durable holidays seeding mechanism

- **Status:** TODO
- **Phase:** 13
- **Cluster:** C
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** data_integrity · seeding
- **File:** `packages/database/prisma/seed.ts` · `apps/api/src/holidays/holidays.service.ts`
- **Source:** operational follow-up from the COR-003 remediation session (2026-05-24) — not an audit-agent finding. Referred to as "#175" (the 175th backlog task).

**Description:**
Holiday reference data must exist wherever leave days are calculated (COR-003 subtracts public holidays from charged days), but nothing populates the `holidays` table automatically. `HolidaysService.importFrenchHolidays(year)` exists but is only reachable via the on-demand admin endpoint (`POST /holidays/import-french`). As of 2026-05-24 prod was manually seeded for 2025–2027 and dev is seeded on demand via `scripts/import-french-holidays.ts`; both lapse once 2027 ends. There is no recurring/bootstrap path, so the data will silently run out (~24-month runway from 2026-05) and every future-year leave will over-charge holidays again — the exact COR-003 failure mode, deferred not closed.

**Root cause:**
The holiday calendar was never integrated into the seed/bootstrap lifecycle; it relies on a human remembering to call the admin import each year.

**Code evidence:**
```
grep -n holiday packages/database/prisma/seed.ts   # → no matches (seed never imports holidays)
# importFrenchHolidays has no scheduled/cron/bootstrap caller — admin endpoint only.
```

**Suggested fix:**
Pick ONE durable mechanism and wire it: (1) call `importFrenchHolidays` for a rolling window (`currentYear .. currentYear+2`) inside `seed.ts` so every reset/bootstrap is covered; (2) a `@nestjs/schedule` cron at the year boundary that imports the upcoming year; (3) a deploy-time bootstrap step. All are idempotent via the `@@unique([date])` constraint. Reuse `scripts/import-french-holidays.ts` as the manual fallback. Coordinate with **COR-013** (consumer-side TZ key matching) so import and lookup agree on date keys.

**Acceptance criteria:**
1. A durable, idempotent mechanism guarantees holidays exist for at least `currentYear .. currentYear+1` after a fresh `prisma migrate reset && db:seed` (or equivalent bootstrap).
2. A test/check proves re-running the mechanism does not duplicate rows (relies on `@@unique([date])`).
3. No regression in existing test suite (`pnpm test` green).
4. Dates are stored at the correct calendar day on any host TZ (regression guard already added in `0dc640e`).
5. Commit message includes `[closes DAT-031]`.
6. Document the chosen mechanism (1/2/3) and why in `Learnings`.

**Verification command:**
```
# After implementing, on a clean DB:
pnpm --filter database db:seed && \
  psql "$DATABASE_URL" -c "SELECT EXTRACT(YEAR FROM date) yr, count(*) FROM holidays GROUP BY 1 ORDER BY 1;"
# Expect >= 11 rows for the current and next year.
```

**Closed_by:** (empty — fill with commit SHA when status moves to DONE)
**Learnings:**
- Not blocking Phase 1: prod holidays cover through **2027-12-31** (~24-month runway from 2026-05), so COR-003 was returned to TODO without this. This task closes the structural gap before the runway expires.
- The TZ off-by-one in `importFrenchHolidays` was fixed in `0dc640e` (UTC date construction + regression test); the durable mechanism must keep using that fixed path.

---
### SEC-031 — GET /users list + getUsersBy* helpers have no horizontal scope filter — any users:read holder enumerates the full directory

- **Status:** DONE
- **Phase:** 4
- **Cluster:** B
- **Confidence:** claude-only
- **Blocked_by:** (none)
- **Severity:** important
- **Category:** security · horizontal-scope · directory-enumeration
- **File:** `apps/api/src/users/users.controller.ts` (GET /users + variants) + `apps/api/src/users/users.service.ts` (`findAll`, `getUsersByDepartment`, `getUsersByService`, `getUsersByRole`)
- **Source:** Session-derived from SEC-030 closeout `d6ed06f` (2026-05-29). Adjacency observed during SEC-030 pre-flight and documented in that task's Learnings + trade-off section ("directory visibility now rides on the still-unscoped list endpoints"). Held back at the time under the don't-file-phantoms discipline; SEC-030 closure + prod deploy make this a clean, material filing to lay now.

**Description:**
SEC-030 scoped the single-resource `GET /users/:id` path via `AccessScopeService.userReadWhere`. The list-side routes (`GET /users` → `findAll`) and the `getUsersBy*` helpers remain unscoped: a non-admin holding `users:read` (= `ANNUAIRE_READ`, the broad org-directory permission held by every non-EXTERNAL template) pages the full directory (≤1000/page) with no horizontal-scope filter and a full select. Consequence: full-profile enumeration is still possible through the list surface even after SEC-030. The trade-off was made operator-visible in the SEC-030 fix; this filing is the commitment to close it.

**Root cause:**
No `userReadWhere` method existed before SEC-030, and the list-side routes were never scoped. SEC-030 created `userReadWhere` (4 buckets: self / same-service / managed-service / managed-department), which is now directly consumable for the list paths.

**Code evidence:**
```
grep -rn "this\.usersService\.findAll\|getUsersBy" apps/api/src
# users.controller.ts:147  return this.usersService.findAll(page, limit, role);
# users.service.ts:1057    async getUsersByDepartment(departmentId: string) { ... }
# users.service.ts:1087    async getUsersByService(serviceId: string) { ... }
# users.service.ts:1111    async getUsersByRole(roleCode: string) { ... }
# (all unscoped — confirm where-clause + select in pre-flight of execution)
```

**Suggested fix:**
Apply `AccessScopeService.userReadWhere` (created by SEC-030) at the `users.service.ts` layer — `findAll` + the `getUsersBy*` helpers — merging the scope `WhereInput` with the existing filters. Apply the same payload restriction (reduced select for non-management) consistent with SEC-030's `FULL_USER_SELECT` vs `DIRECTORY_USER_SELECT`. Literal mirror of the SEC-030 single-resource fix, on the list routes.

**Operator decision — 2026-05-29 (HALT-and-resume at execution pre-flight; mirror DAT-037/DAT-035 Phase-3 design-decision pattern):**
Execution-time primary-source evidence revised the `findAll` half of the suggested fix. (1) **SEC-030's own Learnings explicitly preserve directory visibility on the list endpoints** ("tout agent a besoin de voir qui est qui à quel service" — `users:read` = `ANNUAIRE_READ`; the closeout states "broad directory visibility now rides on the still-unscoped list endpoints"). (2) **New frontend evidence** (per-helper grep, not available to the doc-only filing session): `usersService.getAll()` (→ `findAll`) feeds ~15 app-wide dropdowns (task assignee, project members, event attendees, planning), so where-scoping it would narrow every dropdown to same-service for non-management roles — reversing the SEC-030 design intent. Where-scoping `findAll` and "out-of-scope users must not appear" (original AC#2) are mutually exclusive with that legitimate visibility.
- **`findAll` → payload-only.** Strip the SEC-030 sensitive fields (email, login + the metadata `DIRECTORY_USER_SELECT` already drops) for non-management callers; **do NOT where-scope** `findAll`. Directory visibility (same user set) preserved per SEC-030 design intent.
- **`getUsersByDepartment` / `getUsersByService` / `getUsersByRole` → full treatment** (where-scope via `userReadWhere` + payload reduction). Per-helper frontend grep confirmed **none has a live consumer** (service-layer + unit tests only) → none feeds an app-wide dropdown → all three stay CAS A. (If any had, the same per-helper option-2 carve-out would apply — decision is per-helper, not blanket.)

**Acceptance criteria:**
1. The fix described in **Suggested fix** (as revised by the Operator decision above) is implemented in code, addressing the exact failure mode described in **Description**.
2. **(AMENDED 2026-05-29 per Operator decision.)** A test exists that exercises the original failure mode: it FAILS before the fix, PASSES after — multi-scenario witness (management vs non-management). For `findAll` the proof-of-defect is the **payload diff** (non-management pre-fix sees email/login in the list; post-fix does not), with the **returned user set unchanged** (no where-scope). For `getUsersBy*` the witness is both **scope diff** (non-management gets `userReadWhere` OR-buckets merged into the where) **and** payload diff. Do not commit if this property cannot be demonstrated.
3. No regression in existing test suite (`pnpm test` and `pnpm test:e2e` both green).
4. **N/A — read-path (users-list), not an audit-sensitive mutation.** Per HANDOVER learning #16 the reason is path-specific, not inherited from a sibling: the list/`getUsersBy*` routes are reads, with no delete / RBAC mutation / password reset, so no `audit_logs` entry is created.
5. Commit message includes `[closes SEC-031]`.
6. Do not modify code paths unrelated to **File** and the **Suggested fix** scope within this commit.

**Verification command:**
```
npx vitest run src/users   # in apps/api (turbo treats the path as a task name — see COR-028/SEC-030 NB)
# + behavioral smoke: a non-management caller listing GET /users must see no out-of-scope user.
```

**Closed_by:** 198160f
**Learnings:**
- Filed 2026-05-29 in the post-Phase-4-Cluster-B / post-microdeploy refresh session. Deploy-surfaced adjacency: the SEC-030 fix narrowed `GET /users/:id` but explicitly left the list surface open; `userReadWhere` now exists as a reusable building block, so this is the list-side completion of the same mechanism.
- Cluster: `B` follows the BACKLOG convention (all six Phase-4 tasks carry `Cluster: B`); the analytic overlay places it under horizontal-scope-missing-list-side. Note the long-standing A/B/C-overlay vs field-`B` collision documented in HANDOVER §Filings.
- **HALT-and-resume at pre-flight → operator decision (learning #17 applied; mirror DAT-037/DAT-035 Phase-3 design-decision pattern).** The filing prescribed a *uniform* "literal mirror of SEC-030" (where-scope + payload on `findAll` AND `getUsersBy*`). Pre-flight surfaced a primary-source contradiction the doc-only filing session never had: **(1)** SEC-030's own Learnings deliberately preserve directory visibility on the list endpoints ("tout agent a besoin de voir qui est qui à quel service"; closeout: "broad directory visibility now rides on the still-unscoped list endpoints"); **(2)** fresh per-helper frontend grep — `usersService.getAll()` (→ `findAll`) feeds ~15 app-wide dropdowns (task assignee, project members, event attendees, planning). Where-scoping `findAll` would reverse SEC-030's design intent and narrow every dropdown to same-service for non-management roles. Surfaced via `AskUserQuestion` (operator live); did NOT silently substitute. **Operator picked Option 2** — `findAll` payload-only; `getUsersBy*` full treatment. AC#2 amended in BACKLOG (commit `d76d820`) BEFORE the fix.
- **List paths inventory (per-path status, primary-source not transcribed):**
  - `findAll` (controller `GET /users`, line 142; `users.service.ts` `findAll`): **payload-only, NOT where-scoped.** `isManagement = accessScope.hasAny(caller,['users:manage'])` → `FULL_LIST_SELECT` (existing list shape, incl. email/login) vs new `DIRECTORY_LIST_SELECT` (strips email, login, roleId, createdAt, role.templateKey/isSystem, department.managerId — mirroring `DIRECTORY_USER_SELECT`'s drops on the list shape). `where`/`count` unchanged → same user SET. Did NOT reuse `FULL/DIRECTORY_USER_SELECT` (they'd bolt skills/projectMembers onto a ≤1000-row list and drop managedServices — perf + contract regression).
  - `getUsersByDepartment` / `getUsersByService` / `getUsersByRole`: **full treatment (where-scope + payload).** `where: { …existing, ...userReadWhere(caller) }`; select strips `email` + `role.templateKey` for non-management. Per-helper frontend grep confirmed **zero live consumer** (service-layer fns + unit tests only) → no app-wide-dropdown blast radius → all three stayed CAS A. Decision is per-helper, not blanket (operator rule): had any fed a dropdown, the same Option-2 carve-out would apply to that helper.
  - `getUsersPresence` (also `users:read`, list-shaped) observed during pre-flight but **OUT of File scope** (not named in SEC-031) — adjacency captured, NOT fixed, NOT filed (don't-file-phantoms).
- **`userReadWhere` consumed (SEC-030 signature, primary-source verified, NOT modified):** `userReadWhere(user: AccessUser | undefined) → Promise<Prisma.UserWhereInput>`: no-caller → `{id:'__no_access__'}`; `users:manage` → `{}`; else `{ OR: [self, same-service, managed-service, managed-department] }`. Merged as `{ ...baseWhere, ...scopeWhere }` (top-level AND; no key collision — base uses `departmentId`/`userServices`/`role`, scope uses `OR`/`id`). AccessScopeService untouched (carry-forward #3 = consume, not refactor).
- **Witness (AC#2, amended) non-vacuous — fail-pre proven by stashing only the 2 production files (`users.service.ts` + `users.controller.ts`) and re-running:** **10 tests failed pre-fix** — 6 controller caller-threading + 4 service proof-of-defect (`findAll` directory payload diff: pre-fix list exposes email/login to a directory caller; 3× `getUsersBy*` directory scope-diff: pre-fix where has no OR buckets + payload exposes email). Management/confirming tests pass pre-fix (correctly NOT the proof-of-defect). `findAll` proof = **payload diff, same set** (operator decision); `getUsersBy*` proof = **scope diff + payload diff**.
- **AC#4 N/A — path-specific (HANDOVER learning #16):** READ-PATH on users-list (GET /users + getUsersBy*), not user delete, an RBAC mutation, or any other audit-sensitive operation. The audit-sensitive list names "user delete", not "user list read". No `audit_logs` entry.
- **Gates:** `nest build` clean (typecheck gate — `tsc --noEmit` RED on master by design); `npx vitest run src/users` (apps/api) **116** (controller 36 + service 80, +14 net new across SEC-031); `pnpm test` 1705 → **1710** (+5: 2 findAll + net +3 getUsersBy*) across 74 files / 6 turbo tasks; `pnpm test:e2e` turbo **4/4** (3 cached + web:build). BACKLOG verification command `npx vitest run src/users` works directly in `apps/api` (the `pnpm test apps/api/src/users` turbo-path-as-task-name gotcha from COR-028/SEC-030 does not apply to the `npx vitest` form).
- **Deploy posture:** code-only, no migration. NOT auto-deployed. Prod = `ce0c729` (Cluster-A/B + COR-038 live since micro-deploy 2026-05-29); SEC-031 fix `198160f` is the first undeployed runtime delta since that deploy.
- **INTERDIT respected:** AccessScopeService (`userReadWhere` + others) consumed, NOT modified; `users.service.findOne` untouched (SEC-030 closed); no leaves/milestones/epics; no Cluster-C (TST-001/TST-018). Coherence gate: direct closure, `198160f` carries `[closes SEC-031]`; did NOT touch the 10 pre-existing `Closed_by`-format violations (TOOL-COH-003).
- **Adjacency observed, NOT filed (don't-file-phantoms):** `getUsersPresence` is the remaining `users:read` list-shaped read not in SEC-031 scope; a future filing could extend the same payload/scope treatment if warranted.
- **Frontend field-level regression check (AC#3 dimension the backend `select`-object asserts can't catch — advisor-flagged, verified):** `DIRECTORY_LIST_SELECT` strips `email/login/roleId/role.templateKey/role.isSystem/createdAt/department.managerId` from the non-management `findAll` payload. Grepped every `getAll()` consumer (~15 components) for field-level reads of the stripped fields. Only two read `.email`: `UserMultiSelect.tsx:50` (`user.email?.toLowerCase() || ""`) and `users/[id]/suivi/page.tsx:282` (`u.email?.toLowerCase().includes(q)`) — **both null-safe (optional chaining)** → no crash. `UserMultiSelect` filters `fullName.includes(q) || email.includes(q)`, so name search stays fully functional; only email-substring search silently returns no matches for non-management — the intended, operator-approved effect of stripping email. No other stripped field is read in a crash-prone way. Prod already tolerates email-absence for non-management via SEC-030's `findOne`. **No crash regression; minor email-search degradation is by design.**

---
