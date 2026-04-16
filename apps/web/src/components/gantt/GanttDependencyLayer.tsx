'use client';

import { ARROW_COLOR, ARROW_INDENT } from './tokens';
import type { GanttDependency } from './types';

interface RowPosition {
  y: number;
  left: number;
  right: number;
  height: number;
}

interface GanttDependencyLayerProps {
  dependencies: GanttDependency[];
  rowPositions: Map<string, RowPosition>;
  width: number;
  height: number;
}

export default function GanttDependencyLayer({
  dependencies,
  rowPositions,
  width,
  height,
}: GanttDependencyLayerProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width, height }}
    >
      {dependencies.map((dep) => {
        const from = rowPositions.get(dep.fromId);
        const to = rowPositions.get(dep.toId);
        if (!from || !to) return null;

        const fromCenterY = from.y + from.height / 2;
        const toCenterY = to.y + to.height / 2;
        const fromRight = from.right;
        const toLeft = to.left;

        let d: string;
        if (fromRight + ARROW_INDENT < toLeft) {
          // Standard right-angle connector
          d = `M ${fromRight},${fromCenterY} L ${fromRight + ARROW_INDENT},${fromCenterY} L ${fromRight + ARROW_INDENT},${toCenterY} L ${toLeft},${toCenterY}`;
        } else {
          // Overlapping: use midpoint
          const midX = (fromRight + toLeft) / 2;
          d = `M ${fromRight},${fromCenterY} L ${midX},${fromCenterY} L ${midX},${toCenterY} L ${toLeft},${toCenterY}`;
        }

        return (
          <g key={`${dep.fromId}-${dep.toId}`}>
            <path
              d={d}
              stroke={ARROW_COLOR}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon
              points={`${toLeft},${toCenterY} ${toLeft - 6},${toCenterY - 4} ${toLeft - 6},${toCenterY + 4}`}
              fill={ARROW_COLOR}
            />
          </g>
        );
      })}
    </svg>
  );
}
