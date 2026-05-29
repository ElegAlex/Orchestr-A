# Code-Only Micro-Deploy — COR-038 + Phase-4 Cluster A/B (5 deltas)

**Audit-trail artifact for Cour des Comptes.** Durable record of the operational production deploy
of **5 code-only runtime deltas** accumulated on `master` since the 2026-05-28 Phase-3 + mini-arc
deploy. **No DB migration, no `schema.prisma` change** — image rebuild + container swap + smokes only.
Prod host runs `Etc/UTC`; SSH key auth, no password exposed in transcripts.

> **DEPLOYED ✅ — all 5 gates pass, prod runs `ce0c729` (api image `603f07331516`), anchor preserved
> as `orchestra-api:pre-cor038-phase4-ab-microdeploy = 3c264f51b813`. SEC-030 + COR-028 proven
> behaviorally; COR-038 + COR-001 + COR-002 verified by code-presence in the deployed image (each
> unexerciseable read-only — see Gate 3). No DB change; touched-table counters UNCHANGED.**

---

## Scope & metadata

- **Date:** 2026-05-29 (UTC).
- **Operator:** Claude Code (Opus 4.8, 1M context), driven by repository owner.
- **Nature:** code-only micro-deploy. No migration, no DDL, no `schema.prisma` edit. Image build +
  container swap (`docker compose build api` → `up -d api`) + per-delta smokes.
- **Master HEAD targeted (deploy target):** `ce0c729` (pushed to `origin/master` at deploy start —
  was 6 commits ahead of origin `92cdcac`; the unpushed gap held COR-028 + SEC-030).
- **Prod HEAD baseline:** `ebcd9e1` (Phase-3 + mini-arc deploy point, 2026-05-28).
- **Rollback anchor image:** `orchestra-api:pre-cor038-phase4-ab-microdeploy` (tagged from the running
  `orchestra-api:latest = 3c264f51b813` at Gate 1).
- **VPS:** `debian@92.222.35.25`, repo `/opt/orchestra`.
- **Compose invocation:** `docker compose -f docker-compose.prod.yml --env-file .env.production …`
  (`--env-file` mandatory — no `.env` at `/opt/orchestra`).
- **Containers:** api=`orchestr-a-api-prod`, web=`orchestr-a-web-prod`, db=`orchestr-a-postgres-prod`.
- **DB:** `orchestr_a_prod`, user `orchestr_a`. Host has no `psql`/`pg_dump` → all Postgres ops run
  inside the db container (`docker exec`).

### The 5 deltas (re-derived at execution from `git log ebcd9e1..ce0c729 --oneline` filtering `[closes X]` fix commits)

| # | Task | Fix SHA | Nature | Smoke posture |
|---|------|---------|--------|---------------|
| 1 | COR-038 | `24c6929` | events parent-cycle P0001/23514 → 409 `ConflictException` (`events.service.ts`) | **code-presence** — `parentEventId` in no Event DTO ⇒ controller-unreachable; defense-in-depth only |
| 2 | COR-001 | `cb3b5e1` | epics `assertProjectMembership`: ADMIN role-code bypass → `projects:manage_any` permission | **code-presence** — 0 epics in prod ⇒ no row to exercise |
| 3 | COR-002 | `27c0424` | milestones `assertProjectMembership`: same fix as COR-001 | **code-presence** — `assertProjectMembership` is called only by `update`/`remove` (mutations); no GET path reaches it ⇒ not exerciseable read-only (no prod mutation allowed) |
| 4 | COR-028 | `d1c420d` | `getUserLeaves(userId)` → `getOwnLeaves(currentUserId)`, query lock | **behavioral (regression)** — pure rename, zero behavioral delta; liveness + flags check |
| 5 | SEC-030 | `d6ed06f` | `AccessScopeService.userReadWhere` (net-new, 4 buckets), `users.findOne` scope + payload restriction | **behavioral** — the one delta that proves runtime behavior changed |

