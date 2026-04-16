"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface RecentActivityCardsProps {
  dateRange: string;
  projectId?: string;
}

interface Task {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  endDate?: string | null;
}

function getDaysFromRange(dateRange: string): number {
  switch (dateRange) {
    case "week":
      return 7;
    case "month":
      return 30;
    case "quarter":
      return 90;
    case "year":
      return 365;
    default:
      return 30;
  }
}

export function RecentActivityCards({
  dateRange,
  projectId,
}: RecentActivityCardsProps) {
  const t = useTranslations("admin.reports.analytics");
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        console.error("Error loading recent activity:", err);
        setError("Impossible de charger les données d'activité.");
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [dateRange, projectId]);

  const now = useMemo(() => new Date(), []);

  const periodStart = useMemo(() => {
    const days = getDaysFromRange(dateRange);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateRange, now]);

  const metrics = useMemo(() => {
    const completed = tasks.filter((t) => {
      if (t.status !== "DONE") return false;
      const updated = new Date(t.updatedAt);
      return updated >= periodStart && updated <= now;
    });

    const created = tasks.filter((t) => {
      const createdAt = new Date(t.createdAt);
      return createdAt >= periodStart && createdAt <= now;
    });

    const overdue = tasks.filter((t) => {
      if (t.status === "DONE" || !t.endDate) return false;
      const end = new Date(t.endDate);
      return end < now && end >= periodStart;
    });

    const ratio =
      created.length > 0
        ? (completed.length / created.length) * 100
        : completed.length > 0
          ? 100
          : 0;

    return {
      completed: completed.length,
      created: created.length,
      overdue: overdue.length,
      ratio,
    };
  }, [tasks, periodStart, now]);

  const sparklineData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const count = tasks.filter((t) => {
        if (t.status !== "DONE") return false;
        const updated = new Date(t.updatedAt).toISOString().slice(0, 10);
        return updated === dayStr;
      }).length;
      days.push({ day: dayStr, count });
    }
    return days;
  }, [tasks, now]);

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
          ⚡ {t("recentActivity")}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          ⚡ {t("recentActivity")}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">{t("noData")}</p>
      </div>
    );
  }

  const ratioColor = metrics.ratio >= 100 ? "text-green-700" : "text-orange-600";
  const overdueCardBg = metrics.overdue > 0 ? "bg-red-50" : "bg-gray-50";
  const overdueTextColor = metrics.overdue > 0 ? "text-red-700" : "text-gray-700";

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        ⚡ {t("recentActivity")}
      </h3>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Completed */}
        <div
          className="bg-green-50 rounded-lg p-4 text-center"
          title={t("completedTooltip")}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">✅</span>
            <span className="text-3xl font-bold text-green-700">
              {metrics.completed}
            </span>
          </div>
          <div className="text-sm text-green-600 font-medium">
            {t("completed")}
          </div>
        </div>

        {/* Created */}
        <div
          className="bg-blue-50 rounded-lg p-4 text-center"
          title={t("createdTooltip")}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">➕</span>
            <span className="text-3xl font-bold text-blue-700">
              {metrics.created}
            </span>
          </div>
          <div className="text-sm text-blue-600 font-medium">
            {t("created")}
          </div>
        </div>

        {/* Became overdue */}
        <div
          className={`${overdueCardBg} rounded-lg p-4 text-center cursor-pointer hover:opacity-80 transition-opacity`}
          title={t("overdueTooltip")}
          onClick={() => router.push("/tasks")}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">⚠️</span>
            <span className={`text-3xl font-bold ${overdueTextColor}`}>
              {metrics.overdue}
            </span>
          </div>
          <div className={`text-sm font-medium ${metrics.overdue > 0 ? "text-red-600" : "text-gray-600"}`}>
            {t("becameOverdue")}
          </div>
        </div>

        {/* Completion ratio */}
        <div
          className="bg-purple-50 rounded-lg p-4 text-center"
          title={t("ratioTooltip")}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">📊</span>
            <span className={`text-3xl font-bold ${ratioColor}`}>
              {metrics.ratio.toFixed(0)}%
            </span>
          </div>
          <div className="text-sm text-purple-600 font-medium">
            {t("completionRatio")}
          </div>
          <div className={`text-xs mt-1 ${ratioColor}`}>
            {metrics.ratio >= 100
              ? t("backlogShrinking")
              : t("backlogGrowing")}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="border-t pt-4">
        <p className="text-xs text-gray-400 mb-2">{t("completedLast7Days")}</p>
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3b82f6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
