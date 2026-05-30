# Code-Only Micro-Deploy — SEC-031 (single runtime delta)

**Audit-trail artifact for Cour des Comptes.** Durable record of the operational production deploy of
the **single code-only runtime delta SEC-031** (`GET /users` list-scope adjacency), accumulated on
`master` since the 2026-05-29 micro-deploy. **No DB migration, no `schema.prisma` change** — image
rebuild + container swap + smokes only. Prod host runs `Etc/UTC`; SSH key auth.

> **DEPLOYED ✅ — all gates pass, prod runs `aae2768` (api image `d20fd28761d6`), anchor preserved as
> `orchestra-api:pre-sec031-microdeploy = 603f07331516`. SEC-031's user-facing effect (`GET /users`
> payload-shaping) verified BEHAVIORALLY with operator-provided app credentials (no JWT forge); the
> `getUsersBy*` where-scope verified by code-presence (those helpers are not HTTP-reachable). No DB
> change; touched-table counters UNCHANGED (users 41 → 41, migrations 56).**

Continuity: next link after
[`2026-05-29-code-only-microdeploy-cor038-and-phase4-cluster-ab.md`](./2026-05-29-code-only-microdeploy-cor038-and-phase4-cluster-ab.md)
(which moved prod `ebcd9e1 → ce0c729`). Cumulative prod baseline origin: `ebcd9e1`.

---

## Scope & metadata

- **Date:** 2026-05-30 (UTC).
- **Operator:** Claude Code (Opus 4.8, 1M context), driven by repository owner.
- **Nature:** code-only single-delta micro-deploy. No migration, no DDL, no `schema.prisma` edit. Image
  build + container swap (`docker compose build api` → `up -d api`) + smokes.
- **Master HEAD targeted (deploy target):** `aae2768` (already on `origin/master`; push was a no-op).
- **Prod HEAD baseline:** `ce0c729` (the 2026-05-29 micro-deploy point) — confirmed by SSH
  `git rev-parse HEAD` at Gate 0, no out-of-band deploy.
- **Prod HEAD after deploy:** `aae2768` (detached HEAD = the deployed runtime SHA). **Note for audit:**
  `origin/master` advances *past* `aae2768` with this session's two **docs-only** commits (this deploy
  doc + the HANDOVER/PROGRESS_LOG refresh). Prod intentionally sits at `aae2768`; those later commits
  carry zero runtime change and are deliberately not redeployed. `prod git SHA ≠ origin/master HEAD` is
  expected, not drift.
- **Rollback anchor image:** `orchestra-api:pre-sec031-microdeploy` (tagged from the running
  `orchestra-api:latest = 603f07331516` **by image id**, so it survives the `:latest` move at Gate 2).
- **New api image:** `d20fd28761d6`.
- **VPS:** `debian@92.222.35.25`, repo `/opt/orchestra`.
- **Compose invocation:** `docker compose -f docker-compose.prod.yml --env-file .env.production …`
  (`--env-file` mandatory — no `.env` at `/opt/orchestra`).
- **Containers:** api=`orchestr-a-api-prod`, db=`orchestr-a-postgres-prod`.
- **DB:** `orchestr_a_prod`, user `orchestr_a`. Host has no `psql`/`pg_dump` → all Postgres ops run
  inside the db container (`docker exec`).

### The single runtime delta

| Task | Fix SHA | Nature | Smoke posture |
|------|---------|--------|---------------|
| SEC-031 | `198160f` | `users.service.ts` `findAll` payload-restriction (rows preserved) + `getUsersByService`/`getUsersByRole` full `AccessScopeService.userReadWhere` where-scope; `users.controller.ts` threads `@CurrentUser()` into `findAll` | **behavioral** (`findAll` payload) + **code-presence** (`getUsersBy*` where-scope, not HTTP-reachable) |

