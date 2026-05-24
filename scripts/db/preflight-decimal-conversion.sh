#!/usr/bin/env bash
#
# DAT-005 — Preflight verification for the Float → Decimal conversion migration
# (packages/database/prisma/migrations/20260524100100_dat005_convert_float_to_decimal).
#
# WHAT THIS DOES
#   For every column the conversion will touch, this script:
#     1. Counts rows whose fractional part has more significant digits than the
#        target Decimal scale will preserve.
#     2. Prints a 10-row sample showing original Float representation alongside
#        the value as it would be stored after `::numeric(p,s)`.
#     3. Exits NON-ZERO if any row would lose precision in the conversion.
#
# WHEN TO RUN
#   Against a STAGING DUMP of production (`pg_restore` into an isolated DB) BEFORE
#   applying the conversion to production. Never run this against the live DB — it
#   only reads, but the point is to catch precision loss without mutating anything.
#
# USAGE
#   DATABASE_URL=postgres://... ./scripts/db/preflight-decimal-conversion.sh
#   # or pass an explicit connection string:
#   ./scripts/db/preflight-decimal-conversion.sh "postgres://user:pass@host/db"
#
# EXIT CODES
#   0  No precision loss detected; conversion is safe.
#   1  At least one column has rows that would round-trip with lost precision.
#   2  Invalid invocation (missing connection string, psql not on PATH).

set -euo pipefail

CONN="${1:-${DATABASE_URL:-}}"
if [[ -z "${CONN}" ]]; then
  echo "ERROR: no connection string. Pass as arg or set DATABASE_URL." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found on PATH." >&2
  exit 2
fi

run_psql() { psql -X -At -v ON_ERROR_STOP=1 "$CONN" -c "$1"; }
run_psql_table() { psql -X -v ON_ERROR_STOP=1 "$CONN" -c "$1"; }

# (table, column, scale) — keep aligned with the conversion migration.
COLUMNS=(
  "time_entries|hours|2"
  "leaves|days|2"
  "leave_balances|totalDays|2"
  "tasks|estimatedHours|2"
  "project_snapshots|progress|2"
)

EXIT_CODE=0

for entry in "${COLUMNS[@]}"; do
  IFS='|' read -r table column scale <<<"$entry"
  echo "──────────────────────────────────────────────────────────────"
  echo "Table: ${table}   Column: ${column}   Target scale: ${scale}"
  echo "──────────────────────────────────────────────────────────────"

  # Row count.
  total="$(run_psql "SELECT COUNT(*) FROM \"${table}\" WHERE \"${column}\" IS NOT NULL;")"
  echo "  Non-null rows: ${total}"

  # Rows whose abs(value - round(value, scale)) > 0  →  precision will be lost.
  lossy="$(run_psql "
    SELECT COUNT(*)
    FROM \"${table}\"
    WHERE \"${column}\" IS NOT NULL
      AND abs(\"${column}\"::numeric - round(\"${column}\"::numeric, ${scale})) > 0;
  ")"
  echo "  Rows that would lose precision after rounding to NUMERIC(*, ${scale}): ${lossy}"

  # 10-row sample with original vs target representation.
  echo "  Sample (10 rows):"
  run_psql_table "
    SELECT id,
           \"${column}\"                       AS original_float,
           \"${column}\"::numeric(38, 10)      AS exact_numeric_repr,
           round(\"${column}\"::numeric, ${scale}) AS after_conversion,
           (\"${column}\"::numeric <> round(\"${column}\"::numeric, ${scale})) AS would_round
    FROM \"${table}\"
    WHERE \"${column}\" IS NOT NULL
    ORDER BY id
    LIMIT 10;"

  if [[ "${lossy}" != "0" ]]; then
    echo
    echo "  ✗ FAIL: ${lossy} row(s) in ${table}.${column} would lose precision."
    echo "         Inspect with:"
    echo "         psql \"\$DATABASE_URL\" -c \"SELECT id, \\\"${column}\\\" FROM \\\"${table}\\\" WHERE abs(\\\"${column}\\\"::numeric - round(\\\"${column}\\\"::numeric, ${scale})) > 0 LIMIT 50;\""
    EXIT_CODE=1
  else
    echo "  ✓ OK: no precision loss on ${table}.${column}"
  fi
  echo
done

if [[ "${EXIT_CODE}" -eq 0 ]]; then
  echo "✅ Preflight passed: conversion is safe to apply."
else
  echo "❌ Preflight FAILED: do NOT apply the conversion until lossy rows are reconciled."
fi
exit "${EXIT_CODE}"
