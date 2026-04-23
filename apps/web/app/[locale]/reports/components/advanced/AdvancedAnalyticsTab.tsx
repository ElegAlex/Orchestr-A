"use client";

import { useEffect, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronDown, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { ProjectsProgressionChart } from "./ProjectsProgressionChart";
import { WorkloadChart } from "./WorkloadChart";
import MilestonesCompletion from "./MilestonesCompletion";
import { TasksBreakdown } from "./TasksBreakdown";
import { RecentActivity } from "./RecentActivity";

type DateRange = "7d" | "30d" | "90d" | "1y";

interface ProjectOption {
  id: string;
  name: string;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function dateRangeToDays(range: DateRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
  }
}

function ProjectMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: ProjectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const allSelected = selected.length === 0 || selected.length === options.length;

  const label = allSelected
    ? placeholder
    : `${selected.length} / ${options.length}`;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        {label}
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b p-2 text-xs">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-blue-600 hover:underline"
              >
                {options.length === selected.length || selected.length === 0
                  ? null
                  : "Tout sélectionner"}
              </button>
            </div>
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={
                    selected.length === 0 || selected.includes(opt.id)
                  }
                  onChange={() => toggle(opt.id)}
                  className="rounded border-gray-300"
                />
                <span className="truncate">{opt.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TabContent() {
  const t = useTranslations("admin.reports.analytics");
  const tFilters = useTranslations("admin.reports");
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/projects?status=ACTIVE")
      .then((res) => {
        if (cancelled) return;
        const list: ProjectOption[] = (res.data?.data ?? res.data ?? [])
          .filter((p: { status?: string }) => p.status === "ACTIVE")
          .map((p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
          }));
        setProjects(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const projectIdsForFilter = useMemo<string[] | undefined>(
    () => (selectedProjectIds.length > 0 ? selectedProjectIds : undefined),
    [selectedProjectIds],
  );
  const days = dateRangeToDays(dateRange);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics", "advanced"] });
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          data-testid="advanced-period-select"
        >
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
          <option value="90d">90 jours</option>
          <option value="1y">1 an</option>
        </select>

        <ProjectMultiSelect
          options={projects}
          selected={selectedProjectIds}
          onChange={setSelectedProjectIds}
          placeholder={tFilters("filters.allProjects")}
        />

        <button
          type="button"
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          data-testid="advanced-refresh-btn"
        >
          <RefreshCw className="h-4 w-4" />
          {tFilters("filters.refresh")}
        </button>
      </div>

      {/* Row 1 — Activité récente full width (top) */}
      <RecentActivity days={days} />

      {/* Row 2 — Progression projets + Workload */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProjectsProgressionChart
          dateRange={dateRange}
          projectIds={projectIdsForFilter}
        />
        <WorkloadChart />
      </div>

      {/* Row 3 — Milestones + TasksBreakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MilestonesCompletion />
        <TasksBreakdown projectIds={projectIdsForFilter} />
      </div>

      {/* unused t suppression — keep import resolved */}
      <span className="hidden">{t("recentActivity")}</span>
    </div>
  );
}

export default function AdvancedAnalyticsTab() {
  return (
    <QueryClientProvider client={queryClient}>
      <TabContent />
    </QueryClientProvider>
  );
}
