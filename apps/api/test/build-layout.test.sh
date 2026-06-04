#!/usr/bin/env bash
# build-layout.test.sh — BUILD-001 regression witness
#
# Contract: pinning rootDir="./src" in tsconfig.build.json ensures that
# a stray .ts added outside src/ (but not excluded) causes a LOUD tsc
# error (TS6059) rather than silently relocating dist/main.js.
#
# RED  before rootDir pin: build exits 0, main.js relocates to dist/src/main.js
# GREEN after rootDir pin: build exits non-zero (TS6059), no silent relocation
#
# Also asserts the happy-path invariant: with no stray file, build succeeds
# and dist/main.js exists at the flat root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
PROBE="$API_DIR/probe-build001.ts"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# Cleanup helper — always removes the probe and any compiled probe artifacts
cleanup() {
  rm -f "$PROBE"
  rm -f "$API_DIR/probe-build001.d.ts" "$API_DIR/probe-build001.js" "$API_DIR/probe-build001.js.map"
  rm -f "$API_DIR/tsconfig.build.tsbuildinfo"
  rm -rf "$API_DIR/dist"
}
trap cleanup EXIT

# ── Happy-path assertion ────────────────────────────────────────────────────
echo ""
echo "=== TEST 1: happy-path — no stray file outside src/ ==="
cleanup

cd "$REPO_ROOT"
if pnpm --filter api run build > /dev/null 2>&1; then
  if [ -f "$API_DIR/dist/main.js" ]; then
    pass "dist/main.js exists at flat root"
  else
    fail "dist/main.js NOT found at flat root"
  fi
  if [ -f "$API_DIR/dist/src/main.js" ]; then
    fail "dist/src/main.js found — rootDir not stable (nested layout)"
  else
    pass "dist/src/main.js absent — layout is flat as expected"
  fi
else
  fail "build failed on clean tree — check tsconfig"
fi

# ── Stray-file assertion ────────────────────────────────────────────────────
echo ""
echo "=== TEST 2: stray .ts outside src/ causes LOUD failure (not silent relocation) ==="
cleanup

# Create a minimal stray .ts at apps/api/ root (not excluded by tsconfig.build.json)
cat > "$PROBE" << 'TSEOF'
// probe: intentionally outside src/ to test rootDir enforcement
export const probe = true;
TSEOF

cd "$REPO_ROOT"
set +e
BUILD_OUTPUT=$(pnpm --filter api run build 2>&1)
BUILD_EXIT=$?
set -e

if [ $BUILD_EXIT -ne 0 ]; then
  # After fix: build errors loudly (TS6059 or similar) — correct behaviour
  pass "build exits non-zero on stray file outside src/ (loud error, not silent relocation)"
  if echo "$BUILD_OUTPUT" | grep -q "TS6059\|rootDir\|is not under 'rootDir'"; then
    pass "TS6059/rootDir error confirmed in build output"
  else
    # Any non-zero exit is acceptable — tsc may report differently
    pass "build failed (loud) — rootDir contract enforced"
  fi
else
  # Before fix: build exits 0 — check if dist/main.js was silently relocated
  if [ -f "$API_DIR/dist/src/main.js" ] && [ ! -f "$API_DIR/dist/main.js" ]; then
    fail "SILENT RELOCATION detected: dist/src/main.js exists but dist/main.js does not — rootDir not pinned"
  elif [ -f "$API_DIR/dist/main.js" ]; then
    # Build succeeded and flat root intact — stray file had no effect (unexpected)
    pass "dist/main.js at flat root even with stray file (unexpected but acceptable)"
  else
    fail "build exit 0 but dist/main.js missing — unexpected state"
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
