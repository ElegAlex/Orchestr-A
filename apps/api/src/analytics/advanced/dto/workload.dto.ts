import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class WorkloadQueryDto {
  @ApiProperty({ required: false, default: 15, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 15;
}

export interface WorkloadCountsDto {
  TODO: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  BLOCKED: number;
}

export interface WorkloadUserDto {
  userId: string;
  name: string;
  counts: WorkloadCountsDto;
  total: number;
}
