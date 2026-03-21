import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class GenerateSchedulesDto {
  @ApiProperty({
    description: 'Date de début de la plage à matérialiser (ISO 8601)',
    example: '2026-04-01',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin de la plage à matérialiser (ISO 8601)',
    example: '2026-06-30',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
