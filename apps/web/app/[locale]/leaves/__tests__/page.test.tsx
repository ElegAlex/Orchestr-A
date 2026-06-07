import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// TST-023 — Leaves page RBAC affordances test
//
// Description: LeavesPage gates several tabs and actions behind RBAC permissions:
//   - "pending-validation" tab: requires leaves:approve
//   - "all-leaves" tab:         requires leaves:readAll
//   - "leave-types" tab:        requires leaves:manage
//   - "balances" tab:           requires leaves:manage
//   - Import button (header):   requires leaves:manage
//
// Honest-RED proof (fail-pre):
//   The negative test asserts the gated tabs are ABSENT when all permissions
//   are denied. If the mock returned hasPermission=true instead, all tabs would
//   be present and queryBy*(...) would return non-null → assertion fails → RED.
//   The committed test uses hasPermission=false → tabs absent → GREEN.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Controllable mock state
// ---------------------------------------------------------------------------
let mockPermissions: string[] = [];

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
  usePathname: () => "/fr/leaves",
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, _params?: Record<string, unknown>) =>
    key,
  useLocale: () => "fr",
}));

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      user: {
        id: "user-1",
        login: "user1",
        firstName: "Test",
        lastName: "User",
      },
      permissions: [] as string[],
      permissionsLoaded: true,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: (code: string) => mockPermissions.includes(code),
  }),
}));

jest.mock("@/services/leaves.service", () => ({
  leavesService: {
    getMyLeaves: jest.fn().mockResolvedValue([]),
    getPendingForValidation: jest.fn().mockResolvedValue([]),
    getAll: jest.fn().mockResolvedValue({ data: [] }),
    getMyDelegations: jest.fn().mockResolvedValue({ given: [], received: [] }),
    getSubordinates: jest.fn().mockResolvedValue([]),
    getDefaultBalances: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    cancel: jest.fn(),
    requestCancel: jest.fn(),
    rejectCancellation: jest.fn(),
    createDelegation: jest.fn(),
    deactivateDelegation: jest.fn(),
    upsertBalance: jest.fn(),
    deleteBalance: jest.fn(),
    getImportTemplate: jest.fn(),
    validateImport: jest.fn(),
    importLeaves: jest.fn(),
  },
}));

jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/services/leave-types.service", () => ({
  leaveTypesService: {
    getAll: jest.fn().mockResolvedValue([]),
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

jest.mock("@/components/LeaveTypesManager", () => ({
  LeaveTypesManager: () => <div data-testid="leave-types-manager" />,
}));

jest.mock("@/components/ImportPreviewModal", () => ({
  ImportPreviewModal: () => <div data-testid="import-preview-modal" />,
}));

jest.mock("@/lib/csv-parser", () => ({
  parseCSV: jest.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import LeavesPage from "../page";
import type { Leave } from "@/types";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TST-023 — LeavesPage: RBAC gated affordances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when user has no RBAC permissions (OBSERVATEUR-like)", () => {
    beforeEach(() => {
      mockPermissions = [];
    });

    it("renders the page (myLeaves tab always visible)", async () => {
      render(<LeavesPage />);

      // Loading spinner appears first; wait for it to go away then check tab
      await waitFor(
        () => {
          // The tab text renders as "myLeaves (0)" — use partial matcher
          expect(screen.getByText(/myLeaves/)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("does NOT show pending-validation tab without leaves:approve", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(
            screen.queryByText("pendingValidation"),
          ).not.toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("does NOT show all-leaves tab without leaves:readAll", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.queryByText("allLeaves")).not.toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("does NOT show leave-types tab without leaves:manage", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.queryByText("leaveTypes")).not.toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("does NOT show import button without leaves:manage", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.queryByText("import.button")).not.toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });

  describe("when user has leaves:approve permission (validator role)", () => {
    beforeEach(() => {
      mockPermissions = ["leaves:approve"];
    });

    it("shows pending-validation tab with leaves:approve", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText("pendingValidation")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });

    it("also shows delegations tab with leaves:approve", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText("delegations.given")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });

  describe("when user has leaves:readAll permission", () => {
    beforeEach(() => {
      mockPermissions = ["leaves:readAll"];
    });

    it("shows all-leaves tab with leaves:readAll", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText("allLeaves")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });

  describe("when user has leaves:manage permission (admin role)", () => {
    beforeEach(() => {
      mockPermissions = ["leaves:manage"];
    });

    it("shows leave-types and balances tabs with leaves:manage", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText("leaveTypes")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Balances tab label is hardcoded in the page
      expect(screen.getByText("Soldes")).toBeInTheDocument();
    });

    it("shows import button in header with leaves:manage", async () => {
      await act(async () => {
        render(<LeavesPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText("import.button")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    });
  });
});

// ---------------------------------------------------------------------------
// SEC-029 — Cancel-request button must use API canRequestCancel flag, not
// client-side userId comparison. The test sets leave.userId to a different
// user ("other-user") so the current code (userId === user?.id) would hide
// the button, while the fixed code (canRequestCancel) shows it.
// ---------------------------------------------------------------------------

// Pull the mocked service so we can override per-test
const { leavesService: mockedLeavesService } = jest.requireMock(
  "@/services/leaves.service",
);

const approvedLeaveWithFlag = {
  id: "leave-approved-1",
  // Deliberately NOT the current user ("user-1") to prove client-side check fails
  userId: "other-user",
  status: "APPROVED",
  type: "PAID_LEAVE",
  startDate: "2026-07-01",
  endDate: "2026-07-05",
  days: 5,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
  leaveType: {
    id: "lt-1",
    code: "CP",
    name: "Congé payé",
    color: "#3B82F6",
    icon: "🌴",
  },
  // API-computed flag — the only affordance the frontend should rely on
  canRequestCancel: true,
} as unknown as Leave & { canRequestCancel: boolean };

describe("SEC-029 — cancel-request button uses API canRequestCancel flag", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = [];
  });

  it("SEC-029 — shows cancel-request button when canRequestCancel=true (regardless of userId)", async () => {
    mockedLeavesService.getMyLeaves.mockResolvedValueOnce([
      approvedLeaveWithFlag,
    ]);

    await act(async () => {
      render(<LeavesPage />);
    });

    await waitFor(
      () => {
        // Title attribute of the cancel-request button
        expect(screen.getByTitle("Demander l'annulation")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it("SEC-029 — hides cancel-request button when canRequestCancel=false even if userId matches", async () => {
    const approvedLeaveNoFlag = {
      ...approvedLeaveWithFlag,
      // userId matches the current user ("user-1") but flag is false
      userId: "user-1",
      canRequestCancel: false,
    };
    mockedLeavesService.getMyLeaves.mockResolvedValueOnce([
      approvedLeaveNoFlag,
    ]);

    await act(async () => {
      render(<LeavesPage />);
    });

    await waitFor(
      () => {
        // Wait for loading to complete (tab renders)
        expect(screen.getByText(/myLeaves/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(
      screen.queryByTitle("Demander l'annulation"),
    ).not.toBeInTheDocument();
  });
});
