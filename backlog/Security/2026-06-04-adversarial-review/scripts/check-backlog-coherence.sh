#!/usr/bin/env bash
# scripts/check-backlog-coherence.sh
# CI gate: verifies that every BACKLOG.md task marked DONE/VERIFIED has a valid Closed_by SHA
# referenced by a commit message containing [closes <task-id>].
#
# Usage: ./scripts/check-backlog-coherence.sh [path-to-backlog.md]
#   - With an explicit argument, that path is checked (this is how CI invokes it).
#   - With NO argument, defaults to the BACKLOG.md sibling of this script's parent
#     directory, resolved relative to the script's own location (BASH_SOURCE), so the
#     default survives `cd`, symlinks, and repo reorganization. For this repo that
#     resolves to backlog/Security/2026-05-24-review-payloads/BACKLOG.md.
# Exit codes: 0 if all DONE/VERIFIED tasks are coherent, 1 if any violation.
#
# Task-ID regex: `[A-Z]+(?:-[A-Z]+)*-\d+` matches both single-segment IDs (SEC-001,
# DAT-002, OBS-001, PERF-001, TST-011) and multi-segment IDs (AUD-EMIT-001, TOOL-COH-001,
# USR-DEL-001, AUD-READ-001, TST-DB-001, TOOL-DEPLOY-001, CLAUDE-CFG-001). It subsumes the
# former `[A-Z]+-\d+|CLAUDE-CFG-\d+` alternation (TOOL-COH-001).
#
# ──────────────────────────────────────────────────────────────────────────────────────
# Retroactive closures — the anchor-commit pattern (TOOL-COH-002)
# ──────────────────────────────────────────────────────────────────────────────────────
# Rule 3 below requires the commit named in `Closed_by` to carry `[closes <id>]` in its
# message. For a DIRECT closure the fix commit itself carries the token. But sometimes a
# task is recognized as already-done after the fact — its scope was fully covered by an
# EARLIER commit closing a DIFFERENT task (e.g. OBS-008's scope was covered by 1ff6c9a,
# whose message says `[closes OBS-001]`, not `[closes OBS-008]`). That earlier commit
# cannot be edited, so it can never satisfy rule 3 for the retroactive task.
#
# Canonical mechanism: create an EMPTY anchor commit whose sole purpose is to host the
# `[closes <id>]` token, then point `Closed_by` at the anchor. The gate then passes
# unchanged — no special-casing here; the anchor IS a real commit with the right token.
#
# Worked example (real, on master):
#   git commit --allow-empty -m "chore(backlog): anchor OBS-008 retroactive closure [closes OBS-008]
#
#   Material fix was 1ff6c9a (OBS-001) ... This empty commit exists solely to satisfy the
#   coherence gate's rule that Closed_by must point to a commit whose message contains
#   [closes <id>]."
#   → anchor SHA 2188b3d; OBS-008.Closed_by = 2188b3d. (OBS-020 → bfc7a78 is a second precedent.)
# The anchor commit's body MUST name the upstream material-fix SHA so the trail stays auditable.
# See CLAUDE_SESSION_CONTRACT.md § "Retroactive closures" for the full procedure.

set -euo pipefail

# Resolve the script's own directory (canonicalizing idiom: survives cd / symlinks / sourcing).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKLOG="${1:-$SCRIPT_DIR/../BACKLOG.md}"
if [[ ! -f "$BACKLOG" ]]; then
    echo "ERROR: BACKLOG file not found at $BACKLOG" >&2
    exit 1
fi

# Extract tasks and their key fields. A task block starts with "### <ID> —".
# We parse: ID, Status, Closed_by.

python3 - <<'PYEOF' "$BACKLOG"
import re
import subprocess
import sys
from pathlib import Path

backlog_path = Path(sys.argv[1])
content = backlog_path.read_text()

# Anchor git operations to the BACKLOG's own directory so the no-arg default works from
# any cwd (git discovers the repo by walking up from here). Running from the repo root —
# how CI invokes the script — yields the identical repo, so this is non-regressive.
git_cwd = str(backlog_path.resolve().parent)

# Split into task blocks.
# `[A-Z]+(?:-[A-Z]+)*-\d+` matches single-segment (SEC-001) AND multi-segment
# (AUD-EMIT-001, TOOL-COH-001, CLAUDE-CFG-001) IDs — see header (TOOL-COH-001).
task_pattern = re.compile(r'^### ([A-Z]+(?:-[A-Z]+)*-\d+) — (.+)$', re.MULTILINE)
matches = list(task_pattern.finditer(content))

violations = []
checked = 0

for i, m in enumerate(matches):
    start = m.start()
    end = matches[i+1].start() if i+1 < len(matches) else len(content)
    block = content[start:end]
    task_id = m.group(1)

    status_match = re.search(r'\*\*Status:\*\*\s*(\S+)', block)
    closed_by_match = re.search(r'\*\*Closed_by:\*\*\s*(.+?)(?:\n|$)', block)

    status = status_match.group(1).strip() if status_match else "?"
    closed_by_raw = closed_by_match.group(1).strip() if closed_by_match else ""
    closed_by = closed_by_raw.split()[0] if closed_by_raw else ""

    # Only DONE / VERIFIED tasks need a SHA.
    if status not in ("DONE", "VERIFIED"):
        continue
    checked += 1

    # Closed_by must look like a SHA (7+ hex chars), not "(empty ...)" or similar.
    sha_re = re.compile(r'^[0-9a-f]{7,40}$')
    if not closed_by or not sha_re.match(closed_by):
        violations.append(f"  [{task_id}] Status={status} but Closed_by is missing/invalid: {closed_by_raw!r}")
        continue

    # The SHA must exist in git history.
    try:
        subprocess.run(["git", "cat-file", "-e", closed_by], check=True, capture_output=True, cwd=git_cwd)
    except subprocess.CalledProcessError:
        violations.append(f"  [{task_id}] Closed_by SHA {closed_by} does not exist in git history")
        continue

    # The commit message must contain [closes <task-id>] (case-insensitive).
    try:
        msg = subprocess.run(
            ["git", "log", "-1", "--format=%B", closed_by],
            check=True, capture_output=True, text=True, cwd=git_cwd
        ).stdout
    except subprocess.CalledProcessError:
        violations.append(f"  [{task_id}] Could not read commit message for {closed_by}")
        continue

    pattern = f"[closes {task_id.lower()}]"
    if pattern not in msg.lower():
        violations.append(f"  [{task_id}] Commit {closed_by[:8]} message does not contain '[closes {task_id}]'")

print(f"Checked {checked} DONE/VERIFIED task(s) for coherence.")

if violations:
    print(f"\n❌ {len(violations)} coherence violation(s):", file=sys.stderr)
    for v in violations:
        print(v, file=sys.stderr)
    sys.exit(1)

print("✅ All DONE/VERIFIED tasks have valid Closed_by SHAs referencing matching commits.")
PYEOF
