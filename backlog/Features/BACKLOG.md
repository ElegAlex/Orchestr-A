# ORCHESTRA — Feature Backlog

> Feature work items. Format mirrors the security backlogs: one `### <ID> —` block
> per task; the closing commit carries `[closes <id>]` and records its SHA in `Closed_by`.

## DONE

### FEAT-PLANNING-001 — Per-service daily absence summary (Planning Week + Month) — DONE

**Status:** DONE · **Closed_by:** this commit (`[closes FEAT-PLANNING-001]`)
**Scope:** front-only (`apps/web`). LOCAL ONLY — no API / deploy / migration / auth work.

Each service group header band now shows a per-day absence summary, computed PER DAY
from the SAME in-memory planning data that renders the leave cells (no new fetch /
endpoint — derived via `getDayCell`, so the count matches the rendered cells).

- **Numerator:** distinct members of the service absent that day. Gated on
  `cell.leaves[0]` — the exact leaf `DayCell` keys its overlay on — so the count
  provably matches the green cells on screen.
- **Absence:** all leave/congé types + arrêt maladie + any other leave type.
  Télétravail is EXCLUDED (it is `cell.isTelework`, never a leave). A half-day
  absence counts the person as absent (= 1).
- **Denominator:** service headcount (the displayed "X personnes").
- **Week cell:** `N · P%` with a small colored indicator.
- **Month cell:** `N` on a heatmap background; tooltip = per-type breakdown + N/denom + P%.
- **Color thresholds on P:** ≥75% red, ≥50% orange, else neutral (from the rounded percent).
- Suppressed on weekends and holidays. Remains visible when the service is collapsed (replié).

**Files:**

- `apps/web/src/lib/planning-absence-summary.ts` — pure aggregation
  (`computeDayAbsenceSummary`, `isLeaveVisible`, `getAbsenceLevel`).
- `apps/web/src/lib/__tests__/planning-absence-summary.test.ts` — 18 unit tests
  (distinct-absentee count, half-day = 1, télétravail excluded, `leaves[0]` gating,
  type/pending filter visibility, threshold mapping, percent rounding).
- `apps/web/src/components/planning/ServiceAbsenceSummaryRow.tsx` — grid-aligned summary band.
- `apps/web/src/components/planning/PlanningGrid.tsx` — renders the row under each group header.
- `apps/web/messages/{fr,en}/planning.json` — `absenceSummary` i18n keys.

**Gate:** unit tests + lint + types/build green.