> DOC-001 (`006adb7`) is in the `ebcd9e1..ce0c729` range but is **docs-only** (Phase-2 deploy-doc
> backfill) — correctly **excluded** from the runtime delta set. 5 runtime deltas, not 6.

### Smoke authentication method (transparency for audit)

No production *application* login was used. `JwtStrategy.validate()` re-fetches the user from DB by
`payload.sub` and resolves `role.code`/`templateKey` server-side (the token `role` claim is cosmetic;
`jti` is optional → omitting it bypasses the blacklist check). Behavioral smokes therefore use
**ephemeral HS256 JWTs minted from the prod `JWT_SECRET`** (read from `/opt/orchestra/.env.production`
on the VPS), with `sub` set to a real existing `users.id`, short TTL. **All smokes are GET (read-only)
— zero mutation.** Identities used: `admin` (`a3117b50…`, code `ADMIN_SYSTEM`, templateKey `ADMIN`,
holds `users:manage`) and `agoumallah` (`c9f2c6d3…`, code `CONTRIB_CFA`, no `users:manage`).

---

## Gate 0 — Sanity + baseline reassessment (learning #14) — ✅ COMPLETE

| Check | Result |
|-------|--------|
| No IN_PROGRESS task in BACKLOG | ✅ `grep -c 'Status: IN_PROGRESS'` = 0 |
| Master HEAD | ✅ `ce0c729` (`git rev-parse HEAD`) |
| Prod current HEAD (SSH) | ✅ `ebcd9e1` — matches expected baseline, **no out-of-band deploy** |
| Prod `_prisma_migrations` probe (top 5 by finished_at) | ✅ `dat035` / `dat037` / `dat038` / `dat036` / `dat032_dat033` — **56 rows, last = Phase-3 mini-arc final; NO Phase-4 migration** (correct — this deploy has none) |
| Running api image (rollback anchor source) | ✅ `orchestra-api:latest = 3c264f51b813` (`sha256:3c264f51b8133b…`), `Up 31 hours (healthy)` |
| Pre-deploy row counts (touched tables) | epics **0** · events **8** · leaves **138** · milestones **108** · project_members **121** · users **41** |

**Reassessment outcome:** baseline exactly as expected (prod `ebcd9e1`, migrations frozen at 56). One
**surprise surfaced and resolved, not auto-corrected silently:** `origin/master` was `92cdcac`, 6
commits behind local `ce0c729` — COR-028 + SEC-030 closeout commits had never been pushed. Resolved by
`git push origin master` (authorized standing instruction) so prod can `git checkout ce0c729`. Surfaced
to operator. No prod state was touched during Gate 0.

---

## Gate 1 — Rollback anchor + backup decision

- **Anchor tag:** `docker tag <current-latest-id> orchestra-api:pre-cor038-phase4-ab-microdeploy`.
- **Backup decision:** YES (default) — pg_dump for audit-trail consistency with Phase-3 even though no
  DB change. ~1–2 MB compressed; negligible cost.

**✅ COMPLETE.** Anchor tagged: `orchestra-api:pre-cor038-phase4-ab-microdeploy = 3c264f51b813`
(== the running `latest` at Gate 1). Backup:
`/opt/orchestra/backups/pre-cor038-phase4-ab-microdeploy-20260529-200458.sql.gz` · **426 KB** · pg_dump
exit 0 · gzip exit 0.

---

## Gate 2 — Image build + container swap

- Prod: `git fetch && git checkout ce0c729` (detached HEAD convention).
- `docker compose -f docker-compose.prod.yml --env-file .env.production build api`.
- `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api` (swap).
- Verify `docker ps` → `orchestr-a-api-prod` running, new image id.

**✅ COMPLETE.** `git fetch origin` (`ebcd9e1..ce0c729`) → `git checkout ce0c729` → prod HEAD now
`ce0c729`. `build api` succeeded → new image `sha256:603f07331516e2ce…` (EXIT:0; build run in the
background with a completion monitor per discipline). `up -d api` recreated `orchestr-a-api-prod`;
container became `healthy` on first poll; running image confirmed `sha256:603f07331516…` (NOT the
anchor `3c264f51b813`). Health endpoint `{"status":"ok"}` 200 immediately post-restart.

