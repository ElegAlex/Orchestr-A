# 2026-06-08 Adversarial Audit — Triage & Dispositions

**Source audit:** `audits/2026-06-08-adversarial-review/` (147 findings, baseline `b9347d2f`)
**Triaged at:** repo HEAD ≈ `b9347d2f` (2026-06-08), all dispositions verified against current code on disk.
**Method:** verify-first on the real candidates (running-code trace, not static), then a dynamic
sharded-triage → adversarial-refutation workflow over the remaining 131 findings (refutation
targeted over-*acceptance*, the costlier error under the broad AB-001 policy).
**Governance:** `backlog/Security/2026-05-24-review-payloads/CLAUDE_SESSION_CONTRACT.md` (AB-001
accepted-behaviors §). LOCAL ONLY — no deploy; no edits to the source `audits/**` (history is
append-only), so this is a NEW artifact.

> **Commit mechanics:** fixes are standalone audit-fix commits whose messages carry the finding
> id(s) (`[SEC-xxx]`), giving a clean id→SHA map below. They were intentionally **not** folded into
> `2026-06-04-adversarial-review/BACKLOG.md` (which would trigger the `check-backlog-coherence.sh`
> `Closed_by` protocol). If you want them folded into the coherence-checked backlog, say so.

---

## COR-028 verdict — CONFIRMED LIVE (HTTP 500 in prod)

`rejectCancellation()` emits `AuditAction.LEAVE_APPROVED` with a `rejectedCancellation: true` marker
**from inside** the leave `$transaction` (`leaves.service.ts:2394-2406`). The `LEAVE_APPROVED` schema
is `z.union([leaveAudit, securityEnvelope])` and **both** branches are `.strict()`: `leaveAudit` has
no `rejectedCancellation` key, `securityEnvelope` requires `success`+`timestamp` (absent). So
`validatePayloadForAction` throws `AuditPayloadValidationError`, which propagates out of the tx
callback → Prisma rolls back the `CANCELLATION_REQUESTED → APPROVED` update → **every
`PATCH /leaves/:id/reject-cancellation` returns 500 and the leave stays stuck**. No audit row written.
Reproduced as a RED witness against the *real* `validatePayloadForAction` (the mocked-auditPersistence
unit tests never ran the strict parse — exactly why it shipped). **Fixed:** `[COR-028]` `27886452`.

---

## A. Hand-fixed this session (verified + witnessed, build/lint/test green)

2439 API unit tests pass; `nest build` clean; eslint 0 errors; prettier clean.

| Finding(s) | Disposition | SHA | What |
|---|---|---|---|
| COR-028 | FIXED (LIVE prod 500) | `27886452` | Add `rejectedCancellation` to `leaveAudit` strict schema; real-schema witness |
| SEC-004, SEC-008 | FIXED (write-authz + field-leak) | `6132aa00` | epics.create membership gate; findOne slim project select |
| SEC-005, SEC-006, SEC-007, SEC-009 | FIXED (write-authz + read-scope + field-leak) | `c984154f` | milestones create/import membership; findAll membership filter; findOne slim select |
| SEC-013 | FIXED (email leak) | `a4251895` | drop user email from skills findOne + findUsersBySkill |
| SEC-003 | FIXED (authz bypass + oracle) | `8037579a` | leaves import → declare_for_others + per-target perimeter; redact preview |
| SEC-012 | FIXED (privilege gap) | `1ff40c23` | ICS import requires events:create (AND) |
| COR-001 | FIXED (race) | `322b9b1c` | thread tx into checkCircularDependency (serializable snapshot) |
| DAT-001 | FIXED (non-atomic) | `733732b7` | wrap stopRecurrence deleteMany+update in $transaction |
| SEC-001 (+SEC-028) | FIXED (deploy drift) | `7768c164` | AUDIT_HASH_KEY/METRICS_TOKEN/RBAC_GUARD_MODE → standalone + all-in-one |
| SEC-017, SEC-020 | FIXED (fail-closed nits) | `3661a823` | null-role / no-userId default-open fall-throughs closed |
| SEC-011 | FIXED (CWE-1236) | `0b8dbf7d` | CSV formula-injection guard in task + milestone exports |
| SEC-016 | FIXED (CPU-DoS) | `10139795` | @ArrayMaxSize(500) on import-users batch |
| SEC-027 | FIXED (secret leak) | `9dfbfb89` | root .dockerignore excludes .env* from build context |
| — | style | `0e3638c5` | prettier format of new witness blocks |

**Write-scope gaps closed (AB-001 does NOT accept any WRITE):** SEC-004, SEC-005, SEC-009 (create/import
without project membership), SEC-003 (import for arbitrary users + enumeration oracle), SEC-012
(events via leaves gate). **Field-leaks beyond AB-001's 4 read domains:** SEC-006/007/008 (cross-project
milestone/epic + full project rows), SEC-013 (email via skills:read — EXTERNAL_PRESTATAIRE holds
skills:read without users:read).

---

