// ===========================
// GANTT COMPONENT — SHARED TYPES
// ===========================

import type { TaskStatus, UserSummary } from '@/types';

// ===========================
// ENUMS & LITERALS
// ===========================

export type GanttView = 'day' | 'week' | 'month' | 'quarter';

export type GanttGrouping = 'milestone' | 'epic' | 'none';

export type HealthStatus = 'on-track' | 'at-risk' | 'late' | 'upcoming' | 'done';

// ===========================
// ROW TYPES
// ===========================

export interface GanttPortfolioRow {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  /** 0–100 */
  progress: number;
  status: string;
  health: HealthStatus;
  /** Optional metadata */
  departmentName?: string;
  /** @deprecated use manager?.firstName + manager?.lastName instead — kept for tooltip text */
  managerName?: string;
  /** Full manager object for avatar rendering */
  manager?: UserSummary | null;
  code?: string;
  priority?: string;
}

export interface GanttTaskRow {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  /** 0–100 */
  progress: number;
  /** TaskStatus value */
  status: TaskStatus;
  milestoneId?: string;
  milestoneName?: string;
  epicId?: string;
  epicName?: string;
  /** When true, render as a diamond marker instead of a bar */
  isMilestone: boolean;
  /** @deprecated use assignee?.firstName + assignee?.lastName instead — kept for tooltip text */
  assigneeName?: string;
  /** @deprecated use assignee?.avatarUrl / assignee?.avatarPreset instead */
  assigneeAvatar?: string;
  /** Full assignee object for avatar rendering */
  assignee?: UserSummary | null;
  priority?: string;
}

// ===========================
// DEPENDENCIES
// ===========================

/** Finish-to-Start dependency */
export interface GanttDependency {
  fromId: string;
  toId: string;
}

// ===========================
// GROUPING
// ===========================

export interface GanttGroup {
  /** Milestone/epic ID, or 'ungrouped' */
  key: string;
  label: string;
  rows: GanttTaskRow[];
  isExpanded: boolean;
}

// ===========================
// COMPONENT PROPS (discriminated union)
// ===========================

export type GanttProps =
  | {
      scope: 'portfolio';
      rows: GanttPortfolioRow[];
      view: GanttView;
      onRowClick?: (row: GanttPortfolioRow) => void;
    }
  | {
      scope: 'project';
      rows: GanttTaskRow[];
      view: GanttView;
      dependencies?: GanttDependency[];
      /** @default 'milestone' */
      groupBy?: GanttGrouping;
      onRowClick?: (row: GanttTaskRow) => void;
      onRowDoubleClick?: (row: GanttTaskRow) => void;
    };
