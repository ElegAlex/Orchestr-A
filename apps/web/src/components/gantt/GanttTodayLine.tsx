"use client";

import { TODAY_LINE_COLOR } from "./tokens";

interface GanttTodayLineProps {
  left: number;
  height: number;
}

export default function GanttTodayLine({ left, height }: GanttTodayLineProps) {
  return (
    <div
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left, height }}
    >
      <div
        style={{
          width: 0,
          borderLeft: `1.5px dashed ${TODAY_LINE_COLOR}`,
          height: "100%",
        }}
      />
    </div>
  );
}
