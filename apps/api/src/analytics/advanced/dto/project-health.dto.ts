import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

export class ProjectHealthQueryDto {
  @ApiProperty({
    required: false,
    enum: ArchivedFilter,
    default: ArchivedFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
}

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
