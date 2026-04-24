import {
  IsISO8601,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';

/**
 * DTO pour l'endpoint POST /predefined-tasks/recurring-rules/generate-balanced
 *
 * Cross-field : au moins l'un de `serviceId` OU `userIds` doit être fourni.
 * Cette contrainte est vérifiée dans le service (BadRequestException).
 */
export class GenerateBalancedDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  taskIds!: string[];

  @IsIn(['preview', 'apply'])
  mode!: 'preview' | 'apply';
}

/**
 * Type de retour de generateBalanced().
 */
export interface GenerateBalancedResult {
  mode: 'preview' | 'apply';
  proposedAssignments: Array<{
    taskId: string;
    userId: string;
    date: Date;
    period: string;
    weight: number;
  }>;
  workloadByAgent: Array<{ userId: string; weightedLoad: number }>;
  equityRatio: number;
  unassignedOccurrences: Array<{
    taskId: string;
    date: Date;
    period: string;
    reason: string;
  }>;
  assignmentsCreated: number;
}
