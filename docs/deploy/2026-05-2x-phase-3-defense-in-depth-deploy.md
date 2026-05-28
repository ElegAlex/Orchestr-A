# Phase 3 Defense-in-Depth — Production Deploy Execution Log

**Audit-trail artifact for Cour des Comptes.** This document is the durable record of the
operational deploy of the *Phase 3* defense-in-depth schema bundle to production. It is **seeded
ahead of execution**: the known scope, migrations, pre-deploy checks, verification plan and
rollback templates are pre-filled now; every command and its output are captured at deploy time,
in execution order, with timestamps (UTC — prod host runs `Etc/UTC`).

> **Status (2026-05-28, post-finalize):** Phase 3 (audit-prescribed) is **10/10 closed** on `origin/master` —
> the 8 schema/data migrations (DAT-003/004 bundle, DAT-012, DAT-013, DAT-014, DAT-016, DAT-017, DAT-018,
> DAT-023) plus the code-only COR-022. The doc was **seeded 2026-05-27** alongside Phase 3 closure and
> **finalized 2026-05-28** at `43ed9a8` (TBD-DEPLOY convention applied, ordered pre-deploy checklist, consolidated
> reverse-order rollback table).
>
> **REVERTED TO ACCUMULATING (2026-05-28, mini-arc in progress).** A **Phase-3 mini-arc** closing the 10
> session-derived Phase-3-tagged follow-ups (DAT-032/033/034/035/036/037/038, COR-034/035/037) is now
> in progress; each closure that ships DDL extends this batch. **Task 1/9 landed: DAT-032 + DAT-033** (one
> bundled migration `20260528120000_dat032_dat033_position_and_hours_bounds`, commit `7af1991`) — completing
> the DAT-004 numeric-bound family with CHECKs on `subtasks.position` and `time_entries.hours`. Migrations
> sub-table is now **9** (was 8); Scope table carries 10 rows + 2 new (12 total); Pre-deploy checklist Step 1
> row 6 widened to cover the 2 new predicates; Rollback sequence prepended with the new migration in reverse
> deploy order. **The doc is NOT operator-ready while the mini-arc accumulates** — it re-finalizes after the
> mini-arc's last task lands (operator MUST NOT deploy off the doc mid-arc). The actual prod deploy is a
> separate operator-driven step, scheduled for after the mini-arc closes.
>
> **Convention — deploy-time fill markers.** Every value the operator captures at deploy time is
> tagged with the prefix `TBD-DEPLOY:` (date, operator, baseline counts, per-scan outputs, smoke-test
> snapshots, gate decisions). At the start of a deploy, run `grep -n 'TBD-DEPLOY:' <thisdoc>` — the
> output is exactly the operator's fill-list. The legacy bare-marker form (without the `-DEPLOY`
> suffix) is deprecated; the body of this doc (outside this convention paragraph) carries none, so
> a deploy-day lint never returns doc-time questions mixed with deploy-time blanks.

---

## Scope & metadata

- **Date:** TBD-DEPLOY: deploy date (Europe/Paris) — prod host clock is UTC.
- **Operator:** TBD-DEPLOY: operator (e.g. Claude Code (Opus 4.7), driven by repository owner).
- **Phase 3 batch (all `DONE` in `BACKLOG.md`, all on `origin/master`):**

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

### Migrations applied by this batch (9)

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

> COR-022 is **not** in this sub-table — it ships entirely in the api image (`760aa58`), no DDL.
>
> ⚠️ **Image is source-baked (no bind-mount), same as Phase 1.** `migrate deploy` run against the
> *current* prod image applies the migrations baked into it. **Order: safety dump → `git pull` →
> `docker compose build api` → `docker compose run --rm api pnpm prisma migrate deploy` →
> `docker compose up -d api`** (build BEFORE migrate). See the Phase-1 doc's GATE 1 for the rationale.

---

## Deploy plan (phases, 2 human gates)

