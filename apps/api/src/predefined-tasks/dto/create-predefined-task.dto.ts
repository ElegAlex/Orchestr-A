import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PredefinedTaskDuration } from 'database';

export class CreatePredefinedTaskDto {
  @ApiProperty({
    description: 'Nom de la tâche prédéfinie',
    example: 'Permanence accueil',
  })
  @MaxLength(200)
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description de la tâche',
    example: 'Accueil du public au guichet',
  })
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Couleur hexadécimale',
    example: '#3B82F6',
  })
  @MaxLength(20)
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    description: 'Icône de la tâche',
    example: '🏢',
  })
  @MaxLength(10)
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Durée par défaut de la tâche',
    enum: PredefinedTaskDuration,
    example: 'FULL_DAY',
  })
  @IsEnum(PredefinedTaskDuration)
  defaultDuration: PredefinedTaskDuration;

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

  @ApiPropertyOptional({
    description: 'Tâche réalisable en télétravail',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isTeleworkAllowed?: boolean;

  @ApiPropertyOptional({
    description: 'Pondération de la tâche (1 = légère, 5 = très lourde)',
    example: 1,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  weight?: number;
}
