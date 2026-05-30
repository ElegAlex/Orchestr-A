# ORCHESTRA Audit Remediation — Session Handover

## Context
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo). User: Alexandre, DSI CPAM 92 (communicates in French; code/docs in English). Audit Cour des Comptes window S1 2026. Read `CLAUDE_SESSION_CONTRACT.md` first. Master-only (no PRs). Prod = VPS (see memory `project_prod_server_access`).

## Current state
- **Prod deployed HEAD: `aae2768`** (SEC-031 users-list scope/payload deployed 2026-05-30). DB at 56 migrations, health OK.
- **Zero runtime delta undeployed.** Everything on master since (MTX + COH-003) is fixtures/docs — no production code or migration pending.
- BACKLOG coherence gate green for all DONE entries; `audit_logs` 5-layer defense-in-depth live in prod.

## Process learnings (the two load-bearing ones)
- **#15 — `@Global()` discovery before module wiring.** Before adding an `imports[]` to a NestJS module for an RBAC/audit service, check for `@Global()` first (`grep -r "@Global()" apps/api/src`). `RbacModule` is `@Global()`, so `PermissionsService` injects everywhere without an explicit import — adding one is a smell.
- **#17 — Operator-control invariant: no silent substitution, no auth forgery as a default.** When the operator picks an option from a surfaced menu, execution follows that pick. If mid-execution you judge another option better for a concrete reason, HALT and re-surface — do not substitute silently, even with good intent. (Origin: smoke-auth method on the 2026-05-29 micro-deploy.)

## Next
TST-MTX-001 (`81da4c9`) and TOOL-COH-003 (`bb89f40`) closed — both test-fixture/docs-only. SEC-031 deployed (prod `aae2768`, 2026-05-30); zero runtime delta pending. Nothing in flight. Pause — operator-pending. Phase 4 complete, prod aae2768, zero runtime delta. Operator to pick next direction.
