import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const map: Record<string, string> = {
        projectHealth: "Santé des projets",
        loadError: "Erreur lors du chargement",
        noProjectsToDisplay: "Aucun projet à afficher",
        "cols.project": "Projet",
        "cols.progress": "% complétion",
        "cols.milestones": "Jalons",
        "cols.activeTasks": "Tâches actives",
        "cols.health": "Santé",
        "health.green": "Bon",
        "health.orange": "Attention",
        "health.red": "Critique",
      };
      return map[key] ?? key;
    };
    return t;
  },
}));

jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedProjectHealth: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ProjectHealthTable } from "./ProjectHealthTable";
import { analyticsService } from "@/services/analytics.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockRows = [
  {
    projectId: "p1",
    name: "Projet Alpha",
    progressPct: 80,
    milestones: { reached: 5, overdue: 0, upcoming: 2 },
    activeTasks: 10,
    teamSize: 4,
    health: "green" as const,
  },
  {
    projectId: "p2",
    name: "Projet Beta",
    progressPct: 50,
    milestones: { reached: 3, overdue: 1, upcoming: 3 },
    activeTasks: 7,
    teamSize: 3,
    health: "orange" as const,
  },
  {
    projectId: "p3",
    name: "Projet Gamma",
    progressPct: 20,
    milestones: { reached: 1, overdue: 4, upcoming: 5 },
    activeTasks: 15,
    teamSize: 6,
    health: "red" as const,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithQuery(ui: React.ReactElement) {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectHealthTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders section title", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockResolvedValue(
      mockRows,
    );

    renderWithQuery(<ProjectHealthTable />);

    expect(screen.getByText("Santé des projets")).toBeInTheDocument();
  });

  it("shows skeleton while loading", () => {
    // Never resolve — stays in loading state
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    renderWithQuery(<ProjectHealthTable />);

    // Skeleton rows use animate-pulse; at least one cell should be present
    const skeletonCells = document
      .querySelectorAll(".animate-pulse");
    expect(skeletonCells.length).toBeGreaterThan(0);
  });

  it("renders success: 3 project names and health badges", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockResolvedValue(
      mockRows,
    );

    renderWithQuery(<ProjectHealthTable />);

    await waitFor(() => {
      expect(screen.getByText("Projet Alpha")).toBeInTheDocument();
      expect(screen.getByText("Projet Beta")).toBeInTheDocument();
      expect(screen.getByText("Projet Gamma")).toBeInTheDocument();
    });

    // Health badges
    expect(screen.getByText("Bon")).toBeInTheDocument();
    expect(screen.getByText("Attention")).toBeInTheDocument();
    expect(screen.getByText("Critique")).toBeInTheDocument();
  });

  it("applies correct badge colour classes", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockResolvedValue(
      mockRows,
    );

    renderWithQuery(<ProjectHealthTable />);

    await waitFor(() => {
      expect(screen.getByText("Bon")).toBeInTheDocument();
    });

    const greenBadge = screen.getByText("Bon");
    expect(greenBadge.className).toMatch(/bg-green-100/);
    expect(greenBadge.className).toMatch(/text-green-800/);

    const orangeBadge = screen.getByText("Attention");
    expect(orangeBadge.className).toMatch(/bg-orange-100/);
    expect(orangeBadge.className).toMatch(/text-orange-800/);

    const redBadge = screen.getByText("Critique");
    expect(redBadge.className).toMatch(/bg-red-100/);
    expect(redBadge.className).toMatch(/text-red-800/);
  });

  it("displays progress percentages", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockResolvedValue(
      mockRows,
    );

    renderWithQuery(<ProjectHealthTable />);

    await waitFor(() => {
      expect(screen.getByText("80 %")).toBeInTheDocument();
      expect(screen.getByText("50 %")).toBeInTheDocument();
      expect(screen.getByText("20 %")).toBeInTheDocument();
    });
  });

  it("shows error message when query fails", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    renderWithQuery(<ProjectHealthTable />);

    await waitFor(() => {
      expect(
        screen.getByText("Erreur lors du chargement"),
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when data is empty array", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockResolvedValue(
      [],
    );

    renderWithQuery(<ProjectHealthTable />);

    await waitFor(() => {
      expect(screen.getByText("Aucun projet à afficher")).toBeInTheDocument();
    });
  });

  it("renders column headers", async () => {
    (analyticsService.getAdvancedProjectHealth as jest.Mock).mockResolvedValue(
      mockRows,
    );

    renderWithQuery(<ProjectHealthTable />);

    await waitFor(() => {
      expect(screen.getByText("Projet Alpha")).toBeInTheDocument();
    });

    expect(screen.getByText("Projet")).toBeInTheDocument();
    expect(screen.getByText("% complétion")).toBeInTheDocument();
    expect(screen.getByText("Jalons")).toBeInTheDocument();
    expect(screen.getByText("Tâches actives")).toBeInTheDocument();
    expect(screen.getByText("Santé")).toBeInTheDocument();
  });
});
