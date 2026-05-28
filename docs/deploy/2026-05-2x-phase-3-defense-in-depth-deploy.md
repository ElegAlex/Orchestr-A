# Phase 3 Defense-in-Depth — Production Deploy Execution Log

**Audit-trail artifact for Cour des Comptes.** This document is the durable record of the
operational deploy of the *Phase 3* defense-in-depth schema bundle to production. It is **seeded
ahead of execution**: the known scope, migrations, pre-deploy checks, verification plan and
rollback templates are pre-filled now; every command and its output are captured at deploy time,
in execution order, with timestamps (UTC — prod host runs `Etc/UTC`).

> **Status (2026-05-28, post-mini-arc re-finalize): Phase 3 + completion mini-arc — DEPLOY-READY pending operator scheduling.**
>
> **Canonical counts (state once, every reference below matches):**
> - **20 tasks closed** across **19 scope rows** in §"Scope & metadata" (the DAT-003+DAT-004 bundle = 1 row for 2 tasks; every other row = 1 task).
> - **13 migrations** in §"Migrations applied" (8 audit-prescribed — DAT-003/004 bundle counts as 1 — + 5 mini-arc — DAT-032/033 bundle counts as 1).
> - **5 code-only tasks** with no migration: COR-022 (audit-prescribed), COR-034, COR-035, COR-037, DAT-034 (mini-arc).
> - **18 rollback steps** in §"Rollback sequence": 13 migration-DROPs (reverse deploy order) + 5 code-only `git revert`s.
>
> **Authoring timeline (audit trail):**
> - **2026-05-27** — original seed alongside Phase 3 (audit-prescribed) closure: 8 migrations + COR-022 + per-task probes/smokes/rollbacks landed in each closure's commit.
> - **2026-05-28** (commit `43ed9a8`) — first finalize: TBD-DEPLOY convention applied, ordered pre-deploy checklist extracted, consolidated reverse-order rollback table extracted.
> - **2026-05-28** (mini-arc, 2 sessions) — reverted to *accumulating* while 9/9 mini-arc tasks landed; 5 new migrations + 4 new code-only tasks appended per-task.
> - **2026-05-28** (this commit) — **re-finalize**: count reconciliation (above), unified pre-deploy checklist re-extracted with all 13 migrations' scans in one operator-SSOT, new smokes for the 5 mini-arc DDL migrations, rollback table extended with the 4 mini-arc code-only `git revert`s, mini-arc banner removed.
>
> **Mid-arc deploy prohibition lifted (mini-arc complete).** The operator-driven prod deploy is unblocked; scheduling is the next operator action (see also: a HANDOVER refresh + Phase 4 decision typically follow the deploy itself).
>
> **Convention — deploy-time fill markers.** Every value the operator captures at deploy time is
> tagged with the prefix `TBD-DEPLOY:` (date, operator, baseline counts, per-scan outputs, smoke-test
> snapshots, gate decisions). At the start of a deploy, run `grep -n 'TBD-DEPLOY:' <thisdoc>` — the
> output is exactly the operator's fill-list. The legacy bare-marker form (without the `-DEPLOY`
> suffix) is deprecated; the body of this doc (outside this convention paragraph) carries none, so
> a deploy-day lint never returns doc-time questions mixed with deploy-time blanks.

---

## Scope & metadata

- **Date:** **2026-05-28 (UTC)** — deploy executed 2026-05-28 12:44 UTC (backup) → 12:54 UTC (migrate deploy) → 13:05 UTC (api `up -d`) → 13:09 UTC (Gate 6 final).
- **Operator:** **Claude Code (Opus 4.7, 1M context), driven by repository owner.**
- **Phase 3 + mini-arc batch — 20 tasks / 19 scope rows (all `DONE` in `BACKLOG.md`, all on `origin/master`):**

