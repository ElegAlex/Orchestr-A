# Phase 1 Remediation — Production Deploy Execution Log

This document is the durable record of the
operational deploy of the *Phase 1* security/data remediation bundle to production. Every
command and its output are captured below, in execution order, with timestamps (UTC — prod
host runs `Etc/UTC`).

---

## Scope & metadata

- **Date:** 2026-05-25 (Europe/Paris) — prod host clock is UTC.
- **Operator:** Claude Code (Opus 4.7), driven by repository owner.
- **Phase 1 bundle (all `DONE` in `BACKLOG.md`, all on `origin/master`):**
  - `SEC-001` — RBAC guard defaults to permissive → enforced deny-by-default + boot-assert.
  - `SEC-002` — `PATCH /users/:id` horizontal scope check.
  - `SEC-003` — `POST /users/:id/reset-password` role-hierarchy guard.
  - `DAT-001` — transactional `approve/reject/cancel` + durable audit persistence.
  - `DAT-005` — Float → Decimal (HR/precision) schema conversion + 2 migrations.
  - `COR-003` — leave day count subtracts public holidays.
  - `CLAUDE-CFG-001` — smoke Stop hook catches untracked files (tooling only).
- **Prod baseline (expected):** 19 commits behind `master`; pre-DAT-005 schema (5 Float
  columns still `double precision`); last migration `20260523171000`; holidays table already
  populated 2025/26/27 (out-of-band in a prior de-risk session).
- **VPS:** `debian@92.222.35.25`, repo `/opt/orchestra`.
- **Compose invocation:** `docker compose -f docker-compose.prod.yml --env-file .env.production …`
- **Containers:** api=`orchestr-a-api-prod` (img `orchestra-api`), web=`orchestr-a-web-prod`
  (img `orchestra-web`), db=`orchestr-a-postgres-prod` (`postgres:18-alpine`), redis, nginx, certbot.
- **DB:** `orchestr_a_prod`, user `orchestr_a`. DB size ≈ 15 MB.

### Environment caveats discovered during orientation (pre-Phase 1)

- ⚠️ **Disk pressure:** `/` is at **99% (≈1.1 GB free)**. Trivial for Phase 1/2 (dump≈few MB,
  throwaway DB≈tens of MB) but a **blocker risk for Phase 3 `docker compose build api`**.
  Surfaced at GATE 1.
- Host has **no** `psql`/`pg_dump`/`pg_restore` binaries → all Postgres operations run inside
  containers (`docker exec`).
- Prod's `postgres:18-alpine` ships busybox `sh` (no bash); the preflight script is bash. It is
  run inside a throwaway alpine container after `apk add --no-cache bash`.
- The preflight script is **absent on prod** (repo 19 commits behind) → copied from the local
  checkout for Phase 2.

---

## Deploy plan (5 phases, 2 human gates)

1. **Phase 1 — Pre-deploy baseline (read-only).** Capture git/containers/images/migrations/row
   counts/column types. Confirm assumptions (last migration `20260523171000`, 5 columns still
   `double precision`, 19 commits behind). STOP if any assumption violated.
2. **Phase 2 — DAT-005 preflight on prod dump.** `pg_dump -F c` → restore into throwaway
   `postgres:18-alpine` → run `preflight-decimal-conversion.sh` → cleanup. **→ GATE 1.**
3. **Phase 3 — Deploy execution** (only after Gate 1 greenlight). Safety dump → `git pull` →
   `prisma migrate deploy` (must be exactly the 2 DAT-005 migrations) → build api → up api →
   health check. Auto-trigger Phase 5 on startup failure.
4. **Phase 4 — Post-deploy verification.** Containers healthy; both migrations present; 5 columns
   now `numeric(p,s)`; 5 `_dat005_backup_*` tables present; row counts match baseline. **→ GATE 2**
   (manual frontend smoke by operator).
5. **Phase 5 — Rollback (conditional).** Image re-tag / SQL rollback / full `pg_restore` per
   symptom. Log + push even on rollback.

---

## Phase 1 — Pre-deploy baseline (read-only)

**Captured:** 2026-05-24T22:42–22:45Z (prod UTC). All commands read-only.

