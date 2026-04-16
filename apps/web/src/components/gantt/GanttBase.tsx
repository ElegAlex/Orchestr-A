'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfQuarter,
  endOfQuarter,
} from 'date-fns';
import { fr } from 'date-fns/locale';

import type {
  GanttProps,
  GanttView,
  GanttGrouping,
  GanttPortfolioRow,
  GanttTaskRow,
  GanttGroup,
} from './types';
import type { GanttDependency } from './types';
import {
  LEFT_COLUMN_WIDTH,
  PROJECT_ROW_HEIGHT,
  TASK_ROW_HEIGHT,
  MILESTONE_ROW_HEIGHT,
  GROUP_HEADER_HEIGHT,
  HEALTH_COLORS,
  TASK_STATUS_COLORS,
  TASK_STATUS_DEFAULT_COLOR,
} from './tokens';
import { dateToX, bucketsForRange, getDefaultPixelsPerUnit } from './timeline-math';
import { groupTasks } from './grouping';

import GanttHeader from './GanttHeader';
import GanttGroupHeader from './GanttGroupHeader';
import GanttBar from './GanttBar';
import GanttTodayLine from './GanttTodayLine';
import GanttLegend from './GanttLegend';
import GanttEmptyState from './GanttEmptyState';
import GanttDependencyLayer from './GanttDependencyLayer';

const VIEW_ORDER: GanttView[] = ['day', 'week', 'month', 'quarter'];

function getVisibleRange(currentDate: Date, view: GanttView): { start: Date; end: Date } {
  switch (view) {
    case 'day':
      return { start: addDays(currentDate, -15), end: addDays(currentDate, 15) };
    case 'week':
      return {
        start: startOfWeek(addWeeks(currentDate, -15), { locale: fr }),
        end: endOfWeek(addWeeks(currentDate, 15), { locale: fr }),
      };
    case 'month':
      return {
        start: startOfMonth(addMonths(currentDate, -6)),
        end: endOfMonth(addMonths(currentDate, 5)),
      };
    case 'quarter':
      return {
        start: startOfQuarter(addMonths(currentDate, -6)),
        end: endOfQuarter(addMonths(currentDate, 6)),
      };
  }
}

function isTaskRow(row: GanttPortfolioRow | GanttTaskRow): row is GanttTaskRow {
  return 'isMilestone' in row;
}

function getRowHeight(row: GanttPortfolioRow | GanttTaskRow, scope: 'portfolio' | 'project'): number {
  if (scope === 'portfolio') return PROJECT_ROW_HEIGHT;
  if (isTaskRow(row) && row.isMilestone) return MILESTONE_ROW_HEIGHT;
  return TASK_ROW_HEIGHT;
}

function getBarColor(row: GanttPortfolioRow | GanttTaskRow, scope: 'portfolio' | 'project'): string {
  if (scope === 'portfolio') return HEALTH_COLORS[(row as GanttPortfolioRow).health];
  return TASK_STATUS_COLORS[(row as GanttTaskRow).status] ?? TASK_STATUS_DEFAULT_COLOR;
}