| Task(s) | Commit | Severity | What it introduces |
|---------|--------|----------|--------------------|
| `DAT-003` + `DAT-004` (bundle) | `62c2fc4` | blocking | **14 CHECK constraints** — 7 date-range (`end >= start`, incl. the `events` recurrence variant) + 7 numeric bounds (progress 0–100, weight 1–5, allocation 0–100, days > 0, size/totalDays ≥ 0). One migration. |
| `COR-022` | `760aa58` | important | Per-`(userId, date)` daily **hours cap (≤ 24)** on TimeEntry create/update. **DTO + service only — no migration, no schema change.** |
| `DAT-012` | `c8b618e` | important | **5 native Postgres enums** promoting 6 free-string columns (predefined-task duration/period/completionStatus/recurrenceType, app-settings category). `AuditLog.action`/`entityType` deliberately **stayed `String`** (document route — see Operational notes). One migration. |
| `DAT-013` | `c0189c1` | important | **6 CHECK constraints** enforcing `HH:MM` time-of-day format on `Task`/`Event`/`PredefinedTask` `startTime`/`endTime` (regex `^([0-1]?[0-9]\|2[0-3]):[0-5][0-9]$`, the lenient DTO-floor superset). `schema.prisma` unchanged (columns stay `String?`). One migration. |
| `DAT-014` | `f8a5ce9` | important | **1 BEFORE INSERT/UPDATE trigger** (`leaves_sync_type_trg` + fn `leaves_sync_type_from_config`) auto-deriving the legacy `leaves.type` enum from the FK `leave_type_configs.code` (member→verbatim, else `OTHER`, via `enum_range`). Makes the column a read-only mirror of the FK → kills the dual-source drift without dropping it (DROP blocked by active frontend readers). Includes a one-time backfill reconciling existing rows. `schema.prisma` unchanged (column stays `LeaveType?`). One migration. |
| `DAT-016` | `ce8877a` | important | **2 UNIQUE indexes** — `departments_name_key` (Department.name globally unique) + `services_departmentId_name_key` (Service.name unique **per department**, composite — same name in different departments stays legal). DSL-expressible: `schema.prisma` **was** edited (`@unique` / `@@unique` — baked into the rebuilt api image). One migration. The app layer already pre-checked uniqueness; this is the DB-level floor closing the TOCTOU/direct-SQL gap. |
| `DAT-017` | `f6ca325` | important | **1 CHECK constraint** `tasks_parent_requires_project_ck` — `("projectId" IS NOT NULL OR ("epicId" IS NULL AND "milestoneId" IS NULL))`. Rejects the orphan combination (a task linked to an epic/milestone but to NO project). Single-row invariant only; cross-table equality (epic.projectId = task.projectId) is **out of scope** — filed as DAT-037. Hand-authored raw SQL; `schema.prisma` unchanged (CHECK not DSL-expressible). One migration. |
| `DAT-018` | `fff93ce` | important | **1 CHECK + 1 BEFORE INSERT/UPDATE trigger** on `task_dependencies` — CHECK `task_dependencies_no_self_ck` (`"taskId" <> "dependsOnTaskId"`) blocks the 1-hop self-loop; trigger `task_dependencies_no_cycle_trg` (+ fn `task_dependencies_check_cycle`) walks the existing graph forward from `NEW."dependsOnTaskId"` and RAISEs (identifier `task_dependencies_no_cycle`) if `NEW."taskId"` is reachable — blocks multi-hop cycles. Defense-in-depth: the service (`addDependency` → `checkCircularDependency`) already returns 400 first; this is the DB floor for direct-SQL/bypass paths. Hand-authored raw SQL; `schema.prisma` unchanged (neither DSL-expressible). One migration. |
| `DAT-023` | `c27862a` | important | **1 EXCLUDE constraint** `leaves_no_overlap` on `leaves` — `EXCLUDE USING gist ("userId" WITH =, daterange("startDate","endDate",'[]') WITH &&) WHERE (status = 'APPROVED')`. Forbids two APPROVED leaves for the same user with overlapping date ranges. Partial WHERE (only APPROVED rows; re-checks on PENDING→APPROVED UPDATE — the audit's race path); `[]` inclusive bounds match `checkOverlap`'s inclusive semantics (`halfDay` is not a same-day-pair feature — `checkOverlap` ignores it). **Requires `btree_gist`** — `CREATE EXTENSION IF NOT EXISTS btree_gist` is in the migration but needs **superuser** (see DAT-023 probe + pre-deploy). Defense-in-depth: the service already 409s on create/update; this is the DB floor for the TOCTOU/approve race. Hand-authored raw SQL; `schema.prisma` unchanged (EXCLUDE not DSL-expressible). One migration. |
| `DAT-032` | `7af1991` | important | **1 CHECK constraint** `subtasks_position_ck` (`"position" >= 0`). Defense-in-depth completion of the DAT-004 numeric-bound family — DAT-004's Description named `Subtask.position Int` among the bound-less columns but its Suggested-fix list omitted it (7 CHECKs for 8 described columns; bundle discipline kept it out). The non-negative ordering-position invariant now has a DB floor matching the DTO. Bundled with DAT-033 in one migration. Hand-authored raw SQL; `schema.prisma` unchanged (CHECK not DSL-expressible). |
| `DAT-034` | `6b17ec9` | nit | **Code-only — no migration.** Extends COR-022's per-day hours cap to the third-party declaration path (the `userId=null, thirdPartyId set` case COR-022 explicitly left out). `ensureDailyCapNotExceeded` now accepts an actor discriminator; both `create()` and `update()` call it for both dimensions. Same 24h threshold + same `BadRequestException`. TOCTOU residual identical to COR-022 — closing the aggregate race needs a serializable transaction or trigger, not done here. |
| `COR-037` | `abd6982` | nit | **Code-only — no migration.** Maps Prisma `23P01` on `leaves_no_overlap` (DAT-023 EXCLUDE) to `ConflictException(409)` on `LeavesService.approve` (the audit's TOCTOU race: two PENDING leaves slip past create-time `checkOverlap`, then both try to become APPROVED; the EXCLUDE rejects the second, was leaking as 500). Same `isLeaveOverlapViolation` helper substitutes a friendly message in `importLeaves` line-level catch (UX, not 500-fix — import already swallowed). No change to the approve mutation or the `LEAVE_APPROVED` audit emission (the wrapper only translates the propagating error; tx aborts naturally → no audit on conflict path — correct). |
| `COR-035` | `d5ac36a` | nit | **Code-only — no migration.** Cross-field DTO validator on `CreateTaskDto` rejecting the orphan combination (epicId or milestoneId set without projectId) with HTTP 400 *before* the DB hit. Layer-of-rejection partner to DAT-017's CHECK `tasks_parent_requires_project_ck`. Attached to `epicId`/`milestoneId` (not `projectId`) to avoid the `@ValidateIf` short-circuit. UpdateTaskDto OmitType-overrides the constraint so partial updates aren't false-rejected. |
| `COR-034` | `08d04b1` | nit | **Code-only — no migration.** Maps Prisma `P2002` to `ConflictException(409)` on `DepartmentsService.create/update`, `ServicesService.create/update`, and `ClientsService.create/update` (collapses the TOCTOU race between the existing `findFirst` pre-check and `.create()` to the same 409 the sequential path already returns; Clients had no pre-check, so the wrapper IS the only mapping). Scope widened from the audit's literal Dept+Service to Dept+Service+Client since DAT-036 added Client as the third UNIQUE surface in the same mini-arc. Surfaces only when the DB UNIQUE actually fires — DAT-016/DAT-036 must already be live for the race window to exist. |
| `DAT-035` | `148b713` | important | **1 CHECK constraint** `project_members_role_length_ck` (`char_length("role") BETWEEN 1 AND 100`) — structural floor only; value space stays open per the audit's free-form decision (DAT-012 bail rationale; SEC-002 institutional-roles-vary precedent). DSL not used (CHECK not expressible); `schema.prisma` unchanged. **Companion changes in the same commit:** `AddMemberDto` + `UpdateMemberDto` — `@Transform(trim)` + `@Length(1, 100)` as the layer-of-rejection partner (400 before DB); `OwnershipService.PROJECT_LEADER_MEMBER_ROLES` — removed vestigial `'OWNER'`/`'LEAD'` codes (matched zero rows; artifact of the abandoned closed-set idea this task declines). **Pre-deploy precaution (recommended):** `SELECT max(char_length(role)), count(*) FILTER (WHERE role IS NULL OR role = '') FROM project_members;` — confirm max ≤ 100 and 0 NULLs/empties. Dev pre-flight: maxlen 17, 0 nulls, 0 empties, 0 whitespace-only across 2959 rows. |
| `DAT-037` | `128393e` | important | **3 triggers + 3 functions** enforcing cross-table `task.projectId = parent.projectId`. (1) `tasks_project_consistency_trg` BEFORE INSERT/UPDATE on `tasks` — REJECT if NEW.projectId differs from epic.projectId / milestone.projectId; skips when NEW.projectId IS NULL (DAT-017's CHECK owns the orphan case — layer-of-rejection contract). (2) `epics_cascade_projectid_trg` AFTER UPDATE OF projectId on `epics` — cascade new projectId to dependent tasks (resolves the BEFORE-pair deadlock on legitimate "move epic" workflows; non-deadlocking by construction since AFTER fires post parent row update). (3) `milestones_cascade_projectid_trg` — mirror on `milestones`. Hand-authored raw SQL; `schema.prisma` unchanged. **Pre-deploy precaution (required):** drift scan must return 0 — `SELECT count(*) FROM tasks t JOIN epics e ON t."epicId"=e.id WHERE t."projectId" IS DISTINCT FROM e."projectId"` + the milestone variant. Dev pre-flight: 0/0, plus 435 tasks-with-both-parents all in same project. **Operational note:** the parent-side cascade silently rewrites N task rows; the change is derivable from the parent's audit row (no per-task audit entry — OBS-002's app-mutation-only pipeline; explicit deferral). Operator workflow for moving an epic that shares dependent tasks with a milestone in another project: update milestone first (cascades), THEN epic (cascade re-aligns) — see Operational notes. |
| `DAT-038` | `a99dda5` | important | **1 CHECK + 1 BEFORE INSERT/UPDATE trigger** on `events` — CHECK `events_parent_no_self_ck` (`"parentEventId" IS DISTINCT FROM "id"`) blocks the 1-hop self-loop; trigger `events_parent_no_cycle_trg` (+ fn `events_check_parent_cycle`) walks the existing graph UPWARD from `NEW."parentEventId"` via each ancestor row's own parentEventId and RAISEs `events_parent_no_cycle` if `NEW."id"` is reached. Direct DAT-018 analog on a self-FK column (not an edge table). **Unlike DAT-018, there is NO service-side cycle guard for events** — the trigger is the only line of defense, not a DB floor on top of a 400. Carries DAT-018's load-bearing OLD-row exclusion (`(TG_OP = 'INSERT' OR e.id <> OLD."id")`) verbatim. Hand-authored raw SQL; `schema.prisma` unchanged. **Pre-deploy precaution (required):** both guards validate against existing rows — run the read-only self-loop + recursive-CTE multi-hop cycle scan on prod `events` BEFORE `migrate deploy` (see DAT-038 probe below; mirrors DAT-018's). Dev pre-flight: 195 events, 0 self-loops, 0 multi-hop cycles, 0 parented. |
| `DAT-036` | `ce026d6` | important | **1 UNIQUE index** `clients_name_key` on `clients.name` — third instance of DAT-016's missing-UNIQUE family (named in DAT-016's Description, omitted from its literal Suggested-fix list). DSL-expressible: `schema.prisma` carries `@unique`; the redundant non-unique `@@index([name])` is dropped (the unique index already serves the lookup). Byte-equivalent to `migrate dev` output (Prisma `<table>_<col>_key` naming). **Pre-deploy precaution (required):** `CREATE UNIQUE INDEX` aborts 23505 on existing duplicates — run a read-only `GROUP BY name HAVING count(*) > 1` SELECT on prod BEFORE `migrate deploy`. Dev pre-flight: 0 duplicates (200 clients). |
| `DAT-033` | `7af1991` | important | **1 CHECK constraint** `time_entries_hours_ck` (`"hours" >= 0 AND "hours" <= 24`). DB-layer floor for the single-row TimeEntry hours bound — COR-022 enforced it at DTO + service only (Invariant 1 forbade DDL in that commit). **Floor predicate `>= 0` is intentional, NOT `>= 0.25`:** `CreateTimeEntryDto.hours` carries `@Min(0.25)` gated by `@ValidateIf(!isDismissal)`, and `TimeTrackingService` writes dismissals with `hours = 0` (line 308). The legitimate persisted range is `{0} ∪ [0.25, 24]`; the DB admits hours=0 (101 such dismissal rows on dev today) and leaves the `(0, 0.25)` partial-hour exclusion to the DTO. **Per-day aggregate cap stays at the service layer (cross-row, not a per-row CHECK); the COR-022 TOCTOU residual remains open** — same residual will apply to DAT-034's third-party path. Bundled with DAT-032 in one migration. Hand-authored raw SQL; `schema.prisma` unchanged. |

- **Prod baseline (expected):** TBD-DEPLOY: commits behind master at deploy time. Expected last applied
  migration `20260524100100_dat005_convert_float_to_decimal` — the Phase-1 closeout left prod at git
  `8e4b593` / api img `7cd9b14a`, and **no Phase-2 deploy has been logged in `docs/deploy/` since**,
  so Phase 2 is almost certainly not yet on prod. **Verify the prod `_prisma_migrations` HEAD before
  deploy** (if Phase 2 shipped out-of-band, its migrations would also be pending — STOP and reassess
  the migration delta). TBD-DEPLOY: prod row counts (predefined_tasks,
  predefined_task_assignments, predefined_task_recurring_rules, app_settings, project_members,
  time_entries) captured read-only as the Phase-4 reconciliation baseline.
- **VPS:** `debian@92.222.35.25`, repo `/opt/orchestra`.
- **Compose invocation:** `docker compose -f docker-compose.prod.yml --env-file .env.production …`
  (the `--env-file` is mandatory on this host — no `.env` at `/opt/orchestra`).
- **Containers:** api=`orchestr-a-api-prod`, web=`orchestr-a-web-prod`, db=`orchestr-a-postgres-prod`
  (`postgres:18-alpine`), redis, nginx, certbot.
- **DB:** `orchestr_a_prod`, user `orchestr_a`. Host has **no** `psql`/`pg_dump` binaries → all
  Postgres ops run inside the db container (`docker exec`).

### Migrations applied by this batch (13)

| Migration folder | Task(s) | Introduces |
|------------------|---------|------------|
| `20260527120000_dat003_dat004_business_invariants` | DAT-003 + DAT-004 | 14 `ADD CONSTRAINT … CHECK (…)` (7 date-range + 7 numeric). Hand-authored raw SQL; `schema.prisma` unchanged (CHECK not DSL-expressible). |
| `20260527130000_dat012_promote_string_enums` | DAT-012 | `CREATE TYPE` ×5 + `ALTER COLUMN … TYPE … USING (col::"Enum")` ×6 (defaults dropped/re-set around the casts). Hand-authored; `schema.prisma` **was** edited (enum blocks + column types — baked into the rebuilt api image). |
| `20260527140000_dat013_time_format_check` | DAT-013 | 6 `ADD CONSTRAINT … CHECK (col ~ '^([0-1]?[0-9]\|2[0-3]):[0-5][0-9]$')` on Task/Event/PredefinedTask `startTime`/`endTime`. Hand-authored raw SQL; `schema.prisma` unchanged. **No pre-deploy probe needed** — CHECK on already-format-valid data is uneventful (dev pre-flight: 4 well-formed rows, zero malformed; like DAT-003/004, unlike the DAT-012 enum cast). |
| `20260527150000_dat014_leave_type_autosync_trigger` | DAT-014 | `CREATE OR REPLACE FUNCTION leaves_sync_type_from_config()` + `CREATE TRIGGER leaves_sync_type_trg BEFORE INSERT OR UPDATE ON leaves` + a one-time backfill `UPDATE leaves SET type = <derived> … WHERE type IS DISTINCT FROM <derived>`. Hand-authored raw SQL; `schema.prisma` unchanged (column stays `LeaveType?`; triggers are not DSL-expressible). **Pre-deploy precaution:** the trigger function compiles at `migrate deploy` time (no separate probe). The backfill is a single bounded pass touching only drifted/NULL rows; on a large prod `leaves` table it is still one `UPDATE` — verify no prod codebase reference writes `leave.type` independently *outside this commit's diff* (the service already derives it; this only enforces it). Dev pre-flight: 3 rows, 1 NULL/`CP_E2E` reconciled to `OTHER`, 2 CP unchanged. |
| `20260527160000_dat016_unique_name_constraints` | DAT-016 | `CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name")` + `CREATE UNIQUE INDEX "services_departmentId_name_key" ON "services"("departmentId", "name")`. Hand-authored, but **byte-equivalent to `migrate dev` output** (Prisma `<table>_<col>_key` naming) so a future drift-clean `migrate dev` sees no diff; `schema.prisma` **was** edited (`@unique` / `@@unique` — DSL-expressible, baked into the rebuilt api image). **Pre-deploy precaution (required):** run a read-only duplicate SELECT on prod BEFORE `migrate deploy` — `CREATE UNIQUE INDEX` validates against existing rows and aborts with 23505 if any duplicate exists. Resolve by rename if found (see probe below). Dev pre-flight: 0 duplicates (2 depts, 4 services). |
| `20260527170000_dat017_task_parent_requires_project_check` | DAT-017 | `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_requires_project_ck" CHECK ("projectId" IS NOT NULL OR ("epicId" IS NULL AND "milestoneId" IS NULL))`. Hand-authored raw SQL; `schema.prisma` unchanged (CHECK not DSL-expressible). **Pre-deploy precaution (required):** `ADD CONSTRAINT … CHECK` validates against existing rows and aborts with 23514 if any orphan exists — run a read-only violator SELECT on prod BEFORE `migrate deploy` (see DAT-017 probe below). Resolve by backfilling `projectId` from the epic/milestone parent, or DELETE if truly orphan. Dev pre-flight: 0 violators (3288 tasks). |
| `20260527180000_dat018_task_dependency_cycle_prevention` | DAT-018 | `ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_no_self_ck" CHECK ("taskId" <> "dependsOnTaskId")` + `CREATE OR REPLACE FUNCTION task_dependencies_check_cycle()` (recursive-CTE forward walk, RAISEs `task_dependencies_no_cycle` on a multi-hop cycle) + `CREATE TRIGGER task_dependencies_no_cycle_trg BEFORE INSERT OR UPDATE ON task_dependencies`. Hand-authored raw SQL; `schema.prisma` unchanged (neither DSL-expressible). **Pre-deploy precaution (required):** both guards validate against existing rows at deploy — the CHECK aborts with 23514 on an existing self-loop, and an existing cycle would make the trigger fire on the next legitimate write. Run the read-only self-loop + recursive-CTE cycle scan on prod `task_dependencies` BEFORE `migrate deploy` (see DAT-018 probe below); resolve any existing cycle by deleting one edge per cycle. Dev pre-flight: 0 self-loops, 0 multi-hop cycles (table empty, 0 rows). |
| `20260527190000_dat023_leave_no_overlap_exclude` | DAT-023 | `CREATE EXTENSION IF NOT EXISTS btree_gist` + `ALTER TABLE "leaves" ADD CONSTRAINT "leaves_no_overlap" EXCLUDE USING gist ("userId" WITH =, daterange("startDate","endDate",'[]') WITH &&) WHERE (status = 'APPROVED')`. Hand-authored raw SQL; `schema.prisma` unchanged (EXCLUDE not DSL-expressible). **Pre-deploy precaution (required, two parts):** (a) **`CREATE EXTENSION` needs superuser** — confirm the deploy/migration role can create extensions, or have a superuser run `CREATE EXTENSION IF NOT EXISTS btree_gist;` in `orchestr_a_prod` BEFORE `migrate deploy` (idempotent; if already present the migration's CREATE is a no-op); (b) `ADD CONSTRAINT … EXCLUDE` validates against existing rows and aborts (23P01) if any overlapping APPROVED pair exists — run the read-only overlap SELECT on prod BEFORE `migrate deploy` (see DAT-023 probe below); resolve by setting the older row to a non-APPROVED status. Dev pre-flight: btree_gist not pre-installed (created cleanly, role is superuser); 0 overlapping APPROVED pairs (3 leaves). |
| `20260528120000_dat032_dat033_position_and_hours_bounds` | DAT-032 + DAT-033 | `ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_position_ck" CHECK ("position" >= 0)` + `ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_hours_ck" CHECK ("hours" >= 0 AND "hours" <= 24)`. Defense-in-depth completion of the DAT-004 numeric-bound family — bundle rationale: same source file (schema.prisma), same SQL mechanism (single-column CHECK), same witness path. Hand-authored raw SQL; `schema.prisma` unchanged (CHECK not DSL-expressible). **Pre-deploy precaution (recommended, two scans):** `ADD CONSTRAINT … CHECK` validates against existing rows and aborts with 23514 if any violator exists — run the read-only violator SELECTs on prod BEFORE `migrate deploy` (see DAT-032/033 probe below). The hours floor is the superset `>= 0` to admit legitimate dismissal rows (`hours = 0`, `isDismissal = true`); do not confuse this with the DTO floor `>= 0.25` for non-dismissal entries (which stays at the application layer). Dev pre-flight: 0 violators on `subtasks.position < 0`; on `time_entries`: 101 legitimate dismissals admitted, 0 negatives, 0 over-24, 0 in (0, 0.25). |
| `20260528160000_dat035_project_member_role_length` | DAT-035 | `ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_length_ck" CHECK (char_length("role") BETWEEN 1 AND 100)`. Structural floor only — the value space stays open per the audit's free-form decision (DAT-012 bail rationale); the bound N=100 is round, ~5.8x current dev max (17). NULL not addressed (column is NOT NULL at schema level). Whitespace-only intentionally accepted at the DB (DTO trims). Hand-authored raw SQL; `schema.prisma` unchanged. **Pre-deploy precaution (recommended):** `SELECT max(char_length(role)) AS maxlen, count(*) FILTER (WHERE role IS NULL) AS nulls, count(*) FILTER (WHERE role = '') AS empties FROM project_members;` — confirm maxlen ≤ 100, nulls = 0, empties = 0. Dev pre-flight: 17 / 0 / 0 across 2959 rows. |
| `20260528150000_dat037_task_project_consistency` | DAT-037 | `CREATE OR REPLACE FUNCTION tasks_check_project_consistency()` (rejects task.projectId ≠ epic.projectId / milestone.projectId when projectId is non-NULL; defers NULL to DAT-017) + `CREATE TRIGGER tasks_project_consistency_trg BEFORE INSERT OR UPDATE ON tasks` + `CREATE FUNCTION epics_cascade_projectid_to_tasks()` (cascades parent projectId change to dependent tasks) + `CREATE TRIGGER epics_cascade_projectid_trg AFTER UPDATE OF "projectId" ON epics` + mirror function+trigger for `milestones`. Hand-authored raw SQL; `schema.prisma` unchanged (triggers not DSL-expressible). **Pre-deploy precaution (required):** drift scan returns 0 — `SELECT count(*) FROM tasks t JOIN epics e ON t."epicId"=e.id WHERE t."projectId" IS DISTINCT FROM e."projectId"` and same for milestones; plus the "both parents in different projects" topology scan. Dev pre-flight: 0/0 drift; 435 tasks with both parents set, 0 with disagreeing parent projects. |
| `20260528140000_dat038_event_parent_cycle_prevention` | DAT-038 | `ALTER TABLE "events" ADD CONSTRAINT "events_parent_no_self_ck" CHECK ("parentEventId" IS DISTINCT FROM "id")` + `CREATE OR REPLACE FUNCTION events_check_parent_cycle()` (recursive-CTE upward walk with OLD-row exclusion, RAISEs `events_parent_no_cycle` on a multi-hop cycle) + `CREATE TRIGGER events_parent_no_cycle_trg BEFORE INSERT OR UPDATE ON events`. Hand-authored raw SQL; `schema.prisma` unchanged (neither DSL-expressible). **Pre-deploy precaution (required):** both guards validate against existing rows at deploy — the CHECK aborts 23514 on an existing self-loop, and an existing multi-hop cycle would make the trigger fire on the next legitimate write. Run the read-only self-loop + recursive-CTE upward-walk cycle scan on prod `events` BEFORE `migrate deploy` (see DAT-038 probe below). Dev pre-flight: 195 events, 0 self-loops, 0 multi-hop cycles, 0 parented at all. Resolve any existing cycle by deleting one edge per cycle (set the offending parentEventId to NULL). |
| `20260528130000_dat036_client_name_unique` | DAT-036 | `DROP INDEX "clients_name_idx"` (the redundant non-unique index — the new unique index covers the same lookup) + `CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name")`. Third instance of DAT-016's missing-UNIQUE family. **DSL-expressible — `schema.prisma` WAS edited** (`@unique` added, `@@index([name])` removed — baked into the rebuilt api image). Byte-equivalent to `migrate dev` output (Prisma `<table>_<col>_key` naming). **Pre-deploy precaution (required):** `CREATE UNIQUE INDEX` validates against existing rows and aborts 23505 on existing duplicates — run the read-only duplicate SELECT on prod BEFORE `migrate deploy` (see DAT-036 probe below). Resolve by rename if any. Dev pre-flight: 0 duplicates (200 clients). |

> **5 code-only tasks are NOT in this sub-table** — they ship entirely in the api image (no DDL):
> COR-022 (`760aa58`), COR-034 (`08d04b1`), COR-035 (`d5ac36a`), COR-037 (`abd6982`), DAT-034
> (`6b17ec9`). They are captured separately in §"Rollback sequence" as `git revert` steps.
>
> ⚠️ **Image is source-baked (no bind-mount), same as Phase 1.** `migrate deploy` run against the
> *current* prod image applies the migrations baked into it. **Order: safety dump → `git pull` →
> `docker compose build api` → `docker compose run --rm api pnpm prisma migrate deploy` →
> `docker compose up -d api`** (build BEFORE migrate). See the Phase-1 doc's GATE 1 for the rationale.

---

## Deploy plan (phases, 2 human gates)

1. **Pre-deploy baseline (read-only).** git/containers/images/`_prisma_migrations` HEAD/row counts.
   Confirm the **13 batch migrations** (8 audit-prescribed + 5 mini-arc) are exactly the pending
   delta `HEAD → origin/master` under `packages/database/prisma/migrations/`. STOP if any surprise
   migration appears.
2. **Pre-deploy data probes (read-only) — the unified §"Pre-deploy checklist" below.** Step 0 gates
   the whole batch (btree_gist availability + superuser, DAT-023). Step 1 runs the integrated
   data-precondition scans for all 13 migrations grouped by family (CHECK violators including the
   mini-arc DAT-032/033 + DAT-035 predicates; DAT-013 time format; DAT-012 enum cast; DAT-016 +
   DAT-036 dup names; DAT-017 orphan + DAT-037 drift; DAT-018 + DAT-038 cycles). **→ GATE 1.**
3. **Deploy execution** (after Gate 1 greenlight). Safety dump → `git pull` → `build api` →
   `migrate deploy` (must be exactly the 13 batch migrations, in deploy-order) → `up -d api` →
   health check.
4. **Post-deploy verification.** All 13 migrations in `_prisma_migrations`; CHECK + enum + UNIQUE +
   cycle + cascade + leave-type-trigger smokes (INSERT-then-ROLLBACK on the new mini-arc DDL as
   well as the original 8); time_entries sanity; audit_logs sanity. **→ GATE 2** (operator UI smoke).
5. **Rollback (conditional).** Reverse-order master table at §"Rollback sequence" (13 migration-DROPs
   + 5 code-only `git revert`s = 18 steps), per-migration DDL below. Log + push even on rollback.

---

## Pre-deploy checklist — run in order against PROD before `migrate deploy`

> **Operator SSOT.** This section is the executable sequence. The per-task probe subsections below
> (`## Pre-deploy data probe — DAT-012`, `### DAT-016 …`, …) carry the full SQL + resolution paths;
> this table lists them in the correct order so the operator runs them without re-deriving the
> dependency graph. All reads are read-only; the only allowed writes here are the optional
> `CREATE EXTENSION btree_gist` and any *probe-resolution* UPDATE/DELETE the operator needs to make
> a scan return `(0 rows)` (each such resolution is captured before/after in the deploy log).
>
> **STOP rule.** Every step has a single pass condition. A failure at any step is a STOP — resolve
> per the linked probe's "Resolution path", re-run that step, then continue.

### Step 0 — Environmental prerequisite (DAT-023, gates the whole batch)

The DAT-023 migration (`20260527190000`, the 8th in deploy order) begins with
`CREATE EXTENSION IF NOT EXISTS btree_gist`. If the extension is absent AND the deploy role is not
superuser, `migrate deploy` aborts at DAT-023 — leaving the 7 prior migrations applied and the 5
mini-arc migrations (DAT-032/033, DAT-036, DAT-038, DAT-037, DAT-035) unapplied. To avoid that
partial state, decide the extension's availability **before** running `migrate deploy`.

```sql
-- a) is btree_gist already installed?
SELECT extname FROM pg_extension WHERE extname='btree_gist';
-- b) can the migration role create extensions?
SELECT rolname, rolsuper FROM pg_roles WHERE rolname=current_user;
```

| (a) extension present | (b) role super | Action |
|----------------------|----------------|--------|
| yes | n/a | nothing — the migration's `IF NOT EXISTS` no-ops at deploy. |
| no | yes | nothing — the migration creates it during deploy. |
| no | no | **a superuser must** run `CREATE EXTENSION IF NOT EXISTS btree_gist;` in `orchestr_a_prod` BEFORE `migrate deploy` (idempotent — the migration's own CREATE then no-ops). |

TBD-DEPLOY: Step 0 outcome — paste (a)+(b) output and which row of the table applies.

Full detail: [DAT-023 overlap probe (part 1, btree_gist availability)](#dat-023-overlap-probe-critical--two-parts-btree_gist-availability--existing-overlap-either-aborts-migrate-deploy).

### Step 1 — Data-precondition scans (read-only, every scan must return `(0 rows)`)

Run in any order within this step (they read independent tables). **Each scan returns ONLY
violators** — empty result = safe to proceed; any rows = STOP, resolve per the linked subsection's
resolution path, re-scan → must be 0 rows → proceed.

| # | Migration | What aborts deploy on a violator | Pass | Link |
|---|-----------|----------------------------------|------|------|
| 1 | `20260527130000` (DAT-012) | `ALTER COLUMN … TYPE "Enum" USING (col::"Enum")` errors on a value the enum can't represent | all 6 per-column SELECTs return `(0 rows)` | [DAT-012 enum-cast probe](#pre-deploy-data-probe--dat-012-enum-cast-safety-critical-read-only) |
| 2 | `20260527160000` (DAT-016) **+ `20260528130000` (DAT-036)** | `CREATE UNIQUE INDEX` aborts 23505 on existing duplicate | the **three** `GROUP BY … HAVING count(*) > 1` SELECTs all return `(0 rows)`: `departments.name`, `services(departmentId, name)`, **`clients.name` (DAT-036)** | [DAT-016 duplicate-name probe](#dat-016-duplicate-name-probe-critical-read-only--create-unique-index-aborts-on-existing-dups) (extended in DAT-036's row of §"Migrations applied"; same pattern, single column on `clients`) |
| 3 | `20260527170000` (DAT-017) **+ `20260528150000` (DAT-037)** | DAT-017: `ADD CONSTRAINT … CHECK` aborts 23514 on orphan-task row. DAT-037: `CREATE TRIGGER` does NOT itself abort on existing drift, but the BEFORE arm will fire on the NEXT legitimate task UPDATE if drift exists today — so the drift scan is still mandatory. | DAT-017: orphan-task SELECT returns `(0 rows)`. DAT-037: `SELECT count(*) FROM tasks t JOIN epics e ON t."epicId"=e.id WHERE t."projectId" IS DISTINCT FROM e."projectId"` returns 0, same for milestones; PLUS the topology scan `SELECT count(*) FROM tasks t JOIN epics e ON t."epicId"=e.id JOIN milestones m ON t."milestoneId"=m.id WHERE e."projectId" <> m."projectId"` returns 0 (the "competing parents" edge case the cascade can deadlock on). | [DAT-017 orphan-task probe](#dat-017-orphan-task-probe-critical-read-only--add-constraint--check-aborts-on-existing-violators) (DAT-037 extends; same SELECT shape) |
| 4 | `20260527180000` (DAT-018) **+ `20260528140000` (DAT-038)** | self-loop CHECK aborts 23514 at `ADD CONSTRAINT`; an existing multi-hop cycle would later choke the trigger on the next legitimate write — applies to both task_dependencies AND events | DAT-018: both SELECTs (self-loop + cycle scan on `task_dependencies`) return `(0 rows)`; **DAT-038: both SELECTs (self-loop `SELECT count(*) FROM events WHERE "parentEventId" = id` + recursive-CTE upward-walk cycle scan on events) return `(0 rows)`** | [DAT-018 cycle probe](#dat-018-cycle-probe-critical-read-only--the-check-aborts-on-an-existing-self-loop-an-existing-cycle-would-make-the-trigger-fire-on-the-next-write) (extended in DAT-038's row of §"Migrations applied" — same pattern, upward walk on the single-column self-FK) |
| 5 | `20260527190000` (DAT-023) | `ADD CONSTRAINT … EXCLUDE` aborts 23P01 on existing overlapping APPROVED pair | overlap-pair SELECT returns `(0 rows)` (part 2 of the DAT-023 probe) | [DAT-023 overlap probe (part 2)](#dat-023-overlap-probe-critical--two-parts-btree_gist-availability--existing-overlap-either-aborts-migrate-deploy) |
| 6 | `20260527120000` (DAT-003/004) **+ `20260528120000` (DAT-032/033) + `20260528160000` (DAT-035)** | `ADD CONSTRAINT … CHECK` aborts 23514 on first violator across the 14 DAT-003/004 predicates **+ the 2 DAT-032/033 predicates + the 1 DAT-035 length predicate** | dev pre-flight: 0/14 + 0/2 + 0/1 (every CHECK validated clean on dev — DAT-035 max length 17, no nulls, no empties across 2959 rows). **Recommended prod safety scan** — for each of the 14 DAT-003/004 predicates listed in `migration.sql` (L22–67), run `SELECT count(*) FROM <table> WHERE NOT (<predicate>);` and confirm 0. Predicates: `leaves.endDate >= startDate`, `projects.endDate >= startDate`, `epics.endDate >= startDate`, `telework_recurring_rules.endDate >= startDate`, `leave_validation_delegates.end_date >= start_date`, `school_vacations.endDate >= startDate`, `events.recurrenceEndDate >= date`, `leave_balances.totalDays >= 0`, `leaves.days > 0`, `tasks.progress BETWEEN 0 AND 100`, `epics.progress BETWEEN 0 AND 100`, `predefined_tasks.weight BETWEEN 1 AND 5`, `project_members.allocation BETWEEN 0 AND 100`, `documents.size >= 0`. **Plus the 2 DAT-032/033 predicates:** `SELECT count(*) FROM subtasks WHERE "position" < 0;` (must return 0) and `SELECT count(*) FILTER (WHERE hours = 0) AS dismissals, count(*) FILTER (WHERE hours < 0) AS negatives, count(*) FILTER (WHERE hours > 24) AS over_cap, count(*) FILTER (WHERE hours > 0 AND hours < 0.25) AS partial_below_quarter FROM time_entries;` (must return `negatives = 0`, `over_cap = 0`, `partial_below_quarter = 0`; `dismissals` may be > 0 — the floor `>= 0` admits them by design). | every safety SELECT returns 0 (and DAT-033 scan's `negatives`/`over_cap`/`partial_below_quarter` columns return 0) |
| 7 | `20260527140000` (DAT-013) | `ADD CONSTRAINT … CHECK` aborts 23514 on first malformed time string | dev pre-flight: only 4 well-formed rows. **Recommended prod safety scan** — for each of the 6 columns: `SELECT count(*) FROM <table> WHERE "<col>" IS NOT NULL AND "<col>" !~ '^([0-1]?[0-9]\|2[0-3]):[0-5][0-9]$';` on `tasks.startTime`/`endTime`, `events.startTime`/`endTime`, `predefined_tasks.startTime`/`endTime` | every safety SELECT returns 0 |

**DAT-014 (`20260527150000`) needs no scan, BUT the operator must expect a *write* during `migrate
deploy`.** The migration runs a one-time `UPDATE "leaves" SET "type" = <FK-derived> WHERE "type"
IS DISTINCT FROM <derived>` to reconcile drifted/NULL rows before attaching the trigger. The
update runs as raw SQL inside `migrate deploy`, NOT through the app's audit emitter — so no
`SYSTEM_BACKFILL` row appears in `audit_logs` (the V5/audit-logs verification expects 0). This is
intentional (DAT-005's in-migration numeric conversion is the precedent). Dev pre-flight: 1 of 3
rows reconciled (NULL → OTHER); 2 CP unchanged. Surprise threshold: a touched-row count
significantly above the drift estimate may indicate an unknown write path is feeding
`leaves.type` independently of the FK — pause and investigate before continuing.

**COR-022 (`760aa58`) ships entirely in the api image** — no DDL, no scan, nothing to pre-check.

TBD-DEPLOY: Step 1 — paste each scan's `(0 rows)` confirmation (or before/after if a resolution
was applied).

### Step 2 — Baseline capture (read-only)

Capture the prod git HEAD / running image id / `_prisma_migrations` last applied / row counts as
the Phase-4 reconciliation baseline. Full detail at [Pre-deploy baseline (read-only)](#pre-deploy-baseline-read-only).

### Step 3 — GATE 1 (operator decision)

All 7 scan rows in §"Step 1" green (covers 13 migrations' precondition data — DAT-035 length scan
folded into row 6, DAT-036 dup into row 2, DAT-037 drift+topology into row 3, DAT-038 cycle into
row 4, DAT-032/033 numerics into row 6) + Step 0 outcome decided + baseline captured + disk
headroom verified (Phase 1 hit 99%; `df -h /` headroom for a ≈1.68 GB api image build). Operator
greenlights. Full detail at [GATE 1](#gate-1--probe-outcome-reported-to-operator-awaiting-greenlight).

---

## Pre-deploy baseline (read-only)

**Captured:** TBD-DEPLOY: timestamp (prod UTC).

### git state + migration-folder delta (the deploy-relevant check)
```
$ git log --oneline -3
TBD-DEPLOY: prod HEAD commits

$ git fetch origin   # read-only
HEAD          = TBD
origin/master = TBD
commits behind origin/master: TBD

$ git diff --name-status HEAD origin/master -- packages/database/prisma/migrations/
TBD-DEPLOY: must show exactly the 13 batch migration folders as `A`:
  20260527120000_dat003_dat004_business_invariants
  20260527130000_dat012_promote_string_enums
  20260527140000_dat013_time_format_check
  20260527150000_dat014_leave_type_autosync_trigger
  20260527160000_dat016_unique_name_constraints
  20260527170000_dat017_task_parent_requires_project_check
  20260527180000_dat018_task_dependency_cycle_prevention
  20260527190000_dat023_leave_no_overlap_exclude
  20260528120000_dat032_dat033_position_and_hours_bounds
  20260528130000_dat036_client_name_unique
  20260528140000_dat038_event_parent_cycle_prevention
  20260528150000_dat037_task_project_consistency
  20260528160000_dat035_project_member_role_length
plus schema.prisma as `M` under packages/database/prisma/ (the DAT-012 enum edits + DAT-016 + DAT-036 @unique/@@unique; DAT-013/014/017/018/023/032/033/035/037/038 leave schema.prisma untouched).
```
TBD-DEPLOY: ✅/⚠️ assumption check — only the 13 batch migrations are pending; no surprise migration.

### `_prisma_migrations` HEAD + row counts (Phase-4 baseline)
```
$ docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
TBD-DEPLOY: confirm last applied migration < 20260527120000

$ docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod -c \
  "SELECT 'predefined_tasks' t, count(*) FROM predefined_tasks
   UNION ALL SELECT 'predefined_task_assignments', count(*) FROM predefined_task_assignments
   UNION ALL SELECT 'predefined_task_recurring_rules', count(*) FROM predefined_task_recurring_rules
   UNION ALL SELECT 'app_settings', count(*) FROM app_settings
   UNION ALL SELECT 'time_entries', count(*) FROM time_entries
   UNION ALL SELECT 'subtasks', count(*) FROM subtasks
   UNION ALL SELECT 'project_members', count(*) FROM project_members
   UNION ALL SELECT 'clients', count(*) FROM clients
   UNION ALL SELECT 'events', count(*) FROM events
   UNION ALL SELECT 'tasks', count(*) FROM tasks
   UNION ALL SELECT 'epics', count(*) FROM epics
   UNION ALL SELECT 'milestones', count(*) FROM milestones;"
TBD-DEPLOY: baseline counts (extended for the mini-arc — the 7 new tables surface in DAT-032/033, DAT-035, DAT-036, DAT-037, DAT-038 scopes).
```

---

## Pre-deploy data probe — DAT-012 enum cast safety (CRITICAL, read-only)

`20260527130000` runs `ALTER COLUMN … TYPE "Enum" USING (col::"Enum")`. **A single prod row holding
a value outside the enum set aborts the whole migration** (and the immutability-style maintenance
constraints make in-place fixing of some tables awkward). The dev pre-flight (DAT-012 closeout) was
clean, and the DTO `@IsIn` historically gated writes — **but prod cannot be enumerated from dev.**
Run this probe against prod and require an **empty result set for all six columns** before deploy.

```sql
-- Copy-paste into: docker exec -i orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod
-- Each query returns ONLY values that would break the cast. ALL SIX must return 0 rows.

-- 1) PredefinedTask.defaultDuration → PredefinedTaskDuration
SELECT "defaultDuration" AS offending_value, count(*)
  FROM predefined_tasks
 WHERE "defaultDuration" NOT IN ('HALF_DAY','FULL_DAY','TIME_SLOT')
 GROUP BY 1;

-- 2) PredefinedTaskAssignment.period → DayPeriod
SELECT "period" AS offending_value, count(*)
  FROM predefined_task_assignments
 WHERE "period" NOT IN ('MORNING','AFTERNOON','FULL_DAY')
 GROUP BY 1;

-- 3) PredefinedTaskAssignment.completionStatus → AssignmentCompletionStatus
SELECT "completionStatus" AS offending_value, count(*)
  FROM predefined_task_assignments
 WHERE "completionStatus" NOT IN ('NOT_DONE','IN_PROGRESS','DONE','NOT_APPLICABLE')
 GROUP BY 1;

-- 4) PredefinedTaskRecurringRule.period → DayPeriod  (same set as #2 — shared enum)
SELECT "period" AS offending_value, count(*)
  FROM predefined_task_recurring_rules
 WHERE "period" NOT IN ('MORNING','AFTERNOON','FULL_DAY')
 GROUP BY 1;

-- 5) PredefinedTaskRecurringRule.recurrenceType → RecurrenceType
SELECT "recurrenceType" AS offending_value, count(*)
  FROM predefined_task_recurring_rules
 WHERE "recurrenceType" NOT IN ('WEEKLY','MONTHLY_ORDINAL','MONTHLY_DAY')
 GROUP BY 1;

-- 6) AppSettings.category → AppSettingsCategory
SELECT "category" AS offending_value, count(*)
  FROM app_settings
 WHERE "category" NOT IN ('display','general','planning')
 GROUP BY 1;
```

TBD-DEPLOY: probe output — paste the result of each of the 6 queries (expect `(0 rows)` for all).

### Resolution path if any probe returns a row (do NOT run `migrate deploy` until clean)

For each offending value, pick one:

- **(a) Typo / case variant of a valid code** → normalize the data in place, then re-probe:
  ```sql
  -- example: a 'full_day' / 'Full_Day' variant of FULL_DAY
  UPDATE predefined_task_assignments SET "period" = 'FULL_DAY'
   WHERE "period" ILIKE 'full_day' AND "period" <> 'FULL_DAY';
  ```
  Mirror for whichever (table, column) the probe flagged. Re-run the probe → must be 0 rows.
- **(b) Legitimately new value** → the enum is too narrow. **Extend the enum AND amend the migration
  before retry** (the migration must create the type with the full set; editing prod's type after a
  failed run leaves drift). Add the value to the `CREATE TYPE … AS ENUM (…)` in
  `20260527130000_dat012_promote_string_enums/migration.sql` **and** to the `enum` block in
  `schema.prisma`, commit, push, rebuild the api image, then re-deploy. (Reconcile with the DAT-012
  bail note: `ProjectMember.role` was *not* promoted precisely because its values are open — if a
  promoted column turns out similarly open in prod, reconsider whether it should be an enum at all.)

> DAT-003/004: **no pre-deploy precaution required.** The DAT-012 closeout / DAT-003-004 closeout
> recorded a dev pre-flight that returned **0 violators across all 14 predicates**, and `migrate
> deploy` validated every `ADD CONSTRAINT` clean against real data. The CHECKs only reject *future*
> bad writes; they do not retro-scan beyond the one-time validation. No prod probe needed.
>
> COR-022: **no migration, no pre-deploy check** — it ships in the api image only.

### DAT-016 duplicate-name probe (CRITICAL, read-only — `CREATE UNIQUE INDEX` aborts on existing dups)

`20260527160000` builds two UNIQUE indexes; Postgres validates each against the existing rows at
build time and aborts the whole `migrate deploy` with 23505 if any duplicate exists. Run these BEFORE
deploy; both must return `(0 rows)`.

```sql
-- Department.name globally unique
SELECT name, count(*) FROM departments GROUP BY name HAVING count(*) > 1;
-- Service.name unique PER department (composite)
SELECT "departmentId", name, count(*) FROM services GROUP BY "departmentId", name HAVING count(*) > 1;
```
TBD-DEPLOY: probe output — both expected `(0 rows)`. Dev pre-flight returned 0/0 (2 depts, 4 services).

**Resolution if any row returns** (do NOT run `migrate deploy` until clean): rename the duplicate(s)
in place, suffixing with a short disambiguator, then re-probe. Example:
```sql
-- rename the newer-by-createdAt duplicate(s), keeping the oldest row's name intact
UPDATE departments d SET name = d.name || ' (' || left(d.id::text, 8) || ')'
 WHERE EXISTS (SELECT 1 FROM departments d2 WHERE d2.name = d.name AND d2."createdAt" < d."createdAt");
```
Mirror for `services` keyed on `("departmentId", name)`. Re-run the probe → must be 0 rows. Capture
the before/after in the deploy log (manual data edit, no audit emitter — like DAT-012's normalization).

### DAT-017 orphan-task probe (CRITICAL, read-only — `ADD CONSTRAINT … CHECK` aborts on existing violators)

`20260527170000` adds a CHECK; Postgres validates it against the existing rows at `ADD CONSTRAINT`
time and aborts the whole `migrate deploy` with 23514 if any orphan row exists. Run this BEFORE
deploy; it must return `(0 rows)`.

```sql
-- a task linked to an epic/milestone but to NO project — the orphan the CHECK forbids
SELECT id, "projectId", "epicId", "milestoneId"
  FROM tasks
 WHERE "projectId" IS NULL AND ("epicId" IS NOT NULL OR "milestoneId" IS NOT NULL);
```
TBD-DEPLOY: probe output — expected `(0 rows)`. Dev pre-flight returned 0 violators (3288 tasks).

**Resolution if any row returns** (do NOT run `migrate deploy` until clean): backfill the missing
`projectId` from the epic/milestone parent (the canonical project the orphan should have named), then
re-probe. Example:
```sql
-- backfill from the epic parent (epics.projectId is NOT NULL)
UPDATE tasks t SET "projectId" = e."projectId"
  FROM epics e
 WHERE t."epicId" = e.id AND t."projectId" IS NULL;
-- backfill from the milestone parent (milestones.projectId is NOT NULL)
UPDATE tasks t SET "projectId" = m."projectId"
  FROM milestones m
 WHERE t."milestoneId" = m.id AND t."projectId" IS NULL;
```
If a flagged row has BOTH `epicId` and `milestoneId` NULL yet still trips the probe (impossible by the
predicate) it is not a violator; a row that is *truly* orphan (no parent to backfill from) can only be
the inverse, which the predicate excludes — so backfill resolves every case. Re-run the probe → must
be 0 rows. Capture before/after in the deploy log (manual data edit, no audit emitter).

### DAT-018 cycle probe (CRITICAL, read-only — the CHECK aborts on an existing self-loop; an existing cycle would make the trigger fire on the next write)

`20260527180000` adds a self-loop CHECK and a cycle-prevention trigger. The CHECK validates against
existing rows at `ADD CONSTRAINT` time and aborts the whole `migrate deploy` with 23514 if any row has
`taskId = dependsOnTaskId`. The trigger only fires on *future* writes, but if the existing graph already
contains a multi-hop cycle, the trigger would reject the next legitimate write that touches it — so the
cycle scan must also be clean BEFORE deploy. Run both; each must return `(0 rows)`.

```sql
-- 1) direct self-loop — the CHECK forbids it; aborts migrate deploy if present
SELECT "taskId", "dependsOnTaskId" FROM task_dependencies WHERE "taskId" = "dependsOnTaskId";

-- 2) multi-hop cycle scan (forward walk; columns are text, so a plain text[] path).
--    Any row = an existing cycle that the trigger would later choke on.
WITH RECURSIVE walk(start_id, current_id, path) AS (
  SELECT "taskId", "dependsOnTaskId", ARRAY["taskId"] FROM task_dependencies
  UNION ALL
  SELECT w.start_id, td."dependsOnTaskId", w.path || td."taskId"
  FROM walk w JOIN task_dependencies td ON td."taskId" = w.current_id
  WHERE NOT td."taskId" = ANY(w.path)
)
SELECT DISTINCT start_id FROM walk WHERE current_id = start_id;
```
TBD-DEPLOY: probe output — both expected `(0 rows)`. Dev pre-flight returned 0/0 (table empty, 0 rows).

**Resolution if any row returns** (do NOT run `migrate deploy` until clean): for a self-loop, `DELETE`
the offending row (`DELETE FROM task_dependencies WHERE "taskId" = "dependsOnTaskId";`). For a multi-hop
cycle, delete one edge per cycle (deterministically — e.g. the edge with the highest `(taskId,
dependsOnTaskId)` pair on each `start_id` returned by the scan), then re-run the scan → must be 0 rows.
Capture before/after in the deploy log (manual data edit, no audit emitter).

### DAT-023 overlap probe (CRITICAL — two parts: btree_gist availability + existing overlap; either aborts `migrate deploy`)

`20260527190000` adds `CREATE EXTENSION IF NOT EXISTS btree_gist` then an EXCLUDE constraint on `leaves`.
Two pre-conditions must hold or `migrate deploy` aborts:

1. **btree_gist must be creatable (superuser).** `CREATE EXTENSION` requires superuser (or a role with the
   privilege). Check whether it is already installed and whether the deploy role can create it:
   ```sql
   -- already installed? (if so the migration's CREATE is a no-op, no superuser needed at deploy)
   SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
   -- can the migration role create extensions? (rolsuper = t, or a member of a role that can)
   SELECT rolname, rolsuper FROM pg_roles WHERE rolname = current_user;
   ```
   TBD-DEPLOY: probe output. **If btree_gist is absent AND the deploy role is not superuser**, have a superuser run
   `CREATE EXTENSION IF NOT EXISTS btree_gist;` in `orchestr_a_prod` BEFORE `migrate deploy` (idempotent). The
   migration's own `CREATE EXTENSION IF NOT EXISTS` then no-ops. Dev: role `orchestr_a` is superuser, extension
   was absent and created cleanly.

2. **No existing overlapping APPROVED pair** — the `ADD CONSTRAINT … EXCLUDE` validates against existing rows
   and aborts with 23P01 if any APPROVED pair for one user overlaps. Run read-only; must return `(0 rows)`:
   ```sql
   SELECT l1.id AS id1, l2.id AS id2, l1."userId",
          l1."startDate" AS s1, l1."endDate" AS e1,
          l2."startDate" AS s2, l2."endDate" AS e2
   FROM leaves l1
   JOIN leaves l2 ON l1."userId" = l2."userId" AND l1.id < l2.id
   WHERE l1.status = 'APPROVED' AND l2.status = 'APPROVED'
     AND daterange(l1."startDate", l1."endDate", '[]') && daterange(l2."startDate", l2."endDate", '[]');
   ```
   TBD-DEPLOY: probe output — expected `(0 rows)`. Dev pre-flight returned 0 (3 leaves, all APPROVED, none overlap).

**Resolution if any pair returns** (do NOT run `migrate deploy` until clean): for each overlapping pair, set the
**older** row (lower `id1`, or the one with the earlier `createdAt` if preferred) to a non-APPROVED status —
e.g. `UPDATE leaves SET status = 'CANCELLED', "validationComment" = COALESCE("validationComment",'') || ' [DAT-023 pre-deploy overlap resolution]' WHERE id = '<id1>';` — then re-run the scan → must be 0 rows. Only
APPROVED rows are constrained, so demoting one of each pair clears the conflict. Capture before/after in the
deploy log (manual data edit, no audit emitter).

### DAT-032/033 numeric-bound probe (recommended, read-only — `ADD CONSTRAINT … CHECK` aborts on a violator)

`20260528120000` adds two CHECK constraints (`subtasks_position_ck`: `position >= 0`;
`time_entries_hours_ck`: `hours BETWEEN 0 AND 24`). Each validates against existing rows at
`ADD CONSTRAINT` time. Dev pre-flight returned 0 violators on both; run the same scan on prod to
confirm:

```sql
-- 1) Subtask.position >= 0 — must return 0.
SELECT count(*) AS subtask_position_violators FROM subtasks WHERE "position" < 0;

-- 2) TimeEntry.hours bounds — the dual scan. `dismissals` (hours = 0, isDismissal = true) is the
-- legitimate value class the CHECK admits by design; `negatives` / `over_cap` /
-- `partial_below_quarter` MUST be 0 (the DTO floor 0.25 is at the application layer; the DB
-- floor is `>= 0` deliberately, see operational note on dismissals).
SELECT count(*) FILTER (WHERE hours = 0) AS dismissals,
       count(*) FILTER (WHERE hours < 0) AS negatives,
       count(*) FILTER (WHERE hours > 24) AS over_cap,
       count(*) FILTER (WHERE hours > 0 AND hours < 0.25) AS partial_below_quarter
  FROM time_entries;
```

TBD-DEPLOY: probe output. Pass: `subtask_position_violators = 0`; `negatives = 0`, `over_cap = 0`,
`partial_below_quarter = 0`; `dismissals` may be any non-negative count (don't gate on it).

**Resolution if any of the four MUST-be-0 columns returns > 0** (do NOT run `migrate deploy` until clean):
inspect the violators and decide (a) data-cleanup in place (`UPDATE … SET hours = 0` on negatives,
`UPDATE … SET hours = 24` on over-cap, or `DELETE` for partial entries that are clearly stale), or
(b) bail the migration if the violation suggests a write path the DTO didn't gate. Capture
before/after in the deploy log.

### DAT-036 client-name duplicate probe (CRITICAL, read-only — `CREATE UNIQUE INDEX` aborts on existing dups)

`20260528130000` adds `clients_name_key` UNIQUE. Same shape as DAT-016 — Postgres validates against
existing rows at index-build time and aborts with 23505 if any duplicate exists. Run BEFORE deploy;
must return `(0 rows)`:

```sql
SELECT name, count(*) FROM clients GROUP BY name HAVING count(*) > 1;
```

TBD-DEPLOY: probe output — expected `(0 rows)`. Dev pre-flight returned 0 duplicates (200 clients).

**Resolution if any row returns** (do NOT run `migrate deploy` until clean): rename the duplicate(s) in
place, suffixing with a short disambiguator (mirror the DAT-016 resolution pattern), then re-probe:
```sql
UPDATE clients c SET name = c.name || ' (' || left(c.id::text, 8) || ')'
 WHERE EXISTS (SELECT 1 FROM clients c2 WHERE c2.name = c.name AND c2."createdAt" < c."createdAt");
```
Capture before/after in the deploy log (manual data edit, no audit emitter — like DAT-016).

### DAT-037 task-projectId-vs-parent drift + topology probe (CRITICAL, read-only — trigger fires on next legitimate write if drift exists)

`20260528150000` installs (1) a task-side BEFORE INSERT/UPDATE REJECT trigger and (2) AFTER UPDATE
cascade triggers on `epics`/`milestones`. The `CREATE TRIGGER` does NOT validate existing rows at
deploy — but the BEFORE arm will fire (P0001 `tasks_project_matches_epic` / `…_matches_milestone`)
on the next legitimate task UPDATE if drift exists today. Worse, a task with BOTH parents in
different projects would deadlock the cascade (moving either parent leaves the task disagreeing
with the OTHER parent → BEFORE rejects the cascade). Run BOTH scans BEFORE deploy:

```sql
-- 1) drift task.projectId vs epic.projectId — must return 0
SELECT count(*) AS task_vs_epic_drift
  FROM tasks t JOIN epics e ON t."epicId" = e.id
 WHERE t."projectId" IS DISTINCT FROM e."projectId";

-- 2) drift task.projectId vs milestone.projectId — must return 0
SELECT count(*) AS task_vs_milestone_drift
  FROM tasks t JOIN milestones m ON t."milestoneId" = m.id
 WHERE t."projectId" IS DISTINCT FROM m."projectId";

-- 3) topology — task with BOTH parents in DIFFERENT projects (deadlock surface) — must return 0
SELECT count(*) AS competing_parents
  FROM tasks t JOIN epics e ON t."epicId" = e.id JOIN milestones m ON t."milestoneId" = m.id
 WHERE e."projectId" <> m."projectId";
```

TBD-DEPLOY: probe output — all three must be 0. Dev pre-flight: 0 / 0 / 0 (435 tasks with both
parents set, all in the same project).

**Resolution if any drift scan returns > 0**: backfill `tasks.projectId` from the parent —
`UPDATE tasks t SET "projectId" = e."projectId" FROM epics e WHERE t."epicId" = e.id AND t."projectId" IS DISTINCT FROM e."projectId";`
(and the milestone variant). The cascade itself would do this AFTER deploy on the next parent
update, but doing it pre-deploy keeps the BEFORE trigger silent and surfaces any drift in the
deploy log instead of latent in app behavior.

**Resolution if the competing-parents scan returns > 0**: the cascade design cannot accept this
topology — operator must choose one parent's project for each affected task and either NULL the
other parent or move it into the same project. **Do not deploy DAT-037 until the topology scan
returns 0.**

### DAT-038 events parent-cycle probe (CRITICAL, read-only — CHECK aborts on self-loop; cycle would choke trigger on next write)

`20260528140000` adds a self-loop CHECK and an upward-walk cycle trigger on `events`. Same shape
as DAT-018 (which is on `task_dependencies`) — the CHECK validates at `ADD CONSTRAINT` time, the
trigger only fires on future writes but an existing cycle would reject the next legitimate event
mutation. Run both BEFORE deploy:

```sql
-- 1) direct self-loop — the CHECK forbids it; aborts migrate deploy if present
SELECT id FROM events WHERE "parentEventId" = id;

-- 2) multi-hop cycle scan via upward walk on the parent chain (columns are text; UNION dedupes for
--    cycle-safe termination). Any row = an existing cycle that the trigger would later choke on.
WITH RECURSIVE walk(start_id, current_id, path) AS (
  SELECT id, "parentEventId", ARRAY[id] FROM events WHERE "parentEventId" IS NOT NULL
  UNION
  SELECT w.start_id, e."parentEventId", w.path || e.id
    FROM walk w JOIN events e ON e.id = w.current_id
   WHERE w.current_id IS NOT NULL AND NOT (e.id = ANY(w.path))
)
SELECT DISTINCT start_id FROM walk WHERE current_id = start_id;
```

TBD-DEPLOY: probe output — both expected `(0 rows)`. Dev pre-flight returned 0/0 (195 events, 0
parented at all).

**Resolution if any row returns** (do NOT run `migrate deploy` until clean): for a self-loop,
`UPDATE events SET "parentEventId" = NULL WHERE "parentEventId" = id;` (NULL is a legitimate
parent-less state). For a multi-hop cycle, NULL the parentEventId on one event per cycle
(deterministically — e.g. the one with the highest `id` in each returned `start_id`). Re-scan →
must be 0 rows. Capture before/after in the deploy log.

### DAT-035 project-member-role length probe (recommended, read-only — `ADD CONSTRAINT … CHECK` aborts on a violator)

`20260528160000` adds `project_members_role_length_ck` = `char_length(role) BETWEEN 1 AND 100`. The
`role` column is NOT NULL at the schema level, so the CHECK does not need an `IS NULL` arm. Run
BEFORE deploy; all three must return the expected values:

```sql
SELECT max(char_length(role)) AS maxlen,
       count(*) FILTER (WHERE role IS NULL) AS nulls,
       count(*) FILTER (WHERE role = '') AS empties
  FROM project_members;
```

TBD-DEPLOY: probe output. Pass: `maxlen <= 100`, `nulls = 0`, `empties = 0`. Dev pre-flight: 17 / 0
/ 0 across 2959 rows.

**Resolution if `maxlen > 100`**: either widen the CHECK bound (edit the migration and bump N
before retry — but the chosen 100 already gives ~5.8x headroom over dev max, so a prod value
exceeding it warrants investigation), OR shorten the offending rows
(`UPDATE project_members SET role = substring(role, 1, 100) WHERE char_length(role) > 100;`).
**Resolution if `nulls > 0`** (shouldn't happen — column is NOT NULL): backfill with `'Membre'`
(the service's default). **Resolution if `empties > 0`** (same — DB allows empty string only if
the migration hadn't run yet): backfill with `'Membre'` or `DELETE` if truly cruft. Capture
before/after in the deploy log. Whitespace-only is intentionally accepted by the CHECK (the DTO
trims at the API boundary); a future tightening to `length(btrim(role)) >= 1` would be a separate
decision.

---

## GATE 1 — probe outcome reported to operator (awaiting greenlight)

- TBD-DEPLOY: DAT-012 probe — all 6 columns 0 out-of-set rows? (cast-safe / needs resolution).
- TBD-DEPLOY: DAT-016 + DAT-036 duplicate-name probes — all 3 `GROUP BY … HAVING` queries `(0 rows)`?
- TBD-DEPLOY: DAT-017 orphan-task probe — 0 rows? DAT-037 drift + topology probes (3 scans) — 0 / 0 / 0?
- TBD-DEPLOY: DAT-018 + DAT-038 cycle probes (4 scans total — 2 per family) — all `(0 rows)`?
- TBD-DEPLOY: DAT-023 overlap probe + btree_gist availability — `(0 rows)` + Step 0 outcome decided?
- TBD-DEPLOY: DAT-032/033 + DAT-035 numeric/length probes — `subtask_position_violators = 0`,
  `time_entries: negatives = over_cap = partial_below_quarter = 0`, `project_members: maxlen ≤ 100`?
- TBD-DEPLOY: DAT-013 time-format scan (6 columns) — all `(0 rows)`?
- TBD-DEPLOY: disk headroom for `docker compose build api` (Phase 1 hit 99% — check `df -h /`; the api
  image is ≈1.68 GB; `docker image prune` / `docker builder prune` if tight).
- TBD-DEPLOY: any baseline surprise (extra pending migration, unexpected `_prisma_migrations` HEAD).

**STOP. Awaiting explicit "greenlight Phase 3 deploy" before any mutation.**

TBD-DEPLOY: GATE 1 decision (greenlit / blocked + reason).

---

## Deploy execution

**Captured:** TBD-DEPLOY: timestamp (prod UTC). (Only after Gate 1 greenlight.)

### Rollback anchor
```
docker tag orchestra-api:latest orchestra-api:pre-phase3-defense-in-depth
```
TBD-DEPLOY: anchor image id (the pre-deploy api image; image-rollback target).

### Safety dump
```
docker exec orchestr-a-postgres-prod pg_dump -U orchestr_a -F c orchestr_a_prod \
  > /opt/orchestra/backups-prod/orchestr_a_prod_predeploy_phase3_TBD-DEPLOY-yyyymmdd.dump
```
TBD-DEPLOY: dump filename + byte size.

### Conditional pre-step — `CREATE EXTENSION btree_gist` (only if §"Pre-deploy checklist" Step 0 row 3 applied)

```
# ONLY if §"Pre-deploy checklist" Step 0 (a)=absent AND (b)=non-superuser. Otherwise skip.
$ docker exec -i orchestr-a-postgres-prod psql -U <superuser> -d orchestr_a_prod \
    -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
# verify
$ docker exec -i orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod \
    -c "SELECT extname FROM pg_extension WHERE extname='btree_gist';"
```
TBD-DEPLOY: extension creation output (or "skipped — Step 0 outcome row 1 or 2").

### git pull → build api → migrate deploy → up
```
$ git pull                                   # TBD-DEPLOY: FF range — expect HEAD = the master tip carrying all 13 batch migrations (8 Phase 3 + 5 mini-arc), the 5 code-only changes (COR-022/034/035/037, DAT-034), and this re-finalized deploy doc; verify with `git rev-parse HEAD` and `git log --oneline -1`
$ docker compose -f docker-compose.prod.yml --env-file .env.production build api   # TBD-DEPLOY: exit 0, new image id
$ docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api pnpm prisma migrate deploy
TBD-DEPLOY: must show EXACTLY:
  Applying migration `20260527120000_dat003_dat004_business_invariants`
  Applying migration `20260527130000_dat012_promote_string_enums`
  Applying migration `20260527140000_dat013_time_format_check`
  Applying migration `20260527150000_dat014_leave_type_autosync_trigger`
  Applying migration `20260527160000_dat016_unique_name_constraints`
  Applying migration `20260527170000_dat017_task_parent_requires_project_check`
  Applying migration `20260527180000_dat018_task_dependency_cycle_prevention`
  Applying migration `20260527190000_dat023_leave_no_overlap_exclude`
  Applying migration `20260528120000_dat032_dat033_position_and_hours_bounds`
  Applying migration `20260528130000_dat036_client_name_unique`
  Applying migration `20260528140000_dat038_event_parent_cycle_prevention`
  Applying migration `20260528150000_dat037_task_project_consistency`
  Applying migration `20260528160000_dat035_project_member_role_length`
  All migrations have been successfully applied.
$ docker compose -f docker-compose.prod.yml --env-file .env.production up -d api    # TBD-DEPLOY: healthy in ~Ns
```
TBD-DEPLOY: confirm exactly the 13 batch migrations applied in deploy order (no more, no fewer). TBD-DEPLOY: running api image id
(should be the freshly built image, not the `pre-phase3-defense-in-depth` anchor).

---

## Post-deploy verification

**Captured:** TBD-DEPLOY: timestamp (prod UTC).

| Check | Command / method | Result |
|-------|------------------|--------|
| V1 — all migrations applied | `SELECT migration_name, applied_steps_count, finished_at FROM _prisma_migrations WHERE migration_name IN ('20260527120000_dat003_dat004_business_invariants','20260527130000_dat012_promote_string_enums','20260527140000_dat013_time_format_check','20260527150000_dat014_leave_type_autosync_trigger','20260527160000_dat016_unique_name_constraints','20260527170000_dat017_task_parent_requires_project_check','20260527180000_dat018_task_dependency_cycle_prevention','20260527190000_dat023_leave_no_overlap_exclude','20260528120000_dat032_dat033_position_and_hours_bounds','20260528130000_dat036_client_name_unique','20260528140000_dat038_event_parent_cycle_prevention','20260528150000_dat037_task_project_consistency','20260528160000_dat035_project_member_role_length');` | TBD-DEPLOY: 13 rows, each `applied_steps_count=1`, no mixed state |
| V2 — enum columns are now `USER-DEFINED` | `SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE udt_name IN ('PredefinedTaskDuration','DayPeriod','AssignmentCompletionStatus','RecurrenceType','AppSettingsCategory');` | TBD-DEPLOY: 6 rows mapping the 6 promoted columns |
| V3 — all services healthy | `docker compose … ps` | TBD-DEPLOY: api/web/nginx/postgres/redis `Up (healthy)` |
| V4 — running api image | `docker inspect …` | TBD-DEPLOY: freshly built image, not the anchor |
| V5 — row counts vs baseline | the Phase-4 count query | TBD-DEPLOY: unchanged (no data loss) |

### CHECK-constraint smoke (INSERT-then-ROLLBACK — leaves NO residue)

One representative per CHECK family. Each is wrapped in `BEGIN; … ROLLBACK;` so prod data is never
mutated; the constraint must fire with SQLSTATE **23514** *before* the rollback.

```sql
-- 1) inverted date range → expect ERROR 23514 violating "projects_dates_ck"
BEGIN;
  INSERT INTO projects (id, name, "startDate", "endDate", "updatedAt")
  VALUES (gen_random_uuid(), 'phase3 smoke inverted', DATE '2026-02-01', DATE '2026-01-01', now());
ROLLBACK;

-- 2) out-of-range progress → expect ERROR 23514 violating "tasks_progress_ck"
BEGIN;
  INSERT INTO tasks (id, title, progress, "updatedAt")
  VALUES (gen_random_uuid(), 'phase3 smoke bad progress', -1, now());
ROLLBACK;

-- 3) malformed time-of-day (DAT-013) → expect ERROR 23514 violating "tasks_startTime_format_ck"
BEGIN;
  INSERT INTO tasks (id, title, "startTime", "updatedAt")
  VALUES (gen_random_uuid(), 'phase3 smoke bad time', '25:99', now());
ROLLBACK;
```
TBD-DEPLOY: paste all three errors (must name the constraint + SQLSTATE 23514). If any INSERT *succeeds*,
that constraint did not deploy → investigate before declaring done.

### Enum smoke (DAT-012 analog — INSERT-then-ROLLBACK)

```sql
-- invalid enum value → expect ERROR 22P02 "invalid input value for enum AppSettingsCategory"
-- (gen_random_uuid() casts implicitly to the text id column — same as the CHECK smoke above)
BEGIN;
  INSERT INTO app_settings (id, "key", "value", "category", "updatedAt")
  VALUES (gen_random_uuid(), 'phase3-smoke', '"x"', 'BOGUS', now());
ROLLBACK;
```
TBD-DEPLOY: paste the 22P02 error (confirms the enum type is enforced in prod).

### Leave-type auto-sync trigger smoke (DAT-014 — INSERT-then-ROLLBACK, asserts COERCION not rejection)

Unlike the CHECK/enum smokes (which expect an ERROR), the DAT-014 trigger **silently coerces**: it
must *accept* a deliberately-wrong `type` and rewrite it to the FK-derived value. The smoke inserts a
mismatched row inside a transaction, reads it back, and rolls back — prod data is never mutated.

```sql
BEGIN;
  -- pick any existing user + the 'CP' config; force a wrong type='RTT'
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "type", "startDate", "endDate", days, status, "updatedAt")
  SELECT 'dat014-prod-smoke', u.id, c.id, 'RTT'::"LeaveType",
         DATE '2026-03-01', DATE '2026-03-02', 1, 'PENDING', now()
  FROM (SELECT id FROM users LIMIT 1) u, (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1) c;
  -- expect: type = 'CP' (trigger coerced 'RTT' → the FK code), NOT 'RTT'
  SELECT "type"::text AS coerced_type FROM "leaves" WHERE id = 'dat014-prod-smoke';
ROLLBACK;
```
TBD-DEPLOY: paste the `coerced_type` value — must be `CP`, not `RTT`. If it reads back `RTT`, the trigger did
not deploy → investigate before declaring done. (Also confirm the trigger exists:
`SELECT tgname FROM pg_trigger WHERE tgrelid='leaves'::regclass AND NOT tgisinternal;` → must list
`leaves_sync_type_trg`.)

### Name-uniqueness smoke (DAT-016 — INSERT-then-ROLLBACK; one negative per index + one positive)

Both directions in a single transaction, rolled back so prod data is never mutated. Run via
`docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod`. Unlike the witness
spec (which goes through Prisma and sees only the `Key (<cols>)=` detail), a raw `psql` session
surfaces the full Postgres message **naming the index** — assert on that.

```sql
-- NEGATIVE 1: two departments, same name → expect ERROR 23505 violating "departments_name_key"
BEGIN;
  INSERT INTO departments (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat016 prod smoke dept', now());
  INSERT INTO departments (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat016 prod smoke dept', now());
ROLLBACK;

-- NEGATIVE 2: two services, same name, SAME department → expect ERROR 23505
--             violating "services_departmentId_name_key"
BEGIN;
  WITH d AS (
    INSERT INTO departments (id, name, "updatedAt")
    VALUES (gen_random_uuid(), 'dat016 smoke parent', now()) RETURNING id
  )
  INSERT INTO services (id, name, "departmentId", "updatedAt")
  SELECT gen_random_uuid(), 'dat016 dup svc', d.id, now() FROM d;
  INSERT INTO services (id, name, "departmentId", "updatedAt")
  SELECT gen_random_uuid(), 'dat016 dup svc', id, now()
  FROM departments WHERE name = 'dat016 smoke parent';
ROLLBACK;

-- POSITIVE: same service name in DIFFERENT departments → BOTH succeed (proves composite, not global).
BEGIN;
  INSERT INTO departments (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat016 smoke A', now());
  INSERT INTO departments (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat016 smoke B', now());
  INSERT INTO services (id, name, "departmentId", "updatedAt")
  SELECT gen_random_uuid(), 'dat016 shared svc', id, now() FROM departments WHERE name = 'dat016 smoke A';
  INSERT INTO services (id, name, "departmentId", "updatedAt")
  SELECT gen_random_uuid(), 'dat016 shared svc', id, now() FROM departments WHERE name = 'dat016 smoke B';
  SELECT count(*) AS shared_ok FROM services WHERE name = 'dat016 shared svc';  -- expect 2, no error
ROLLBACK;
```
TBD-DEPLOY: paste the two 23505 errors (each must name its index) + the positive `shared_ok=2`. If a NEGATIVE
INSERT *succeeds*, the index did not deploy; if the POSITIVE 23505s, an accidental global unique on
`services.name` was created → investigate before declaring done. (Also confirm the indexes exist:
`SELECT indexname FROM pg_indexes WHERE indexname IN ('departments_name_key','services_departmentId_name_key');`
→ must list both.)

### Task parent-consistency smoke (DAT-017 — INSERT-then-ROLLBACK; 2 negatives + 2 positives)

The CHECK rejects an orphan (epic/milestone set but no project) and accepts both the all-null
transverse task and a regular project task. All wrapped in `BEGIN; … ROLLBACK;` so prod data is never
mutated.

```sql
-- NEGATIVE 1: epic set, no project → expect ERROR 23514 violating "tasks_parent_requires_project_ck"
BEGIN;
  INSERT INTO tasks (id, title, "projectId", "epicId", "updatedAt")
  SELECT gen_random_uuid(), 'dat017 smoke orphan-epic', NULL, e.id, now()
  FROM epics e LIMIT 1;
ROLLBACK;

-- NEGATIVE 2: milestone set, no project → expect ERROR 23514 violating "tasks_parent_requires_project_ck"
BEGIN;
  INSERT INTO tasks (id, title, "projectId", "milestoneId", "updatedAt")
  SELECT gen_random_uuid(), 'dat017 smoke orphan-ms', NULL, m.id, now()
  FROM milestones m LIMIT 1;
ROLLBACK;

-- POSITIVE 1: true transverse task — all three NULL → succeeds (the legitimate use case preserved)
BEGIN;
  INSERT INTO tasks (id, title, "projectId", "epicId", "milestoneId", "updatedAt")
  VALUES (gen_random_uuid(), 'dat017 smoke transverse', NULL, NULL, NULL, now());
ROLLBACK;

-- POSITIVE 2: regular project task with an epic → succeeds (projectId non-null satisfies the CHECK)
BEGIN;
  INSERT INTO tasks (id, title, "projectId", "epicId", "updatedAt")
  SELECT gen_random_uuid(), 'dat017 smoke regular', e."projectId", e.id, now()
  FROM epics e LIMIT 1;
ROLLBACK;
```
TBD-DEPLOY: paste the two 23514 errors (each must name `tasks_parent_requires_project_ck`) + confirm both
positives `INSERT 0 1`. If a NEGATIVE INSERT *succeeds*, the CHECK did not deploy; if a POSITIVE
errors, the predicate is wrong → investigate before declaring done. (Also confirm the constraint
exists: `SELECT conname FROM pg_constraint WHERE conname='tasks_parent_requires_project_ck';` → must
list it.) Note the negatives read an existing epic/milestone id so the row trips ONLY the CHECK
(23514), not the FK (23503) — Postgres does not guarantee CHECK-before-FK evaluation order, so a
random non-existent parent id could surface 23503 instead and muddy the assertion. If `epics` or
`milestones` is empty in prod, skip that negative (there is nothing to orphan) and rely on the witness
spec + dev pre-flight for that half; the positives still run (Positive 1 needs no parent).

### TaskDependency cycle smoke (DAT-018 — INSERT-then-ROLLBACK; 3 negatives + 3 positives)

The self-loop CHECK rejects `A→A` (23514), the trigger rejects multi-hop cycles (RAISE carrying
`task_dependencies_no_cycle`), and DAGs (linear / tree / diamond) are accepted. All wrapped in
`BEGIN; … ROLLBACK;` so prod data is never mutated. Each transaction creates throwaway tasks inside
itself so it needs no pre-existing rows. Run via `docker exec orchestr-a-postgres-prod psql -U
orchestr_a -d orchestr_a_prod`.

```sql
-- NEGATIVE 1: self-loop A->A → expect ERROR 23514 violating "task_dependencies_no_self_ck"
BEGIN;
  WITH a AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke self', now()) RETURNING id)
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), a.id, a.id, now() FROM a;
ROLLBACK;

-- NEGATIVE 2: 2-hop cycle A->B then B->A → 2nd INSERT raises, message contains "task_dependencies_no_cycle"
BEGIN;
  WITH a AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke 2a', now()) RETURNING id),
       b AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke 2b', now()) RETURNING id)
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), a.id, b.id, now() FROM a, b;   -- A->B accepted
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), d."dependsOnTaskId", d."taskId", now()
  FROM task_dependencies d WHERE d."taskId" IN (SELECT id FROM tasks WHERE title='dat018 smoke 2a');  -- B->A raises
ROLLBACK;

-- NEGATIVE 3: 3-hop cycle A->B, B->C, then C->A → 3rd INSERT raises "task_dependencies_no_cycle"
BEGIN;
  WITH a AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke 3a', now()) RETURNING id),
       b AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke 3b', now()) RETURNING id),
       c AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke 3c', now()) RETURNING id)
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), a.id, b.id, now() FROM a, b
  UNION ALL SELECT gen_random_uuid(), b.id, c.id, now() FROM b, c;   -- A->B, B->C accepted
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(),
         (SELECT id FROM tasks WHERE title='dat018 smoke 3c'),
         (SELECT id FROM tasks WHERE title='dat018 smoke 3a'), now();   -- C->A raises
ROLLBACK;

-- POSITIVE 1: linear chain A->B->C->D → all 3 edges accepted (no cycle)
BEGIN;
  WITH a AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke lA', now()) RETURNING id),
       b AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke lB', now()) RETURNING id),
       c AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke lC', now()) RETURNING id),
       d AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke lD', now()) RETURNING id)
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), a.id, b.id, now() FROM a, b
  UNION ALL SELECT gen_random_uuid(), b.id, c.id, now() FROM b, c
  UNION ALL SELECT gen_random_uuid(), c.id, d.id, now() FROM c, d;
  SELECT count(*) AS linear_ok FROM task_dependencies td JOIN tasks t ON t.id=td."taskId" WHERE t.title LIKE 'dat018 smoke l%';  -- expect 3
ROLLBACK;

-- POSITIVE 2: tree A->B, A->C → both accepted (shared parent is not a cycle)
BEGIN;
  WITH a AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke tA', now()) RETURNING id),
       b AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke tB', now()) RETURNING id),
       c AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke tC', now()) RETURNING id)
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), a.id, b.id, now() FROM a, b
  UNION ALL SELECT gen_random_uuid(), a.id, c.id, now() FROM a, c;   -- both accepted
ROLLBACK;

-- POSITIVE 3: diamond A->B, A->C, B->D, C->D → all 4 accepted (convergence, no cycle)
BEGIN;
  WITH a AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke dA', now()) RETURNING id),
       b AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke dB', now()) RETURNING id),
       c AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke dC', now()) RETURNING id),
       d AS (INSERT INTO tasks (id, title, "updatedAt") VALUES (gen_random_uuid(), 'dat018 smoke dD', now()) RETURNING id)
  INSERT INTO task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt")
  SELECT gen_random_uuid(), a.id, b.id, now() FROM a, b
  UNION ALL SELECT gen_random_uuid(), a.id, c.id, now() FROM a, c
  UNION ALL SELECT gen_random_uuid(), b.id, d.id, now() FROM b, d
  UNION ALL SELECT gen_random_uuid(), c.id, d.id, now() FROM c, d;   -- all 4 accepted
ROLLBACK;
```
TBD-DEPLOY: paste the self-loop 23514 (must name `task_dependencies_no_self_ck`) + the two trigger raises
(each message must contain `task_dependencies_no_cycle`) + the three positives succeeding (`linear_ok=3`,
the tree/diamond INSERTs returning their row counts with no error). If a NEGATIVE *succeeds*, that guard
did not deploy; if a POSITIVE *errors*, the trigger false-rejects a DAG → investigate before declaring
done. (Also confirm the objects exist: `SELECT conname FROM pg_constraint WHERE conname='task_dependencies_no_self_ck';`
and `SELECT tgname FROM pg_trigger WHERE tgname='task_dependencies_no_cycle_trg';` → must list each.)

### Leave no-overlap smoke (DAT-023 — INSERT-then-ROLLBACK; 3 negatives + 3 positives)

Each negative is its own `BEGIN; … ROLLBACK;` (a 23P01 aborts the transaction, so a shared block would
fail subsequent statements with "current transaction is aborted"). Prod data is never mutated. **Use
far-future dates (2099)** so the inserted APPROVED rows cannot overlap any real leave of the picked user
(which would itself raise 23P01 on the *first* insert and mask the test). Run via
`docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod`.

```sql
-- NEGATIVE 1: two APPROVED leaves, same user, overlapping → 2nd ERROR 23P01 violating "leaves_no_overlap"
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-03-01', DATE '2099-03-10', 1, 'APPROVED', now() FROM u, c;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-03-05', DATE '2099-03-15', 1, 'APPROVED', now() FROM u, c;  -- expect ERROR 23P01
ROLLBACK;

-- NEGATIVE 2: [] inclusive-bound adjacency — one ends 2099-04-05, next starts 2099-04-05 → ERROR 23P01
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-04-01', DATE '2099-04-05', 1, 'APPROVED', now() FROM u, c;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-04-05', DATE '2099-04-10', 1, 'APPROVED', now() FROM u, c;  -- expect ERROR 23P01
ROLLBACK;

-- NEGATIVE 3: the race path — two overlapping PENDING accepted; approving the 2nd → ERROR 23P01
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT 'dat023-race-1', u.id, c.id, DATE '2099-05-01', DATE '2099-05-05', 1, 'PENDING', now() FROM u, c;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT 'dat023-race-2', u.id, c.id, DATE '2099-05-03', DATE '2099-05-07', 1, 'PENDING', now() FROM u, c;
  UPDATE "leaves" SET status = 'APPROVED' WHERE id = 'dat023-race-1';   -- accepted (first APPROVED)
  UPDATE "leaves" SET status = 'APPROVED' WHERE id = 'dat023-race-2';   -- expect ERROR 23P01 (enters predicate)
ROLLBACK;

-- POSITIVE 1: same user, overlapping, but one PENDING → both accepted (partial WHERE)
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-06-01', DATE '2099-06-10', 1, 'APPROVED', now() FROM u, c;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-06-05', DATE '2099-06-15', 1, 'PENDING', now() FROM u, c;   -- accepted
ROLLBACK;

-- POSITIVE 2: two APPROVED overlapping for DIFFERENT users → both accepted (userId scoping). Needs ≥2 users.
BEGIN;
  WITH c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 0), c.id, DATE '2099-07-01', DATE '2099-07-10', 1, 'APPROVED', now() FROM c;
  WITH c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET 1), c.id, DATE '2099-07-01', DATE '2099-07-10', 1, 'APPROVED', now() FROM c;   -- accepted (different user)
ROLLBACK;

-- POSITIVE 3: same user, two APPROVED, non-overlapping gap → both accepted
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-08-01', DATE '2099-08-05', 1, 'APPROVED', now() FROM u, c;
  WITH u AS (SELECT id FROM users LIMIT 1), c AS (SELECT id FROM leave_type_configs WHERE code='CP' LIMIT 1)
  INSERT INTO "leaves" (id, "userId", "leave_type_id", "startDate", "endDate", days, status, "updatedAt")
  SELECT gen_random_uuid(), u.id, c.id, DATE '2099-08-12', DATE '2099-08-15', 1, 'APPROVED', now() FROM u, c;   -- accepted (gap)
ROLLBACK;
```
TBD-DEPLOY: paste the three negatives erroring with 23P01 (each must name `leaves_no_overlap`) + the three positives
succeeding. If a NEGATIVE *succeeds*, the constraint did not deploy; if a POSITIVE *errors*, the WHERE/userId
scoping is wrong → investigate before declaring done. (Also confirm the objects exist:
`SELECT extname FROM pg_extension WHERE extname='btree_gist';` and
`SELECT conname FROM pg_constraint WHERE conname='leaves_no_overlap';` → must list each.)

### DAT-032/033 numeric-bound smoke (CHECK fires — INSERT-then-ROLLBACK)

```sql
-- NEGATIVE 1: subtasks position = -1 → expect ERROR 23514 violating "subtasks_position_ck"
BEGIN;
  INSERT INTO subtasks (id, title, "position", "taskId", "updatedAt")
  SELECT gen_random_uuid(), 'dat032 smoke neg', -1, t.id, now() FROM tasks t LIMIT 1;
ROLLBACK;

-- NEGATIVE 2: time_entries hours = -1 → expect ERROR 23514 violating "time_entries_hours_ck"
--   (set userId so the pre-existing time_entries_actor_xor_check passes — only the new CHECK fails)
BEGIN;
  INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "updatedAt")
  SELECT gen_random_uuid(), u.id, u.id, DATE '2099-09-01', -1, 'DEVELOPMENT', now() FROM users u LIMIT 1;
ROLLBACK;

-- NEGATIVE 3: time_entries hours = 25 → expect ERROR 23514 violating "time_entries_hours_ck"
BEGIN;
  INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "updatedAt")
  SELECT gen_random_uuid(), u.id, u.id, DATE '2099-09-02', 25, 'DEVELOPMENT', now() FROM users u LIMIT 1;
ROLLBACK;

-- POSITIVE 1: subtasks position = 0 → accepted (inclusive lower bound)
BEGIN;
  INSERT INTO subtasks (id, title, "position", "taskId", "updatedAt")
  SELECT gen_random_uuid(), 'dat032 smoke pos', 0, t.id, now() FROM tasks t LIMIT 1;
ROLLBACK;

-- POSITIVE 2: time_entries hours = 0 with isDismissal = true → accepted (dismissal floor — DESIGN PIN).
-- This is the load-bearing positive: a CHECK encoding `hours >= 0.25` would reject this; the DB
-- floor is `>= 0` exactly to admit dismissals (see operational note).
BEGIN;
  INSERT INTO time_entries (id, "declaredById", "userId", date, hours, "activityType", "isDismissal", "updatedAt")
  SELECT gen_random_uuid(), u.id, u.id, DATE '2099-09-03', 0, 'DEVELOPMENT', true, now() FROM users u LIMIT 1;
ROLLBACK;
```
TBD-DEPLOY: paste 3 negatives (23514 + constraint name) + 2 positives `INSERT 0 1`. If `hours = 0`
*errors*, the floor was tightened past the design (over-constraint trap — refuse to declare done).

### DAT-036 client-name UNIQUE smoke (INSERT-then-ROLLBACK; 1 negative + 1 positive)

```sql
-- NEGATIVE: two clients, identical name → 2nd ERROR 23505 violating "clients_name_key"
BEGIN;
  INSERT INTO clients (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat036 smoke client', now());
  INSERT INTO clients (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat036 smoke client', now());
ROLLBACK;

-- POSITIVE: two clients, distinct names → both accepted
BEGIN;
  INSERT INTO clients (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat036 smoke client A', now());
  INSERT INTO clients (id, name, "updatedAt") VALUES (gen_random_uuid(), 'dat036 smoke client B', now());
ROLLBACK;
```
TBD-DEPLOY: paste the 23505 error (must name `clients_name_key`) + the positive `INSERT 0 1` × 2.
(Also confirm: `SELECT indexname FROM pg_indexes WHERE tablename='clients' AND indexname='clients_name_key';` → 1 row.)

### DAT-038 event parent-cycle smoke (CHECK + trigger — INSERT-then-ROLLBACK; 2 negatives + 2 positives)

```sql
-- NEGATIVE 1: self-loop X.parentEventId = X.id → ERROR 23514 violating "events_parent_no_self_ck"
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt", "parentEventId")
  SELECT 'dat038-smoke-self', 'dat038 self', DATE '2099-10-01', true, false, false, u.id, now(), now(),
         'dat038-smoke-self' FROM u;
ROLLBACK;

-- NEGATIVE 2: 2-hop cycle — A.parent=null, B.parent=A, then UPDATE A.parent = B → trigger raises
--   "events_parent_no_cycle"
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt")
  SELECT 'dat038-smoke-A', 'dat038 A', DATE '2099-10-01', true, false, false, u.id, now(), now() FROM u;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt", "parentEventId")
  SELECT 'dat038-smoke-B', 'dat038 B', DATE '2099-10-02', true, false, false, u.id, now(), now(),
         'dat038-smoke-A' FROM u;
  UPDATE events SET "parentEventId" = 'dat038-smoke-B' WHERE id = 'dat038-smoke-A';  -- raises
ROLLBACK;

-- POSITIVE 1: NULL parent — the hot path (most events have no parent) → accepted
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), 'dat038 null', DATE '2099-10-05', true, false, false, u.id, now(), now() FROM u;
ROLLBACK;

-- POSITIVE 2: linear chain A <- B <- C → all accepted (no cycle)
BEGIN;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt")
  SELECT 'dat038-lin-A', 'dat038 lin A', DATE '2099-11-01', true, false, false, u.id, now(), now() FROM u;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt", "parentEventId")
  SELECT 'dat038-lin-B', 'dat038 lin B', DATE '2099-11-02', true, false, false, u.id, now(), now(),
         'dat038-lin-A' FROM u;
  WITH u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO events (id, title, date, "isAllDay", "isExternalIntervention", "isRecurring",
                     "createdById", "createdAt", "updatedAt", "parentEventId")
  SELECT 'dat038-lin-C', 'dat038 lin C', DATE '2099-11-03', true, false, false, u.id, now(), now(),
         'dat038-lin-B' FROM u;
ROLLBACK;
```
TBD-DEPLOY: paste the 23514 self-loop error (must name `events_parent_no_self_ck`) + the trigger
raise (must contain `events_parent_no_cycle`) + both positives `INSERT 0 1`. (Also confirm:
`SELECT conname FROM pg_constraint WHERE conname='events_parent_no_self_ck';` and
`SELECT tgname FROM pg_trigger WHERE tgname='events_parent_no_cycle_trg';` → each lists 1 row.)

### DAT-037 task-projectId consistency smoke — REJECT + CASCADE (the load-bearing pair)

The BEFORE arm REJECTs mismatch on tasks; the AFTER arms on epics/milestones CASCADE the new
projectId to dependent tasks. The CASCADE smoke proves the pair is non-deadlocking: the AFTER
fires post-parent-row-update, so the cascade UPDATE on tasks then satisfies the BEFORE re-check
on its own new value.

```sql
-- NEGATIVE 1: INSERT task with epicId set but projectId disagreeing → P0001 carrying
--   "tasks_project_matches_epic"
BEGIN;
  -- Pick an epic with a known projectId; use a DIFFERENT projectId for the task to force mismatch
  WITH e AS (SELECT id, "projectId" FROM epics LIMIT 1),
       p AS (SELECT id FROM projects WHERE id NOT IN (SELECT "projectId" FROM e) LIMIT 1)
  INSERT INTO tasks (id, title, "projectId", "epicId", "updatedAt")
  SELECT gen_random_uuid(), 'dat037 smoke mismatch', p.id, e.id, now() FROM e, p;
ROLLBACK;

-- NEGATIVE 2: UPDATE task.projectId to disagree with its existing epic's projectId → same error
BEGIN;
  -- Pick a task already linked to an epic + ANOTHER project to switch into.
  WITH t AS (SELECT id, "projectId" AS pid FROM tasks WHERE "epicId" IS NOT NULL LIMIT 1),
       p AS (SELECT id FROM projects WHERE id NOT IN (SELECT pid FROM t) LIMIT 1)
  UPDATE tasks SET "projectId" = (SELECT id FROM p)
   WHERE id = (SELECT id FROM t);
ROLLBACK;

-- POSITIVE (CASCADE): UPDATE epic.projectId → dependent tasks' projectId auto-updates. Wrapped in a
-- tx so prod data is never mutated. Proves no deadlock: the BEFORE on each cascaded UPDATE finds
-- the parent's NEW value already in place.
BEGIN;
  -- Pick an epic with at least one dependent task; snapshot the task ids BEFORE the move.
  WITH e AS (SELECT id, "projectId" AS old_pid FROM epics WHERE id IN (SELECT "epicId" FROM tasks WHERE "epicId" IS NOT NULL) LIMIT 1),
       p AS (SELECT id FROM projects WHERE id NOT IN (SELECT old_pid FROM e) LIMIT 1)
  SELECT t.id AS task_id, t."projectId" AS pre_cascade_pid
    FROM tasks t WHERE t."epicId" = (SELECT id FROM e) LIMIT 3;
  -- Move the epic to a different project.
  WITH e AS (SELECT id, "projectId" AS old_pid FROM epics WHERE id IN (SELECT "epicId" FROM tasks WHERE "epicId" IS NOT NULL) LIMIT 1),
       p AS (SELECT id FROM projects WHERE id NOT IN (SELECT old_pid FROM e) LIMIT 1)
  UPDATE epics SET "projectId" = (SELECT id FROM p) WHERE id = (SELECT id FROM e);
  -- Confirm dependent tasks' projectId now matches the epic's new projectId (cascade fired).
  WITH e AS (SELECT id, "projectId" AS new_pid FROM epics WHERE id IN (SELECT "epicId" FROM tasks WHERE "epicId" IS NOT NULL) ORDER BY id LIMIT 1)
  SELECT count(*) AS cascade_aligned FROM tasks t
    JOIN e ON t."epicId" = e.id AND t."projectId" = e.new_pid;  -- expect > 0
ROLLBACK;
```
TBD-DEPLOY: paste the two P0001 messages (each contains `tasks_project_matches_epic`) + the
CASCADE positive showing `cascade_aligned > 0`. If a NEGATIVE *succeeds*, the BEFORE trigger did
not deploy; if the CASCADE shows `cascade_aligned = 0`, the AFTER trigger did not deploy → both
must be investigated before declaring done. (Also confirm: `SELECT tgname FROM pg_trigger WHERE
tgname IN ('tasks_project_consistency_trg','epics_cascade_projectid_trg','milestones_cascade_projectid_trg');` → 3 rows.)

### DAT-035 project-member role-length smoke (CHECK fires — INSERT-then-ROLLBACK; 2 negatives + 2 positives)

```sql
-- NEGATIVE 1: role = '' → ERROR 23514 violating "project_members_role_length_ck" (lower bound)
BEGIN;
  WITH p AS (SELECT id FROM projects LIMIT 1), u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO project_members (id, "projectId", "userId", role)
  SELECT gen_random_uuid(), p.id, u.id, '' FROM p, u;
ROLLBACK;

-- NEGATIVE 2: role > 100 chars → ERROR 23514 (upper bound)
BEGIN;
  WITH p AS (SELECT id FROM projects LIMIT 1), u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO project_members (id, "projectId", "userId", role)
  SELECT gen_random_uuid(), p.id, u.id, repeat('x', 101) FROM p, u;
ROLLBACK;

-- POSITIVE 1: canonical leader label → accepted
BEGIN;
  WITH p AS (SELECT id FROM projects LIMIT 1), u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO project_members (id, "projectId", "userId", role)
  SELECT gen_random_uuid(), p.id, u.id, 'Chef de projet' FROM p, u;
ROLLBACK;

-- POSITIVE 2: role at exactly 100 chars → accepted (inclusive upper bound)
BEGIN;
  WITH p AS (SELECT id FROM projects LIMIT 1), u AS (SELECT id FROM users LIMIT 1)
  INSERT INTO project_members (id, "projectId", "userId", role)
  SELECT gen_random_uuid(), p.id, u.id, repeat('y', 100) FROM p, u;
ROLLBACK;
```
TBD-DEPLOY: paste both 23514 errors (must name `project_members_role_length_ck`) + both positives
`INSERT 0 1`. (Also confirm: `SELECT conname FROM pg_constraint WHERE
conname='project_members_role_length_ck';` → 1 row.)

### Code-only smokes (COR-034, COR-035, COR-037, DAT-034)

No DB schema change to assert — these are application-layer error-translations / cap extensions.
Confirm via the Gate-2 operator UI smoke that the typed errors surface correctly:

- **COR-034** — POST a duplicate Department/Service/Client name when one already exists → expect
  HTTP **409**, not 500. Probe-style trace: the underlying DB raises 23505 on `<table>_name_key`;
  the service layer's `isUniqueViolation` helper maps it to `ConflictException`.
- **COR-035** — POST a task with `epicId` set but no `projectId` (the orphan combination) → expect
  HTTP **400** from the DTO's `ProjectRequiredWhenParentedConstraint`, NOT a 500 from the DAT-017
  CHECK falling through.
- **COR-037** — approve a leave that races into an overlap with an already-APPROVED leave for the
  same user → expect HTTP **409** from `isLeaveOverlapViolation` mapping the 23P01 to
  `ConflictException`, NOT a 500.
- **DAT-034** — declare time for a third party such that the same-day sum on that thirdPartyId
  would exceed 24h → expect HTTP **400** from `ensureDailyCapNotExceeded` (the helper now keys on
  `thirdPartyId` for third-party entries), same threshold + message as the user path.

TBD-DEPLOY: paste a representative response code per item from the post-deploy operator UI walk
(or note "not exercised at smoke — relying on unit/integration coverage").

### COR-022 sanity (no migration — confirm the cap path doesn't 500)
```sql
SELECT count(*) FROM time_entries;   -- TBD-DEPLOY: returns a count, no error (read path healthy)
```
TBD-DEPLOY: optionally exercise a create through the API in the Gate-2 smoke (a same-day total > 24h must
return HTTP 400, not 500). Code-only change; the DB smoke above is just a liveness check.

### audit_logs sanity
TBD-DEPLOY: confirm **no `SYSTEM_BACKFILL` row was emitted by this batch** — these are pure DDL/code
deploys with no application backfill script. (DAT-014's migration contains a one-time `UPDATE leaves`
reconciliation, but it runs as raw SQL inside `migrate deploy`, not through the app's audit emitter —
so it correctly produces no `audit_logs` row, same as DAT-005's in-migration numeric conversion.)
```sql
SELECT action, count(*) FROM audit_logs
 WHERE action = 'SYSTEM_BACKFILL' AND "createdAt" >= TBD-DEPLOY: deploy-window-start
 GROUP BY 1;   -- expect 0 rows
```

---

## GATE 2 — post-deploy verification reported; awaiting operator manual smoke

TBD-DEPLOY: Phases complete? Batch live on prod (image TBD-DEPLOY: id, enum + CHECK schema)? Awaiting operator UI
smoke (login + a predefined-task / settings render) → then final log commit + push.

TBD-DEPLOY: GATE 2 decision (passed / rollback).

---

## Rollback sequence (reverse deploy order)

> **Operator SSOT for rollback.** If GATE 2 fails, roll back in the reverse of deploy order using
> the table below. The per-migration DDL is unchanged below at `## Rollback (per migration)`; this
> table is the master order so the operator runs them without re-deriving the dependency graph.
> **All DROP statements are idempotent (`IF EXISTS`).** After every DDL block, also
> `DELETE FROM _prisma_migrations WHERE migration_name='<folder>';` so a future `migrate deploy`
> sees the migration as pending again — Prisma does not delete the row on manual rollback.
>
> **Total 18 steps** = 13 migration-DROPs (steps 1–13, reverse deploy order) + 5 code-only `git revert`s
> (steps 14–18). The code-only changes (COR-022/034/035/037, DAT-034) are forward+backward compatible
> with the DB rollback — they translate errors that the DB may or may not raise. They are still listed
> so a full revert of the batch lands the prod codebase at the pre-Phase-3 state.

| # | Step | Migration / SHA | Side-effects / image revert | Detail |
|---|------|------------------|------------------------------|--------|
| 1 | DAT-035 — `ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_role_length_ck";` | `20260528160000` / `148b713` | no image revert (schema.prisma unchanged). **Companion code rollback if reverting:** the DTO trim+length and the `PROJECT_LEADER_MEMBER_ROLES` dead-code removal both shipped in `148b713`; `git revert 148b713` undoes them together with the SQL above. | [DAT-035 rollback](#dat-035-148b713-migration-20260528160000--idempotent-drop-constraint) |
| 2 | DAT-037 — `DROP TRIGGER milestones_cascade_projectid_trg ON "milestones";` + `DROP FUNCTION milestones_cascade_projectid_to_tasks();` + `DROP TRIGGER epics_cascade_projectid_trg ON "epics";` + `DROP FUNCTION epics_cascade_projectid_to_tasks();` + `DROP TRIGGER tasks_project_consistency_trg ON "tasks";` + `DROP FUNCTION tasks_check_project_consistency();` | `20260528150000` / `128393e` | no image revert (schema.prisma unchanged) | [DAT-037 rollback](#dat-037-128393e-migration-20260528150000--drop-triggers--drop-functions-idempotent-no-data-change) |
| 3 | DAT-038 — `DROP TRIGGER events_parent_no_cycle_trg ON "events";` + `DROP FUNCTION events_check_parent_cycle();` + `ALTER TABLE "events" DROP CONSTRAINT events_parent_no_self_ck;` | `20260528140000` / `a99dda5` | no image revert (schema.prisma unchanged) | [DAT-038 rollback](#dat-038-a99dda5-migration-20260528140000--drop-trigger--drop-function--drop-constraint-idempotent-no-data-change) |
| 4 | DAT-036 — `DROP INDEX IF EXISTS "clients_name_key";` then `CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients"("name");` (restore the prior non-unique index) | `20260528130000` / `ce026d6` | **image revert mandatory** to the pre-mini-arc api image — `schema.prisma` carried `@unique` so the Prisma client expects the index | [DAT-036 rollback](#dat-036-ce026d6-migration-20260528130000--idempotent-drop-unique-index--restore-non-unique-index) |
| 5 | DAT-032/033 — `ALTER TABLE "subtasks" DROP CONSTRAINT IF EXISTS subtasks_position_ck;` + `ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS time_entries_hours_ck;` | `20260528120000` / `7af1991` | no image revert (schema.prisma unchanged) | [DAT-032/033 rollback](#dat-032033-7af1991-migration-20260528120000--idempotent-drop-constraint) |
| 6 | DAT-023 — `DROP CONSTRAINT leaves_no_overlap;` then **conditional** `DROP EXTENSION btree_gist` (only if nothing else depends on it; **no `CASCADE`** — let it refuse if depended upon) | `20260527190000` / `c27862a` | no image revert (schema.prisma unchanged) | [DAT-023 rollback](#dat-023-c27862a-migration-20260527190000--idempotent-drop-constraint--conditional-drop-extension) |
| 7 | DAT-018 — `DROP TRIGGER task_dependencies_no_cycle_trg ON "task_dependencies";` + `DROP FUNCTION task_dependencies_check_cycle();` + `ALTER TABLE "task_dependencies" DROP CONSTRAINT task_dependencies_no_self_ck;` | `20260527180000` / `fff93ce` | no image revert | [DAT-018 rollback](#dat-018-fff93ce-migration-20260527180000--drop-trigger--drop-function--drop-constraint-idempotent-no-data-change) |
| 8 | DAT-017 — `ALTER TABLE "tasks" DROP CONSTRAINT tasks_parent_requires_project_ck;` | `20260527170000` / `f6ca325` | no image revert | [DAT-017 rollback](#dat-017-f6ca325-migration-20260527170000--idempotent-drop-constraint) |
| 9 | DAT-016 — `DROP INDEX departments_name_key;` + `DROP INDEX services_departmentId_name_key;` | `20260527160000` / `ce8877a` | **image revert mandatory** to `orchestra-api:pre-phase3-defense-in-depth` — `schema.prisma` carried `@unique` / `@@unique` so the Prisma client expects the indexes | [DAT-016 rollback](#dat-016-ce8877a-migration-20260527160000--idempotent-drop-index) |
| 10 | DAT-014 — `DROP TRIGGER leaves_sync_type_trg ON "leaves";` + `DROP FUNCTION leaves_sync_type_from_config();` | `20260527150000` / `f8a5ce9` | no image revert; **the one-time backfill is one-way** — drifted/NULL `leaves.type` rows were overwritten with the FK-derived value and the prior contents are not retained (audit-required behavior, not a regression) | [DAT-014 rollback](#dat-014-f8a5ce9-migration-20260527150000--drop-trigger--drop-function-cheap-but-backfill-is-one-way) |
| 11 | DAT-013 — `ALTER TABLE … DROP CONSTRAINT` × 6 (tasks/events/predefined_tasks startTime+endTime format CHECKs) | `20260527140000` / `c0189c1` | no image revert | [DAT-013 rollback](#dat-013-c0189c1-migration-20260527140000--idempotent-drop-constraint) |
| 12 | DAT-012 — drop the 3 enum-typed defaults → recast 6 columns back to `text` (`USING (col::text)`, lossless) → restore the 3 text defaults → `DROP TYPE` × 5 (PredefinedTaskDuration, DayPeriod, AssignmentCompletionStatus, RecurrenceType, AppSettingsCategory) | `20260527130000` / `c8b618e` | **image revert mandatory** to `orchestra-api:pre-phase3-defense-in-depth` (schema.prisma carried the 5 enum blocks + 6 column type changes); the asymmetric order matters — the non-deployed `down.sql.md`-style reference below carries the exact sequence | [DAT-012 rollback](#dat-012-c8b618e-migration-20260527130000--harder-recast-enumstring--drop-type) |
| 13 | DAT-003/004 — `ALTER TABLE … DROP CONSTRAINT` × 14 (7 date-range + 7 numeric) | `20260527120000` / `62c2fc4` | no image revert | [DAT-003/004 rollback](#dat-003004-62c2fc4-migration-20260527120000--idempotent-drop-constraint) |
| 14 | DAT-034 — `git revert 6b17ec9`, rebuild + redeploy api image (reverts the third-party daily-cap extension; cap reverts to user-only). | (no migration) / `6b17ec9` | rebuild required (service helper signature + 2 call sites + 1 update-branch). Forward+backward compatible: the helper change reads `existing.thirdPartyId`, which is independent of any DB state. | [DAT-034 rollback](#dat-034-6b17ec9--code-only) |
| 15 | COR-037 — `git revert abd6982`, rebuild + redeploy api image (reverts the 23P01→409 mapping on leaves approve + the import friendlier message). | (no migration) / `abd6982` | rebuild required. Forward+backward compatible: if DAT-023 is also rolled back, 23P01 stops firing and the catch is harmless dead code; if DAT-023 stays live, reverting COR-037 re-introduces the 500-on-race. | [COR-037 rollback](#cor-037-abd6982--code-only) |
| 16 | COR-035 — `git revert d5ac36a`, rebuild + redeploy api image (reverts the DTO orphan-task 400 guard). | (no migration) / `d5ac36a` | rebuild required. Forward+backward compatible: with DAT-017 still live, an orphan POST falls through to 500 (the regression COR-035 closed); with DAT-017 also rolled back, no rejection at any layer. | [COR-035 rollback](#cor-035-d5ac36a--code-only) |
| 17 | COR-034 — `git revert 08d04b1`, rebuild + redeploy api image (reverts the P2002→409 mapping on Dept/Service/Client). | (no migration) / `08d04b1` | rebuild required. Forward+backward compatible: with DAT-016/036 still live, a TOCTOU race surfaces 500; with those also rolled back, no UNIQUE to race against. | [COR-034 rollback](#cor-034-08d04b1--code-only) |
| 18 | COR-022 — `git revert 760aa58`, rebuild + redeploy api image | (no migration) / `760aa58` | rebuild required (DTO + service constants); the original audit-prescribed code-only change. Cheapest rollback in the batch. | [COR-022 rollback](#cor-022-760aa58--code-only) |

TBD-DEPLOY: rollback execution log — operator-filled only if GATE 2 fails. Capture per-row:
timestamp, DDL output (`DROP …` + `DELETE FROM _prisma_migrations`), and the post-rollback state
(`_prisma_migrations` HEAD, running api image id).

---

## Rollback (per migration)

> Prisma caveat: manual SQL rollback does **not** remove the `_prisma_migrations` row. After any
> SQL rollback below, also `DELETE FROM _prisma_migrations WHERE migration_name = '<folder>';` (and
> redeploy the pre-batch api image where flagged in §"Rollback sequence"), else `migrate deploy`
> will believe the migration is still applied.

### DAT-035 (`148b713`, migration `20260528160000`) — idempotent DROP CONSTRAINT

Symmetric and cheap — pure additive CHECK, no data was written. `schema.prisma` was unchanged, so no
image revert is needed for the SQL rollback ALONE. **However:** the companion code changes (DTO
trim+length on `AddMemberDto` / `UpdateMemberDto` + dead-code removal of UPPERCASE leader codes from
`OwnershipService.PROJECT_LEADER_MEMBER_ROLES`) shipped in the SAME commit (`148b713`). If both
the DB and the code need to roll back, the cleanest path is `git revert 148b713` + redeploy, which
undoes the DTO + dead-code changes; the SQL below is idempotent and can be run either before or
after the revert. If only the DB needs to roll back (e.g. a hot data issue, code stays at `148b713`),
run the SQL alone — the DTO continues to enforce 1..100 length, so no row that was DB-rejectable can
land via the app path, and the OwnershipService remains correct because the removed codes never
matched any row.

```sql
ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_role_length_ck";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260528160000_dat035_project_member_role_length';
```

### DAT-037 (`128393e`, migration `20260528150000`) — DROP TRIGGERs + DROP FUNCTIONs (idempotent, no data change)

Three trigger/function pairs; symmetric and cheap. No data was written by the migration itself (the
cascade only fires on parent UPDATEs; if no epic/milestone projectId changed since deploy, the
ROLLBACK is byte-symmetric). `schema.prisma` was unchanged → no image revert. **Operational note:**
if the operator UPDATEd an epic or milestone projectId between deploy and rollback, the cascade has
already brought dependent tasks into alignment with the new value; rolling back the triggers does
NOT restore the old task.projectId values (the parent change becomes permanent). This is the
designed semantic — re-rolling the parent projectId would require a separate UPDATE.

```sql
DROP TRIGGER IF EXISTS "milestones_cascade_projectid_trg" ON "milestones";
DROP FUNCTION IF EXISTS milestones_cascade_projectid_to_tasks();
DROP TRIGGER IF EXISTS "epics_cascade_projectid_trg" ON "epics";
DROP FUNCTION IF EXISTS epics_cascade_projectid_to_tasks();
DROP TRIGGER IF EXISTS "tasks_project_consistency_trg" ON "tasks";
DROP FUNCTION IF EXISTS tasks_check_project_consistency();
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260528150000_dat037_task_project_consistency';
```

### DAT-038 (`a99dda5`, migration `20260528140000`) — DROP TRIGGER + DROP FUNCTION + DROP CONSTRAINT (idempotent, no data change)

Symmetric and cheap — pure additive guards on a node table, no data was written. `schema.prisma` was
unchanged, so no image revert is needed. Order matters only loosely (PG accepts either order for an
independent trigger/function pair, but dropping the trigger first avoids any "function in use" hint):

```sql
DROP TRIGGER IF EXISTS "events_parent_no_cycle_trg" ON "events";
DROP FUNCTION IF EXISTS events_check_parent_cycle();
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_parent_no_self_ck";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260528140000_dat038_event_parent_cycle_prevention';
```

### DAT-036 (`ce026d6`, migration `20260528130000`) — idempotent DROP UNIQUE INDEX + restore non-unique index

`schema.prisma` carried `@unique`, so the **image revert is mandatory** to a build that doesn't expect
the unique index in the Prisma client. The DDL itself is symmetric (drop unique, restore the prior
non-unique index byte-for-byte):

```sql
DROP INDEX IF EXISTS "clients_name_key";
CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients"("name");
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260528130000_dat036_client_name_unique';
```

### DAT-032/033 (`7af1991`, migration `20260528120000`) — idempotent DROP CONSTRAINT

Pure additive guards; dropping them is safe and order-independent. `schema.prisma` was unchanged, so no
image revert is needed:

```sql
ALTER TABLE "subtasks"     DROP CONSTRAINT IF EXISTS "subtasks_position_ck";
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_hours_ck";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260528120000_dat032_dat033_position_and_hours_bounds';
```

### COR-022 (`760aa58`) — code only
`git revert 760aa58`, rebuild + redeploy the api image. **No DB change to undo.** This is the
cheapest rollback in the batch (DTO + service constants only).

### COR-034 (`08d04b1`) — code only
`git revert 08d04b1`, rebuild + redeploy. **No DB change to undo.** Reverts the
`isUniqueViolation` helper + try/catch wrappers on `DepartmentsService.create/update`,
`ServicesService.create/update`, `ClientsService.create/update`. With DAT-016 / DAT-036 still live
on prod, reverting COR-034 re-exposes the 500-on-TOCTOU-race the audit named; with those DDL
migrations also rolled back, there is no UNIQUE to race against and the revert is benign.

### COR-035 (`d5ac36a`) — code only
`git revert d5ac36a`, rebuild + redeploy. **No DB change to undo.** Reverts
`ProjectRequiredWhenParentedConstraint` on `CreateTaskDto` + the `UpdateTaskDto` `OmitType`
override. With DAT-017 still live, an orphan POST starts returning 500 again (the regression
COR-035 closed); with DAT-017 also rolled back, no rejection at any layer.

### COR-037 (`abd6982`) — code only
`git revert abd6982`, rebuild + redeploy. **No DB change to undo.** Reverts
`isLeaveOverlapViolation` + the try/catch around `approve()`'s `$transaction` + the friendlier
message substitution in `importLeaves`' line-level catch. With DAT-023 still live, the
approve-race 23P01 leaks as 500 again; with DAT-023 also rolled back, the EXCLUDE doesn't fire
and the catch is harmless dead code.

### DAT-034 (`6b17ec9`) — code only
`git revert 6b17ec9`, rebuild + redeploy. **No DB change to undo.** Reverts the
`ensureDailyCapNotExceeded` actor-discriminator signature + the `else if (existing.thirdPartyId)`
branch on update. The per-day cap reverts to user-only (COR-022's literal scope); third-party
declarations stop being capped, restoring the gap DAT-034 closed. Forward+backward compatible
with any DB rollback (the helper reads `existing.thirdPartyId`, independent of any DB
constraint).

### DAT-003/004 (`62c2fc4`, migration `20260527120000`) — idempotent DROP CONSTRAINT
CHECK constraints are pure additive guards; dropping them is safe and order-independent. Run all 14
(`IF EXISTS` makes it idempotent / re-runnable):
```sql
ALTER TABLE "leaves"                      DROP CONSTRAINT IF EXISTS "leaves_dates_ck";
ALTER TABLE "projects"                    DROP CONSTRAINT IF EXISTS "projects_dates_ck";
ALTER TABLE "epics"                       DROP CONSTRAINT IF EXISTS "epics_dates_ck";
ALTER TABLE "telework_recurring_rules"    DROP CONSTRAINT IF EXISTS "telework_recurring_rules_dates_ck";
ALTER TABLE "leave_validation_delegates"  DROP CONSTRAINT IF EXISTS "leave_validation_delegates_dates_ck";
ALTER TABLE "school_vacations"            DROP CONSTRAINT IF EXISTS "school_vacations_dates_ck";
ALTER TABLE "events"                      DROP CONSTRAINT IF EXISTS "events_recurrence_end_ck";
ALTER TABLE "leave_balances"              DROP CONSTRAINT IF EXISTS "leave_balances_totaldays_ck";
ALTER TABLE "leaves"                      DROP CONSTRAINT IF EXISTS "leaves_days_ck";
ALTER TABLE "tasks"                       DROP CONSTRAINT IF EXISTS "tasks_progress_ck";
ALTER TABLE "epics"                       DROP CONSTRAINT IF EXISTS "epics_progress_ck";
ALTER TABLE "predefined_tasks"            DROP CONSTRAINT IF EXISTS "predefined_tasks_weight_ck";
ALTER TABLE "project_members"             DROP CONSTRAINT IF EXISTS "project_members_allocation_ck";
ALTER TABLE "documents"                   DROP CONSTRAINT IF EXISTS "documents_size_ck";
```

### DAT-012 (`c8b618e`, migration `20260527130000`) — HARDER: recast enum→String + DROP TYPE

⚠️ **Asymmetric rollback.** The enum types must be removed only after every dependent column is
recast back to `text`. **Any row written while the enum was live is valid text, so the recast itself
is lossless — but check application-layer String tolerance before rolling back:** the rolled-back
api image expects `String` columns; if the *new* (enum-aware) image is still live, repoint it to the
pre-batch image in the same window. Order matters: drop column defaults → recast columns → drop types.

This inverse SQL is a **non-deployed reference** (`down.sql.md`-style) — it is intentionally NOT a
migration file. Apply by hand only under an approved rollback:

```sql
-- ===== DAT-012 DOWN (reference only — NOT a migration) =====
-- 1) drop the enum-typed defaults
ALTER TABLE "predefined_task_assignments"     ALTER COLUMN "completionStatus" DROP DEFAULT;
ALTER TABLE "predefined_task_recurring_rules" ALTER COLUMN "recurrenceType"   DROP DEFAULT;
ALTER TABLE "app_settings"                    ALTER COLUMN "category"         DROP DEFAULT;

-- 2) recast each column back to text (enum label → text is implicit & lossless)
ALTER TABLE "predefined_tasks"
  ALTER COLUMN "defaultDuration" TYPE text USING ("defaultDuration"::text);
ALTER TABLE "predefined_task_assignments"
  ALTER COLUMN "period" TYPE text USING ("period"::text);
ALTER TABLE "predefined_task_assignments"
  ALTER COLUMN "completionStatus" TYPE text USING ("completionStatus"::text);
ALTER TABLE "predefined_task_recurring_rules"
  ALTER COLUMN "period" TYPE text USING ("period"::text);
ALTER TABLE "predefined_task_recurring_rules"
  ALTER COLUMN "recurrenceType" TYPE text USING ("recurrenceType"::text);
ALTER TABLE "app_settings"
  ALTER COLUMN "category" TYPE text USING ("category"::text);

-- 3) restore the original text defaults
ALTER TABLE "predefined_task_assignments"     ALTER COLUMN "completionStatus" SET DEFAULT 'NOT_DONE';
ALTER TABLE "predefined_task_recurring_rules" ALTER COLUMN "recurrenceType"   SET DEFAULT 'WEEKLY';
ALTER TABLE "app_settings"                    ALTER COLUMN "category"         SET DEFAULT 'general';

-- 4) drop the now-unreferenced enum types
DROP TYPE IF EXISTS "PredefinedTaskDuration";
DROP TYPE IF EXISTS "DayPeriod";
DROP TYPE IF EXISTS "AssignmentCompletionStatus";
DROP TYPE IF EXISTS "RecurrenceType";
DROP TYPE IF EXISTS "AppSettingsCategory";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527130000_dat012_promote_string_enums';
--       and redeploy the pre-batch (String-expecting) api image.
```

### DAT-013 (`c0189c1`, migration `20260527140000`) — idempotent DROP CONSTRAINT

Symmetric and cheap (same shape as DAT-003/004 — columns stay `String?`, no type to recast):

```sql
ALTER TABLE "tasks"            DROP CONSTRAINT IF EXISTS "tasks_startTime_format_ck";
ALTER TABLE "tasks"            DROP CONSTRAINT IF EXISTS "tasks_endTime_format_ck";
ALTER TABLE "events"           DROP CONSTRAINT IF EXISTS "events_startTime_format_ck";
ALTER TABLE "events"           DROP CONSTRAINT IF EXISTS "events_endTime_format_ck";
ALTER TABLE "predefined_tasks" DROP CONSTRAINT IF EXISTS "predefined_tasks_startTime_format_ck";
ALTER TABLE "predefined_tasks" DROP CONSTRAINT IF EXISTS "predefined_tasks_endTime_format_ck";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527140000_dat013_time_format_check';
```

### DAT-014 (`f8a5ce9`, migration `20260527150000`) — DROP TRIGGER + DROP FUNCTION (cheap, but backfill is one-way)

Removing the trigger is symmetric and idempotent. **The trigger itself is fully reversible; the
one-time backfill is not** — it overwrote drifted/NULL `leaves.type` values with the FK-derived value
and the prior values are not retained. That is intentional (the derived value is the *correct* one),
but note that a rollback restores the *enforcement*-free state, not the pre-backfill column contents
(which were stale by definition). No data is lost that anything should have been reading.

```sql
DROP TRIGGER IF EXISTS leaves_sync_type_trg ON "leaves";
DROP FUNCTION IF EXISTS leaves_sync_type_from_config();
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527150000_dat014_leave_type_autosync_trigger';
```

### DAT-016 (`ce8877a`, migration `20260527160000`) — idempotent DROP INDEX

⚠️ **Shape differs from DAT-003/004/013** (which `DROP CONSTRAINT`): these are plain UNIQUE *indexes*
created via `CREATE UNIQUE INDEX` (the shape Prisma emits for `@unique` / `@@unique`), not table
constraints — so they are reversed with `DROP INDEX`, not `ALTER TABLE … DROP CONSTRAINT`. Idempotent
and fully reversible (no data change). Note `schema.prisma` carried the `@unique` / `@@unique` (baked
into the api image), so a true rollback also reverts the image to the `pre-phase3-defense-in-depth`
anchor — otherwise the app's Prisma client still believes the constraints exist.

```sql
DROP INDEX IF EXISTS "departments_name_key";
DROP INDEX IF EXISTS "services_departmentId_name_key";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527160000_dat016_unique_name_constraints';
```

### DAT-017 (`f6ca325`, migration `20260527170000`) — idempotent DROP CONSTRAINT

Symmetric and cheap (same shape as DAT-003/004/013 — a table CHECK, no data change; `schema.prisma`
was unchanged, so no image revert is needed for this one):

```sql
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parent_requires_project_ck";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527170000_dat017_task_parent_requires_project_check';
```

### DAT-018 (`fff93ce`, migration `20260527180000`) — DROP TRIGGER + DROP FUNCTION + DROP CONSTRAINT (idempotent, no data change)

Symmetric and cheap — both guards are pure additive checks, no data was written. `schema.prisma` was
unchanged, so no image revert is needed for this one. Drop the trigger before its function; order is
otherwise free (`IF EXISTS` makes the chain re-runnable):

```sql
DROP TRIGGER IF EXISTS task_dependencies_no_cycle_trg ON "task_dependencies";
DROP FUNCTION IF EXISTS task_dependencies_check_cycle();
ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "task_dependencies_no_self_ck";
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527180000_dat018_task_dependency_cycle_prevention';
```

### DAT-023 (`c27862a`, migration `20260527190000`) — idempotent DROP CONSTRAINT (+ conditional DROP EXTENSION)

Symmetric and cheap — a pure additive constraint, no data was written. `schema.prisma` was unchanged, so no
image revert is needed. Drop the constraint first; **the extension drop is conditional**: only drop
`btree_gist` if no *other* object depends on it (it is a shared extension — other EXCLUDE/GiST constraints or
indexes could rely on it; `DROP EXTENSION` without `CASCADE` will refuse if anything depends on it, which is
the safe default — do NOT add `CASCADE`):

```sql
ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "leaves_no_overlap";
-- Optional, only if nothing else uses btree_gist (no CASCADE — let it refuse if depended upon):
DROP EXTENSION IF EXISTS btree_gist;
-- then: DELETE FROM _prisma_migrations WHERE migration_name = '20260527190000_dat023_leave_no_overlap_exclude';
```

---

## Operational notes (carry-forwards)

- **TOOL-DBSYNC-001 — `_dat005_backup_*` drift on prod.** The DAT-005 backup tables have been present
  in prod since the 2026-05-25 Phase-1 deploy; the retention decision is still pending. This batch's
  deploy is **unaffected** — `migrate deploy` ignores drift — but the operator may wish to bundle a
  `DROP TABLE _dat005_backup_*` into the same maintenance window. **Flagged for an explicit decision;
  not actioned by this deploy.** (Tracking: TOOL-DBSYNC-001, Phase 1 tooling.)
- **AuditLog kept `String`, not CHECK/enum (document route).** DAT-012 deliberately did not constrain
  `audit_logs.action`/`entityType` at the DB layer; the closed value set is compile-guaranteed on the
  write side (`AuditAction` enum + `ENTITY_TYPE_BY_ACTION` + payload-registry witness) and the
  TOOL-DEPLOY-001 REVOKE + immutability trigger block any untyped write. **Companion artifact:**
  [`docs/audit/canonical-action-codes.md`](../audit/canonical-action-codes.md) (DAT-012 closeout).
  No migration; cross-linked here so the auditor sees why these two columns are intentionally free.
- **DAT-033 / COR-022 TOCTOU residual — STILL OPEN.** The DAT-033 per-row CHECK `time_entries_hours_ck`
  closes the single-row bound, but **not** the per-(userId, date) aggregate cap. COR-022 reads the
  daily sum then writes non-transactionally; two concurrent same-day requests can each see the pre-state
  and both commit past 24h. Per-row CHECK is structurally incapable of closing this (CHECK is per-row,
  not cross-row aggregate). Fully closing under concurrency needs a serializable transaction around
  read+write or a DB trigger — heavier, separate decision; not folded into this bundle. **The same
  residual applies to DAT-034's third-party path** — when DAT-034 lands the service-level cap, the
  TOCTOU stays open on both actor dimensions until the cross-row guard ships. Flagged for an explicit
  follow-up decision; not actioned by this deploy.
- **DAT-033 DTO floor stays at the application layer (intentional).** The DB floor is the superset
  `hours >= 0 AND hours <= 24` to admit legitimate dismissal rows (`hours = 0`, `isDismissal = true`);
  the `(0, 0.25)` partial-hour exclusion lives in `CreateTimeEntryDto.hours` via `@Min(0.25)` gated
  by `@ValidateIf(!isDismissal)`. **Do NOT encode 0.25 at the DB layer** — it would reject 101
  legitimate dismissals (dev count, 2026-05-28). This is documented on the migration header so a
  future "tighten the DB CHECK" reviewer sees the rationale.
- **DAT-035 role DB floor admits whitespace-only (intentional).** The CHECK is
  `char_length(role) BETWEEN 1 AND 100` — whitespace-only roles pass at the DB. The DTO trims at the
  API boundary (`AddMemberDto` / `UpdateMemberDto` carry `@Transform(value.trim()) + @Length(1, 100)`),
  so legitimate app-path writes never produce whitespace-only. A future tightening to
  `length(btrim(role)) >= 1` would be a separate design decision; the integration witness has a
  dedicated test pinning the current contract so a reviewer who would tighten it notices first.
- **DAT-037 silent cascade (operator/support awareness).** AFTER UPDATE triggers on `epics` and
  `milestones` propagate any `projectId` change to dependent tasks (`UPDATE tasks SET "projectId" =
  NEW."projectId" WHERE "epicId" = NEW.id` and the milestone mirror). This is INTENDED
  system-derived consistency — the task's "true" project is its parent's — but it is **silent at
  the audit_logs layer**: OBS-002's audit pipeline only emits on application mutations, and the
  cascade runs as raw SQL inside the trigger. AC#4 N/A: task.projectId is not in the audit-sensitive
  list. **What this means for support:** if a user reports "I moved an epic to project B and all my
  tasks moved with it", that is the cascade firing as designed, not a bug. The change is fully
  derivable from the parent's audit row (epic update). **Edge case:** a task with BOTH parents in
  DIFFERENT projects (impossible per the pre-deploy topology scan) would deadlock the cascade —
  the BEFORE rejects the cascade UPDATE because the OTHER parent disagrees. Operator workflow if
  it ever happens (e.g. a future direct SQL write violating the topology scan): update the
  milestone first (cascade aligns its tasks), THEN the epic (cascade re-aligns).
- **DAT-038 trigger is the SOLE line of defense (no service-layer guard).** Unlike DAT-018 (which
  is a DB FLOOR on top of `tasks.service.ts checkCircularDependency`), `events.service.ts` has no
  event-parent cycle guard. The trigger surfaces P0001 directly if a controller path tries to set
  a cyclic parentEventId — surfaces as HTTP 500 in the current Prisma error path (Prisma has no
  dedicated code for P0001 from a trigger). A COR-style typed-exception wrapper is a plausible
  follow-up for a later arc; the trigger is the load-bearing guarantee.
- **Mini-arc cross-arc widenings (Cour des Comptes audit-trail).** Three mini-arc tasks widened
  their literal audit scope at closure time, motivated and accepted: (a) **DAT-036** added Client as
  the third UNIQUE-name surface (DAT-016's omitted instance); (b) **COR-034** widened from the
  literal Dept+Service to Dept+Service+**Client** to keep layer-of-rejection symmetric with DAT-036;
  (c) **DAT-035 (a)+dead-code** removed the vestigial `'OWNER'` / `'LEAD'` UPPERCASE codes from
  `OwnershipService.PROJECT_LEADER_MEMBER_ROLES` — the artifact of the abandoned closed-set enum
  idea this task declines. All three widenings are documented in the originating BACKLOG entries'
  Learnings + the originating commit messages.
- **All Phase 3 + mini-arc follow-ups closed.** DAT-032, DAT-033, DAT-034, DAT-035, DAT-036, DAT-037,
  DAT-038, COR-034, COR-035, COR-037 — all `DONE` on `origin/master`. **DAT-037 closed via Option A
  (BEFORE REJECT + AFTER CASCADE)** after a HALT-and-resume design decision (the BLOCKED-DESIGN-DECISION
  branch in BACKLOG); **DAT-035 closed via Option (a)+dead-code** (CHECK + DTO trim/length + dead-code
  removal) after a HALT-for-decision recommendation surfaced to the operator.

---

## Future closures — append here, do not restructure

**Phase 3 + completion mini-arc — 20 tasks / 19 scope rows / 13 migrations / 5 code-only changes /
18 rollback steps. DEPLOY-READY pending operator scheduling.** The audit-prescribed Phase 3 set
(10/10 — `c27862a` closed DAT-023, the last) AND the session-derived mini-arc (9/9, covering
DAT-032/033/034/035/036/037/038 + COR-034/035/037) are both fully closed on `origin/master`.

For any FUTURE closure (Phase 4 or a later Phase-3-style follow-up) that ships DDL or code touching
this batch's surface, **start a new deploy doc** (`docs/deploy/2026-05-3x-phase-4-…-deploy.md` or
similar) and link back to this one — do not append to a deploy doc that has already been finalized
and shipped. The structural pattern proven here (seed-time per-task probes + smokes + rollbacks +
finalize-time unified ordered checklist + post-arc re-finalize if mini-arc tail items land) is the
template; copy it.

TBD-DEPLOY: subsequent-closure rows (none expected in this batch — listed for shape).

---

## DEPLOY EXECUTION LOG — 2026-05-28 (UTC)

**Operator:** Claude Code (Opus 4.7, 1M context), driven by repository owner. **SSH key auth, no password ever exposed.**

**Outcome:** ✅ **SUCCESSFUL DEPLOY** — all 13 Phase 3 + completion mini-arc migrations applied to PROD; all post-deploy smokes pass; service healthy. **HR system live and verified.**

### Gate-by-gate ledger

| Gate | Time (UTC) | Result | Key artifact |
|------|------------|--------|--------------|
| **Gate 0 — Pre-connection sanity** | ~12:43 | ✅ + 1 reassessment | Host `vps-69b63bbf @ 92.222.35.25`; cwd `/opt/orchestra`; remote = expected; current prod SHA `3fd8986`; DB connected as `orchestr_a` superuser via peer auth (no password). **Reassessment:** Phase 2 migrations were ALREADY on prod (last applied `20260526120000_dat021_audit_payload_schema_version_gin_index`) — delta confirmed as exactly the 13 Phase 3 batch (0 of 13 pre-applied; 43 total → 56 expected). |
| **Gate 1 — pg_dump backup** | 12:44:39 | ✅ | `/opt/orchestra/backups/pre-phase3-batch-deploy-20260528-124439.sql` · **1.5 MB** · pg_dump exit 0 · 50 CREATE TABLE / 50 COPY / 65 indexes · headers + footer present. **Source row counts:** leaves 137 / tasks 321 / project_members 121 / time_entries 15 / clients 7 / events 8 / subtasks 1030. |
| **Gate 2 — btree_gist** | ~12:45 | ✅ | `pg_extension WHERE extname='btree_gist'` → `(0 rows)`; deploy role `Superuser: on` → row 2 of doc matrix (migration creates it during deploy). No pre-step needed. |
| **Gate 3 — Pre-deploy data scans** | ~12:50 | ✅ ALL CLEAN | DAT-012 (6 cols) `(0 rows)` · DAT-016/036 dup (3 SELECTs) `(0 rows)` · DAT-017 orphan `(0 rows)` · DAT-037 drift/topology `0/0/0` · DAT-018 cycle (self-loop + recursive) `(0 rows)` · DAT-038 events cycle `(0 rows)` · DAT-023 overlap `(0 rows)` · DAT-035 length `maxlen=49 nulls=0 empties=0` (note: prod maxlen 49 > dev's 17; still ~2x under N=100) · DAT-032/033 numeric: 0 position violators, 1 legitimate dismissal, 0 negatives/over_cap/partial · DAT-013 (6 cols regex) all 0 · DAT-003/004 (14 predicates) all 0. |
| **Gate 4 — Deploy execution** | 12:54:17 | ✅ | Rollback anchor tagged: `orchestra-api:pre-phase3-defense-in-depth = 10c69f6fbce8`. `docker compose build api` → new image `sha256:3c264f51b8133b…`. `migrate deploy` via container entrypoint applied all 13 in deploy order between 12:54:17.553 → 12:54:17.860 (~307 ms total). Prod git HEAD moved `3fd8986` → `ebcd9e1` (the re-finalize commit). |
| **Gate 5 — Post-deploy smokes** | ~13:07–13:08 | ✅ ALL PASS | V1: 13 rows in `_prisma_migrations`, applied_steps_count=1 each. V2: 6 enum columns USER-DEFINED (5 enum types). V3: btree_gist + leaves_no_overlap present. V5: row counts UNCHANGED across 7 touched tables (no data loss). CHECK smokes: 8 negatives fire (`projects_dates_ck`, `tasks_progress_ck`, `tasks_startTime_format_ck`, `subtasks_position_ck`, `time_entries_hours_ck` × 2, `project_members_role_length_ck` × 2); 1 positive PIN (`hours=0, isDismissal=true` → INSERT 0 1 — load-bearing dismissal floor preserved). UNIQUE smokes: 3 indexes fire 23505 (`departments_name_key`, `services_departmentId_name_key`, `clients_name_key`). Cycle smokes: `task_dependencies_no_self_ck`, `events_parent_no_self_ck` fire. **DAT-037 BEFORE-REJECT + AFTER-CASCADE both proven**: mismatch INSERT → P0001 `tasks_project_matches_epic`; UPDATE epic.projectId → 2 dependent tasks auto-moved (non-deadlocking proof). audit_logs: 0 SYSTEM_BACKFILL in deploy window. Object existence: 6 constraints, 6 triggers, 3 unique indexes all listed. DAT-014 backfill: leaves.type distribution clean (CP 95 / RTT 28 / OTHER 11 / SICK_LEAVE 3 — no NULLs, 137 total = unchanged baseline). |
| **Gate 6 — Service restart + final** | 13:05–13:09 | ✅ | `docker compose up -d api` recreated `orchestr-a-api-prod` running `sha256:3c264f51b8133b…` (new image, NOT the pre-Phase-3 anchor). Public health: `GET https://localhost/api/health` → `{"status":"ok","uptime":225s}` ✅. All 6 compose services `(healthy)` post-restart. Web public `HTTP/1.1 307 Temporary Redirect` (nginx 1.22.1 routing to login as expected). |

### Critical operational reminders now LIVE on prod

- **DAT-037 silent cascade** is live. Any UPDATE on `epics.projectId` or `milestones.projectId` will silently rewrite dependent tasks' projectId. This is INTENDED system-derived consistency, AC#4 N/A. Support awareness: "I moved an epic and my tasks moved with it" is by design, not a bug.
- **DAT-038 trigger is the SOLE line of defense** on event parent cycles. A controller path that tries to set a cyclic parentEventId surfaces P0001 → HTTP 500 (Prisma has no dedicated code for P0001 from a trigger). A COR-style typed-exception wrapper is a plausible follow-up.
- **DAT-033 + COR-022 TOCTOU residual** remains open (per-day hours cap is a non-transactional aggregate-then-write — both user and third-party dimensions). DAT-033's per-row CHECK structurally cannot close this; serializable transaction or trigger needed for a future fix.
- **DAT-035 role DB floor admits whitespace-only** by design (DTO trims at API boundary). A future tightening to `length(btrim(role)) >= 1` would be a separate decision; integration witness pins the current contract.

### What changed vs the prior prod state

- Prod git SHA: `3fd8986` → `ebcd9e1` (mini-arc complete + re-finalized deploy doc).
- Prod api image: `10c69f6fbce8` (anchor, tagged `orchestra-api:pre-phase3-defense-in-depth`) → `3c264f51b8133b…` (new image with 13 batch migrations + schema.prisma edits + 5 code-only changes baked in).
- _prisma_migrations: 43 → **56** rows (+13).
- DB now carries 13 new constraints/triggers/indexes + 5 new PG enum types (DAT-012). schema.prisma reflects DAT-012 enum blocks + DAT-016 `@unique`/`@@unique` + DAT-036 `@unique` (and `@@index([name])` removed).

### Rollback path (if needed post-deploy — full recovery)

1. **Restore from Gate-1 backup** (ultimate fallback): `cat /opt/orchestra/backups/pre-phase3-batch-deploy-20260528-124439.sql | docker exec -i orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod` (drops & recreates all objects deterministically).
2. **Image revert:** `docker tag orchestra-api:pre-phase3-defense-in-depth orchestra-api:latest && docker compose -f docker-compose.prod.yml --env-file .env.production up -d api`.
3. **Or per-migration DDL rollback** in reverse deploy order — see §"Rollback sequence" and §"Rollback (per migration)" above. **Operator note:** the DAT-014 backfill is one-way (drifted/NULL `leaves.type` values were overwritten with the FK-derived value; prior contents not retained — intentional, audit-required behavior).

### Next steps (not in this session)

- HANDOVER refresh capturing the post-deploy state.
- Phase 4 decision (RBAC complétude — TST-001, COR-001, COR-002 + 3 more; per the prior HANDOVER's roadmap).
- Operational follow-up on the carry-forward TOCTOU residuals if the threat model justifies (DAT-033/COR-022 aggregate cap → serializable / trigger).