### git state + commits behind master
```
$ git log --oneline -3
716f7ec docs(leaves): closeout — post-deploy stuck-row fix + findValidatorForUser dormancy
9e17b5f docs(leaves): closeout — verified backfill state on prod (post-deploy)
ae71555 chore(leaves): Wave 5 amendments — broader TZ-UTC proof + honest D + e2e exec gap

$ git fetch origin   # read-only
HEAD          = 716f7ec04d9770028b7cc3a8d78b138c9ddb44b2
origin/master = 399e81a0848358a94a7a964de28c2c9c76180836
commits behind origin/master: 26
```
⚠️ **Assumption check — commit count:** task stated *19 behind*; actual is **26**. Investigated
at the migration level (below): the extra commits are docs/backlog/tooling (incl. CLAUDE-CFG-001
and leaves closeouts), **none touching the schema beyond the 2 DAT-005 migrations**. Treated as
**benign** — the deploy-relevant delta is unchanged. Surfaced at GATE 1.

### Migration-folder delta (HEAD → origin/master) — the deploy-relevant check
```
$ git diff --name-status HEAD origin/master -- packages/database/prisma/migrations/
A  packages/database/prisma/migrations/20260524100000_dat005_backup_float_columns/migration.sql
A  packages/database/prisma/migrations/20260524100100_dat005_convert_float_to_decimal/migration.sql
$ git diff --name-status HEAD origin/master -- packages/database/prisma/
A  .../20260524100000_dat005_backup_float_columns/migration.sql
A  .../20260524100100_dat005_convert_float_to_decimal/migration.sql
M  packages/database/prisma/schema.prisma
```
✅ **Exactly the 2 DAT-005 migrations will be applied by Phase 3** (plus the schema.prisma edit,
which is baked into the rebuilt image). No surprise migrations.

### docker compose ps
```
NAME                       IMAGE              SERVICE    STATUS
orchestr-a-api-prod        orchestra-api      api        Up 30 hours (healthy)
orchestr-a-certbot-prod    certbot/certbot    certbot    Up 5 weeks
orchestr-a-nginx-prod      nginx:1.27-alpine  nginx      Up 4 weeks (healthy)
orchestr-a-postgres-prod   postgres:18-alpine postgres   Up 5 weeks (healthy)
orchestr-a-redis-prod      redis:7.4-alpine   redis      Up 5 weeks (healthy)
orchestr-a-web-prod        orchestra-web      web        Up 33 hours (healthy)
```
✅ All services healthy.

### docker images | grep orchestra (rollback anchors)
```
orchestra-api   latest                      5a9f56cc0337   30 hours ago   1.68GB   <-- CURRENT api (rollback target)
orchestra-web   latest                      64e50f617765   33 hours ago   253MB    <-- CURRENT web
orchestra-api   pre-v4-role-object-fix      782a8055cbbb   4 weeks ago    1.68GB
orchestra-api   pre-institutional-guard     b2d57e4a8700   4 weeks ago    1.68GB
... (older pre-* tagged images retained as historical anchors)
```
Note: the current `orchestra-api:latest` (`5a9f56cc0337`) is the **Phase 5 rollback target** for
the api image. Before Phase 3 build overwrites `:latest`, it will be re-tagged (see Phase 3).

### _prisma_migrations — last 10 applied
```
20260523171000_self_approved_and_global_balance_unique      | 2026-05-23 16:32:06+00  <-- HEAD of prod
20260523124537_drop_max_days_per_year                       | 2026-05-23 13:34:49+00
20260506114304_project_archive                              | 2026-05-06 13:55:29+00
20260427171000_add_predefined_task_telework_allowed         | 2026-04-27 15:40:49+00
20260424124537_add_recurrence_and_completion                | 2026-04-24 13:06:40+00
20260424111457_add_weight_and_audit_log                     | 2026-04-24 11:53:01+00
20260423175724_add_snapshot_analytics_fields                | 2026-04-23 19:04:15+00
20260423075303_add_clients_module                           | 2026-04-23 15:14:29+00
20260421152235_add_timeentry_dismissal_and_composite_index  | 2026-04-21 18:41:37+00
20260420120000_rbac_v4_drop_legacy                          | 2026-04-20 08:32:16+00
```
✅ **Assumption check — last migration = `20260523171000`** → CONFIRMED.