## B. ACCEPTED per AB-001 (intended design — NOT a vulnerability)

| Finding | Disposition | Why (uniform AB-001 test: domain ∈ {tasks/leaves/telework/directory} · gated by that exact perm · fields in-domain) |
|---|---|---|
| SEC-010 | ACCEPTED | `GET /tasks/orphans` — every `tasks:read` holder also holds `tasks:readAll` (verified: the `read`-without-`readAll` set is empty), so no caller sees orphans without org-wide task read; exposed fields are task/directory-domain. No exposure beyond AB-001. |
| COR-034 | ACCEPTED (intended) | analytics: accurate GLOBAL metrics + capped DISPLAY rows is documented & deliberate (in-code SA-PERF-011 note), not a bug. |

---

## C. Triaged 131 findings (sharded triage → adversarial refutation)

Tally after refutation (0 ACCEPTED verdicts overturned): **REAL_DEFERRED 102 · WONT_FIX 17 ·
REAL_FIX_NOW 10 (3 now FIXED, 1 folded, 6 follow-up) · ALREADY_FIXED 1 · ACCEPTED 1**.

Vocabulary: **REAL_DEFERRED** = genuine but belongs to a transversal cluster (DTO/MaxLength sweep,
UTC-date sweep, frontend-perf, CHECK-constraint migration, audit-coverage expansion) — track as a
backlog epic, not a one-off hand-fix. **WONT_FIX** = real-but-low-value with rationale.
**ALREADY_FIXED** = current HEAD already addresses it.

