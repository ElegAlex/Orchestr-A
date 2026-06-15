# LIVE-VERIFY RESULTS — 2026-06-04 cycle (read-only live pass, 2026-06-07)

Resolves the 14 `NEEDS_LIVE_VERIFY` items in `LIVE-VERIFY-2026-06-07.md` against the **running** system.
Read-only: live prod (HTTP/SSH inspect-only), GitHub Actions introspection, compile-time RBAC resolution,
prod DB read-only `SELECT`. **No writes, no remediation, no token forge.** Secrets reported as presence/length only.

**Live environment observed**
- Public edge: **host nginx** (`/etc/nginx/sites-enabled/orchestr-a`, certbot-managed, out-of-repo) terminates TLS on `:443`
  for `orchestr-a.com`, proxies everything to `127.0.0.1:8080` = the compose nginx (`orchestr-a-nginx-prod`, published on
  `0.0.0.0:8080->80` / `0.0.0.0:8443->443`). Intended internal path: **client → host nginx (TLS) → compose nginx →
  api:4000 / web:3000** — BUT `:8080` is bound to all interfaces and **externally reachable over plaintext HTTP** (see
  BONUS: TLS-bypass).
- API container `orchestr-a-api-prod`: `NODE_ENV=production`, **TZ unset → UTC**.
- CI: `ci.yml`; last 60+ runs **fail at `lint` → "Check code formatting"**, so `e2e-smoke`/`e2e-tests` are **skipped**.

---

## Verdict table

