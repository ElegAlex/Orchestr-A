import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportMilestoneDto {
  @ApiProperty({ description: 'Nom du jalon', example: 'Alpha Release' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Date d\'échéance (YYYY-MM-DD)', example: '2025-12-31' })
  @IsString()
  @IsNotEmpty()
  dueDate: string;
}

export class ImportMilestonesDto {
  @ApiProperty({ description: 'Liste des jalons à importer', type: [ImportMilestoneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMilestoneDto)
  milestones: ImportMilestoneDto[];
}

export class ImportMilestonesResultDto {
  @ApiProperty({ description: 'Nombre de jalons créés' })
  created: number;

  @ApiProperty({ description: 'Nombre de jalons ignorés (doublon)' })
  skipped: number;

  @ApiProperty({ description: 'Nombre d\'erreurs' })
  errors: number;

  @ApiProperty({ description: 'Détail des erreurs' })
  errorDetails: string[];
}

// Types de statut pour la prévisualisation
export type MilestonePreviewStatus = 'valid' | 'duplicate' | 'error' | 'warning';

export class MilestonePreviewItemDto {
  @ApiProperty({ description: 'Index de la ligne dans le CSV' })
  lineNumber: number;

  @ApiProperty({ description: 'Données du jalon' })
  milestone: ImportMilestoneDto;

  @ApiProperty({ description: 'Statut de validation', enum: ['valid', 'duplicate', 'error', 'warning'] })
  status: MilestonePreviewStatus;

  @ApiProperty({ description: 'Messages de validation' })
  messages: string[];
}

export class MilestonesValidationPreviewDto {
  @ApiProperty({ description: 'Éléments valides prêts à être importés', type: [MilestonePreviewItemDto] })
  valid: MilestonePreviewItemDto[];

  @ApiProperty({ description: 'Éléments qui seront ignorés (doublons)', type: [MilestonePreviewItemDto] })
  duplicates: MilestonePreviewItemDto[];

  @ApiProperty({ description: 'Éléments avec erreurs', type: [MilestonePreviewItemDto] })
  errors: MilestonePreviewItemDto[];

  @ApiProperty({ description: 'Éléments avec avertissements (seront importés)', type: [MilestonePreviewItemDto] })
  warnings: MilestonePreviewItemDto[];

  @ApiProperty({ description: 'Résumé de la validation' })
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
