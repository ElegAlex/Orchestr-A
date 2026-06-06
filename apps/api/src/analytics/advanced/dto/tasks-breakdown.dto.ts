import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

export class TasksBreakdownQueryDto {
  @ApiProperty({
    description: 'Filter by project IDs (omit for all ACTIVE projects)',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  @Type(() => String)
  projectIds?: string[];

  @ApiProperty({
    required: false,
    enum: ArchivedFilter,
    default: ArchivedFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
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
