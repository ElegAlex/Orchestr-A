import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

export class RecentActivityQueryDto {
  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;

  @ApiProperty({ required: false, enum: ArchivedFilter, default: ArchivedFilter.ACTIVE })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
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
