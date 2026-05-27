# Phase 3 Defense-in-Depth — Production Deploy Execution Log

**Audit-trail artifact for Cour des Comptes.** This document is the durable record of the
operational deploy of the *Phase 3* defense-in-depth schema bundle to production. It is **seeded
ahead of execution**: the known scope, migrations, pre-deploy checks, verification plan and
rollback templates are pre-filled now; every command and its output are captured at deploy time,
in execution order, with timestamps (UTC — prod host runs `Etc/UTC`).

> **Seed status (2026-05-27):** Phase 3 is **5/10 closed**. This batch covers the 4 schema/data
> tasks closed so far. The 5 remaining Phase 3 *important* tasks (DAT-014/016/017/018/023) are
> not yet started; **as each closes, append a row to the Scope table and a bullet to Operational
> notes — do not restructure this document.**
>
> **Every unfilled value carries a `TBD:` prefix.** At deploy time, run `grep -n 'TBD:' <thisdoc>`
> to enumerate everything still to fill (date, operator, baseline counts, per-column probe outputs,
> smoke-test snapshots, gate decisions).

---

## Scope & metadata

- **Date:** TBD: deploy date (Europe/Paris) — prod host clock is UTC.
- **Operator:** TBD: operator (e.g. Claude Code (Opus 4.7), driven by repository owner).
- **Phase 3 batch (all `DONE` in `BACKLOG.md`, all on `origin/master`):**

| Task(s) | Commit | Severity | What it introduces |
|---------|--------|----------|--------------------|
| `DAT-003` + `DAT-004` (bundle) | `62c2fc4` | blocking | **14 CHECK constraints** — 7 date-range (`end >= start`, incl. the `events` recurrence variant) + 7 numeric bounds (progress 0–100, weight 1–5, allocation 0–100, days > 0, size/totalDays ≥ 0). One migration. |
| `COR-022` | `760aa58` | important | Per-`(userId, date)` daily **hours cap (≤ 24)** on TimeEntry create/update. **DTO + service only — no migration, no schema change.** |
| `DAT-012` | `c8b618e` | important | **5 native Postgres enums** promoting 6 free-string columns (predefined-task duration/period/completionStatus/recurrenceType, app-settings category). `AuditLog.action`/`entityType` deliberately **stayed `String`** (document route — see Operational notes). One migration. |
| `DAT-013` | `c0189c1` | important | **6 CHECK constraints** enforcing `HH:MM` time-of-day format on `Task`/`Event`/`PredefinedTask` `startTime`/`endTime` (regex `^([0-1]?[0-9]\|2[0-3]):[0-5][0-9]$`, the lenient DTO-floor superset). `schema.prisma` unchanged (columns stay `String?`). One migration. |

- **Prod baseline (expected):** TBD: commits behind master at deploy time. Expected last applied
  migration `20260524100100_dat005_convert_float_to_decimal` — the Phase-1 closeout left prod at git
  `8e4b593` / api img `7cd9b14a`, and **no Phase-2 deploy has been logged in `docs/deploy/` since**,
  so Phase 2 is almost certainly not yet on prod. **Verify the prod `_prisma_migrations` HEAD before
  deploy** (if Phase 2 shipped out-of-band, its migrations would also be pending — STOP and reassess
  the migration delta). TBD: prod row counts (predefined_tasks,
  predefined_task_assignments, predefined_task_recurring_rules, app_settings, project_members,
  time_entries) captured read-only as the Phase-4 reconciliation baseline.
- **VPS:** `debian@92.222.35.25`, repo `/opt/orchestra`.
- **Compose invocation:** `docker compose -f docker-compose.prod.yml --env-file .env.production …`
  (the `--env-file` is mandatory on this host — no `.env` at `/opt/orchestra`).
- **Containers:** api=`orchestr-a-api-prod`, web=`orchestr-a-web-prod`, db=`orchestr-a-postgres-prod`
  (`postgres:18-alpine`), redis, nginx, certbot.
- **DB:** `orchestr_a_prod`, user `orchestr_a`. Host has **no** `psql`/`pg_dump` binaries → all
  Postgres ops run inside the db container (`docker exec`).

### Migrations applied by this batch (3)

