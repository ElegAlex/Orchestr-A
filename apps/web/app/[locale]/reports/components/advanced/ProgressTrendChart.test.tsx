import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// ─── Mock recharts ──────────────────────────────────────────────────────────
// ResponsiveContainer returns zero dimensions in jsdom; wrapping it with a
// fixed-size div forces recharts to render a real <svg>.
jest.mock("recharts", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const original = jest.requireActual<typeof import("recharts")>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <div style={{ width: 500, height: 300 }}>
        {children}
      </div>
    ),
  };
});

// ─── Mock next-intl ─────────────────────────────────────────────────────────
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ─── Mock analyticsService ──────────────────────────────────────────────────
const mockGetAdvancedSnapshots = jest.fn();
jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedSnapshots: (...args: unknown[]) =>
      mockGetAdvancedSnapshots(...args),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No retries in tests — failing fast lets error state appear immediately
        retry: false,
      },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ─── Import component after mocks are set ────────────────────────────────────
import { ProgressTrendChart } from "./ProgressTrendChart";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockPortfolioAverage = [
  { date: "2026-03-01T00:00:00.000Z", progress: 10 },
  { date: "2026-03-08T00:00:00.000Z", progress: 25 },
  { date: "2026-03-15T00:00:00.000Z", progress: 42 },
  { date: "2026-03-22T00:00:00.000Z", progress: 60 },
  { date: "2026-03-29T00:00:00.000Z", progress: 75 },
];

const mockResponse = {
  perProject: [],
  portfolioAverage: mockPortfolioAverage,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProgressTrendChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and chart container on success with 5 data points", async () => {
    mockGetAdvancedSnapshots.mockResolvedValue(mockResponse);

    render(<ProgressTrendChart dateRange="30d" />, { wrapper: Wrapper });

    // Title must appear once data arrives
    await waitFor(() => {
      expect(screen.getByText("progressTrend")).toBeInTheDocument();
    });

    // The recharts wrapper div confirms the chart was mounted
    await waitFor(() => {
      expect(
        document.querySelector(".recharts-wrapper"),
      ).toBeInTheDocument();
    });
  });

  it("displays error state when the query rejects", async () => {
    mockGetAdvancedSnapshots.mockRejectedValue(new Error("Network error"));

    render(<ProgressTrendChart dateRange="30d" />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });
});
