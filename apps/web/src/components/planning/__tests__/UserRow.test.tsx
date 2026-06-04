/**
 * UserRow.test.tsx — PER-028
 * Proves row-level memoization: UserRow must NOT re-render when all props are
 * referentially identical (same objects / same function references).
 *
 * RED before React.memo: React re-executes UserRow body on every parent render
 *   → DayCell mock receives new calls even though nothing changed.
 * GREEN after React.memo: bailed-out render → DayCell mock call count stable.
 */
import React from "react";
import { render } from "@testing-library/react";
import { UserRow } from "../UserRow";
import type { User } from "@/types";
import type { ServiceGroup, DayCell as DayCellData } from "@/hooks/usePlanningData";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

jest.mock("@/components/UserAvatar", () => ({
  UserAvatar: () => <span data-testid="avatar" />,
}));

jest.mock("@/lib/planning-utils", () => ({
  getGroupColors: () => ({
    header: "bg-blue-50",
    text: "text-blue-900",
    border: "border-blue-200",
    badge: "bg-blue-600",
  }),
}));

// Track how many times DayCell renders
const dayCellRenderSpy = jest.fn();
jest.mock("../DayCell", () => ({
  DayCell: (props: Record<string, unknown>) => {
    dayCellRenderSpy(props);
    return <div data-testid="day-cell" />;
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const user: User = {
  id: "u1",
  firstName: "Alice",
  lastName: "Dupont",
  email: "alice@example.com",
  isActive: true,
  role: { id: "r1", name: "CONTRIBUTEUR", label: "Contributeur", description: null },
} as User;

const group: ServiceGroup = {
  id: "g1",
  name: "DRH",
  color: "blue",
  icon: "👥",
  hexColor: null,
  isManagement: false,
  users: [user],
};

const day1 = new Date("2026-06-02T00:00:00.000Z");
const day2 = new Date("2026-06-03T00:00:00.000Z");
const displayDays = [day1, day2];

const emptyCell: DayCellData = {
  tasks: [],
  events: [],
  teleworkSchedule: null,
  leave: null,
  predefinedTaskAssignments: [],
};

const getDayCell = jest.fn().mockReturnValue(emptyCell);
const onTeleworkToggle = jest.fn();
const onDragStart = jest.fn();
const onDragEnd = jest.fn();
const onDrop = jest.fn();
const onTaskClick = jest.fn();
const onEventClick = jest.fn();
const onPredefinedTaskClick = jest.fn();
const onAddPredefinedTask = jest.fn();

const baseProps = {
  user,
  group,
  displayDays,
  viewMode: "week" as const,
  gridTemplateColumns: "220px 1fr 1fr",
  currentUserId: "other",
  canManageOthersTelework: false,
  canAssignPredefinedTask: false,
  getDayCell,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
  onPredefinedTaskClick,
  onAddPredefinedTask,
};

// ── Test ─────────────────────────────────────────────────────────────────────

describe("UserRow — memoization (PER-028)", () => {
  beforeEach(() => {
    dayCellRenderSpy.mockClear();
  });

  it("does NOT re-render DayCell children when parent re-renders with identical props", () => {
    // Wrap in a parent so we can force a re-render without changing UserRow props
    const Parent = ({ tick }: { tick: number }) => (
      <div data-tick={tick}>
        <UserRow {...baseProps} />
      </div>
    );

    const { rerender } = render(<Parent tick={0} />);

    // Count renders from the initial mount (displayDays.length = 2)
    const afterMount = dayCellRenderSpy.mock.calls.length;
    expect(afterMount).toBe(2); // sanity: one call per day

    // Re-render parent with a new tick — UserRow props are the same stable refs
    rerender(<Parent tick={1} />);

    // If UserRow is memoized: bail-out → no additional DayCell calls
    // If UserRow is NOT memoized: body re-executes → 2 more DayCell calls
    expect(dayCellRenderSpy.mock.calls.length).toBe(afterMount);
  });
});
