import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class HolidayRangeQueryDto {
  @ApiProperty({
    description: 'Date de début de la période',
    example: '2025-01-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin de la période',
    example: '2025-12-31',
  })
  @IsDateString()
  endDate: string;
}
