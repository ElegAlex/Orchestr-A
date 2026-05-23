# Uniform leave-balance remediation — closeout report

**Period:** 2026-05-23 (single session, 5 waves)
**Scope:** complete remediation of the 10 findings raised by the high-effort code review on the dcddb75..HEAD feature span, plus two findings (#11, #12) promoted during the work.
**Lead:** ab@alexandre-berge.fr / Claude Opus 4.7

---

## Findings table

| # | Symptom | Root cause | Fix | Fixed-by SHA(s) | Tests | Residual risk |
|---|---------|-----------|-----|-----------------|-------|---------------|
| 1 | `createLeave` gate only checks `start.getFullYear()` — year-spanning leaves bypass destination-year allocation. | Single-year accounting assumption; `start.getFullYear()` baked into the gate logic. | `splitLeaveByYear` decomposes leaves into per-Paris-year buckets; gate iterates every bucket independently. | `974a323`, `5e6efc0` | `apps/api/src/leaves/leave-year-window.spec.ts:69-201` (22 tests); `apps/api/src/leaves/leaves.service.spec.ts` "cross-year balance gating" describe block | None known. |
| 2 | `update()` over-credits by `existingLeave.days` on cross-year edits. | Hack `adjustedAvailable = available + existingLeave.days` added the full row's days back to the destination year regardless of where they actually lived. | `getAvailableDays` accepts `excludeLeaveId`; update path passes the edited leave's id, hack removed. | `5e6efc0` | `leaves.service.spec.ts` "update with excludeLeaveId does not over-credit when moving 2025 → 2026"; E2E §A `leave-balance-gating.spec.ts` | None known. |
| 3 | `getAvailableDays` `startDate`-only filter under-counts cross-year leaves in end-year. | SQL filter was `startDate IN [yearStart, yearEnd]`; rows starting in year N but ending in N+1 were invisible to year N+1's count. | INTERSECTS filter (`startDate < yearEnd AND endDate >= yearStart`) + per-row pro-rate via `splitLeaveByYear`. | `5e6efc0` | `leave-year-window.spec.ts` "sum across years is monotonically additive"; integration via E2E §A/§C | None known. |
| 4 | `hasConfiguredBalance` + `getAvailableDays` non-transactional — concurrent allocation delete returns misleading "0 disponible". | Two separate Prisma calls between gate and write; no shared snapshot. | `create()` and `update()` wrap gate + write in `prisma.$transaction(...)`; allocation snapshotted in loop and re-read just before write; ConflictException on mismatch. ReadCommitted (default) + explicit re-read per user decision. | `dd21167` | `leaves.service.spec.ts` "rejects with ConflictException when the snapshotted allocation changes mid-transaction (#4)" | Race window between $transaction commit and `auditService.log` for self-approval (`Logger`-sync, microseconds-class). |
| 5 | `adjustedAvailable` added back `existingLeave.days` regardless of status — CANCELLED/REJECTED inflate budget. | Same root cause as #2: re-credit done in application code instead of via SQL exclude. | Structural: `getAvailableDays` filters by `status IN [APPROVED, CANCELLATION_REQUESTED, PENDING]`, so CANCELLED/REJECTED never reach the subtraction set. `excludeLeaveId` is the only re-credit mechanism. | `5e6efc0`, `dd21167` | `leaves.service.spec.ts` "CANCELLED leaves never inflate getAvailableDays even without excludeLeaveId (#5)"; E2E §B `leave-balance-gating.spec.ts` | None known. |
| 6 | Self-approve writes `validatorId = null`, erasing audit trail. | The branch that set `requiresValidator = false` for `canSelfApprove` also bypassed the validator-id assignment. | `validatorId = validatedById = actorId`, `validatedAt = now()`, **new column `selfApproved BOOLEAN NOT NULL DEFAULT false`** set to `true`. `AuditService.log` emits a `LEAVE_APPROVED` entry with `userId = actor` and `details` containing `selfApproved=true`. | `dd21167` (migration `20260523171000_self_approved_and_global_balance_unique`) | `leaves.service.spec.ts` "grants APPROVED status …" (rewritten contract); "emits an audit log entry …" (new) | Pre-Wave-3 self-approved rows are silently mislabeled (`selfApproved` defaults to false on every existing row). **Backfill decision pending** — query in Wave 5 runbook §5.1. |
| 7 | `LEAVES_SELF_APPROVE` bundle unused. | Defensive over-modularization at feature-add time. | Bundle deleted; comment in `atomic-permissions.ts` records why it's intentionally absent; new `packages/rbac/README.md` documents the bundle-vs-catalog decision rule with this as worked example. | `0480bcb` | RBAC suite (`packages/rbac/__tests__/templates.spec.ts`, 110 tests) unchanged — bundle was never asserted on anywhere. | None — the index counts (`EXPECTED_COUNTS`) are unchanged; removing dead code can't break tests that didn't reference it. |
| 8 | `type` (enum) vs `leaveTypeId` (FK) can drift via update DTO. | Both fields independently writable on create and update. | Server-side derivation: `type` is computed from `leaveTypeConfig.code` at create; ignored on update. DTO field stays exposed but is silently dropped. | `0480bcb`, `766fcd4` | `leaves.service.spec.ts` "ignores DTO `type` and derives enum from leaveTypeConfig.code (#8)" — verified to discriminate (temporarily restored bug → test failed → reverted). Documentation: `apps/api/src/leaves/README.md`. | Historical rows persisted before `0480bcb` may still carry `type ≠ leaveTypeId`. Wave 5 runbook §5.2 reports the count. Backfill decision pending. |
| 9 | `DROP COLUMN maxDaysPerYear` migration irreversible, no backup. | Single-migration drop with no preflight safety. | External preflight script (`scripts/db/preflight-drop-max-days-per-year.sh`) commits a backup table in a separate transaction, runs the Wave 0 diagnostic queries, and aborts on any anomaly. Companion rollback at `scripts/db/rollback-drop-max-days-per-year.sql`. Migration is left to operator. | `0480bcb`, `766fcd4` (smoke check) | Manual rehearsal runbook at `docs/superpowers/logs/2026-05-23-uniform-leave-balance-migration-runbook.md`. Operator runs against a staging dump before prod. | If the operator skips the preflight and runs `prisma migrate deploy` directly, the column data is lost. Process-level risk, not code. |
| 10 | Year windows use host TZ (`new Date(year, 0, 1)`) → UTC vs Europe/Paris flips edge-day leaves. | Native Date constructor reads `process.env.TZ`; CI defaults to UTC. | All leave date math anchored on `Europe/Paris` via `date-fns-tz` in `apps/api/src/leaves/leave-year-window.ts`. CI workflow + vitest setup + jest setup force `TZ=Europe/Paris` (belt-and-suspenders; helper output is host-TZ-independent by construction). `pnpm --filter api test:tz-utc` proves the helper works under shell-level `TZ=UTC` (and `LEAVE_TZ_OVERRIDE_OFF=1` bypasses the Paris-setup override). | `974a323`, `5e6efc0` | `leave-year-window.spec.ts` "host-TZ independence" sub-suite; `pnpm --filter api test:tz-utc` script (22 tests under UTC) | The production API container still runs with whatever `TZ` Docker provides. The helper is correct regardless, but other Date operations elsewhere in the codebase may drift. **Flag for follow-up**: add `TZ=Europe/Paris` to `apps/api/Dockerfile` and `docker-compose.prod.yml`. |
| **11** | `upsertBalance` global path was non-atomic + the default unique index treated NULL `userId` as distinct, so two concurrent global rows for `(leaveTypeId, year)` could coexist and made `resolveAllocatedDays` non-deterministic. | Postgres NULLS-DISTINCT semantics in the `(userId, leaveTypeId, year)` unique constraint. | Partial unique index `leave_balances_global_unique ON leave_balances ("leaveTypeId", "year") WHERE "userId" IS NULL` (migration `20260523171000`). Retry loop on P2002 sits **outside** `$transaction` (the advisor caught that an in-tx retry would deadlock against Postgres's tx-abort semantics). | `dd21167` | E2E §D "Concurrent global-balance upsert produces a single row" (`e2e/tests/workflows/leave-balance-gating.spec.ts`) — exercises the partial unique index + retry against real Postgres. | None known. |
| **12** | `declaredByManager` path produces `validatorId/validatedById/validatedAt = null` — auditor cannot identify who approved. | Same root cause as #6 on the parallel code path. | When `declaredByManager`, set `validatorId = validatedById = requestingUserId` and `validatedAt = now()`. `selfApproved` stays false (the actor is not the beneficiary). | `0480bcb` | `leaves.service.spec.ts` "declaredByManager path produces APPROVED with manager metadata" (existing test tightened) | Same backfill question as #6 for pre-Wave-4 manager-declared rows. |

---

## Wave summary

| Wave | Goal | Commits | New tests | Tests total |
|------|------|---------|-----------|-------------|
| 0 | Diagnostic synthesis | (no code) | 0 | 1488 baseline |
| 1 | Year-window foundation (#1, #2, #3, #5, #10) | `974a323`, `5e6efc0`, `de8da6c` | +22 helper + 5 gate scenarios | 1515 |
| 2 | Rejection-message polish | `8f283d4` | (tightened existing assertions) | 1515 |
| 3 | Audit trail + transactional gate (#4, #6, #11) | `dd21167` | +3 (ConflictException race; CANCELLED filter; audit log entry) | 1518 |
| 4 | Hygiene (#7, #8, #9, #12) | `0480bcb`, `766fcd4` | (existing tests tightened) | 1518 |
| 5 | Verification + closeout | this commit | +4 E2E scenarios (A/B/C/D), +1 `test:tz-utc` script | 1518 unit + 4 E2E |

All 1518 API unit tests + 110 RBAC tests green. Build clean. Helper suite green under both `TZ=Europe/Paris` (default) and `TZ=UTC` (`pnpm --filter api test:tz-utc`).

## E2E scenarios delivered

Per Wave 5 brief — `e2e/tests/workflows/leave-balance-gating.spec.ts`:

1. **A.** ADMIN self-approves a leave spanning Dec 30 → Jan 8 with both years funded at 25 days each. Asserts status APPROVED, `selfApproved = true`, `validatorId = actor`.
2. **B.** ADMIN edits a CANCELLED leave (gate must accept; CANCELLED rows are filtered structurally per #5).
3. **C.** CONTRIBUTEUR with mixed allocations (year N = 25 days, year N+1 = 0) tries to span. Rejection names year N+1 and the shortfall in days per Wave 2.
4. **D.** Concurrent `POST /api/leaves/balances` with `userId=null` for the same `(leaveTypeId, year)` — partial unique index + P2002 retry produce exactly one row.

The previously-codified-bug assertion `expect(body.validatorId).toBeNull()` in the existing smoke test is replaced with the Wave 3 contract (`validatorId = userId, selfApproved = true`).

Wave 5 also delivered the **TZ=UTC architectural proof** as a dedicated script (`test:tz-utc`) rather than a full Playwright project — running the API under UTC requires a container restart that the live E2E suite cannot orchestrate mid-run. The script bypasses `vitest.setup.ts`'s `TZ=Europe/Paris` override via `LEAVE_TZ_OVERRIDE_OFF=1` and asserts the 22 helper tests still hold. The helper does not consult `process.env.TZ`; it uses `date-fns-tz` with an explicit zone argument, so this is sufficient.

## Backfill questions still open (operator)

Run these three queries against prod **after** the migrations apply
successfully (runbook §5):

1. Self-approved orphans created between `fe9397c` and `dd21167`:
   ```sql
   SELECT COUNT(*) FROM leaves
     WHERE status = 'APPROVED' AND "selfApproved" = false
       AND "validatorId" IS NULL AND "createdAt" >= '2026-05-23';
   ```
2. Historical `type` vs `leaveTypeId` drift:
   ```sql
   SELECT COUNT(*) FROM leaves l
     JOIN leave_type_configs c ON c.id = l.leave_type_id
     WHERE l."type"::text != c.code AND l."type" IS NOT NULL;
   ```
3. `maxDaysPerYear` rows the preflight backed up — captured automatically by the preflight script (runbook §2).

If counts are zero, no action. If non-zero, decide between backfill (UPDATE matching rows to the new invariant) and accepted historical drift. The closeout will be amended with the decisions.

## Constraints honored

- No `git push` was performed during the work — per the user's global brief.
- Every commit message references the finding IDs it closes.
- No production database was contacted from the sandbox.
- French audit-legibility: all auditor-facing artifacts (column names, error messages, audit log details) are French-readable; the row-level `selfApproved` boolean was chosen over an audit-log discriminator specifically because it answers the auditor's question without a join.

## Outstanding follow-ups (post-closeout)

1. Backfill decisions for the three queries above.
2. Force `TZ=Europe/Paris` in `apps/api/Dockerfile` and `docker-compose.prod.yml` — the helper is robust, but other Date operations may drift. Cheap fix.
3. Remove the deprecated `type` field from `CreateLeaveDto` / `UpdateLeaveDto` at the next major release. The service already ignores it.
4. The audit-log entry for self-approval fires AFTER the `$transaction` commits. Process crash in the microsecond gap leaves the row's `selfApproved=true` without a security-log entry. AuditService is sync-to-`Logger` (no IO), but if this gap ever needs to be closed, move the log emission inside the tx via Prisma middleware bound to the leaves insert.