### Row counts (baseline for Phase 4 reconciliation)
```
users          | 41
leaves         | 132
leave_balances | 0
time_entries   | 15
tasks          | 321
audit_logs     | 8
holidays       | 33   (2025/26/27 × 11 = 33, matches prior out-of-band seed)
```

### information_schema — 5 target columns (pre-DAT-005 expectation)
```
 table_name        | column_name    | data_type        | numeric_precision | numeric_scale
-------------------+----------------+------------------+-------------------+---------------
 leave_balances    | totalDays      | double precision |                53 |
 leaves            | days           | double precision |                53 |
 project_snapshots | progress       | double precision |                53 |
 tasks             | estimatedHours | double precision |                53 |
 time_entries      | hours          | double precision |                53 |
```
✅ **Assumption check — all 5 target columns still `double precision`** → CONFIRMED.

### api service definition (relevant to Phase 3 ordering)
`docker-compose.prod.yml` `api` service: `build: {context: ., dockerfile: ./apps/api/Dockerfile}`,
`volumes: [api_logs_prod:/app/logs, api_uploads_prod:/app/uploads]` — **NO source bind-mount**.
`RBAC_GUARD_MODE: enforce` is already set (SEC-001 enforce mode present in compose env).
⚠️ **Phase 3 ordering implication:** the image is source-baked. `docker compose run --rm api
pnpm prisma migrate deploy` uses the **current (old)** image, whose baked migrations stop at
`20260523171000` → it would apply **0 migrations**. **`build api` must run BEFORE `migrate
deploy`.** Recommended reordering surfaced at GATE 1.

### Environment
```
$ df -h /
/dev/sda1   74G   70G   1.1G  99%  /
```
⚠️ **Disk at 99% / ~1.1 GB free.** Blocker risk for Phase 3 `docker compose build api`. Surfaced
to operator at orientation and again at GATE 1.

### Phase 1 assumption summary
| Assumption (task)                       | Result                                    |
|-----------------------------------------|-------------------------------------------|
| Last migration = `20260523171000`       | ✅ CONFIRMED                               |
| 5 target columns still `double precision` | ✅ CONFIRMED                             |
| 19 commits behind master                | ⚠️ Actually **26** — benign (no extra migrations; docs/backlog/tooling only) |
| Holidays populated 2025/26/27           | ✅ 33 rows                                 |
| All containers healthy                  | ✅                                         |

**Decision:** core deploy-safety assumptions hold. Proceeding to Phase 2 (read-only preflight).
Non-blocking deviations (commit count, Phase 3 build/migrate ordering, disk pressure) consolidated
for GATE 1.

---

## Phase 2 — DAT-005 preflight (Float→Decimal precision check on prod dump)

**Captured:** 2026-05-24T22:45Z (prod UTC). Read-only against prod (dump only); all conversion
testing done on an isolated throwaway instance.

### Method
1. `pg_dump -F c` of prod → `/opt/orchestra/backups-prod/orchestr_a_prod_pre_dat005_20260524_224524.dump`
   (441,418 bytes).
2. Throwaway `postgres:18-alpine` container `orchestra-dat005-preflight`
   (`POSTGRES_USER=orchestr_a`, `POSTGRES_DB=orchestr_a_prod`), ready in 3s.
3. `pg_restore --no-owner --no-privileges` into the throwaway (no errors).
4. `apk add --no-cache bash` (alpine ships busybox `sh`; the preflight script is bash) — minimal
   footprint, no new image pulled.
5. Ran `scripts/db/preflight-decimal-conversion.sh` (copied from local checkout — absent on prod)
   against the throwaway via `DATABASE_URL=postgres://orchestr_a:preflight@localhost:5432/orchestr_a_prod`.
6. Cleanup: `docker rm -f orchestra-dat005-preflight`. Prod dump retained in `backups-prod/` as a
   pre-deploy backup.

### Restore sanity (throwaway row counts)
```
leave_balances     | 0
leaves             | 132     (matches prod baseline)
project_snapshots  | 2657
tasks              | 321     (matches prod baseline)
time_entries       | 15      (matches prod baseline)
```

