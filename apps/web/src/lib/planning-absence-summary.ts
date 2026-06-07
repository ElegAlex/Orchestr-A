import { Leave } from "@/types";

/**
 * Per-service daily absence summary (FEAT-PLANNING-001).
 *
 * Pure aggregation derived from the SAME in-memory leave data that the planning
 * grid renders — no fetch. The "absent" predicate is deliberately gated on the
 * FIRST leave of a day (`cell.leaves[0]`) because `DayCell` renders the whole
 * leave overlay off that leaf (`leaveVisible` → `isHalfDayLeave` → `otherHalfLeave`
 * all hang on `leaves[0]`). Gating on the first leaf is the only rule that
 * provably matches the green cells on screen.
 */

export type AbsenceLevel = "neutral" | "orange" | "red";

export interface LeaveVisibilityFilters {
  /** Map of `LeaveTypeConfig.code` (or legacy `LeaveType`) → visible. Absent key = visible. */
  leaveTypeFilters: Record<string, boolean>;
  /** When false, PENDING leaves are hidden (mirrors the `leavePending` legend filter). */
  showLeavePending: boolean;
}

/** A single member's planning state for one day (subset of the rendered `DayCell`). */
export interface MemberDayState {
  /** Leaves overlapping the day, already filtered by `getDayCell` (REJECTED + display filters applied). */
  leaves: Leave[];
  /** Telework is NOT an absence; carried only to make the exclusion explicit. */
  isTelework?: boolean;
}

export interface AbsenceBreakdownEntry {
  /** `LeaveTypeConfig.code` or legacy `LeaveType` enum value. */
  code: string;
  /** Human-readable label (resolved by the caller, same source as DayCell). */
  name: string;
  /** Number of members absent for this type. */
  count: number;
}

export interface DayAbsenceSummary {
  /** Distinct members of the service absent on this day. */
  absentCount: number;
  /** Service headcount (denominator). */
  total: number;
  /** Rounded percentage of the service absent (0–100). */
  percent: number;
  /** Color level derived from the rounded percent. */
  level: AbsenceLevel;
  /** Per-type distribution; Σ(count) === absentCount. */
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
  { leaveTypeFilters, showLeavePending }: LeaveVisibilityFilters,
): boolean {
  if (leave.status === "REJECTED") return false;
  const code = leave.leaveType?.code ?? leave.type ?? null;
  const typeVisible = code === null ? true : (leaveTypeFilters[code] ?? true);
  if (!typeVisible) return false;
  if (leave.status === "PENDING" && !showLeavePending) return false;
  return true;
}

/**
 * Aggregate one day's absence summary for a service.
 *
 * @param members   one entry per member of the service (distinctness is inherent)
 * @param total     service headcount (the displayed "X personnes")
 * @param filters   the active leave-type / pending visibility filters
 * @param resolveName resolves a leave's display label (same source as DayCell)
 */
export function computeDayAbsenceSummary(
  members: MemberDayState[],
  total: number,
  filters: LeaveVisibilityFilters,
  resolveName: (leave: Leave) => string,
): DayAbsenceSummary {
  let absentCount = 0;
  const breakdown = new Map<string, AbsenceBreakdownEntry>();

  for (const member of members) {
    const first = member.leaves[0];
    if (!first || !isLeaveVisible(first, filters)) continue;

    absentCount += 1;
    const code = first.leaveType?.code ?? first.type ?? "OTHER";
    const entry = breakdown.get(code);
    if (entry) {
      entry.count += 1;
    } else {
      breakdown.set(code, { code, name: resolveName(first), count: 1 });
    }
  }

  const percent = total > 0 ? Math.round((absentCount / total) * 100) : 0;

  return {
    absentCount,
    total,
    percent,
    level: getAbsenceLevel(percent),
    breakdown: [...breakdown.values()],
  };
}
