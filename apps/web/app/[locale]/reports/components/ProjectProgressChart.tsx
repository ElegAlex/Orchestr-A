"use client";

import { ProjectProgressData } from "../types";

interface ProjectProgressChartProps {
  data: ProjectProgressData[];
}

const statusColors: Record<string, string> = {
  ACTIVE: "#3b82f6",
  COMPLETED: "#22c55e",
  ON_HOLD: "#f59e0b",
  CANCELLED: "#ef4444",
};

export function ProjectProgressChart({ data }: ProjectProgressChartProps) {
  const sorted = [...data].sort((a, b) => b.progress - a.progress);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Progression des projets</h3>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {sorted.map((project) => {
          const barColor = statusColors[project.status] || "#667eea";
          const progressClamped = Math.min(Math.max(project.progress, 0), 100);

          return (
            <div key={project.name} className="group">
              <div className="flex items-center gap-3">
                {/* Project name */}
                <div className="w-[200px] shrink-0 min-w-0">
                  <span
                    className="text-sm text-gray-700 font-medium truncate block"
                    title={project.name}
                  >
                    {project.name}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex-1 min-w-0">
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(progressClamped, 2)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                    {/* Label inside bar if enough space, outside if not */}
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold ${
                        progressClamped > 30
                          ? "left-2 text-white"
                          : "right-2 text-gray-600"
                      }`}
                      style={
                        progressClamped > 30
                          ? {}
                          : { left: `calc(${Math.max(progressClamped, 2)}% + 8px)` }
                      }
                    >
                      {progressClamped}%
                    </span>
                  </div>
                </div>

                {/* Task count */}
                <div className="w-[60px] shrink-0 text-right">
                  <span className="text-xs text-gray-400">
                    {project.tasks} tâches
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-8">
            Aucun projet
          </div>
        )}
      </div>
    </div>
  );
}
