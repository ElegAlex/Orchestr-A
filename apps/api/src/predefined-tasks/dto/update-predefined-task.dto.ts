import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class UpdatePredefinedTaskDto {
  @ApiPropertyOptional({
    description: 'Nom de la tâche prédéfinie',
    example: 'Permanence accueil',
  })
  @IsString()
  @IsOptional()
  name?: string;

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

  @ApiPropertyOptional({
    description: 'Durée par défaut de la tâche',
    enum: ['HALF_DAY', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsOptional()
  @IsIn(['HALF_DAY', 'FULL_DAY'])
  defaultDuration?: string;

  @ApiPropertyOptional({
    description: 'Statut actif/inactif',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
