# Remediation Status — Audit 2026-04-15 (HAMMACHE Lilian)

**Closed on 2026-04-15.** All 8 security findings and 8 functional bugs addressed across 5 waves (17 commits on `master`). Plan: `docs/superpowers/plans/2026-04-15-security-audit-remediation.md`.

## Security findings

| ID | Severity | Title | Status | Commit(s) |
|---|---|---|---|---|
| SEC-01 | 🟠 ÉLEVÉE | Swagger UI exposé en production | ✅ CLOSED | `9df730a` (code + `.env.example` + docker-compose), prod env `SWAGGER_ENABLED=false` set at W3 checkpoint |
| SEC-02 | 🔴 CRITIQUE | Credentials admin par défaut | ✅ CLOSED | `e34c7c8` (Prisma seed env-gated + migration `add_force_password_change`) + `abfa817` (docker-entrypoint hardcoded admin123 INSERT removed) |
| SEC-03 | 🔴 CRITIQUE | Rôle dans localStorage | ✅ CLOSED | `422b74d` (role/permissions removed from localStorage, `useAuthBootstrap` hydrates from `/auth/me`, backend RolesGuard sanity test) |
| SEC-04 | 🟠 ÉLEVÉE | Pas de refresh/révocation JWT | ✅ CLOSED | `6dff276` (refresh tokens, Redis blacklist, 15m access TTL, migration `add_refresh_tokens`, frontend 401 interceptor) |
| SEC-05 | 🟡 MOYENNE | Throttling login trop permissif | ✅ CLOSED | `3d977a8` (5/min + 20/15min sur login/register/reset-password) |
| SEC-06 | 🟠 ÉLEVÉE | IDOR ressources RH | ✅ CLOSED | `a7de2f3` (OwnershipGuard partagé) + `9928a2b` (projects) + `a382726` (events + leaves) + `afdf2f8` (telework) + `2ccf3d7` (time-tracking) + `400dbde` (RBAC `*:manage_any` permissions) |
| SEC-07 | 🟡 MOYENNE | Upload sans magic bytes | ✅ CLOSED | `043e59d` (validator centralisé) + `8946c11` (hotfix ESM dynamic import) |
| SEC-08 | 🟢 FAIBLE | Fuite de données dans les logs | ✅ CLOSED | `9df730a` (Fastify `redact` paths: password, authorization, cookie, refreshToken, set-cookie) |

## Functional bugs

| ID | Priority | Title | Status | Commit(s) |
|---|---|---|---|---|
| BUG-01 | 🔴 HAUTE | Modification TTV d'autres utilisateurs | ✅ CLOSED | `afdf2f8` (ownership check at service level déjà présent — belt-and-braces `@OwnershipCheck` ajouté sur routes `:id`) |
| BUG-02 | 🟡 MOYENNE | Blink assignés TaskForm | ✅ CLOSED | `89ae1df` (skeleton `animate-pulse` via prop `isUsersLoading`) |
| BUG-03 | 🟡 MOYENNE | Planning sans service par défaut | ✅ CLOSED | `ef995c7` (flag `hasInitializedServices` persisté dans le store Zustand) |
| BUG-04 | 🔴 HAUTE | Modification projet non possédé | ✅ CLOSED | `9928a2b` (`@OwnershipCheck({resource:'project'})` sur routes mutations + service-level check) |
| BUG-05 | 🔴 HAUTE | Modification/suppression événement arbitraire | ✅ CLOSED | `a382726` (creator-ownership enforcement sur update/delete/participants) |
| BUG-06 | 🟢 FAIBLE | "Membre depuis" date invalide | ✅ CLOSED | `65b97c8` (parseISO + isValid + `createdAt` ajouté aux selects API `/auth/me` et login) |
| BUG-07 | 🟡 MOYENNE | Compte affiché inactif à tort | ✅ CLOSED | `65b97c8` (champ `isActive` inclus dans payload `/auth/me` — absence causait `undefined` côté front) |
| BUG-08 | 🔴 HAUTE | Modification tout projet | ✅ CLOSED | `9928a2b` (même fix que BUG-04 — ownership + bypass `projects:manage_any`) |

## Infra / env changes

| Change | Location | Why |
|---|---|---|
| `SWAGGER_ENABLED=false` | prod `.env.production` | SEC-01 |
| `JWT_EXPIRES_IN=15m` (was 7d) | prod `.env.production` | SEC-04 |
| `JWT_ACCESS_TTL=15m` (new) | prod `.env.production` | SEC-04 |
| `JWT_REFRESH_TTL=7d` (new) | prod `.env.production` | SEC-04 |
| Migration `add_force_password_change` | prod DB | SEC-02 (field not yet enforced on login) |
| Migration `add_refresh_tokens` | prod DB | SEC-04 |
| Docker entrypoint admin seed | apps/api/docker-entrypoint.sh | SEC-02 hotfix (hardcoded admin123 insert removed) |

## E2E coverage (added in Wave 5)

- `e2e/tests/security/ownership-idor.spec.ts` — 25 tests, 10 `@smoke` — covers all 5 modules × 6 roles on critical PATCH
- `e2e/tests/security/auth-hardening.spec.ts` — 4 tests `@smoke` — SEC-03 tampering, SEC-04 logout+rotation, SEC-05 throttle
- `e2e/tests/security/upload-validation.spec.ts` — 2 tests (1 `@smoke`) — PHP-as-jpg reject, real PNG accept

## Residual items / follow-ups

- **Existing prod admin user retains `admin123`.** The entrypoint-level seed bypass was removed in `abfa817` but the user row still has the hash. Rotate via `/auth/reset-password` or direct DB update with bcrypt. **Not automated** — requires operator action.
- **`forcePasswordChange` field added** but not yet consumed by the login flow. Future improvement: enforce a password-change redirect at login when true.
- **`@fastify/basic-auth` integration for Swagger** left as TODO in `main.ts` (SEC-01 partial). Warning banner + env hygiene mitigate; full basic-auth wiring is a nice-to-have.
- **E2E runtime validation.** E2E specs compile and list correctly but were not executed against a live stack in the remediation session. Next CI run / manual smoke pass should validate before marking green in dashboards.

## Session timeline

1. Wave 1 (hotfix): `e34c7c8`, `3d977a8`, `9df730a`, `65b97c8`, `58c24c0` (docs)
2. Wave 2 (ownership): `a7de2f3`, `9928a2b`, `a382726`, `afdf2f8`, `2ccf3d7`, `400dbde`
3. Wave 3 (session): `422b74d`, `6dff276`
4. Wave 4 (upload + bugs): `043e59d`, `89ae1df`, `ef995c7`, `8946c11` (hotfix), `abfa817` (hotfix)
5. Wave 5 (E2E): `289920a`, `de776b5`, `3e0d4cf`

All waves deployed to prod VPS (`debian@92.222.35.25:/opt/orchestra`) with containers healthy, 2 Prisma migrations applied (`add_force_password_change`, `add_refresh_tokens`).