---

## Gate 3 — Smokes per delta (5)

1. **COR-038** (code-presence) — confirm `isEventParentCycleViolation` + P0001/23514→409 mapping is in
   the deployed image's `events.service.js`; confirm `parentEventId` absent from Event DTOs (no HTTP
   cycle path). Behavioral proof lives in `events.service.spec.ts` (green at `ce0c729`).
2. **COR-001** (code-presence) — confirm `permissions.includes('projects:manage_any')` bypass present in
   deployed `epics.service.js`; 0 epics in prod ⇒ no behavioral exercise possible.
3. **COR-002** (behavioral) — forge token for `admin` (ADMIN_SYSTEM, code≠'ADMIN'), GET a milestone in a
   project the user is NOT a member of → expect **200** (manage_any bypass), not 403.
4. **COR-028** (behavioral/regression) — forge token for a user with leaves, GET `/api/leaves/me` →
   only caller's leaves, `canEdit`/`canDelete` correct per status (no spurious true).
5. **SEC-030** (behavioral) — admin GET `/api/users/:id` → FULL payload (email/login present); non-admin
   GET own id → DIRECTORY payload (email/login/skills stripped); non-admin GET out-of-scope id → **404**.

**✅ COMPLETE — no smoke FAILED, no HALT.** Auth = ephemeral HS256 JWT minted with Node's built-in
`crypto` (the bundled image lacks a resolvable `jsonwebtoken`), signed with the prod `JWT_SECRET` from
the api-container env, `sub` = real user id, `jti` omitted (skips blacklist), TTL 10 min. All GET.

| Smoke | Method | Result |
|-------|--------|--------|
| **SEC-030.1** admin `GET /users/:id` | behavioral | **HTTP 200**, FULL payload — `email`✓ `login`✓ `skills`✓ present |
| **SEC-030.2** directory caller `GET /users/<self>` | behavioral | **HTTP 200**, DIRECTORY payload — `email`✗ `login`✗ (stripped), `firstName`✓ present |
| **SEC-030.3** directory caller `GET /users/<out-of-scope>` | behavioral | **HTTP 404** `{"message":"Utilisateur introuvable",…}` (non-disclosing) |
| **COR-028** `GET /leaves/me` | behavioral (regression) | **HTTP 200**, 8 leaves, **all `userId` == caller**, `canEdit`/`canDelete` present on every row; APPROVED→`E:false/D:false` (no spurious-true) |
| **COR-038** events cycle→409 | code-presence | image `events.service.js`: cycle-violation helper + `events_parent_no_cycle` (4 hits) + `ConflictException` (2); `parentEventId` in **0** DTO files ⇒ controller-unreachable. Behavioral proof in `events.service.spec.ts` (green @ `ce0c729`). |
| **COR-001** epics manage_any | code-presence | image `epics.service.js`: `projects:manage_any` present (1); old `=== 'ADMIN'` bypass **gone** (0). 0 epics in prod ⇒ no row to exercise. |
| **COR-002** milestones manage_any | code-presence | image `milestones.service.js`: `projects:manage_any` present (1); old `=== 'ADMIN'` bypass **gone** (0). `assertProjectMembership` is mutation-only (`update`/`remove`) ⇒ not exerciseable read-only without mutating prod. |

**Reductions documented (not failures).** COR-038/COR-001/COR-002 reduce to code-presence for the
reasons above — each verified present in the *deployed compiled image* `603f07331516`, not merely on
master. SEC-030 + COR-028 carry the behavioral proof that runtime behavior shipped. SEC-030's
`userReadWhere` also confirmed present in the image (1 hit) — corroborating the behavioral pass.

---

## Gate 4 — Health + closure

- Public health: `curl -k https://localhost/api/health` → `{"status":"ok"}` 200.
- Logs: `docker logs --tail 100 orchestr-a-api-prod` → no unexpected stack / no 500 on touched paths.
- Counter rows post-deploy = Gate-0 capture on all touched tables → **UNCHANGED** (no delta mutates data).

