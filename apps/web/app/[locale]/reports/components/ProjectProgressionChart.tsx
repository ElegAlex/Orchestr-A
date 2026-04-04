"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface ProjectProgressionChartProps {
  dateRange: string;
  projectId?: string;
}

interface ProjectData {
  id: string;
  name: string;
  status: string;
  progress: number;
}

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

export function ProjectProgressionChart({
  dateRange,
  projectId,
}: ProjectProgressionChartProps) {
  const t = useTranslations("admin.reports.analytics");
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const activeProjects: ProjectData[] = (Array.isArray(data) ? data : data.data || [])
        .filter(
          (p: ProjectData) =>
            p.status === "ACTIVE" || p.status === "IN_PROGRESS"
        )
        .filter((p: ProjectData) => p.status !== "COMPLETED")
        .map((p: ProjectData) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progress ?? 0,
        }));

      setProjects(activeProjects);
    } catch (err) {
      console.error("Error loading projects:", err);
      setError("Impossible de charger les données des projets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, dateRange, projectId]);

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
          📈 {t("projectProgression")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          📈 {t("projectProgression")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">
          {t("noData")}
        </p>
      </div>
    );
  }

  const sorted = [...projects].sort((a, b) => a.progress - b.progress);
  const displayed = showAll ? sorted : sorted.slice(0, 8);
  const hasMore = sorted.length > 8;

  const now = new Date();
  const monthLabel = now.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
  const capitalizedMonth =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const chartData = [
    displayed.reduce(
      (acc, project) => {
        acc[project.id] = project.progress;
        return acc;
      },
      { month: capitalizedMonth } as Record<string, string | number>
    ),
  ];

  const handleLineClick = (pId: string) => {
    router.push(`/projects/${pId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        📈 {t("projectProgression")}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis domain={[0, 100]} unit="%" />
          <Tooltip
            formatter={(value: number, name: string) => {
              const project = displayed.find((p) => p.id === name);
              return [`${value}%`, project?.name || name];
            }}
          />
          <Legend
            formatter={(value: string) => {
              const project = displayed.find((p) => p.id === value);
              return project?.name || value;
            }}
          />
          {displayed.map((project, index) => (
            <Line
              key={project.id}
              type="monotone"
              dataKey={project.id}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              name={project.id}
              dot={{ r: 5, cursor: "pointer" }}
              activeDot={{
                r: 7,
                cursor: "pointer",
                onClick: () => handleLineClick(project.id),
              }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {hasMore && !showAll && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {t("seeAllProjects")} ({sorted.length})
          </button>
        </div>
      )}

      {showAll && hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {t("showLess")}
          </button>
        </div>
      )}
    </div>
  );
}
