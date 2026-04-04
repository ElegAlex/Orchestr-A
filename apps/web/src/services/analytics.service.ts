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
};
