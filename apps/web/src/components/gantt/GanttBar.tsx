'use client';

import { BAR_HEIGHT, BAR_BORDER_RADIUS, BAR_OPACITY } from './tokens';

interface GanttBarProps {
  left: number;
  width: number;
  progress: number;
  color: string;
  isMilestone?: boolean;
  label?: string;
}

export default function GanttBar({ left, width, progress, color, isMilestone, label }: GanttBarProps) {
  if (isMilestone) {
    const size = 16;
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: left - size / 2 }}
      >
        <div
          className="rotate-45 shadow-sm"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
        />
      </div>
    );
  }

  const progressWidth = Math.max(0, Math.min(100, progress));
  const showLabelInside = width > 60;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 group cursor-default transition-transform hover:scale-[1.02] hover:shadow-md"
      style={{
        left,
        width: Math.max(width, 4),
        height: BAR_HEIGHT,
        borderRadius: BAR_BORDER_RADIUS,
        backgroundColor: `${color}${Math.round(BAR_OPACITY * 255).toString(16).padStart(2, '0')}`,
      }}
    >
      <div
        className="h-full transition-[width] duration-200"
        style={{
          width: `${progressWidth}%`,
          backgroundColor: color,
          borderRadius: BAR_BORDER_RADIUS,
        }}
      />
      {label && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap ${
            showLabelInside ? 'left-2 text-white' : 'left-full ml-1.5 text-gray-600'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
