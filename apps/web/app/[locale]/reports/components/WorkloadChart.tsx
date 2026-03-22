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
import { useState, useEffect } from "react";
import {
  analyticsService,
  WorkloadUser,
  DateRangeParam,
} from "@/services/analytics.service";
import { usePermissions } from "@/hooks/usePermissions";

interface WorkloadChartProps {
  dateRange?: DateRangeParam;
  projectId?: string;
}

export function WorkloadChart({
  dateRange = "month",
  projectId,
}: WorkloadChartProps) {
  const { hasPermission, permissionsLoaded } = usePermissions();
  const [data, setData] = useState<WorkloadUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permissionsLoaded) return;
    loadWorkloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, projectId, permissionsLoaded]);

  const loadWorkloadData = async () => {
    if (!hasPermission("reports:view")) {
      setData([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await analyticsService.getWorkload(dateRange, projectId);
      setData(result);
    } catch (err) {
      console.error("Error loading workload data:", err);
      setError("Impossible de charger les données de charge.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Charge de Travail Équipe</h3>
        <div className="border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Charge de Travail Équipe</h3>
        <p className="text-sm text-gray-500 text-center py-8">
          Aucune saisie de temps enregistrée pour cette période.
        </p>
      </div>
    );
  }

  const overloadedCount = data.filter((d) => d.utilization > 100).length;
  const underutilizedCount = data.filter((d) => d.utilization < 80).length;
  const avgUtilization =
    data.reduce((sum, d) => sum + d.utilization, 0) / data.length;

  // Use first user's capacity as reference line (all share same period capacity)
  const capacityRef = data[0]?.capacity ?? 40;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Charge de Travail Équipe</h3>

      {overloadedCount > 0 && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3">
          <p className="text-sm text-red-700">
            <strong>{overloadedCount}</strong> personne(s) en surcharge
            (&gt;100%)
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis
            label={{ value: "Heures", angle: -90, position: "insideLeft" }}
          />
          <Tooltip />
          <Legend />
          <ReferenceLine
            y={capacityRef}
            stroke="#ff9800"
            strokeDasharray="3 3"
            label="Capacité"
          />
          <Bar dataKey="planned" name="Heures saisies" fill="#667eea" />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-blue-700">
            {avgUtilization.toFixed(0)}%
          </div>
          <div className="text-sm text-blue-600">Utilisation moyenne</div>
        </div>
        <div className="bg-red-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-red-700">
            {overloadedCount}
          </div>
          <div className="text-sm text-red-600">Surcharges</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-yellow-700">
            {underutilizedCount}
          </div>
          <div className="text-sm text-yellow-600">Sous-utilisés</div>
        </div>
      </div>

      {/* Detail table */}
      <div className="mt-4">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Nom</th>
              <th className="px-3 py-2 text-right">Planifié</th>
              <th className="px-3 py-2 text-right">Capacité</th>
              <th className="px-3 py-2 text-right">Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((person) => (
              <tr key={person.userId} className="border-t">
                <td className="px-3 py-2">{person.name}</td>
                <td className="px-3 py-2 text-right">{person.planned}h</td>
                <td className="px-3 py-2 text-right">{person.capacity}h</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    person.utilization > 100
                      ? "text-red-600"
                      : person.utilization < 80
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  {person.utilization.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