### Preflight result — per column
| Table.column                  | Non-null rows | Rows that would lose precision | Verdict |
|-------------------------------|---------------|--------------------------------|---------|
| time_entries.hours            | 15            | 0                              | ✓ OK    |
| leaves.days                   | 132           | 0                              | ✓ OK    |
| leave_balances.totalDays      | 0             | 0                              | ✓ OK    |
| tasks.estimatedHours          | 1             | 0                              | ✓ OK    |
| project_snapshots.progress    | 2657          | 0                              | ✓ OK    |

All sampled values are integers or `.5` increments; every `would_round` flag = `f`. Full sample
tables were inspected in the live run (10-row samples per column, e.g. `0.5 → 0.50`, `2 → 2.00`,
`100 → 100.00`).

```
✅ Preflight passed: conversion is safe to apply.
### PREFLIGHT_EXIT_CODE=0   (0 = safe/no loss; 1 = lossy rows; 2 = invalid invocation)
```

**Outcome: ZERO lossy rows. The Float→Decimal conversion is safe to apply to production.**

---

## GATE 1 — preflight outcome reported to operator (awaiting greenlight for Phase 3)

- ✅ **Preflight: zero lossy rows** → DAT-005 conversion safe.
- ⚠️ **Disk pressure:** prod `/` at 99% (~1.1 GB free). Recommend freeing space before Phase 3
  `docker compose build api` (api image is 1.68 GB; a rebuild needs headroom). Suggested:
  `docker image prune` / drop stale `pre-*` tagged images.
- ⚠️ **Phase 3 step ordering correction required:** api image is source-baked (no bind-mount).
  Running `prisma migrate deploy` on the *current* image applies 0 migrations. Recommended order:
  **safety dump → git pull → `docker compose build api` → `docker compose run --rm api pnpm prisma
  migrate deploy` → `docker compose up -d api`.**
- ℹ️ Commit count is 26 (task said 19) but the migration delta is exactly the 2 DAT-005 migrations
  — benign.

**STOP. Awaiting explicit "greenlight Phase 3" before any mutation.**

---

## GATE 1 decision: GREENLIT (corrected order) + disk remediation

**Operator decision (2026-05-24T22:5x Z):** greenlight Phase 3 with the corrected ordering
(**build api BEFORE migrate deploy**, since the api image is source-baked). Disk remediation
delegated.

### Disk remediation (pre-Phase-3) — Category A only
Read-only investigation found the disk dominated by dozens of dangling `<none>` 1.68 GB api
build images + 34.6 GB of stale Docker **build cache**. Category A (safe, idempotent) cleanup:
```
docker image prune -f      → reclaimed 1.477 GB
docker builder prune -f    → reclaimed 34.62 GB
docker container prune -f  → 0 B (no stopped containers)
```
**Disk: 999 MB free (99%) → 41 GB free (44%).** All prod services verified `Up (healthy)` after
cleanup. Category B (orphan `orchestra-api-run-*` containers, old tagged/unused images, journal
vacuum) was **not needed** — 41 GB is abundant headroom for the 1.68 GB api rebuild — and left
untouched. No volumes touched (Category C respected).

---

## Phase 3 — Deploy execution (corrected order) — IN PROGRESS, halted on new-image startup regression

**Captured:** 2026-05-25T08:45–08:52Z (prod UTC).

### 3.0 Rollback anchor
`docker tag orchestra-api:latest orchestra-api:pre-phase1-remediation` →
anchor = `5a9f56cc0337` (the pre-deploy api image; Phase 5 image-rollback target).

### 3.1 Safety dump
`orchestr_a_prod_predeploy_phase1_20260525_084554.dump` (441,418 bytes) in `backups-prod/`.

### 3.2–3.3 git pull
Clean fast-forward `716f7ec → 399e81a` (== origin/master). Working tree clean except one
untracked local env backup (`.env.production.backup-20260415-140812`) — benign, not in incoming
commits. Both DAT-005 migration folders present after pull.

### 3.4 build api  ✅
`docker compose build api` → exit 0. New `orchestra-api:latest` = `sha256:9bbfe84a…` (≠ anchor
`5a9f56cc`). Disk after build: 38 GB free.

