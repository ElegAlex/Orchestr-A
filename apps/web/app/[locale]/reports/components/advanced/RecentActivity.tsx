"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";
import { CheckCircle, PlusCircle, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { analyticsService } from "@/services/analytics.service";

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  days?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM");
  } catch {
    return iso;
  }
}

/** Ratio ∈ [0..1] → adaptive text colour class */
function ratioColorClass(ratio: number): string {
  if (ratio >= 0.8) return "text-green-600";
  if (ratio >= 0.5) return "text-orange-500";
  return "text-red-600";
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function SkeletonTiles() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-100 bg-gray-50 p-4"
        >
          <div className="mb-2 h-8 w-16 rounded bg-gray-200" />
          <div className="h-4 w-24 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function SkeletonLine() {
  return <div className="mt-6 h-[180px] animate-pulse rounded bg-gray-100" />;
}

interface TooltipPayloadItem {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 shadow-sm text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-blue-600">{payload[0].value}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function RecentActivity({ days = 30 }: Props) {
  const t = useTranslations("admin.reports.analytics");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "recent-activity", { days }],
    queryFn: () => analyticsService.getAdvancedRecentActivity(days),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const pct = data ? Math.round(data.completionRatio * 100) : 0;
  const allZero = data?.trend.every((p) => p.completed === 0) ?? true;

  const chartData = data?.trend.map((p) => ({
    date: formatDate(p.date),
    completed: p.completed,
  })) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("recentActivity")}
      </h3>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {isLoading && (
        <>
          <SkeletonTiles />
          <SkeletonLine />
        </>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {isError && (
        <p className="text-sm text-red-600">{t("loadError")}</p>
      )}

      {/* ── Success ─────────────────────────────────────────────────────── */}
      {!isLoading && !isError && data && (
        <>
          {/* 4 KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Tile 1 — Tâches terminées */}
            <div
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
              title={t("completedTooltip")}
            >
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.completed}
                </div>
                <div className="text-sm text-gray-500">{t("completed")}</div>
              </div>
            </div>

            {/* Tile 2 — Tâches créées */}
            <div
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
              title={t("createdTooltip")}
            >
              <PlusCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.created}
                </div>
                <div className="text-sm text-gray-500">{t("created")}</div>
              </div>
            </div>

            {/* Tile 3 — Devenues en retard */}
            <div
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
              title={t("overdueTooltip")}
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.overdue}
                </div>
                <div className="text-sm text-gray-500">{t("becameOverdue")}</div>
              </div>
            </div>

            {/* Tile 4 — Ratio complétion */}
            <div
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
              title={t("ratioTooltip")}
            >
              <div>
                <div
                  className={`text-2xl font-bold ${ratioColorClass(data.completionRatio)}`}
                >
                  <span>{pct}</span>
                  <span className="ml-0.5 text-lg">%</span>
                </div>
                <div className="text-sm text-gray-500">
                  {t("completionRatio")}
                </div>
              </div>
            </div>
          </div>

          {/* Trend sparkline */}
          <div className="mt-6">
            {allZero ? (
              <p className="text-sm text-gray-500">
                {t("noCompletionsRecent")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="recentActivityFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#recentActivityFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#3b82f6" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            <p className="mt-2 text-xs text-gray-400">
              {t("completedLastNDays", { count: days })}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default RecentActivity;
