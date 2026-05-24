#!/usr/bin/env bash
# scripts/check-backlog-coherence.sh
# CI gate: verifies that every BACKLOG.md task marked DONE/VERIFIED has a valid Closed_by SHA
# referenced by a commit message containing [closes <task-id>].
#
# Usage: ./scripts/check-backlog-coherence.sh [path-to-backlog.md]
# Exit codes: 0 if all DONE tasks are coherent, 1 if any violation.

set -euo pipefail

BACKLOG="${1:-backlog/Security/BACKLOG.md}"
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

# Split into task blocks
task_pattern = re.compile(r'^### ([A-Z]+-\d+|CLAUDE-CFG-\d+) — (.+)$', re.MULTILINE)
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
        subprocess.run(["git", "cat-file", "-e", closed_by], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        violations.append(f"  [{task_id}] Closed_by SHA {closed_by} does not exist in git history")
        continue

    # The commit message must contain [closes <task-id>] (case-insensitive).
    try:
        msg = subprocess.run(
            ["git", "log", "-1", "--format=%B", closed_by],
            check=True, capture_output=True, text=True
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
