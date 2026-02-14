import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    description: "Titre de l'événement",
    example: 'Réunion de suivi projet',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: "Description de l'événement",
    example: "Revue de l'avancement du projet avec l'équipe",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Date de l'événement",
    example: '2025-11-10T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Horaire de début (format HH:MM)',
    example: '14:00',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime doit être au format HH:MM',
  })
  startTime?: string;

  @ApiProperty({
    description: 'Horaire de fin (format HH:MM)',
    example: '15:00',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime doit être au format HH:MM',
  })
  endTime?: string;

  @ApiProperty({
    description: 'Événement sur toute la journée',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @ApiProperty({
    description: 'ID du projet associé (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiProperty({
    description: 'Liste des IDs des participants',
    example: ['uuid-1', 'uuid-2'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  participantIds?: string[];
}
