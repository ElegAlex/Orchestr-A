"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  analyticsService,
  type ProjectHealthRow,
  type HealthStatus,
} from "@/services/analytics.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = "name" | "progressPct" | "overdue" | "activeTasks" | "health";
type SortDir = "asc" | "desc";

// health severity: red=0 > orange=1 > green=2
const HEALTH_ORDER: Record<HealthStatus, number> = {
  red: 0,
  orange: 1,
  green: 2,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortRows(
  rows: ProjectHealthRow[],
  key: SortKey,
  dir: SortDir,
): ProjectHealthRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "progressPct":
        cmp = a.progressPct - b.progressPct;
        break;
      case "overdue":
        cmp = a.milestones.overdue - b.milestones.overdue;
        break;
      case "activeTasks":
        cmp = a.activeTasks - b.activeTasks;
        break;
      case "health":
        cmp = HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonTable() {
  return (
    <table className="w-full text-sm">
      <tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <tr key={i} className="border-t border-gray-100">
            {Array.from({ length: 5 }).map((_, j) => (
              <td key={j} className="px-4 py-3">
                <div className="h-4 rounded bg-gray-100 animate-pulse" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface HealthBadgeProps {
  health: HealthStatus;
  label: string;
}

function HealthBadge({ health, label }: HealthBadgeProps) {
  const cls: Record<HealthStatus, string> = {
    green: "bg-green-100 text-green-800",
    orange: "bg-orange-100 text-orange-800",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[health]}`}
    >
      {label}
    </span>
  );
}

interface SortIconProps {
  col: SortKey;
  current: SortKey;
  dir: SortDir;
}

function SortIcon({ col, current, dir }: SortIconProps) {
  if (col !== current) {
    return <ArrowUp className="ml-1 inline h-3 w-3 text-gray-300" />;
  }
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3 text-blue-600" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3 text-blue-600" />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectHealthTable() {
  const t = useTranslations("admin.reports.analytics");

  const [sortKey, setSortKey] = useState<SortKey>("health");
  const [sortDir, setSortDir] = useState<SortDir>("asc"); // asc = red first (order 0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "advanced", "project-health"],
    queryFn: () => analyticsService.getAdvancedProjectHealth(),
    staleTime: 5 * 60 * 1000,
  });

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  }

  const sorted = data ? sortRows(data, sortKey, sortDir) : [];

  function thClass(col: SortKey) {
    return `cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900 ${
      sortKey === col ? "text-blue-600" : ""
    }`;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        {t("projectHealth")}
      </h3>

      {isLoading && <SkeletonTable />}

      {isError && (
        <p className="text-sm text-red-600">{t("loadError")}</p>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <p className="text-sm text-gray-500">{t("noProjectsToDisplay")}</p>
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className={thClass("name")}
                  onClick={() => handleSort("name")}
                >
                  {t("cols.project")}
                  <SortIcon col="name" current={sortKey} dir={sortDir} />
                </th>
                <th
                  className={thClass("progressPct")}
                  onClick={() => handleSort("progressPct")}
                >
                  {t("cols.progress")}
                  <SortIcon col="progressPct" current={sortKey} dir={sortDir} />
                </th>
                <th
                  className={thClass("overdue")}
                  onClick={() => handleSort("overdue")}
                >
                  {t("cols.milestones")}
                  <SortIcon col="overdue" current={sortKey} dir={sortDir} />
                </th>
                <th
                  className={thClass("activeTasks")}
                  onClick={() => handleSort("activeTasks")}
                >
                  {t("cols.activeTasks")}
                  <SortIcon col="activeTasks" current={sortKey} dir={sortDir} />
                </th>
                <th
                  className={thClass("health")}
                  onClick={() => handleSort("health")}
                >
                  {t("cols.health")}
                  <SortIcon col="health" current={sortKey} dir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((row) => (
                <tr
                  key={row.projectId}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Project name */}
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.name}
                  </td>

                  {/* Progress */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded bg-gray-200">
                        <div
                          className="h-2 rounded bg-blue-500"
                          style={{ width: `${Math.min(100, row.progressPct)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 tabular-nums">
                        {row.progressPct} %
                      </span>
                    </div>
                  </td>

                  {/* Milestones */}
                  <td className="px-4 py-3">
                    <span className="text-green-700">
                      {row.milestones.reached} ✓
                    </span>
                    {" · "}
                    <span className="text-red-600">
                      {row.milestones.overdue} ⚠
                    </span>
                    {" · "}
                    <span className="text-gray-500">
                      {row.milestones.upcoming} ⏳
                    </span>
                  </td>

                  {/* Active tasks */}
                  <td className="px-4 py-3 tabular-nums text-gray-700">
                    {row.activeTasks}
                  </td>

                  {/* Health badge */}
                  <td className="px-4 py-3">
                    <HealthBadge
                      health={row.health}
                      label={t(`health.${row.health}`)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ProjectHealthTable;
