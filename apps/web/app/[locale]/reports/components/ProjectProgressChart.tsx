"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ProjectProgressData } from "../types";

interface ProjectProgressChartProps {
  data: ProjectProgressData[];
}

export function ProjectProgressChart({ data }: ProjectProgressChartProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Progression des Projets</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="progress" fill="#667eea" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
