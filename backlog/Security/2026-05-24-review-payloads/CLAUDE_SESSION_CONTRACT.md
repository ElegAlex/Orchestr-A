# CLAUDE_SESSION_CONTRACT.md — Session protocol for the ORCHESTRA Security Audit backlog

Read this file first. It defines how a session consumes `BACKLOG.md`.

## Core rules

1. **File scope is strict per task.** Implement only within the task's `File:` scope. If a fix genuinely needs an adjacent file, document why in the task entry — do not silently widen scope.

2. **A task closes only when the gate is green.** Gate = `tests + types + lint + build` all green. Run them before the closing commit. If any fail, fix before committing — never weaken a test or check to pass.

3. **History is append-only.** Do not retro-edit closed entries, prior commits, or the source audit (`audits/**`). Record corrections as new lines; the trail stays auditable.

4. **Ask only if genuinely ambiguous; otherwise execute.** When the task is clear, do it. When a real blocker or a decision the operator must own appears, HALT and surface it — do not guess and do not silently substitute your own choice for an operator's.

## Closing a task

- One commit carries the fix and `[closes <task-id>]` in its message, and sets the entry's `Status: DONE`.
- A follow-up sets `Closed_by:` to that commit's SHA (a commit cannot contain its own SHA).
- The CI gate `scripts/check-backlog-coherence.sh` enforces: every `DONE`/`VERIFIED` entry has a `Closed_by` SHA that exists in git and whose commit message contains `[closes <task-id>]`.
