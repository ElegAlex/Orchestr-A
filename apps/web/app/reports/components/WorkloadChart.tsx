'use client';

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
} from 'recharts';
import { useState, useEffect } from 'react';

interface WorkloadData {
  name: string;
  planned: number;
  capacity: number;
  utilization: number;
}

export function WorkloadChart() {
  const [data, setData] = useState<WorkloadData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkloadData();
  }, []);

  const loadWorkloadData = async () => {
    try {
      setLoading(true);
      // En production, récupérer depuis l'API
      // Pour l'instant, données simulées
      const mockData: WorkloadData[] = [
        { name: 'Alice M.', planned: 35, capacity: 40, utilization: 87.5 },
        { name: 'Bob D.', planned: 42, capacity: 40, utilization: 105 },
        { name: 'Charlie L.', planned: 38, capacity: 40, utilization: 95 },
        { name: 'Diana R.', planned: 30, capacity: 40, utilization: 75 },
        { name: 'Eric T.', planned: 40, capacity: 40, utilization: 100 },
        { name: 'Fiona K.', planned: 25, capacity: 40, utilization: 62.5 },
      ];
      setData(mockData);
    } catch (error) {
      console.error('Error loading workload data:', error);
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

  const overloadedCount = data.filter((d) => d.utilization > 100).length;
  const underutilizedCount = data.filter((d) => d.utilization < 80).length;
  const avgUtilization =
    data.reduce((sum, d) => sum + d.utilization, 0) / data.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Charge de Travail Équipe</h3>

      {/* Alertes */}
      {overloadedCount > 0 && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3">
          <p className="text-sm text-red-700">
            ⚠️ <strong>{overloadedCount}</strong> personne(s) en surcharge
            (&gt;100%)
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis label={{ value: 'Heures', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <ReferenceLine
            y={40}
            stroke="#ff9800"
            strokeDasharray="3 3"
            label="Capacité"
          />
          <Bar dataKey="planned" fill="#667eea" name="Heures planifiées">
            {data.map((entry, index) => (
              <Bar
                key={`bar-${index}`}
                dataKey="planned"
                fill={entry.utilization > 100 ? '#f44336' : '#667eea'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Résumé */}
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

      {/* Détails par personne */}
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
            {data.map((person, index) => (
              <tr key={index} className="border-t">
                <td className="px-3 py-2">{person.name}</td>
                <td className="px-3 py-2 text-right">{person.planned}h</td>
                <td className="px-3 py-2 text-right">{person.capacity}h</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    person.utilization > 100
                      ? 'text-red-600'
                      : person.utilization < 80
                        ? 'text-yellow-600'
                        : 'text-green-600'
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
