// ===========================
// GANTT COMPONENT — DESIGN TOKENS
// ===========================
//
// Centralized constants extracted from Portfolio & Project Gantt renderers.
// These are TS constants (not CSS) consumed by the canvas/SVG rendering layer.

import type { TaskStatus } from '@/types';
import type { HealthStatus } from './types';

// ===========================
// HEALTH / RAG COLORS (Portfolio scope)
// ===========================

export const HEALTH_COLORS: Record<HealthStatus, string> = {
  'on-track': '#22c55e', // green-500
  'at-risk':  '#f59e0b', // amber-500
  'late':     '#ef4444', // red-500
  'upcoming': '#60a5fa', // blue-400
  'done':     '#9ca3af', // gray-400
} as const;

// ===========================
// TASK STATUS COLORS (Project scope)
// ===========================

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO:        '#3b82f6', // blue-500
  IN_PROGRESS: '#f59e0b', // amber-500
  DONE:        '#22c55e', // green-500
  BLOCKED:     '#ef4444', // red-500
  IN_REVIEW:   '#8b5cf6', // purple-500
} as const;

/** Fallback when a status is unknown or unmapped */
export const TASK_STATUS_DEFAULT_COLOR = '#3b82f6' as const; // blue-500

// ===========================
// MILESTONE STATUS COLORS
// ===========================

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  PENDING:     '#9ca3af', // gray-400
  IN_PROGRESS: '#60a5fa', // blue-400
  COMPLETED:   '#22c55e', // green-500
  DELAYED:     '#ef4444', // red-500
} as const;

// ===========================
// DIMENSIONS (px)
// ===========================

export const LEFT_COLUMN_WIDTH   = 256 as const;  // w-64
export const BAR_HEIGHT          = 32  as const;  // h-8
export const PROJECT_ROW_HEIGHT  = 50  as const;
export const TASK_ROW_HEIGHT     = 40  as const;
export const MILESTONE_ROW_HEIGHT = 36 as const;
export const GROUP_HEADER_HEIGHT = 32  as const;
export const BAR_BORDER_RADIUS   = 9999 as const; // rounded-full

// ===========================
// VISUAL PROPERTIES
// ===========================

export const BAR_OPACITY       = 0.2 as const;
export const ARROW_COLOR       = '#6b7280' as const; // gray-500
export const ARROW_INDENT      = 20  as const;       // px
export const TODAY_LINE_COLOR  = '#ef4444' as const;  // red-500

// ===========================
// TYPOGRAPHY
// ===========================

export const FONT_SIZE_XS       = 10  as const;
export const FONT_SIZE_SM       = 12  as const;
export const FONT_SIZE_BASE     = 14  as const;
export const FONT_WEIGHT_NORMAL   = 400 as const;
export const FONT_WEIGHT_SEMIBOLD = 600 as const;
