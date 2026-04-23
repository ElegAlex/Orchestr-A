import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecentActivityQueryDto {
  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}

export interface ActivityPointDto {
  date: string;
  completed: number;
}

export interface RecentActivityResponseDto {
  completed: number;
  created: number;
  overdue: number;
  completionRatio: number;
  trend: ActivityPointDto[];
}
