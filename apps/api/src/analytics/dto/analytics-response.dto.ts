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

  @ApiProperty({
    enum: ['primary', 'secondary', 'success', 'warning', 'error', 'info'],
  })
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

  @ApiProperty({ required: false })
  endDate?: string;
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

  @ApiProperty({ description: 'Hours logged by users only (segregated)' })
  loggedHours: number;

  @ApiProperty({
    description: 'Hours logged by third parties only (segregated)',
  })
  thirdPartyLoggedHours: number;

  @ApiProperty()
  budgetHours: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty({ required: false })
  dueDate?: Date;

  @ApiProperty()
  isOverdue: boolean;

  @ApiProperty({ required: false })
  priority?: string;

  @ApiProperty({ required: false })
  managerId?: string;

  @ApiProperty({ required: false })
  managerDepartment?: string;
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

export class WorkloadUserDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  planned: number;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  utilization: number;
}

export class VelocityPeriodDto {
  @ApiProperty()
  period: string;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  planned: number;
}

export class BurndownPointDto {
  @ApiProperty()
  day: string;

  @ApiProperty()
  ideal: number;

  @ApiProperty()
  actual: number;
}
