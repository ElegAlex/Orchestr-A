export type HealthStatus = 'green' | 'orange' | 'red';

export interface ProjectMilestonesSummaryDto {
  reached: number;
  overdue: number;
  upcoming: number;
}

export interface ProjectHealthRowDto {
  projectId: string;
  name: string;
  progressPct: number;
  milestones: ProjectMilestonesSummaryDto;
  activeTasks: number;
  teamSize: number;
  health: HealthStatus;
}
