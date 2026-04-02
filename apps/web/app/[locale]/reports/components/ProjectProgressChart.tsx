"use client";

import { ProjectProgressData } from "../types";
import { format, parseISO, isPast, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

interface ProjectProgressChartProps {
  data: ProjectProgressData[];
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return "#22c55e"; // green
  if (progress >= 50) return "#3b82f6"; // blue
  if (progress >= 25) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

function getDueDateInfo(endDate?: string): {
  label: string;
  className: string;
} | null {
  if (!endDate) return null;
  const date = parseISO(endDate);
  const now = new Date();
  const daysLeft = differenceInDays(date, now);
  const formatted = format(date, "dd MMM yyyy", { locale: fr });

  if (isPast(date)) {
    return { label: `⚠ ${formatted}`, className: "text-red-600 font-semibold" };
  }
  if (daysLeft <= 14) {
    return {
      label: `${formatted} (J-${daysLeft})`,
      className: "text-amber-600",
    };
  }
  return { label: formatted, className: "text-gray-400" };
}

export function ProjectProgressChart({ data }: ProjectProgressChartProps) {
  const sorted = [...data].sort((a, b) => b.progress - a.progress);
  // Height: ~32px per row, fit 20 projects without scroll
  const rowHeight = 32;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        Progression des projets ({sorted.length})
      </h3>
      <div
        className="space-y-1.5"
        style={{ minHeight: `${Math.min(sorted.length, 20) * rowHeight}px` }}
      >
        {sorted.map((project) => {
          const progressClamped = Math.min(Math.max(project.progress, 0), 100);
          const barColor = getProgressColor(progressClamped);
          const dueInfo = getDueDateInfo(project.endDate);

          return (
            <div key={project.name} className="flex items-center gap-2 h-[28px]">
              {/* Project name */}
              <div className="w-[220px] shrink-0 min-w-0">
                <span
                  className="text-xs text-gray-700 font-medium truncate block leading-tight"
                  title={project.name}
                >
                  {project.name}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 min-w-0">
                <div className="h-5 bg-gray-100 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(progressClamped, 2)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-bold ${
                      progressClamped > 25
                        ? "left-1.5 text-white"
                        : "text-gray-600"
                    }`}
                    style={
                      progressClamped > 25
                        ? {}
                        : {
                            left: `calc(${Math.max(progressClamped, 2)}% + 6px)`,
                          }
                    }
                  >
                    {progressClamped}%
                  </span>
                </div>
              </div>

              {/* Due date */}
              <div className="w-[120px] shrink-0 text-right">
                {dueInfo ? (
                  <span className={`text-[10px] ${dueInfo.className}`}>
                    {dueInfo.label}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>

              {/* Task count */}
              <div className="w-[40px] shrink-0 text-right">
                <span className="text-[10px] text-gray-400">
                  {project.tasks}
                </span>
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
