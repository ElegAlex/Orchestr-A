# CLAUDE_SESSION_CONTRACT.md — Session protocol for ORCHESTRA Security Audit remediation

This file defines how Claude Code consumes `BACKLOG.md` across fresh-start sessions. Every Claude Code session that picks up audit-remediation work MUST read this file first.

## At session start

1. **Read this file** (`CLAUDE_SESSION_CONTRACT.md`) entirely.
2. **Read `BACKLOG.md`** — the active backlog. Scan for tasks with `Status: IN_PROGRESS` (resumable from previous session). If any exist, prefer resuming them over picking new ones; read their `Learnings` field for context.
3. **Read the last 5 entries of `PROGRESS_LOG.md`** — institutional memory of what was done recently, what worked, what didn't.
4. **Read the source audit** if needed: `audits/2026-05-24-adversarial-review.md` (executive summary) + the per-agent JSON files in `audits/agents/`.

## Picking the next task

Apply these filters in order:
1. **Status:** TODO only (or IN_PROGRESS to resume).
2. **Phase order:** Do not pick from Phase N+1 if Phase N still has TODO/IN_PROGRESS tasks, UNLESS the BLOCKED_by field explicitly says otherwise (e.g., Phase 13 isolated findings can be picked alongside any phase).
3. **Blocked_by:** All listed dependencies must be DONE. If any are not, skip this task.
4. **Confidence:** Within a phase, prefer `cross-validated` tasks first, then `claude-only`, then `codex-only`.
5. **Severity:** Within equal confidence, prefer `blocking` over `important` over `nit` over `suggestion`.

## Execution protocol (mandatory order)

1. **Move task to IN_PROGRESS** in BACKLOG.md. Commit the BACKLOG.md change BEFORE writing any code, with message: `backlog: <task-id> in progress`. This is the resumability anchor — if the session crashes, the next session sees IN_PROGRESS.
2. **Read the task's `Description`, `Root cause`, `Code evidence`, `Suggested fix` literally.** Do not interpret loosely. Do not generalize. Do not "improve" beyond the scope.
3. **Implement the fix.** Stay within the **File** scope. If the fix requires touching adjacent files, document why in the `Learnings` field.
4. **Run the verification command.** If it is `TBD — ...`, write the verification logic (a test, an assertion, a manual check description) and run it. If the command/check passes, proceed. If it fails, fix and re-run.
5. **Run the FULL regression suite:** `pnpm test` and `pnpm test:e2e` (when applicable). If either fails, do not proceed.
6. **Commit the code change** with message format: `<task-id>: <short title> [closes <task-id>]`. Example: `SEC-001: enforce RBAC guard default + boot-assert in prod [closes SEC-001]`.
7. **Update BACKLOG.md:**
   - Status → `DONE`
   - Closed_by → the commit SHA from step 6
   - Learnings → any non-obvious finding during execution (optional but encouraged)
8. **Append to `PROGRESS_LOG.md`** a one-entry session record (see PROGRESS_LOG.md schema).
9. **Commit BACKLOG.md + PROGRESS_LOG.md** together with message: `backlog: <task-id> done`.
10. **Stop.** Do not pick another task. Leave the fresh-start guarantee for the next session.

## At session end (if stopping mid-task)

- Leave task as `IN_PROGRESS`.
- Update the `Learnings` field with: what was completed so far, what remains, any pitfalls encountered.
- Commit BACKLOG.md with message: `backlog: <task-id> wip — <one-line summary>`.
- Do NOT mark DONE prematurely.

## Forbidden actions

- ❌ Skip phases without explicit Blocked_by dependency analysis.
- ❌ Pick a task whose `Blocked_by` is not DONE.
- ❌ Mark a task DONE without the verification command passing.
- ❌ Modify the source audit files: `audits/2026-05-24-adversarial-review.md` and `audits/agents/*.json`. They are read-only source of truth.
- ❌ Combine multiple tasks in a single commit. One task = one commit minimum (refactoring sub-commits are fine but the task-closing commit is dedicated).
- ❌ Invent acceptance criteria not listed in the task. The criteria are the contract.
- ❌ Re-interpret the audit's `Description` or `Root cause` to "what it probably meant" — if it's ambiguous, write it in `Learnings` and stop, then ask the human.

## When the audit is wrong or outdated

If during execution Claude Code discovers:
- The finding is no longer reproducible (the bug was silently fixed in another commit since the audit)
- The finding is a false positive (audit misread the code)
- The finding interacts with another finding in a way the audit did not anticipate

…then DO NOT silently mark it DONE. Instead:
1. Set Status to `BLOCKED`.
2. Set Blocked_by to `"audit-revision-required"`.
3. Write the contradiction in `Learnings`.
4. Append a `PROGRESS_LOG.md` entry flagging this for human review.
5. Stop.

## Verification command failures

If the verification command fails after the fix is applied:
- Do not weaken the verification (i.e., do not modify the test to make it pass).
- Either improve the fix or escalate to BLOCKED with explanation.

## CI gate (mechanical enforcement)

The `scripts/check-backlog-coherence.sh` script (run by GitHub Actions on PR) enforces:
- Every task with `Status: DONE` or `VERIFIED` has a non-empty `Closed_by` SHA.
- Every `Closed_by` SHA exists in git history.
- Every closing commit message contains `[closes <task-id>]`.

Failing this CI gate blocks the PR. The gate is not a suggestion.
