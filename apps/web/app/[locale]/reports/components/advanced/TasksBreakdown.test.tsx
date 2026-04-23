import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mock: recharts (ESM module, not handled by next/jest by default)
// ---------------------------------------------------------------------------
jest.mock("recharts", () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="pie-chart">{children}</svg>
  ),
  Pie: () => null,
  Cell: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
  Legend: () => null,
}));

// ---------------------------------------------------------------------------
// Mock: next-intl
// ---------------------------------------------------------------------------
jest.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const translations: Record<string, string> = {
        priorityDistribution: "Répartition par priorité",
        byPriority: "Par priorité",
        byStatus: "Par statut",
        critical: "Critique",
        high: "Haute",
        normal: "Normale",
        low: "Basse",
        todo: "À faire",
        inProgress: "En cours",
        inReview: "En révision",
        blocked: "Bloquée",
        done: "Terminé",
        total: "Total",
        loadError: "Erreur de chargement",
        noTasksToDisplay: "Aucune tâche à afficher",
      };
      return translations[key] ?? key;
    };
    return t;
  },
}));

// ---------------------------------------------------------------------------
// Mock: analyticsService
// ---------------------------------------------------------------------------
jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedTasksBreakdown: jest.fn(),
  },
}));

import { analyticsService } from "@/services/analytics.service";
import { TasksBreakdown } from "./TasksBreakdown";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = makeClient();
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const MOCK_DATA = {
  byPriority: {
    CRITICAL: 3,
    HIGH: 7,
    NORMAL: 12,
    LOW: 2,
  },
  byStatus: {
    TODO: 5,
    IN_PROGRESS: 8,
    IN_REVIEW: 3,
    BLOCKED: 1,
    DONE: 7,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TasksBreakdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders two donut charts and priority/status headings on success", async () => {
    (analyticsService.getAdvancedTasksBreakdown as jest.Mock).mockResolvedValue(
      MOCK_DATA,
    );

    render(
      <Wrapper>
        <TasksBreakdown />
      </Wrapper>,
    );

    // Wait for data to load
    await waitFor(() => {
      expect(
        screen.getAllByTestId("pie-chart"),
      ).toHaveLength(2);
    });

    // Section headings
    expect(screen.getByText("Par priorité")).toBeInTheDocument();
    expect(screen.getByText("Par statut")).toBeInTheDocument();

    // Block title
    expect(screen.getByText("Répartition par priorité")).toBeInTheDocument();

    // Priority legend labels
    expect(screen.getByText("Critique")).toBeInTheDocument();
    expect(screen.getByText("Haute")).toBeInTheDocument();
    expect(screen.getByText("Normale")).toBeInTheDocument();
    expect(screen.getByText("Basse")).toBeInTheDocument();

    // Status legend labels
    expect(screen.getByText("À faire")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.getByText("En révision")).toBeInTheDocument();
    expect(screen.getByText("Bloquée")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();

    // Total values in center
    const priorityTotal = 3 + 7 + 12 + 2; // 24
    const statusTotal = 5 + 8 + 3 + 1 + 7; // 24
    expect(screen.getAllByText(String(priorityTotal)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(statusTotal)).length).toBeGreaterThan(0);
  });

  it("displays error message when the API call fails", async () => {
    (analyticsService.getAdvancedTasksBreakdown as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    render(
      <Wrapper>
        <TasksBreakdown />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Erreur de chargement")).toBeInTheDocument();
    });

    // Charts should not be rendered
    expect(screen.queryAllByTestId("pie-chart")).toHaveLength(0);
  });

  it("displays empty state when all task counts are zero", async () => {
    (analyticsService.getAdvancedTasksBreakdown as jest.Mock).mockResolvedValue(
      {
        byPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0, LOW: 0 },
        byStatus: { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, BLOCKED: 0, DONE: 0 },
      },
    );

    render(
      <Wrapper>
        <TasksBreakdown />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Aucune tâche à afficher")).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId("pie-chart")).toHaveLength(0);
  });

  it("passes projectIds to the service", async () => {
    (analyticsService.getAdvancedTasksBreakdown as jest.Mock).mockResolvedValue(
      MOCK_DATA,
    );

    const projectIds = ["proj-1", "proj-2"];

    render(
      <Wrapper>
        <TasksBreakdown projectIds={projectIds} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(
        analyticsService.getAdvancedTasksBreakdown,
      ).toHaveBeenCalledWith(projectIds);
    });
  });
});
