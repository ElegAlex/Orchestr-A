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
        style={{
          width: 0,
          borderLeft: `1.5px solid ${TODAY_LINE_COLOR}`,
          height: '100%',
        }}
      />
      <span
        className="absolute -translate-x-1/2 whitespace-nowrap"
        style={{
          top: -24,
          fontSize: 11,
          fontWeight: 600,
          color: 'white',
          backgroundColor: TODAY_LINE_COLOR,
          padding: '2px 8px',
          borderRadius: 10,
        }}
      >
        TODAY
      </span>
    </div>
  );
}