export default function GanttBase(props: GanttProps) {
  const { scope, rows, view: initialView } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<GanttView>(initialView);
  const [groupBy, setGroupBy] = useState<GanttGrouping>(
    scope === 'project' ? (props.groupBy ?? 'milestone') : 'none',
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const pixelsPerUnit = useMemo(() => getDefaultPixelsPerUnit(view), [view]);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getVisibleRange(currentDate, view),
    [currentDate, view],
  );

  const buckets = useMemo(
    () => bucketsForRange(rangeStart, rangeEnd, view),
    [rangeStart, rangeEnd, view],
  );

  const totalTimelineWidth = useMemo(() => {
    const endX = dateToX(rangeEnd, view, rangeStart, pixelsPerUnit);
    return Math.max(endX, 600);
  }, [rangeEnd, rangeStart, view, pixelsPerUnit]);

  const todayLeft = useMemo(() => {
    const now = new Date();
    if (now < rangeStart || now > rangeEnd) return null;
    return dateToX(now, view, rangeStart, pixelsPerUnit);
  }, [rangeStart, rangeEnd, view, pixelsPerUnit]);

  // Groups (project scope only)
  const groups = useMemo<GanttGroup[]>(() => {
    if (scope !== 'project') return [];
    return groupTasks(rows as GanttTaskRow[], groupBy).map((g) => ({
      ...g,
      isExpanded: !expandedGroups.has(g.key),
    }));
  }, [scope, rows, groupBy, expandedGroups]);

  // Navigation
  const navigateTime = useCallback(
    (direction: 'prev' | 'next') => {
      const sign = direction === 'next' ? 1 : -1;
      setCurrentDate((prev) => {
        switch (view) {
          case 'day': return addDays(prev, sign * 30);
          case 'week': return addWeeks(prev, sign * 7);
          case 'month': return addMonths(prev, sign * 12);
          case 'quarter': return addMonths(prev, sign * 12);
        }
      });
    },
    [view],
  );

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const handleZoom = useCallback(
    (direction: 'in' | 'out') => {
      const idx = VIEW_ORDER.indexOf(view);
      if (direction === 'in' && idx > 0) setView(VIEW_ORDER[idx - 1]);
      if (direction === 'out' && idx < VIEW_ORDER.length - 1) setView(VIEW_ORDER[idx + 1]);
    },
    [view],
  );

  const handleViewChange = useCallback((v: GanttView) => setView(v), []);

  const handleGroupByChange = useCallback((g: GanttGrouping) => setGroupBy(g), []);

  const handleGroupToggle = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleRowClick = useCallback(
    (row: GanttPortfolioRow | GanttTaskRow) => {
      if (scope === 'portfolio' && props.onRowClick) {
        (props.onRowClick as (r: GanttPortfolioRow) => void)(row as GanttPortfolioRow);
      } else if (scope === 'project' && props.onRowClick) {
        (props.onRowClick as (r: GanttTaskRow) => void)(row as GanttTaskRow);
      }
    },
    [scope, props.onRowClick],
  );

  const handleRowDoubleClick = useCallback(
    (row: GanttTaskRow) => {
      if (scope === 'project' && 'onRowDoubleClick' in props && props.onRowDoubleClick) {
        props.onRowDoubleClick(row);
      }
    },
    [scope, props],
  );

  // Compute total grid height
  const computeGridHeight = useMemo(() => {
    if (scope === 'portfolio') {
      return rows.length * PROJECT_ROW_HEIGHT;
    }
    let h = 0;
    for (const g of groups) {
      if (groupBy !== 'none') h += GROUP_HEADER_HEIGHT;
      if (g.isExpanded) {
        for (const r of g.rows) {
          h += r.isMilestone ? MILESTONE_ROW_HEIGHT : TASK_ROW_HEIGHT;
        }
      }
    }
    return h;
  }, [scope, rows, groups, groupBy]);

  // Compute row positions for dependency arrows (project scope only)
  const rowPositions = useMemo(() => {
    const map = new Map<string, { y: number; left: number; right: number; height: number }>();
    if (scope !== 'project') return map;
    let y = 0;
    for (const group of groups) {
      if (groupBy !== 'none') y += GROUP_HEADER_HEIGHT;
      if (group.isExpanded) {
        for (const row of group.rows) {
          const h = row.isMilestone ? MILESTONE_ROW_HEIGHT : TASK_ROW_HEIGHT;
          const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
          const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
          map.set(row.id, { y, left: barLeft, right: barRight, height: h });
          y += h;
        }
      }
    }
    return map;
  }, [scope, groups, groupBy, view, rangeStart, pixelsPerUnit]);

  // Dependencies (project scope only)
  const dependencies: GanttDependency[] =
    scope === 'project' && 'dependencies' in props ? (props.dependencies ?? []) : [];

  // Check if weekend (for day view background)
  const isWeekend = (bucketIdx: number) => {
    if (view !== 'day' || !buckets[bucketIdx]) return false;
    const day = buckets[bucketIdx].start.getDay();
    return day === 0 || day === 6;
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-col border rounded-lg bg-white overflow-hidden">
        <GanttEmptyState />
      </div>
    );
  }

  // Render timeline rows
  const renderTimelineRows = () => {
    if (scope === 'portfolio') {
      return (rows as GanttPortfolioRow[]).map((row) => {
        const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
        const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
        const color = getBarColor(row, 'portfolio');
        return (
          <div
            key={row.id}
            className="relative"
            style={{ height: PROJECT_ROW_HEIGHT }}
          >
            <GanttBar
              left={barLeft}
              width={Math.max(barRight - barLeft, 4)}
              progress={row.progress}
              color={color}
              label={`${Math.round(row.progress)}%`}
            />
          </div>
        );
      });
    }

    // Project scope
    const elements: React.ReactNode[] = [];
    for (const group of groups) {
      if (groupBy !== 'none') {
        elements.push(
          <div key={`gh-${group.key}`} style={{ height: GROUP_HEADER_HEIGHT }} />,
        );
      }
      if (group.isExpanded) {
        for (const row of group.rows) {
          const h = row.isMilestone ? MILESTONE_ROW_HEIGHT : TASK_ROW_HEIGHT;
          const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
          const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
          const color = getBarColor(row, 'project');
          elements.push(
            <div key={row.id} className="relative" style={{ height: h }}>
              <GanttBar
                left={barLeft}
                width={Math.max(barRight - barLeft, 4)}
                progress={row.progress}
                color={color}
                isMilestone={row.isMilestone}
                label={row.isMilestone ? undefined : `${Math.round(row.progress)}%`}
              />
            </div>,
          );
        }
      }
    }
    return elements;
  };

  // Render left column rows
  const renderLeftColumn = () => {
    if (scope === 'portfolio') {
      return (rows as GanttPortfolioRow[]).map((row) => {
        const color = getBarColor(row, 'portfolio');
        return (
          <div
            key={row.id}
            role="row"
            tabIndex={0}
            className="flex items-center gap-2 px-3 border-b border-gray-100 hover:bg-gray-50/60 cursor-pointer transition-colors"
            style={{ height: PROJECT_ROW_HEIGHT }}
            onClick={() => handleRowClick(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(row);
              }
            }}
          >
            <span className="truncate text-sm text-gray-800">{row.name}</span>
            <span
              className="ml-auto shrink-0 h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        );
      });
    }

    // Project scope
    const elements: React.ReactNode[] = [];
    for (const group of groups) {
      if (groupBy !== 'none') {
        elements.push(
          <GanttGroupHeader
            key={`gh-${group.key}`}
            group={group}
            onToggle={handleGroupToggle}
          />,
        );
      }
      if (group.isExpanded) {
        for (const row of group.rows) {
          const h = row.isMilestone ? MILESTONE_ROW_HEIGHT : TASK_ROW_HEIGHT;
          elements.push(
            <div
              key={row.id}
              role="row"
              tabIndex={0}
              className="flex items-center px-3 border-b border-gray-100 hover:bg-gray-50/60 cursor-pointer transition-colors"
              style={{ height: h }}
              onClick={() => handleRowClick(row)}
              onDoubleClick={() => handleRowDoubleClick(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(row);
                }
              }}
            >
              <span className="truncate text-sm text-gray-700">{row.name}</span>
            </div>,
          );
        }
      }
    }
    return elements;
  };

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label="Diagramme de Gantt"
      className="flex flex-col border rounded-lg bg-white overflow-hidden"
    >
      <GanttHeader
        buckets={buckets}
        view={view}
        onNavigate={navigateTime}
        onToday={goToToday}
        onViewChange={handleViewChange}
        onZoom={handleZoom}
        groupBy={scope === 'project' ? groupBy : undefined}
        onGroupByChange={scope === 'project' ? handleGroupByChange : undefined}
      />

      <div className="flex flex-1 overflow-auto">
        {/* Left labels column */}
        <div
          className="shrink-0 sticky left-0 z-10 bg-white border-r border-gray-200"
          style={{ width: LEFT_COLUMN_WIDTH, minWidth: LEFT_COLUMN_WIDTH }}
        >
          {renderLeftColumn()}
        </div>

        {/* Timeline grid area */}
        <div className="relative flex-1" style={{ minWidth: totalTimelineWidth }}>
          {/* Vertical grid lines + weekend shading */}
          <div className="absolute inset-0 pointer-events-none flex" style={{ height: computeGridHeight }}>
            {buckets.map((bucket, i) => (
              <div
                key={i}
                className={`border-r border-gray-100 ${isWeekend(i) ? 'bg-gray-50/50' : ''}`}
                style={{ flex: `${bucket.widthFraction} 0 0%`, height: '100%' }}
              />
            ))}
          </div>

          {/* Bars */}
          <div className="relative" style={{ height: computeGridHeight }}>
            {renderTimelineRows()}
          </div>

          {/* Dependency arrows */}
          {scope === 'project' && dependencies.length > 0 && (
            <GanttDependencyLayer
              dependencies={dependencies}
              rowPositions={rowPositions}
              width={totalTimelineWidth}
              height={computeGridHeight}
            />
          )}

          {/* Today line */}
          {todayLeft !== null && (
            <GanttTodayLine left={todayLeft} height={computeGridHeight} />
          )}
        </div>
      </div>

      <GanttLegend scope={scope} />
    </div>
  );
}
