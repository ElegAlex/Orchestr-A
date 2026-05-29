#!/usr/bin/env bash
# scripts/check-permission-matrix-coverage.sh
# CI gate (TST-001): verifies that the E2E permission matrix
# (e2e/fixtures/permission-matrix.ts) declares an `action:` entry for EVERY
# permission code declared via @RequirePermissions(...) across apps/api/src.
#
# Rationale: CLAUDE.md mandates all 6 roles tested against all sensitive
# endpoints. The matrix is the data source for e2e/tests/rbac/api-permissions.spec.ts.
# Without this gate, a new controller can declare a @RequirePermissions code with
# no corresponding matrix entry and the RBAC coverage silently regresses (TST-001).
#
# Usage: ./scripts/check-permission-matrix-coverage.sh [repo-root]
#   - With no argument, the repo root is discovered via `git rev-parse --show-toplevel`
#     (falls back to four levels up from this script: scripts → review-payloads →
#     Security → backlog → repo root). Survives cd / symlinks.
#   - CI may pass the repo root explicitly.
# Exit codes: 0 if the matrix covers every controller code, 1 if any code is uncovered.
#
# Extraction contract (MUST match how a human would enumerate the codes):
#   - Source: every @RequirePermissions(...) in apps/api/src, EXCLUDING
#     rbac/decorators/require-permissions.decorator.ts (the decorator definition +
#     its JSDoc examples) and main.ts (prose mentioning the decorator name).
#   - @RequirePermissions accepts MULTIPLE codes (AND-semantics), e.g.
#     @RequirePermissions('clients:read', 'projects:read') — each quoted code counts.
#   - Matrix codes: every `action: "<code>"` literal in permission-matrix.ts.
# The diff is uni-directional by design: the gate FAILS on controller codes absent
# from the matrix (coverage gap). Matrix `action:` values with no controller code are
# reported as an informational note (drift hygiene) but do NOT fail the gate — the
# matrix is, and must remain, a clean subset/superset relative to the 6-role e2e runner.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${1:-}" ]]; then
    REPO_ROOT="$1"
elif REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
    :
else
    REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
fi

API_SRC="$REPO_ROOT/apps/api/src"
MATRIX="$REPO_ROOT/e2e/fixtures/permission-matrix.ts"

if [[ ! -d "$API_SRC" ]]; then
    echo "ERROR: API source dir not found at $API_SRC" >&2
    exit 1
fi
if [[ ! -f "$MATRIX" ]]; then
    echo "ERROR: permission matrix not found at $MATRIX" >&2
    exit 1
fi

python3 - "$API_SRC" "$MATRIX" <<'PYEOF'
import re
import sys
from pathlib import Path

api_src = Path(sys.argv[1])
matrix_path = Path(sys.argv[2])

# ── 1. Controller codes from @RequirePermissions(...) ───────────────────────
EXCLUDE_NAMES = {"require-permissions.decorator.ts", "main.ts"}
# Match @RequirePermissions( ... ) on a single line, capture the argument list,
# then pull every single-quoted code from it (handles multi-arg AND decorators).
call_re = re.compile(r"@RequirePermissions\(([^)]*)\)")
code_re = re.compile(r"'([^']+)'")

controller_codes = set()
for ts in api_src.rglob("*.ts"):
    if ts.name in EXCLUDE_NAMES:
        continue
    text = ts.read_text(encoding="utf-8")
    for args in call_re.findall(text):
        for code in code_re.findall(args):
            controller_codes.add(code)

# ── 2. Matrix actions from `action: "<code>"` ──────────────────────────────
matrix_text = matrix_path.read_text(encoding="utf-8")
action_re = re.compile(r'action:\s*"([^"]+)"')
matrix_actions = set(action_re.findall(matrix_text))

# ── 3. Diff ────────────────────────────────────────────────────────────────
uncovered = sorted(controller_codes - matrix_actions)   # controller code, no matrix entry → FAIL
matrix_only = sorted(matrix_actions - controller_codes)  # matrix entry, no controller code → note

print(f"Controller @RequirePermissions codes : {len(controller_codes)}")
print(f"Matrix distinct action: entries       : {len(matrix_actions)}")
print(f"Uncovered controller codes            : {len(uncovered)}")

if matrix_only:
    print(f"\nℹ️  {len(matrix_only)} matrix action(s) with no matching controller code "
          f"(informational, not a failure):")
    for a in matrix_only:
        print(f"    - {a}")

if uncovered:
    print(f"\n❌ {len(uncovered)} controller permission code(s) NOT covered by the "
          f"permission matrix:", file=sys.stderr)
    for c in uncovered:
        print(f"    - {c}", file=sys.stderr)
    print("\nAdd a PermissionEntry with this `action:` to e2e/fixtures/permission-matrix.ts.",
          file=sys.stderr)
    sys.exit(1)

print("\n✅ Permission matrix covers 100% of @RequirePermissions controller codes.")
PYEOF
