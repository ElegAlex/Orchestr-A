import type { TaskStatus } from '@/types';
import type { HealthStatus, GanttView } from './types';

// ===========================
// HEALTH / RAG COLORS (Portfolio scope)
// ===========================

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  'on-track': '#10B981', // emerald-500
  'at-risk':  '#F59E0B', // amber-500
  'late':     '#F43F5E', // rose-500
  'upcoming': '#94A3B8', // slate-400
  'done':     '#047857', // emerald-700
} as const;

// ===========================
// TASK STATUS COLORS (Project scope)
// ===========================

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO:        '#94A3B8', // slate-400
  IN_PROGRESS: '#14B8A6', // teal-500
  DONE:        '#10B981', // emerald-500
  BLOCKED:     '#F43F5E', // rose-500
  IN_REVIEW:   '#F59E0B', // amber-500
} as const;

export const TASK_STATUS_DEFAULT_COLOR = '#94A3B8' as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO:        'À faire',
  IN_PROGRESS: 'En cours',
  DONE:        'Terminé',
  BLOCKED:     'Bloqué',
  IN_REVIEW:   'En revue',
} as const;

// ===========================
// MILESTONE COLORS
// ===========================

export const MILESTONE_COLOR = '#F59E0B' as const;       // amber-500
export const MILESTONE_BORDER_COLOR = '#D97706' as const; // amber-600

// ===========================
// DIMENSIONS (px) — view-aware
// ===========================

export const LEFT_COLUMN_WIDTH = 256 as const;
export const BAR_BORDER_RADIUS = 9999 as const;
export const GROUP_HEADER_HEIGHT = 40 as const;
export const PROJECT_ROW_HEIGHT = 50 as const;

export function getBarHeight(view: GanttView): number {
  return view === 'day' || view === 'week' ? 28 : 24;
}

export function getRowHeight(view: GanttView): number {
  return view === 'day' || view === 'week' ? 44 : 36;
}

// ===========================
// VISUAL PROPERTIES
// ===========================

export const ARROW_COLOR = '#94A3B8' as const;       // slate-400
export const ARROW_HIGHLIGHT_COLOR = '#334155' as const; // slate-700
export const ARROW_INDENT = 20 as const;
export const TODAY_LINE_COLOR = '#F43F5E' as const;  // rose-500

// ===========================
// TYPOGRAPHY
// ===========================

export const FONT_SIZE_XS = 10 as const;
export const FONT_SIZE_SM = 12 as const;
export const FONT_SIZE_BASE = 14 as const;
export const FONT_WEIGHT_NORMAL = 400 as const;
export const FONT_WEIGHT_MEDIUM = 500 as const;
export const FONT_WEIGHT_SEMIBOLD = 600 as const;

// ===========================
// COLOR UTILITIES
// ===========================

export function hexWithAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export function darkenColor(hex: string, amount = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${d(r).toString(16).padStart(2, '0')}${d(g).toString(16).padStart(2, '0')}${d(b).toString(16).padStart(2, '0')}`;
}

export function lightenColor(hex: string, amount = 0.85): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const l = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount));
  return `#${l(r).toString(16).padStart(2, '0')}${l(g).toString(16).padStart(2, '0')}${l(b).toString(16).padStart(2, '0')}`;
}