### 3.5 prisma migrate deploy  ✅ (migration) / ⚠️ (entrypoint auto-start crashed)
`docker compose run --rm api pnpm prisma migrate deploy`:
```
39 migrations found in prisma/migrations
Applying migration `20260524100000_dat005_backup_float_columns`
Applying migration `20260524100100_dat005_convert_float_to_decimal`
All migrations have been successfully applied.
```
✅ **Exactly the 2 DAT-005 migrations applied.** Confirmed on prod: `leaves.days → numeric(6,2)`,
`time_entries.hours → numeric(5,2)`; 5 `_dat005_backup_*` tables present.

⚠️ **BUT** the image entrypoint (`docker-entrypoint.sh`) runs a fixed sequence (connectivity →
migrate → admin-check → **start NestJS**), so after applying migrations the one-off container
tried to boot the app and crashed:
```
Error: Cannot find module '/app/apps/api/dist/main.js'  (MODULE_NOT_FOUND)
### MIGRATE_EXIT=1
```

### Root-cause diagnosis (new-image startup regression)
- `apps/api/docker-entrypoint.sh:111` → `exec node apps/api/dist/main.js` (hard-coded path).
- **OLD image:** `main.js` at `dist/main.js`. **NEW image:** `main.js` at `dist/**src**/main.js`
  (new `dist/` also has a `scripts/` dir).
- `apps/api/tsconfig.json` sets `outDir: ./dist` with **no `rootDir`/`include`** limiting compile
  to `src/`; `tsconfig.build.json` excludes tests but **not `scripts/`**.
- `apps/api/scripts/import-french-holidays.ts` was **created in `716f7ec..399e81a`** (the holidays
  work). tsc now includes it, so the inferred `rootDir` moves from `src/` up to `apps/api/`,
  relocating output to `dist/src/main.js`. The baked entrypoint's hard-coded `dist/main.js` no
  longer matches → **`docker compose up -d api` would crash-loop on the new image.**

### Prod state at halt
- **DB:** migrated to Decimal (verified, preflight was 0-lossy). 5 backup tables retained.
- **Live api:** STILL the OLD image (`5a9f56cc`), `Up (healthy)`, **0 errors in last 10 min** —
  old code on new Decimal schema, holding (low-traffic window).
- **New image:** present but has the startup path bug; NOT deployed to the live service.

### Decision point (halted, awaiting operator)
`up -d api` not run. Two recovery paths:
1. **Roll-forward (recommended):** 1-line fix — exclude `scripts` from the API build
   (`apps/api/tsconfig.build.json`) so output returns to `dist/main.js`. Commit→push master→prod
   pull→rebuild→`up -d api`. Keeps the clean, verified migration. Verify `dist/main.js` path
   locally before pushing.
2. **Roll-back:** run `scripts/db/rollback-dat005-decimal-conversion.sql` (restore Float from
   `_dat005_backup_*`) + keep old image. Undoes a verified-safe migration; returns to status quo.

**STOP — surfaced to operator. Over-stop discipline: unanticipated build regression + requires a
code change beyond "deploy existing master".**

---

## Phase 3 hotfix — entrypoint path mismatch (resolution of the halt above) → BUILD-001

**Operator decision:** roll-forward (keep the verified migration; fix the build).

### Symptom
New api image crashed at startup: `Cannot find module '/app/apps/api/dist/main.js'`. Live service
was never switched to it (still old image, healthy). DB already migrated to Decimal.

### Root cause (RCA)
`apps/api/docker-entrypoint.sh:111` hard-codes `exec node apps/api/dist/main.js`. `apps/api/
tsconfig.json` has `outDir: ./dist` but **no explicit `rootDir`/`include`**, so tsc infers
`rootDir` as the common ancestor of all compiled inputs. The file `apps/api/scripts/
import-french-holidays.ts` — **added during the COR-003 holidays de-risk work (created in
`716f7ec..399e81a`)** — sits outside `src/`, shifting the inferred `rootDir` from `src/` up to
`apps/api/`. Output relocated from `dist/main.js` to `dist/src/main.js`, breaking the entrypoint.

### Fix
Commit **`8e4b593`** `fix(build): exclude scripts/ from api build to restore dist/main.js
entrypoint` — added `"scripts/**"` to `exclude` in `apps/api/tsconfig.build.json`. Minimal,
additive; `rootDir` untouched (structural fix tracked as **BUILD-001**, Phase 13).

