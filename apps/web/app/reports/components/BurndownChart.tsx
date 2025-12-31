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

interface BurndownChartProps {
  projectId?: string;
}

export function BurndownChart({ projectId }: BurndownChartProps) {
  // Données simulées pour le burndown
  // En production, ces données viendront d'un endpoint API dédié
  const data = [
    { day: "S1", ideal: 100, actual: 100 },
    { day: "S2", ideal: 87.5, actual: 95 },
    { day: "S3", ideal: 75, actual: 85 },
    { day: "S4", ideal: 62.5, actual: 70 },
    { day: "S5", ideal: 50, actual: 55 },
    { day: "S6", ideal: 37.5, actual: 40 },
    { day: "S7", ideal: 25, actual: 28 },
    { day: "S8", ideal: 12.5, actual: 15 },
    { day: "S9", ideal: 0, actual: 5 },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Burndown Chart {projectId ? "- Projet" : "- Global"}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
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
          📊 Le burndown affiche la progression réelle par rapport à la
          progression idéale.
        </p>
        <p className="mt-1">
          {data[data.length - 1].actual > 0
            ? "⚠️ Attention : il reste du travail en fin de sprint"
            : "✅ Sprint terminé dans les temps"}
        </p>
      </div>
    </div>
  );
}
