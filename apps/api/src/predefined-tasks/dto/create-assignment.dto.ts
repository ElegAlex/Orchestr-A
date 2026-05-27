import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { DayPeriod } from 'database';

export class CreateAssignmentDto {
  @ApiProperty({
    description: 'ID de la tâche prédéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: "ID de l'utilisateur assigné",
    example: 'uuid-user',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: "Date de l'assignation (ISO)",
    example: '2026-03-25T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: "Période de l'assignation",
    enum: DayPeriod,
    example: 'FULL_DAY',
  })
  @IsEnum(DayPeriod)
  period: DayPeriod;
}
