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
  GanttDependency,
} from './types';
import {
  LEFT_COLUMN_WIDTH,
  PROJECT_ROW_HEIGHT,
  GROUP_HEADER_HEIGHT,
  HEALTH_COLORS,
  TASK_STATUS_COLORS,
  TASK_STATUS_DEFAULT_COLOR,
  TASK_STATUS_LABELS,
  lightenColor,
  getBarHeight,
  getRowHeight,
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
import GanttTooltip from './GanttTooltip';

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

function getBarColor(row: GanttPortfolioRow | GanttTaskRow, scope: 'portfolio' | 'project'): string {
  if (scope === 'portfolio') return HEALTH_COLORS[(row as GanttPortfolioRow).health];
  return TASK_STATUS_COLORS[(row as GanttTaskRow).status] ?? TASK_STATUS_DEFAULT_COLOR;
}

function isWeekendDate(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function AvatarCircle({ name, color }: { name?: string; color: string }) {
  if (!name) return null;
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-full"
      style={{
        width: 28,
        height: 28,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: lightenColor(color),
        color: color,
      }}
    >
      {initials}
    </span>
  );
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  const label = TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] ?? status;
  return (
    <span
      className="inline-flex items-center truncate"
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: color,
        backgroundColor: lightenColor(color),
        padding: '1px 8px',
        borderRadius: 10,
        maxWidth: 100,
      }}
    >
      {label}
    </span>
  );
}

