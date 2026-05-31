# Production Deploy Runbook

Operational reference for redeploying ORCHESTR'A to the production VPS. Derived from the
procedure as **actually practised** across the SEC-004..SEC-010 era validation/code-only
prod deploys (SEC-005, SEC-006+SEC-013, SEC-007, SEC-009, SEC-014, SEC-019, SEC-021), all
recorded in `backlog/Security/2026-05-24-review-payloads/HANDOVER.md`, plus the canonical
scripted path `scripts/deploy-prod.sh` and the live `docker-compose.prod.yml`.

> This is operational doc, not a remediation task — no code, no backlog entry. Every command
> below was verified against the real repo/compose/script or against a recorded deploy.
> Anything not verifiable against a primary source is marked **UNVERIFIED**.

## Two deploy shapes

- **Full scripted deploy** — `scripts/deploy-prod.sh [git-ref]`. Builds **all** services,
  pins the release, brings the whole stack up. Use for first install, multi-service changes,
  or whenever a migration must run. This script is the honest replacement for the removed
  theatrical `.github/workflows/deploy.yml` (OBS-012); it runs **on the VPS, by the operator**.
- **Code-only API micro-deploy** — the shape the SEC-004..010 deploys actually used: a single
  `api` image rebuild + container swap (`build api` → `up -d --no-deps api`) + smokes, **no
  migration**. The steps below document this shape explicitly because it is what was practised;
  it deviates from the script only in that it rebuilds/swaps the `api` service alone.

Both run from `/opt/orchestra` on the VPS (`debian@92.222.35.25`, SSH key auth; see memory
`project_prod_server_access`). Prod host runs `Etc/UTC` and has **no `psql`/`pg_dump` on the
host** — all Postgres ops run inside the db container via `docker exec`.

## Facts that make every command below work

