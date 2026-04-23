"use client";

import { HEALTH_COLORS } from "./tokens";
import type { HealthStatus } from "./types";

const LABELS: Record<HealthStatus, string> = {
  "on-track": "En bonne voie",
  "at-risk": "À risque",
  late: "En retard",
  upcoming: "À venir",
  done: "Terminé",
};

interface GanttLegendProps {
  scope: "portfolio" | "project";
}

export default function GanttLegend({ scope }: GanttLegendProps) {
  if (scope !== "portfolio") return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t bg-gray-50 text-xs text-gray-600">
      {(Object.keys(LABELS) as HealthStatus[]).map((key) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: HEALTH_COLORS[key] }}
          />
          <span>{LABELS[key]}</span>
        </div>
      ))}
    </div>
  );
}
