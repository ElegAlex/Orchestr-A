# SEC-001 — live prod verification (read-only)

**Date:** 2026-06-04 · **Access:** read-only SSH + HTTPS client to prod (authorized, no writes) · **Domain:** orchestr-a.com (92.222.35.25, OVH VPS)

> **Resolution: applied in-place on 2026-06-04 (operator override of the append-only rule).** SEC-001 was patched across `findings.json`, `summary.json`, `clusters.json` (cluster L) and `report.md`: severity `blocking → important`, title/impact/fix reframed, counts recomputed (blocking 8 → 7, important 154 → 155), verdict_rationale + narrative corrected. This file is retained as the verification evidence of record.

## Verdict on SEC-001

The original finding (`severity: blocking`, "production would run entirely in plaintext, carrying JWTs and PII over the wire") is **FALSE as to live prod**. It is **accurate only about the committed artifact**: the repo `nginx/nginx.conf` (deployed as the inner container `orchestr-a-nginx-prod`, nginx:1.27-alpine, ports 8080/8443) has `listen 80` only — no `443 ssl`, no redirect, no HSTS.

**Prod terminates TLS correctly** at a host-level nginx (1.22.1, systemd, active) that sits in front and is NOT in version control.

## Evidence

| Check | Result |
|---|---|
| Live TLS on :443 | **YES** — `HTTP/1.1 307` over TLS, then app `/fr` |
| Certificate | Let's Encrypt (issuer CN=E8); `CN=orchestr-a.com`, SAN `orchestr-a.com`, `www.orchestr-a.com` |
| Validity | notBefore 2026-05-20 · notAfter 2026-08-18 (~75d left) |
| Auto-renew | `certbot.timer` active (next 2026-06-05 08:49 UTC); cert in `/etc/letsencrypt/live/orchestr-a.com/` |
| HTTP :80 | **301 → `https://orchestr-a.com/`** (redirect, not plaintext content) |
| HSTS | **ABSENT** — no `Strict-Transport-Security` header; no `add_header` HSTS in live config |
| `__Host-` refresh cookie | NOT tested — requires authenticated login; forging tokens forbidden / no app creds in scope. TLS already proven directly, so this corroboration is moot. Only unauthenticated cookie seen: `NEXT_LOCALE=fr; SameSite=lax`. |

## Live front-nginx config (host `nginx -T`, not in repo)

```
server_name orchestr-a.com www.orchestr-a.com;
listen 443 ssl;                                              # managed by Certbot
ssl_certificate     /etc/letsencrypt/live/orchestr-a.com/fullchain.pem;   # Certbot
ssl_certificate_key /etc/letsencrypt/live/orchestr-a.com/privkey.pem;     # Certbot
include /etc/letsencrypt/options-ssl-nginx.conf;            # TLSv1.2 TLSv1.3
location / { proxy_pass http://127.0.0.1:8080; }           # -> inner orchestra nginx container
# :80 server -> return 301 https://$host$request_uri;
```

## Live vs repo

- **Repo** `nginx/nginx.conf` → inner container (8080/8443), `:80` only. No TLS/redirect/HSTS.
- **Live host nginx 1.22.1** → owns :80/:443, certbot TLS, http→https 301, proxies to 127.0.0.1:8080. **Exists only on the box** (IaC/version-control drift).

## Re-scoped actions (replacing the "plaintext prod" blocker)

1. **HSTS missing (important).** Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on the :443 server (front nginx).
2. **Config drift (important).** The host TLS terminator is not in the repo or `docker-compose.prod.yml`. Capture it in version control / IaC so the edge is reproducible and reviewable.
3. **Minor — verify TLS floor.** Live `nginx.conf` http-context line sets `ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3` (POODLE-era default); the Certbot include sets `TLSv1.2 TLSv1.3`. Confirm the server context effectively disables TLSv1/1.1.
4. SEC-001 should be **downgraded from `blocking` → `important`** and re-titled to "TLS terminated by an out-of-repo host proxy; repo nginx.conf has no 443 block; HSTS absent" — not "plaintext prod".