### Verification
- **Local build** (`pnpm --filter api run build`): `apps/api/dist/main.js` present at flat root;
  `dist/src` absent; excluded holidays script absent from `dist`; `dist/scripts/` contains only the
  legitimate `src/scripts/backfill-snapshots.js`.
- **VPS:** `git pull` (`399e81a → 8e4b593`, 1-line FF) → `docker compose build api` (exit 0, new
  image `sha256:7cd9b14a…`).
- **Pre-boot filesystem check** on rebuilt image: `/app/apps/api/dist/main.js` present, `dist/src`
  absent.

### Redeploy
`docker compose up -d api` → recreated, **healthy in ~20s**. Running container image =
`sha256:7cd9b14a…` (the hotfixed image; **not** the `5a9f56cc` anchor). Boot log:
```
[2/4] Running database migrations... 39 migrations found. No pending migrations to apply.
  API Ready - Listening on port 4000
[NestApplication] Nest application successfully started
Server listening at http://127.0.0.1:4000
```
No error-level logs. **Phase 3 complete.** Old-code/new-schema mismatch resolved.

---

## Phase 4 — Post-deploy verification

**Captured:** 2026-05-25T09:03Z (prod UTC). All checks green.

| Check | Result |
|-------|--------|
| 4.1 All services healthy | ✅ api/web/nginx/postgres/redis `Up (healthy)`; api `Up 2 min` on new image |
| 4.2 Both DAT-005 migrations applied | ✅ `…backup_float_columns` + `…convert_float_to_decimal`, each `applied_steps_count=1`, `finished_at` 2026-05-25 08:49:22+00 (no mixed state) |
| 4.3 5 columns now `numeric(p,s)` | ✅ leaves.days `(6,2)`, leave_balances.totalDays `(6,2)`, time_entries.hours `(5,2)`, tasks.estimatedHours `(5,2)`, project_snapshots.progress `(5,2)` |
| 4.4 `_dat005_backup_*` tables | ✅ 5 present (leaves_days, leave_balances_total_days, time_entries_hours, tasks_estimated_hours, project_snapshots_progress) |
| 4.5 Row counts vs baseline | ✅ leaves=132, time_entries=15, tasks=321 (unchanged — no data loss) |
| 4.6 Running api image | ✅ `sha256:7cd9b14a…` (hotfixed image), not anchor `5a9f56cc` |

### COR-003 smoke witness — date correction (important for Gate 2)
Day-of-week (2026): Apr 27=Mon, Apr 28=Tue, Apr 29=Wed, Apr 30=Thu, **May 1=Fri (Fête du Travail,
holiday on prod, isWorkDay=false)**, May 2=Sat.
- The spec's **Apr 28 → May 2** = weekdays Tue–Fri (4) − May 1 holiday = **3** charged days (not 4;
  "expect 4" there would be a false-fail).
- **Clean witness matching "expect 4": Apr 27 → May 1** = weekdays Mon–Fri (5) − May 1 holiday =
  **4** (was 5 pre-COR-003). Recommended for Gate 2.

---

## GATE 2 — post-deploy verification reported; awaiting operator manual frontend smoke

Phases 1–4 complete; Phase 1 remediation bundle live on prod (image `7cd9b14a`, Decimal schema).
Awaiting operator smoke (see checklist) → then final log commit + push. Rollback anchors ready:
api image `orchestra-api:pre-phase1-remediation` (`5a9f56cc`); DB backups in `backups-prod/`;
`_dat005_backup_*` tables + `scripts/db/rollback-dat005-decimal-conversion.sql` for schema revert.

---

## Phase 4.5 — Smoke verification (JWT-assisted API automation)

**Captured:** 2026-05-25T~10:00Z (prod UTC). All credentials handled as ephemeral shell vars —
**no token, cookie, or password value is recorded here or in any commit.**

### Auth contract discovered
- Session model = **opaque refresh cookie + short-lived access token**. The refresh cookie alone
  does NOT authenticate `/api/*` (`/api/auth/me` → 401). `POST /api/auth/login` returns an
  **`access_token`** in the body → used as `Authorization: Bearer` for all `/api/*` calls; the
  `orchestr_a_refresh_token` cookie is for `/api/auth/refresh` only.
