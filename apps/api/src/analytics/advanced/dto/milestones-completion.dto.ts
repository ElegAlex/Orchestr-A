import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

export class MilestonesCompletionQueryDto {
  @ApiProperty({
    required: false,
    enum: ArchivedFilter,
    default: ArchivedFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
}

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
  /** Milestones that were completed on time (alias for `completed`). */
  onTime: number;
  /** Total milestones in scope: completed + overdue + upcoming. */
  total: number;
  /**
   * Completion rate of actionable milestones: completed / (completed + overdue).
   * Upcoming milestones are excluded from this ratio.
   */
  ratio: number;
  completed: number;
  overdue: number;
  upcoming: number;
  byProject: MilestoneByProjectDto[];
  details: MilestoneDetailDto[];
}
