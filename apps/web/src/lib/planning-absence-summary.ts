import { Leave } from "@/types";

/**
 * Per-service daily off-site summary (FEAT-PLANNING-001).
 *
 * Pure aggregation derived from the SAME in-memory data that the planning grid
 * renders — no fetch. Two distinct quantities are produced:
 *
 *  - `offsiteCount` = distinct members NOT on site that day = on a visible leave
 *    OR teleworking. This is the number shown in the band ("N · P%"); télétravail
 *    is counted here.
 *  - `absentCount` = distinct members on an actual visible leave only. This drives
 *    the alert COLOR (`level`) so that télétravail never raises the orange/red
 *    threshold — a service fully teleworking shows a high N but stays neutral.
 *
 * The "on a leave" predicate is deliberately gated on the FIRST leave of a day
 * (`cell.leaves[0]`) because `DayCell` renders the whole leave overlay off that
 * leaf (`leaveVisible` → `isHalfDayLeave` → `otherHalfLeave` all hang on
 * `leaves[0]`). Télétravail yields to a visible leave (DayCell suppresses the
 * telework overlay under `!leaveVisible`), so a member on leave is never also
 * counted as teleworking. Both predicates honour the same legend filters the
 * grid uses, so the count provably matches the cells on screen.
 */

export type AbsenceLevel = "neutral" | "orange" | "red";

/** Synthetic breakdown code for télétravail (not a real leave type). */
export const TELEWORK_CODE = "__TELEWORK__";

export interface VisibilityFilters {
  /** Map of `LeaveTypeConfig.code` (or legacy `LeaveType`) → visible. Absent key = visible. */
  leaveTypeFilters: Record<string, boolean>;
  /** When false, PENDING leaves are hidden (mirrors the `leavePending` legend filter). */
  showLeavePending: boolean;
  /** When false, télétravail is hidden (mirrors the `telework` legend filter). */
  showTelework: boolean;
}

/** A single member's planning state for one day (subset of the rendered `DayCell`). */
export interface MemberDayState {
  /** Leaves overlapping the day, already filtered by `getDayCell` (REJECTED + display filters applied). */
  leaves: Leave[];
  /** Whether the member is teleworking that day (the rendered `cell.isTelework`). */
  isTelework?: boolean;
}

export interface AbsenceBreakdownEntry {
  /** `LeaveTypeConfig.code`, legacy `LeaveType` enum value, or `TELEWORK_CODE`. */
  code: string;
  /** Human-readable label (resolved by the caller, same source as DayCell). */
  name: string;
  /** Number of members in this category. */
  count: number;
}

export interface DayAbsenceSummary {
  /** Distinct members off-site (on a visible leave OR teleworking) — the displayed count. */
  offsiteCount: number;
  /** Distinct members on an actual visible leave (drives the alert color, télétravail excluded). */
  absentCount: number;
  /** Distinct teleworking members not already on a visible leave. */
  teleworkCount: number;
  /** Service headcount (denominator). */
  total: number;
  /** Rounded percentage of the service off-site (0–100), i.e. offsiteCount/total. */
  percent: number;
  /** Color level derived from the REAL-absence percent only (télétravail never alerts). */
  level: AbsenceLevel;
  /** Per-type distribution incl. a trailing télétravail entry; Σ(count) === offsiteCount. */
  breakdown: AbsenceBreakdownEntry[];
}

/** Color thresholds on the absence percentage: >=75 red, >=50 orange, else neutral. */
export function getAbsenceLevel(percent: number): AbsenceLevel {
  if (percent >= 75) return "red";
  if (percent >= 50) return "orange";
  return "neutral";
}

/**
 * Whether a single leave would be rendered, mirroring `DayCell`'s per-leaf predicate:
 * type-filter visible AND (not PENDING-while-hidden). REJECTED is never visible.
 */
export function isLeaveVisible(
  leave: Leave,
  { leaveTypeFilters, showLeavePending }: VisibilityFilters,
): boolean {
  if (leave.status === "REJECTED") return false;
  const code = leave.leaveType?.code ?? leave.type ?? null;
  const typeVisible = code === null ? true : (leaveTypeFilters[code] ?? true);
  if (!typeVisible) return false;
  if (leave.status === "PENDING" && !showLeavePending) return false;
  return true;
}

/**
 * Aggregate one day's off-site summary for a service.
 *
 * @param members       one entry per member of the service (distinctness is inherent)
 * @param total         service headcount (the displayed "X personnes")
 * @param filters       the active leave-type / pending / télétravail visibility filters
 * @param resolveName   resolves a leave's display label (same source as DayCell)
 * @param teleworkLabel display label for the synthetic télétravail breakdown entry
 */
export function computeDayAbsenceSummary(
  members: MemberDayState[],
  total: number,
  filters: VisibilityFilters,
  resolveName: (leave: Leave) => string,
  teleworkLabel: string,
): DayAbsenceSummary {
  let absentCount = 0;
  let teleworkCount = 0;
  const leaveBreakdown = new Map<string, AbsenceBreakdownEntry>();

  for (const member of members) {
    const first = member.leaves[0];
    if (first && isLeaveVisible(first, filters)) {
      // On a visible leave — leave wins over télétravail (mirrors DayCell overlay).
      absentCount += 1;
      const code = first.leaveType?.code ?? first.type ?? "OTHER";
      const entry = leaveBreakdown.get(code);
      if (entry) {
        entry.count += 1;
      } else {
        leaveBreakdown.set(code, { code, name: resolveName(first), count: 1 });
      }
    } else if (member.isTelework && filters.showTelework) {
      teleworkCount += 1;
    }
  }

  const offsiteCount = absentCount + teleworkCount;
  const percent = total > 0 ? Math.round((offsiteCount / total) * 100) : 0;
  const absencePercent =
    total > 0 ? Math.round((absentCount / total) * 100) : 0;

  // Télétravail is appended after the real leave types so it reads last in the tooltip.
  const breakdown = [...leaveBreakdown.values()];
  if (teleworkCount > 0) {
    breakdown.push({
      code: TELEWORK_CODE,
      name: teleworkLabel,
      count: teleworkCount,
    });
  }

  return {
    offsiteCount,
    absentCount,
    teleworkCount,
    total,
    percent,
    level: getAbsenceLevel(absencePercent),
    breakdown,
  };
}
