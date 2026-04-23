"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle, PlusCircle, AlertTriangle } from "lucide-react";
import { analyticsService } from "@/services/analytics.service";

interface Props {
  days?: number;
}

function ratioColorClass(ratio: number): string {
  if (ratio >= 0.8) return "text-green-600";
  if (ratio >= 0.5) return "text-orange-500";
  return "text-red-600";
}

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

export function RecentActivity({ days = 30 }: Props) {
  const t = useTranslations("admin.reports.analytics");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "recent-activity", { days }],
    queryFn: () => analyticsService.getAdvancedRecentActivity(days),
    staleTime: 1 * 60 * 1000,
  });

  const pct = data ? Math.round(data.completionRatio * 100) : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("recentActivity")}
      </h3>

      {isLoading && <SkeletonTiles />}

      {isError && <p className="text-sm text-red-600">{t("loadError")}</p>}

      {!isLoading && !isError && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      )}
    </div>
  );
}

export default RecentActivity;
