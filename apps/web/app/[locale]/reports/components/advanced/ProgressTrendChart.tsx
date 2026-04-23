"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import { format, parseISO, subDays, subMonths, subYears } from "date-fns";
import { analyticsService } from "@/services/analytics.service";

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  dateRange?: "7d" | "30d" | "90d" | "1y";
  projectIds?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function dateRangeToIso(range: "7d" | "30d" | "90d" | "1y"): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = now.toISOString();
  switch (range) {
    case "7d":
      return { from: subDays(now, 7).toISOString(), to };
    case "30d":
      return { from: subMonths(now, 1).toISOString(), to };
    case "90d":
      return { from: subMonths(now, 3).toISOString(), to };
    case "1y":
      return { from: subYears(now, 1).toISOString(), to };
  }
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM");
  } catch {
    return iso;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Custom tooltip
// ────────────────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 shadow-sm text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-blue-600">
        {Math.round(payload[0].value)}&nbsp;%
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function ProgressTrendChart({
  dateRange = "30d",
  projectIds,
}: Props) {
  const t = useTranslations("admin.reports.analytics");

  // Compute ISO from/to once per dateRange change so queryKey stays stable
  const { from, to } = useMemo(() => dateRangeToIso(dateRange), [dateRange]);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "analytics",
      "advanced",
      "snapshots",
      { projectIds: projectIds ?? [], from, to },
    ],
    queryFn: () =>
      analyticsService.getAdvancedSnapshots({ projectIds, from, to }),
    staleTime: 5 * 60 * 1000,
  });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-[280px] animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {t("progressTrend")}
        </h3>
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("loadError")}
        </div>
      </div>
    );
  }

  const portfolioAverage = data?.portfolioAverage ?? [];

  // ── Empty ────────────────────────────────────────────────────────────────
  if (portfolioAverage.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {t("progressTrend")}
        </h3>
        <p className="text-sm text-gray-500">{t("noData")}</p>
      </div>
    );
  }

  // ── Map data for recharts ─────────────────────────────────────────────────
  const chartData = portfolioAverage.map((point) => ({
    date: formatDate(point.date),
    progress: point.progress,
  }));

  // ── Chart ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("progressTrend")}
      </h3>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="progress"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#2563eb" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProgressTrendChart;
