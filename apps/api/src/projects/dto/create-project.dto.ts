import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProjectStatus, Priority } from 'database';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Nom du projet',
    example: 'Refonte Application RH',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description détaillée du projet',
    example:
      "Refonte complète de l'application de gestion RH avec migration vers une architecture moderne",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Statut du projet',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiProperty({
    description: 'Priorité du projet',
    enum: Priority,
    default: Priority.NORMAL,
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiProperty({
    description: 'Date de début prévue',
    example: '2025-11-10T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin prévue',
    example: '2026-03-01T00:00:00Z',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Budget en heures',
    example: 1000,
    required: false,
  })
  @IsOptional()
  budgetHours?: number;
}
