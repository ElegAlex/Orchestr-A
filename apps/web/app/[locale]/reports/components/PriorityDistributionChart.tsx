"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PriorityDistributionChartProps {
  dateRange: string;
  projectId?: string;
}

interface Task {
  id: string;
  status: string;
  priority: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f59e0b",
  NORMAL: "#3b82f6",
  LOW: "#9ca3af",
};

const STATUS_COLORS: Record<string, string> = {
  TODO: "#9ca3af",
  IN_PROGRESS: "#3b82f6",
  IN_REVIEW: "#eab308",
  BLOCKED: "#ef4444",
};

const PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;
const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED"] as const;

export function PriorityDistributionChart({
  dateRange,
  projectId,
}: PriorityDistributionChartProps) {
  const t = useTranslations("admin.reports.analytics");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = projectId
          ? `/tasks?projectId=${projectId}`
          : "/tasks";
        const res = await api.get(url);
        const data = res.data;
        const taskList = Array.isArray(data) ? data : data.data ?? [];
        setTasks(taskList);
      } catch (err) {
        console.error("Error loading priority distribution:", err);
        setError("Impossible de charger la distribution par priorité.");
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [dateRange, projectId]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "DONE"),
    [tasks]
  );

  const donutData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PRIORITIES) counts[p] = 0;
    for (const task of activeTasks) {
      if (counts[task.priority] !== undefined) counts[task.priority]++;
    }
    return PRIORITIES.map((p) => ({
      name: p,
      value: counts[p],
    }));
  }, [activeTasks]);

  const barData = useMemo(() => {
    const filtered = selectedPriority
      ? activeTasks.filter((t) => t.priority === selectedPriority)
      : activeTasks;

    const prioritiesToShow = selectedPriority
      ? [selectedPriority]
      : [...PRIORITIES];

    return prioritiesToShow.map((priority) => {
      const priorityTasks = filtered.filter((t) => t.priority === priority);
      const row: Record<string, string | number> = {
        name: priority,
      };
      for (const status of STATUSES) {
        row[status] = priorityTasks.filter((t) => t.status === status).length;
      }
      return row;
    });
  }, [activeTasks, selectedPriority]);

  const totalActive = activeTasks.length;

  const priorityLabel = useCallback(
    (key: string) => {
      const map: Record<string, string> = {
        CRITICAL: t("critical"),
        HIGH: t("high"),
        NORMAL: t("normal"),
        LOW: t("low"),
      };
      return map[key] ?? key;
    },
    [t]
  );

  const statusLabel = useCallback(
    (key: string) => {
      const map: Record<string, string> = {
        TODO: t("todo"),
        IN_PROGRESS: t("inProgress"),
        IN_REVIEW: t("inReview"),
        BLOCKED: t("blocked"),
      };
      return map[key] ?? key;
    },
    [t]
  );

  const handleDonutClick = (entry: { name: string }) => {
    setSelectedPriority((prev) =>
      prev === entry.name ? null : entry.name
    );
  };

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
          🎯 {t("priorityDistribution")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (activeTasks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          🎯 {t("priorityDistribution")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        🎯 {t("priorityDistribution")}
      </h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Donut chart */}
        <div className="relative flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                onClick={(_, index) => handleDonutClick(donutData[index])}
                style={{ cursor: "pointer" }}
              >
                {donutData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={PRIORITY_COLORS[entry.name]}
                    opacity={
                      selectedPriority && selectedPriority !== entry.name
                        ? 0.3
                        : 1
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => {
                  const pct =
                    totalActive > 0
                      ? ((value / totalActive) * 100).toFixed(0)
                      : 0;
                  return [`${value} tâches (${pct}%)`, priorityLabel(name)];
                }}
              />
              <Legend
                formatter={(value: string) => priorityLabel(value)}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">
                {totalActive}
              </div>
              <div className="text-xs text-gray-500">{t("activeTasks")}</div>
            </div>
          </div>
        </div>

        {/* Stacked bar chart */}
        <div className="flex-1 min-h-[300px]">
          {selectedPriority && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {t("filteredBy")}: {priorityLabel(selectedPriority)}
              </span>
              <button
                onClick={() => setSelectedPriority(null)}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("clearFilter")}
              </button>
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickFormatter={(val: string) => priorityLabel(val)}
              />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(val: string) => priorityLabel(val)}
                formatter={(value: number, name: string) => [
                  value,
                  statusLabel(name),
                ]}
              />
              <Legend formatter={(value: string) => statusLabel(value)} />
              {STATUSES.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="a"
                  fill={STATUS_COLORS[status]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
