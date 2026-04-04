"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface ProgressTrendChartProps {
  dateRange: string;
  projectId?: string;
}

interface SnapshotPoint {
  date: string;
  progress: number;
}

interface ProjectInfo {
  id: string;
  name: string;
  status: string;
}

type ViewMode = "global" | "byProject";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

function getDateRange(range: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "week":
      from.setDate(from.getDate() - 7);
      break;
    case "quarter":
      from.setDate(from.getDate() - 90);
      break;
    case "year":
      from.setDate(from.getDate() - 365);
      break;
    case "month":
    default:
      from.setDate(from.getDate() - 30);
      break;
  }
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

function detectStagnation(data: { progress: number }[]): boolean {
  if (data.length < 3) return false;
  for (let i = 2; i < data.length; i++) {
    const a = data[i - 2].progress;
    const b = data[i - 1].progress;
    const c = data[i].progress;
    const maxVal = Math.max(a, b, c);
    const minVal = Math.min(a, b, c);
    if (maxVal - minVal < 2) return true;
  }
  return false;
}

export function ProgressTrendChart({
  dateRange,
  projectId,
}: ProgressTrendChartProps) {
  const t = useTranslations("admin.reports.analytics");
  const [globalData, setGlobalData] = useState<
    { date: string; progress: number }[]
  >([]);
  const [projectData, setProjectData] = useState<
    Map<string, { name: string; snapshots: SnapshotPoint[] }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("global");
  const [stagnation, setStagnation] = useState(false);
  const [shortHistory, setShortHistory] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("access_token");
      const { from, to } = getDateRange(dateRange);

      let projectIds: string[] = [];

      if (projectId) {
        projectIds = [projectId];
      } else {
        const res = await fetch("/api/projects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const projects: ProjectInfo[] = Array.isArray(data)
          ? data
          : data.data || [];
        projectIds = projects
          .filter(
            (p) => p.status === "ACTIVE" || p.status === "IN_PROGRESS"
          )
          .map((p) => p.id);
      }

      const snapshotsByProject = new Map<
        string,
        { name: string; snapshots: SnapshotPoint[] }
      >();
      const allDates = new Map<string, { total: number; count: number }>();

      for (const pId of projectIds) {
        try {
          const res = await fetch(
            `/api/projects/${pId}/snapshots?from=${from}&to=${to}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) continue;
          const snapshots: SnapshotPoint[] = await res.json();
          if (!Array.isArray(snapshots) || snapshots.length === 0) continue;

          // Get project name
          const projRes = await fetch(`/api/projects/${pId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const projData = projRes.ok ? await projRes.json() : { name: pId };

          snapshotsByProject.set(pId, {
            name: projData.name || pId,
            snapshots,
          });

          for (const snap of snapshots) {
            const dateKey = snap.date.split("T")[0];
            const existing = allDates.get(dateKey) || {
              total: 0,
              count: 0,
            };
            existing.total += snap.progress;
            existing.count += 1;
            allDates.set(dateKey, existing);
          }
        } catch {
          // Skip projects whose snapshot endpoint fails
          continue;
        }
      }

      setProjectData(snapshotsByProject);

      // Calculate weighted average per date
      const avgData = Array.from(allDates.entries())
        .map(([date, { total, count }]) => ({
          date,
          progress: Math.round(total / count),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setGlobalData(avgData);

      // Check if history is too short (< 2 weeks)
      if (avgData.length > 0) {
        const firstDate = new Date(avgData[0].date);
        const lastDate = new Date(avgData[avgData.length - 1].date);
        const diffDays =
          (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
        setShortHistory(diffDays < 14);
      } else {
        setShortHistory(true);
      }

      // Stagnation detection
      setStagnation(detectStagnation(avgData));
    } catch (err) {
      console.error("Error loading snapshots:", err);
      setError("Impossible de charger les données de tendance.");
    } finally {
      setLoading(false);
    }
  }, [dateRange, projectId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

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
          📊 {t("progressTrend")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (globalData.length === 0 && projectData.size === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          📊 {t("progressTrend")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">
          {t("noData")}
        </p>
      </div>
    );
  }

  // Build chart data for "by project" mode
  const byProjectChartData: Record<string, string | number>[] = [];
  if (mode === "byProject") {
    const allDatesSet = new Set<string>();
    projectData.forEach(({ snapshots }) => {
      snapshots.forEach((s) => allDatesSet.add(s.date.split("T")[0]));
    });
    const sortedDates = Array.from(allDatesSet).sort();

    for (const date of sortedDates) {
      const point: Record<string, string | number> = { date };
      projectData.forEach(({ snapshots }, pId) => {
        const snap = snapshots.find((s) => s.date.split("T")[0] === date);
        if (snap) point[pId] = snap.progress;
      });
      byProjectChartData.push(point);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📊 {t("progressTrend")}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("global")}
            className={`px-3 py-1 text-sm rounded ${
              mode === "global"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Moyenne globale
          </button>
          <button
            onClick={() => setMode("byProject")}
            className={`px-3 py-1 text-sm rounded ${
              mode === "byProject"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Par projet
          </button>
        </div>
      </div>

      {shortHistory && (
        <div className="mb-4 border-l-4 border-blue-400 bg-blue-50 p-3">
          <p className="text-sm text-blue-700">ℹ️ {t("historyBuilding")}</p>
        </div>
      )}

      {stagnation && (
        <div className="mb-4 border-l-4 border-yellow-400 bg-yellow-50 p-3">
          <p className="text-sm text-yellow-700">
            ⚠️ {t("stagnationDetected")}
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        {mode === "global" ? (
          <AreaChart data={globalData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(value: number) => `${value}%`} />
            <Area
              type="monotone"
              dataKey="progress"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
              name="Progression moyenne"
            />
          </AreaChart>
        ) : (
          <AreaChart data={byProjectChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(value: number) => `${value}%`} />
            {Array.from(projectData.entries()).map(
              ([pId, { name }], index) => (
                <Area
                  key={pId}
                  type="monotone"
                  dataKey={pId}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  name={name}
                />
              )
            )}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