| Migration folder | Task(s) | Introduces |
|------------------|---------|------------|
| `20260527120000_dat003_dat004_business_invariants` | DAT-003 + DAT-004 | 14 `ADD CONSTRAINT … CHECK (…)` (7 date-range + 7 numeric). Hand-authored raw SQL; `schema.prisma` unchanged (CHECK not DSL-expressible). |
| `20260527130000_dat012_promote_string_enums` | DAT-012 | `CREATE TYPE` ×5 + `ALTER COLUMN … TYPE … USING (col::"Enum")` ×6 (defaults dropped/re-set around the casts). Hand-authored; `schema.prisma` **was** edited (enum blocks + column types — baked into the rebuilt api image). |
| `20260527140000_dat013_time_format_check` | DAT-013 | 6 `ADD CONSTRAINT … CHECK (col ~ '^([0-1]?[0-9]\|2[0-3]):[0-5][0-9]$')` on Task/Event/PredefinedTask `startTime`/`endTime`. Hand-authored raw SQL; `schema.prisma` unchanged. **No pre-deploy probe needed** — CHECK on already-format-valid data is uneventful (dev pre-flight: 4 well-formed rows, zero malformed; like DAT-003/004, unlike the DAT-012 enum cast). |

> COR-022 is **not** in this sub-table — it ships entirely in the api image (`760aa58`), no DDL.
>
> ⚠️ **Image is source-baked (no bind-mount), same as Phase 1.** `migrate deploy` run against the
> *current* prod image applies the migrations baked into it. **Order: safety dump → `git pull` →
> `docker compose build api` → `docker compose run --rm api pnpm prisma migrate deploy` →
> `docker compose up -d api`** (build BEFORE migrate). See the Phase-1 doc's GATE 1 for the rationale.

---

## Deploy plan (phases, 2 human gates)

1. **Pre-deploy baseline (read-only).** git/containers/images/`_prisma_migrations` HEAD/row counts.
   Confirm the 3 batch migrations are exactly the pending delta `HEAD → origin/master` under
   `packages/database/prisma/migrations/`. STOP if any surprise migration appears.
2. **Pre-deploy data probe (read-only) — the DAT-012 cast-safety gate.** Per-column out-of-enum-set
   probe (below). DAT-003/004 needs no probe (dev pre-flight was 0-violators across all 14
   predicates, validated clean by `migrate deploy` on dev). **→ GATE 1.**
3. **Deploy execution** (after Gate 1 greenlight). Safety dump → `git pull` → `build api` →
   `migrate deploy` (must be exactly the 3 batch migrations) → `up -d api` → health check.
4. **Post-deploy verification.** All migrations in `_prisma_migrations`; CHECK + enum smoke
   (INSERT-then-ROLLBACK); time_entries sanity; audit_logs sanity. **→ GATE 2** (operator UI smoke).
5. **Rollback (conditional).** Per-migration templates below. Log + push even on rollback.

---

## Pre-deploy baseline (read-only)

**Captured:** TBD: timestamp (prod UTC).

### git state + migration-folder delta (the deploy-relevant check)
```
$ git log --oneline -3
TBD: prod HEAD commits

$ git fetch origin   # read-only
HEAD          = TBD
origin/master = TBD
commits behind origin/master: TBD

$ git diff --name-status HEAD origin/master -- packages/database/prisma/migrations/
TBD: must show exactly the 3 batch migration folders (20260527120000_…, 20260527130000_…, 20260527140000_…) as `A`,
     plus schema.prisma as `M` under packages/database/prisma/ (the DAT-012 enum edits).
```
TBD: ✅/⚠️ assumption check — only the 3 batch migrations are pending; no surprise migration.

### `_prisma_migrations` HEAD + row counts (Phase-4 baseline)
```
$ docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
TBD: confirm last applied migration < 20260527120000

$ docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod -c \
  "SELECT 'predefined_tasks' t, count(*) FROM predefined_tasks
   UNION ALL SELECT 'predefined_task_assignments', count(*) FROM predefined_task_assignments
   UNION ALL SELECT 'predefined_task_recurring_rules', count(*) FROM predefined_task_recurring_rules
   UNION ALL SELECT 'app_settings', count(*) FROM app_settings
   UNION ALL SELECT 'time_entries', count(*) FROM time_entries;"
TBD: baseline counts
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

TBD: probe output — paste the result of each of the 6 queries (expect `(0 rows)` for all).

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

---

## GATE 1 — probe outcome reported to operator (awaiting greenlight)

- TBD: DAT-012 probe — all 6 columns 0 out-of-set rows? (cast-safe / needs resolution).
- TBD: disk headroom for `docker compose build api` (Phase 1 hit 99% — check `df -h /`; the api
  image is ≈1.68 GB; `docker image prune` / `docker builder prune` if tight).
- TBD: any baseline surprise (extra pending migration, unexpected `_prisma_migrations` HEAD).

**STOP. Awaiting explicit "greenlight Phase 3 deploy" before any mutation.**

TBD: GATE 1 decision (greenlit / blocked + reason).

---

## Deploy execution

**Captured:** TBD: timestamp (prod UTC). (Only after Gate 1 greenlight.)

### Rollback anchor
```
docker tag orchestra-api:latest orchestra-api:pre-phase3-defense-in-depth
```
TBD: anchor image id (the pre-deploy api image; image-rollback target).

### Safety dump
```
docker exec orchestr-a-postgres-prod pg_dump -U orchestr_a -F c orchestr_a_prod \
  > /opt/orchestra/backups-prod/orchestr_a_prod_predeploy_phase3_TBD.dump
