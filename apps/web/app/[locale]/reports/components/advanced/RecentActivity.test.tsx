import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// ─── Mock recharts ───────────────────────────────────────────────────────────
// ResponsiveContainer returns zero dimensions in jsdom; wrapping with a
// fixed-size div forces recharts to render a real <svg>.
jest.mock("recharts", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const original = jest.requireActual<typeof import("recharts")>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  };
});

// ─── Mock next-intl ──────────────────────────────────────────────────────────
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ─── Mock analyticsService ───────────────────────────────────────────────────
const mockGetAdvancedRecentActivity = jest.fn();
jest.mock("@/services/analytics.service", () => ({
  analyticsService: {
    getAdvancedRecentActivity: (...args: unknown[]) =>
      mockGetAdvancedRecentActivity(...args),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No retries in tests — error state appears immediately
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
import { RecentActivity } from "./RecentActivity";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTrend(days = 30, completed = 1) {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    completed,
  }));
}

const mockSuccess = {
  completed: 12,
  created: 8,
  overdue: 3,
  completionRatio: 0.6,
  trend: makeTrend(30, 1),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RecentActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the 4 KPI values on success", async () => {
    mockGetAdvancedRecentActivity.mockResolvedValue(mockSuccess);

    render(<RecentActivity />, { wrapper: Wrapper });

    // completed = 12
    expect(await screen.findByText("12")).toBeInTheDocument();
    // created = 8
    expect(await screen.findByText("8")).toBeInTheDocument();
    // overdue = 3
    expect(await screen.findByText("3")).toBeInTheDocument();
    // completionRatio = 0.6 → "60" (digit split from "%" sign)
    expect(await screen.findByText("60")).toBeInTheDocument();
  });

  it("displays error state when the query rejects", async () => {
    mockGetAdvancedRecentActivity.mockRejectedValue(new Error("Network error"));

    render(<RecentActivity />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("loadError")).toBeInTheDocument();
    });
  });
});
