"use client";

import { useCallback } from "react";
import type { GanttPortfolioRow, GanttTaskRow, GanttView } from "./types";
import {
  LEFT_COLUMN_WIDTH,
  PROJECT_ROW_HEIGHT,
  HEALTH_COLORS,
  TASK_STATUS_COLORS,
  TASK_STATUS_DEFAULT_COLOR,
  getRowHeight as getViewRowHeight,
} from "./tokens";
import { dateToX } from "./timeline-math";
import GanttBar from "./GanttBar";

interface GanttRowProps {
  row: GanttPortfolioRow | GanttTaskRow;
  scope: "portfolio" | "project";
  rangeStart: Date;
  view: GanttView;
  pixelsPerUnit: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function isTaskRow(row: GanttPortfolioRow | GanttTaskRow): row is GanttTaskRow {
  return "isMilestone" in row;
}

function getRowHeight(
  row: GanttPortfolioRow | GanttTaskRow,
  scope: "portfolio" | "project",
  view: GanttView,
): number {
  if (scope === "portfolio") return PROJECT_ROW_HEIGHT;
  return getViewRowHeight(view);
}

function getBarColor(
  row: GanttPortfolioRow | GanttTaskRow,
  scope: "portfolio" | "project",
): string {
  if (scope === "portfolio") {
    return HEALTH_COLORS[(row as GanttPortfolioRow).health];
  }
  const taskRow = row as GanttTaskRow;
  return TASK_STATUS_COLORS[taskRow.status] ?? TASK_STATUS_DEFAULT_COLOR;
}

export default function GanttRow({
  row,
  scope,
  rangeStart,
  view,
  pixelsPerUnit,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
}: GanttRowProps) {
  const height = getRowHeight(row, scope, view);
  const color = getBarColor(row, scope);

  const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
  const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
  const barWidth = Math.max(barRight - barLeft, 4);

  const isMilestone = isTaskRow(row) && row.isMilestone;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick],
  );

  return (
    <div
      role="row"
      tabIndex={0}
      className="flex border-b border-gray-100 hover:bg-gray-50/60 transition-colors cursor-pointer"
      style={{ height }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <div
        className="shrink-0 flex items-center gap-2 px-3 border-r border-gray-200 bg-white sticky left-0 z-10 overflow-hidden"
        style={{ width: LEFT_COLUMN_WIDTH, minWidth: LEFT_COLUMN_WIDTH }}
      >
        <span className="truncate text-sm text-gray-800">{row.name}</span>
        {scope === "portfolio" && (
          <span
            className="ml-auto shrink-0 h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <div className="relative flex-1" style={{ height }}>
        <GanttBar
          left={barLeft}
          width={barWidth}
          progress={row.progress}
          color={color}
          isMilestone={isMilestone}
          name={row.name}
          view={view}
        />
      </div>
    </div>
  );
}
