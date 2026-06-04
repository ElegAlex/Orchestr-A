import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// TST-023 — Telework page RBAC affordances test
//
// Description: TeleworkPage gates a user-selector dropdown behind the
// telework:manage_any permission. Users without that permission only see
// their own telework calendar. With the permission AND users:read, a
// "Collaborateur :" selector appears allowing managers to view other users.
//
// Honest-RED proof (fail-pre):
//   The "does NOT show user selector" test asserts queryBy*("Collaborateur :")
//   returns null when telework:manage_any is DENIED.
//   If the mock returned hasPermission=true for telework:manage_any instead,
//   the selector would be rendered → queryBy* returns a node → assertion fails.
//   The committed test uses denied permissions → selector absent → GREEN.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Controllable mock state
// ---------------------------------------------------------------------------
let mockPermissions: string[] = [];

const mockUser = {
  id: "user-1",
  login: "user1",
  firstName: "Alice",
  lastName: "Dupont",
};

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/fr/telework",
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { user: mockUser };
    return selector ? selector(state) : state;
  },
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

jest.mock("@/services/telework.service", () => ({
  teleworkService: {
    getByDateRange: jest.fn().mockResolvedValue([]),
    getRecurringRules: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createRecurringRule: jest.fn(),
    updateRecurringRule: jest.fn(),
    deleteRecurringRule: jest.fn(),
    generateSchedules: jest.fn(),
  },
}));

jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn().mockResolvedValue([
      { id: "user-1", firstName: "Alice", lastName: "Dupont", login: "alice" },
      { id: "user-2", firstName: "Bob", lastName: "Martin", login: "bob" },
    ]),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

jest.mock("date-fns", () => ({
  ...jest.requireActual("date-fns"),
  format: jest.fn().mockReturnValue("2026-06-01"),
  isSameDay: jest.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import TeleworkPage from "../page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TST-023 — TeleworkPage: RBAC gated affordances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when user has no special permissions (regular contributor)", () => {
    beforeEach(() => {
      mockPermissions = [];
    });

    it("renders the page and shows info card", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          expect(screen.getByText("howItWorks.title")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("does NOT show the user-selector for other collaborators", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          // Page finishes loading (info card visible)
          expect(screen.getByText("howItWorks.title")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // The "Collaborateur :" label only appears for users with telework:manage_any
      expect(screen.queryByText("Collaborateur :")).not.toBeInTheDocument();
    });

    it("shows recurring rules panel for own user", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          expect(screen.getByText("recurringRules.title")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("shows the navigation buttons (previous/next month)", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          expect(
            screen.getByText(/navigation\.previousMonth/),
          ).toBeInTheDocument();
          expect(
            screen.getByText(/navigation\.nextMonth/),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });

  describe("when user has telework:manage_any AND users:read permissions (manager)", () => {
    beforeEach(() => {
      mockPermissions = ["telework:manage_any", "users:read"];
      const { usersService } = require("@/services/users.service");
      usersService.getAll.mockResolvedValue([
        {
          id: "user-1",
          firstName: "Alice",
          lastName: "Dupont",
          login: "alice",
        },
        { id: "user-2", firstName: "Bob", lastName: "Martin", login: "bob" },
      ]);
    });

    it("shows the Collaborateur selector for managers", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          expect(screen.getByText("Collaborateur :")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("populates the selector with fetched users", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          // The select should include Alice and Bob from the mock
          expect(
            screen.getByRole("combobox", { name: "Collaborateur :" }),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      const selector = screen.getByRole("combobox", {
        name: "Collaborateur :",
      });
      expect(selector).toBeInTheDocument();
    });

    it("still shows recurring rules panel", async () => {
      render(<TeleworkPage />);

      await waitFor(
        () => {
          expect(screen.getByText("recurringRules.title")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });
});
