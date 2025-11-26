import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ActivityType } from 'database';

export class CreateTimeEntryDto {
  @ApiProperty({
    description: 'Date de l\'entrée de temps',
    example: '2025-11-15T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Nombre d\'heures',
    example: 4.5,
    minimum: 0.25,
    maximum: 24,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0.25)
  @Max(24)
  hours: number;

  @ApiProperty({
    description: 'Type d\'activité',
    enum: ActivityType,
    example: ActivityType.DEVELOPMENT,
  })
  @IsEnum(ActivityType)
  @IsNotEmpty()
  activityType: ActivityType;

  @ApiProperty({
    description: 'ID de la tâche (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  taskId?: string;

  @ApiProperty({
    description: 'ID du projet (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    description: 'Description de l\'activité',
    example: 'Développement du module Auth',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
