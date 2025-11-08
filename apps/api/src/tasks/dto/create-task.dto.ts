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
} from 'class-validator';
import { TaskStatus, Priority } from 'database';

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
    example: 'Développer le module d\'authentification avec JWT et guards',
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
    description: 'ID du projet auquel appartient la tâche',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'ID de l\'epic parent (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  epicId?: string;

  @ApiProperty({
    description: 'ID du milestone associé (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  milestoneId?: string;

  @ApiProperty({
    description: 'ID de l\'utilisateur assigné (optionnel)',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;

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
  dueDate?: string;

  @ApiProperty({
    description: 'Tags pour catégoriser la tâche',
    example: ['backend', 'auth'],
    required: false,
    type: [String],
  })
  @IsOptional()
  tags?: string[];
}
