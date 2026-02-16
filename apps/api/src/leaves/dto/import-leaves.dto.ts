import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HalfDay } from 'database';

export class ImportLeaveDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  userEmail: string;

  @ApiProperty({
    description: 'Nom du type de congé',
    example: 'Congé Payé',
  })
  @IsString()
  @IsNotEmpty()
  leaveTypeName: string;

  @ApiProperty({
    description: 'Date de début (YYYY-MM-DD)',
    example: '2026-03-01',
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin (YYYY-MM-DD)',
    example: '2026-03-05',
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({
    description: 'Demi-journée (MORNING ou AFTERNOON)',
    enum: HalfDay,
    required: false,
  })
  @IsEnum(HalfDay)
  @IsOptional()
  halfDay?: HalfDay;

  @ApiProperty({ description: 'Commentaire', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class ImportLeavesDto {
  @ApiProperty({
    description: 'Liste des congés à importer',
    type: [ImportLeaveDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLeaveDto)
  leaves: ImportLeaveDto[];
}

export class ImportLeavesResultDto {
  @ApiProperty({ description: 'Nombre de congés créés' })
  created: number;

  @ApiProperty({ description: 'Nombre de congés ignorés (doublons/chevauchements)' })
  skipped: number;

  @ApiProperty({ description: "Nombre d'erreurs" })
  errors: number;

  @ApiProperty({ description: 'Détail des erreurs' })
  errorDetails: string[];
}

// Types de statut pour la prévisualisation
export type LeavePreviewStatus = 'valid' | 'duplicate' | 'error' | 'warning';

export class LeavePreviewItemDto {
  @ApiProperty({ description: 'Index de la ligne dans le CSV' })
  lineNumber: number;

  @ApiProperty({ description: 'Données du congé' })
  leave: ImportLeaveDto;

  @ApiProperty({
    description: 'Statut de validation',
    enum: ['valid', 'duplicate', 'error', 'warning'],
  })
  status: LeavePreviewStatus;

  @ApiProperty({ description: 'Messages de validation' })
  messages: string[];

  @ApiProperty({ description: 'Utilisateur trouvé', required: false })
  resolvedUser?: { id: string; email: string; name: string };

  @ApiProperty({ description: 'Type de congé trouvé', required: false })
  resolvedLeaveType?: { id: string; name: string; code: string };
}

export class LeavesValidationPreviewDto {
  @ApiProperty({
    description: 'Éléments valides prêts à être importés',
    type: [LeavePreviewItemDto],
  })
  valid: LeavePreviewItemDto[];

  @ApiProperty({
    description: 'Éléments qui seront ignorés (doublons/chevauchements)',
    type: [LeavePreviewItemDto],
  })
  duplicates: LeavePreviewItemDto[];

  @ApiProperty({
    description: 'Éléments avec erreurs',
    type: [LeavePreviewItemDto],
  })
  errors: LeavePreviewItemDto[];

  @ApiProperty({
    description: 'Éléments avec avertissements (seront importés)',
    type: [LeavePreviewItemDto],
  })
  warnings: LeavePreviewItemDto[];

  @ApiProperty({ description: 'Résumé de la validation' })
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
