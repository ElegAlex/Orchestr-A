'use client';

import { useCallback } from 'react';
import type { GanttView, GanttGrouping } from './types';
import type { TimelineBucket } from './timeline-math';
import { LEFT_COLUMN_WIDTH } from './tokens';

interface GanttHeaderProps {
  buckets: TimelineBucket[];
  view: GanttView;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToday: () => void;
  onViewChange: (view: GanttView) => void;
  onZoom: (direction: 'in' | 'out') => void;
  groupBy?: GanttGrouping;
  onGroupByChange?: (groupBy: GanttGrouping) => void;
}

const VIEW_LABELS: Record<GanttView, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  quarter: 'Trimestre',
};

const VIEWS: GanttView[] = ['day', 'week', 'month', 'quarter'];

const GROUP_LABELS: Record<GanttGrouping, string> = {
  milestone: 'Jalon',
  epic: 'Épopée',
  none: 'Aucun',
};

const GROUPINGS: GanttGrouping[] = ['milestone', 'epic', 'none'];

export default function GanttHeader({
  buckets,
  view,
  onNavigate,
  onToday,
  onViewChange,
  onZoom,
  groupBy,
  onGroupByChange,
}: GanttHeaderProps) {
  const handlePrev = useCallback(() => onNavigate('prev'), [onNavigate]);
  const handleNext = useCallback(() => onNavigate('next'), [onNavigate]);

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
        <button
          onClick={handlePrev}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Période précédente"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </button>

        <button
          onClick={onToday}
          className="rounded px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Aujourd&apos;hui
        </button>

        <button
          onClick={handleNext}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Période suivante"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="mx-1 h-4 w-px bg-gray-200" />

        <div className="flex items-center rounded border border-gray-200 overflow-hidden">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <div className="mx-1 h-4 w-px bg-gray-200" />

        <button
          onClick={() => onZoom('in')}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Zoom avant"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
          </svg>
        </button>
        <button
          onClick={() => onZoom('out')}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Zoom arrière"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 10a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 10Z" />
          </svg>
        </button>

        {groupBy !== undefined && onGroupByChange && (
          <>
            <div className="mx-1 h-4 w-px bg-gray-200" />
            <span className="text-xs text-gray-400">Grouper :</span>
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as GanttGrouping)}
              className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600 bg-white hover:bg-gray-50 transition-colors"
            >
              {GROUPINGS.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Timeline bucket headers */}
      <div className="flex">
        <div
          className="shrink-0 border-r border-gray-200"
          style={{ width: LEFT_COLUMN_WIDTH, minWidth: LEFT_COLUMN_WIDTH }}
        />
        <div className="flex flex-1">
          {buckets.map((bucket, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center border-r border-gray-100 py-1 text-center"
              style={{ flex: `${bucket.widthFraction} 0 0%` }}
            >
              <span className="text-xs font-medium text-gray-700 leading-tight">
                {bucket.label}
              </span>
              {bucket.sublabel && (
                <span className="text-[10px] text-gray-400 leading-tight">
                  {bucket.sublabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
