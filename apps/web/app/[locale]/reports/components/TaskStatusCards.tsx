"use client";

import { TaskStatusData } from "../types";

interface TaskStatusCardsProps {
  data: TaskStatusData[];
}

export function TaskStatusCards({ data }: TaskStatusCardsProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {data.map((item) => (
        <div
          key={item.name}
          className="bg-white rounded-lg shadow px-4 py-3 flex items-center gap-3"
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <div className="min-w-0">
            <div className="text-xl font-bold text-gray-900">{item.value}</div>
            <div className="text-xs text-gray-500 truncate">{item.name}</div>
          </div>
          {total > 0 && (
            <div className="ml-auto text-xs text-gray-400 shrink-0">
              {Math.round((item.value / total) * 100)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
