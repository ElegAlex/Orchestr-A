# Adversarial Code Review — Orchestr'A V2

**Report date:** 2026-06-04 · **Commit:** `0997b30e2d44` · **Verdict:** `BLOCKING-ISSUES`

> 7 confirmed blocking findings remain after live verification downgraded the SEC-001 'plaintext prod' claim (prod terminates TLS via a certbot-managed host nginx with a valid Let's Encrypt cert and http->https redirect). The blockers still span authorization bypass (any delegate approves any leave), data-loss windows (audit SET-NULL gap, missing TaskRACI FK), a non-transactional task import, and a CI boot failure that blocks E2E. With 155 important findings concentrated in systemic themes (transactions, IDOR, unbounded queries, audit coverage), the system cannot ship until at least the blocking set and the highest-leverage important clusters are remediated.

## Executive summary

| Severity | Count |
|---|---:|
| 🔴 Blocking | 7 |
| 🟠 Important | 155 |
| 🟡 Nit | 99 |
| 🔵 Suggestion | 7 |
| **Total** | **268** |

| Category | Findings |
|---|---:|
| Security | 66 |
| Correctness | 69 |
| Data integrity | 31 |
| Performance | 61 |
| Observability | 29 |
| Tests | 12 |
| **Total** | **268** |

**Coverage asserted (closed-loop vs ground truth):** 35/35 controllers · 73/73 migrations · 30/30 pages · 227 test files · 0 untracked source files.

**Method & assurance.** Six-dimension sharded fan-out (40 read-only finder shards) → per-shard adversarial refutation → closed-loop coverage. 268 findings confirmed after the refutation wave dropped 13 candidates. Findings touch 123 distinct files and collapse into 16 root-cause clusters. Every finding below was re-read at its cited line and its code evidence confirmed verbatim; low-confidence survivors are tagged. All numbers are computed deterministically from the persisted finding files, not self-reported by agents.

## Posture & analysis

## Overall posture

Orchestr'A is a structurally sound application with a few genuinely strong controls, but its production edge and several systemic patterns are not yet trustworthy. A read-only live check (2026-06-04) overturned the headline SEC-001 alarm: the committed nginx.conf ships no TLS block, but production actually terminates TLS at a host-level certbot nginx (valid Let's Encrypt cert for orchestr-a.com, http-to-https 301), so it is not plaintext. SEC-001 is downgraded to important — the real residue is that HSTS is absent and the working TLS edge lives outside version control. Paired with an authorization bypass in leave delegation (COR-001/SEC-009, any delegate can approve any leave) and a CI configuration that cannot even boot the API in E2E (OBS-001/SEC-002), the blocking set touches confidentiality, integrity and the ability to verify the system at all. The verdict remains blocking-issues: 7 blocking plus 155 important findings clustered around recurring root causes, not one-off slips.

## Dominant themes

The findings collapse into a handful of transversal root causes rather than 268 independent bugs. The largest are: missing input validation and DTO hardening (cluster F, 36 findings — absent @MaxLength/@ArrayMaxSize/@IsUUID and unvalidated date params); missing database constraints (cluster I, 30 — no FK on TaskRACI.userId, unindexed FKs, DOUBLE PRECISION on HR hours/days, absent 0-100 CHECKs); unbounded/over-fetching list endpoints (cluster D, 29 — page caps of 1000 or no pagination at all); audit coverage gaps (cluster G, 20 — whole modules emit no audit row on writes); frontend resilience (cluster M, 26 — no error boundaries, stale-closure permission checks); and N+1 / sequential-write loops in imports and recurring-rule expansion (cluster E, 20). Authorization scope (cluster A) and missing transaction boundaries (cluster B) are smaller but contain the most dangerous individual bugs.

## What is genuinely solid

The architecture has real strengths the audit confirms. RBAC v4 resolves permissions at compile-time from role templates (no DB role_permissions lookups), which is a clean, hard-to-bypass design. There is a hash-chained, trigger-protected immutable audit log — a control most apps of this class lack entirely. Recent DAT/PER migrations show the team is already adding FK indexes and constraint coverage proactively. The permission matrix and per-role E2E discipline are codified in CLAUDE.md and largely followed. The problems are not architectural rot; they are consistency gaps where good patterns were not applied uniformly.

## The two ledger ironies

The strongest control is partially undermined by the same cluster of defects (clusters G and H). The hash-chain ledger exists, but ~14 modules never write to it (so most state change is invisible), the immutability trigger was added 31 days after the table — leaving a SET-NULL window (DAT-001) — and does not cover TRUNCATE (DAT-013), so the entire ledger can still be wiped. The hash payload also normalizes undefined keys inconsistently (COR-006). Fixing the ledger gaps is high-leverage precisely because the foundation is already there.

## Highest-leverage fixes first

Phase 1 should close the seven blockers and the clusters that share their root cause: add HSTS and bring the already-working (out-of-repo) TLS edge into version control, and stop trusting client proxy headers (L); scope canValidate() to the assigned validator and add one reusable project/task-scope guard reused across every IDOR-prone endpoint (A); wrap compound writes — including audit emission — in transactions (B) and back uniqueness/quota invariants with DB constraints to kill the TOCTOU races (C); run one migration wave for the missing FK, covering indexes, NUMERIC HR columns and CHECK constraints (I); harden the audit trigger and hash canonicalization (H); set AUDIT_HASH_KEY in CI and fix the contradicting clients spec so the test suite is trustworthy again (K, O); and bump JWT not-before on every credential change (N).

## Phase 2 and 3

Phase 2 is the broad-but-mechanical work: a DTO validation sweep (F), pagination caps and select projections across list endpoints (D), bulk-write/createMany conversions to remove N+1 loops (E), audit instrumentation for the remaining modules (G), and a timezone-aware calendar utility to eliminate the DST off-by-ones (J). Phase 3 is frontend resilience — error boundaries, effect-dependency fixes and TanStack Query caching (M). Most phase-2 items are amenable to a codemod or shared-helper approach, so the 155 important findings are far less daunting than the raw count suggests once attacked at the cluster level.

## Top blocking findings

### DAT-001 — audit_logs created with ON DELETE SET NULL — immutability trigger added 31 days later, leaving a window where audit rows could be silently mutated
`🔴 blocking` · **data_integrity** · `packages/database/prisma/migrations/20260424111457_add_weight_and_audit_log/migration.sql:24` · cluster H

- **Impact:** Any user deletion between 2026-04-24 and 2026-05-25 that had associated audit_logs rows permanently erased the actor identity in those rows; audit trail is no longer reliable for that period. Compliance and forensic audits may be affected.
- **Root cause:** The immutability trigger and the FK ON DELETE behavior were designed together but deployed in two separate migrations 31 days apart, leaving the audit table mutable in the interim.
- **Fix:** Verify prod audit_logs for rows where actorId IS NULL and actorEmail (if added) is also NULL — these may be the result of the SET NULL window. Additionally, the original migration should have set ON DELETE RESTRICT or NO ACTION to protect immutability from the start. Document the window in a SECURITY_NOTE.
- **Verify:** `SELECT COUNT(*) FROM audit_logs WHERE "actorId" IS NULL AND "createdAt" < '2026-05-25';`

### COR-001 — canValidate: delegation check is not scoped to the leave's assigned validator — any delegate can approve any leave
`🔴 blocking` · **correctness** · `apps/api/src/leaves/leaves.service.ts:1638-1650` · cluster A

- **Impact:** Any user who has received at least one active delegation from any manager can approve or reject any pending leave request in the entire organisation, regardless of service scope. This is a complete authorization bypass for the approval workflow.
- **Root cause:** The `findFirst` query filters on `delegateId` only, omitting the join condition `delegatorId = leave.validatorId` that would scope the delegation to the leave's actual assigned validator.
- **Fix:** Add `delegatorId: leave.validatorId` to the where clause (requires the leave be fetched with its `validatorId`). If `leave.validatorId` is null (no validator assigned), the delegation fallback should return false. Example fix: ```ts if (leave.validatorId) {   const activeDelegation = await this.prisma.leaveValidationDelegate.findFirst({     where: {       delegatorId: leave.validatorId,       delegateId: validatorId,       isActive: true,       startDate: { lte: today },       endDate: { gte: today },     },   });   if (activeDelegation) return true; } return false;
- **Verify:** `npx jest --testPathPattern leaves.service.spec --no-coverage 2>&1 \| grep -E 'PASS\|FAIL\|canValidate'`

### COR-002 — importTasks: task created but subtasks written outside transaction — partial failure leaves orphaned task row
`🔴 blocking` · **correctness** · `apps/api/src/tasks/tasks.service.ts:1451-1482` · cluster B

- **Impact:** Orphaned task rows in the DB (no subtasks despite CSV specifying them); repeated imports will report the title as duplicate and skip it; data integrity inconsistency visible to end users.
- **Root cause:** No database transaction wraps the task.create + subtask.create sequence, so failure between them leaves partially-written data.
- **Fix:** Wrap the entire per-task block (task.create + all subtask.create) in a prisma.$transaction(). Move the duplicate check inside the transaction using upsert semantics or rely on a DB unique constraint to avoid the TOCTOU gap.
- **Verify:** `grep -n 'prisma.task.create\\|prisma.subtask.create\\|\$transaction' apps/api/src/tasks/tasks.service.ts \| head -30`

### COR-003 — findAll auto-expand writes telework rows for ALL users when a non-privileged caller supplies startDate+endDate without userId
`🔴 blocking` · **correctness** · `apps/api/src/telework/telework.service.ts:164-182` · cluster C

- **Impact:** Any authenticated user with telework:read can trigger mass materialisation of other users' telework_schedule rows, violating data ownership and introducing false telework entries that would appear in team-view reports and planning overviews. Reverse: a record created this way looks identical to a user-declared one and cannot be distinguished in the UI.
- **Root cause:** The expansion call uses the raw `userId` query param instead of the already-scope-narrowed `where.userId`, so the side-effect bypasses the permission gate applied to the read.
- **Fix:** Pass the actually-enforced user scope to expandRecurringRulesForRange. Replace line 181 with:   `await this.expandRecurringRulesForRange(startDate, endDate, where.userId as string \| undefined);` This ensures non-privileged calls expand only the authenticated user's rules, while admin calls with an explicit userId= filter expand that user's rules, and admin calls without a filter expand all (intended).
- **Verify:** `grep -n 'expandRecurringRulesForRange' apps/api/src/telework/telework.service.ts`

### DAT-002 — TaskRACI.userId has no FK relation — orphaned RACI rows, no cascade on user deletion
`🔴 blocking` · **data_integrity** · `packages/database/prisma/schema.prisma:405-417` · cluster I

- **Impact:** After a User deletion (soft or hard), stale RACI rows survive referencing a non-existent userId. Queries joining task_raci on users will silently return no validator/responsible data. If userId is reused (UUID collision is astronomically unlikely but app logic may reuse logins), wrong user gets RACI assignment. No cascade means security-sensitive RACI data (RESPONSIBLE, ACCOUNTABLE) is never cleaned up.
- **Root cause:** The `user` relation side was omitted from TaskRACI when the model was created, leaving userId as a plain String with no FK backing.
- **Fix:** Add the FK relation on TaskRACI and the back-relation on User:  // In model TaskRACI, add:   user User @relation(fields: [userId], references: [id], onDelete: Cascade)  // In model User, add to the relations block:   taskRaci TaskRACI[]  Then generate and apply a migration:   pnpm run db:migrate  The migration will add a FK constraint `REFERENCES users(id)` on task_raci.user_id and a cascade delete trigger consistent with the TaskAssignee pattern.
- **Verify:** `psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_name LIKE '%task_raci%user%';"`

