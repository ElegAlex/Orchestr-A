import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreatePredefinedTaskDto {
  @ApiProperty({
    description: 'Nom de la tâche prédéfinie',
    example: 'Permanence accueil',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description de la tâche',
    example: 'Accueil du public au guichet',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Couleur hexadécimale',
    example: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    description: 'Icône de la tâche',
    example: '🏢',
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Durée par défaut de la tâche',
    enum: ['HALF_DAY', 'FULL_DAY', 'TIME_SLOT'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['HALF_DAY', 'FULL_DAY', 'TIME_SLOT'])
  defaultDuration: string;

  @ApiPropertyOptional({
    description: 'Heure de début du créneau (format HH:mm)',
    example: '09:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime doit être au format HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Heure de fin du créneau (format HH:mm)',
    example: '12:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime doit être au format HH:mm',
  })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Intervention extérieure',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isExternalIntervention?: boolean;
}
