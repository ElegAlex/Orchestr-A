'use client';

import { useCallback } from 'react';
import type { GanttGroup } from './types';
import { GROUP_HEADER_HEIGHT } from './tokens';

interface GanttGroupHeaderProps {
  group: GanttGroup;
  onToggle: (key: string) => void;
}

export default function GanttGroupHeader({ group, onToggle }: GanttGroupHeaderProps) {
  const handleClick = useCallback(() => onToggle(group.key), [group.key, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(group.key);
      }
    },
    [group.key, onToggle],
  );

  return (
    <div
      role="row"
      aria-expanded={group.isExpanded}
      tabIndex={0}
      className="flex items-center gap-2 px-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-100 transition-colors"
      style={{ height: GROUP_HEADER_HEIGHT }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="text-xs text-gray-500 w-4 text-center">
        {group.isExpanded ? '▼' : '▶'}
      </span>
      <span className="text-sm font-semibold text-gray-700 truncate">
        {group.label}
      </span>
      <span className="ml-1 text-xs text-gray-400 tabular-nums">
        ({group.rows.length})
      </span>
    </div>
  );
}
