import { IsISO8601, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlanningOverviewQueryDto {
  @ApiProperty({
    description: 'Date de début (ISO 8601)',
    example: '2026-04-13T00:00:00.000Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  startDate!: string;

  @ApiProperty({
    description: 'Date de fin (ISO 8601)',
    example: '2026-04-19T23:59:59.999Z',
  })
  @IsNotEmpty()
  @IsISO8601()
  endDate!: string;
}
