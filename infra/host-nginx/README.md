# Host (edge) nginx — out-of-repo TLS terminator

This directory is the **versioned source of truth** for the host-level nginx that
sits in front of the Dockerized Orchestr'A stack in production. That nginx is
**not** part of the repo's `docker-compose.prod.yml`: it is a Debian-packaged
nginx installed directly on the VPS and managed by `certbot`. These files are a
**read-only mirror** captured from the live host so the edge config is reviewable
and reconstructable from git — they are not applied by any repo tooling.

## Why it lives outside the compose stack

TLS is terminated at the host, not in a container. Certbot (`authenticator =
nginx`, `installer = nginx`) edits the host nginx site file in place to wire up
the Let's Encrypt certificate and the HTTP→HTTPS redirect. Keeping a copy here
gives us: (1) an audit trail of the edge config, (2) a rebuild reference if the
VPS is ever re-provisioned, and (3) a diff target when the edge changes.

## Request topology

```
Internet
  │  https://orchestr-a.com  (and www.)
  ▼
host nginx  :443  ── TLS termination (Let's Encrypt, certbot)
  │            :80  → 301 redirect to https (else 404)
  │  proxy_pass (cleartext, HTTP/1.1)
  ▼
127.0.0.1:8080   compose `nginx` service  (loopback-only since the c47dd3f0
  │              cutover — :8080/:8443 are NOT world-exposed)
  ▼
api / web containers
```

The compose nginx binds to `127.0.0.1:8080`/`127.0.0.1:8443` only, so the host
nginx on `:443` is the sole public ingress. See the memory note
"Prod :8080 firewall mitigation — RESOLVED" for the loopback-rebind history.

## Files (live paths on the VPS)

| Repo file                     | Live path on host                                                         | Owner   |
| ----------------------------- | ------------------------------------------------------------------------- | ------- |
| `orchestr-a.conf`             | `/etc/nginx/sites-available/orchestr-a` (symlinked into `sites-enabled/`) | certbot |
| `options-ssl-nginx.conf`      | `/etc/letsencrypt/options-ssl-nginx.conf`                                 | certbot |
| `orchestr-a.com.renewal.conf` | `/etc/letsencrypt/renewal/orchestr-a.com.conf`                            | certbot |

Not mirrored (and must never be committed): the certificate material under
`/etc/letsencrypt/live|archive/orchestr-a.com/` (incl. `privkey.pem`),
`/etc/letsencrypt/ssl-dhparams.pem`, and the ACME account key under
`/etc/letsencrypt/accounts/`.

## Security posture (as captured)

- **HSTS**: `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  (2 years), `always`.
- **TLS floor**: `ssl_protocols TLSv1.2 TLSv1.3` via `options-ssl-nginx.conf`,
  included inside the `:443` server block so it overrides the weaker http-level
  default (`TLSv1 TLSv1.1 ...`) in `/etc/nginx/nginx.conf`. This is the
  resolution state of the SEC-001 "weak ssl_protocols floor" residue for the
  orchestr-a.com vhost.
- **Ciphers**: Mozilla intermediate profile (ECDHE/CHACHA20/AES-GCM).
- **Body limit**: `client_max_body_size 10M`.
- **Certificate**: Let's Encrypt (issuer `E8`), ECDSA key, SANs
  `orchestr-a.com` + `www.orchestr-a.com`, auto-renew 30 days before expiry.

## Capture provenance

Captured **read-only** from `debian@92.222.35.25` on 2026-06-07 (host nginx
`nginx/1.22.1`). The `# managed by Certbot` comments are preserved verbatim. No
prod state was modified during capture.

## Re-syncing this mirror (read-only)

```bash
ssh debian@92.222.35.25 'sudo -n cat /etc/nginx/sites-available/orchestr-a'        > orchestr-a.conf
ssh debian@92.222.35.25 'sudo -n cat /etc/letsencrypt/options-ssl-nginx.conf'      > options-ssl-nginx.conf
ssh debian@92.222.35.25 'sudo -n cat /etc/letsencrypt/renewal/orchestr-a.com.conf' > orchestr-a.com.renewal.conf  # then redact `account`
```

## Applying a change (manual, host-side — NOT done by repo tooling)

Edits to the live host files are made on the VPS, validated with `sudo nginx -t`,
then reloaded with `sudo systemctl reload nginx`. If you hand-edit
`options-ssl-nginx.conf` on the host, certbot will stop auto-updating it — prefer
letting certbot manage TLS params. Mirror any host change back into this
directory in the same change.
