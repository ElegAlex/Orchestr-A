import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

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