1. **Pre-deploy baseline (read-only).** git/containers/images/`_prisma_migrations` HEAD/row counts.
   Confirm the 8 batch migrations are exactly the pending delta `HEAD → origin/master` under
   `packages/database/prisma/migrations/`. STOP if any surprise migration appears.
2. **Pre-deploy data probe (read-only) — the DAT-012 cast-safety gate.** Per-column out-of-enum-set
   probe (below). DAT-003/004 needs no probe (dev pre-flight was 0-violators across all 14
   predicates, validated clean by `migrate deploy` on dev). **→ GATE 1.**
3. **Deploy execution** (after Gate 1 greenlight). Safety dump → `git pull` → `build api` →
   `migrate deploy` (must be exactly the 8 batch migrations) → `up -d api` → health check.
4. **Post-deploy verification.** All migrations in `_prisma_migrations`; CHECK + enum + leave-type
   trigger smoke (INSERT-then-ROLLBACK); time_entries sanity; audit_logs sanity. **→ GATE 2**
   (operator UI smoke).
5. **Rollback (conditional).** Reverse-order master table at §"Rollback sequence", per-migration DDL
   below. Log + push even on rollback.

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

The DAT-023 migration begins with `CREATE EXTENSION IF NOT EXISTS btree_gist`. If the extension is
absent AND the deploy role is not superuser, `migrate deploy` aborts at migration 8 of 8 — leaving
the prior 7 applied. To avoid that partial state, decide the extension's availability **before**
running `migrate deploy`.

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
| 2 | `20260527160000` (DAT-016) | `CREATE UNIQUE INDEX` aborts 23505 on existing duplicate | both `GROUP BY … HAVING count(*) > 1` SELECTs return `(0 rows)` | [DAT-016 duplicate-name probe](#dat-016-duplicate-name-probe-critical-read-only--create-unique-index-aborts-on-existing-dups) |
| 3 | `20260527170000` (DAT-017) | `ADD CONSTRAINT … CHECK` aborts 23514 on orphan-task row | orphan-task SELECT returns `(0 rows)` | [DAT-017 orphan-task probe](#dat-017-orphan-task-probe-critical-read-only--add-constraint--check-aborts-on-existing-violators) |
| 4 | `20260527180000` (DAT-018) | self-loop CHECK aborts 23514 at `ADD CONSTRAINT`; an existing multi-hop cycle would later choke the trigger on the next legitimate write | both SELECTs (direct self-loop + recursive-CTE cycle scan) return `(0 rows)` | [DAT-018 cycle probe](#dat-018-cycle-probe-critical-read-only--the-check-aborts-on-an-existing-self-loop-an-existing-cycle-would-make-the-trigger-fire-on-the-next-write) |
| 5 | `20260527190000` (DAT-023) | `ADD CONSTRAINT … EXCLUDE` aborts 23P01 on existing overlapping APPROVED pair | overlap-pair SELECT returns `(0 rows)` (part 2 of the DAT-023 probe) | [DAT-023 overlap probe (part 2)](#dat-023-overlap-probe-critical--two-parts-btree_gist-availability--existing-overlap-either-aborts-migrate-deploy) |
| 6 | `20260527120000` (DAT-003/004) **+ `20260528120000` (DAT-032/033)** | `ADD CONSTRAINT … CHECK` aborts 23514 on first violator across the 14 DAT-003/004 predicates **+ the 2 DAT-032/033 predicates** | dev pre-flight: 0/14 + 0/2 (every CHECK validated clean on dev). **Recommended prod safety scan** — for each of the 14 DAT-003/004 predicates listed in `migration.sql` (L22–67), run `SELECT count(*) FROM <table> WHERE NOT (<predicate>);` and confirm 0. Predicates: `leaves.endDate >= startDate`, `projects.endDate >= startDate`, `epics.endDate >= startDate`, `telework_recurring_rules.endDate >= startDate`, `leave_validation_delegates.end_date >= start_date`, `school_vacations.endDate >= startDate`, `events.recurrenceEndDate >= date`, `leave_balances.totalDays >= 0`, `leaves.days > 0`, `tasks.progress BETWEEN 0 AND 100`, `epics.progress BETWEEN 0 AND 100`, `predefined_tasks.weight BETWEEN 1 AND 5`, `project_members.allocation BETWEEN 0 AND 100`, `documents.size >= 0`. **Plus the 2 DAT-032/033 predicates:** `SELECT count(*) FROM subtasks WHERE "position" < 0;` (must return 0) and `SELECT count(*) FILTER (WHERE hours = 0) AS dismissals, count(*) FILTER (WHERE hours < 0) AS negatives, count(*) FILTER (WHERE hours > 24) AS over_cap, count(*) FILTER (WHERE hours > 0 AND hours < 0.25) AS partial_below_quarter FROM time_entries;` (must return `negatives = 0`, `over_cap = 0`, `partial_below_quarter = 0`; `dismissals` may be > 0 — the floor `>= 0` admits them by design). | every safety SELECT returns 0 (and DAT-033 scan's `negatives`/`over_cap`/`partial_below_quarter` columns return 0) |
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

All 7 scans green + Step 0 outcome decided + baseline captured + disk headroom verified (Phase 1
hit 99%; `df -h /` headroom for a ≈1.68 GB api image build). Operator greenlights. Full detail at
[GATE 1](#gate-1--probe-outcome-reported-to-operator-awaiting-greenlight).

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
TBD-DEPLOY: must show exactly the 8 batch migration folders (20260527120000_…, 20260527130000_…, 20260527140000_…, 20260527150000_…, 20260527160000_…, 20260527170000_…, 20260527180000_…, 20260527190000_…) as `A`,
     plus schema.prisma as `M` under packages/database/prisma/ (the DAT-012 enum edits + DAT-016 @unique/@@unique; DAT-013/014/017/018/023 leave schema.prisma untouched).
```
TBD-DEPLOY: ✅/⚠️ assumption check — only the 8 batch migrations are pending; no surprise migration.

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
   UNION ALL SELECT 'time_entries', count(*) FROM time_entries;"
TBD-DEPLOY: baseline counts
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

---

## GATE 1 — probe outcome reported to operator (awaiting greenlight)

- TBD-DEPLOY: DAT-012 probe — all 6 columns 0 out-of-set rows? (cast-safe / needs resolution).
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
$ git pull                                   # TBD-DEPLOY: FF range — expect HEAD = the master tip carrying all 8 Phase 3 migrations + COR-022 + this finalized deploy doc; verify with `git rev-parse HEAD` and `git log --oneline -1`
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
  All migrations have been successfully applied.
$ docker compose -f docker-compose.prod.yml --env-file .env.production up -d api    # TBD-DEPLOY: healthy in ~Ns
```
TBD-DEPLOY: confirm exactly the 8 batch migrations applied (no more, no fewer). TBD-DEPLOY: running api image id
(should be the freshly built image, not the `pre-phase3-defense-in-depth` anchor).

---

## Post-deploy verification

**Captured:** TBD-DEPLOY: timestamp (prod UTC).

| Check | Command / method | Result |
|-------|------------------|--------|
| V1 — all migrations applied | `SELECT migration_name, applied_steps_count, finished_at FROM _prisma_migrations WHERE migration_name IN ('20260527120000_dat003_dat004_business_invariants','20260527130000_dat012_promote_string_enums','20260527140000_dat013_time_format_check','20260527150000_dat014_leave_type_autosync_trigger','20260527160000_dat016_unique_name_constraints','20260527170000_dat017_task_parent_requires_project_check','20260527180000_dat018_task_dependency_cycle_prevention','20260527190000_dat023_leave_no_overlap_exclude');` | TBD-DEPLOY: 8 rows, each `applied_steps_count=1`, no mixed state |
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

| # | Step | Migration / SHA | Side-effects / image revert | Detail |
|---|------|------------------|------------------------------|--------|
| 1 | DAT-032/033 — `ALTER TABLE "subtasks" DROP CONSTRAINT IF EXISTS subtasks_position_ck;` + `ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS time_entries_hours_ck;` | `20260528120000` / `7af1991` | no image revert (schema.prisma unchanged) | [DAT-032/033 rollback](#dat-032033-7af1991-migration-20260528120000--idempotent-drop-constraint) |
| 2 | DAT-023 — `DROP CONSTRAINT leaves_no_overlap;` then **conditional** `DROP EXTENSION btree_gist` (only if nothing else depends on it; **no `CASCADE`** — let it refuse if depended upon) | `20260527190000` / `c27862a` | no image revert (schema.prisma unchanged) | [DAT-023 rollback](#dat-023-c27862a-migration-20260527190000--idempotent-drop-constraint--conditional-drop-extension) |
| 3 | DAT-018 — `DROP TRIGGER task_dependencies_no_cycle_trg ON "task_dependencies";` + `DROP FUNCTION task_dependencies_check_cycle();` + `ALTER TABLE "task_dependencies" DROP CONSTRAINT task_dependencies_no_self_ck;` | `20260527180000` / `fff93ce` | no image revert | [DAT-018 rollback](#dat-018-fff93ce-migration-20260527180000--drop-trigger--drop-function--drop-constraint-idempotent-no-data-change) |
| 4 | DAT-017 — `ALTER TABLE "tasks" DROP CONSTRAINT tasks_parent_requires_project_ck;` | `20260527170000` / `f6ca325` | no image revert | [DAT-017 rollback](#dat-017-f6ca325-migration-20260527170000--idempotent-drop-constraint) |
| 5 | DAT-016 — `DROP INDEX departments_name_key;` + `DROP INDEX services_departmentId_name_key;` | `20260527160000` / `ce8877a` | **image revert mandatory** to `orchestra-api:pre-phase3-defense-in-depth` — `schema.prisma` carried `@unique` / `@@unique` so the Prisma client expects the indexes | [DAT-016 rollback](#dat-016-ce8877a-migration-20260527160000--idempotent-drop-index) |
| 6 | DAT-014 — `DROP TRIGGER leaves_sync_type_trg ON "leaves";` + `DROP FUNCTION leaves_sync_type_from_config();` | `20260527150000` / `f8a5ce9` | no image revert; **the one-time backfill is one-way** — drifted/NULL `leaves.type` rows were overwritten with the FK-derived value and the prior contents are not retained (audit-required behavior, not a regression) | [DAT-014 rollback](#dat-014-f8a5ce9-migration-20260527150000--drop-trigger--drop-function-cheap-but-backfill-is-one-way) |
| 7 | DAT-013 — `ALTER TABLE … DROP CONSTRAINT` × 6 (tasks/events/predefined_tasks startTime+endTime format CHECKs) | `20260527140000` / `c0189c1` | no image revert | [DAT-013 rollback](#dat-013-c0189c1-migration-20260527140000--idempotent-drop-constraint) |
| 8 | DAT-012 — drop the 3 enum-typed defaults → recast 6 columns back to `text` (`USING (col::text)`, lossless) → restore the 3 text defaults → `DROP TYPE` × 5 (PredefinedTaskDuration, DayPeriod, AssignmentCompletionStatus, RecurrenceType, AppSettingsCategory) | `20260527130000` / `c8b618e` | **image revert mandatory** to `orchestra-api:pre-phase3-defense-in-depth` (schema.prisma carried the 5 enum blocks + 6 column type changes); the asymmetric order matters — the non-deployed `down.sql.md`-style reference below carries the exact sequence | [DAT-012 rollback](#dat-012-c8b618e-migration-20260527130000--harder-recast-enumstring--drop-type) |
| 9 | DAT-003/004 — `ALTER TABLE … DROP CONSTRAINT` × 14 (7 date-range + 7 numeric) | `20260527120000` / `62c2fc4` | no image revert | [DAT-003/004 rollback](#dat-003004-62c2fc4-migration-20260527120000--idempotent-drop-constraint) |
| 10 | COR-022 — `git revert 760aa58`, rebuild + redeploy api image | (no migration) / `760aa58` | rebuild required (DTO + service constants); cheapest rollback in the batch | [COR-022 rollback](#cor-022-760aa58--code-only) |

TBD-DEPLOY: rollback execution log — operator-filled only if GATE 2 fails. Capture per-row:
timestamp, DDL output (`DROP …` + `DELETE FROM _prisma_migrations`), and the post-rollback state
(`_prisma_migrations` HEAD, running api image id).

---

## Rollback (per migration)

> Prisma caveat: manual SQL rollback does **not** remove the `_prisma_migrations` row. After any
> SQL rollback below, also `DELETE FROM _prisma_migrations WHERE migration_name = '<folder>';` (and
> redeploy the pre-batch api image where flagged in §"Rollback sequence"), else `migrate deploy`
> will believe the migration is still applied.

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
- **Follow-up TODOs filed during Phase 3 (NOT in this deploy — listed for traceability):**
  ~~`DAT-032` (DB CHECK on `Subtask.position ≥ 0`)~~ **DONE `7af1991` — bundled with DAT-033 in
  `20260528120000`**, ~~`DAT-033` (DB CHECK on `TimeEntry.hours` — COR-022's DB-layer companion)~~
  **DONE `7af1991` — bundled with DAT-032**, `DAT-034` (per-day cap for third-party declarations), `DAT-035`
  (`ProjectMember.role` free-string institutional labels — the DAT-012 bail), `DAT-037` (cross-table
  trigger validating `task.projectId = epic/milestone.projectId` — the DAT-017 "Consider trigger"
  discretionary clause; dev drift 0/0 so its data-cleanup burden is ≈ nil), `COR-035` (DTO cross-field
  guard returning 400 for the orphan task combination, so DAT-017's CHECK doesn't surface a raw 500),
  `DAT-038` (mirror DAT-018's self-loop CHECK + cycle trigger onto `Event.parentEventId` — the audit's
  "Same for Event.parentEventId"; dev pre-flight 0 self-cycles / 0 multi-hop / 0 of 195 events parented,
  so its data-cleanup burden is ≈ nil). NOTE: DAT-018 needed **no** COR-style 409 follow-up — the
  service's `checkCircularDependency` already returns 400 before the DB, so the trigger is bypass-only.
  `COR-037` (typed **409** on the `leaves_no_overlap` 23P01 at the leave **approve/import** path — unlike
  create/update, `approve` does not re-check overlap and the leaves module has no Prisma error filter, so the
  EXCLUDE currently leaks as a generic 500 on the TOCTOU/approve race; the create/update happy paths already
  409 first and are unaffected). All `TODO`; future closures, if they ship DDL, append to the Scope +
  Migrations tables above.

---

## Future closures — append here, do not restructure

**Phase 3 (audit-prescribed) is 10/10 complete** (DAT-023 was the last of the audit set, closed `c27862a`).
A **Phase-3 mini-arc** is in progress closing the 10 session-derived Phase-3-tagged follow-ups
(DAT-032/033/034/035/036/037/038, COR-034/035/037); each closure shipping DDL extends this batch.
**Mini-arc closures so far:** DAT-032 + DAT-033 (`7af1991`, migration `20260528120000`).
**Remaining:** DAT-034, DAT-035, DAT-036, DAT-037, DAT-038, COR-034, COR-035, COR-037.
The doc re-finalizes after the mini-arc's last closure; until then, **operator MUST NOT deploy**.
For each future closure that ships DDL:
1. Add a row to the **Scope & metadata** table and, if it ships DDL, to the **Migrations applied**
   sub-table.
2. If it needs a pre-deploy data check, add a subsection under **Pre-deploy data probe**.
3. Add a per-migration entry under **Rollback**.
4. Add a carry-forward bullet under **Operational notes** if it introduces one.

TBD-DEPLOY: subsequent-closure rows.
