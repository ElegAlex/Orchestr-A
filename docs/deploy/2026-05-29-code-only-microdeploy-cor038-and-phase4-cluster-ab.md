# Code-Only Micro-Deploy — COR-038 + Phase-4 Cluster A/B (5 deltas)

**Audit-trail artifact for Cour des Comptes.** Durable record of the operational production deploy
of **5 code-only runtime deltas** accumulated on `master` since the 2026-05-28 Phase-3 + mini-arc
deploy. **No DB migration, no `schema.prisma` change** — image rebuild + container swap + smokes only.
Prod host runs `Etc/UTC`; SSH key auth, no password exposed in transcripts.

> **EXECUTING — Gate 0 complete, Gates 1–4 in progress. DO NOT consider this doc deploy-attestation
> until the banner shows `DEPLOYED ✅`.**

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
| 3 | COR-002 | `27c0424` | milestones `assertProjectMembership`: same fix as COR-001 | **behavioral** — 108 milestones; ADMIN-template role (code≠'ADMIN') exists |
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

_TBD-DEPLOY: anchor confirmation + backup path/size + pg_dump exit code._

---

## Gate 2 — Image build + container swap

- Prod: `git fetch && git checkout ce0c729` (detached HEAD convention).
- `docker compose -f docker-compose.prod.yml --env-file .env.production build api`.
- `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api` (swap).
- Verify `docker ps` → `orchestr-a-api-prod` running, new image id.

_TBD-DEPLOY: prod git HEAD after checkout + new image sha + container status._

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

_TBD-DEPLOY: per-smoke outputs._

---

## Gate 4 — Health + closure

- Public health: `curl -k https://localhost/api/health` → `{"status":"ok"}` 200.
- Logs: `docker logs --tail 100 orchestr-a-api-prod` → no unexpected stack / no 500 on touched paths.
- Counter rows post-deploy = Gate-0 capture on all touched tables → **UNCHANGED** (no delta mutates data).

_TBD-DEPLOY: health body + log scan + post-deploy counts._

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

_TBD-DEPLOY: outcome banner + gate-by-gate ledger (Verified / Inferred / Gap) appended at finalize._
