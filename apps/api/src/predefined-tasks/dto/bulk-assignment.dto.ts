import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  IsDateString,
  IsIn,
  ArrayMinSize,
} from 'class-validator';

export class BulkAssignmentDto {
  @ApiProperty({
    description: 'ID de la tâche prédéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: 'IDs des utilisateurs à assigner',
    type: [String],
    example: ['uuid-user-1', 'uuid-user-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Dates des assignations (ISO)',
    type: [String],
    example: ['2026-03-25T00:00:00Z', '2026-03-26T00:00:00Z'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  dates: string[];

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