**✅ COMPLETE.** Health `{"status":"ok","uptime":199s}` 200. All 6 compose services healthy
(`api` Up healthy on new image; web/postgres/redis/nginx/certbot unchanged). Log scan (`--tail 200`,
filtered for error/exception/500/stack/unhandled) returned **only** the normal boot-time
`RELEASE_DEPLOYED` + `Deployments` audit entries — **no error / no 500 / no stacktrace** on any path.
Post-deploy counts: epics **0** · events **8** · leaves **138** · milestones **108** · project_members
**121** · users **41** — **IDENTICAL to Gate-0** (deploy + read-only smokes mutated nothing).

**Gap (audit accuracy, cosmetic).** The boot-time `RELEASE_DEPLOYED` audit row self-reports
`releaseSha=3fd8986` and `migrations=56`. `migrations=56` is correct. `releaseSha` is **stale** — it
reads a `RELEASE_SHA` env var that the deploy process does not update to the checked-out SHA (carried
since Phase-3). The **actually-deployed code is `ce0c729`**, proven independently by (a) prod `git
rev-parse HEAD = ce0c729` and (b) the compiled-image markers in Gate 3. Instrumentation lag only; no
effect on what is running. Candidate future follow-up: wire `RELEASE_SHA` to the git checkout.

---

## Rollback path (if Gate 3 or Gate 4 fails)

