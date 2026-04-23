"use client";

import { format } from "date-fns";
import type { GanttView } from "./types";
import {
  getBarHeight,
  hexWithAlpha,
  darkenColor,
  lightenColor,
  MILESTONE_COLOR,
  MILESTONE_BORDER_COLOR,
} from "./tokens";

interface GanttBarProps {
  left: number;
  width: number;
  progress: number;
  color: string;
  isMilestone?: boolean;
  name?: string;
  view: GanttView;
  milestoneDate?: Date;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
}

export default function GanttBar({
  left,
  width,
  progress,
  color,
  isMilestone,
  name,
  view,
  milestoneDate,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
}: GanttBarProps) {
  const barHeight = getBarHeight(view);

  if (isMilestone) {
    const size = 14;
    const dateLabel = milestoneDate ? format(milestoneDate, "MMM d") : "";
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2"
        style={{ left: left - size / 2 }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
      >
        <div
          className="shrink-0 rotate-45"
          style={{
            width: size,
            height: size,
            backgroundColor: MILESTONE_COLOR,
            border: `1px solid ${MILESTONE_BORDER_COLOR}`,
          }}
        />
        {name && (
          <span
            className="whitespace-nowrap"
            style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}
          >
            {dateLabel && `${dateLabel} — `}
            {name}
          </span>
        )}
      </div>
    );
  }

  const progressWidth = Math.max(0, Math.min(100, progress));
  const showName = width > 80;
  const showPercent = width > 40;
  const radius = barHeight / 2;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 cursor-default transition-transform hover:scale-[1.02]"
      style={{
        left,
        width: Math.max(width, 4),
        height: barHeight,
        borderRadius: radius,
        backgroundColor: hexWithAlpha(color, 0.5),
        border: `1px solid ${hexWithAlpha(color, 0.6)}`,
        overflow: "hidden",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <div
        className="h-full transition-[width] duration-200"
        style={{
          width: `${progressWidth}%`,
          background: `linear-gradient(180deg, ${lightenColor(color, 0.2)} 0%, ${color} 50%, ${darkenColor(color)} 100%)`,
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(0, 0, 0, 0.08)",
        }}
      />
      {(showName || showPercent) && (
        <div
          className="absolute inset-0 flex items-center justify-between pointer-events-none"
          style={{ paddingLeft: 12, paddingRight: 12 }}
        >
          {showName && (
            <span
              className="truncate text-white"
              style={{
                fontSize: 13,
                fontWeight: 500,
                maxWidth: "calc(100% - 48px)",
              }}
            >
              {name}
            </span>
          )}
          {showPercent && (
            <span
              className="shrink-0"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
