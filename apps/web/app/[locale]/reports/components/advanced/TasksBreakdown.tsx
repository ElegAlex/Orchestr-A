"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { analyticsService } from "@/services/analytics.service";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626", // red-600
  HIGH: "#f97316",    // orange-500
  NORMAL: "#3b82f6",  // blue-500
  LOW: "#9ca3af",     // gray-400
};

const STATUS_COLORS: Record<string, string> = {
  TODO: "#9ca3af",       // gray-400
  IN_PROGRESS: "#3b82f6", // blue-500
  IN_REVIEW: "#f59e0b",   // amber-500
  BLOCKED: "#ef4444",     // red-500
  DONE: "#22c55e",        // green-500
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  projectIds?: string[];
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DonutSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[200px] w-[200px]">
        <div className="absolute inset-0 rounded-full bg-gray-100 animate-pulse" />
        <div className="absolute inset-[30px] rounded-full bg-white" />
      </div>
      <div className="space-y-2 w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
            <div className="h-3 rounded bg-gray-100 animate-pulse flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut with center total + legend
// ---------------------------------------------------------------------------

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string; label: string }>;
  total: number;
  totalLabel: string;
}

function DonutChart({ data, total, totalLabel }: DonutChartProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Chart + centered total */}
      <div className="relative h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              strokeWidth={2}
              stroke="#fff"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name: string, props: { payload?: { label: string } }) => [
                value,
                props.payload?.label ?? _name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay: total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-xs text-gray-500">{totalLabel}</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="space-y-1.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.label}</span>
            </span>
            <span className="font-medium tabular-nums text-gray-900">
              {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TasksBreakdown({ projectIds }: Props) {
  const t = useTranslations("admin.reports.analytics");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "tasks-breakdown", { projectIds }],
    queryFn: () => analyticsService.getAdvancedTasksBreakdown(projectIds),
    staleTime: 5 * 60 * 1000,
  });

  // Derived
  const priorityData = data
    ? [
        { name: "CRITICAL", value: data.byPriority.CRITICAL, color: PRIORITY_COLORS.CRITICAL, label: t("critical") },
        { name: "HIGH",     value: data.byPriority.HIGH,     color: PRIORITY_COLORS.HIGH,     label: t("high") },
        { name: "NORMAL",   value: data.byPriority.NORMAL,   color: PRIORITY_COLORS.NORMAL,   label: t("normal") },
        { name: "LOW",      value: data.byPriority.LOW,      color: PRIORITY_COLORS.LOW,       label: t("low") },
      ].filter((d) => d.value > 0)
    : [];

  const statusData = data
    ? [
        { name: "TODO",        value: data.byStatus.TODO,        color: STATUS_COLORS.TODO,        label: t("todo") },
        { name: "IN_PROGRESS", value: data.byStatus.IN_PROGRESS, color: STATUS_COLORS.IN_PROGRESS, label: t("inProgress") },
        { name: "IN_REVIEW",   value: data.byStatus.IN_REVIEW,   color: STATUS_COLORS.IN_REVIEW,   label: t("inReview") },
        { name: "BLOCKED",     value: data.byStatus.BLOCKED,     color: STATUS_COLORS.BLOCKED,     label: t("blocked") },
        { name: "DONE",        value: data.byStatus.DONE,        color: STATUS_COLORS.DONE,        label: t("done") },
      ].filter((d) => d.value > 0)
    : [];

  const priorityTotal = data
    ? Object.values(data.byPriority).reduce((a, b) => a + b, 0)
    : 0;
  const statusTotal = data
    ? Object.values(data.byStatus).reduce((a, b) => a + b, 0)
    : 0;

  const isEmpty = data && priorityTotal + statusTotal === 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("priorityDistribution")}
      </h3>

      {/* Error state */}
      {isError && (
        <p className="text-sm text-red-600">{t("loadError")}</p>
      )}

      {/* Empty state */}
      {isEmpty && (
        <p className="text-sm text-gray-500">{t("noTasksToDisplay")}</p>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 h-4 w-24 rounded bg-gray-100 animate-pulse" />
            <DonutSkeleton />
          </div>
          <div>
            <div className="mb-2 h-4 w-24 rounded bg-gray-100 animate-pulse" />
            <DonutSkeleton />
          </div>
        </div>
      )}

      {/* Data state */}
      {!isLoading && !isError && !isEmpty && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm text-gray-700 mb-2">{t("byPriority")}</h4>
            <DonutChart
              data={priorityData}
              total={priorityTotal}
              totalLabel={t("total")}
            />
          </div>
          <div>
            <h4 className="text-sm text-gray-700 mb-2">{t("byStatus")}</h4>
            <DonutChart
              data={statusData}
              total={statusTotal}
              totalLabel={t("total")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksBreakdown;