```
TBD: dump filename + byte size.

### git pull → build api → migrate deploy → up
```
$ git pull                                   # TBD: FF range
$ docker compose -f docker-compose.prod.yml --env-file .env.production build api   # TBD: exit 0, new image id
$ docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api pnpm prisma migrate deploy
TBD: must show EXACTLY:
  Applying migration `20260527120000_dat003_dat004_business_invariants`
  Applying migration `20260527130000_dat012_promote_string_enums`
  All migrations have been successfully applied.
$ docker compose -f docker-compose.prod.yml --env-file .env.production up -d api    # TBD: healthy in ~Ns
```
TBD: confirm exactly the 3 batch migrations applied (no more, no fewer). TBD: running api image id
(should be the freshly built image, not the `pre-phase3-defense-in-depth` anchor).

---

## Post-deploy verification

**Captured:** TBD: timestamp (prod UTC).

| Check | Command / method | Result |
|-------|------------------|--------|
| V1 — all migrations applied | `SELECT migration_name, applied_steps_count, finished_at FROM _prisma_migrations WHERE migration_name IN ('20260527120000_dat003_dat004_business_invariants','20260527130000_dat012_promote_string_enums','20260527140000_dat013_time_format_check');` | TBD: 3 rows, each `applied_steps_count=1`, no mixed state |
| V2 — enum columns are now `USER-DEFINED` | `SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE udt_name IN ('PredefinedTaskDuration','DayPeriod','AssignmentCompletionStatus','RecurrenceType','AppSettingsCategory');` | TBD: 6 rows mapping the 6 promoted columns |
| V3 — all services healthy | `docker compose … ps` | TBD: api/web/nginx/postgres/redis `Up (healthy)` |
| V4 — running api image | `docker inspect …` | TBD: freshly built image, not the anchor |
| V5 — row counts vs baseline | the Phase-4 count query | TBD: unchanged (no data loss) |

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
TBD: paste all three errors (must name the constraint + SQLSTATE 23514). If any INSERT *succeeds*,
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
TBD: paste the 22P02 error (confirms the enum type is enforced in prod).

### COR-022 sanity (no migration — confirm the cap path doesn't 500)
```sql
SELECT count(*) FROM time_entries;   -- TBD: returns a count, no error (read path healthy)
```
TBD: optionally exercise a create through the API in the Gate-2 smoke (a same-day total > 24h must
return HTTP 400, not 500). Code-only change; the DB smoke above is just a liveness check.

### audit_logs sanity
TBD: confirm **no `SYSTEM_BACKFILL` row was emitted by this batch** — these are pure DDL/code
deploys with no backfill script:
```sql
SELECT action, count(*) FROM audit_logs
 WHERE action = 'SYSTEM_BACKFILL' AND "createdAt" >= TBD: deploy-window-start
 GROUP BY 1;   -- expect 0 rows
```

---

## GATE 2 — post-deploy verification reported; awaiting operator manual smoke

TBD: Phases complete? Batch live on prod (image TBD, enum + CHECK schema)? Awaiting operator UI
smoke (login + a predefined-task / settings render) → then final log commit + push.

TBD: GATE 2 decision (passed / rollback).

---

## Rollback (conditional, per migration)

> Prisma caveat: manual SQL rollback does **not** remove the `_prisma_migrations` row. After any
> SQL rollback below, also `DELETE FROM _prisma_migrations WHERE migration_name = '<folder>';` (and
> redeploy the pre-batch api image), else `migrate deploy` will believe the migration is still applied.

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
- **Follow-up TODOs filed during Phase 3 (NOT in this deploy — listed for traceability):**
  `DAT-032` (DB CHECK on `Subtask.position ≥ 0`), `DAT-033` (DB CHECK on `TimeEntry.hours` —
  COR-022's DB-layer companion), `DAT-034` (per-day cap for third-party declarations), `DAT-035`
  (`ProjectMember.role` free-string institutional labels — the DAT-012 bail). All `TODO`; future
  closures, if they ship DDL, append to the Scope + Migrations tables above.

---

## Future Phase 3 closures — append here, do not restructure

As DAT-014/016/017/018/023 (or the filed follow-ups) close and join a deploy:
1. Add a row to the **Scope & metadata** table and, if it ships DDL, to the **Migrations applied**
   sub-table.
2. If it needs a pre-deploy data check, add a subsection under **Pre-deploy data probe**.
3. Add a per-migration entry under **Rollback**.
4. Add a carry-forward bullet under **Operational notes** if it introduces one.

TBD: subsequent-closure rows.
