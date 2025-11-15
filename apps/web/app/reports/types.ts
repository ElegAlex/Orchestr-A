export interface Metric {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

export interface ProjectProgressData {
  name: string;
  progress: number;
  status: string;
  tasks: number;
}

export interface TaskStatusData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

export interface ProjectDetail {
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
  metrics: Metric[];
  projectProgressData: ProjectProgressData[];
  taskStatusData: TaskStatusData[];
  projectDetails: ProjectDetail[];
}

export type DateRange = 'week' | 'month' | 'quarter' | 'year';
