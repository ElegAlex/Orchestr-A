import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

export class SnapshotsQueryDto {
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

  @ApiProperty({ required: false, description: 'ISO date lower bound' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'ISO date upper bound' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, enum: ArchivedFilter, default: ArchivedFilter.ACTIVE })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
}

export interface SnapshotPoint {
  date: string;
  progress: number;
}

export interface ProjectSeriesDto {
  projectId: string;
  name: string;
  points: SnapshotPoint[];
}

export interface SnapshotsResponseDto {
  perProject: ProjectSeriesDto[];
  portfolioAverage: SnapshotPoint[];
}
