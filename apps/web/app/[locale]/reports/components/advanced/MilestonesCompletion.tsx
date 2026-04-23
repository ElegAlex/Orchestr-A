"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  analyticsService,
  MilestoneByProject,
} from "@/services/analytics.service";

function ratioColorClass(ratio: number): string {
  if (ratio >= 0.8) return "text-green-600";
  if (ratio >= 0.5) return "text-orange-500";
  return "text-red-600";
}

function ProgressBar({ reached, total }: { reached: number; total: number }) {
  const pct = total > 0 ? Math.round((reached / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-700 whitespace-nowrap">
        {reached} / {total}
      </span>
    </div>
  );
}

export default function MilestonesCompletion() {
  const t = useTranslations("admin.reports.analytics");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "milestones-completion"],
    queryFn: () => analyticsService.getAdvancedMilestonesCompletion(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("milestoneCompletion")}
      </h3>

      {isLoading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-8 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-600">{t("loadError")}</p>
      )}

      {!isLoading && !isError && data && (
        <>
          {data.total === 0 && data.byProject.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noMilestoneDefined")}</p>
          ) : (
            <>
              {/* KPI principal */}
              <p className="text-3xl font-bold text-gray-900">
                {t("kpi.onTimeOver", {
                  onTime: data.onTime,
                  total: data.total,
                })}{" "}
                <span
                  className={ratioColorClass(data.ratio)}
                  data-testid="ratio-value"
                >
                  ({Math.round(data.ratio * 100)}%)
                </span>
              </p>

              {/* Sous-ligne */}
              <p className="text-sm text-gray-600 mt-2">
                {t("kpi.summary", {
                  completed: data.completed,
                  overdue: data.overdue,
                  upcoming: data.upcoming,
                })}
              </p>

              {/* Liste byProject */}
              {data.byProject.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">
                  {t("noMilestoneDefined")}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {[...data.byProject]
                    .sort((a: MilestoneByProject, b: MilestoneByProject) => {
                      const ra = a.total > 0 ? a.reached / a.total : 0;
                      const rb = b.total > 0 ? b.reached / b.total : 0;
                      return rb - ra;
                    })
                    .map((project: MilestoneByProject) => (
                      <li key={project.projectId}>
                        <div className="mb-1">
                          <span className="text-sm text-gray-800">
                            {project.name}
                          </span>
                        </div>
                        <ProgressBar
                          reached={project.reached}
                          total={project.total}
                        />
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
