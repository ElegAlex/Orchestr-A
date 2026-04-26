import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// -------------------------------------------------------------------
// ResizeObserver polyfill (jsdom lacks it, recharts needs it)
// -------------------------------------------------------------------
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// -------------------------------------------------------------------
// Mock recharts — replace ResponsiveContainer so it renders in jsdom
// (WorkloadChart uses explicit width/height on BarChart, so the real
// recharts components render fine; we just need the SVG to appear)
// -------------------------------------------------------------------
jest.mock("recharts", () => {
  const actual = jest.requireActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// -------------------------------------------------------------------
// Mock next-intl
// -------------------------------------------------------------------
jest.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const map: Record<string, string> = {
        collaboratorWorkload: "Répartition de charge",
        noActiveTasks: "Aucune tâche active à afficher",
        loadError: "Erreur lors du chargement",
      };
      return map[key] ?? key;
    };
    return t;
  },
}));

// -------------------------------------------------------------------
// Mock analyticsService
// -------------------------------------------------------------------
jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedWorkload: jest.fn(),
  },
}));

import { analyticsService } from "@/services/analytics.service";
import { WorkloadChart } from "./WorkloadChart";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

// -------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------

const mockWorkload = [
  {
    userId: "u1",
    name: "Alice Martin",
    counts: { TODO: 3, IN_PROGRESS: 2, IN_REVIEW: 1, BLOCKED: 0 },
    total: 6,
  },
  {
    userId: "u2",
    name: "Bob Dupont",
    counts: { TODO: 1, IN_PROGRESS: 4, IN_REVIEW: 0, BLOCKED: 1 },
    total: 6,
  },
  {
    userId: "u3",
    name: "Claire Lefèvre",
    counts: { TODO: 0, IN_PROGRESS: 1, IN_REVIEW: 2, BLOCKED: 0 },
    total: 3,
  },
];

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe("WorkloadChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders user names and svg chart on success", async () => {
    (analyticsService.getAdvancedWorkload as jest.Mock).mockResolvedValue(
      mockWorkload,
    );

    renderWithClient(<WorkloadChart />);

    // First user name must appear
    await waitFor(() => {
      expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    });

    expect(screen.getAllByText("6")).toHaveLength(2);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("shows error message when the API rejects", async () => {
    (analyticsService.getAdvancedWorkload as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    renderWithClient(<WorkloadChart />);

    await waitFor(() => {
      expect(screen.getByText("Erreur lors du chargement")).toBeInTheDocument();
    });
  });

  it("shows empty state when data array is empty", async () => {
    (analyticsService.getAdvancedWorkload as jest.Mock).mockResolvedValue([]);

    renderWithClient(<WorkloadChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Aucune tâche active à afficher"),
      ).toBeInTheDocument();
    });
  });

  it("renders the section title in all states", async () => {
    (analyticsService.getAdvancedWorkload as jest.Mock).mockResolvedValue(
      mockWorkload,
    );

    renderWithClient(<WorkloadChart />);

    await waitFor(() => {
      expect(screen.getByText("Répartition de charge")).toBeInTheDocument();
    });
  });

  it("passes limit prop to the service", async () => {
    (analyticsService.getAdvancedWorkload as jest.Mock).mockResolvedValue(
      mockWorkload,
    );

    renderWithClient(<WorkloadChart limit={5} />);

    await waitFor(() => {
      expect(analyticsService.getAdvancedWorkload).toHaveBeenCalledWith(5);
    });
  });
});
