import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

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
    enum: ['HALF_DAY', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['HALF_DAY', 'FULL_DAY'])
  defaultDuration: string;
}
