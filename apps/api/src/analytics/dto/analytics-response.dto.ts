import { ApiProperty } from '@nestjs/swagger';

export class MetricDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  value: string | number;

  @ApiProperty({ required: false })
  change?: string;

  @ApiProperty({ enum: ['up', 'down', 'stable'], required: false })
  trend?: 'up' | 'down' | 'stable';

  @ApiProperty({ enum: ['primary', 'secondary', 'success', 'warning', 'error', 'info'] })
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

export class ProjectProgressDataDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  tasks: number;
}

export class TaskStatusDataDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  value: number;

  @ApiProperty()
  color: string;
}

export class ProjectDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  totalTasks: number;

  @ApiProperty()
  completedTasks: number;

  @ApiProperty({ required: false })
  projectManager?: string;

  @ApiProperty()
  loggedHours: number;

  @ApiProperty()
  budgetHours: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ required: false })
  dueDate?: Date;

  @ApiProperty()
  isOverdue: boolean;
}

export class AnalyticsResponseDto {
  @ApiProperty({ type: [MetricDto] })
  metrics: MetricDto[];

  @ApiProperty({ type: [ProjectProgressDataDto] })
  projectProgressData: ProjectProgressDataDto[];

  @ApiProperty({ type: [TaskStatusDataDto] })
  taskStatusData: TaskStatusDataDto[];

  @ApiProperty({ type: [ProjectDetailDto] })
  projectDetails: ProjectDetailDto[];
}