| ID | Disposition | Rationale (abbrev.) |
|---|---|---|
| COR-002 | REAL_DEFERRED | Genuine bad-input-becomes-500 robustness gap (same class as COR-006/036); no data impact, part of the DTO/param-validation sweep. Same pattern in ServicesController. |
| COR-003 | REAL_DEFERRED | Create/Update asymmetry, real, but pure length hygiene (Prisma parameterizes, AllExceptionsFilter masks any 500, no CPU); nit, DTO-MaxLength sweep. |
| COR-004 | REAL_DEFERRED | Genuine consistency defect in the UTC-anchoring cluster but near-zero impact even off-UTC; belongs to the UTC-date sweep, not a standalone hand-fix. |
| COR-005 | REAL_DEFERRED | Real latent correctness bug (two call sites) in the UTC sweep; harmless only because prod is UTC; coordinated setUTCHours fix belongs to the transversal cluster. |
| COR-006 | REAL_DEFERRED | Real P2025->500 instead of 400/404, but same error-mapping class as COR-036; belongs in the uncaught-Prisma-error sweep, not a one-off fix. |
| COR-007 | REAL_FIX_NOW | Narrow single-method data-integrity bug that breaks the COR-063 DONE=100% invariant; a status guard in recalcTaskProgress is a clean fix. |
| COR-008 | REAL_FIX_NOW | Real invariant gap (mutations on CANCELLED projects) across 3 create() call-sites; narrow guard each, mirrors the existing COR-016 pattern. Note: 3 call-sites, not 1. |
| COR-009 | REAL_FIX_NOW | Narrow single-method data-integrity bug producing cross-project FK links; clear `data:{projectId, epicId:null, milestoneId:null}` is the clean fix. |
| COR-010 | REAL_DEFERRED | Genuine off-by-one deletion risk off-UTC; latent on UTC prod; part of the UTC-anchor sweep (fix = Date.UTC), not a narrow standalone. |
| COR-011 | REAL_DEFERRED | Boundary contract weaker than ISO-8601 but service guard already prevents crash; format-hygiene, date-validation sweep. |
| COR-012 | REAL_DEFERRED | Malformed UUID yields 500 not 400 — status hygiene only, no info leak (filter masks it). Query-param-validation sweep. |
| COR-013 | WONT_FIX | Confirmed dead code: real enforced ceiling is 1 MiB, the 5 MB decorator is unreachable. Harmless misleading annotation; not worth a change. Nit. |
| COR-014 | REAL_DEFERRED | Genuine 400-vs-500 status hygiene; stack-leak subclaim falsified by the global filter. Date/query-validation sweep. |
| COR-015 | REAL_DEFERRED | Unbounded array + no skipDuplicates + no DB unique = genuine data-integrity dup-row risk, but a transversal DTO-bound + insert-dedup fix; defer to the validation sweep. |
| COR-016 | REAL_DEFERRED | Missing type constraint yields 500-not-400; status hygiene, no leak. DTO-validation sweep. |
| COR-017 | REAL_DEFERRED | Same 400-vs-500 query-date class as COR-014; transversal date-validation sweep. |
| COR-018 | REAL_DEFERRED | 400-vs-500 status hygiene, no info leak; query-param-UUID-validation sweep. |
| COR-019 | REAL_DEFERRED | Genuine but low-impact (recovery still possible via change-password with the just-set password); part of the auth-flow polish, not a standalone fix. Nit. |
| COR-020 | REAL_DEFERRED | Pure consistency nit relative to the codebase's own LEAVE_TIMEZONE convention; sweep item, not hand-fix; NOT already fixed (line 560 still local-TZ on disk). |
| COR-021 | REAL_DEFERRED | Real cross-year+end-half-day edge case that over-inflates the N+1 bucket and may over-strict the gate; fix needs the COR-015 day-scaling trick or schema change (not a one-liner) -> deferred. Nit. |
| COR-022 | REAL_DEFERRED | Genuine latent dedup-boundary risk if TZ changes; harmless on UTC; belongs to UTC-midnight sweep (Date.UTC). |
| COR-023 | REAL_DEFERRED | Real but low-frequency (2 DST transitions/yr) and only on a DST-observing non-UTC host; UTC-safe day-arithmetic helper is the sweep fix. |
| COR-024 | REAL_DEFERRED | Genuine stored-but-unused field; weekly occurrences land on the seed weekday, not the requested day. Fix is an occurrence-loop rework (day alignment), not narrow -> deferred. Important. |
| COR-025 | REAL_DEFERRED | Real silent event truncation at 100. Note: passing 1000 would clamp to 200, so the fix must raise the events cap or add a planning path -> not a clean one-liner -> deferred. Important. |
| COR-026 | REAL_DEFERRED | Narrow setHours bug is latent on UTC; the broader Paris-wall-clock vs ICS-Z TZ-model is a separate item in the same sweep — fix together, not as an isolated hand-fix. |
| COR-027 | REAL_DEFERRED | Genuine import-time HH:MM offset on non-UTC host; latent on UTC; getUTCHours/getUTCMinutes sweep fix across both methods. |
| COR-029 | REAL_DEFERRED | Genuine TOCTOU on the payroll cap invariant but same SERIALIZABLE-boundary gap as the create() fix — cluster-D atomicity backlog, witness DAT-001 in fix-set. |
| COR-030 | REAL_DEFERRED | Real partial-write but the same uncovered-transaction-boundary cluster-D shape; defer to the atomicity sweep with witness DAT-001. |
| COR-031 | REAL_DEFERRED | Trivial mirror of the COR-021 bulk fix, but it belongs to the cluster-D atomicity sweep (witness DAT-001 in fix-set) — narrow window needing a concurrent telework insert. |
| COR-032 | REAL_DEFERRED | Genuine missing lifecycle teardown (open socket on shutdown); part of the module-lifecycle/resource-cleanup sweep, not a standalone fix. Important->kept. |
| COR-033 | WONT_FIX | Finding premise (count can diverge from allRuleData.length) does not hold in current code: no skipDuplicates means count is always exact or the tx throws. Nit, not worth changing. |
| COR-034 | ACCEPTED | Intended design: accurate GLOBAL metrics + capped DISPLAY rows is documented and deliberate, not a bug. (Not an AB-001 case — accepted as intended-design per the in-code comment.) |
| COR-035 | REAL_DEFERRED | Real but minimal-impact (soft hide-old-completed feature) and only off-UTC w/ DST; one-line Date.now()-arithmetic fix is part of the UTC sweep. |
| COR-036 | REAL_DEFERRED | Real but same uncaught-P2025->500 class as COR-006; belongs in the error-mapping sweep, not a one-off fix. Nit. |
| COR-037 | REAL_DEFERRED | Confirmed documentation-only error (levelOrder is correct); trivial comment fix, batch with other doc-drift nits. Nit. |
| COR-038 | WONT_FIX | Hypothetical only after a future enum addition without updating this map; impossible with the current validated enum. Not worth a guard now. Nit. |
| COR-039 | WONT_FIX | Test-only utility, never runs on prod/dev (name guard throws); crash-window only affects disposable test DBs re-created per run. Negligible value to wrap in a tx. Nit. |
| DAT-002 | REAL_DEFERRED | Genuine TOCTOU but part of the cluster-D atomicity sweep (witness DAT-001 is in the fix-set); narrow window needing a concurrent service insert for the only real branch. |
| DAT-003 | REAL_DEFERRED | Genuine atomicity drift vs update(), but same transaction-boundary shape as the rest of cluster D — backlog the sweep, witness DAT-001 already in fix-set. |
| DAT-004 | REAL_DEFERRED | Same uncovered-transaction-boundary pattern as DAT-002/003; cluster-D sweep, defer with witness DAT-001. |
| DAT-005 | REAL_FIX_NOW | Genuine, one-line fix (lowercase the import set+lookup like validate), breaks the validate/import dry-run contract producing silent case-variant duplicate milestones; not in the fix-set. |
| DAT-006 | REAL_DEFERRED | Trivial surgical mirror of an existing sibling, but it is the cluster-D atomicity sweep (witness DAT-001 in fix-set), not an isolated high-harm one-off — ease-of-fix is not the FIX_NOW criterion. |
| DAT-007 | REAL_DEFERRED | Admin-only semantic cap missing; low data-corruption risk behind privileged gate. CHECK/Max-bound sweep. |
| DAT-008 | REAL_DEFERRED | Bounded-field asymmetry, length hygiene only; DTO-MaxLength sweep. |
| DAT-009 | REAL_DEFERRED | Same length-hygiene asymmetry as DAT-008; DTO-MaxLength sweep. |
| DAT-010 | REAL_DEFERRED | Import-row length hygiene, multiple unbounded fields; DTO-MaxLength sweep (ArrayMaxSize already present on the wrapper via ImportLeaves pattern not here — title-bound only). |
| DAT-011 | REAL_DEFERRED | Weaker DTO signal + unbounded IN-array, but service findMany dedups/validates; UUID+ArrayMaxSize sweep. |
| DAT-012 | REAL_DEFERRED | Length hygiene only, 1MiB body outer bound; DTO-MaxLength sweep. |
| DAT-013 | WONT_FIX | Documented intentional pre-delete capture; the inside-tx alternative risks hash-chain deadlock. Audit-count accuracy only, narrow race window — cost/benefit not worth it. |
| DAT-014 | REAL_DEFERRED | Genuine lone-sibling omission of the uniform date-ordering CHECK; belongs in cluster-L CHECK-constraint sweep migration, not an ad-hoc hand-fix. Highest-value of the cluster (negative-duration tasks render on planning views) — orc |
| DAT-015 | REAL_DEFERRED | Real non-negative-bound gap (Decimal(5,2) admits down to -999.99); same CHECK-constraint mechanism as the cluster, defer into the sweep migration. |
| DAT-016 | WONT_FIX | Vestigial dev-era cron script not on the live backup path (prod uses systemd timer per MEMORY); box has no cron daemon so it can't even register. Retire/ignore, no production impact. |
| DAT-017 | REAL_DEFERRED | Genuine DB-floor gap; Prisma PSL can't express partial-unique so it needs a raw-SQL migration — fits the CHECK/partial-index migration cluster, defer. |
| DAT-018 | REAL_DEFERRED | Real DB-floor gap (FK should be RESTRICT) but the app-layer 409 guard already prevents the silent-nullification scenario; defense-in-depth FK tightening fits the cascade-semantics cluster. |
| DAT-019 | REAL_DEFERRED | Operational/runbook concern (was the prod recompute actually run?) — unverifiable from disk, not a code fix. Track as ops verification, not a hand-fix. |
| DAT-020 | WONT_FIX | The hardening gaps are real but apply to a vestigial dev script not on the production backup path; the live backup-daily.sh is out of this repo's scope. No prod impact from this file. |
| DAT-021 | WONT_FIX | Irreversible migration already applied to prod; backfilling a rollback is moot per the finding itself. Future-DROP convention is a process note, not a fixable code defect. |
| DAT-022 | REAL_DEFERRED | Real cross-column gap but project_snapshots is system-generated (scheduled job, no direct user input); part of cluster-L CHECK sweep, very low exploitation risk. |
| DAT-023 | WONT_FIX | Finding's own text says 'Not a bug'; STARTED is re-hashed deterministically and the trail ends consistent. Already documented in-code; no value in reworking the ordering. |
| DAT-024 | WONT_FIX | Intentional documented APPROVED-only DB floor; CANCELLATION_REQUESTED can't be SQL-inserted in normal ops and the service-layer check covers it. Lowest severity, no action warranted. |
| DAT-025 | WONT_FIX | PSL implicit default already equals the SQL RESTRICT (no behavioral gap) and remove() already guards against the raw-error path. Adding the explicit annotation is cosmetic clarity only. |
| DAT-026 | REAL_DEFERRED | Low-value data-quality guard; defer into cluster-L CHECK sweep, not worth a standalone hand-fix. |
| DAT-027 | REAL_DEFERRED | Real missing ceiling but only reachable via direct DB write/severe service bug (service floors at 0.5d, computes from range); confidence-low, defer into cluster-L sweep. |
| OBS-001 | REAL_DEFERRED | Genuine swallowed-DB-error blind spot, but a single missing log line that belongs to the OBS-008 structured-logging/swallowed-exception coverage cluster. Downgraded: resilience is intentional, only the log line is missing. |
| OBS-002 | REAL_DEFERRED | Genuine forensic-correlation gap, but the fix is transversal observability plumbing (ALS into the persistence layer + requestId pass-through across every bespoke payload schema), not a narrow hand-fix; track as audit/observability |
| OBS-003 | REAL_DEFERRED | Org-unit CRUD that gates RBAC scope is genuinely unaudited; part of the audit-coverage-expansion cluster J (new enum members + emitters + schemas), deferred to that sweep. |
| OBS-004 | REAL_DEFERRED | Real HR-policy config audit gap (esp. requiresApproval toggle); same cluster-J audit-coverage expansion, deferred as backlog rather than narrow hand-fix. |
| OBS-005 | ALREADY_FIXED | The finding's own acceptance criterion accepts the disjunct 'OR the payload explicitly documents the revocation' — the existing PASSWORD_CHANGED details string already documents the forced revocation, so the criterion is satisfied |
| OBS-006 | REAL_DEFERRED | Real RGPD storage-limitation governance gap but requires a declared retention period + hash-chain-preserving anonymization job + possible partitioning — a transversal compliance feature, not a hand-fix. |
| OBS-007 | WONT_FIX | Recurring-task-template assignment changes are low forensic value (operational scheduling, not personal data or RBAC scope); the cost of new enum members + schemas + emitters + specs outweighs the benefit at suggestion severity. |
| OBS-008 | REAL_DEFERRED | Real logging gap for 5xx-as-HttpException, but most HttpExceptions are by-design 4xx that should not log as errors; the genuine fix (log status>=500) belongs to the structured-logging cluster. Downgraded: Fastify access-log partia |
| OBS-009 | WONT_FIX | Explicitly deliberate, in-code-justified durability tradeoff (PERF-001) with an existing compensating control (stdout error log on failure); the outbox 'fix' is a major architecture change not warranted by the throttle-capped thre |
| OBS-010 | REAL_DEFERRED | Genuine inconsistency vs sibling TASK_*/PROJECT_* auditing (incl. 1000-row bulk import blind spot); belongs to the cluster-J audit-coverage expansion sweep, deferred as backlog. |
| OBS-011 | REAL_DEFERRED | Project-governance entity lifecycle untraced, mirroring OBS-010; part of the same cluster-J audit-coverage expansion, deferred to that sweep rather than narrow hand-fix. |
| OBS-012 | REAL_DEFERRED | Strongest of the set — privileged cross-user data destruction with no immutable record/snapshot; genuine accountability gap, tracked in the cluster-J audit-coverage expansion (new COMMENT_DELETED action + pre-delete snapshot). |
| OBS-013 | REAL_DEFERRED | Legitimate point-in-time-authority improvement, but adding it requires a schema migration + inclusion in computeRowHash + threading currentUserRole through every call site — a transversal schema/audit change for the backlog. |
| OBS-014 | WONT_FIX | Accepted design (manual VPS deploy); the echo step is harmless and the suggested rewire to GitHub Deployment API is cosmetic, low-value observability churn. |
| PER-001 | REAL_FIX_NOW | Genuine unbounded in-memory expansion + uncapped createMany on a WRITE endpoint (telework:create, no throttle); fix is to replicate the existing 4-line SEC-024 366-day guard already in this file — narrow, high-value, not in fix-se |
| PER-002 | REAL_DEFERRED | Real same-root-cause cluster-E issue as PER-001 (missing 366-day span cap on a second expansion entry path), but it's the transversal span-cap sweep across the 3 expand call-sites; best fixed via one service-level guard in expandR |
| PER-003 | REAL_DEFERRED | Genuine global seq-scan on every dependency mutation, but proper fix = projectId-scoped WHERE + new @@index([taskId]) migration (cluster F, correctness-adjacent to fix-set COR-001), more than a one-line hand-fix. Downgrade: BFS is |
| PER-004 | REAL_DEFERRED | Genuine N+1 fixable by 2 bulk findMany + in-memory maps; but realistic leave-type count is small (single digits) and queries are parallel. Fits the frontend/backend perf cluster, defer. |
| PER-005 | REAL_DEFERRED | Genuine unbounded scan but identical to nit-rated PER-018; finding's own updatedAt-WHERE fix would undercount `overdue` (line 90-96 has no window) -> needs careful groupBy+overdue sweep. Defer to query-bounds cluster I. |
| PER-006 | REAL_DEFERRED | Genuine unbounded-payload pattern but part of the cross-service cluster-G payload-bound sweep (autocomplete endpoint + dropdown refactor), not a narrow hand-fix. |
| PER-007 | REAL_DEFERRED | Same cluster-G unbounded default as PER-006; fixed together via a lazy project picker / paginated default, transversal not narrow. |
| PER-008 | REAL_DEFERRED | Cluster-G hardcoded 1000 limit; bound-tightening belongs to the payload sweep, not a standalone fix. |
| PER-009 | REAL_DEFERRED | Genuine Promise.all opportunity but part of cluster-H frontend-perf waterfall sweep; deferred. |
| PER-010 | REAL_DEFERRED | Float-the-promise fix is in the cluster-H waterfall sweep, not a narrow standalone hand-fix. |
| PER-011 | REAL_DEFERRED | TanStack migration across projects/tasks/users pages is a multi-file refactor — cluster-H, deferred to backlog. |
| PER-012 | REAL_DEFERRED | Cluster-G payload-bound sweep (year-scope the leave query); transversal, not narrow. |
| PER-013 | REAL_DEFERRED | Optimistic-update refactor spans tasks+dashboard (cluster-H); deferred to the refetch-elimination sweep. |
| PER-014 | REAL_DEFERRED | Real divergent pattern; aligning milestones to the epics count-query is a clean perf+consistency fix but low-impact (membership lists are small). Defer to perf cluster. |
| PER-015 | REAL_DEFERRED | Genuine sequential-await; replaceable with one tx.subtask.createMany. Real but low-value (import is a rare bulk op, not a hot path). Defer to perf cluster. |
| PER-016 | REAL_DEFERRED | Real nit: groupBy(projectId,status) would avoid materializing all task/milestone rows in the scheduled job. Defer to query-bounds cluster I (groupBy sweep). |
| PER-017 | REAL_DEFERRED | Real nit: unbounded milestone scan; smaller table so low impact. Defer to query-bounds cluster I (take-cap/window sweep). |
| PER-018 | REAL_DEFERRED | Real nit: cleanest groupBy candidate of the cluster (no overdue/details coupling). Defer to query-bounds cluster I. |
| PER-019 | REAL_DEFERRED | Latent unbounded method with no live caller; bundle with cluster-G payload sweep (deprecate or add default limit), not worth an isolated fix. |
| PER-020 | REAL_DEFERRED | Correctness-on-overflow guard is a CHECK/observability add on an intentionally-capped path; backlog it with the payload cluster. |
| PER-021 | REAL_DEFERRED | Lift loadProjects to a mount-only effect — small but part of the cluster-H waterfall sweep. |
| PER-022 | REAL_DEFERRED | Same optimistic-update sweep as PER-013 (cluster-H); deferred. |
| PER-023 | REAL_DEFERRED | RSC migration of list-page shells is a large cluster-H architectural effort; backlog only. |
| PER-024 | REAL_DEFERRED | Pre-indexing into a Map<userId,Map<dateStr>> is a real perf win but a focused hook refactor in cluster-H; defer. |
| PER-025 | REAL_DEFERRED | One-line alignment to 5min; belongs to the analytics-cache consistency cluster (H), not worth an isolated orchestrator hand-fix. |
| SEC-002 | REAL_DEFERRED | Missing @MaxLength is real (siblings LoginDto cap 1024) but bcrypt's 72-byte truncation kills the single-field CPU-exhaustion mechanism; pure consistency hygiene, belongs in the DTO-MaxLength sweep, not important. |
| SEC-011 | FIXED→0b8dbf7d | Genuine CWE-1236 formula injection in two files; one-line OWASP fix (prefix ' to fields starting =/+/-/@); narrow, high-value, not in fix-set. NB: the SEC-011/12/13 in code comments are the prior audit's numbering, unrelated to th |
| SEC-014 | REAL_DEFERRED | Low-value hardening gap, no CPU/security amplification; track in the DTO-MaxLength validation sweep. |
| SEC-015 | REAL_DEFERRED | Length-hygiene asymmetry vs sibling RegisterDto; Prisma/DB is the only current bound. Part of the DTO-MaxLength sweep. |
| SEC-016 | FIXED→10139795 | Acknowledged-and-fixed identical vector on sibling + real CPU-DoS (N×cost-12 bcrypt, N bounded only by 1MiB body, truncation-irrelevant) + one-line fix not in fix-set. |
| SEC-018 | WONT_FIX | Caller already knows the name they POSTed; echoing it back leaks nothing new. Cost (two messages + tests) exceeds the near-zero security benefit. |
| SEC-019 | REAL_DEFERRED | Real negative-skip bound bug but identical across multiple paginated services — belongs to the transversal pagination-floor / DTO-validation sweep, not a one-off hand-fix. |
| SEC-021 | REAL_DEFERRED | settings:update-gated write; per-value size hygiene gap, 1MiB body is outer bound. DTO-validation sweep. |
| SEC-022 | REAL_FIX_NOW | Narrow one-liner mirroring the existing SWAGGER guard; worthwhile regression-proofing. Downgraded: prod already sets METRICS_TOKEN (401-without/200-with verified), so today's exposure is zero — defense-in-depth against future omis |
| SEC-023 | REAL_DEFERRED | Latent-only Prometheus label-injection vector with zero current callers and an internal hardcoded-label contract; track with metrics hardening rather than an isolated hand-fix. Downgraded from important: no reachable exploit path  |
| SEC-024 | REAL_DEFERRED | Baked defaults are overridden at runtime by the entrypoint before the API starts, so the exploit (guessable creds / forgeable tokens) doesn't occur; stripping secrets from the ENV layer is defense-in-depth hygiene, part of the doc |
| SEC-025 | REAL_DEFERRED | Whoever sets ADMIN_PASSWORD already controls the root entrypoint env and can run arbitrary code, so it is not a real escalation; the genuine bug is that a legitimate password containing a single quote breaks first-boot seed — fix  |
| SEC-026 | REAL_DEFERRED | Real cleartext-exposure on any internet-facing host using this compose; fix (127.0.0.1 default bind or documented mandatory TLS proxy) belongs to the transversal compose-hardening cluster, not a one-off hand-fix. |
| SEC-027 | FIXED→9dfbfb89 | Genuine secret-in-build-context leak with a narrow additive fix (single root .dockerignore excluding .env*), not covered by the fix-set; flag for orchestrator hand-fix. |
| SEC-028 | ALREADY_FIXED (folded into SEC-001 7768c164) | supervisord does not forward unlisted container env vars, so even an operator-supplied AUDIT_HASH_KEY never reaches Node — the published all-in-one image cannot boot; narrow passthrough fix, not in fix-set (SEC-030 in the fix-set  |
| SEC-029 | REAL_DEFERRED | Real defense-in-depth gap with a trivial REDISCLI_AUTH env fix; same compose-hardening cluster across prod+standalone, batch it rather than a one-off hand-fix. |
| SEC-030 | REAL_DEFERRED | Real but low-likelihood (requires a malicious upstream :latest push); pin + no-new-privileges belongs to the container-hardening sweep across compose services. |
| SEC-031 | REAL_DEFERRED | Genuine config drift for the published all-in-one image; add the three missing directives as part of the nginx-config-parity sweep. |
| SEC-032 | REAL_DEFERRED | Real exposure only on a network-connected dev box; 127.0.0.1 default-bind fix is part of the compose-hardening cluster, low urgency for a DEV-ONLY file. |
| SEC-033 | REAL_DEFERRED | Adding preload is one word but commits the domain to HTTPS-forever and requires an external hstspreload.org submission — an operator decision; track in the TLS-hardening backlog, not a repo hand-fix (the repo file is documentation |
| TST-001 | REAL_DEFERRED | Real legacy-convention drift (UI login vs storage-state, hits SEC-006 5/min bucket), but it's a 5-file test-migration sweep with no runtime impact and tests still pass with --no-deps; track in backlog test-hardening, not a narrow  |
| TST-002 | REAL_DEFERRED | Genuine controller-unit gap but E2E permission-matrix compensates RBAC; adding a controller spec is part of the controller-coverage backlog sweep, not security-critical. |
| TST-003 | REAL_DEFERRED | Real but low-stakes controller-dispatch gap fully compensated by E2E + service tests; belongs in the same controller-coverage backlog cluster as TST-002/008. |
| TST-004 | REAL_DEFERRED | Confirmed happy-path-only delegation specs; exportIcs header coverage is the one concrete hole but ICS headers are stable and E2E exists; track as negative-path test-hardening backlog item. |
| TST-005 | WONT_FIX | Known, documented mock limitation already mitigated by the integration harness which is the real this.prisma-vs-tx safety net; rewriting unit mocks to distinct mockTx objects is boilerplate with marginal defect-catch — not worth i |
| TST-006 | REAL_DEFERRED | Genuine false-assurance: a removed @RequirePermissions would yield 404 from not-found and still pass; real but a test-tightening change (seed a real resource, assert exactly 403) tracked in the test-hardening sweep. |
| TST-007 | REAL_DEFERRED | Real false-assurance for a @smoke gate (skips count as pass when seed missing); fix is a small spec/CI change (hard-fail or drop @smoke) belonging to the test-hardening backlog, not a code bug. |
| TST-008 | REAL_DEFERRED | Accurate coverage-metric gap; E2E RBAC matrix covers all permission codes so no runtime risk, but roles/settings complexity warrants tracked controller-spec backlog (superset of TST-002/003). |
| TST-009 | WONT_FIX | These are thin Axios wrappers with error handling centralized in the Axios interceptor, not per-service; adding 15 rejection tests is busywork with near-zero defect-catch — cost outweighs benefit. |

---

## D. REAL_FIX_NOW — recommended follow-ups (verified real, NOT fixed this session)

The triage flagged 10 as fix-now. Of those: **3 fixed** (SEC-011/SEC-016/SEC-027), **1 folded** into
SEC-001 (SEC-028 — supervisord wasn't forwarding `AUDIT_HASH_KEY`, so the published all-in-one image
crash-looped; the SEC-001 commit added the passthrough). The remaining **6** are genuine, narrow, and
verified against current code, but are correctness/perf/defense-in-depth (each needs its own witness),
so they are handed off for prioritisation rather than bundled into this security pass:

| ID | Sev | One-line fix | Evidence |
|---|---|---|---|
| COR-007 | important | status-guard in `recalcTaskProgress` | toggling a subtask incomplete on a DONE task leaves `status=DONE, progress<100` (breaks COR-063 invariant); `tasks.service.ts:2261-2272` writes progress unconditionally |
| COR-008 | important | reject mutations on `status===CANCELLED` projects at the 3 create() sites | epics/milestones/tasks create() only check existence, not CANCELLED, unlike `projects.service.ts:582-584` (COR-016) — 3 call sites |
| COR-009 | important | `attachToProject` must null `epicId`/`milestoneId` | `tasks.service.ts:1989-1991` sets only `projectId`, leaving a re-attached task FK-linked to the OLD project's epic/milestone |
| DAT-005 | important | lowercase the import dedupe set+lookup | `milestones.service.ts:226/241` import dedupe is case-sensitive while validate (`:311-344`) is `toLowerCase()` → dry-run says "no dup", import creates case-variant duplicates |
| PER-001 | important | replicate the existing 366-day guard | `telework.service.ts:1001-1099` `generateSchedulesFromRules` expands day-by-day + `createMany` with NO span cap (guard exists only in `findAll:209`); WRITE endpoint, no throttle. PER-002 shares it |
| SEC-022 | nit | add a prod-startup `METRICS_TOKEN` guard in `main.ts` | mirrors the existing SWAGGER guard; **zero current exposure** (prod sets METRICS_TOKEN, verified 401/200) — regression-proofing only |

## E. Transversal clusters (the 102 REAL_DEFERRED) — track as backlog epics

The deferred findings collapse into a handful of one-pass sweeps (per the source audit's cluster map):

- **B — DTO input-validation sweep** (~19): missing `@MaxLength`/`@IsUUID`/`@IsDateString`/`@ArrayMaxSize`;
  mostly 400-vs-500 status hygiene (the global `AllExceptionsFilter` already masks stack traces, so the
  audit's "leaks stack in dev" sub-claims are falsified). Shared base-DTO + an ESLint rule.
- **C — UTC date-arithmetic sweep** (~9): `getMonth`/`setHours`/`getDate` in local TZ; **harmless only
  because prod runs UTC**. Shared `date-utils` (`toUTCMidnight`, `getUTCMonthIndex`, …) + a lint ban.
- **D — atomicity** (remaining): wrap multi-write methods in `$transaction` (DAT-001 done as exemplar).
- **G/H — frontend perf** (~24): hardcoded `limit=1000`, serial waterfalls, full re-fetch on mutation,
  CSR `useEffect` instead of TanStack hooks. Migrate to paginated + cached hooks.
- **I — analytics groupBy** (~4): rewrite in-JS aggregation as Prisma `groupBy` with a `take` backstop.
- **J/K — audit coverage** (~8): add `AuditAction` codes + emit for org/config/hierarchy mutations;
  thread `requestId` into `AuditPersistenceService.log()`.
- **L — CHECK constraints** (~5): one migration for date-ordering, non-negative hours, `tasksDone<=Total`,
  year/days bounds. Dry-run against prod data first.
- **N — test quality** (~9): storage-state auth for the 5 legacy root specs; fail (not skip) on missing
  seed; error-path controller coverage; replace 404-acceptance in rbac-escalation with a pre-created row.

Full per-finding rationale is in the table above and in the workflow result
(`audits/2026-06-08-adversarial-review/.triage-workflow.js` run; raw verdicts retained in this session).

---

## F. Verification status & outstanding work

**Gate (LOCAL):** `nest build` clean · 2443 API unit tests pass · eslint 0 errors · prettier clean.
Each fix carries a witness; structural witnesses (COR-001, DAT-001) were proven RED→GREEN by stashing
the source fix.

**Frontend-impact check (the reads/permissions tightened):**
- SEC-006 — `milestonesService.getAll()` (org-wide `GET /milestones`) has **no callers** in `apps/web`
  (the UI uses the projectId-scoped `getByProject`), so membership-scoping breaks no live flow.
- SEC-003 / SEC-012 — the leaves-import and ICS-import UIs gate **only** on the API (no pre-existing
  client-side permission check), so the effect is that roles which should not have had access now get
  403 instead of an unauthorized success. Intended; no legitimate flow is broken. If desired, hide the
  import affordances from non-`declare_for_others` / non-`events:create` users to avoid button→403 UX.

**SEC-003 residual (precise):** the preview no longer **echoes** `resolvedUser` for out-of-perimeter
targets (witnessed), but `validateLeavesImport` still returns a *different* message for "introuvable"
vs "hors de votre périmètre" — a weak existence-bit remains. **Immaterial** under the now manager/HR/
admin-only gate (those 5 templates already hold `users:read` directory access); unify the two messages
if you want it fully closed.

**OUTSTANDING — required by CLAUDE.md, not done here:** Playwright **E2E negative-authz** tests. The
service-layer `ForbiddenException` witnesses are necessary but are not the mandated e2e. Minimum set
(matches the audit's Cluster-A remediation "CONTRIBUTEUR on project A gets 403 on project B"):
- CONTRIBUTEUR (non-member) → 403 on `POST /epics`, `POST /milestones`,
  `POST /milestones/project/:id/import` for a project B they don't belong to;
- a `leaves:create`-only role → 403 on `POST /leaves/import` and `POST /planning-export/ics/import`.
Runnable LOCAL-only per `project_e2e_local_run_recipe`; **not written/run in this session** — flagged so
the completion claim is honest. (Deploy is separate and also outstanding — COR-028 is a LIVE prod 500.)

**Caveat on the triage:** refutation targeted over-ACCEPTANCE (the costlier false-accept). The 17
**WONT_FIX** and 102 **REAL_DEFERRED** verdicts are single-pass (Sonnet) calls, logged as real-but-
deprioritised — confirm before treating as settled.
