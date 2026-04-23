import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class TasksBreakdownQueryDto {
  @ApiProperty({
    description: 'Filter by project IDs (omit for all ACTIVE projects)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Type(() => String)
  projectIds?: string[];
}

export interface PriorityBreakdownDto {
  CRITICAL: number;
  HIGH: number;
  NORMAL: number;
  LOW: number;
}

export interface StatusBreakdownDto {
  TODO: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  BLOCKED: number;
  DONE: number;
}

export interface TasksBreakdownResponseDto {
  byPriority: PriorityBreakdownDto;
  byStatus: StatusBreakdownDto;
}
