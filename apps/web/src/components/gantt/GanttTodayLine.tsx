'use client';

import { TODAY_LINE_COLOR } from './tokens';

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
        className="w-0 border-l-2 border-dashed"
        style={{
          borderColor: TODAY_LINE_COLOR,
          height: '100%',
        }}
      />
      <span
        className="absolute -top-5 -translate-x-1/2 rounded px-1 py-0.5 text-white whitespace-nowrap"
        style={{ fontSize: 10, backgroundColor: TODAY_LINE_COLOR }}
      >
        Aujourd&apos;hui
      </span>
    </div>
  );
}
