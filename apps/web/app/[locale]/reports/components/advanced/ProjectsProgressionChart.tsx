"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, subYears } from "date-fns";
import { useTranslations } from "next-intl";
import {
  analyticsService,
  type ProjectSeries,
  type SnapshotPoint,
} from "@/services/analytics.service";

// ─── Palette ──────────────────────────────────────────────────────────────────
// 10 hex values from Tailwind 500-level colours, visually distinct.
const SERIES_COLORS: readonly string[] = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#64748b", // slate-500
] as const;

const MAX_SERIES = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Props {
  dateRange?: "7d" | "30d" | "90d" | "1y";
  projectIds?: string[];
}

// Unified chart row: { date: "dd/MM", [projectId]: progress, ... }
type ChartRow = Record<string, string | number>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDateRange(range: "7d" | "30d" | "90d" | "1y"): {
  from: string;
  to: string;
} {
  const now = new Date();
  const from =
    range === "1y" ? subYears(now, 1) : subDays(now, parseInt(range, 10));
  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}

function buildChartData(series: ProjectSeries[]): ChartRow[] {
  // Collect all dates across all series, deduplicated and sorted
  const dateMap = new Map<string, ChartRow>();

  for (const project of series) {
    for (const point of project.points) {
      const label = format(new Date(point.date), "dd/MM");
      const isoDay = point.date.substring(0, 10); // YYYY-MM-DD as sort key

      if (!dateMap.has(isoDay)) {
        dateMap.set(isoDay, { date: label, _isoDay: isoDay });
      }
      const row = dateMap.get(isoDay)!;
      row[project.projectId] = point.progress;
    }
  }

  return Array.from(dateMap.values())
    .sort((a, b) => String(a._isoDay).localeCompare(String(b._isoDay)))
    .map(({ _isoDay: _drop, ...rest }) => rest);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-lg text-sm">
      <p className="mb-2 font-semibold text-gray-700">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600 truncate max-w-[160px]">
            {entry.name}
          </span>
          <span className="ml-auto font-medium text-gray-900">
            {entry.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectsProgressionChart({
  dateRange = "30d",
  projectIds,
}: Props) {
  const t = useTranslations("admin.reports.analytics");

  // Stable from/to — only recomputes when dateRange changes
  const { from, to } = useMemo(() => buildDateRange(dateRange), [dateRange]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "advanced", "snapshots", { projectIds, from, to }],
    queryFn: () => analyticsService.getAdvancedSnapshots({ projectIds, from, to }),
    staleTime: 5 * 60 * 1000,
  });

  // Interactive legend toggle: maps projectId → hidden boolean
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  // Cap at 10 series for visual clarity
  const visibleSeries: ProjectSeries[] = useMemo(() => {
    if (!data?.perProject) return [];
    return data.perProject.slice(0, MAX_SERIES);
  }, [data]);

  const chartData: ChartRow[] = useMemo(
    () => buildChartData(visibleSeries),
    [visibleSeries],
  );

  const tooManySeries =
    (data?.perProject?.length ?? 0) > MAX_SERIES;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-[280px] animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {t("projectProgression")}
        </h3>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-600">
          {t("loadError")}
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!visibleSeries.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {t("projectProgression")}
        </h3>
        <p className="py-12 text-center text-gray-500">{t("noData")}</p>
      </div>
    );
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("projectProgression")}
      </h3>

      {tooManySeries && (
        <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          {t("tooManyProjectsWarning")}
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            onClick={(entry) => {
              const key = entry.dataKey as string;
              setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
            }}
            formatter={(value: string) => (
              <span className="text-sm text-gray-700">{value}</span>
            )}
          />
          {visibleSeries.map((series, index) => (
            <Line
              key={series.projectId}
              type="monotone"
              dataKey={series.projectId}
              name={series.name}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              hide={hiddenSeries[series.projectId] ?? false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProjectsProgressionChart;
