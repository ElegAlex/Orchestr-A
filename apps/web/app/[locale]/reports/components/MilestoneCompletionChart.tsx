"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";

interface MilestoneCompletionChartProps {
  dateRange: string;
  projectId?: string;
}

interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  project?: {
    id: string;
    name: string;
  };
}

interface ProjectMilestones {
  projectName: string;
  completed: Milestone[];
  late: Milestone[];
  upcoming: Milestone[];
}

export function MilestoneCompletionChart({
  dateRange,
  projectId,
}: MilestoneCompletionChartProps) {
  const t = useTranslations("admin.reports.analytics");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMilestone, setHoveredMilestone] = useState<Milestone | null>(
    null,
  );

  const loadMilestones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = projectId
        ? `/milestones?projectId=${projectId}`
        : "/milestones";
      const res = await api.get(url);
      const data = res.data;
      setMilestones(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Error loading milestones:", err);
      setError("Impossible de charger les jalons.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones, dateRange]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          🎯 {t("milestoneCompletion")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          🎯 {t("milestoneCompletion")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">
          {t("noMilestoneDefined")}
        </p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueMilestones = milestones.filter((m) => new Date(m.dueDate) <= today);
  const onTime = dueMilestones.filter((m) => m.status === "COMPLETED");
  const late = dueMilestones.filter((m) => m.status !== "COMPLETED");
  const upcoming = milestones.filter((m) => new Date(m.dueDate) > today);

  const totalDue = dueMilestones.length;
  const onTimeCount = onTime.length;
  const percentage =
    totalDue > 0 ? Math.round((onTimeCount / totalDue) * 100) : 0;

  const kpiColor =
    percentage >= 80 ? "#22c55e" : percentage >= 50 ? "#f59e0b" : "#ef4444";
  const kpiColorClass =
    percentage >= 80
      ? "text-green-500"
      : percentage >= 50
        ? "text-amber-500"
        : "text-red-500";

  // Group milestones by project
  const projectMap = new Map<string, ProjectMilestones>();
  for (const m of milestones) {
    const projectKey = m.project?.id || "unassigned";
    const projectName = m.project?.name || "Sans projet";
    if (!projectMap.has(projectKey)) {
      projectMap.set(projectKey, {
        projectName,
        completed: [],
        late: [],
        upcoming: [],
      });
    }
    const group = projectMap.get(projectKey)!;
    const dueDate = new Date(m.dueDate);
    if (dueDate > today) {
      group.upcoming.push(m);
    } else if (m.status === "COMPLETED") {
      group.completed.push(m);
    } else {
      group.late.push(m);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        🎯 {t("milestoneCompletion")}
      </h3>

      {/* Main KPI */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-2">
          <span className={`text-4xl font-bold ${kpiColorClass}`}>
            {onTimeCount} / {totalDue}
          </span>
          <span className="text-sm text-gray-500">{t("milestonesOnTime")}</span>
        </div>
        <div
          className="text-2xl font-semibold mt-1"
          style={{ color: kpiColor }}
        >
          {percentage}%
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span>
            {onTimeCount} {onTimeCount > 1 ? "terminés" : "terminé"}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
            {late.length} en retard
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span>
            {upcoming.length} à venir
          </span>
        </div>
      </div>

      {/* Bars per project */}
      <div className="space-y-3">
        {Array.from(projectMap.entries()).map(([key, group]) => {
          const total =
            group.completed.length + group.late.length + group.upcoming.length;
          if (total === 0) return null;

          const completedPct = (group.completed.length / total) * 100;
          const latePct = (group.late.length / total) * 100;
          const upcomingPct = (group.upcoming.length / total) * 100;

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[70%]">
                  {group.projectName}
                </span>
                <span className="text-xs text-gray-400">
                  {group.completed.length}/{total}
                </span>
              </div>
              <div className="relative h-6 flex rounded-md overflow-hidden bg-gray-100">
                {completedPct > 0 && (
                  <div
                    className="h-full bg-green-500 relative group"
                    style={{ width: `${completedPct}%` }}
                  >
                    {group.completed.map((m) => (
                      <div
                        key={m.id}
                        className="absolute inset-0"
                        onMouseEnter={() => setHoveredMilestone(m)}
                        onMouseLeave={() => setHoveredMilestone(null)}
                      />
                    ))}
                  </div>
                )}
                {latePct > 0 && (
                  <div
                    className="h-full bg-red-500 relative group"
                    style={{ width: `${latePct}%` }}
                  >
                    {group.late.map((m) => (
                      <div
                        key={m.id}
                        className="absolute inset-0"
                        onMouseEnter={() => setHoveredMilestone(m)}
                        onMouseLeave={() => setHoveredMilestone(null)}
                      />
                    ))}
                  </div>
                )}
                {upcomingPct > 0 && (
                  <div
                    className="h-full bg-gray-300 relative group"
                    style={{ width: `${upcomingPct}%` }}
                  >
                    {group.upcoming.map((m) => (
                      <div
                        key={m.id}
                        className="absolute inset-0"
                        onMouseEnter={() => setHoveredMilestone(m)}
                        onMouseLeave={() => setHoveredMilestone(null)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredMilestone && (
        <div className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none bottom-4 left-1/2 -translate-x-1/2">
          <p className="font-semibold">{hoveredMilestone.title}</p>
          <p>
            {new Date(hoveredMilestone.dueDate).toLocaleDateString("fr-FR")} -{" "}
            {hoveredMilestone.status === "COMPLETED"
              ? "Terminé"
              : new Date(hoveredMilestone.dueDate) <= today
                ? "En retard"
                : "A venir"}
          </p>
        </div>
      )}
    </div>
  );
}
