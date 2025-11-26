import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty({ description: 'Code technique unique (ex: CP, RTT)', example: 'FORMATION' })
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z_]+$/, { message: 'Le code doit être en majuscules avec underscores uniquement' })
  code: string;

  @ApiProperty({ description: 'Nom affiché', example: 'Formation' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Congé pour formation professionnelle' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Couleur hexadécimale', example: '#10B981', default: '#10B981' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'La couleur doit être au format hexadécimal (#RRGGBB)' })
  color?: string;

  @ApiPropertyOptional({ description: 'Icône/Emoji', example: '📚', default: '🌴' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiPropertyOptional({ description: 'Congé rémunéré', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional({ description: 'Nécessite validation', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ description: 'Limite annuelle (jours)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDaysPerYear?: number;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage', example: 6, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