- **Compose file (the #1 gotcha):** `api`, `web`, `nginx`, `certbot` live **only** in
  `docker-compose.prod.yml`. The default `docker-compose.yml` defines **only** `postgres` and
  `redis` (dev). So **every** compose command needs `-f docker-compose.prod.yml`, or it fails
  `no such service: api`. (Verified: `docker-compose.yml` has no `api` service;
  `docker-compose.prod.yml:86` does.)
- **`--env-file` is mandatory:** there is no ambient `.env` at `/opt/orchestra`. Omitting
  `--env-file .env.production` silently drops every secret — and several compose vars are
  `:?required` (e.g. `DATABASE_PASSWORD`, `JWT_SECRET`, `ALLOWED_ORIGINS`), so the command
  fails or boots a broken container. (Verified: `docker-compose.prod.yml:10,120,124`.)
- **Container / DB names (prod):** api `orchestr-a-api-prod`, web `orchestr-a-web-prod`, db
  `orchestr-a-postgres-prod`, nginx `orchestr-a-nginx-prod`. DB `orchestr_a_prod`, app DB user
  `orchestr_a` (from `.env.production`; compose default is `postgres`). Public URL
  `https://orchestr-a.com`. (Verified: compose `container_name:` + HANDOVER deploy records.)
- **Standard invocation prefix** used throughout (abbreviated `CMP` below):
  ```bash
  docker compose -f docker-compose.prod.yml --env-file .env.production
  ```

---

## 1. Pre-flight (read-only on prod)

1. **Confirm prod git HEAD** matches the baseline you expect — no out-of-band deploy:
   ```bash
   cd /opt/orchestra && git rev-parse HEAD
   ```
2. **Confirm the live RELEASE_SHA** the running container actually booted with:
   ```bash
   docker exec orchestr-a-api-prod printenv RELEASE_SHA
   ```
3. **Fast-forward git to the deploy target** (the SEC deploys checkout a **detached HEAD** at
   the exact deployed SHA, so prod git HEAD == the runtime SHA):
   ```bash
   git fetch origin --tags --prune
   git checkout --detach <target-sha>      # or origin/master
   git rev-parse HEAD                       # record this — it is RELEASE_SHA
   ```
   > `prod git SHA ≠ origin/master HEAD` is **expected**, not drift: docs-only commits land on
   > master after the deploy point and are deliberately not redeployed.
4. **Tag the current running image as the rollback anchor — by image id**, so it survives the
   `:latest` move at swap time:
   ```bash
   RUNNING_ID=$(docker inspect --format '{{.Image}}' orchestr-a-api-prod)
   docker tag "$RUNNING_ID" orchestra-api:pre-<task>     # e.g. pre-sec009
   docker image inspect orchestra-api:pre-<task> >/dev/null && echo TAGGED_OK
   ```
   (Practised at every SEC deploy: `pre-sec007`, `pre-sec009`, `pre-sec014`, `pre-sec019`,
   `pre-sec021`, each pinning the prior image by id.)
5. **Optional belt-and-suspenders DB backup** (cheap; taken even on no-migration deploys for
   audit-trail consistency — ~400–430 KB compressed in practice):
   ```bash
   docker exec orchestr-a-postgres-prod pg_dump -U orchestr_a orchestr_a_prod \
     | gzip > backups/pre-<task>-$(date -u +%Y%m%d-%H%M%S).sql.gz
   ```

---

## 2. The RELEASE_SHA lesson — repin BEFORE build/up

`RELEASE_SHA` is a **runtime `environment:` var** interpolated from `.env.production`
(`RELEASE_SHA: ${RELEASE_SHA:-unknown}`, `docker-compose.prod.yml:142`), **not** a baked
build-arg (the API Dockerfile has no `RELEASE_SHA` reference). On boot the API's
`DeploymentsService` hook reads this env var and writes one `deployments` row + one
`RELEASE_DEPLOYED` audit row recording which release is live (the compose comment at
`:137-144` documents this; it answers "which release was running when leave Z was approved").

**Therefore: repin `RELEASE_SHA` in `.env.production` BEFORE `build`/`up`**, so the very first
boot records the correct SHA — no recreate-dance:

```bash
# upsert RELEASE_SHA / DEPLOYED_BY / DEPLOY_ENVIRONMENT in .env.production
sed -i "s|^RELEASE_SHA=.*|RELEASE_SHA=$(git rev-parse HEAD)|" .env.production   # or append if absent
```
`scripts/deploy-prod.sh` does exactly this in step [2/5] (`upsert_env`) and is the safest way
to get it right.

**Why this matters (the drift incident).** On the **SEC-006 + SEC-013** grouped deploy
(2026-05-31) the operator repinned `.env.production` *after* `up`. The first boot (11:31) still
injected the **previous** SHA (`5d530b3`), so the boot-time `RELEASE_DEPLOYED` audit recorded
the wrong release for the new code. It had to be corrected with a no-rebuild
`up -d --no-deps api` recreate (a fresh 11:46 row then read the correct `9b528d9`); the stale
11:31 row stays (audit is append-only). From **SEC-007 onward every deploy repinned BEFORE
build**, and the first boot's provenance was correct first-time — no recreate needed.
(Source: HANDOVER §SEC-006+013 "RELEASE_SHA ordering lesson" and §SEC-007.)

---

## 3. Build → swap (code-only API micro-deploy)

No migration is the **default** for validation / code-only changes (all SEC-004..010 deploys
were no-migration). Build the api image source-baked, then swap just the api container:

```bash
CMP="docker compose -f docker-compose.prod.yml --env-file .env.production"
$CMP build api          # source-baked image; run in background + watch to completion
$CMP up -d --no-deps api
```

- `--no-deps` swaps **only** `api` without touching `postgres`/`redis`/`web`/`nginx`. This is
  the exact form recorded at SEC-007/009/014/019/021. (`api` `depends_on` postgres+redis at
  `service_healthy`; `--no-deps` skips the dep-recreate since they are already up and healthy.)
- After `up`, **poll to healthy** before smoking (compose healthcheck hits
  `http://127.0.0.1:4000/api/health`; `start_period` 90s):
  ```bash
  docker inspect --format '{{.State.Health.Status}}' orchestr-a-api-prod   # want: healthy
  ```
- **Confirm the running image changed** (new id ≠ the anchor you tagged in §1.4):
  ```bash
  docker inspect --format '{{.Image}}' orchestr-a-api-prod
  ```

### When a migration IS needed

Prisma migrations apply automatically: the **API entrypoint runs `prisma migrate deploy` on
boot**, so a plain `up -d` triggers them (`scripts/deploy-prod.sh:89-91`). For a migration
deploy, prefer the full `scripts/deploy-prod.sh` (or `$CMP up -d` without `--no-deps`) and make
sure **`DATABASE_MIGRATION_URL` (the owner role)** is set — compose builds it from
`DATABASE_USER`/`DATABASE_PASSWORD` (`docker-compose.prod.yml:103-112`, TOOL-DEPLOY-001 role
split). The restricted runtime role `app_user` (`DATABASE_URL`) cannot run DDL. **UNVERIFIED:**
no SEC-004..010 deploy in the record exercised a migration, so the migration path here is
derived from the script/compose, not from an observed prod migration run.

---

## 4. Smoke-token recipe (forged HS256 JWT)

For authenticated GET smokes without holding an app password, forge a short-lived HS256 token
signed with the **prod `JWT_SECRET`**. This works because `JwtStrategy.validate()` re-fetches
the user from the DB by `payload.sub` and resolves role/permissions server-side — the token's
`role` claim is cosmetic, and omitting `jti` skips the blacklist check (HANDOVER §SEC-019/030).
**Keep all smokes read-only (GET); mutate nothing on prod.**

The recorded deploys minted the token with **Node's built-in `crypto`** inside the api
container, because the bundled image has **no resolvable `jsonwebtoken`** for a bare
`docker exec … node -e` (verified premise, 2026-05-29 micro-deploy log). An **openssl** form
avoids needing node at all and is the recommended recipe below.

```bash
# On the VPS. Read the secret from the container env (never echo it into a transcript).
SECRET=$(docker exec orchestr-a-api-prod printenv JWT_SECRET)
SUB="<real-active-user-id>"                       # users.id of a real account
NOW=$(date -u +%s); EXP=$((NOW + 600))            # 10 min TTL

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
HEADER=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
PAYLOAD=$(printf '%s' "{\"sub\":\"$SUB\",\"iat\":$NOW,\"exp\":$EXP}" | b64url)
SIG=$(printf '%s' "${HEADER}.${PAYLOAD}" | openssl dgst -sha256 -hmac "$SECRET" -binary | b64url)
TOKEN="${HEADER}.${PAYLOAD}.${SIG}"

curl -ks https://orchestr-a.com/api/auth/me -H "Authorization: Bearer $TOKEN"
```

> **Verified:** the openssl `HMAC-SHA256` + base64url construction above produces a signature
> an independent HMAC verifier accepts (tested locally, `sig_match True`). The base64url step
> (`+/`→`-_`, strip `=`) is required — JWT uses URL-safe base64 without padding.

Auth-method discipline (process learning #17): before any **behavioral** smoke, surface the
auth method to the operator and let them pick — (a) operator-provided app credentials via
`POST /api/auth/login`, (b) code-presence only, or (c) explicitly authorized ephemeral forge.
Do not default to forging silently. (SEC-031 used (a); SEC-019/030 used (c) with authorization.)

---

## 5. Rollback

No-migration deploys roll back by retagging the anchor and recreating — no DB to undo:

```bash
CMP="docker compose -f docker-compose.prod.yml --env-file .env.production"
docker tag orchestra-api:pre-<task> orchestra-api:latest
sed -i "s|^RELEASE_SHA=.*|RELEASE_SHA=<previous-sha>|" .env.production   # repin to prior release
$CMP up -d --no-deps api
git checkout --detach <previous-sha>                                     # if the checkout advanced
curl -ks https://orchestr-a.com/api/health                              # expect {"status":"ok"}
```

Recorded form at every SEC deploy: "rollback = repin RELEASE_SHA + `up -d` that tag (no
migration to undo)". The Gate-1 `pg_dump` is the belt-and-suspenders copy if a migration *was*
applied. **UNVERIFIED:** rollback was never exercised in the recorded deploys (all succeeded);
the path is documented from the HANDOVER rollback notes, not from an observed rollback.

---

## 6. Post-deploy verification + handover

1. **Public health:**
   ```bash
   curl -ks https://orchestr-a.com/api/health        # {"status":"ok"}
   ```
2. **Runtime RELEASE_SHA reads the deployed SHA:**
   ```bash
   docker exec orchestr-a-api-prod printenv RELEASE_SHA   # == git rev-parse HEAD on prod
   ```
3. **Boot `RELEASE_DEPLOYED` audit reads the deployed SHA** (the newest row; in SQL via the db
   container — the host has no `psql`):
   ```bash
   docker exec orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod -c \
     "SELECT \"releaseSha\",\"deployedAt\",\"deployedBy\" FROM deployments ORDER BY \"deployedAt\" DESC LIMIT 1;"
   ```
   Both must equal the deployed SHA. If they read a stale SHA, you repinned too late — see §2;
   correct with a no-rebuild `up -d --no-deps api` recreate (the stale row stays, append-only).
4. **Log scan** for errors on the new image (`--tail 200`, filter
   `error|exception|500|unhandled|stacktrace`) — expect only the boot `RELEASE_DEPLOYED` /
   `Deployments` entries:
   ```bash
   docker logs --tail 200 orchestr-a-api-prod
   ```
5. **Counter invariant** for code-only deploys: row counts on touched tables and
   `_prisma_migrations` count should be identical pre/post (read-only smokes mutate nothing).
6. **Update `HANDOVER.md` §Next** — prod before→after git HEAD, RELEASE_SHA, api image id,
   rollback anchor tag, and the smoke evidence. This is a **separate** docs commit, not part of
   the deploy.

---

## Known leftovers (cosmetic, carried)

- Stray `orchestra-api-run-*` / `docker compose run` containers may linger on the box — **not**
  the live service (`orchestr-a-api-prod`); harmless, prune in a maintenance pass.
- A forged-smoke script written into the api container's **read-only** rootfs overlay cannot be
  `rm`'d (denied even as root); it is never imported (entry is `dist/main`) and is discarded on
  the next container recreate.
