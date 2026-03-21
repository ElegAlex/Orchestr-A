import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateRecurringRuleDto {
  @ApiProperty({
    description: 'ID de la tâche prédéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: "ID de l'utilisateur concerné",
    example: 'uuid-user',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Jour de la semaine (0=Lundi, ..., 6=Dimanche)',
    example: 0,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Période',
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period: string;

  @ApiProperty({
    description: 'Date de début de la règle (ISO)',
    example: '2026-01-06T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la règle (ISO)',
    example: '2026-12-31T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class UpdateRecurringRuleDto {
  @ApiPropertyOptional({
    description: 'Jour de la semaine (0=Lundi, ..., 6=Dimanche)',
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Période',
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period?: string;

  @ApiPropertyOptional({
    description: 'Date de début de la règle (ISO)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la règle (ISO)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Statut actif/inactif',
  })
  @IsOptional()
  isActive?: boolean;
}

export class GenerateFromRulesDto {
  @ApiProperty({
    description: 'Date de début de la plage (ISO)',
    example: '2026-04-01T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin de la plage (ISO)',
    example: '2026-04-30T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
