import { render, screen, act } from "@testing-library/react";
import React from "react";
import { projectsService } from "@/services/projects.service";
import { tasksService } from "@/services/tasks.service";
import { personalTodosService } from "@/services/personal-todos.service";

// Mock Dashboard page (existing tests preserved)
const MockDashboard = () => {
  return (
    <div>
      <h1>Tableau de bord</h1>
      <div className="stats">
        <div className="stat">
          <span className="label">Projets actifs</span>
          <span className="value">5</span>
        </div>
        <div className="stat">
          <span className="label">Tâches en cours</span>
          <span className="value">12</span>
        </div>
      </div>
    </div>
  );
};

describe("Dashboard Page", () => {
  it("should render dashboard title", () => {
    render(<MockDashboard />);

    expect(screen.getByText(/tableau de bord/i)).toBeInTheDocument();
  });

  it("should display project stats", () => {
    render(<MockDashboard />);

    expect(screen.getByText("Projets actifs")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should display task stats", () => {
    render(<MockDashboard />);

    expect(screen.getByText("Tâches en cours")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PER-017 — Parallel fetch discriminator
// Asserts that all 3 service calls are fired BEFORE any of them resolves.
// Sequential code: getByUser is awaited first; if it never resolves, the two
// subsequent calls are never reached → RED.
// Parallel code (Promise.all): all 3 are initiated at once → GREEN.
// ---------------------------------------------------------------------------

// Service mocks — hoisted by jest
jest.mock("@/services/projects.service", () => ({
  projectsService: {
    getByUser: jest.fn(),
  },
}));

jest.mock("@/services/tasks.service", () => ({
  tasksService: {
    getByAssignee: jest.fn(),
    getMyDoneUndeclared: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/services/personal-todos.service", () => ({
  personalTodosService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  PersonalTodo: {},
}));

// Infrastructure mocks
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/fr/dashboard",
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) =>
    selector({ user: { id: "user-1", name: "Test User" } }),
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: () => true,
  }),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Heavy UI components that don't affect data fetching
jest.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "main-layout" }, children),
}));

jest.mock("@/components/planning/PlanningView", () => ({
  PlanningView: () => React.createElement("div", { "data-testid": "planning-view" }),
}));

jest.mock("@/components/ProjectIcon", () => ({
  ProjectIcon: () => React.createElement("div"),
}));

jest.mock("@/components/PresenceDialog", () => ({
  PresenceDialog: () => React.createElement("div"),
}));

jest.mock("@/components/dashboard/MyTasksSection", () => ({
  MyTasksSection: () => React.createElement("div", { "data-testid": "my-tasks-section" }),
}));

jest.mock("@/components/time-tracking/TimeEntryModal", () => ({
  TimeEntryModal: () => React.createElement("div"),
}));

describe("PER-017 — fetchData must fire all 3 service calls in parallel (not sequentially)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fires getByAssignee and getMyDoneUndeclared without waiting for getByUser to resolve", async () => {
    // All 3 primary fetches return a NEVER-resolving promise.
    // Sequential code: getByUser blocks → getByAssignee never called → test FAILS.
    // Parallel code (Promise.all): all 3 initiated immediately → test PASSES.
    projectsService.getByUser.mockReturnValue(new Promise(() => {}));
    tasksService.getByAssignee.mockReturnValue(new Promise(() => {}));
    tasksService.getMyDoneUndeclared.mockReturnValue(new Promise(() => {}));
    personalTodosService.getAll.mockReturnValue(new Promise(() => {}));

    // Dynamic import to ensure mocks are in place before module executes
    const { default: DashboardPage } = await import(
      "../page"
    );

    await act(async () => {
      render(React.createElement(DashboardPage));
      // Flush microtask queue — enough for all synchronous Promise initiations
      await Promise.resolve();
      await Promise.resolve();
    });

    // With sequential code: only getByUser is called (it never resolved so
    // getByAssignee was never reached). Both assertions below will fail → RED.
    expect(tasksService.getByAssignee).toHaveBeenCalledWith("user-1");
    expect(tasksService.getMyDoneUndeclared).toHaveBeenCalled();
  });
});