1. Re-tag anchor → latest: `docker tag orchestra-api:pre-cor038-phase4-ab-microdeploy orchestra-api:latest`.
2. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api` (restart with anchor).
3. On prod: `git checkout ebcd9e1` (if the checkout advanced).
4. Re-smoke health endpoint.
5. Banner → `FAILED at Gate N — rolled back`.
6. PROGRESS_LOG entry captures the post-mortem (gate, failing smoke, restored state).

No DB rollback is needed (no migration applied); the Gate-1 backup is a belt-and-suspenders audit copy.

---

## Resolved carry-forwards

- **Operational carry-forward #2 (DAT-038 → events parent-cycle).** Transitions `FIXED-ON-MASTER` ⟹
  `FIXED-IN-PROD` on Gate-4 pass. Support lens: prod's `events.service.ts` no longer lets a raw 500
  propagate on a cyclic `parentEventId` write — it maps P0001/23514 to a clean 409. **Caveat (honest
  framing):** `parentEventId` is settable through no Event DTO, so this path is controller-unreachable
  over HTTP; the 409 (like the 500 it replaced) only arises on a direct-SQL/bypass write. The change is
  defense-in-depth, not a user-facing fix.

---

## DEPLOY EXECUTION LOG — 2026-05-29 (UTC)

**Operator:** Claude Code (Opus 4.8, 1M context), driven by repository owner. SSH key auth.

**Outcome:** ✅ **SUCCESSFUL DEPLOY** — 5 code-only runtime deltas live in prod; prod git
`ebcd9e1` → `ce0c729`; api image `3c264f51b813` → `603f07331516`; anchor preserved; touched-table
counters unchanged; service healthy.

### Gate-by-gate ledger

| Gate | Time (UTC) | Result | Key artifact |
|------|------------|--------|--------------|
| **Gate 0 — Sanity + baseline** | ~19:56 | ✅ + 1 surprise resolved | Prod HEAD `ebcd9e1` (expected); `_prisma_migrations` 56 rows, last `dat035`, no Phase-4 migration; running image `3c264f51b813` healthy; pre-counts captured. **Surprise:** `origin/master` was `92cdcac` (6 behind local `ce0c729`; COR-028+SEC-030 unpushed) → resolved by `git push origin master`, surfaced to operator. |
| **Gate 1 — Anchor + backup** | ~20:04 | ✅ | Anchor `orchestra-api:pre-cor038-phase4-ab-microdeploy = 3c264f51b813`; backup `pre-cor038-phase4-ab-microdeploy-20260529-200458.sql.gz` 426 KB (pg_dump+gzip exit 0). |
| **Gate 2 — Build + swap** | ~20:05–20:07 | ✅ | Prod `git checkout ce0c729`; `build api` → new image `603f07331516` (background build + completion monitor); `up -d api` → container healthy on first poll, running new image; health 200. |
| **Gate 3 — Smokes (5)** | ~20:09–20:10 | ✅ ALL PASS / no HALT | SEC-030: 200 FULL (admin) · 200 DIRECTORY no-email (dir) · **404** out-of-scope. COR-028: 200, 8 leaves all caller-owned, flags correct, no spurious-true. COR-038/001/002: code-presence verified in deployed image (markers present, old `=== 'ADMIN'` bypass gone, parentEventId in 0 DTOs). Auth = ephemeral HS256 JWT from prod `JWT_SECRET`, all GET (zero mutation). |
| **Gate 4 — Health + closure** | ~20:10 | ✅ | Health ok (uptime 199s); 6/6 services healthy; log scan clean (only boot `RELEASE_DEPLOYED`); counters IDENTICAL to Gate-0 (epics 0/events 8/leaves 138/milestones 108/project_members 121/users 41). |

### Three-state attestation

- **Verified (evidence-backed this session):** prod HEAD `ce0c729` (git rev-parse); image `603f07331516`
  running (docker inspect); SEC-030 + COR-028 behavioral smokes (HTTP codes + payload field presence);
  COR-038/001/002 + SEC-030 `userReadWhere` code-presence (grep on deployed compiled JS); old
  `=== 'ADMIN'` bypass absent (grep = 0); counter invariant (pre vs post identical); backup exit codes.
- **Inferred:** COR-038/COR-001/COR-002 *runtime* correctness — not exercised on prod (controller-
  unreachable / 0 rows / mutation-only) but proven by their spec suites green at `ce0c729` and present
  in the deployed image.
- **Gap:** `RELEASE_DEPLOYED` self-reported `releaseSha=3fd8986` is stale (env not wired to the git
  checkout); the running code is `ce0c729` by independent evidence. Cosmetic only; future follow-up
  candidate to wire `RELEASE_SHA`.

### Resolved carry-forward (now LIVE in prod)

**Operational carry-forward #2 (DAT-038 / events parent-cycle): `FIXED-ON-MASTER` ⟹ `FIXED-IN-PROD`.**
Prod's `events.service.ts` now maps the trigger's P0001 / named-23514 to a clean `409 ConflictException`
instead of leaking a raw 500. Support lens, precise: a cyclic `parentEventId` write no longer surfaces
500 — but this path is reachable only by direct-SQL/bypass (no Event DTO exposes `parentEventId`), so
it is a defense-in-depth hardening, not a user-facing change. The 409, like the 500 before it, never
arises through the HTTP API.

### What changed vs prior prod state

- Prod git SHA: `ebcd9e1` → `ce0c729` (5 runtime deltas + docs/backlog bookkeeping).
- Prod api image: `3c264f51b813` (anchor `orchestra-api:pre-cor038-phase4-ab-microdeploy`) → `603f07331516`.
- `_prisma_migrations`: **unchanged at 56** (no migration in this deploy).
- DB data: unchanged (no DDL, no DML; smokes were read-only).

### Rollback path (not exercised — deploy succeeded)

Retag anchor `3c264f51b813` → `orchestra-api:latest` + `up -d api`; `git checkout ebcd9e1` on prod;
re-smoke health. No DB rollback needed (no migration). Gate-1 backup is the belt-and-suspenders copy.

### Next steps (NOT in this session)

- HANDOVER refresh: carry-forward #2 → FIXED-IN-PROD; prod HEAD line → `ce0c729`; §Operational
  carry-forwards + §PROD-DEPLOY updated. **Separate session.**
- File the GET /users list-scope adjacency follow-up (`findAll`/`getUsersBy*` unscoped; `userReadWhere`
  now reusable). **Separate session.**
- Cluster C kickoff (TST-001 + TST-018). **Separate session.**