> **AMENDED AC (audit-relevant).** SEC-031's AC#2 was **HALTED and amended mid-execution** by the
> operator. The original AC#2 said "`findAll` applies full `userReadWhere` where-scoping" (symmetry with
> `getUsersBy*`). The operator HALTED — scoping `findAll`'s **row set** would break the org-chart /
> directory UI (which needs all users visible) — and picked **option 2**: `findAll` = **payload-only
> restriction (rows preserved)**, `getUsersBy*` = **full where-scope**. The deployed delta reflects
> **AC#2-amended**, not the original BACKLOG formulation. No silent substitution; logged in BACKLOG.md
> with the amendment + learning. (Process learning #17 — operator-control invariant.) **The behavioral
> smoke below directly witnesses the amended shape: a non-privileged caller still sees all rows, but
> with `email`/`skills` stripped.**

### Why this is a single-delta deploy even though the git range is 23 commits

`git rev-list --count ce0c729..aae2768` = **23**. But the **runtime image delta** is SEC-031 alone:

- **Verified ✅** `git diff ce0c729..aae2768 --name-only` → only `apps/api/src/users/users.controller.ts`
  + `apps/api/src/users/users.service.ts` are runtime app sources. The remainder:
  `users.{controller,service}.spec.ts` (`*.spec.ts` excluded from `nest build`), `e2e/**` (Playwright,
  not in the image), `.github/workflows/**` + `scripts/**` (CI, not in the image), and `backlog/**` +
  `docs/**` (documentation).
- **Verified ✅** `git diff ce0c729..aae2768 --stat -- packages/ apps/api/package.json package.json
  pnpm-lock.yaml apps/api/tsconfig* apps/api/Dockerfile docker-compose.prod.yml` → **blank**. No image
  build-input (shared packages, manifests, lockfile, tsconfig, Dockerfile, compose) changed besides the
  two users source files.

**Honest framing:** deploying `aae2768` moves prod git `ce0c729 → aae2768` and ships all 23 commits'
repo state, but the **runtime behavioral delta vs the prior prod image is SEC-031 alone**. The 21
non-SEC-031 commits (TST-001 / TST-CI-001 / TST-018 test-hardening + backlog filings + the 2026-05-29
deploy-doc) carry **zero** runtime app-code change.

---

## Smoke authentication method (transparency for audit)

The operator was asked **before the build** (per process learning #17, which exists to prevent repeating
the 2026-05-29 silent JWT-forge) which auth method to use for the behavioral smoke. Three options were
presented: (a) operator provides app credentials, (b) reduce to code-presence only, (c) operator
explicitly authorizes an ephemeral read-only JWT forge from prod `JWT_SECRET`.

**The operator picked (a) and provided real application credentials** — one ADMIN account and one
non-privileged account. The behavioral smoke therefore used the **public login endpoint**
(`POST /api/auth/login`) to obtain genuine session tokens, then issued authenticated **GET** requests.
**No JWT was forged, no auth bypassed, no user impersonated; all smoke requests were read-only (GET).**
Identities (no secrets recorded here): ADMIN = `alexandre.berge@cpam92.fr`; non-privileged =
`rayan.sifi@cpam92.fr` (role code `CONTRIB_CFA`, no `users:manage`).

---

## Gate 0 — Sanity + baseline (read-only on prod)

| Check | Result | Provenance |
|-------|--------|-----------|
| No IN_PROGRESS task in BACKLOG | `grep -c IN_PROGRESS` = 0 | Verified ✅ |
| Master HEAD | `aae2768` (`git rev-parse HEAD`) | Verified ✅ |
| `origin/master` | `aae2768` (push no-op) | Verified ✅ |
| Prod current HEAD (SSH) | `ce0c729` — matches expected baseline, no out-of-band deploy | Verified ✅ |
| Prod `_prisma_migrations` count | **56** — unchanged; SEC-031 has zero migration | Verified ✅ |
| Local `packages/database/prisma/migrations` count | **56** — matches prod | Verified ✅ |
| Running api image (anchor source) | `orchestra-api:latest = 603f07331516`, `Up ~18h (healthy)` | Verified ✅ |
| Pre-deploy users row count | **41** | Verified ✅ |
| Health baseline | `HTTP 200 {"status":"ok"}` | Verified ✅ |
| Local build (`pnpm build`) | `3 successful, 3 total` (turbo), no TS error | Verified ✅ |
| Deployed delta shape vs AC#2-amended | `findAll` payload-only (rows preserved); `getUsersBy*` `userReadWhere` scope | Verified ✅ (read of `users.service.ts`) |

---

## Gate 1 — Rollback anchor + backup — ✅ COMPLETE

- **Anchor idempotency:** `docker image inspect orchestra-api:pre-sec031-microdeploy` → `NOT-FOUND-OK`
  (no stale anchor from a prior attempt). Verified ✅.
- **Anchor tag:** `docker tag 603f07331516… orchestra-api:pre-sec031-microdeploy` → `TAGGED_OK`. Anchor
  id == `603f07331516` == the running `:latest` at Gate 1 (pinned by image id). Verified ✅.
- **Backup:** `pg_dump | gzip` → `PGDUMP_PIPE_EXIT=0_0` (both stages exit 0),
  `/opt/orchestra/backups/pre-sec031-microdeploy-20260530-142823.sql.gz` · **429 KB**. Verified ✅.

---

## Gate 2 — Image build + container swap — ✅ COMPLETE

- Prod: `git fetch origin` (`ce0c729..aae2768`) → `git checkout aae2768` (detached HEAD). Prod HEAD now
  `aae2768`. Verified ✅.
- `docker compose … build api` (background + completion monitor per discipline) → `BUILD_EXIT=0`,
  `orchestra-api Built`. Verified ✅.
- `docker compose … up -d api` → container recreated (postgres/redis dep-health waited). New running
  image `d20fd28761d6` (≠ anchor `603f07331516`). Anchor still pins `603f07331516`. Container reached
  `Up (healthy)` (polled via background until-loop). Verified ✅.

---

## Gate 3 — Smokes

| Smoke | Method | Result | Provenance |
|-------|--------|--------|-----------|
| Running image ≠ anchor | artifact | running `d20fd28761d6`, anchor `603f07331516` | Verified ✅ |
| `userReadWhere` in deployed `users.service.js` | grep on compiled image (`/app/apps/api/dist/users/users.service.js`) | **4 hits** | Verified ✅ |
| `getUsersByService` / `getUsersByRole` present | grep | 2 / 2 hits | Verified ✅ |
| Controller threads `currentUser` | grep on `users.controller.js` | **7 hits** | Verified ✅ |
| `/api/health` | curl | **HTTP 200** `{"status":"ok"}` | Verified ✅ |
| `GET /api/users` unauthenticated | curl | **HTTP 401** (guard intact) | Verified ✅ |
| **SEC-031 BEHAVIORAL — `findAll` payload shaping** | authenticated GET (operator creds) | see below | **Verified ✅** |
| **SEC-031 — `getUsersBy*` where-scope** | n/a | helpers have **no controller route and no caller** (not HTTP-reachable) → code-presence only | **Inferred 🟡** |

### Behavioral witness — `GET /api/users?limit=100` (the AC#2-amended delta)

Logged in via `POST /api/auth/login` with operator-provided credentials, then:

| Caller | rows returned | `email` in payload | `skills` in payload |
|--------|---------------|--------------------|---------------------|
| **ADMIN** (`alexandre.berge`, `users:manage`) | all (full directory) | **present** ✅ | **present** ✅ |
| **non-privileged** (`rayan.sifi`, `CONTRIB_CFA`) | **all rows preserved** ✅ | **absent (stripped)** ✅ | **absent (stripped)** ✅ |

This is exactly SEC-031 AC#2-amended: the non-privileged caller still sees the **full row set**
(directory visibility preserved — the operator's mid-execution amendment) but the **sensitive fields
are stripped from the payload** (`DIRECTORY_LIST_SELECT` vs `FULL_LIST_SELECT`). The ADMIN, holding
`users:manage`, receives the full payload. Behavioral proof that the runtime behavior shipped.

**`getUsersBy*` honest framing:** `getUsersByService` / `getUsersByRole` are defined in `users.service.ts`
and carry the full `userReadWhere` where-scope, but a repo-wide grep confirms they have **no controller
route and no caller** in the app — they are not reachable over HTTP. Their where-scope is therefore
defense-in-depth, verified **by code-presence** in the deployed compiled JS (`userReadWhere` present),
not exercised at runtime. (Same controller-unreachable pattern as COR-038 in the prior deploy.)

---

## Gate 4 — Health + closure — ✅ COMPLETE

| Check | Result | Provenance |
|-------|--------|-----------|
| Public health | `{"status":"ok"}` HTTP 200, uptime fresh post-restart | Verified ✅ |
| Container state | `Up (healthy)` on new image `d20fd28761d6` | Verified ✅ |
| Log scan (`--tail 200`, `error\|exception\|500\|unhandled\|stacktrace`) | **0** matches | Verified ✅ |
| Post-deploy users count | **41** — IDENTICAL to Gate-0 | Verified ✅ |
| `_prisma_migrations` count | **56** — unchanged | Verified ✅ |

---

## Rollback path (NOT exercised — deploy succeeded)

1. Re-tag anchor → latest: `docker tag orchestra-api:pre-sec031-microdeploy orchestra-api:latest`.
2. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api` (restart with anchor
   `603f07331516`).
3. On prod: `git checkout ce0c729`.
4. Re-smoke health endpoint (expect 200).
5. Banner → `ROLLED BACK to ce0c729 / 603f07331516`.

No DB rollback needed (no migration applied). The Gate-1 `pg_dump` is a belt-and-suspenders audit copy.

---

## Three-state attestation

- **Verified ✅ (evidence-backed this session):** prod HEAD `ce0c729 → aae2768`; build-input delta blank
  besides the 2 users files; local build green; new image `d20fd28761d6` running ≠ anchor `603f07331516`;
  anchor preserved; SEC-031 code-presence markers in deployed JS (`userReadWhere` 4, `getUsersBy*` 2/2,
  controller `currentUser` 7); `/health` 200; unauth `/users` 401; **behavioral `findAll` payload
  shaping** (ADMIN full vs non-privileged stripped, rows preserved); log scan clean; counter invariant
  (users 41 == 41; migrations 56); backup exit `0_0`.
- **Inferred 🟡:** `getUsersBy*` where-scope correctness — present in the deployed image and unit-tested
  green at `aae2768`, but not HTTP-reachable so not exercised at runtime (defense-in-depth).
- **Gap ⬜:** none material. (Auth method was option (a) operator-provided creds → the behavioral layer
  that was a Gap in the prior plan is now Verified.)

---

## Outstanding / carry-forwards (re-checked)

- **#2 — RESOLVED (still).** Events parent-cycle (DAT-038) P0001/23514 → 409; untouched by SEC-031,
  remains `FIXED-IN-PROD`.
- **#3 — OPEN (still).** TOCTOU on per-day hours cap (DAT-033/COR-022). Not touched by SEC-031.
- **#4 — DESIGN CONTRACT (still).** Whitespace-only `project_members.role` admitted at DB by design.
  Not touched.
- **#1 — LIVE (still).** DAT-037 silent cascade on `epic/milestone.projectId` UPDATE. Not touched.
- **Infra note (carried).** `RELEASE_SHA` env not wired to the git checkout ⇒ boot-time
  `RELEASE_DEPLOYED` self-reports a stale SHA. Not re-checked this session; cosmetic.

## Next steps (NOT in this session)

- 4 new filings: TST-MTX-001, TST-E2E-001, TST-RH-001 (+ TST-001 oracle-correction follow-ups).
- 2 pre-existing: TOOL-COH-003, TOOL-DBSYNC-001.
- **No undeployed runtime delta remains** — Phase 4 audit-original 6/6 is now fully in prod.
