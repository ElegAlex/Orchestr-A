# PROD DEPLOY — STAGE 0 ASSESSMENT (2026-06-07)

Authorized cutover. Ships master HEAD `c47dd3f0` over prod `d54c2ddd` (api) / `693049cd` (web).

## Baseline (authoritative `deployments` table, NOT RELEASE_SHA/HANDOVER)
- Newest `deployments` row: `d54c2dddc8abde4bf73760186614dd612e86d500` @ 2026-06-06 14:38:38 by ab@. Matches RELEASE_SHA. No surprise post-d54c2ddd deploy.
- Web actually at `693049cd` (web-only deploys create no `deployments` row). Both prod SHAs are ancestors of HEAD.
- Box `/opt/orchestra` git: detached HEAD `693049c`, working tree clean (only untracked `.env*` backups + `scripts/backup-daily.sh`). `git checkout c47dd3f0` will be clean.

## Push delta (origin/master 33ac9395 → HEAD c47dd3f0): 20 commits, clean fast-forward
- 128 app files = security batches A–H (the "82 folds"); 1 migration `20260606213229_phase4c_checks_indexes_fk`; `docker-compose.prod.yml` (loopback rebind); `schema.prisma`; `.env*.example` (METRICS_TOKEN doc); backlog docs. **No gated code.**

## Migration gap = exactly ONE
- Applied set ends at `20260605201203`. `20260606213229` NOT applied (count=0).
- **Constraint violation pre-check (read-only, live data) — all 0:**
  events recurrenceDay/weekInterval, telework dayOfWeek, documents contentSha256,
  tasks/events/predefined_tasks time-order, project_members dates, audit_logs orphan actorId.
  → migration expected to apply clean. Formal throwaway dry-run still in STAGE 2.

## Config hardening deltas
- **CORS already done**: `.env.production` has `CORS_ORIGIN=https://orchestr-a.com` AND `ALLOWED_ORIGINS=https://orchestr-a.com`. API resolves `CORS_ORIGIN||ALLOWED_ORIGINS`; compose forwards `ALLOWED_ORIGINS`. No `.env` change needed — smoke-verify only.
- **METRICS_TOKEN absent** → must add (`openssl rand -hex 32`). New compose hard-requires it (`${METRICS_TOKEN:?}`) — api won't boot without it. Add BEFORE any compose command.
- **RELEASE_SHA** repin → `c47dd3f0...` (full 40) before build.

## Host nginx (edge) — `/etc/nginx/sites-available/orchestr-a` (symlinked enabled)
- 443 ssl block proxies `location / → http://127.0.0.1:8080`. Loopback rebind keeps edge working.
- **No HSTS.** Add (SEC-033 prescribed): `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;` in the 443 server block; `nginx -t` + reload.

## Firewall — 3 dormant `:8080` DROP rules (remove in STAGE 5, then re-verify refused)
- v4 INPUT `--dport 8080 DROP`; v4 DOCKER-USER `--ctorigdstport 8080 DROP`; v6 INPUT `--dport 8080 DROP`. (Nothing on 8443 — rebind closes both; verify.)

## Mechanics
- Migrate (proven): `docker-compose -f docker-compose.prod.yml --env-file .env.production run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"`
- Build: `docker-compose ... build api|web`; recreate: `docker-compose ... up -d`.
- Passwordless sudo OK. Stray `orchestra-api-run-*` containers (2wk/5wk) = leftover one-offs, out of scope.

## No HALT condition found. Proceeding STAGE 1 → 5.
