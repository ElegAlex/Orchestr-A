import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SkillCategory } from 'database';

export class ImportSkillDto {
  @ApiProperty({
    description: 'Nom de la compétence',
    example: 'React',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Catégorie de la compétence',
    enum: SkillCategory,
  })
  @IsEnum(SkillCategory)
  category: SkillCategory;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Nombre de ressources requises',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  requiredCount?: number;
}

export class ImportSkillsDto {
  @ApiProperty({
    description: 'Liste des compétences à importer',
    type: [ImportSkillDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSkillDto)
  skills: ImportSkillDto[];
}

export class ImportSkillsResultDto {
  @ApiProperty({ description: 'Nombre de compétences créées' })
  created: number;

  @ApiProperty({ description: 'Nombre de compétences ignorées (doublon)' })
  skipped: number;

  @ApiProperty({ description: "Nombre d'erreurs" })
  errors: number;

  @ApiProperty({ description: 'Détail des erreurs' })
  errorDetails: string[];
}

// Types de statut pour la prévisualisation
export type SkillPreviewStatus = 'valid' | 'duplicate' | 'error' | 'warning';

export class SkillPreviewItemDto {
  @ApiProperty({ description: 'Index de la ligne dans le CSV' })
  lineNumber: number;

  @ApiProperty({ description: 'Données de la compétence' })
  skill: ImportSkillDto;

  @ApiProperty({
    description: 'Statut de validation',
    enum: ['valid', 'duplicate', 'error', 'warning'],
  })
  status: SkillPreviewStatus;

  @ApiProperty({ description: 'Messages de validation' })
  messages: string[];
}

export class SkillsValidationPreviewDto {
  @ApiProperty({
    description: 'Éléments valides prêts à être importés',
    type: [SkillPreviewItemDto],
  })
  valid: SkillPreviewItemDto[];

  @ApiProperty({
    description: 'Éléments qui seront ignorés (doublons)',
    type: [SkillPreviewItemDto],
  })
  duplicates: SkillPreviewItemDto[];

  @ApiProperty({
    description: 'Éléments avec erreurs',
    type: [SkillPreviewItemDto],
  })
  errors: SkillPreviewItemDto[];

  @ApiProperty({
    description: 'Éléments avec avertissements (seront importés)',
    type: [SkillPreviewItemDto],
  })
  warnings: SkillPreviewItemDto[];

  @ApiProperty({ description: 'Résumé de la validation' })
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
