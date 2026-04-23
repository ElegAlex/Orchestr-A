import { api } from "@/lib/api";

export type DateRangeParam = "week" | "month" | "quarter" | "year";

export interface AnalyticsMetric {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "stable";
  color: "primary" | "secondary" | "success" | "warning" | "error" | "info";
}

export interface AnalyticsProjectProgress {
  name: string;
  progress: number;
  status: string;
  tasks: number;
}

export interface AnalyticsTaskStatus {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

export interface AnalyticsProjectDetail {
  id: string;
  name: string;
  code: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  projectManager?: string;
  loggedHours: number;
  budgetHours: number;
  startDate: string;
  dueDate?: string;
  isOverdue: boolean;
}

export interface AnalyticsData {
  metrics: AnalyticsMetric[];
  projectProgressData: AnalyticsProjectProgress[];
  taskStatusData: AnalyticsTaskStatus[];
  projectDetails: AnalyticsProjectDetail[];
}

function buildParams(
  dateRange: DateRangeParam,
  projectId?: string,
): URLSearchParams {
  const params = new URLSearchParams({ dateRange });
  if (projectId) params.append("projectId", projectId);
  return params;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  progress: number;
  tasksDone: number;
  tasksTotal: number;
  date: string;
}

// ============================================================================
// W3.1 — Types Advanced Analytics (miroir DTOs backend `analytics/advanced/*`)
// ============================================================================

export interface SnapshotPoint {
  date: string;
  progress: number;
}

export interface ProjectSeries {
  projectId: string;
  name: string;
  points: SnapshotPoint[];
}

export interface AdvancedSnapshotsResponse {
  perProject: ProjectSeries[];
  portfolioAverage: SnapshotPoint[];
}

export interface WorkloadCounts {
  TODO: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  BLOCKED: number;
}

export interface WorkloadUser {
  userId: string;
  name: string;
  counts: WorkloadCounts;
  total: number;
}

export type HealthStatus = "green" | "orange" | "red";

export interface ProjectMilestonesSummary {
  reached: number;
  overdue: number;
  upcoming: number;
}

export interface ProjectHealthRow {
  projectId: string;
  name: string;
  progressPct: number;
  milestones: ProjectMilestonesSummary;
  activeTasks: number;
  teamSize: number;
  health: HealthStatus;
}

export interface MilestoneByProject {
  projectId: string;
  name: string;
  reached: number;
  total: number;
}

export interface MilestonesCompletionResponse {
  onTime: number;
  total: number;
  ratio: number;
  completed: number;
  overdue: number;
  upcoming: number;
  byProject: MilestoneByProject[];
}

export interface PriorityBreakdown {
  CRITICAL: number;
  HIGH: number;
  NORMAL: number;
  LOW: number;
}

export interface StatusBreakdown {
  TODO: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  BLOCKED: number;
  DONE: number;
}

export interface TasksBreakdownResponse {
  byPriority: PriorityBreakdown;
  byStatus: StatusBreakdown;
}

export interface ActivityPoint {
  date: string;
  completed: number;
}

export interface RecentActivityResponse {
  completed: number;
  created: number;
  overdue: number;
  completionRatio: number;
  trend: ActivityPoint[];
}

export const analyticsService = {
  async getAnalytics(
    dateRange: DateRangeParam,
    projectId?: string,
  ): Promise<AnalyticsData> {
    const params = buildParams(dateRange, projectId);
    const response = await api.get<AnalyticsData>(
      `/analytics?${params.toString()}`,
    );
    return response.data;
  },

  async exportAnalytics(
    dateRange: DateRangeParam,
    projectId?: string,
  ): Promise<AnalyticsData & { generatedAt: string; dateRange: string }> {
    const params = buildParams(dateRange, projectId);
    const response = await api.get<
      AnalyticsData & { generatedAt: string; dateRange: string }
    >(`/analytics/export?${params.toString()}`);
    return response.data;
  },

  async getProjectSnapshots(
    projectId: string,
    from?: string,
    to?: string,
  ): Promise<ProjectSnapshot[]> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const response = await api.get<ProjectSnapshot[]>(
      `/projects/${projectId}/snapshots?${params.toString()}`,
    );
    return response.data;
  },

  // ========================================================================
  // Advanced Analytics — 6 endpoints `/analytics/advanced/*` (W2.2)
  // ========================================================================

  async getAdvancedSnapshots(params?: {
    projectIds?: string[];
    from?: string;
    to?: string;
  }): Promise<AdvancedSnapshotsResponse> {
    const qs = new URLSearchParams();
    if (params?.projectIds) {
      for (const id of params.projectIds) qs.append("projectIds", id);
    }
    if (params?.from) qs.append("from", params.from);
    if (params?.to) qs.append("to", params.to);
    const url = qs.toString()
      ? `/analytics/advanced/snapshots?${qs.toString()}`
      : `/analytics/advanced/snapshots`;
    const response = await api.get<AdvancedSnapshotsResponse>(url);
    return response.data;
  },

  async getAdvancedWorkload(limit = 15): Promise<WorkloadUser[]> {
    const response = await api.get<WorkloadUser[]>(
      `/analytics/advanced/workload?limit=${limit}`,
    );
    return response.data;
  },

  async getAdvancedProjectHealth(): Promise<ProjectHealthRow[]> {
    const response = await api.get<ProjectHealthRow[]>(
      `/analytics/advanced/project-health`,
    );
    return response.data;
  },

  async getAdvancedMilestonesCompletion(): Promise<MilestonesCompletionResponse> {
    const response = await api.get<MilestonesCompletionResponse>(
      `/analytics/advanced/milestones-completion`,
    );
    return response.data;
  },

  async getAdvancedTasksBreakdown(
    projectIds?: string[],
  ): Promise<TasksBreakdownResponse> {
    const qs = new URLSearchParams();
    if (projectIds) for (const id of projectIds) qs.append("projectIds", id);
    const url = qs.toString()
      ? `/analytics/advanced/tasks-breakdown?${qs.toString()}`
      : `/analytics/advanced/tasks-breakdown`;
    const response = await api.get<TasksBreakdownResponse>(url);
    return response.data;
  },

  async getAdvancedRecentActivity(days = 30): Promise<RecentActivityResponse> {
    const response = await api.get<RecentActivityResponse>(
      `/analytics/advanced/recent-activity?days=${days}`,
    );
    return response.data;
  },
};
