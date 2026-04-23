export interface MilestoneByProjectDto {
  projectId: string;
  name: string;
  reached: number;
  total: number;
}

export interface MilestonesCompletionResponseDto {
  onTime: number;
  total: number;
  ratio: number;
  completed: number;
  overdue: number;
  upcoming: number;
  byProject: MilestoneByProjectDto[];
}
