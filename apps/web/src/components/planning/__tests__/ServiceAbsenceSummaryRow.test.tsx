/**
 * ServiceAbsenceSummaryRow.test.tsx — FEAT-PLANNING-001
 *
 * Locks the *rendered* visual contract that the pure-aggregation unit tests
 * (planning-absence-summary.test.ts) cannot reach:
 *   - week mode renders "N · P%" with the level-colored indicator;
 *   - month mode renders N on the heatmap background;
 *   - télétravail-only members are not counted;
 *   - weekend and holiday columns are suppressed;
 *   - the tooltip / aria text resolves against the real message keys with the
 *     right params (a missing key or wrong param plumbing fails here).
 *
 * next-intl ships ESM that jest can't transform, so (like every other test in
 * this repo) it is mocked — but the mock is backed by the REAL planning.json so
 * key existence and param substitution are genuinely exercised.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { ServiceAbsenceSummaryRow } from "../ServiceAbsenceSummaryRow";
import type { ServiceGroup, DayCell } from "@/hooks/usePlanningData";
import { Leave, LeaveType, LeaveStatus, User } from "@/types";

jest.mock("next-intl", () => {
  // require (not import) so it loads lazily inside the hoisted factory.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messages = require("../../../../messages/fr/planning.json");
  const lookup = (key: string): unknown =>
    key.split(".").reduce<unknown>((o, k) => {
      if (o && typeof o === "object" && k in (o as Record<string, unknown>)) {
        return (o as Record<string, unknown>)[k];
      }
      return undefined;
    }, messages);
  return {
    // useTranslations("planning") → t(key, params) against the real planning.json
    useTranslations: () => (key: string, params?: Record<string, unknown>) => {
      let msg = lookup(key);
      if (typeof msg !== "string") return key; // surfaces a missing key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return msg;
    },
  };
});

jest.mock("@/stores/planningView.store", () => ({
  usePlanningViewStore: (selector: (s: unknown) => unknown) =>
    selector({
      legendFilters: { leavePending: true },
      leaveTypeFilters: {},
    }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

let leaveSeq = 0;
function makeLeave(partial: Partial<Leave> = {}): Leave {
  leaveSeq += 1;
  return {
    id: `leave-${leaveSeq}`,
    userId: "u1",
    type: LeaveType.CP,
    startDate: "2026-06-09",
    endDate: "2026-06-09",
    days: 1,
    status: LeaveStatus.APPROVED,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

function makeCell(partial: Partial<DayCell>): DayCell {
  return {
    date: new Date(2026, 5, 9),
    tasks: [],
    leaves: [],
    events: [],
    predefinedTaskAssignments: [],
    isTelework: false,
    isExternalIntervention: false,
    teleworkSchedule: null,
    isHoliday: false,
    isSpecialDay: false,
    ...partial,
  };
}

const users: User[] = ["u1", "u2", "u3", "u4"].map(
  (id) => ({ id, firstName: id, lastName: id }) as User,
);

const group: ServiceGroup = {
  id: "g1",
  name: "DRH",
  color: "blue",
  icon: "👥",
  hexColor: null,
  isManagement: false,
  users,
};

// Local-time constructors keep getDay() stable across timezones.
const TUESDAY = new Date(2026, 5, 9); // 2026-06-09
const SATURDAY = new Date(2026, 5, 13); // 2026-06-13

const renderRow = (
  props: Partial<React.ComponentProps<typeof ServiceAbsenceSummaryRow>> & {
    getDayCell: (userId: string, date: Date) => DayCell;
  },
) =>
  render(
    <ServiceAbsenceSummaryRow
      group={group}
      displayDays={[TUESDAY]}
      viewMode="week"
      gridTemplateColumns="220px 1fr"
      {...props}
    />,
  );

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ServiceAbsenceSummaryRow", () => {
  it("week view renders 'N · P%' with the level-colored indicator", () => {
    // u1, u2 on CP; u3, u4 free → 2/4 = 50% → orange.
    const getDayCell = jest.fn((userId: string) =>
      userId === "u1" || userId === "u2"
        ? makeCell({ leaves: [makeLeave({ userId, type: LeaveType.CP })] })
        : makeCell({}),
    );
    const { container } = renderRow({ getDayCell, viewMode: "week" });

    expect(screen.getByText("2 · 50%")).toBeInTheDocument();
    expect(container.querySelector(".bg-amber-500")).toBeTruthy();
    // Tooltip resolves with the per-type breakdown via the real message keys.
    const cell = screen.getByLabelText("2 absent(s) sur 4 (50%)");
    expect(cell.getAttribute("title")).toContain("2/4 absent(s) (50%)");
    expect(cell.getAttribute("title")).toContain("Congés payés: 2");
  });

  it("excludes télétravail-only members from the count", () => {
    // u1 on CP; u2 télétravail (no leave); u3, u4 free → 1/4 = 25% → neutral.
    const getDayCell = jest.fn((userId: string) => {
      if (userId === "u1")
        return makeCell({
          leaves: [makeLeave({ userId, type: LeaveType.CP })],
        });
      if (userId === "u2") return makeCell({ isTelework: true });
      return makeCell({});
    });
    renderRow({ getDayCell, viewMode: "week" });

    expect(screen.getByText("1 · 25%")).toBeInTheDocument();
  });

  it("month view renders N on a heatmap background", () => {
    // 3/4 = 75% → red.
    const getDayCell = jest.fn((userId: string) =>
      userId === "u4"
        ? makeCell({})
        : makeCell({ leaves: [makeLeave({ userId, type: LeaveType.CP })] }),
    );
    renderRow({ getDayCell, viewMode: "month" });

    const cell = screen.getByLabelText("3 absent(s) sur 4 (75%)");
    expect(cell).toHaveTextContent("3");
    expect(cell.className).toContain("bg-red-200");
  });

  it("suppresses weekend columns (no aggregation, getDayCell not called)", () => {
    const getDayCell = jest.fn(() =>
      makeCell({ leaves: [makeLeave({ type: LeaveType.CP })] }),
    );
    renderRow({ getDayCell, viewMode: "week", displayDays: [SATURDAY] });

    expect(getDayCell).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/absent/)).not.toBeInTheDocument();
    // The band caption still renders.
    expect(screen.getByText("Absents")).toBeInTheDocument();
  });

  it("suppresses holiday columns even when members are on leave", () => {
    const getDayCell = jest.fn((userId: string) =>
      makeCell({
        isHoliday: true,
        leaves: [makeLeave({ userId, type: LeaveType.CP })],
      }),
    );
    renderRow({ getDayCell, viewMode: "week", displayDays: [TUESDAY] });

    expect(screen.queryByLabelText(/absent/)).not.toBeInTheDocument();
  });
});
