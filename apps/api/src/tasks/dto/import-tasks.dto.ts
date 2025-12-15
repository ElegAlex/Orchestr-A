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
import { TaskStatus, Priority } from 'database';

export class ImportTaskDto {
  @ApiProperty({ description: 'Titre de la tâche', example: 'Développer le module Auth' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Statut', enum: TaskStatus, required: false })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ description: 'Priorité', enum: Priority, required: false })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiProperty({ description: 'Email de l\'utilisateur assigné', required: false })
  @IsString()
  @IsOptional()
  assigneeEmail?: string;

  @ApiProperty({ description: 'Nom du jalon associé', required: false })
  @IsString()
  @IsOptional()
  milestoneName?: string;

  @ApiProperty({ description: 'Heures estimées', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedHours?: number;

  @ApiProperty({ description: 'Date de début (YYYY-MM-DD)', required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'Date de fin (YYYY-MM-DD)', required: false })
  @IsString()
  @IsOptional()
  endDate?: string;
}

export class ImportTasksDto {
  @ApiProperty({ description: 'Liste des tâches à importer', type: [ImportTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTaskDto)
  tasks: ImportTaskDto[];
}

export class ImportTasksResultDto {
  @ApiProperty({ description: 'Nombre de tâches créées' })
  created: number;

  @ApiProperty({ description: 'Nombre de tâches ignorées (doublon)' })
  skipped: number;

  @ApiProperty({ description: 'Nombre d\'erreurs' })
  errors: number;

  @ApiProperty({ description: 'Détail des erreurs' })
  errorDetails: string[];
}

// Types de statut pour la prévisualisation
export type TaskPreviewStatus = 'valid' | 'duplicate' | 'error' | 'warning';

export class TaskPreviewItemDto {
  @ApiProperty({ description: 'Index de la ligne dans le CSV' })
  lineNumber: number;

  @ApiProperty({ description: 'Données de la tâche' })
  task: ImportTaskDto;

  @ApiProperty({ description: 'Statut de validation', enum: ['valid', 'duplicate', 'error', 'warning'] })
  status: TaskPreviewStatus;

  @ApiProperty({ description: 'Messages de validation' })
  messages: string[];

  @ApiProperty({ description: 'Assignée trouvée', required: false })
  resolvedAssignee?: { id: string; email: string; name: string };

  @ApiProperty({ description: 'Jalon trouvé', required: false })
  resolvedMilestone?: { id: string; name: string };
}

export class TasksValidationPreviewDto {
  @ApiProperty({ description: 'Éléments valides prêts à être importés', type: [TaskPreviewItemDto] })
  valid: TaskPreviewItemDto[];

  @ApiProperty({ description: 'Éléments qui seront ignorés (doublons)', type: [TaskPreviewItemDto] })
  duplicates: TaskPreviewItemDto[];

  @ApiProperty({ description: 'Éléments avec erreurs', type: [TaskPreviewItemDto] })
  errors: TaskPreviewItemDto[];

  @ApiProperty({ description: 'Éléments avec avertissements (seront importés)', type: [TaskPreviewItemDto] })
  warnings: TaskPreviewItemDto[];

  @ApiProperty({ description: 'Résumé de la validation' })
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
