import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MilestonesCompletion from "./MilestonesCompletion";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      milestoneCompletion: "Milestone Completion",
      noMilestoneDefined: "No milestones defined",
      loadError: "Failed to load data",
      "kpi.onTimeOver": `${params?.onTime ?? ""} milestones reached on time of ${params?.total ?? ""} due`,
      "kpi.summary": `${params?.completed ?? ""} done · ${params?.overdue ?? ""} late · ${params?.upcoming ?? ""} upcoming`,
    };
    return map[key] ?? key;
  },
}));

jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedMilestonesCompletion: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { analyticsService } from "@/services/analytics.service";

const mockedGetMilestones =
  analyticsService.getAdvancedMilestonesCompletion as jest.Mock;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderComponent(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MilestonesCompletion />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MilestonesCompletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders success state with KPI and project list", async () => {
    mockedGetMilestones.mockResolvedValue({
      onTime: 26,
      total: 32,
      ratio: 0.8125,
      completed: 26,
      overdue: 6,
      upcoming: 8,
      details: [
        {
          projectId: "p2",
          projectName: "Projet Beta",
          milestoneId: "m2",
          milestoneName: "Jalon Beta",
          dueDate: "2026-03-01",
          daysFromNow: -4,
          status: "OVERDUE",
          reachedInProject: 3,
          totalInProject: 5,
        },
        {
          projectId: "p1",
          projectName: "Projet Alpha",
          milestoneId: "m1",
          milestoneName: "Jalon Alpha",
          dueDate: "2026-05-01",
          daysFromNow: 8,
          status: "UPCOMING",
          reachedInProject: 5,
          totalInProject: 5,
        },
      ],
      byProject: [
        { projectId: "p1", name: "Projet Alpha", reached: 5, total: 5 },
        { projectId: "p2", name: "Projet Beta", reached: 3, total: 5 },
        { projectId: "p3", name: "Projet Gamma", reached: 1, total: 4 },
      ],
    });

    renderComponent(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText(/26 \/ 32 atteints à temps/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("(81 %)")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Projet Alpha/)).toBeInTheDocument();
      expect(screen.getByText(/Projet Beta/)).toBeInTheDocument();
    });

    expect(screen.getByText("Terminés")).toBeInTheDocument();
    expect(screen.getByText("En retard")).toBeInTheDocument();
    expect(screen.getByText("À venir")).toBeInTheDocument();
  });

  it("renders error state when the query rejects", async () => {
    mockedGetMilestones.mockRejectedValue(new Error("Network error"));

    renderComponent(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    });
  });

  it("renders empty state when total and byProject are both zero/empty", async () => {
    mockedGetMilestones.mockResolvedValue({
      onTime: 0,
      total: 0,
      ratio: 0,
      completed: 0,
      overdue: 0,
      upcoming: 0,
      details: [],
      byProject: [],
    });

    renderComponent(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText("No milestones defined")).toBeInTheDocument();
    });
  });

  it("applies green color class when ratio >= 0.8", async () => {
    mockedGetMilestones.mockResolvedValue({
      onTime: 8,
      total: 10,
      ratio: 0.8,
      completed: 8,
      overdue: 2,
      upcoming: 0,
      details: [],
      byProject: [{ projectId: "p1", name: "Projet X", reached: 8, total: 10 }],
    });

    renderComponent(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText("(80 %)")).toBeInTheDocument();
    });
  });

  it("applies orange color class when 0.5 <= ratio < 0.8", async () => {
    mockedGetMilestones.mockResolvedValue({
      onTime: 6,
      total: 10,
      ratio: 0.6,
      completed: 6,
      overdue: 4,
      upcoming: 0,
      details: [],
      byProject: [{ projectId: "p1", name: "Projet X", reached: 6, total: 10 }],
    });

    renderComponent(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText("(60 %)")).toBeInTheDocument();
    });
  });

  it("applies red color class when ratio < 0.5", async () => {
    mockedGetMilestones.mockResolvedValue({
      onTime: 3,
      total: 10,
      ratio: 0.3,
      completed: 3,
      overdue: 7,
      upcoming: 0,
      details: [],
      byProject: [{ projectId: "p1", name: "Projet X", reached: 3, total: 10 }],
    });

    renderComponent(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText("(30 %)")).toBeInTheDocument();
    });
  });
});
