export interface MilestoneByProjectDto {
  projectId: string;
  name: string;
  reached: number;
  total: number;
}

export type MilestoneDetailStatus = 'COMPLETED' | 'OVERDUE' | 'UPCOMING';

export interface MilestoneDetailDto {
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  projectName: string;
  dueDate: string; // ISO
  daysFromNow: number; // négatif = en retard
  status: MilestoneDetailStatus;
  reachedInProject: number;
  totalInProject: number;
}

export interface MilestonesCompletionResponseDto {
  onTime: number;
  total: number;
  ratio: number;
  completed: number;
  overdue: number;
  upcoming: number;
  byProject: MilestoneByProjectDto[];
  details: MilestoneDetailDto[];
}
