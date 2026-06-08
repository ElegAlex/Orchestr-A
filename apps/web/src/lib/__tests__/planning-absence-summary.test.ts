import {
  getAbsenceLevel,
  isLeaveVisible,
  computeDayAbsenceSummary,
  TELEWORK_CODE,
  type MemberDayState,
  type VisibilityFilters,
} from "../planning-absence-summary";
import { Leave, LeaveType, LeaveStatus, HalfDay } from "@/types";

// Minimal Leave factory — fills the required fields and lets each test override.
let leaveSeq = 0;
function makeLeave(partial: Partial<Leave> = {}): Leave {
  leaveSeq += 1;
  return {
    id: `leave-${leaveSeq}`,
    userId: "u1",
    type: LeaveType.CP,
    startDate: "2026-06-08",
    endDate: "2026-06-08",
    days: 1,
    status: LeaveStatus.APPROVED,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

const ALL_VISIBLE: VisibilityFilters = {
  leaveTypeFilters: {},
  showLeavePending: true,
  showTelework: true,
};

// resolveName mirrors how DayCell derives a display label (config name → enum fallback).
const resolveName = (l: Leave) => l.leaveType?.name ?? l.type;
const TELEWORK_LABEL = "Télétravail";

const summarize = (
  members: MemberDayState[],
  total: number,
  filters: VisibilityFilters = ALL_VISIBLE,
) =>
  computeDayAbsenceSummary(
    members,
    total,
    filters,
    resolveName,
    TELEWORK_LABEL,
  );

describe("getAbsenceLevel", () => {
  it("maps >=75% to red", () => {
    expect(getAbsenceLevel(75)).toBe("red");
    expect(getAbsenceLevel(100)).toBe("red");
  });

  it("maps >=50% and <75% to orange", () => {
    expect(getAbsenceLevel(50)).toBe("orange");
    expect(getAbsenceLevel(74)).toBe("orange");
  });

  it("maps <50% to neutral", () => {
    expect(getAbsenceLevel(0)).toBe("neutral");
    expect(getAbsenceLevel(49)).toBe("neutral");
  });
});

describe("isLeaveVisible", () => {
  it("is visible by default when no filter is set", () => {
    expect(isLeaveVisible(makeLeave(), ALL_VISIBLE)).toBe(true);
  });

  it("hides a leave whose type code is toggled off", () => {
    const leave = makeLeave({ type: LeaveType.CP });
    const filters: VisibilityFilters = {
      leaveTypeFilters: { CP: false },
      showLeavePending: true,
      showTelework: true,
    };
    expect(isLeaveVisible(leave, filters)).toBe(false);
  });

  it("prefers the LeaveTypeConfig code over the legacy enum for the filter key", () => {
    const leave = makeLeave({
      type: LeaveType.OTHER,
      leaveType: { code: "FORMATION", name: "Formation" } as Leave["leaveType"],
    });
    const filters: VisibilityFilters = {
      leaveTypeFilters: { FORMATION: false },
      showLeavePending: true,
      showTelework: true,
    };
    expect(isLeaveVisible(leave, filters)).toBe(false);
  });

  it("hides PENDING leaves when showLeavePending is off", () => {
    const leave = makeLeave({ status: LeaveStatus.PENDING });
    expect(
      isLeaveVisible(leave, {
        leaveTypeFilters: {},
        showLeavePending: false,
        showTelework: true,
      }),
    ).toBe(false);
  });

  it("keeps APPROVED leaves visible regardless of showLeavePending", () => {
    const leave = makeLeave({ status: LeaveStatus.APPROVED });
    expect(
      isLeaveVisible(leave, {
        leaveTypeFilters: {},
        showLeavePending: false,
        showTelework: true,
      }),
    ).toBe(true);
  });

  it("treats REJECTED leaves as not visible (defensive)", () => {
    const leave = makeLeave({ status: LeaveStatus.REJECTED });
    expect(isLeaveVisible(leave, ALL_VISIBLE)).toBe(false);
  });
});

describe("computeDayAbsenceSummary", () => {
  it("counts each off-site member once and returns the headcount as total", () => {
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a" })] },
      { leaves: [makeLeave({ userId: "b" })] },
      { leaves: [] },
      { leaves: [] },
    ];
    const summary = summarize(members, 4);
    expect(summary.absentCount).toBe(2);
    expect(summary.offsiteCount).toBe(2);
    expect(summary.teleworkCount).toBe(0);
    expect(summary.total).toBe(4);
    expect(summary.percent).toBe(50);
    expect(summary.level).toBe("orange");
  });

  it("counts a half-day absence as the member being off-site (= 1)", () => {
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a", halfDay: HalfDay.MORNING })] },
      { leaves: [] },
    ];
    const summary = summarize(members, 2);
    expect(summary.offsiteCount).toBe(1);
    expect(summary.percent).toBe(50);
  });

  it("includes télétravail in offsiteCount but NOT in absentCount", () => {
    // u1 on CP; u2 & u3 télétravail (no leave); u4 free.
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a" })] },
      { leaves: [], isTelework: true },
      { leaves: [], isTelework: true },
      { leaves: [] },
    ];
    const summary = summarize(members, 4);
    expect(summary.absentCount).toBe(1);
    expect(summary.teleworkCount).toBe(2);
    expect(summary.offsiteCount).toBe(3);
    expect(summary.percent).toBe(75); // 3/4 off-site
  });

  it("télétravail never raises the alert color (level tracks real absences only)", () => {
    // Whole service teleworking, nobody on leave → 100% off-site but neutral color.
    const members: MemberDayState[] = [
      { leaves: [], isTelework: true },
      { leaves: [], isTelework: true },
      { leaves: [], isTelework: true },
      { leaves: [], isTelework: true },
    ];
    const summary = summarize(members, 4);
    expect(summary.offsiteCount).toBe(4);
    expect(summary.percent).toBe(100);
    expect(summary.absentCount).toBe(0);
    expect(summary.level).toBe("neutral");
  });

  it("respects the telework legend filter: showTelework=false drops telework", () => {
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a" })] },
      { leaves: [], isTelework: true },
      { leaves: [], isTelework: true },
      { leaves: [] },
    ];
    const summary = summarize(members, 4, {
      leaveTypeFilters: {},
      showLeavePending: true,
      showTelework: false,
    });
    expect(summary.offsiteCount).toBe(1);
    expect(summary.teleworkCount).toBe(0);
    expect(summary.percent).toBe(25);
  });

  it("counts a member who is both teleworking and on leave once (leave wins)", () => {
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a" })], isTelework: true },
      { leaves: [], isTelework: true },
    ];
    const summary = summarize(members, 2);
    expect(summary.offsiteCount).toBe(2);
    expect(summary.absentCount).toBe(1);
    expect(summary.teleworkCount).toBe(1);
  });

  it("matches rendered cells: gates on the first leaf, so a hidden leaves[0] with a visible leaves[1] is NOT counted", () => {
    // DayCell only renders an overlay when cell.leaves[0] is visible.
    const members: MemberDayState[] = [
      {
        leaves: [
          makeLeave({
            userId: "a",
            type: LeaveType.CP,
            halfDay: HalfDay.MORNING,
          }),
          makeLeave({
            userId: "a",
            type: LeaveType.RTT,
            halfDay: HalfDay.AFTERNOON,
          }),
        ],
      },
    ];
    const filters: VisibilityFilters = {
      leaveTypeFilters: { CP: false }, // hides leaves[0]
      showLeavePending: true,
      showTelework: true,
    };
    const summary = summarize(members, 1, filters);
    expect(summary.offsiteCount).toBe(0);
  });

  it("does not count a member whose only leave type is filtered off", () => {
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a", type: LeaveType.SICK_LEAVE })] },
      { leaves: [makeLeave({ userId: "b", type: LeaveType.CP })] },
    ];
    const filters: VisibilityFilters = {
      leaveTypeFilters: { SICK_LEAVE: false },
      showLeavePending: true,
      showTelework: true,
    };
    const summary = summarize(members, 2, filters);
    expect(summary.offsiteCount).toBe(1);
  });

  it("builds a per-type breakdown summing to offsiteCount, with télétravail last", () => {
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a", type: LeaveType.CP })] },
      { leaves: [makeLeave({ userId: "b", type: LeaveType.CP })] },
      { leaves: [makeLeave({ userId: "c", type: LeaveType.SICK_LEAVE })] },
      { leaves: [], isTelework: true },
    ];
    const summary = summarize(members, 4);
    expect(summary.offsiteCount).toBe(4);
    const total = summary.breakdown.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBe(4);
    const cp = summary.breakdown.find((b) => b.code === "CP");
    const sick = summary.breakdown.find((b) => b.code === "SICK_LEAVE");
    const telework = summary.breakdown.find((b) => b.code === TELEWORK_CODE);
    expect(cp?.count).toBe(2);
    expect(sick?.count).toBe(1);
    expect(telework?.count).toBe(1);
    expect(telework?.name).toBe(TELEWORK_LABEL);
    // Télétravail is appended after the real leave types.
    expect(summary.breakdown[summary.breakdown.length - 1].code).toBe(
      TELEWORK_CODE,
    );
  });

  it("derives the color level from the rounded real-absence percent", () => {
    // 2/3 = 66.6% → rounds to 67% → orange (not red).
    const members: MemberDayState[] = [
      { leaves: [makeLeave({ userId: "a" })] },
      { leaves: [makeLeave({ userId: "b" })] },
      { leaves: [] },
    ];
    const summary = summarize(members, 3);
    expect(summary.percent).toBe(67);
    expect(summary.level).toBe("orange");
  });

  it("handles an empty service (total 0) without dividing by zero", () => {
    const summary = summarize([], 0);
    expect(summary.offsiteCount).toBe(0);
    expect(summary.absentCount).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.level).toBe("neutral");
    expect(summary.breakdown).toEqual([]);
  });
});
