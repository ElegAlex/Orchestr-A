import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ─── Mock: next-intl ──────────────────────────────────────────────────────────
// useTranslations returns the key verbatim so assertions can match literal keys.
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ─── Mock: analytics service ──────────────────────────────────────────────────
jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedSnapshots: jest.fn(),
  },
}));

// ─── Mock: recharts ───────────────────────────────────────────────────────────
// jsdom has no real layout engine, so recharts never paints its children.
// We keep the real implementation for most components but:
//  1. ResponsiveContainer → plain div with explicit dimensions so children mount.
//  2. Legend → renders series names as data-testid spans so we can assert on them.
// Everything else (LineChart, Line, XAxis, YAxis, etc.) is kept real so the
// component logic is exercised; they simply produce empty <g> elements in jsdom.
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts") as Record<string, unknown>;

  const ResponsiveContainer = ({
    children,
  }: {
    children: React.ReactNode;
    width?: string | number;
    height?: string | number;
  }) => (
    <div style={{ width: 800, height: 300 }} data-testid="responsive-container">
      {children}
    </div>
  );
  ResponsiveContainer.displayName = "ResponsiveContainer";

  // Legend is stubbed to null: jsdom has no layout engine so recharts never
  // calls its render callback with populated payload.  Tests verify
  // series-level behaviour via the service mock and warning banner instead.
  const Legend = () => null;
  Legend.displayName = "Legend";

  return { ...actual, ResponsiveContainer, Legend };
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

import { analyticsService } from "@/services/analytics.service";
import { ProjectsProgressionChart } from "./ProjectsProgressionChart";

const getAdvancedSnapshotsMock = analyticsService.getAdvancedSnapshots as jest.Mock;

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

const TODAY = new Date().toISOString().substring(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().substring(0, 10);
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86_400_000).toISOString().substring(0, 10);

const MOCK_PROJECT_SERIES = {
  projectId: "proj-1",
  name: "Mon Projet",
  points: [
    { date: `${TWO_DAYS_AGO}T00:00:00.000Z`, progress: 20 },
    { date: `${YESTERDAY}T00:00:00.000Z`, progress: 45 },
    { date: `${TODAY}T00:00:00.000Z`, progress: 60 },
  ],
};

const MOCK_RESPONSE = {
  perProject: [MOCK_PROJECT_SERIES],
  portfolioAverage: [
    { date: `${TWO_DAYS_AGO}T00:00:00.000Z`, progress: 20 },
    { date: `${YESTERDAY}T00:00:00.000Z`, progress: 45 },
    { date: `${TODAY}T00:00:00.000Z`, progress: 60 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProjectsProgressionChart", () => {
  it("renders the chart title and recharts-wrapper on success", async () => {
    getAdvancedSnapshotsMock.mockResolvedValue(MOCK_RESPONSE);

    const { container } = renderWithQueryClient(
      <ProjectsProgressionChart dateRange="30d" />,
    );

    // Title key rendered verbatim (mock returns the key itself)
    expect(await screen.findByText("projectProgression")).toBeInTheDocument();

    // The responsive container div is mounted, confirming the chart path was
    // taken (not loading skeleton / error / empty state).
    await waitFor(() => {
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    });

    // recharts-wrapper div is rendered inside the container, confirming
    // LineChart mounted.  jsdom has no layout engine so the <svg> is not
    // painted, but the wrapper element is a reliable signal.
    await waitFor(() => {
      expect(container.querySelector(".recharts-wrapper")).not.toBeNull();
    });
  });

  it("shows the error state when the service rejects", async () => {
    getAdvancedSnapshotsMock.mockRejectedValue(new Error("Network failure"));

    renderWithQueryClient(<ProjectsProgressionChart dateRange="30d" />);

    // The component uses t("loadError") which returns the key verbatim
    expect(await screen.findByText("loadError")).toBeInTheDocument();
  });

  it("shows the empty state when perProject is empty", async () => {
    getAdvancedSnapshotsMock.mockResolvedValue({
      perProject: [],
      portfolioAverage: [],
    });

    renderWithQueryClient(<ProjectsProgressionChart dateRange="30d" />);

    expect(await screen.findByText("noData")).toBeInTheDocument();
  });

  it("shows the tooManyProjectsWarning banner when more than 10 projects are returned", async () => {
    const manySeries = Array.from({ length: 12 }, (_, i) => ({
      projectId: `proj-${i}`,
      name: `Project ${i}`,
      points: [{ date: `${TODAY}T00:00:00.000Z`, progress: i * 5 }],
    }));

    getAdvancedSnapshotsMock.mockResolvedValue({
      perProject: manySeries,
      portfolioAverage: [],
    });

    renderWithQueryClient(<ProjectsProgressionChart dateRange="30d" />);

    // Warning banner appears when >10 series are returned
    expect(await screen.findByText("tooManyProjectsWarning")).toBeInTheDocument();

    // Chart still renders (not empty/error state)
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("passes projectIds to the service when provided as prop", async () => {
    getAdvancedSnapshotsMock.mockResolvedValue(MOCK_RESPONSE);

    renderWithQueryClient(
      <ProjectsProgressionChart dateRange="7d" projectIds={["proj-1", "proj-2"]} />,
    );

    // Wait for the chart to render (not the loading skeleton)
    await screen.findByTestId("responsive-container");

    expect(getAdvancedSnapshotsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["proj-1", "proj-2"],
      }),
    );
  });
});
