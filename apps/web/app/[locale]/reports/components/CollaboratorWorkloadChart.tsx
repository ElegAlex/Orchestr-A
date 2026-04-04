"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";

interface CollaboratorWorkloadChartProps {
  dateRange: string;
  projectId?: string;
}

interface Task {
  id: string;
  status: string;
  assigneeId: string | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
}

const PROJECT_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const DEFAULT_LIMIT = 15;

export function CollaboratorWorkloadChart({
  dateRange,
  projectId,
}: CollaboratorWorkloadChartProps) {
  const t = useTranslations("admin.reports.analytics");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("access_token");
      const url = projectId
        ? `/api/tasks?projectId=${projectId}`
        : "/api/tasks";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const taskList = Array.isArray(result) ? result : result.data ?? [];
      setTasks(taskList);
    } catch (err) {
      console.error("Error loading collaborator workload:", err);
      setError("Impossible de charger les donnees de charge collaborateur.");
    } finally {
      setLoading(false);
    }
  };

  const { chartData, projectNames, average } = useMemo(() => {
    // Filter active tasks only (not DONE) and with an assignee
    const activeTasks = tasks.filter(
      (t) => t.status !== "DONE" && t.assigneeId && t.assignee
    );

    // Group by assignee then by project
    const byAssignee: Record<
      string,
      { name: string; projects: Record<string, number>; total: number }
    > = {};
    const allProjects = new Set<string>();

    for (const task of activeTasks) {
      const assigneeId = task.assigneeId!;
      const assigneeName = task.assignee
        ? `${task.assignee.firstName} ${task.assignee.lastName}`
        : "Inconnu";
      const projectName = task.project?.name ?? "Sans projet";

      allProjects.add(projectName);

      if (!byAssignee[assigneeId]) {
        byAssignee[assigneeId] = { name: assigneeName, projects: {}, total: 0 };
      }
      byAssignee[assigneeId].projects[projectName] =
        (byAssignee[assigneeId].projects[projectName] ?? 0) + 1;
      byAssignee[assigneeId].total += 1;
    }

    // Sort by total descending
    const sorted = Object.values(byAssignee).sort(
      (a, b) => b.total - a.total
    );

    const avg =
      sorted.length > 0
        ? sorted.reduce((sum, s) => sum + s.total, 0) / sorted.length
        : 0;

    // Transform to Recharts format
    const data = sorted.map((entry) => {
      const row: Record<string, string | number> = { name: entry.name };
      for (const proj of allProjects) {
        row[proj] = entry.projects[proj] ?? 0;
      }
      row._total = entry.total;
      return row;
    });

    return {
      chartData: data,
      projectNames: Array.from(allProjects),
      average: avg,
    };
  }, [tasks]);

  const overloadThreshold = average * 1.5;
  const displayData = showAll
    ? chartData
    : chartData.slice(0, DEFAULT_LIMIT);
  const hasMore = chartData.length > DEFAULT_LIMIT;

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
          <span className="mr-2">&#128101;</span>
          {t("collaboratorWorkload")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          <span className="mr-2">&#128101;</span>
          {t("collaboratorWorkload")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">{t("noData")}</p>
      </div>
    );
  }

  const chartHeight = Math.max(300, displayData.length * 40 + 60);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        <span className="mr-2">&#128101;</span>
        {t("collaboratorWorkload")}
      </h3>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart layout="vertical" data={displayData} margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            dataKey="name"
            type="category"
            width={140}
            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
              const entry = chartData.find((d) => d.name === payload.value);
              const total = (entry?._total as number) ?? 0;
              const isOverloaded = total > overloadThreshold;
              return (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  fill={isOverloaded ? "#ef4444" : "#374151"}
                  fontWeight={isOverloaded ? 700 : 400}
                  fontSize={12}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <Tooltip />
          <Legend />
          <ReferenceLine
            x={average}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{ value: `Moy: ${average.toFixed(1)}`, position: "top", fill: "#6b7280", fontSize: 11 }}
          />
          {projectNames.map((projName, idx) => (
            <Bar
              key={projName}
              dataKey={projName}
              stackId="a"
              fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showAll
              ? `Afficher les ${DEFAULT_LIMIT} premiers`
              : `Afficher les ${chartData.length} collaborateurs`}
          </button>
        </div>
      )}
    </div>
  );
}
