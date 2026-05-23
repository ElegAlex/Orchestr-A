import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({
    description: 'Nom affiché',
    example: 'Formation professionnelle',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description',
    example: 'Congé pour formation professionnelle',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Couleur hexadécimale',
    example: '#10B981',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'La couleur doit être au format hexadécimal (#RRGGBB)',
  })
  color?: string;

  @ApiPropertyOptional({ description: 'Icône/Emoji', example: '📚' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiPropertyOptional({ description: 'Congé rémunéré', example: true })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional({ description: 'Nécessite validation', example: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ description: 'Type actif', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "Ordre d'affichage", example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
