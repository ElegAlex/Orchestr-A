import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// QuickTimeEntryInput pulls in `timeTrackingService.create` (network) and
// `react-hot-toast`. TaskCard (used by one test) pulls in `next-intl`,
// `next/navigation`, and `usePermissions`. We mock all of these so the
// components render in jsdom without any real network / navigation context.
//
// IMPORTANT: `hasPermission` mock is a lazy getter so each test can flip
// `mockHasPermission` before rendering (supports the gating assertion).

let mockHasPermission = true;

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: () => mockHasPermission,
  }),
}));

jest.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: () => (key: string) => key,
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/ProjectIcon", () => ({
  ProjectIcon: () => null,
}));

const createMock = jest.fn();
jest.mock("@/services/time-tracking.service", () => ({
  timeTrackingService: {
    create: (...args: unknown[]) => createMock(...args),
    createDismissal: jest.fn(),
  },
}));

const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// ─── Under test ─────────────────────────────────────────────────────────────

import { QuickTimeEntryInput } from "../QuickTimeEntryInput";
import { TaskCard } from "../TaskCard";
import { TaskStatus, Priority, type Task } from "@/types";

const baseTask: Task = {
  id: "task-1",
  title: "Test task",
  status: TaskStatus.TODO,
  priority: Priority.NORMAL,
  progress: 0,
  projectId: "project-1",
  createdAt: "2026-04-21T00:00:00.000Z",
  updatedAt: "2026-04-21T00:00:00.000Z",
};

const today = new Date().toISOString().split("T")[0];

beforeEach(() => {
  mockHasPermission = true;
  createMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("QuickTimeEntryInput", () => {
  it("displays the cumulated logged hours", () => {
    render(
      <QuickTimeEntryInput
        taskId="task-1"
        projectId="project-1"
        initialCumul={3.5}
        onSuccess={jest.fn()}
      />,
    );

    expect(screen.getByText(/3\.50\s*h/)).toBeInTheDocument();
  });

  it("accepts a decimal value in the input", async () => {
    const user = userEvent.setup();
    render(
      <QuickTimeEntryInput
        taskId="task-1"
        projectId="project-1"
        initialCumul={0}
        onSuccess={jest.fn()}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    await user.type(input, "2.5");
    expect(input.value).toBe("2.5");
  });

  it("submits on Enter with the correct payload and resets the input", async () => {
    createMock.mockResolvedValue({ id: "entry-1" });
    const onSuccess = jest.fn();

    render(
      <QuickTimeEntryInput
        taskId="task-1"
        projectId="project-1"
        initialCumul={0}
        onSuccess={onSuccess}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        projectId: "project-1",
        hours: 2.5,
        activityType: "DEVELOPMENT",
        date: today,
      }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("task-1", 2.5);
    });
    expect(toastSuccess).toHaveBeenCalled();
    // Input reset after success.
    expect(input.value).toBe("");
  });

  it("shows an error toast when the service rejects", async () => {
    createMock.mockRejectedValue(new Error("boom"));
    const onSuccess = jest.fn();

    render(
      <QuickTimeEntryInput
        taskId="task-1"
        projectId="project-1"
        initialCumul={0}
        onSuccess={onSuccess}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.25" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(onSuccess).not.toHaveBeenCalled();
    // Value is preserved so the user can retry.
    expect(input.value).toBe("1.25");
  });

  it("hides the input but keeps the cumul visible when the permission is missing (gated via TaskCard)", () => {
    // QuickTimeEntryInput itself doesn't gate — gating lives in TaskCard (D8).
    // We render TaskCard with the permission flipped off and assert only the
    // cumul shows (no spinbutton / no "…" button).
    mockHasPermission = false;

    render(
      <TaskCard
        task={{ ...baseTask, totalLoggedHours: 4 }}
        mode="upcoming"
        onOpenModal={jest.fn()}
        onQuickEntrySuccess={jest.fn()}
      />,
    );

    // No numeric input (saisie inline masquée).
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    // No "…" trigger when permission is missing (V5 : i18n key surfaced via mock).
    expect(
      screen.queryByRole("button", { name: /openModalLabel|Ouvrir la saisie/i }),
    ).not.toBeInTheDocument();
    // Cumul still visible.
    expect(screen.getByText(/4\.00\s*h/)).toBeInTheDocument();
  });
});
