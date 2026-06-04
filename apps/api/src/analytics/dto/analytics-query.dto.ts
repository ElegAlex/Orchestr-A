import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ArchivedFilter } from '../../projects/dto/archived-filter.dto';

export enum DateRangeEnum {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export class AnalyticsQueryDto {
  @ApiProperty({
    enum: DateRangeEnum,
    default: DateRangeEnum.MONTH,
    required: false,
  })
  @IsEnum(DateRangeEnum)
  @IsOptional()
  dateRange?: DateRangeEnum = DateRangeEnum.MONTH;

  @ApiProperty({
    description: 'Filter by specific project ID (optional)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    enum: ArchivedFilter,
    default: ArchivedFilter.ACTIVE,
    description:
      'Include archived projects in analytics (default: active only)',
    required: false,
  })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
}