- The operator-supplied refresh token was rejected (`401 "Refresh token inconnu"`) — rotated/
  single-use; superseded by a newer token in `refresh_tokens`. Re-established auth via
  credential `POST /api/auth/login` instead (login field accepts email when it contains `@`).
- **RBAC assignment:** system roles (`isSystem=true`, e.g. `BASIC_USER`) are **not assignable**
  ("Rôle système non assignable"); a non-admin **institutional** role (`CONTRIB_DEV`, template
  `PROJECT_CONTRIBUTOR`) was used for the temp user.
- Admin role `ADMIN_DSI` (template `ADMIN`) has `leaves:self_approve` → an admin's own leave is
  created `APPROVED`/`selfApproved=true`. So the DAT-001 approve path was exercised with a leave
  created by the **non-self-approving temp user** (lands `PENDING`), then approved by admin.

### Results
| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | COR-003 holiday subtraction + DAT-005 Decimal serialization | temp user `POST /api/leaves` 2026-04-27→2026-05-01 (CP) | HTTP 201; **`days = 4`** (5 weekdays Mon–Fri − May 1 «Fête du Travail») ; **`days` is JSON number (`int`), not string** ; `status=PENDING` → ✅ PASS |
| 2 | DAT-001 transactional approve + durable audit | admin `POST /api/leaves/<id>/approve` | HTTP 200, `status=APPROVED`, `selfApproved=false`; `audit_logs` row `LEAVE_APPROVED` with **actorId = admin**, payload `before.status=PENDING → after.status=APPROVED`, **`selfApproved=false`**, `validatedById=admin` → ✅ PASS |
| 3 | SEC-002 horizontal user-scope | non-admin temp user `PATCH /api/users/<admin-id>` | HTTP **403** "Forbidden resource" → ✅ PASS |
| 4 | leave delete | admin `DELETE /api/leaves/<id>` | HTTP 200 → ✅ PASS |

### Temp user lifecycle & cleanup
- Temp non-admin user created (`CONTRIB_DEV`) for checks 1–3 — id recorded operationally, **no
  credentials logged**. Hard-deleted at end (HTTP 200).
- A probe leave (admin self-approved during auth-contract discovery) was deleted (HTTP 200).
- **No test residue** on prod: both temp leaves deleted, temp user hard-deleted.

**All 4 backend smoke checks PASS.** Awaiting operator UI sanity ("smoke OK") → final log commit + push.

---

## GATE 2 — PASSED. Deploy complete.

**Operator UI sanity (login + leaves list render): OK.** Combined with the 4 green backend smoke
checks (Phase 4.5), the Phase 1 remediation bundle is **verified live on production**.

### Final state
- **Code:** prod `git HEAD = 8e4b593` (master + build hotfix). API image `sha256:7cd9b14a…`, healthy.
- **Schema:** DAT-005 applied — 5 columns `numeric(p,2)`; 5 `_dat005_backup_*` tables retained.
- **Verified behaviors:** SEC-001 (`RBAC_GUARD_MODE=enforce`), SEC-002 (403 on cross-user PATCH),
  DAT-001 (transactional approve + durable `audit_logs`), DAT-005 (Decimal columns + JSON-number
  serialization), COR-003 (public-holiday subtraction, May 1 → `days=4`). SEC-003 & CLAUDE-CFG-001
  shipped in the same bundle (code-level; not separately smoke-exercised).
- **No rollback required.** Anchors retained for the standard window: api image
  `orchestra-api:pre-phase1-remediation` (`5a9f56cc`), DB dumps in `backups-prod/`,
  `_dat005_backup_*` tables + `scripts/db/rollback-dat005-decimal-conversion.sql`.

### Deviations from the original plan (for audit)
1. Prod was **26** commits behind master, not 19 (benign — only the 2 DAT-005 migrations were
   schema-relevant).
2. Phase 3 step order corrected to **build → migrate → up** (source-baked image; Gate 1 greenlit).
3. **Disk remediation** (Category A): 999 MB → 41 GB free before the build.
4. **Build hotfix `8e4b593`** (entrypoint path) required mid-Phase-3; **roll-forward** chosen over
   the spec's auto-rollback (migration was verified-safe). New finding **BUILD-001** filed.
5. Smoke witness corrected to **Apr 27→May 1** (the spec's Apr 28→May 2 would yield 3, not 4).

**Deploy log complete.**