### OBS-001 — AUDIT_HASH_KEY never set in CI — API cannot boot in E2E jobs
`🔴 blocking` · **observability** · `.github/workflows/ci.yml:262-273` · cluster K

- **Impact:** E2E smoke tests and full E2E suite will always fail in CI because the API cannot boot. Every push to master or any PR targeting master breaks the e2e-smoke and e2e-tests jobs. The bug is latent if the tests were never run in CI or were passing via some other mechanism (pre-built image, skip), but as written the workflow is broken.
- **Root cause:** assertAuditHashKey is enforced universally (intentional by OBS-028 design), but the CI e2e job environment blocks were never updated to provide a non-production test value for AUDIT_HASH_KEY.
- **Fix:** Add AUDIT_HASH_KEY to the env block of every 'Start Backend API' step in both e2e-smoke and e2e-tests jobs, using a stable but non-secret test value of at least 32 chars. Example: AUDIT_HASH_KEY: 'ci-test-audit-hash-key-32-chars!!'. Also add it to the Build Applications step in case the build exercises any boot-path code.
- **Verify:** `grep -n 'AUDIT_HASH_KEY' .github/workflows/ci.yml`

### TST-001 — clients.spec.ts Suite 6 asserts HTTP 200 for contributeur on GET /api/clients, contradicting the permission matrix and the generated INTERDIT test
`🔴 blocking` · **tests** · `e2e/clients.spec.ts:657-680` · cluster O

- **Impact:** One of the two conflicting assertions always fails: either Suite 6's 200-for-contributeur fails (if RBAC is correct), or the INTERDIT 403-for-contributeur from api-permissions.spec.ts fails (if the endpoint is accidentally open). In a correct deployment, Suite 6 fails on every CI run for contributeur.
- **Root cause:** Suite 6 was written with the incorrect assumption that all roles can read clients; the actual RBAC template for BASIC_USER excludes PROJECT_STRUCTURE_READ (which contains clients:read).
- **Fix:** Remove `contributeur` from the allRoles array in Suite 6. The corrected array should be `['admin', 'responsable', 'manager', 'referent', 'observateur']` — matching the `allowedRoles` in the permission matrix for `clients:read`. Optionally add a separate denial test for `contributeur` expecting 403.
- **Verify:** `grep -A20 'Lecture autorisée pour tous les rôles' e2e/clients.spec.ts \| grep contributeur`

### DAT-010 — RBAC V4 drops role_permissions, permissions, role_configs tables and users.role column with no backup or preflight verification
`🟠 important` · **data_integrity** · `packages/database/prisma/migrations/20260420120000_rbac_v4_drop_legacy/migration.sql:1-19` · cluster P

- **Impact:** If V0's check was bypassed or the DB was in an intermediate state (partial backup restore, manual migration replay), V4 permanently destroys RBAC data for all users. In normal sequential Prisma migration deployment V0 must pass before V4 can run — but on partial DB restores or manual replay this ordering is not enforced.
- **Root cause:** The migration relies on a comment warning ('ensure backup') and the upstream V0 verification, but adds no self-contained guard to confirm the RBAC migration state before executing destructive DDL.
- **Fix:** Add a preflight DO block before the DROPs: DO $$ DECLARE null_count INTEGER; BEGIN SELECT COUNT(*) INTO null_count FROM users WHERE "roleId" IS NULL; IF null_count > 0 THEN RAISE EXCEPTION 'RBAC V4 preflight: % users still have NULL roleId — abort DROP', null_count; END IF; END $$;
- **Verify:** `SELECT COUNT(*) FROM users WHERE "roleId" IS NULL;`

### DAT-013 — audit_logs immutability trigger does not cover TRUNCATE — entire ledger can be wiped silently
`🟠 important` · **data_integrity** · `packages/database/prisma/migrations/20260525190000_audit_logs_immutability_hash_chain_actor_snapshot/migration.sql:120-122` · cluster H

- **Impact:** Any role with TRUNCATE privilege on audit_logs (typically the database owner, superuser, or the application role if not explicitly revoked) can silently destroy the entire audit ledger. This directly voids the Cour-des-Comptes audit trail guarantee that DAT-009/OBS-002 were designed to enforce. The hash chain and actor snapshots are also wiped, making post-hoc integrity verification impossible. Partial mitigation exists: packages/database/prisma/init-roles.sql line 57 revokes TRUNCATE from app_user (runtime role), so the application runtime path is blocked. However the schema-owning role (orchestr_a/POSTGRES_USER, the migration role) retains TRUNCATE privilege and no statement-level TRUNCATE trigger exists to block it.
- **Root cause:** `FOR EACH ROW BEFORE UPDATE OR DELETE` triggers are not fired by TRUNCATE in PostgreSQL; only a statement-level `BEFORE TRUNCATE` trigger can intercept it.
- **Fix:** Add a statement-level TRUNCATE trigger on audit_logs using the same function: ```sql CREATE TRIGGER audit_logs_no_truncate   BEFORE TRUNCATE ON "audit_logs"   FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable(); ``` Also revoke TRUNCATE privilege from the application role (defense-in-depth): ```sql REVOKE TRUNCATE ON audit_logs FROM <app_role>; ``` The `audit_logs_immutable()` function already raises a generic `check_violation` exception regardless of TG_OP, so it will work correctly for TRUNCATE without modification.
- **Verify:** `psql $DATABASE_URL -c "TRUNCATE audit_logs;" 2>&1 \| grep 'audit_logs is append-only'`

### SEC-001 — Committed nginx.conf has no :443 TLS block; live TLS is terminated by an out-of-repo host nginx (IaC drift) and HSTS is absent
`🟠 important` · **security** · `nginx/nginx.conf:87-194` · cluster L