| ID | Verdict | Evidence (live) | One-line fix (if real) |
|----|---------|-----------------|------------------------|
| **SEC-001** | **REAL** (TLS-floor sub-claim FALSE) | TLS terminated by out-of-repo host nginx (`sites-enabled/orchestr-a`, certbot); compose nginx remapped to 8080/8443. **Not captured in repo/IaC**. HSTS absent. BUT "weak ssl_protocols floor" is **false**: server-block `options-ssl-nginx.conf` include (`TLSv1.2 TLSv1.3`) overrides the http-level `TLSv1 TLSv1.1…`; live handshake = TLSv1.0/1.1 **REJECTED**, TLSv1.2 OK. | Capture the host nginx config in repo/IaC; add HSTS (see SEC-033). |
| **SEC-033** | **REAL** | `curl -skI https://orchestr-a.com` → **no `Strict-Transport-Security`** header from any layer (host nginx has zero `add_header`; helmet = API only; middleware/compose don't emit it). | Add `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;` at the host nginx `:443` server. |
| **SEC-032** | **FALSE-POSITIVE** | Host edge sets `proxy_set_header X-Forwarded-Proto $scheme` **before** the compose nginx → client value overwritten. Live spoof `-H "X-Forwarded-Proto: http"` → 200 OK, no redirect/effect. App only uses `trustProxy` for `req.ip` (throttle/audit), never protocol. | — |
| **SEC-063** | **REAL** (low sev) | Live response carries **both** `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'none'` — in fact **duplicated** (stale compose-nginx CSP + Next.js middleware nonce CSP). Conflicting framing; `frame-ancestors 'none'` is the stricter and is honored. | Drop `X-Frame-Options` (rely on `frame-ancestors`) and dedupe the CSP layering (see drift note). |
| **SEC-064** | **REAL** (low sev) | Compose nginx `limit_req zone=api_limit` only at `location /api`; `/`, `/_next/static`, server-level have none; host nginx has **no** rate-limit at all. API still has app-level NestJS throttle; static/frontend unthrottled at nginx. | Add a `limit_req`/`limit_conn` at server-level (or accept: low-risk static serving). |
| **OBS-001 / SEC-002** | **REAL** | `AUDIT_HASH_KEY` absent from CI e2e "Start Backend API" env; `assertAuditHashKey()` (main.ts:70, **all envs**) throws when absent, runs **before** `NestFactory.create()` (:87); `start`=`node dist/main` (no dotenv preload); real `.env` gitignored (only `*.example` tracked) → key genuinely undefined in CI → boot aborts. Currently **masked**: e2e skipped 60+ runs (lint/format gate fails first), so the step never executes. Same skip is why TST-001 went uncaught. | Add `AUDIT_HASH_KEY: <32+ char CI value>` to both e2e jobs' Start-Backend-API env (and fix the format-check failure). |
| **TST-001** | **REAL** (test is wrong) | `GET /api/clients` requires `clients:read`. Programmatic resolve: `BASIC_USER`(contributeur) `clients:read=false`, `OBSERVER_FULL`(observateur) `=true` (`clients:read` lives only in `PROJECT_STRUCTURE_READ`, which BASIC_USER omits). `permission-matrix.ts` is **correct** ("tous sauf BASIC_USER/contributeur"). `e2e/clients.spec.ts` Suite 6 (L657-678) asserts 200 for **all 6** incl. contributeur → contributeur actually gets **403**. | Fix the **test**: exclude `contributeur` from the all-roles-200 loop (or assert 403). |
| **SA-OBS-013** | **REAL** | `.env.production.example` and `scripts/init-env.sh` have **no `AUDIT_HASH_KEY`**; compose `:?`-requires it and main.ts boot-gates it. Live prod has it (manually added, len 64). Operator following the template/init-env.sh crash-loops on boot. | Add `AUDIT_HASH_KEY=$(openssl rand …)` (≥32) to `init-env.sh` + document in `.env.production.example`. |
| **SA-SEC-014** | **REAL** | Compose forwards only the **deprecated** `ALLOWED_ORIGINS` (L134), not canonical `CORS_ORIGIN` (L121-era). Live container sees `ALLOWED_ORIGINS=https://orchestr-a.com`, **`CORS_ORIGIN=<UNSET>`** — though `.env.production` defines both. Works only via the code's alias fallback (`CORS_ORIGIN \|\| ALLOWED_ORIGINS`); the documented canonical var is silently dropped. | Compose: pass `CORS_ORIGIN: ${CORS_ORIGIN:-${ALLOWED_ORIGINS}}` (or forward both). |
| **SA-SEC-018** | **FALSE-POSITIVE** (headline) / minor doc gap real | Live `.env.production`: `JWT_EXPIRES_IN=15m`, `JWT_ACCESS_TTL=15m`. Container sees `JWT_EXPIRES_IN=15m`, `JWT_ACCESS_TTL=<UNSET>` (compose doesn't plumb it). Code `JWT_ACCESS_TTL \|\| JWT_EXPIRES_IN \|\| '15m'` → **effective prod access TTL = 15m, not 7d**. Real-but-minor: `JWT_ACCESS_TTL` undocumented + set-in-env-but-unplumbed (dead config; removing `JWT_EXPIRES_IN` would silently jump to compose default 7d). | (minor) Document or remove `JWT_ACCESS_TTL`; if authoritative, plumb it through compose. |
| **DAT-014** | **REAL but minimal impact** (mechanism corrected) | 25 `CREATE INDEX` (0 `CONCURRENTLY`) confirmed. Correction: non-concurrent `CREATE INDEX` takes a **SHARE** lock (blocks writes, allows reads), **not** ACCESS EXCLUSIVE. Migration **already applied** in prod (`finished 2026-06-03 12:10`, not rolled back; indexes present; 92 `_idx` total) → won't re-run; fresh provisions start empty → negligible window. Prisma wraps migrations in a tx where `CONCURRENTLY` is **illegal**, and history is append-only → not a one-line swap. | (forward policy) Future index migrations on populated tables → separate non-transactional migration using `CONCURRENTLY`. |
| **COR-023** | **FALSE-POSITIVE** (latent) | `projects.service.ts:1230` `startOfDay.setHours(0,0,0,0)` (server-local). Live api container **TZ=UTC** (TZ unset, `date`→UTC, offset +0000) → `setHours == setUTCHours`; no discrepancy manifests. | (latent hardening) Optional `setUTCHours` to defend against a future TZ change. |
| **PER-059** | **FALSE-POSITIVE** (WONT-FIX) | `planning/page.tsx` uses module-level `dynamic(() => import(...), { ssr: false })`. Next.js 16.2.4 disallows `ssr:false` with `next/dynamic` in **Server Components** → removing `"use client"` breaks the build. Current code correctly keeps `"use client"` (builds/deploys fine). Proposed RSC conversion is invalid. | — (keep as-is) |

**Tally (14 findings = 10 REAL + 4 FALSE-POSITIVE; 13 table rows, since OBS-001/SEC-002 share a row):**
- REAL (10): SEC-001\*, SEC-033, SEC-063, SEC-064, OBS-001, SEC-002, TST-001, SA-OBS-013, SA-SEC-014, DAT-014\*
- FALSE-POSITIVE (4): SEC-032, SA-SEC-018, COR-023, PER-059
- `*` = real with a corrected/narrowed sub-claim (SEC-001 TLS-floor false; DAT-014 already-applied/low-impact).

---

## BONUS (not in the 14) — flagged during this pass

- **🔴 HIGH — plaintext HTTP TLS-bypass on `:8080`.** The compose nginx is published on **`0.0.0.0:8080->80`** (all
  interfaces, not loopback) and is **externally reachable**: `http://92.222.35.25:8080/` → 307 (DNS-independent),
  `GET :8080/api/health` → **200 `{"status":"ok"}`**, `POST :8080/api/auth/login` → **400** (endpoint live). The **entire
  app + API + login are served over unencrypted HTTP**, bypassing the host nginx TLS edge — credentials and JWTs travel in
  cleartext to any client that targets `:8080`. This is the concrete IaC-drift consequence of SEC-001 and the reason HSTS
  (SEC-033) cannot protect users. (`:8443->443` returns connection-refused — the compose nginx has no `:443` listener.)
  → In `docker-compose.prod.yml` bind to loopback (`127.0.0.1:8080:80`), drop the dead `8443:443`, and/or block `:8080`
  at the provider firewall so only the host nginx reaches it.
- **`/api/metrics` is OPEN in prod.** `METRICS_TOKEN` is **absent** from `.env.production` and **UNSET** in the api
  container, yet `GET https://orchestr-a.com/api/metrics` returns **HTTP 200 with real Prometheus data** (request counts,
  route inventory incl. `/api/auth/login` counts) with **no token / a bad token**. This is exactly SA-SEC-012's premise
  ("metrics endpoint fully open to any caller") materialized live. The guard is not binding (mechanism unconfirmed — the
  running container likely started without `METRICS_TOKEN`). → Provision `METRICS_TOKEN` and redeploy so the guard binds.
- **CSP layering drift.** The **live compose nginx still emits a static `unsafe-inline` CSP** (`add_header
  Content-Security-Policy …'unsafe-inline'… frame-ancestors 'none'`), but the **committed repo** `nginx/nginx.conf`
  removed it (SEC-CSP-001) in favour of the Next.js middleware nonce CSP. Result: **two CSP headers** live (nonce +
  unsafe-inline) — the box runs a stale nginx config. Redeploy the compose nginx to converge to the repo (single nonce CSP).
- **CI is red on master (lint/format).** `ci.yml` fails at `lint → Check code formatting` for 60+ consecutive runs,
  cascading to skip all e2e jobs. This masks OBS-001/SEC-002 and TST-001. → run `pnpm run format` + commit.

## Method notes / caveats
- TST-001 needs no live RBAC call: permissions are 100% compile-time (`ROLE_TEMPLATES[templateKey]`); resolved via `tsx`
  + cross-checked against `permission-matrix.ts`.
- OBS-001/SEC-002 boot-abort is **statically airtight** but not empirically logged this pass — the e2e step has been
  skipped for 60+ runs, so no CI run actually reached "Start Backend API".
- All prod access was inspect-only (`ss`, `nginx -T`, `printenv`, `date`, `SELECT`, `curl`). Secret values never read out
  (presence/length only).

---

# MITIGATION + HANDOFF — :8080 plaintext TLS-bypass (2026-06-07)

Closes the BONUS "🔴 HIGH — plaintext HTTP TLS-bypass on :8080" finding above. Three stages.

## STAGE 1 — DONE & VERIFIED (runtime firewall mitigation; the one authorized prod write)
The compose nginx published `0.0.0.0:8080->80` (and `0.0.0.0:8443->443`), externally reachable over **v4 and v6**
via the PREROUTING DNAT path *and* the `docker-proxy` `[::]:8080`/`0.0.0.0:8080` INPUT path. Box: ext iface `ens3`,
iptables `nf_tables` backend, no ufw/firewalld. Three scoped DROP rules (port 8080, `-i ens3` only — cannot match
`:22`/`:80`/`:443`, which are host-process INPUT, not container FORWARD):

```
sudo iptables  -I DOCKER-USER -i ens3 -p tcp -m conntrack --ctorigdstport 8080 -j DROP   # v4 DNAT/FORWARD path
sudo iptables  -I INPUT       -i ens3 -p tcp --dport 8080 -j DROP                         # v4 docker-proxy path
sudo ip6tables -I INPUT       -i ens3 -p tcp --dport 8080 -j DROP                         # v6 docker-proxy path (no v6 DNAT)
```

Pre-change snapshots on box: `/tmp/iptables.before` (80 lines), `/tmp/ip6tables.before` (30 lines).

Before → after (external curls from a real off-box client; DROP → timeout `000`):

| Check | Before | After |
|---|---|---|
| v4 `http://92.222.35.25:8080/api/health`  | 200 | **000 (blocked)** |
| v4 `http://92.222.35.25:8080/api/metrics` | 200 | **000 (blocked)** |
| v6 `http://[2001:41d0:404:200::42a]:8080/api/health`  | 200 | **000 (blocked)** |
| v6 `http://[2001:41d0:404:200::42a]:8080/api/metrics` | 200 | **000 (blocked)** |
| `https://orchestr-a.com/api/health` (legit edge) | 200 | **200** ✓ |
| `https://orchestr-a.com/` (app) | 307 | **307** ✓ |
| on-box `http://127.0.0.1:8080/api/health` (host-nginx path) | — | **200** ✓ |
| **SSH `:22`** | ok | **intact** (every post-insert SSH returned exit 0) |

Revert (if ever needed): `-D` each rule:
```
sudo iptables  -D DOCKER-USER -i ens3 -p tcp -m conntrack --ctorigdstport 8080 -j DROP
sudo iptables  -D INPUT       -i ens3 -p tcp --dport 8080 -j DROP
sudo ip6tables -D INPUT       -i ens3 -p tcp --dport 8080 -j DROP
```

⚠️ **Residual risk — persistence.** Rules are **runtime-only** (NOT saved to disk — that would be a 2nd prod write
beyond authorized scope). They survive Docker daemon restart + container recreation, but a **full host reboot drops
them and `:8080` silently re-exposes.** → Run the Stage-3 deploy **before any reboot**; if a delay is unavoidable,
the operator should persist them (`netfilter-persistent save`) or reboot only after the rebind ships.

⚠️ **Out of scope / still open.** Blocking `:8080` closes the *plaintext* path only. `https://orchestr-a.com/api/metrics`
**still returns 200** (rides the spared loopback host-nginx path) — separate **METRICS_TOKEN-unset** finding, NOT fixed here.

## STAGE 2 — DONE (clean fix, LOCAL only, NOT deployed)
Commit **`c47dd3f0`** (master, unpushed) — `docker-compose.prod.yml` only (+6/−2): bind both nginx port mappings to
loopback — `127.0.0.1:${HTTP_PORT:-80}:80` / `127.0.0.1:${HTTPS_PORT:-443}:443`. `docker compose config` renders
`host_ip=127.0.0.1` for both. Gate green: build ✓ (FULL TURBO — YAML not in turbo graph), lint ✓ (0 errors),
coherence ✓ (245 tasks), Prettier ✓ on the changed file (the master `format:check` reds are pre-existing, 40+ unrelated files).

## STAGE 3 — HALT (awaiting deploy-prod authorization)
The redeploy that applies the rebind (recreate the nginx container off `c47dd3f0`) is a separate **deploy-prod** step —
NOT performed (forbidden by this task). The Stage-1 firewall holds the exposure shut meanwhile (modulo the reboot caveat).
After the rebind deploys, the three firewall rules become **dormant** (no `0.0.0.0:8080` publish to match) and can be
removed with the `-D` commands above — harmless if left.
