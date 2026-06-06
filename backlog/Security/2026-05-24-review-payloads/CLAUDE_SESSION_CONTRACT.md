# CLAUDE_SESSION_CONTRACT.md — Session protocol for the ORCHESTRA Security Remediation backlog

Read this file first. It defines how a session consumes `BACKLOG.md`.

## Core rules

1. **File scope is strict per task.** Implement only within the task's `File:` scope. If a fix genuinely needs an adjacent file, document why in the task entry — do not silently widen scope.

2. **A task closes only when the gate is green.** Gate = `tests + types + lint + build` all green. Run them before the closing commit. If any fail, fix before committing — never weaken a test or check to pass.

3. **History is append-only.** Do not retro-edit closed entries, prior commits, or the source audit (`audits/**`). Record corrections as new lines.

4. **Ask only if genuinely ambiguous; otherwise execute.** When the task is clear, do it. When a real blocker or a decision the operator must own appears, HALT and surface it — do not guess and do not silently substitute your own choice for an operator's.

## Closing a task

- One commit carries the fix and `[closes <task-id>]` in its message, and sets the entry's `Status: DONE`.
- A follow-up sets `Closed_by:` to that commit's SHA (a commit cannot contain its own SHA). This same follow-up also updates `HANDOVER.md` §Next to reflect the new DONE state (and what, if anything, is now in flight) — folded into the closure, never a separate refresh session.
- The CI gate `scripts/check-backlog-coherence.sh` enforces: every `DONE`/`VERIFIED` entry has a `Closed_by` SHA that exists in git and whose commit message contains `[closes <task-id>]`.

## Picking next task

When starting a fresh session:
- If HANDOVER.md §Next contains a directive
  ("Next: <task-id> — <one-line>"), execute it: write the Claude Code
  prompt for that task.
- Otherwise (Pause state or state-only info), auto-pick the next TODO
  from BACKLOG.md by priority: lowest Phase first, then Blocked_by
  empty/satisfied, then Confidence (cross-validated > claude-only
  > codex-only), then Severity (blocking > important > nit > suggestion).
- Generate the Claude Code prompt directly (~10-30 lines). No menu of
  options, no halt-and-ask, no reconciliation preamble.

## Dev-DB hygiene (before any `prisma migrate dev`) — TOOL-DBSYNC-001

`migrate dev` reconciles ALL drift and aborts non-interactively. Two recurring
dev-only hazards block it (prod/`migrate deploy` are unaffected — deploy ignores drift):

1. **Untracked tables** (e.g. the former `_dat005_backup_*`): retire them with a
   dedicated **forward migration** (append-only), never a side `scripts/db/` DROP —
   an out-of-band drop leaves migration-history-vs-DB drift. The `_dat005_backup_*`
   net is retired by `20260603120000_drop_dat005_backup_tables`.
2. **"Migration … was modified after it was applied"** (checksum mismatch): the dev
   `_prisma_migrations.checksum` is stale vs the committed file. If `git diff HEAD`
   shows the file matches the commit, re-sync the dev row (dev metadata only):
   ```sh
   docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_v2 -c \
     "UPDATE _prisma_migrations SET checksum='<sha256 of migration.sql>' \
      WHERE migration_name='<name>';"
   ```

`migrate dev` needs `DATABASE_MIGRATION_URL` (datasource `directUrl`, the owner role);
in dev it equals `DATABASE_URL`: `set -a; . ./.env; set +a; export DATABASE_MIGRATION_URL="$DATABASE_URL"`.

## Accepted behaviors (intended design — audits MUST resolve these to ACCEPTED / WONT-FIX)

This section is read first by every security session, including reconcile/audit
passes. A finding (current or from a future adversarial audit) that re-asserts any
item below is **NOT a vulnerability**: resolve it to **ACCEPTED (intended design)**,
not blocking/important. Do **NOT** remediate, and do **NOT** tighten the named scope.

- **AB-001 — Org-wide READ of tasks, leaves/congés, and telework is INTENDED (operator decision 2026-06-06).**
  Orchestr'A is a planning tool where every authenticated user is meant to see
  everyone's tasks, leave, and telework. The near-universal read permissions
  `tasks:readAll` (21/26 templates), `leaves:readAll` (23/26), `telework:readAll`
  (23/26) — held down to `BASIC_USER` — are deliberate, NOT a broken-access /
  horizontal-privilege / IDOR bug.
  - **Covered read paths:** `GET /tasks/assignee/:userId`, `GET /leaves?userId=…`,
    `GET /telework?userId=…` (and the service `findAll` paths gated on the three
    `*:readAll` permissions above). Equivalent future findings → ACCEPTED.
  - **Resolves** the "broader exposure" flagged in SEC-030's notes (2026-06-04
    cycle) and the MANIFEST §Delta correction → ACCEPTED.
  - **Does NOT affect / does NOT accept:** SEC-030's actual fixes —
    `GET /leaves/balance/:userId` and `GET /skills/user/:userId` server-side
    managed-scope, and the `leaves:read_balance_any` grant — those target
    different, non-`*:readAll` endpoints and STAND. Also NOT accepted here: the
    user *directory* horizontal-scope findings (2026-05-24 `SEC-031` / `SEC-030`
    on `GET /users*`), and any WRITE/approve/modify scoping. Acceptance is **READ
    of the three planning domains only.**
