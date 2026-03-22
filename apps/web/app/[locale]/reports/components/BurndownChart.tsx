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
import { useState, useEffect } from "react";
import {
  analyticsService,
  BurndownPoint,
  DateRangeParam,
} from "@/services/analytics.service";
import { usePermissions } from "@/hooks/usePermissions";

interface BurndownChartProps {
  projectId?: string;
  dateRange?: DateRangeParam;
}

export function BurndownChart({
  projectId,
  dateRange = "month",
}: BurndownChartProps) {
  const { hasPermission, permissionsLoaded } = usePermissions();
  const [data, setData] = useState<BurndownPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permissionsLoaded) return;
    loadBurndownData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dateRange, permissionsLoaded]);

  const loadBurndownData = async () => {
    if (!hasPermission("reports:view")) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await analyticsService.getBurndown(dateRange, projectId);
      setData(result);
    } catch (err) {
      console.error("Error loading burndown data:", err);
      setError("Impossible de charger les données de burndown.");
    } finally {
      setLoading(false);
    }
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
          Burndown Chart {projectId ? "- Projet" : "- Global"}
        </h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">
          Burndown Chart {projectId ? "- Projet" : "- Global"}
        </h3>
        <p className="text-sm text-gray-500 text-center py-8">
          Aucune tâche disponible pour générer le burndown.
        </p>
      </div>
    );
  }

  const lastPoint = data[data.length - 1];
  const isBehind = lastPoint && lastPoint.actual > lastPoint.ideal;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Burndown Chart {projectId ? "- Projet" : "- Global"}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis unit="%" />
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#9e9e9e"
            strokeDasharray="5 5"
            name="Idéal"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#667eea"
            strokeWidth={2}
            name="Réel"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Le burndown affiche le pourcentage de tâches restantes par rapport à
          la progression idéale.
        </p>
        <p className="mt-1">
          {isBehind
            ? "Attention : la progression réelle est en retard sur l'idéal."
            : lastPoint?.actual === 0
              ? "Toutes les tâches sont terminées."
              : "La progression est dans les temps."}
        </p>
      </div>
    </div>
  );
}
