import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsIn,
} from 'class-validator';

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
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period: string;
}
