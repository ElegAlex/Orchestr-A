import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  IsArray,
  Matches,
} from 'class-validator';
import { TaskStatus, Priority } from 'database';

// COR-035: cross-field guard implementing the layer-of-rejection partner to
// DAT-017's DB CHECK `tasks_parent_requires_project_ck`. When `epicId` or
// `milestoneId` is set, `projectId` is required — the audit's orphan combination
// must return 400 at the DTO instead of leaking the DB 23514 as a 500.
// Applied only to CreateTaskDto; UpdateTaskDto overrides projectId without it
// because partial updates that only touch one field must not 400 on an
// already-consistent DB row (the DB CHECK + DAT-037 cover the update path).
@ValidatorConstraint({ name: 'projectRequiredWhenParented', async: false })
export class ProjectRequiredWhenParentedConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as {
      projectId?: string | null;
      epicId?: string;
      milestoneId?: string;
    };
    const hasParent = Boolean(dto.epicId || dto.milestoneId);
    if (!hasParent) return true;
    return (
      dto.projectId !== null &&
      dto.projectId !== undefined &&
      dto.projectId !== ''
    );
  }
  defaultMessage(): string {
    return 'projectId is required when epicId or milestoneId is set (orphan task combination is forbidden — DAT-017)';
  }
}

export class CreateTaskDto {
  @ApiProperty({
    description: 'Titre de la tâche',
    example: 'Développer le module Auth',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Description détaillée de la tâche',
    example: "Développer le module d'authentification avec JWT et guards",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Statut de la tâche',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({
    description: 'Priorité de la tâche',
    enum: Priority,
    default: Priority.NORMAL,
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiProperty({
    description:
      'ID du projet auquel appartient la tâche (optionnel pour les tâches orphelines)',
    example: 'uuid-here',
    required: false,
    nullable: true,
  })
  @ValidateIf(
    (o: CreateTaskDto) =>
      o.projectId !== null && o.projectId !== undefined && o.projectId !== '',
  )
  @IsUUID()
  @IsOptional()
  projectId?: string | null;

  @ApiProperty({
    description: "ID de l'epic parent (optionnel)",
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  // COR-035: when epicId (or milestoneId) is set, projectId must be present.
  // Attaching the cross-field check here (not on projectId) avoids the
  // @ValidateIf short-circuit that would skip the check exactly when
  // projectId is the missing one (the failure mode the audit cites).
  @Validate(ProjectRequiredWhenParentedConstraint)
  epicId?: string;

  @ApiProperty({
    description: 'ID du milestone associé (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  @Validate(ProjectRequiredWhenParentedConstraint)
  milestoneId?: string;

  @ApiProperty({
    description:
      "ID de l'utilisateur assigné principal (optionnel, rétrocompatibilité)",
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({
    description: 'Liste des IDs des utilisateurs assignés (optionnel)',
    example: ['uuid-1', 'uuid-2'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  assigneeIds?: string[];

  @ApiProperty({
    description: 'Charge estimée en heures',
    example: 8,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedHours?: number;

  @ApiProperty({
    description: 'Date de début prévue',
    example: '2025-11-10T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Date de fin prévue',
    example: '2025-11-15T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Horaire de début (format HH:MM)',
    example: '09:00',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime doit être au format HH:MM',
  })
  startTime?: string;

  @ApiProperty({
    description: 'Horaire de fin (format HH:MM)',
    example: '17:00',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime doit être au format HH:MM',
  })
  endTime?: string;

  @ApiProperty({
    description:
      'Liste des IDs des services à inviter (tous les membres seront ajoutés)',
    example: ['uuid-service-1'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  serviceIds?: string[];

  @ApiProperty({
    description: 'Tags pour catégoriser la tâche',
    example: ['backend', 'auth'],
    required: false,
    type: [String],
  })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Intervention externe',
    required: false,
    default: false,
  })
  @IsOptional()
  isExternalIntervention?: boolean;
}
