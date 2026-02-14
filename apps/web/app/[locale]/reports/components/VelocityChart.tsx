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

export function VelocityChart() {
  // Données simulées pour la vélocité
  // En production, calculées depuis les tâches complétées par sprint/semaine
  const data = [
    { period: "S1", completed: 12, planned: 15 },
    { period: "S2", completed: 14, planned: 15 },
    { period: "S3", completed: 10, planned: 15 },
    { period: "S4", completed: 16, planned: 15 },
    { period: "S5", completed: 13, planned: 15 },
    { period: "S6", completed: 15, planned: 15 },
  ];

  const average =
    data.reduce((sum, item) => sum + item.completed, 0) / data.length;

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
          <Bar dataKey="planned" fill="#e0e0e0" name="Tâches planifiées" />
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
            {data[data.length - 1].completed}
          </div>
          <div className="text-sm text-blue-600">Dernier sprint</div>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <div className="text-2xl font-bold text-purple-700">
            {((data[data.length - 1].completed / average - 1) * 100).toFixed(0)}
            %
          </div>
          <div className="text-sm text-purple-600">vs. moyenne</div>
        </div>
      </div>
    </div>
  );
}
