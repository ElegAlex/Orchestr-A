"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  analyticsService,
  type WorkloadUser,
} from "@/services/analytics.service";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface Props {
  limit?: number;
}

interface ChartDatum {
  name: string;
  TODO: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  BLOCKED: number;
  total: number;
}

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const STATUS_COLORS = {
  TODO: "#9ca3af",
  IN_PROGRESS: "#3b82f6",
  IN_REVIEW: "#f59e0b",
  BLOCKED: "#ef4444",
} as const;

// -------------------------------------------------------------------
// Custom Tooltip
// -------------------------------------------------------------------

interface TooltipPayloadEntry {
  name: string;
  value: number;
  fill: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function WorkloadTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);

  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-md text-sm">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-900">{entry.value}</span>
        </div>
      ))}
      <div className="mt-1 border-t border-gray-100 pt-1 font-semibold text-gray-900">
        Total: {total}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// WorkloadChart
// -------------------------------------------------------------------

export function WorkloadChart({ limit = 15 }: Props) {
  const t = useTranslations("admin.reports.analytics");

  const { data, isPending, isError } = useQuery({
    queryKey: ["analytics", "advanced", "workload", { limit }],
    queryFn: () => analyticsService.getAdvancedWorkload(limit),
    staleTime: 5 * 60 * 1000,
  });

  // --- Loading ---
  if (isPending) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div
          className="animate-pulse rounded bg-gray-100"
          style={{ height: 480 }}
        />
      </div>
    );
  }

  // --- Error ---
  if (isError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {t("collaboratorWorkload")}
        </h3>
        <p className="text-sm text-red-600">{t("loadError")}</p>
      </div>
    );
  }

  // --- Empty ---
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {t("collaboratorWorkload")}
        </h3>
        <p className="text-sm text-gray-500">{t("noActiveTasks")}</p>
      </div>
    );
  }

  // --- Flatten nested counts for recharts ---
  const chartData: ChartDatum[] = data.map((u: WorkloadUser) => ({
    name: u.name,
    TODO: u.counts.TODO,
    IN_PROGRESS: u.counts.IN_PROGRESS,
    IN_REVIEW: u.counts.IN_REVIEW,
    BLOCKED: u.counts.BLOCKED,
    total: u.total,
  }));

  const chartHeight = Math.max(data.length * 32, 250);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("collaboratorWorkload")}
      </h3>

      <BarChart
        layout="vertical"
        width={700}
        height={chartHeight}
        data={chartData}
        margin={{ top: 4, right: 32, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={140} />
        <Tooltip content={<WorkloadTooltip />} />
        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />

        <Bar dataKey="TODO" stackId="status" fill={STATUS_COLORS.TODO} name="TODO" />
        <Bar dataKey="IN_PROGRESS" stackId="status" fill={STATUS_COLORS.IN_PROGRESS} name="IN_PROGRESS" />
        <Bar dataKey="IN_REVIEW" stackId="status" fill={STATUS_COLORS.IN_REVIEW} name="IN_REVIEW" />
        <Bar dataKey="BLOCKED" stackId="status" fill={STATUS_COLORS.BLOCKED} name="BLOCKED" />
      </BarChart>
    </div>
  );
}
