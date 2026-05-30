# ORCHESTRA Remediation — Session Handover

## Context
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo). User: Alexandre, DSI CPAM 92 (communicates in French; code/docs in English). Read `CLAUDE_SESSION_CONTRACT.md` first. Master-only (no PRs). Prod = VPS (see memory `project_prod_server_access`).

## Current state
- **Prod deployed HEAD: `aae2768`** (SEC-031 users-list scope/payload deployed 2026-05-30). DB at 56 migrations, health OK.
- **Zero runtime delta undeployed.** Everything on master since (MTX + COH-003) is fixtures/docs — no production code or migration pending.
- BACKLOG coherence gate green for all DONE entries; `audit_logs` 5-layer defense-in-depth live in prod.

## Process learnings (the two load-bearing ones)
- **#15 — `@Global()` discovery before module wiring.** Before adding an `imports[]` to a NestJS module for an RBAC/audit service, check for `@Global()` first (`grep -r "@Global()" apps/api/src`). `RbacModule` is `@Global()`, so `PermissionsService` injects everywhere without an explicit import — adding one is a smell.
- **#17 — Operator-control invariant: no silent substitution, no auth forgery as a default.** When the operator picks an option from a surfaced menu, execution follows that pick. If mid-execution you judge another option better for a concrete reason, HALT and re-surface — do not substitute silently, even with good intent. (Origin: smoke-auth method on the 2026-05-29 micro-deploy.)

## Next
SEC-005 closed (`c198772`, `[closes SEC-005]`) — login enumeration killed: `validateUser` folds the disabled-account case into the same generic 401 (was a distinct `'Compte désactivé'`), and LOGIN_FAILURE `details` no longer carries the attempted-login plaintext (OBS-001 `attemptedEmail`→entityId subject kept). `pnpm test` 1723 green; `nest build` clean. **Auth e2e NOT run green** — pre-existing-red in the local dev-DB/dev-watch harness (not CI's seeded `orchestr_a_v2_e2e` + compiled `api start`); all 9 failures verified orthogonal to SEC-005 (SEC-03 role-shape/seed drift, SEC-05 throttle expects 429 but login is limit:30, SEC-04 refresh untouched, 6× web-UI timeouts — see SEC-005 Learnings). **Runtime delta undeployed:** `c198772` is auth-blocking, NOT auto-deployed — operator to authorize prod deploy (prod was `aae2768`). Scoped-out adjacency flagged: unknown-user timing oracle (null before bcrypt) — future constant-time hardening, not SEC-005. Also filed earlier this session: SEC-FE-001 TODO (`a259273`, SEC-004 frontend counterpart). Phase 5 SEC-005 done; operator to pick next direction / authorize deploy.
