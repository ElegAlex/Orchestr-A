import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// TST-023 — Settings page RBAC affordances test
//
// Description: Settings page has a hard route-guard: when the user lacks
// settings:update, it calls router.push('/${locale}/dashboard') and returns
// null (content invisible). With the permission granted, settings tabs render.
//
// Honest-RED proof (fail-pre):
//   The negative test asserts router.push is called with /fr/dashboard when
//   settings:update is DENIED. To confirm RED: if we temporarily GRANT the
//   permission while running the same assertion (push called), Jest reports
//   "Expected: called — Received: not called" → test is RED.
//   The committed test runs with DENIED permission → push IS called → GREEN.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Controllable mock state — must be mutable across tests
// ---------------------------------------------------------------------------
let mockHasPermission: boolean;

const mockPush = jest.fn();

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/fr/settings",
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      user: { id: "user-admin", login: "admin" },
      permissions: [] as string[],
      permissionsLoaded: true,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (_code: string) => mockHasPermission,
  }),
}));

jest.mock("@/services/settings.service", () => ({
  settingsService: {
    getAll: jest.fn().mockResolvedValue({ settings: {}, list: [] }),
    bulkUpdate: jest.fn().mockResolvedValue({}),
    resetAllToDefaults: jest.fn().mockResolvedValue({ settings: {}, list: [] }),
  },
}));

jest.mock("@/stores/settings.store", () => ({
  useSettingsStore: () => ({
    fetchSettings: jest.fn(),
  }),
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

jest.mock("@/components/holidays/HolidaysManager", () => ({
  HolidaysManager: () => <div data-testid="holidays-manager" />,
}));

jest.mock("@/components/school-vacations/SchoolVacationsManager", () => ({
  SchoolVacationsManager: () => <div data-testid="school-vacations-manager" />,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import SettingsPage from "../page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TST-023 — SettingsPage: RBAC route-guard affordances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe("when settings:update permission is DENIED", () => {
    beforeEach(() => {
      mockHasPermission = false;
    });

    it("redirects to /fr/dashboard and renders null (no settings content)", async () => {
      render(<SettingsPage />);

      // Route guard fires synchronously; push must be called with the dashboard path
      expect(mockPush).toHaveBeenCalledWith("/fr/dashboard");
    });

    it("does not render any settings tabs", async () => {
      render(<SettingsPage />);

      // The page returns null immediately — no tabs should be present
      expect(screen.queryByText("tabs.display")).not.toBeInTheDocument();
      expect(screen.queryByText("tabs.planning")).not.toBeInTheDocument();
      expect(screen.queryByText("tabs.holidays")).not.toBeInTheDocument();
    });
  });

  describe("when settings:update permission is GRANTED", () => {
    beforeEach(() => {
      mockHasPermission = true;
      const { settingsService } = require("@/services/settings.service");
      settingsService.getAll.mockResolvedValue({ settings: {}, list: [] });
    });

    it("does NOT redirect to dashboard", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalledWith("/fr/dashboard");
      });
    });

    it("renders settings tabs when permission is granted", async () => {
      render(<SettingsPage />);

      // While loading, the page shows a loading spinner; after resolve, tabs appear
      await waitFor(
        () => {
          expect(screen.getByText("tabs.display")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Tabs must be visible for the authorized user
      expect(screen.getByText("tabs.planning")).toBeInTheDocument();
      expect(screen.getByText("tabs.holidays")).toBeInTheDocument();
      expect(screen.getByText("tabs.schoolVacations")).toBeInTheDocument();
    });

    it("renders save and reset buttons in the header", async () => {
      render(<SettingsPage />);

      await waitFor(
        () => {
          expect(screen.getByText("save")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      expect(screen.getByText("reset")).toBeInTheDocument();
    });
  });
});
