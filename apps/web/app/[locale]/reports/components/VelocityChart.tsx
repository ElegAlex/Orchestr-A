"use client";

import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { useState, useEffect } from "react";
import {
  analyticsService,
  VelocityPeriod,
  DateRangeParam,
} from "@/services/analytics.service";
import { usePermissions } from "@/hooks/usePermissions";

interface VelocityChartProps {
  dateRange?: DateRangeParam;
  projectId?: string;
}

export function VelocityChart({
  dateRange = "month",
  projectId,
}: VelocityChartProps) {
  const { hasPermission, permissionsLoaded } = usePermissions();
  const [data, setData] = useState<VelocityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permissionsLoaded) return;
    loadVelocityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, projectId, permissionsLoaded]);

  const loadVelocityData = async () => {
    if (!hasPermission("reports:view")) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await analyticsService.getVelocity(dateRange, projectId);
      setData(result);
    } catch (err) {
      console.error("Error loading velocity data:", err);
      setError("Impossible de charger les données de vélocité.");
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
        <h3 className="text-lg font-semibold mb-4">Vélocité d&apos;Équipe</h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Vélocité d&apos;Équipe</h3>
        <p className="text-sm text-gray-500 text-center py-8">
          Aucune donnée disponible pour cette période.
        </p>
      </div>
    );
  }

  const totalCompleted = data.reduce((sum, item) => sum + item.completed, 0);
  const average = data.length > 0 ? totalCompleted / data.length : 0;
  const lastPeriod = data[data.length - 1];
  const vsAverage =
    average > 0
      ? (((lastPeriod?.completed ?? 0) / average - 1) * 100).toFixed(0)
      : "0";

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Vélocité d&apos;Équipe</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" fill="#4caf50" name="Tâches complétées" />
          <Bar dataKey="planned" fill="#e0e0e0" name="Tâches créées" />
          <Line
            type="monotone"
            dataKey={() => average}
            stroke="#ff9800"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Moyenne"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="bg-green-50 p-3 rounded">
          <div className="text-2xl font-bold text-green-700">
            {average.toFixed(1)}
          </div>
          <div className="text-sm text-green-600">Vélocité moyenne</div>
        </div>
        <div className="bg-blue-50 p-3 rounded">
          <div className="text-2xl font-bold text-blue-700">
            {lastPeriod?.completed ?? 0}
          </div>
          <div className="text-sm text-blue-600">Dernière semaine</div>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <div className="text-2xl font-bold text-purple-700">{vsAverage}%</div>
          <div className="text-sm text-purple-600">vs. moyenne</div>
        </div>
      </div>
    </div>
  );
}
