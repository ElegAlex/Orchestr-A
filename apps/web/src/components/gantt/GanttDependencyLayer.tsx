'use client';

import { ARROW_COLOR, ARROW_HIGHLIGHT_COLOR } from './tokens';
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
  hoveredRowId?: string | null;
}

export default function GanttDependencyLayer({
  dependencies,
  rowPositions,
  width,
  height,
  hoveredRowId,
}: GanttDependencyLayerProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width, height }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
        >
          <polygon points="0,0 6,3 0,6" fill={ARROW_COLOR} />
        </marker>
        <marker
          id="arrowhead-highlight"
          markerWidth="6"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
        >
          <polygon points="0,0 6,3 0,6" fill={ARROW_HIGHLIGHT_COLOR} />
        </marker>
      </defs>
      {dependencies.map((dep) => {
        const from = rowPositions.get(dep.fromId);
        const to = rowPositions.get(dep.toId);
        if (!from && !to) return null;

        const isHighlighted = hoveredRowId === dep.fromId || hoveredRowId === dep.toId;
        const stroke = isHighlighted ? ARROW_HIGHLIGHT_COLOR : ARROW_COLOR;
        const strokeWidth = isHighlighted ? 2 : 1.5;
        const markerId = isHighlighted ? 'arrowhead-highlight' : 'arrowhead';

        if (!from || !to) return null;

        const x1 = from.right;
        const y1 = from.y + from.height / 2;
        const x2 = to.left;
        const y2 = to.y + to.height / 2;

        const dx = Math.min(40, Math.abs(x2 - x1) / 2);

        const d = `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;

        return (
          <path
            key={`${dep.fromId}-${dep.toId}`}
            d={d}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            markerEnd={`url(#${markerId})`}
          />
        );
      })}
    </svg>
  );
}