export default function GanttBase(props: GanttProps) {
  const { scope, rows, view: initialView } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncSource = useRef<'top' | 'main' | null>(null);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<GanttView>(initialView);
  const [groupBy, setGroupBy] = useState<GanttGrouping>(
    scope === 'project' ? (props.groupBy ?? 'milestone') : 'none',
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    row: GanttPortfolioRow | GanttTaskRow;
    x: number;
    y: number;
  } | null>(null);

  const barHeight = getBarHeight(view);
  const rowHeight = getRowHeight(view);

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

  const dataRange = useMemo(() => {
    if (rows.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const s = row.startDate.getTime();
      const e = row.endDate.getTime();
      if (s < min) min = s;
      if (e > max) max = e;
    }
    return { start: new Date(min), end: new Date(max) };
  }, [rows]);

  const goToStart = useCallback(() => {
    if (dataRange) setCurrentDate(dataRange.start);
  }, [dataRange]);

  const fitAll = useCallback(() => {
    if (!dataRange) return;
    const diffMs = dataRange.end.getTime() - dataRange.start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const mid = new Date(dataRange.start.getTime() + diffMs / 2);
    if (diffDays <= 60) setView('day');
    else if (diffDays <= 180) setView('week');
    else if (diffDays <= 540) setView('month');
    else setView('quarter');
    setCurrentDate(mid);
  }, [dataRange]);

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

  // Hover handlers for tooltip + dependency highlight
  const handleBarMouseEnter = useCallback(
    (row: GanttPortfolioRow | GanttTaskRow, e: React.MouseEvent) => {
      setHoveredRowId(row.id);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltip({ row, x: e.clientX, y: e.clientY });
      }, 300);
    },
    [],
  );

  const handleBarMouseMove = useCallback(
    (row: GanttPortfolioRow | GanttTaskRow, e: React.MouseEvent) => {
      if (tooltip) {
        setTooltip({ row, x: e.clientX, y: e.clientY });
      }
    },
    [tooltip],
  );

  const handleBarMouseLeave = useCallback(() => {
    setHoveredRowId(null);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setTooltip(null);
  }, []);

  // Compute total grid height
  const computeGridHeight = useMemo(() => {
    if (scope === 'portfolio') {
      return rows.length * PROJECT_ROW_HEIGHT;
    }
    let h = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (groupBy !== 'none') {
        if (i > 0) h += 12;
        h += GROUP_HEADER_HEIGHT;
      }
      if (g.isExpanded) {
        h += g.rows.length * rowHeight;
      }
    }
    return h;
  }, [scope, rows, groups, groupBy, rowHeight]);

  // Row positions for dependency arrows
  const rowPositions = useMemo(() => {
    const map = new Map<string, { y: number; left: number; right: number; height: number }>();
    if (scope !== 'project') return map;
    let y = 0;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (groupBy !== 'none') {
        if (i > 0) y += 12;
        y += GROUP_HEADER_HEIGHT;
      }
      if (group.isExpanded) {
        for (const row of group.rows) {
          const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
          const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
          map.set(row.id, { y, left: barLeft, right: barRight, height: rowHeight });
          y += rowHeight;
        }
      }
    }
    return map;
  }, [scope, groups, groupBy, view, rangeStart, pixelsPerUnit, rowHeight]);

  const dependencies: GanttDependency[] =
    scope === 'project' && 'dependencies' in props ? (props.dependencies ?? []) : [];

  const isWeekend = (bucketIdx: number) => {
    if (view !== 'day' && view !== 'week') return false;
    if (!buckets[bucketIdx]) return false;
    if (view === 'day') return isWeekendDate(buckets[bucketIdx].start);
    return false;
  };

  const handleTopScroll = useCallback(() => {
    if (scrollSyncSource.current === 'main') { scrollSyncSource.current = null; return; }
    scrollSyncSource.current = 'top';
    if (mainScrollRef.current && topScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  }, []);

  const handleMainScroll = useCallback(() => {
    if (scrollSyncSource.current === 'top') { scrollSyncSource.current = null; return; }
    scrollSyncSource.current = 'main';
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
  }, []);

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
      return (rows as GanttPortfolioRow[]).map((row, idx) => {
        const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
        const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
        const color = getBarColor(row, 'portfolio');
        return (
          <div
            key={row.id}
            className="relative"
            style={{
              height: PROJECT_ROW_HEIGHT,
              backgroundColor: idx % 2 === 1 ? '#F8FAFC' : undefined,
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <GanttBar
              left={barLeft}
              width={Math.max(barRight - barLeft, 4)}
              progress={row.progress}
              color={color}
              name={row.name}
              view={view}
              onMouseEnter={(e) => handleBarMouseEnter(row, e)}
              onMouseLeave={handleBarMouseLeave}
              onMouseMove={(e) => handleBarMouseMove(row, e)}
            />
          </div>
        );
      });
    }

    // Project scope
    const elements: React.ReactNode[] = [];
    let rowIndex = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (groupBy !== 'none') {
        if (gi > 0) {
          elements.push(<div key={`gap-${group.key}`} style={{ height: 12 }} />);
        }
        elements.push(
          <div key={`gh-${group.key}`} style={{ height: GROUP_HEADER_HEIGHT }} />,
        );
      }
      if (group.isExpanded) {
        for (const row of group.rows) {
          const barLeft = dateToX(row.startDate, view, rangeStart, pixelsPerUnit);
          const barRight = dateToX(row.endDate, view, rangeStart, pixelsPerUnit);
          const color = getBarColor(row, 'project');
          const idx = rowIndex++;
          elements.push(
            <div
              key={row.id}
              className="relative"
              style={{
                height: rowHeight,
                backgroundColor: idx % 2 === 1 ? '#F8FAFC' : undefined,
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <GanttBar
                left={barLeft}
                width={Math.max(barRight - barLeft, 4)}
                progress={row.progress}
                color={color}
                isMilestone={row.isMilestone}
                name={row.name}
                view={view}
                milestoneDate={row.isMilestone ? row.startDate : undefined}
                onMouseEnter={(e) => handleBarMouseEnter(row, e)}
                onMouseLeave={handleBarMouseLeave}
                onMouseMove={(e) => handleBarMouseMove(row, e)}
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
      return (rows as GanttPortfolioRow[]).map((row, idx) => {
        const color = getBarColor(row, 'portfolio');
        return (
          <div
            key={row.id}
            role="row"
            tabIndex={0}
            className="flex items-center gap-2 px-3 cursor-pointer transition-colors"
            style={{
              height: PROJECT_ROW_HEIGHT,
              borderBottom: '1px solid #F1F5F9',
              backgroundColor: idx % 2 === 1 ? '#F8FAFC' : undefined,
            }}
            onClick={() => handleRowClick(row)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(248,250,252,0.6)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 1 ? '#F8FAFC' : ''; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(row);
              }
            }}
          >
            <span className="truncate" style={{ fontSize: 13, color: '#1E293B' }}>{row.name}</span>
            <span
              className="ml-auto shrink-0 h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        );
      });
    }

    // Project scope — with avatar + status badge
    const elements: React.ReactNode[] = [];
    let rowIndex = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (groupBy !== 'none') {
        if (gi > 0) {
          elements.push(<div key={`gap-${group.key}`} style={{ height: 12 }} />);
        }
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
          const color = getBarColor(row, 'project');
          const idx = rowIndex++;
          elements.push(
            <div
              key={row.id}
              role="row"
              tabIndex={0}
              className="flex items-center cursor-pointer transition-colors"
              style={{
                height: rowHeight,
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: idx % 2 === 1 ? '#F8FAFC' : undefined,
              }}
              onClick={() => handleRowClick(row)}
              onDoubleClick={() => handleRowDoubleClick(row)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(248,250,252,0.6)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 1 ? '#F8FAFC' : ''; }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(row);
                }
              }}
            >
              {/* Task name */}
              <span
                className="flex-1 truncate"
                style={{
                  fontSize: 13,
                  color: '#1E293B',
                  paddingLeft: row.isMilestone ? 12 : 24,
                }}
              >
                {row.name}
              </span>
              {/* Avatar */}
              <div className="flex items-center justify-center" style={{ width: 56, flexShrink: 0 }}>
                {!row.isMilestone && (
                  <AvatarCircle name={row.assigneeName} color={color} />
                )}
              </div>
              {/* Status badge */}
              <div className="flex items-center justify-center" style={{ width: 100, flexShrink: 0, paddingRight: 8 }}>
                {!row.isMilestone && (
                  <StatusBadge status={row.status} color={color} />
                )}
              </div>
            </div>,
          );
        }
      }
    }
    return elements;
  };

  const containerRect = containerRef.current?.getBoundingClientRect();

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label="Diagramme de Gantt"
      className="relative flex flex-col border rounded-lg bg-white overflow-hidden"
    >
      <GanttHeader
        buckets={buckets}
        view={view}
        currentDate={currentDate}
        onNavigate={navigateTime}
        onToday={goToToday}
        onViewChange={handleViewChange}
        onZoom={handleZoom}
        groupBy={scope === 'project' ? groupBy : undefined}
        onGroupByChange={scope === 'project' ? handleGroupByChange : undefined}
        todayLeft={todayLeft}
        onGoToStart={goToStart}
        onFitAll={fitAll}
      />

      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: 12, borderBottom: '1px solid #F1F5F9' }}
      >
        <div style={{ width: LEFT_COLUMN_WIDTH + totalTimelineWidth, height: 1 }} />
      </div>

      <div ref={mainScrollRef} onScroll={handleMainScroll} className="flex flex-1 overflow-auto">
        {/* Left labels column */}
        <div
          className="shrink-0 sticky left-0 z-10 bg-white"
          style={{
            width: LEFT_COLUMN_WIDTH,
            minWidth: LEFT_COLUMN_WIDTH,
            borderRight: '1px solid #E2E8F0',
            cursor: 'default',
          }}
        >
          {scope === 'project' && (
            <div
              className="flex items-center"
              style={{
                height: 32,
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                fontSize: 11,
                fontWeight: 600,
                color: '#64748B',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
              }}
            >
              <span className="flex-1 truncate" style={{ paddingLeft: 12 }}>Tâche</span>
              <span className="text-center" style={{ width: 56, flexShrink: 0 }}>Resp.</span>
              <span className="text-center" style={{ width: 100, flexShrink: 0, paddingRight: 8 }}>Statut</span>
            </div>
          )}
          {renderLeftColumn()}
          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full"
            style={{ cursor: 'col-resize' }}
          />
        </div>

        {/* Timeline grid area */}
        <div className="relative flex-1" style={{ minWidth: totalTimelineWidth }}>
          {/* Column header spacer for project scope */}
          {scope === 'project' && (
            <div style={{ height: 32, borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }} />
          )}
          {/* Vertical grid lines + weekend shading */}
          <div className="absolute inset-0 pointer-events-none flex" style={{ top: scope === 'project' ? 32 : 0, height: computeGridHeight }}>
            {buckets.map((bucket, i) => (
              <div
                key={i}
                style={{
                  flex: `${bucket.widthFraction} 0 0%`,
                  height: '100%',
                  borderRight: '1px solid #F1F5F9',
                  backgroundColor: isWeekend(i) ? '#F8FAFC' : undefined,
                }}
              />
            ))}
          </div>

          {/* Bars + dependency arrows + today line */}
          <div className="relative" style={{ height: computeGridHeight }}>
            {renderTimelineRows()}

            {scope === 'project' && dependencies.length > 0 && (
              <GanttDependencyLayer
                dependencies={dependencies}
                rowPositions={rowPositions}
                width={totalTimelineWidth}
                height={computeGridHeight}
                hoveredRowId={hoveredRowId}
              />
            )}

            {todayLeft !== null && (
              <GanttTodayLine left={todayLeft} height={computeGridHeight} />
            )}
          </div>
        </div>
      </div>

      <GanttLegend scope={scope} />

      {/* Tooltip */}
      {tooltip && containerRect && (
        <GanttTooltip
          row={tooltip.row}
          scope={scope}
          x={tooltip.x}
          y={tooltip.y}
          containerRect={containerRect}
        />
      )}
    </div>
  );
}
