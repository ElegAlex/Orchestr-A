# NEEDS-LIVE-VERIFY — 2026-06-04 cycle (routed 2026-06-07)

14 findings whose truth depends on runtime / deploy / CI / TLS / nginx / prod-env state.
Per the cycle's `requires-live-verification` tag (capped at `important`), these are **NOT
rated or fixed from static evidence** — they need a SEPARATE read-only live pass (live prod
+ CI introspection), not performed in the 2026-06-07 LOCAL disposition pass. Status =
`NEEDS_LIVE_VERIFY` in BACKLOG.md (terminal-routed, not ambiguously open).

## TLS / HSTS / nginx (out-of-repo terminator — IaC drift)
- **SEC-001** — committed nginx.conf has no :443 TLS block; live TLS is terminated by an out-of-repo host nginx (IaC drift), HSTS absent. → verify the live terminator config.
- **SEC-033** — no Strict-Transport-Security header from nginx/web-middleware/helmet. → `curl -kI https://<prod>` to confirm absence, then decide the emit surface.
- **SEC-032** — nginx forwards client-supplied `X-Forwarded-Proto` ($http_x_forwarded_proto) vs `$scheme` (proto spoofing). → confirm against the live nginx.
- **SEC-063** — nginx `X-Frame-Options: SAMEORIGIN` vs CSP `frame-ancestors 'none'` (conflicting framing). → confirm both headers live.
- **SEC-064** — nginx rate-limit applies only to `/api`; `/` and `/_next/static` unthrottled. → confirm live nginx location blocks.

## CI / boot
- **OBS-001 / SEC-002** — `AUDIT_HASH_KEY` not set in CI e2e jobs → `assertAuditHashKey()` aborts API boot in e2e. → inspect `.github/workflows/*` CI env + a live CI run.
- **TST-001** — clients.spec.ts Suite 6 asserts HTTP 200 for `contributeur` on GET /api/clients, contradicting the permission matrix. Code-resolvable but gated on the live RBAC truth; reconcile which side is correct, then fix the test or the matrix.

## prod env templates / config
- **SA-OBS-013** — `AUDIT_HASH_KEY` absent from `.env.production.example` + `init-env.sh`.
- **SA-SEC-014** — docker-compose.prod.yml uses deprecated `ALLOWED_ORIGINS` vs canonical `CORS_ORIGIN`.
- **SA-SEC-018** — `JWT_ACCESS_TTL` undocumented in prod template (effective TTL 7d vs assumed 15m).
  (These three are doc/config edits but their *correctness* depends on the live prod env actually in use — verify the deployed values before editing the templates.)

## migration lock behaviour (already-applied)
- **DAT-014** — 25 `CREATE INDEX` (no CONCURRENTLY) in dat011_fk_indexes take ACCESS EXCLUSIVE locks. The migration already ran; this is a deploy-time lock-window concern for future re-runs / fresh provisions.

## code-ready, but runtime-gated
- **COR-023** — captureSnapshots() uses server-local midnight vs UTC. Fix is code-ready (setUTCHours, same as the folded COR-064) but the bug only manifests if the prod container TZ ≠ UTC (neither compose sets TZ). Verify the deployed TZ, then fold the one-line UTC fix if confirmed.
- **PER-059** — planning/page.tsx could drop `"use client"` to be an RSC; correctness of removing it is a Next.js build/hydration question (`next/dynamic ssr:false` at module level) that needs `pnpm run build` to settle. Refuter flipped it OPEN-FIXABLE→NEEDS-LIVE-VERIFY for exactly this reason.