- **Impact:** Verified read-only against live prod (2026-06-04): production is NOT plaintext. A host-level certbot-managed nginx (Let's Encrypt cert CN=orchestr-a.com, valid 2026-05-20..2026-08-18) terminates TLS on :443 and 301-redirects http->https, proxying to the inner container on 127.0.0.1:8080. Residual risks: (1) HSTS absent (no Strict-Transport-Security header) -> first-request SSL-strip/downgrade window; (2) the TLS edge exists only on the box, not in the repo or docker-compose.prod.yml -> unreviewable, not reproducible from version control.
- **Root cause:** The nginx.conf was written with a comment stating 'behind host nginx SSL proxy', but TLS termination is never actually configured either in this file or verifiably in any other shipped artifact.
- **Fix:** (1) Add 'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;' to the :443 server. (2) Bring the host nginx TLS terminator into version control / IaC (or move the 443+certbot config into the committed nginx.conf and publish 443 from the container) so the edge is reproducible and reviewable. (3) Confirm TLSv1/1.1 are effectively disabled (live http-context ssl_protocols still lists them; certbot include sets 1.2/1.3).
- **Verify:** `curl -sSI --resolve orchestr-a.com:443:92.222.35.25 https://orchestr-a.com/ \| grep -i strict-transport-security  # expect HSTS header present after fix`

## Cluster analysis

Root-cause clusters, ordered by remediation phase (1 = now / blocking, 2 = next, 3 = later).

### Cluster A — Missing or client-side authorization scope (IDOR / broken access control)  ·  Phase 1  ·  20 findings
**Root cause.** List, detail and mutation endpoints resolve resources by id without re-asserting that the caller belongs to the parent project/task, and the leave-delegation fallback grants approve rights org-wide instead of binding the delegate to the assigned validator. Some auth decisions are also computed in the React/Zustand layer rather than enforced by the API.

**Transversal remediation.** Introduce a single reusable project/task-scope guard (assertCanAccess(parent, user)) and apply it uniformly across every list and id-addressed mutation; scope canValidate() to the leave's assigned validator + active delegation only; remove all client-side gating and rely on API-returned canEdit/canDelete flags; soft-delete-aware where filters everywhere.

**Findings:** COR-001, SEC-009, SEC-004, SEC-006, SEC-013, COR-057, SEC-017, SEC-022, COR-029, SEC-025, SEC-026, SEC-056, SEC-027, SEC-065, COR-009, COR-010, SEC-029, SEC-030, COR-032, COR-051

### Cluster B — Missing transaction boundaries on multi-write operations  ·  Phase 1  ·  11 findings
**Root cause.** Several services perform a sequence of dependent writes (parent + children, delete + audit, count + delete, deleteMany + createMany) with no enclosing prisma.$transaction, so a partial failure or crash leaves orphaned rows, missing audit records, or inconsistent membership state.

**Transversal remediation.** Wrap every compound write (import parent+subtasks, recurring-event expansion, hard-delete+audit, balance delete+audit, membership re-sync, settings bulk upsert) in a single interactive transaction; move audit-log writes inside the same transaction so the ledger never records an action that did not commit.

**Findings:** COR-002, COR-007, COR-008, COR-012, COR-017, COR-025, COR-026, COR-040, COR-060, COR-053, COR-055

### Cluster C — TOCTOU races on check-then-write paths  ·  Phase 1  ·  15 findings
**Root cause.** Uniqueness, quota and singleton invariants (20-todo cap, daily telework cap, duplicate names/dependencies/dismissals, isDefault role, password-reset token consumption) are enforced with a read followed by a separate write, with no DB-level guarantee, so concurrent requests both pass the check.

**Transversal remediation.** Replace check-then-create with DB-enforced uniqueness (unique/partial indexes + upsert/ON CONFLICT) and catch P2002/P2025 into domain errors; gate counters and caps with row locks (SELECT ... FOR UPDATE) or atomic conditional writes; mark reset tokens used inside the same transaction that validates them.

**Findings:** COR-003, COR-018, COR-019, COR-021, COR-031, COR-033, COR-036, COR-037, COR-038, COR-050, COR-052, COR-054, COR-056, COR-059, COR-061

### Cluster H — Audit ledger immutability and hash-chain integrity gaps  ·  Phase 1  ·  6 findings
**Root cause.** The immutability trigger was added 31 days after table creation (leaving a SET-NULL/CASCADE window), does not cover TRUNCATE, and an ON UPDATE CASCADE remains on actorId; AuditService passes undefined-valued keys to computeRowHash producing a normalization mismatch; cascade UPDATEs and retention are unaudited/undeclared.

**Transversal remediation.** Harden the trigger to block UPDATE/DELETE/TRUNCATE, remove residual cascade behaviors on audit FKs, canonicalize the hash payload (strip undefined before computeRowHash, respecting the sealed-segment boundary), and define an enforced retention/archival policy.

**Findings:** DAT-001, DAT-013, DAT-028, COR-006, DAT-030, OBS-020

### Cluster I — Missing database constraints: FKs, indexes, CHECKs, float HR columns  ·  Phase 1  ·  30 findings
**Root cause.** TaskRACI.userId has no FK and TaskDependency.dependsOnTaskId/UserSkill.skillId/TeleworkSchedule have no covering indexes; HR-sensitive hours/days use DOUBLE PRECISION; percentage/progress/day columns lack 0-100 / >0 CHECKs; a nullable unique treats NULLs as distinct; several cascades destroy HR/billing/audit history.

**Transversal remediation.** Migration wave: add the missing FK on TaskRACI.userId, add covering indexes on all unindexed FKs (CREATE INDEX CONCURRENTLY), convert HR hours/days to NUMERIC, add CHECK constraints on percentages/progress/days, replace cascades that delete HR/billing/audit history with RESTRICT/SET NULL, and fix the nullable-unique semantics. Backfill-clean before adding constraints.

**Findings:** DAT-002, PER-036, DAT-017, PER-035, DAT-018, DAT-003, DAT-004, DAT-005, DAT-006, DAT-007, DAT-008, DAT-009, DAT-011, DAT-012, DAT-015, DAT-016, DAT-019, DAT-020, DAT-021, DAT-022, DAT-023, DAT-024, DAT-025, DAT-026, DAT-027, DAT-029, DAT-031, PER-055, PER-060, DAT-014

### Cluster K — CI boot failure, error reporting and deploy observability  ·  Phase 1  ·  6 findings
**Root cause.** AUDIT_HASH_KEY is never set in CI so the API cannot boot in E2E jobs; external error reporters (Sentry/GlitchTip/OTel) are no-op stubs so 500s vanish; the deploy job only echoes; the health endpoint leaks component status and the profile page fabricates last-login.

**Transversal remediation.** Set AUDIT_HASH_KEY (and other required secrets) in CI so E2E can boot; wire a real error reporter for unhandled exceptions/500s; implement a genuine VPS deploy step or stop claiming one; reduce health-endpoint detail for unauthenticated callers and source last-login from real data.

**Findings:** OBS-001, SEC-002, OBS-005, OBS-029, OBS-019, SEC-007

### Cluster N — Session not invalidated on credential change  ·  Phase 1  ·  2 findings
**Root cause.** Admin reset-password and self change-password do not bump the per-user JWT not-before, so tokens minted before the credential change remain valid until natural expiry, undermining account-takeover recovery and forced logout.

**Transversal remediation.** Call jwtNotBefore.bumpUser(userId) inside the same transaction as every password reset/change (and ideally role downgrade), and verify nbf in all auth hooks including the uploads hook.

**Findings:** SEC-028, COR-039

### Cluster O — Test correctness and coverage gaps  ·  Phase 1  ·  12 findings
**Root cause.** A spec asserts 200 for contributeur on GET /clients, contradicting the permission matrix; 13 controllers lack specs; several specs are happy-path only; E2E uses UI login with hardcoded admin creds; the core RBAC matrix test carries no @smoke tag; weak assertions and conditional skips mask regressions.

**Transversal remediation.** Fix the contradicting clients spec to match the matrix; add missing controller specs and error/auth-failure cases; switch E2E to API-based auth with storage states; tag the RBAC matrix test @smoke; tighten weak assertions and remove silent skips; add migration-level constraint tests.

**Findings:** TST-001, TST-002, TST-003, TST-004, TST-005, TST-006, TST-007, TST-008, TST-009, TST-010, TST-011, TST-012

### Cluster D — Unbounded list endpoints, oversized page caps and over-fetching  ·  Phase 2  ·  29 findings
**Root cause.** List endpoints default/cap page size at 1000 (or are entirely unpaginated) and read full rows without select projections; several materialize all rows then filter or compute in JS. Result sets and date-range expansions are unbounded, exposing memory/CPU amplification.

**Transversal remediation.** Adopt a shared pagination DTO with a hard max (e.g. 100), enforce it in every findAll; add select projections to hot queries; push isActive/scope filters into the WHERE clause instead of post-fetch JS; bound date-range and array-fan-out inputs; cache the JwtStrategy user lookup.

**Findings:** PER-001, PER-006, PER-008, PER-015, PER-016, PER-017, PER-018, PER-019, PER-021, PER-022, PER-025, PER-027, PER-041, PER-043, PER-044, PER-046, PER-047, PER-049, PER-050, PER-051, PER-052, PER-054, PER-056, PER-057, PER-061, COR-062, SEC-024, PER-037, PER-040

### Cluster E — N+1 queries and sequential writes inside loops  ·  Phase 2  ·  20 findings
**Root cause.** Bulk imports and recurring-rule/occurrence generation issue one DB round-trip per row (findFirst+create, INSERT per user×date, per-occurrence create), and several authorization/aggregation helpers run redundant or per-node queries (BFS dependency checks, double project.count).

**Transversal remediation.** Replace per-row loops with createMany/updateMany or a single bulk upsert; precompute lookup sets (holidays, validators, existing keys) once before the loop; batch occurrence generation; collapse redundant authorization queries into one. Combine with cluster B so the batched writes share a transaction.

**Findings:** PER-005, PER-007, PER-010, PER-011, PER-012, PER-013, PER-014, PER-020, PER-023, PER-024, PER-026, PER-028, PER-029, PER-030, PER-039, PER-045, PER-053, PER-002, PER-003, PER-004

### Cluster F — Missing input validation and DTO hardening (payload DoS)  ·  Phase 2  ·  36 findings
**Root cause.** Many DTOs omit @MaxLength on free-text fields, @ArrayMaxSize on bulk arrays, @IsUUID/@IsEmail on id/email fields, and @Min/@IsInt on numerics; several route params lack ParseUUIDPipe/ParseEnumPipe and date strings flow straight into new Date(). This permits oversized writes, bcrypt CPU exhaustion and 500s instead of 400s.

**Transversal remediation.** Sweep all DTOs to add @MaxLength, @ArrayMaxSize, @IsUUID, @IsEmail, @IsInt/@Min; apply ParseUUIDPipe/ParseEnumPipe on path/query params; validate and parse date strings centrally (reject invalid). A lint/codemod over dto files plus a few shared validator constants can land most of these in one pass.

**Findings:** SEC-003, SEC-005, SEC-008, SEC-014, SEC-018, SEC-019, SEC-020, SEC-035, SEC-037, SEC-038, SEC-040, SEC-042, SEC-044, SEC-046, SEC-047, SEC-052, SEC-053, SEC-054, SEC-057, SEC-058, SEC-059, COR-011, SEC-015, SEC-016, SEC-021, SEC-023, SEC-039, SEC-041, SEC-043, SEC-045, SEC-048, SEC-049, SEC-051, SEC-055, SEC-060, SEC-066

### Cluster G — Audit-log coverage gaps on mutating operations  ·  Phase 2  ·  20 findings
**Root cause.** Whole modules (clients, documents, telework, third-parties, time-tracking, settings, comments, events, projects, tasks, users-import, delegation, logout, project-members) emit no audit_log row on create/update/delete, and one action is mislabeled. The hash-chained ledger exists but large swaths of state change are invisible to it.

**Transversal remediation.** Define a standard audit emission point (interceptor or service helper) and instrument every write path with the correct action code and actor identity; persist requestId/correlation id; add the missing logout, delegation and rejectCancellation transitions; fix the mislabeled reset action.

**Findings:** OBS-002, OBS-003, OBS-004, OBS-006, OBS-007, OBS-008, OBS-009, OBS-010, OBS-011, OBS-012, OBS-013, OBS-014, OBS-015, OBS-016, OBS-017, OBS-022, OBS-024, OBS-025, OBS-021, COR-014

### Cluster J — Timezone- and DST-naive date arithmetic  ·  Phase 2  ·  10 findings
**Root cause.** Working-day counts, year/balance windows, week boundaries, snapshot dedup and ICS export use host-local getDate/setDate/setHours/getFullYear and fixed MS_PER_DAY instead of an explicit Paris/UTC calendar, producing off-by-one days across DST and host-TZ drift on a UTC server.

**Transversal remediation.** Centralize all calendar math in one timezone-aware utility pinned to Europe/Paris (or explicit UTC midnight), replace ad-hoc Date arithmetic, and add DST-boundary unit tests; ensure leave queries select the half-day fields needed for correct day counting.

**Findings:** COR-013, COR-016, COR-022, COR-023, COR-034, COR-035, COR-048, COR-064, COR-015, COR-020

### Cluster L — Edge security: HSTS, out-of-repo TLS config, proxy-header trust  ·  Phase 2  ·  15 findings
**Root cause.** Live read-only verification (2026-06-04) disproved the 'plaintext prod' premise: a host-level certbot nginx terminates TLS (valid Let's Encrypt cert) and 301-redirects http->https; the committed nginx.conf is the inner container behind it. The residual edge issues are real but not blocking: HSTS is absent; the TLS terminator is out-of-repo (IaC drift); the proxy forwards client-supplied Host and X-Forwarded-Proto; CSP/framing directives are incomplete and conflicting; metrics use non-constant-time token compare and unsanitized label paths; dev exposes DB/Redis on all interfaces.

**Transversal remediation.** Add a proper listen 443 ssl http2 block with TLS1.2/1.3, HTTP-to-HTTPS redirect and HSTS; set Host/X-Forwarded-Proto from $host/$scheme; complete CSP (object-src/base-uri) and align framing; use constant-time token comparison and bounded sanitized metric labels; bind dev DB/Redis to localhost.

**Findings:** SEC-001, SEC-031, SEC-032, SEC-033, SEC-061, SEC-063, SEC-064, SEC-062, SEC-010, SEC-011, SEC-012, PER-009, SEC-034, SEC-036, OBS-023

### Cluster P — Destructive migrations and unsafe DDL  ·  Phase 2  ·  2 findings
**Root cause.** The RBAC V4 migration drops role_permissions/permissions/role_configs tables and users.role with no preflight guard or backout, risking irreversible prod data loss; a trigger-name DDL is built via $executeRawUnsafe with string interpolation.

**Transversal remediation.** Gate destructive drops behind explicit preflight checks/feature flags with verified backups and a documented rollback; parameterize or whitelist DDL identifiers instead of unsafe interpolation; require dump+diff review before any prod-affecting migration.

**Findings:** DAT-010, SEC-050

### Cluster M — Frontend resilience: error boundaries, stale closures, query caching  ·  Phase 3  ·  26 findings
**Root cause.** No React/Next error.tsx anywhere, so a render throw blanks the app; several useCallback effects omit hasPermission deps (stale permission closures); fire-and-forget promises swallow failures; pages use manual fetch+useState with no TanStack Query cache and an isolated module-scope QueryClient; some unhandled mutation errors fail silently.

**Transversal remediation.** Add error.tsx boundaries per route segment; fix effect dependency arrays (or read permissions from a stable selector); attach .catch handlers and surface mutation errors; standardize on the app's shared QueryClient with TanStack Query caching; remove redundant permission fetches and dead UI.

**Findings:** OBS-018, OBS-026, OBS-027, OBS-028, COR-042, COR-043, COR-044, COR-046, COR-047, COR-067, COR-068, COR-069, COR-041, COR-065, COR-066, COR-045, PER-033, PER-058, PER-059, PER-031, PER-032, PER-034, PER-038, PER-042, PER-048, COR-049

## Findings by category (exhaustive)

Every confirmed finding is listed individually. Full structured detail (description, impact, suggested fix, acceptance criteria, verification command, confidence) is in `findings.json`.

### Security — 66 findings

| ID | Severity | Location | Cluster | Title |
|---|---|---|---|---|
| SEC-002 | 🟠 important | `.github/workflows/ci.yml:263-272` | K | CI e2e-smoke and e2e-tests jobs start the API without AUDIT_HASH_KEY, causing assertAuditHashKey() to abort in all environments |
| SEC-003 | 🟠 important | `apps/api/src/auth/dto/login.dto.ts:13-19` | F | LoginDto.password has no @MaxLength — long password input allows DoS via bcrypt CPU exhaustion _(conf: medium)_ |
| SEC-004 | 🟠 important | `apps/api/src/clients/clients.service.ts:290-298` | A | GET /projects/:projectId/clients — missing project-scope access check (IDOR) |
| SEC-005 | 🟠 important | `apps/api/src/comments/dto/create-comment.dto.ts:9-11` | F | CreateCommentDto.content and UpdateCommentDto.content lack @MaxLength — unbounded free-text field |
| SEC-006 | 🟠 important | `apps/api/src/epics/epics.service.ts:30-57` | A | epics findAll and milestones findAll return all records regardless of project membership |
| SEC-007 | 🟠 important | `apps/api/src/health/health.service.ts:78-86` | K | Unauthenticated health endpoint reveals per-component infrastructure status (DB/Redis) to any caller |
| SEC-008 | 🟠 important | `apps/api/src/leaves/dto/import-leaves.dto.ts:61-70` | F | ImportLeavesDto.leaves array has no upper-bound limit, enabling memory-exhaustion via large payloads |
| SEC-009 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:1638-1650` | A | canValidate() delegation fallback grants approve rights across the entire org, bypassing service-scope |
| SEC-010 | 🟠 important | `apps/api/src/main.ts:198-200` | L | Swagger Basic Auth: passwords containing ':' are silently truncated, enabling credential bypass with a shorter guessable suffix |
| SEC-011 | 🟠 important | `apps/api/src/metrics/metrics.controller.ts:33` | L | Metrics METRICS_TOKEN comparison uses non-constant-time string equality |
| SEC-012 | 🟠 important | `apps/api/src/metrics/metrics.service.ts:37` | L | Prometheus metric labels built from unsanitized req.path — label injection possible |
| SEC-013 | 🟠 important | `apps/api/src/milestones/milestones.service.ts:162-168` | A | POST /milestones/:id/complete lacks project-membership check |
| SEC-014 | 🟠 important | `apps/api/src/predefined-tasks/dto/bulk-assignment.dto.ts:22-39` | F | BulkAssignmentDto.userIds and BulkAssignmentDto.dates have no @ArrayMaxSize — cartesian product DoS |
| SEC-015 | 🟠 important | `apps/api/src/projects/projects.controller.ts:183-196` | F | GET /projects/:id/snapshots uses @Param('id') without ParseUUIDPipe |
| SEC-016 | 🟠 important | `apps/api/src/projects/projects.service.ts:1244-1249` | F | Snapshot date filter params (from/to) are not validated and passed directly to new Date() |
| SEC-017 | 🟠 important | `apps/api/src/projects/projects.service.ts:833-886` | A | hardDelete lacks defense-in-depth ownership assertion present in all sibling mutation methods |
| SEC-018 | 🟠 important | `apps/api/src/skills/dto/import-skills.dto.ts:46-55` | F | ImportSkillsDto.skills array has no @ArrayMaxSize — sequential DB writes enable per-request DoS |
| SEC-019 | 🟠 important | `apps/api/src/tasks/dto/create-task.dto.ts:223-224` | F | CreateTaskDto.tags field has no @IsArray / @IsString({ each }) / @MaxLength validators — arbitrary data injection _(conf: medium)_ |
| SEC-020 | 🟠 important | `apps/api/src/tasks/dto/import-tasks.dto.ts:78-87` | F | ImportTasksDto.tasks has no @ArrayMaxSize — unbounded bulk import enabling DoS |
| SEC-021 | 🟠 important | `apps/api/src/tasks/tasks.controller.ts:407-429` | F | DELETE /tasks/:taskId/raci/:userId/:role — :role path param is unvalidated (no ParseEnumPipe) |
| SEC-022 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:2039-2061` | A | reorderSubtasks does not verify that subtaskIds belong to the taskId — cross-task IDOR |
| SEC-023 | 🟠 important | `apps/api/src/telework/dto/create-telework.dto.ts:23-25` | F | userId in CreateTeleworkDto and CreateRecurringRuleDto uses @IsString() instead of @IsUUID() |
| SEC-024 | 🟠 important | `apps/api/src/telework/telework.service.ts:180-182` | D | Unbounded date range in GET /telework triggers O(days × rules) sequential DB queries with no upper bound |
| SEC-025 | 🟠 important | `apps/api/src/third-parties/third-parties.service.ts:310-321` | A | GET /tasks/:taskId/third-party-assignees — missing task-scope access check (IDOR) |
| SEC-026 | 🟠 important | `apps/api/src/third-parties/third-parties.service.ts:323-334` | A | GET /projects/:projectId/third-party-members — missing project-scope access check (IDOR) |
| SEC-027 | 🟠 important | `apps/api/src/users/users.controller.ts:430-431` | A | POST /users/:id/reset-password uses 'users:manage_roles' permission — semantically wrong and may grant unintended reset capability to role managers |
| SEC-028 | 🟠 important | `apps/api/src/users/users.service.ts:1089-1159` | N | Admin password reset (POST /users/:id/reset-password) does not bump JWT nbf, leaving existing access tokens valid for up to 15 min |
| SEC-029 | 🟠 important | `apps/web/app/[locale]/leaves/page.tsx:776-786` | A | Leave cancellation request button gated by client-side userId comparison instead of API canRequestCancel flag |
| SEC-030 | 🟠 important | `apps/web/app/[locale]/users/[id]/suivi/page.tsx:95-111, 168-170, 181-183` | A | SuiviPage: access control (checkAccess) computed client-side from Zustand store data — no server-side enforcement of the scope filter _(conf: medium)_ |
| SEC-031 | 🟠 important | `apps/web/app/api/[...path]/route.ts:4-18` | L | API proxy forwards `host` header to internal backend (host-header injection) _(conf: medium)_ |
| SEC-032 | 🟠 important | `nginx/nginx.conf:131` | L | nginx forwards client-supplied X-Forwarded-Proto ($http_x_forwarded_proto) instead of $scheme, enabling proto spoofing |
| SEC-001 | 🟠 important | `nginx/nginx.conf:87-194` | L | Committed nginx.conf has no :443 TLS block; live TLS is terminated by an out-of-repo host nginx (IaC drift) and HSTS is absent |
| SEC-033 | 🟠 important | `nginx/nginx.conf:96-106` | L | No Strict-Transport-Security header emitted by nginx, web middleware, or API helmet |
| SEC-034 | 🟡 nit | `apps/api/src/audit/audit.service.ts:103-104` | L | Stdout audit log uses unkeyed plain SHA256 (8 chars) for attempted-login identifier — rainbow-table reversible for common emails |
| SEC-035 | 🟡 nit | `apps/api/src/clients/dto/query-clients.dto.ts:13-16` | F | QueryClientsDto.search and QueryThirdPartyDto.search missing @MaxLength — unbounded query string parameter |
| SEC-036 | 🟡 nit | `apps/api/src/common/fastify/uploads-auth.hook.ts:78-83` | L | uploads-auth.hook.ts skips jti blacklist and nbf checks — logged-out tokens remain valid for avatar reads up to access TTL |
| SEC-037 | 🟡 nit | `apps/api/src/documents/dto/create-document.dto.ts:53-60` | F | CreateDocumentDto.description missing @MaxLength — unbounded free-text field |
| SEC-038 | 🟡 nit | `apps/api/src/documents/dto/create-document.dto.ts:88-90` | F | CreateDocumentDto.size missing @IsInt() and @Min(0) — negative or non-integer values accepted |
| SEC-039 | 🟡 nit | `apps/api/src/epics/epics.controller.ts:54` | F | projectId query filter in epics/milestones findAll not validated as UUID |
| SEC-040 | 🟡 nit | `apps/api/src/events/dto/create-event.dto.ts:36-38` | F | CreateEventDto.description has no @MaxLength — unbounded DB write |
| SEC-041 | 🟡 nit | `apps/api/src/holidays/holidays.controller.ts:127-131` | F | GET /holidays/import-french: year query param parsed via parseInt without range bounds or ParseIntPipe |
| SEC-042 | 🟡 nit | `apps/api/src/leaves/dto/create-leave.dto.ts:74-81` | F | CreateLeaveDto.reason and ImportLeaveDto.comment lack @MaxLength, allowing oversized free-text storage |
| SEC-043 | 🟡 nit | `apps/api/src/leaves/dto/import-leaves.dto.ts:13-20` | F | ImportLeaveDto.userEmail uses @IsString/@IsNotEmpty instead of @IsEmail, and CreateLeaveDto.leaveTypeId / ImportLeaveDto lack @IsUUID |
| SEC-044 | 🟡 nit | `apps/api/src/milestones/dto/import-milestones.dto.ts:31-39` | F | Milestone bulk import array has no @ArrayMaxSize — DoS via oversized payload |
| SEC-045 | 🟡 nit | `apps/api/src/planning-export/planning-export.service.ts:56-57` | F | Unvalidated date query strings passed to new Date() in exportIcs — possible HTTP 500 instead of 400 |
| SEC-046 | 🟡 nit | `apps/api/src/predefined-tasks/dto/create-predefined-task.dto.ts:16-47` | F | CreatePredefinedTaskDto free-text fields (name, description, color, icon) lack @MaxLength |
| SEC-047 | 🟡 nit | `apps/api/src/projects/dto/create-project.dto.ts:28-36` | F | description fields lack @MaxLength on CreateProjectDto, CreateEpicDto, CreateMilestoneDto |
| SEC-048 | 🟡 nit | `apps/api/src/projects/dto/create-project.dto.ts:87-103` | F | managerId and sponsorId in CreateProjectDto use @IsString instead of @IsUUID |
| SEC-049 | 🟡 nit | `apps/api/src/projects/dto/update-project.dto.ts:18-29` | F | visibleStatuses in UpdateProjectDto uses @IsString (not @IsEnum) allowing arbitrary status strings |
| SEC-050 | 🟡 nit | `apps/api/src/scripts/normalize-action-codes.ts:143-145` | P | $executeRawUnsafe used with string-interpolated constant for DDL trigger name — unsafe API pattern in maintenance scripts _(conf: medium)_ |
| SEC-051 | 🟡 nit | `apps/api/src/services/services.controller.ts:59-75` | F | departmentId query parameter in GET /services and GET /skills/matrix is not validated as UUID — invalid values cause DB-level errors surfaced as 500 |
| SEC-052 | 🟡 nit | `apps/api/src/settings/dto/update-setting.dto.ts:4-20` | F | UpdateSettingDto.value and .description lack @MaxLength — unbounded strings stored to DB |
| SEC-053 | 🟡 nit | `apps/api/src/skills/dto/create-skill.dto.ts:27-35` | F | description fields in CreateSkillDto, CreateDepartmentDto, CreateServiceDto have no @MaxLength |
| SEC-054 | 🟡 nit | `apps/api/src/skills/dto/import-skills.dto.ts:15-44` | F | ImportSkillDto.name and .description lack @MaxLength — inconsistent with CreateSkillDto which enforces @MaxLength(100) |
| SEC-055 | 🟡 nit | `apps/api/src/tasks/dto/import-tasks.dto.ts:39-45` | F | ImportTaskDto.assigneeEmail has no @IsEmail — email validation is done by case-insensitive Map lookup instead _(conf: medium)_ |
| SEC-056 | 🟡 nit | `apps/api/src/telework/telework.controller.ts:310-335` | A | PATCH/DELETE recurring-rules/:id routes lack @OwnershipCheck decorator (rely solely on service-layer check) |
| SEC-057 | 🟡 nit | `apps/api/src/third-parties/dto/create-third-party.dto.ts:36-39` | F | CreateThirdPartyDto.contactEmail missing @MaxLength |
| SEC-058 | 🟡 nit | `apps/api/src/time-tracking/dto/create-time-entry.dto.ts:71-73` | F | description field in CreateTimeEntryDto lacks @MaxLength constraint |
| SEC-059 | 🟡 nit | `apps/api/src/users/dto/create-user.dto.ts:46-52` | F | CreateUserDto.login and ImportUserDto.login missing @MaxLength — unbounded login field |
| SEC-060 | 🟡 nit | `apps/api/src/users/users.service.ts:1679-1684` | F | getUsersPresence accepts arbitrary dateStr with no format validation — invalid date causes NaN Date passed to $queryRaw |
| SEC-061 | 🟡 nit | `apps/web/src/lib/csp.ts:16-26` | L | CSP policy missing `object-src 'none'` and `base-uri 'self'` directives |
| SEC-062 | 🟡 nit | `docker-compose.yml:28-29` | L | Dev docker-compose.yml exposes Redis (6379) and PostgreSQL (5432) on all host interfaces without authentication |
| SEC-063 | 🟡 nit | `nginx/nginx.conf:102` | L | nginx sets X-Frame-Options: SAMEORIGIN but CSP sets frame-ancestors: 'none' — conflicting framing policies |
| SEC-064 | 🟡 nit | `nginx/nginx.conf:174-193` | L | nginx rate limiting applies only to /api — frontend / and /_next/static locations are unthrottled |
| SEC-065 | 🔵 suggestion | `apps/api/src/events/events.service.ts:681-690` | A | getEventsByRange and findOne RBAC filter defaults to unscoped on null role — inconsistent with findAll _(conf: medium)_ |
| SEC-066 | 🔵 suggestion | `apps/api/src/planning-export/planning-export.service.ts:211-269` | F | ICS import processes unbounded VEVENT count with sequential DB writes and no per-field length cap |

### Correctness — 69 findings

| ID | Severity | Location | Cluster | Title |
|---|---|---|---|---|
| COR-001 | 🔴 blocking | `apps/api/src/leaves/leaves.service.ts:1638-1650` | A | canValidate: delegation check is not scoped to the leave's assigned validator — any delegate can approve any leave |
| COR-002 | 🔴 blocking | `apps/api/src/tasks/tasks.service.ts:1451-1482` | B | importTasks: task created but subtasks written outside transaction — partial failure leaves orphaned task row |
| COR-003 | 🔴 blocking | `apps/api/src/telework/telework.service.ts:164-182` | C | findAll auto-expand writes telework rows for ALL users when a non-privileged caller supplies startDate+endDate without userId |
| COR-004 | 🟠 important | `apps/api/src/analytics/advanced/services/milestones-completion.service.ts:75-77` | — | MilestonesCompletionResponseDto.total means 'due milestones' not 'all milestones' |
| COR-005 | 🟠 important | `apps/api/src/analytics/analytics.service.ts:103-127` | — | taskStatusData and metrics diverge when scope exceeds PROJECT_DETAILS_LIMIT (50) |
| COR-006 | 🟠 important | `apps/api/src/audit/audit.service.ts:190-199` | H | AuditService.log passes undefined-valued payload keys to computeRowHash; stored JSONB normalizes them differently, risking hash divergence on external recompute |
| COR-007 | 🟠 important | `apps/api/src/auth/auth.service.ts:545-575` | B | auth.service resetPassword(): token validity check and usedAt marking are not atomic — concurrent reset with the same token succeeds twice |
| COR-008 | 🟠 important | `apps/api/src/clients/clients.service.ts:259-274` | B | hardDelete: count-then-delete without transaction allows deletion of client with active project links |
| COR-009 | 🟠 important | `apps/api/src/documents/documents.service.ts:172-181` | A | documents.update: prisma.document.update has no deletedAt filter — can mutate soft-deleted document in race window |
| COR-010 | 🟠 important | `apps/api/src/documents/documents.service.ts:172-181` | A | documents.update accepts projectId change without checking user access to the new project |
| COR-011 | 🟠 important | `apps/api/src/documents/dto/create-document.dto.ts:88-90` | F | CreateDocumentDto.size has no @IsNumber() or @Min(0) — negative/float sizes accepted |
| COR-012 | 🟠 important | `apps/api/src/events/events.service.ts:233-245` | B | Recurring event child occurrences created outside any transaction — partial failure leaves orphaned parent with no children |
| COR-013 | 🟠 important | `apps/api/src/holidays/holidays.service.ts:460-477` | J | countWorkingDays: local-TZ setDate/getDate arithmetic causes DST off-by-one — one day may be counted twice or skipped |
| COR-014 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:2283-2319` | G | rejectCancellation writes no audit log — CANCELLATION_REQUESTED→APPROVED transition is invisible to the audit trail |
| COR-015 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:2587-2614` | J | getAvailableDays: existing leaves fetched without endHalfDay field — consumed days under-counted when stored leave has endHalfDay |
| COR-016 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:2635` | J | getLeaveBalance uses new Date().getFullYear() (host-TZ) while balance windows use Paris-anchored parisYearWindow — mismatch on Jan 1 between 00:00 and 01:00 Paris time _(conf: medium)_ |
| COR-017 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:2989-3010` | B | deleteBalance: hard-delete committed before audit log — crash between them produces silent deletion with no audit trace |
| COR-018 | 🟠 important | `apps/api/src/milestones/milestones.service.ts:193-231` | C | importMilestones(): per-row findFirst+create is a TOCTOU race with no uniqueness guarantee |
| COR-019 | 🟠 important | `apps/api/src/personal-todos/personal-todos.service.ts:31-47` | C | personal-todos.service.ts create() has TOCTOU race on the 20-todo limit |
| COR-020 | 🟠 important | `apps/api/src/planning-export/planning-export.service.ts:100-108` | J | ICS export silently drops leaves that span the requested date window (startDate before and endDate after the range) |
| COR-021 | 🟠 important | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:288-334` | C | createBulkAssignment: telework check snapshot race — assertTeleworkCompatibility runs before the bulk inserts, but concurrent mutations can invalidate it _(conf: medium)_ |
| COR-022 | 🟠 important | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:33-38` | J | assertTeleworkCompatibility: date comparison uses naive new Date(string) — TZ ambiguity with date-only strings _(conf: medium)_ |
| COR-023 | 🟠 important | `apps/api/src/projects/projects.service.ts:1158-1166` | J | captureSnapshots() uses server-local midnight instead of UTC midnight for deduplication query |
| COR-024 | 🟠 important | `apps/api/src/projects/projects.service.ts:583-588` | — | update() does not validate partial date changes against existing project dates |
| COR-025 | 🟠 important | `apps/api/src/projects/projects.service.ts:855-883` | B | hardDelete(): audit log written outside transaction — audit records 'deleted' even if delete fails _(conf: medium)_ |
| COR-026 | 🟠 important | `apps/api/src/services/services.service.ts:308-343` | B | services.service.ts remove() performs 3 sequential DB writes without a transaction — inconsistent state on crash |
| COR-027 | 🟠 important | `apps/api/src/skills/skills.service.ts:28-57` | — | skills.service.ts create() and update() missing P2002 catch — concurrent duplicate name causes unhandled 500 |
| COR-028 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:1461-1462` | — | importTasks: missing date validity check — invalid startDate/endDate strings silently stored as Invalid Date |
| COR-029 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:2039-2060` | A | reorderSubtasks: subtask IDs from payload not validated to belong to taskId — cross-task position manipulation possible |
| COR-030 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:795-796` | — | update(): date clearing is impossible — falsy check prevents clearing startDate/endDate to null |
| COR-031 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:922-964` | C | addDependency: check-then-create pattern is not race-safe — duplicate dependency race between circular-check and create |
| COR-032 | 🟠 important | `apps/api/src/telework/telework.service.ts:246-253` | A | findForPlanningOverview calls expandRecurringRulesForRange with no userId filter, materialising rows for all users |
| COR-033 | 🟠 important | `apps/api/src/telework/telework.service.ts:338-356` | C | expandRecurringRulesForRange and generateSchedulesFromRules do non-atomic findUnique→create, causing unhandled P2002 on concurrent requests |
| COR-034 | 🟠 important | `apps/api/src/telework/telework.service.ts:417-429` | J | getWeeklySchedule uses local-TZ getDay()/setDate()/setHours() for week boundary calculation, breaking on non-UTC servers _(conf: medium)_ |
| COR-035 | 🟠 important | `apps/api/src/telework/telework.service.ts:463-466` | J | getUserStats builds year boundaries with local-TZ new Date(year,0,1) and getTeamSchedule uses local-midnight setHours(0,0,0,0) for exact-match against UTC-midnight DB dates _(conf: medium)_ |
| COR-036 | 🟠 important | `apps/api/src/third-parties/third-parties.service.ts:115-151` | C | ThirdPartiesService.update: LEGAL_ENTITY invariant checked without transaction — concurrent partial updates can violate it _(conf: medium)_ |
| COR-037 | 🟠 important | `apps/api/src/time-tracking/time-tracking.service.ts:296-330` | C | upsertDismissal findFirst→create inside $transaction does not prevent duplicate dismissal rows under READ COMMITTED |
| COR-038 | 🟠 important | `apps/api/src/time-tracking/time-tracking.service.ts:84-120` | C | ensureDailyCapNotExceeded is non-transactional: concurrent same-day creates can both pass the 24h cap and collectively exceed it |
| COR-039 | 🟠 important | `apps/api/src/users/users.service.ts:1041-1046 and 1123-1129` | N | users.service changePassword() and admin resetPassword() do not call jwtNotBefore.bumpUser() — live access tokens remain valid after password change for up to the access TTL |
| COR-040 | 🟠 important | `apps/api/src/users/users.service.ts:620-676` | B | users.service update(): service-membership deleteMany+createMany execute outside the user.update() transaction — partial failure leaves the user with no services |
| COR-041 | 🟠 important | `apps/web/app/[locale]/login/page.tsx:27-43` | M | Login/register: JWT stored in localStorage before permissions fetch — broken auth state on network error |
| COR-042 | 🟠 important | `apps/web/app/[locale]/projects/[id]/page.tsx:959-965` | M | handleUpdateProject has no error handling — silent failure on project update |
| COR-043 | 🟠 important | `apps/web/app/[locale]/projects/page.tsx:323-337` | M | onArchive / onUnarchive in projects/page.tsx have no error handling |
| COR-044 | 🟠 important | `apps/web/app/[locale]/projects/page.tsx:85-130` | M | fetchProjects useCallback missing hasPermission dependency — stale permission closure |
| COR-045 | 🟠 important | `apps/web/app/[locale]/reports/components/ProjectsDetailTable.tsx:379-380, 428` | M | ProjectsDetailTable: Link href and router.push use locale-less paths, breaking client-side navigation |
| COR-046 | 🟠 important | `apps/web/app/[locale]/tasks/page.tsx:54-144` | M | fetchData useCallback in tasks/page.tsx missing hasPermission dependency — stale permission closure |
| COR-047 | 🟠 important | `apps/web/app/[locale]/telework/page.tsx:395-404` | M | usersService.getAll() in telework/page.tsx has no .catch() — silent failure in user selector |
| COR-048 | 🟡 nit | `apps/api/src/analytics/advanced/services/milestones-completion.service.ts:20-98` | J | daysFromNow in MilestonesCompletionService uses fixed MS_PER_DAY, off-by-one across DST transitions _(conf: medium)_ |
| COR-049 | 🟡 nit | `apps/api/src/analytics/advanced/snapshot-scheduler.service.ts:32-45` | M | SnapshotSchedulerService creates a Redis connection in constructor with no shutdown hook |
| COR-050 | 🟡 nit | `apps/api/src/auth/auth.service.ts:286-361` | C | auth.service register() and users.service create(): duplicate-check race condition surfaces as 500 instead of 409 when two concurrent registrations collide on the DB unique constraint |
| COR-051 | 🟡 nit | `apps/api/src/clients/clients.service.ts:290-298` | A | listProjectClients, listTaskAssignees, listProjectMembers return empty list for non-existent parent — should return 404 |
| COR-052 | 🟡 nit | `apps/api/src/epics/epics.service.ts:78-99` | C | epics.service update()/remove(): double-read TOCTOU — epic fetched in membership check then again in findOne() _(conf: medium)_ |
| COR-053 | 🟡 nit | `apps/api/src/events/events.service.ts:543-557` | B | update() recurrenceEndDate child-prune runs outside the update transaction, creating a window where pruned children exist alongside a committed new endDate _(conf: medium)_ |
| COR-054 | 🟡 nit | `apps/api/src/events/events.service.ts:762-783` | C | addParticipant uses check-then-create pattern susceptible to race; duplicate concurrent request leaks P2002 as HTTP 500 _(conf: medium)_ |
| COR-055 | 🟡 nit | `apps/api/src/leaves/leaves.service.ts:3627-3637` | B | importLeaves catch block resets result.created=0 but not result.skipped — error response reports misleading skipped count after full tx rollback |
| COR-056 | 🟡 nit | `apps/api/src/milestones/milestones.service.ts:102-135` | C | milestones.service update()/remove(): same double-read TOCTOU as epics — unhandled P2025 on concurrent delete _(conf: medium)_ |
| COR-057 | 🟡 nit | `apps/api/src/milestones/milestones.service.ts:162-168` | A | milestones complete() bypasses project membership authorization check |
| COR-058 | 🟡 nit | `apps/api/src/projects/projects.service.ts:1147` | — | captureSnapshots() uses hardcoded string literal 'ACTIVE' instead of ProjectStatus enum |
| COR-059 | 🟡 nit | `apps/api/src/rbac/roles.service.ts:139-157` | C | roles.service createRole()/updateRole(): isDefault singleton management is non-atomic — two concurrent requests can create two roles with isDefault=true _(conf: medium)_ |
| COR-060 | 🟡 nit | `apps/api/src/settings/settings.service.ts:270-279` | B | SettingsService.bulkUpdate performs sequential un-transacted upserts — partial failure leaves inconsistent state |
| COR-061 | 🟡 nit | `apps/api/src/settings/settings.service.ts:310-321` | C | SettingsService.remove throws unhandled Prisma P2025 for non-existent non-default keys |
| COR-062 | 🟡 nit | `apps/api/src/tasks/tasks.service.ts:305` | D | findAll: default limit is 1000 but page default is 1 — no hard cap when limit param is omitted via service default |
| COR-063 | 🟡 nit | `apps/api/src/tasks/tasks.service.ts:797-800` | — | update(): progress not recalculated when status changes and subtasks exist |
| COR-064 | 🟡 nit | `apps/api/src/users/users.service.ts:1680-1684` | J | getUsersPresence(): setHours(0,0,0,0) uses local server timezone — presence window is offset when Node.js process timezone differs from UTC _(conf: medium)_ |
| COR-065 | 🟡 nit | `apps/web/app/[locale]/login/page.tsx:29-31` | M | Login/register pages fetch `/auth/me/permissions` redundantly — useAuthBootstrap does this on every mount |
| COR-066 | 🟡 nit | `apps/web/app/[locale]/profile/page.tsx:519-523` | M | Profile 'Preferences' tab has a Save button with no onClick handler — button does nothing |
| COR-067 | 🟡 nit | `apps/web/app/[locale]/projects/[id]/page.tsx:843-875` | M | fetchThirdPartyMembers and fetchProjectClients close over canRead* flags but effect deps are suppressed _(conf: medium)_ |
| COR-068 | 🟡 nit | `apps/web/app/[locale]/reports/page.tsx:49` | M | reports/page.tsx: canView = !permissionsLoaded \|\| hasPermission('reports:view') — the !permissionsLoaded branch is dead code |
| COR-069 | 🟡 nit | `apps/web/app/[locale]/users/page.tsx:190-195` | M | UsersPage: role filter useEffect fires a redundant re-fetch on initial mount when roleFilter='' and availableRoles just loaded _(conf: medium)_ |

### Data integrity — 31 findings

| ID | Severity | Location | Cluster | Title |
|---|---|---|---|---|
| DAT-001 | 🔴 blocking | `packages/database/prisma/migrations/20260424111457_add_weight_and_audit_log/migration.sql:24` | H | audit_logs created with ON DELETE SET NULL — immutability trigger added 31 days later, leaving a window where audit rows could be silently mutated |
| DAT-002 | 🔴 blocking | `packages/database/prisma/schema.prisma:405-417` | I | TaskRACI.userId has no FK relation — orphaned RACI rows, no cascade on user deletion |
| DAT-003 | 🟠 important | `packages/database/prisma/migrations/20251116093059_init/migration.sql:160-215` | I | DOUBLE PRECISION used for HR-sensitive hours/days columns — rounding errors accumulate _(conf: low)_ |
| DAT-004 | 🟠 important | `packages/database/prisma/migrations/20260321105758_add_leave_balances_and_rbac_granularity/migration.sql:27` | I | ON DELETE CASCADE on leave_balances.leaveTypeId destroys balance history when leave type is deleted |
| DAT-005 | 🟠 important | `packages/database/prisma/migrations/20260321105758_add_leave_balances_and_rbac_granularity/migration.sql:4-21` | I | leave_balances unique index on nullable userId treats multiple NULL rows as distinct — global balance uniqueness not enforced _(conf: low)_ |
| DAT-006 | 🟠 important | `packages/database/prisma/migrations/20260321105758_add_leave_balances_and_rbac_granularity/migration.sql:7` | I | leave_balances.totalDays declared DOUBLE PRECISION — balance summaries accumulate float errors _(conf: low)_ |
| DAT-007 | 🟠 important | `packages/database/prisma/migrations/20260404211126_add_project_snapshots/migration.sql:15` | I | ON DELETE CASCADE on project_snapshots destroys historical trend data when project is hard-deleted _(conf: low)_ |
| DAT-008 | 🟠 important | `packages/database/prisma/migrations/20260411100717_add_third_parties_and_time_entry_actor_xor/migration.sql:109` | I | project_third_party_members.allocation INTEGER has no CHECK constraint for 0-100 range — unlike project_members.allocation which was fixed in DAT-004 |
| DAT-009 | 🟠 important | `packages/database/prisma/migrations/20260411100717_add_third_parties_and_time_entry_actor_xor/migration.sql:159-161` | I | time_entries.thirdPartyId ON DELETE CASCADE silently destroys billing/payroll records when a ThirdParty is deleted |
| DAT-010 | 🟠 important | `packages/database/prisma/migrations/20260420120000_rbac_v4_drop_legacy/migration.sql:1-19` | P | RBAC V4 drops role_permissions, permissions, role_configs tables and users.role column with no backup or preflight verification _(conf: medium)_ |
| DAT-011 | 🟠 important | `packages/database/prisma/migrations/20260424124537_add_recurrence_and_completion/migration.sql:8-11` | I | predefined_task_recurring_rules lacks a XOR constraint ensuring exactly one of dayOfWeek (WEEKLY) or monthly fields (MONTHLY_DAY/MONTHLY_ORDINAL) is populated per recurrenceType |
| DAT-012 | 🟠 important | `packages/database/prisma/migrations/20260424124537_add_recurrence_and_completion/migration.sql:8-9` | I | predefined_task_recurring_rules.monthlyOrdinal and monthlyDayOfMonth have no range CHECK constraints despite documented semantics (1..5 and 1..31) |
| DAT-013 | 🟠 important | `packages/database/prisma/migrations/20260525190000_audit_logs_immutability_hash_chain_actor_snapshot/migration.sql:120-122` | H | audit_logs immutability trigger does not cover TRUNCATE — entire ledger can be wiped silently |
| DAT-014 | 🟠 important | `packages/database/prisma/migrations/20260603115724_dat011_fk_indexes/migration.sql:1-74` | I | 25 CREATE INDEX statements in dat011_fk_indexes run without CONCURRENTLY — ACCESS EXCLUSIVE lock on every indexed table |
| DAT-015 | 🟠 important | `packages/database/prisma/migrations/20260603130000_cor014_snapshot_unique_projectid_date/migration.sql:1-8` | I | project_snapshots.progress lacks CHECK (BETWEEN 0 AND 100) — DAT-003/004 coverage gap |
| DAT-016 | 🟠 important | `packages/database/prisma/migrations/20260603140000_dat015_email_varchar254_lower_unique/migration.sql:9-16` | I | DAT-015 creates redundant dual-layer uniqueness on email: plain @unique (case-sensitive) + LOWER() functional index (case-insensitive) — Prisma findUnique bypasses the case-insensitive guard |
| DAT-017 | 🟠 important | `packages/database/prisma/schema.prisma:391-403` | I | TaskDependency.dependsOnTaskId has no index — cascade delete on Task triggers seq-scan |
| DAT-018 | 🟠 important | `packages/database/prisma/schema.prisma:763-777` | I | UserSkill.skillId has no standalone index — cascade delete on Skill triggers seq-scan |
| DAT-019 | 🟡 nit | `packages/database/prisma/migrations/20251116093059_init/migration.sql:112` | I | project_members.allocation has no CHECK BETWEEN 0 AND 100 — negative or impossible percentages accepted _(conf: low)_ |
| DAT-020 | 🟡 nit | `packages/database/prisma/migrations/20251116093059_init/migration.sql:126-161` | I | tasks.progress and epics.progress have no CHECK BETWEEN 0 AND 100 — negative or >100 values accepted _(conf: low)_ |
| DAT-021 | 🟡 nit | `packages/database/prisma/migrations/20251116093059_init/migration.sql:198` | I | time_entries.hours has no CHECK for positive value or daily cap — zero and negative entries accepted _(conf: low)_ |
| DAT-022 | 🟡 nit | `packages/database/prisma/migrations/20251116093059_init/migration.sql:215` | I | leaves.days has no CHECK > 0 — zero-day and negative leave records accepted _(conf: low)_ |
| DAT-023 | 🟡 nit | `packages/database/prisma/migrations/20260104102501_add_holidays_and_task_fields/migration.sql:12-13` | I | tasks.startTime, tasks.endTime, events.startTime, events.endTime stored as TEXT without format validation at DB level _(conf: low)_ |
| DAT-024 | 🟡 nit | `packages/database/prisma/migrations/20260224231534_add_event_recurrence/migration.sql:4` | I | events.recurrenceDay has no CHECK constraint — invalid day-of-week/month values silently accepted _(conf: medium)_ |
| DAT-025 | 🟡 nit | `packages/database/prisma/migrations/20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql:121` | I | password_reset_tokens.createdById CASCADE — deleting admin who created token cascades to delete active token _(conf: low)_ |
| DAT-026 | 🟡 nit | `packages/database/prisma/migrations/20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql:22-40` | I | predefined_tasks.defaultDuration and predefined_task_assignments.period stored as TEXT — any string accepted _(conf: low)_ |
| DAT-027 | 🟡 nit | `packages/database/prisma/migrations/20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql:7-53` | I | telework_recurring_rules.dayOfWeek and predefined_task_recurring_rules.dayOfWeek have no CHECK BETWEEN 0 AND 6 |
| DAT-028 | 🟡 nit | `packages/database/prisma/migrations/20260525190000_audit_logs_immutability_hash_chain_actor_snapshot/migration.sql:101-104` | H | audit_logs actorId FK retains ON UPDATE CASCADE after migration removes ON DELETE CASCADE — asymmetry can trigger immutability violation |
| DAT-029 | 🟡 nit | `packages/database/prisma/migrations/20260603214608_dat025_document_fk_softdelete/migration.sql:2-3` | I | documents.contentSha256 is TEXT with no CHECK constraint — any arbitrary string can be stored as a SHA-256 hash |
| DAT-030 | 🔵 suggestion | `packages/database/prisma/migrations/20260528150000_dat037_task_project_consistency/migration.sql:40-47` | H | dat037 cascade UPDATE of task.projectId produces no audit_logs rows — N tasks silently rewritten under Cour-des-Comptes scope |
| DAT-031 | 🔵 suggestion | `packages/database/prisma/migrations/20260604050007_dat028_password_reset_token_indexes/migration.sql:2-3` | I | password_reset_tokens index (userId, usedAt) is non-partial — hot query path WHERE usedAt IS NULL will scan all rows including consumed tokens |

### Performance — 61 findings

| ID | Severity | Location | Cluster | Title |
|---|---|---|---|---|
| PER-001 | 🟠 important | `apps/api/src/analytics/analytics.service.ts:223-236` | D | analytics.service `getTasks` fetches all Task columns with no `select` projection — over-fetching on large task sets |
| PER-002 | 🟠 important | `apps/api/src/common/services/access-scope.service.ts:85-98` | E | assertCanAccessProject issues two project.count queries for the same projectId |
| PER-003 | 🟠 important | `apps/api/src/common/services/role-hierarchy.service.ts:83-103` | E | assertCanAssignRole executes 4 DB queries when the caller is not ADMIN (resolveTemplateKey called twice in assertCanAssignRole + twice again in canAssignRole) |
| PER-004 | 🟠 important | `apps/api/src/epics/epics.service.ts:115-123` | E | assertProjectMembership in EpicsService fetches all project members (include: { project: { include: { members: true } } }) |
| PER-005 | 🟠 important | `apps/api/src/events/events.service.ts:233-245` | E | Recurring event creation: sequential per-occurrence `event.create` loop — N DB round-trips on request path |
| PER-006 | 🟠 important | `apps/api/src/events/events.service.ts:297-334` | D | All `events.findAll` / `getEventsByUser` / `getEventsByRange` list endpoints are unpaginated and unbounded |
| PER-007 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:3558-3575` | E | importLeaves: getHolidayKeySet + findValidatorForUser called per row inside transaction loop |
| PER-008 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:896-941` | D | getPendingForValidator: unbounded findMany — no limit/pagination for ADMIN path |
| PER-009 | 🟠 important | `apps/api/src/metrics/metrics.interceptor.ts:34` | L | MetricsInterceptor uses raw URL path as label key — unbounded Map growth via unique UUIDs |
| PER-010 | 🟠 important | `apps/api/src/milestones/milestones.service.ts:193-224` | E | importMilestones executes N sequential findFirst + create per milestone |
| PER-011 | 🟠 important | `apps/api/src/planning-export/planning-export.service.ts:219-267` | E | ICS import: sequential `event.create` per VEVENT — up to 5MB/N-event sequential writes with no count cap |
| PER-012 | 🟠 important | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:302-330` | E | createBulkAssignment: one DB INSERT per (user × date) pair — sequential awaits in nested loop, no transaction |
| PER-013 | 🟠 important | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:448-486` | E | bulkCreateRecurringRules: one DB INSERT per (user × dayOfWeek) inside a transaction — sequential awaits |
| PER-014 | 🟠 important | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:565-610` | E | generateFromRules: one DB INSERT per occurrence date, sequential await inside nested for-loop |
| PER-015 | 🟠 important | `apps/api/src/projects/projects.service.ts:1109-1113` | D | getProjectsByUser fetches ALL tasks for every project to compute progress (no take limit) |
| PER-016 | 🟠 important | `apps/api/src/projects/projects.service.ts:1276-1288` | D | getProjectStats fetches all tasks and all members without select projection on members |
| PER-017 | 🟠 important | `apps/api/src/projects/projects.service.ts:231-238` | D | Default and max page size of 1000 on list endpoints (projects, epics, milestones) |
| PER-018 | 🟠 important | `apps/api/src/skills/skills.service.ts:477-515` | D | findUsersBySkill() fetches ALL users with a skill then filters isActive in JavaScript — inactive users inflate DB result needlessly |
| PER-019 | 🟠 important | `apps/api/src/skills/skills.service.ts:62-63` | D | Default page limit is 1000 on skills/departments/services list endpoints — 10× above recommended ceiling |
| PER-020 | 🟠 important | `apps/api/src/skills/skills.service.ts:693-731` | E | importSkills() issues one INSERT per row in a serial for-loop with no upper bound on input array size — N sequential DB roundtrips |
| PER-021 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:1133-1182` | D | getTasksByAssignee and getTasksByProject have no pagination — unbounded findMany |
| PER-022 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:1198-1221` | D | getMyDoneUndeclaredTasks: unbounded findMany with NOT EXISTS subquery — full table scan risk |
| PER-023 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:1303-1333` | E | checkCircularDependency: one DB query per BFS node — potential N+1 for deep dependency graphs |
| PER-024 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:1383-1481` | E | importTasks: sequential await inside for-loop — N DB round trips for task creation + M subtask inserts |
| PER-025 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:1733-1773` | D | findOrphans: unbounded findMany on tasks with projectId IS NULL — no pagination |
| PER-026 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:2051-2058` | E | reorderSubtasks: one DB UPDATE per subtask in a transaction — N sequential round trips _(conf: medium)_ |
| PER-027 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:305` | D | findAll tasks allows limit=1000 — 10x higher than documented default, no hard cap at reasonable size |
| PER-028 | 🟠 important | `apps/api/src/telework/telework.service.ts:328-361` | E | expandRecurringRulesForRange: N+1 findUnique+create inside nested loop over days × rules |
| PER-029 | 🟠 important | `apps/api/src/telework/telework.service.ts:888-934` | E | generateSchedulesFromRules: same N+1 findUnique+create loop as expandRecurringRulesForRange |
| PER-030 | 🟠 important | `apps/api/src/users/users.service.ts:1301-1446` | E | importUsers executes N sequential DB round-trips (findFirst + bcrypt + create) per row |
| PER-031 | 🟠 important | `apps/web/app/[locale]/clients/page.tsx:147-155` | M | handleExportExcel fires Promise.all over all active clients without concurrency cap (up to 200 requests) |
| PER-032 | 🟠 important | `apps/web/app/[locale]/projects/[id]/page.tsx:182-185` | M | milestonesService.getAll() fetches ALL milestones system-wide then filters client-side in two pages |
| PER-033 | 🟠 important | `apps/web/app/[locale]/reports/components/advanced/AdvancedAnalyticsTab.tsx:8-29` | M | AdvancedAnalyticsTab creates a module-scope QueryClient inside its own QueryClientProvider, bypassing the app-level cache |
| PER-034 | 🟠 important | `apps/web/app/[locale]/tasks/page.tsx:88` | M | tasksService.getAll(1, 1000) hard-coded limit of 1000 tasks loaded in single request |
| PER-035 | 🟠 important | `packages/database/prisma/schema.prisma:391-403` | I | TaskDependency.dependsOnTaskId has no index — reverse dependency lookups in checkCircularDependency are slow |
| PER-036 | 🟠 important | `packages/database/prisma/schema.prisma:405-417` | I | TaskRACI has no index on userId — per-user RACI lookups require seq-scan _(conf: low)_ |
| PER-037 | 🟡 nit | `apps/api/src/analytics/advanced/dto/snapshots-query.dto.ts:12-22` | D | SnapshotsQueryDto.projectIds and TasksBreakdownQueryDto.projectIds have no array size limit — unbounded IN-clause fan-out |
| PER-038 | 🟡 nit | `apps/api/src/analytics/advanced/services/snapshots-query.service.ts:43-149` | M | Six advanced analytics endpoints have no caching despite being identical in contract to the cached main analytics endpoint |
| PER-039 | 🟡 nit | `apps/api/src/audit/recompute-chain.ts:87-112` | E | recomputeChainFrom() issues one UPDATE per audit row in a serial for-loop — O(N) round-trips hold the advisory lock for the full duration |
| PER-040 | 🟡 nit | `apps/api/src/auth/strategies/jwt.strategy.ts:60-92` | D | JwtStrategy.validate makes a full user.findUnique on every authenticated request |
| PER-041 | 🟡 nit | `apps/api/src/comments/comments.service.ts:59-65` | D | findAll comments uses default limit=1000 — very high default page size |
| PER-042 | 🟡 nit | `apps/api/src/common/services/cache.service.ts:1-59` | M | CacheService uses TTL-only eviction — no mutation invalidation for analytics endpoints _(conf: medium)_ |
| PER-043 | 🟡 nit | `apps/api/src/documents/documents.service.ts:75-81` | D | findAll documents uses default limit=1000 — very high default page size |
| PER-044 | 🟡 nit | `apps/api/src/holidays/holidays.service.ts:116-125` | D | holidays findAll: unbounded findMany — no limit, no pagination |
| PER-045 | 🟡 nit | `apps/api/src/leave-types/leave-types.service.ts:192-203` | E | leave-types reorder: N individual update queries instead of bulk upsert |
| PER-046 | 🟡 nit | `apps/api/src/leaves/leaves.service.ts:1101-1139` | D | getOwnLeaves: unbounded findMany on leave history — no limit |
| PER-047 | 🟡 nit | `apps/api/src/leaves/leaves.service.ts:761-781` | D | findAll leaves: default limit 1000 with effective cap 500 — higher than recommended 100 |
| PER-048 | 🟡 nit | `apps/api/src/personal-todos/personal-todos.service.ts:18-28` | M | findByUser() (GET /personal-todos) issues an unconditional DELETE on every read — unnecessary write roundtrip on each list call |
| PER-049 | 🟡 nit | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:186-231` | D | findAssignments (predefined-tasks): no pagination and no maximum result cap |
| PER-050 | 🟡 nit | `apps/api/src/predefined-tasks/predefined-tasks.service.ts:352-387` | D | findRecurringRules: no pagination — unbounded findMany with includes _(conf: medium)_ |
| PER-051 | 🟡 nit | `apps/api/src/projects/projects.service.ts:1145-1152` | D | captureSnapshots fetches ALL active projects with full task/milestone arrays — no pagination _(conf: medium)_ |
| PER-052 | 🟡 nit | `apps/api/src/school-vacations/school-vacations.service.ts:36-45` | D | findAll school-vacations: unbounded findMany — no pagination for year-scoped list |
| PER-053 | 🟡 nit | `apps/api/src/settings/settings.service.ts:109-126` | E | settings.service `initializeDefaultSettings` issues N×2 sequential DB queries at every module init |
| PER-054 | 🟡 nit | `apps/api/src/skills/skills.service.ts:362-441` | D | getSkillsMatrix() loads all active users and all skills without pagination — response size grows as O(users × skills) _(conf: medium)_ |
| PER-055 | 🟡 nit | `apps/api/src/telework/telework.service.ts:431-449` | I | TeleworkSchedule: no index on (userId, date) range queries — only unique constraint _(conf: medium)_ |
| PER-056 | 🟡 nit | `apps/api/src/time-tracking/time-tracking.service.ts:363` | D | findAll time-tracking: effective cap is 1000 rows — far exceeds recommended 100 |
| PER-057 | 🟡 nit | `apps/api/src/users/users.service.ts:1479-1481` | D | validateImport fetches ALL users (email+login) for duplicate detection — unbounded full-table scan |
| PER-058 | 🟡 nit | `apps/web/app/[locale]/leaves/page.tsx:1` | M | All 6 pages use manual fetch + useState with no TanStack Query caching — repeated fetches on every navigation |
| PER-059 | 🟡 nit | `apps/web/app/[locale]/planning/page.tsx:1-22` | M | planning/page.tsx is entirely a shell that could be an RSC with a single client import _(conf: medium)_ |
| PER-060 | 🟡 nit | `packages/database/prisma/schema.prisma:1081-1108` | I | PredefinedTaskAssignment has no index on predefinedTaskId — per-task assignment lookups may seq-scan _(conf: medium)_ |
| PER-061 | 🔵 suggestion | `apps/api/src/leaves/leaves.service.ts:2678-2732` | D | getLeaveBalance: Promise.all fan-out issues N×2 DB queries, one resolveAllocatedDays per leave type |

### Observability — 29 findings

| ID | Severity | Location | Cluster | Title |
|---|---|---|---|---|
| OBS-001 | 🔴 blocking | `.github/workflows/ci.yml:262-273` | K | AUDIT_HASH_KEY never set in CI — API cannot boot in E2E jobs |
| OBS-002 | 🟠 important | `apps/api/src/audit/audit.service.ts:184-200` | G | requestId never populated in persisted audit-log payload despite declared schema field and ALS infrastructure |
| OBS-003 | 🟠 important | `apps/api/src/auth/auth.controller.ts:220-243` | G | POST /auth/logout emits no audit row — session termination is untracked |
| OBS-004 | 🟠 important | `apps/api/src/clients/clients.service.ts:50-65` | G | clients: create/update/hardDelete and project-assignment mutations emit no audit_log row |
| OBS-005 | 🟠 important | `apps/api/src/common/filters/all-exceptions.filter.ts:33-40` | K | Sentry / GlitchTip / OpenTelemetry stubs are no-ops — unhandled exceptions and 500s are log-only with no alerting |
| OBS-006 | 🟠 important | `apps/api/src/documents/documents.service.ts:64-73` | G | documents: create and soft-delete emit no audit_log row (only DOCUMENT_READ is audited) |
| OBS-007 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:2283-2319` | G | rejectCancellation() (CANCELLATION_REQUESTED → APPROVED) emits no audit row |
| OBS-008 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:2376-2406` | G | createDelegation() and deactivateDelegation() emit no audit row |
| OBS-009 | 🟠 important | `apps/api/src/leaves/leaves.service.ts:679-693` | G | Leave create path emits no durable audit row for PENDING/declaredByManager paths; selfApprove path mislabeled _(conf: medium)_ |
| OBS-010 | 🟠 important | `apps/api/src/projects/projects.service.ts:89-687` | G | Project create, update, and soft-delete (status→CANCELLED) emit no audit rows |
| OBS-011 | 🟠 important | `apps/api/src/settings/settings.service.ts:235-265` | G | settings: all write operations emit no audit_log row and do not capture actor identity |
| OBS-012 | 🟠 important | `apps/api/src/tasks/tasks.service.ts:841-885` | G | Task create, update, and delete emit no audit rows — only CSV export is audited |
| OBS-013 | 🟠 important | `apps/api/src/telework/telework.service.ts:71-145` | G | telework: all CRUD and recurring-rule mutations emit no audit_log row |
| OBS-014 | 🟠 important | `apps/api/src/third-parties/third-parties.service.ts:180-187` | G | third-parties: all mutating operations (create/update/hardDelete/assign/detach) emit no audit_log row |
| OBS-015 | 🟠 important | `apps/api/src/time-tracking/time-tracking.service.ts:208-249` | G | time-tracking: create/update/delete emit no audit_log row |
| OBS-016 | 🟠 important | `apps/api/src/users/users.service.ts:1400-1437` | G | POST /users/import bulk-creates users with no audit row per created user |
| OBS-017 | 🟠 important | `apps/api/src/users/users.service.ts:153-219` | G | POST /users (admin-side user creation) emits no audit row |
| OBS-018 | 🟠 important | `apps/web/app/[locale]/leaves/page.tsx:1` | M | No React error boundary or Next.js error.tsx in any of the 6 scanned route segments |
| OBS-019 | 🟠 important | `apps/web/app/[locale]/profile/page.tsx:344-356` | K | Profile page shows `new Date()` (current time) as 'last login' instead of actual last-login timestamp |
| OBS-020 | 🟠 important | `packages/database/prisma/schema.prisma:1220` | H | Audit log retention policy undeclared and unenforced — audit_logs grows unbounded |
| OBS-021 | 🟡 nit | `apps/api/src/auth/auth.service.ts:524-529` | G | generateResetToken() logs PASSWORD_CHANGED (wrong action) — action mislabeling confirmed, non-persistence claim refuted _(conf: medium)_ |
| OBS-022 | 🟡 nit | `apps/api/src/comments/comments.service.ts:160-184` | G | comments: create/update/delete emit no audit_log row |
| OBS-023 | 🟡 nit | `apps/api/src/common/fastify/redact.config.ts:1-37` | L | req.body.login not in Fastify redact paths — user identifier would appear in logs if body serialization is enabled |
| OBS-024 | 🟡 nit | `apps/api/src/events/events.service.ts:578-585` | G | events: create/update/delete and participant mutations emit no audit_log row |
| OBS-025 | 🟡 nit | `apps/api/src/projects/projects.service.ts:891-1041` | G | Project member add/update/remove emit no audit rows |
| OBS-026 | 🟡 nit | `apps/web/app/[locale]/layout.tsx:1-30` | M | No error boundary anywhere in the [locale] subtree — unhandled render errors crash the entire app |
| OBS-027 | 🟡 nit | `apps/web/app/[locale]/profile/page.tsx:23-639` | M | Profile page (`profile/page.tsx`) has no error boundary — uncaught render errors cause a blank screen |
| OBS-028 | 🟡 nit | `apps/web/app/[locale]/projects/page.tsx:1` | M | No error boundary wrapping any of the three page-level components |
| OBS-029 | 🔵 suggestion | `.github/workflows/ci.yml:579-592` | K | CI pipeline has no real VPS deployment step — 'notify-success' job only echoes, docker-publish does not SSH to prod |

### Tests — 12 findings

| ID | Severity | Location | Cluster | Title |
|---|---|---|---|---|
| TST-001 | 🔴 blocking | `e2e/clients.spec.ts:657-680` | O | clients.spec.ts Suite 6 asserts HTTP 200 for contributeur on GET /api/clients, contradicting the permission matrix and the generated INTERDIT test |
| TST-002 | 🟠 important | `apps/api/src/:N/A` | O | 13 controllers have no sibling *.spec.ts file |
| TST-003 | 🟠 important | `apps/api/src/analytics/analytics.controller.spec.ts:8-88` | O | analytics.controller.spec.ts has only happy-path tests — no error/auth failure coverage |
| TST-004 | 🟠 important | `apps/api/src/events/events.controller.spec.ts:11-287` | O | events.controller.spec.ts, clients.controller.spec.ts, and third-parties.controller.spec.ts have zero error-path tests |
| TST-005 | 🟠 important | `apps/api/src/leave-types/leave-types.service.spec.ts:1-234` | O | LeaveTypesService.reorder() method has zero test coverage — $transaction branch untested |
| TST-006 | 🟠 important | `apps/api/src/planning-export/planning-export.controller.spec.ts:12-39` | O | planning-export.controller.spec.ts has only happy-path tests — no error propagation tests |
| TST-007 | 🟠 important | `e2e/helpers.ts:1-13` | O | Root-level e2e specs use UI login helper with hardcoded admin/admin123 credentials |
| TST-008 | 🟠 important | `e2e/tests/rbac/api-permissions.spec.ts:89-143` | O | api-permissions.spec.ts — the core RBAC matrix test has zero @smoke tags despite covering all permission codes |
| TST-009 | 🟡 nit | `apps/api/src/common/fastify/uploads-auth.hook.spec.ts:83-96` | O | expect(res.statusCode).not.toBe(401) in uploads-auth.hook.spec.ts passes on 200/500/404 — intent is ambiguous |
| TST-010 | 🟡 nit | `apps/api/src/leaves/leaves-balance-gating.int.spec.ts:269-271` | O | describe.skipIf in leaves-balance-gating.int.spec.ts silently disables mutation witness in default CI |
| TST-011 | 🟡 nit | `e2e/global-setup.ts:1-63` | O | No migration-level e2e test exists inside e2e/; schema-constraint coverage lives only in apps/api/src/schema-constraints/*.int.spec.ts |
| TST-012 | 🔵 suggestion | `e2e/fixtures/permission-matrix.ts:389-407` | O | Permission matrix has no entry for GET /api/analytics/advanced/* endpoints (6 routes using reports:view) |

## Assurance (verified clean)

Each finder also recorded what it checked **and found clean**; full lists are in `agents/<category>.json` under `verified_clean`. Counts:

| Category | verified_clean assertions |
|---|---:|
| Security | 358 |
| Correctness | 327 |
| Data integrity | 122 |
| Performance | 207 |
| Observability | 148 |
| Tests | 47 |

## Output files

- `report.md` — this document
- `findings.json` — all 268 findings (full schema)
- `clusters.json` — 16 root-cause clusters
- `summary.json` — executive summary object
- `agents/<category>.json` — per-category raw payloads + verified_clean
- `agents/scratch/` — per-shard map/verify scratch (audit trail)
- `SEC-001-prod-verification.md` — read-only live prod check that downgraded SEC-001 (blocking → important): prod terminates TLS via certbot, HSTS absent, TLS edge out-of-repo

