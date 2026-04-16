'use client';

import { useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { GanttView, GanttGrouping } from './types';
import type { TimelineBucket } from './timeline-math';
import { LEFT_COLUMN_WIDTH } from './tokens';

interface GanttHeaderProps {
  buckets: TimelineBucket[];
  view: GanttView;
  currentDate: Date;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToday: () => void;
  onViewChange: (view: GanttView) => void;
  onZoom: (direction: 'in' | 'out') => void;
  groupBy?: GanttGrouping;
  onGroupByChange?: (groupBy: GanttGrouping) => void;
  todayLeft?: number | null;
  onGoToStart?: () => void;
  onFitAll?: () => void;
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

interface SuperBucket {
  label: string;
  span: number;
  totalWidthFraction: number;
}

const MONTH_SHORT = ['Janv', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

function computeSuperBuckets(buckets: TimelineBucket[], view: GanttView): SuperBucket[] {
  if (buckets.length === 0) return [];
  const groups: SuperBucket[] = [];

  const getKey = (bucket: TimelineBucket): string => {
    const d = bucket.start;
    switch (view) {
      case 'day':
      case 'week':
        return `${d.getFullYear()}-${d.getMonth()}`;
      case 'month': {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `${d.getFullYear()}-Q${q}`;
      }
      case 'quarter':
        return `${d.getFullYear()}`;
    }
  };

  const getLabel = (bucket: TimelineBucket): string => {
    const d = bucket.start;
    switch (view) {
      case 'day':
      case 'week':
        return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
      case 'month': {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q} ${d.getFullYear()}`;
      }
      case 'quarter':
        return `${d.getFullYear()}`;
    }
  };

  let currentKey = getKey(buckets[0]);
  let currentGroup: SuperBucket = { label: getLabel(buckets[0]), span: 1, totalWidthFraction: buckets[0].widthFraction };

  for (let i = 1; i < buckets.length; i++) {
    const key = getKey(buckets[i]);
    if (key === currentKey) {
      currentGroup.span++;
      currentGroup.totalWidthFraction += buckets[i].widthFraction;
    } else {
      groups.push(currentGroup);
      currentKey = key;
      currentGroup = { label: getLabel(buckets[i]), span: 1, totalWidthFraction: buckets[i].widthFraction };
    }
  }
  groups.push(currentGroup);
  return groups;
}

function getLowerLabel(bucket: TimelineBucket, view: GanttView): string {
  switch (view) {
    case 'day':
      return String(bucket.start.getDate());
    case 'week': {
      const weekNum = getISOWeek(bucket.start);
      return `S${weekNum}`;
    }
    case 'month':
      return MONTH_SHORT[bucket.start.getMonth()];
    case 'quarter': {
      const q = Math.floor(bucket.start.getMonth() / 3) + 1;
      return `Q${q}`;
    }
  }
}

function getLowerSublabel(bucket: TimelineBucket, view: GanttView): string | undefined {
  if (view === 'day') {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return days[bucket.start.getDay()];
  }
  return undefined;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function isWeekendDay(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export default function GanttHeader({
  buckets,
  view,
  currentDate,
  onNavigate,
  onToday,
  onViewChange,
  onZoom,
  groupBy,
  onGroupByChange,
  todayLeft,
  onGoToStart,
  onFitAll,
}: GanttHeaderProps) {
  const handlePrev = useCallback(() => onNavigate('prev'), [onNavigate]);
  const handleNext = useCallback(() => onNavigate('next'), [onNavigate]);
  const superBuckets = useMemo(() => computeSuperBuckets(buckets, view), [buckets, view]);

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="sticky top-0 z-30 bg-white" style={{ borderBottom: '1px solid #E2E8F0' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
        {/* Navigation group */}
        <button
          onClick={handlePrev}
          className="rounded p-1 transition-colors"
          style={{ color: '#64748B' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          aria-label="Précédent"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium capitalize" style={{ color: '#0F172A', minWidth: 140, textAlign: 'center' }}>
          {monthLabel}
        </span>
        <button
          onClick={handleNext}
          className="rounded p-1 transition-colors"
          style={{ color: '#64748B' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          aria-label="Suivant"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onToday}
          className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
          style={{ color: '#475569', border: '1px solid #E2E8F0' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
        >
          Aujourd'hui
        </button>
        {onGoToStart && (
          <button
            onClick={onGoToStart}
            className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
            style={{ color: '#475569', border: '1px solid #E2E8F0' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          >
            Début
          </button>
        )}
        {onFitAll && (
          <button
            onClick={onFitAll}
            className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
            style={{ color: '#475569', border: '1px solid #E2E8F0' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          >
            Tout voir
          </button>
        )}

        {/* Divider */}
        <div style={{ margin: '0 8px', height: 20, width: 1, backgroundColor: '#CBD5E1' }} />

        {/* Zoom group */}
        <button
          onClick={() => onZoom('out')}
          className="rounded p-1 transition-colors"
          style={{ color: '#64748B' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          aria-label="Dézoomer"
        >
          <Minus size={14} />
        </button>
        <span className="text-xs tabular-nums" style={{ color: '#64748B', fontWeight: 500, minWidth: 32, textAlign: 'center' }}>
          100%
        </span>
        <button
          onClick={() => onZoom('in')}
          className="rounded p-1 transition-colors"
          style={{ color: '#64748B' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          aria-label="Zoomer"
        >
          <Plus size={14} />
        </button>

        {/* Divider */}
        <div style={{ margin: '0 8px', height: 20, width: 1, backgroundColor: '#CBD5E1' }} />

        {/* View selector */}
        <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className="px-2.5 py-0.5 text-xs font-medium transition-colors"
              style={
                view === v
                  ? { backgroundColor: '#0F172A', color: 'white' }
                  : { color: '#64748B' }
              }
              onMouseEnter={(e) => {
                if (view !== v) e.currentTarget.style.backgroundColor = '#F1F5F9';
              }}
              onMouseLeave={(e) => {
                if (view !== v) e.currentTarget.style.backgroundColor = '';
              }}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Grouping (project scope only) */}
        {groupBy !== undefined && onGroupByChange && (
          <>
            <div style={{ margin: '0 8px', height: 20, width: 1, backgroundColor: '#CBD5E1' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>Grouper par :</span>
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as GanttGrouping)}
              className="rounded px-1.5 py-0.5 text-xs bg-white transition-colors"
              style={{ color: '#475569', border: '1px solid #E2E8F0' }}
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

      {/* Timeline header — upper level (context) */}
      <div className="flex">
        <div
          className="shrink-0"
          style={{ width: LEFT_COLUMN_WIDTH, minWidth: LEFT_COLUMN_WIDTH, borderRight: '1px solid #E2E8F0' }}
        />
        <div className="flex flex-1">
          {superBuckets.map((sb, i) => (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{
                flex: `${sb.totalWidthFraction} 0 0%`,
                height: 28,
                borderRight: '1px solid #E2E8F0',
                fontSize: 14,
                fontWeight: 600,
                color: '#0F172A',
              }}
            >
              {sb.label}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline header — lower level (granularity) */}
      <div className="flex relative">
        <div
          className="shrink-0"
          style={{ width: LEFT_COLUMN_WIDTH, minWidth: LEFT_COLUMN_WIDTH, borderRight: '1px solid #E2E8F0' }}
        />
        <div className="flex flex-1">
          {buckets.map((bucket, i) => {
            const isWe = view === 'day' && isWeekendDay(bucket.start);
            const sublabel = getLowerSublabel(bucket, view);
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center text-center"
                style={{
                  flex: `${bucket.widthFraction} 0 0%`,
                  height: 28,
                  borderRight: '1px solid #F1F5F9',
                  backgroundColor: isWe ? '#F8FAFC' : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: isWe ? '#94A3B8' : '#334155',
                    lineHeight: 1.2,
                  }}
                >
                  {getLowerLabel(bucket, view)}
                </span>
                {sublabel && (
                  <span
                    style={{
                      fontSize: 10,
                      color: isWe ? '#CBD5E1' : '#94A3B8',
                      lineHeight: 1.2,
                    }}
                  >
                    {sublabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* TODAY badge on header */}
        {todayLeft != null && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: LEFT_COLUMN_WIDTH + todayLeft,
              top: -30,
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'white',
                backgroundColor: '#F43F5E',
                padding: '2px 8px',
                borderRadius: 10,
                display: 'block',
              }}
            >
              AUJOURD'HUI
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
