import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsArray,
  IsDateString,
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { DayPeriod } from 'database';

export class BulkAssignmentDto {
  @ApiProperty({
    description: 'ID de la tâche prédéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: 'IDs des utilisateurs à assigner (max 50)',
    type: [String],
    example: ['uuid-user-1', 'uuid-user-2'],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50) // PER-012: cap to avoid unbounded N×M DB round-trips
  @IsUUID('all', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Dates des assignations ISO (max 90)',
    type: [String],
    example: ['2026-03-25T00:00:00Z', '2026-03-26T00:00:00Z'],
    maxItems: 90,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(90) // PER-012: cap to avoid unbounded N×M DB round-trips
  @IsDateString({}, { each: true })
  dates: string[];

  @ApiProperty({
    description: "Période de l'assignation",
    enum: DayPeriod,
    example: 'FULL_DAY',
  })
  @IsEnum(DayPeriod)
  period: DayPeriod;
}
