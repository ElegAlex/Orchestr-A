import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

export class WorkloadQueryDto {
  @ApiProperty({ required: false, default: 15, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 15;

  @ApiProperty({
    required: false,
    enum: ArchivedFilter,
    default: ArchivedFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
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
