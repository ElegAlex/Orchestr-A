import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
  IsOptional,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Cross-field validator ───────────────────────────────────────────────────

// Choix d'implémentation : on utilise registerDecorator plutôt que @Validate
// car @Validate est un décorateur de propriété et ne peut pas s'appliquer à une classe.
// registerDecorator permet un décorateur de classe custom clean, sans validation dans le service.

@ValidatorConstraint({ name: 'isValidRecurrenceConfig', async: false })
export class IsValidRecurrenceConfigConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateRecurringRuleDto;
    const type = dto.recurrenceType ?? 'WEEKLY';

    if (type === 'WEEKLY') {
      return dto.dayOfWeek !== undefined && dto.dayOfWeek !== null;
    }

    if (type === 'MONTHLY_DAY') {
      return (
        dto.monthlyDayOfMonth !== undefined &&
        dto.monthlyDayOfMonth !== null &&
        (dto.dayOfWeek === undefined || dto.dayOfWeek === null)
      );
    }

    if (type === 'MONTHLY_ORDINAL') {
      return (
        dto.monthlyOrdinal !== undefined &&
        dto.monthlyOrdinal !== null &&
        dto.dayOfWeek !== undefined &&
        dto.dayOfWeek !== null
      );
    }

    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateRecurringRuleDto;
    const type = dto.recurrenceType ?? 'WEEKLY';

    if (type === 'WEEKLY') {
      return 'WEEKLY : dayOfWeek (0-6) est requis';
    }
    if (type === 'MONTHLY_DAY') {
      return 'MONTHLY_DAY : monthlyDayOfMonth (1-31) est requis et dayOfWeek doit être absent';
    }
    if (type === 'MONTHLY_ORDINAL') {
      return 'MONTHLY_ORDINAL : monthlyOrdinal (1-5) et dayOfWeek (0-6) sont requis';
    }
    return 'Configuration de récurrence invalide';
  }
}

/**
 * Décorateur de classe qui valide la cohérence entre recurrenceType et les champs
 * dayOfWeek / monthlyOrdinal / monthlyDayOfMonth.
 */
export function IsValidRecurrenceConfig(
  validationOptions?: ValidationOptions,
): ClassDecorator {
  return function (target: Function) {
    registerDecorator({
      name: 'isValidRecurrenceConfig',
      target,
      propertyName: 'recurrenceType',
      options: validationOptions,
      constraints: [],
      validator: IsValidRecurrenceConfigConstraint,
    });
  };
}

// ─── DTO ────────────────────────────────────────────────────────────────────

@IsValidRecurrenceConfig()
export class CreateRecurringRuleDto {
  @ApiProperty({
    description: 'ID de la tâche prédéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: "ID de l'utilisateur concerné",
    example: 'uuid-user',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description:
      'Type de récurrence : WEEKLY (hebdo), MONTHLY_DAY (même jour chaque mois), MONTHLY_ORDINAL (N-ième jour de la semaine)',
    enum: ['WEEKLY', 'MONTHLY_ORDINAL', 'MONTHLY_DAY'],
    default: 'WEEKLY',
  })
  @IsOptional()
  @IsIn(['WEEKLY', 'MONTHLY_ORDINAL', 'MONTHLY_DAY'])
  recurrenceType: string = 'WEEKLY';

  @ApiPropertyOptional({
    description: 'Jour de la semaine (0=Lundi, ..., 6=Dimanche). Requis pour WEEKLY et MONTHLY_ORDINAL.',
    example: 0,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({
    description: 'Période',
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period: string;

  @ApiProperty({
    description: 'Date de début de la règle (ISO)',
    example: '2026-01-06T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la règle (ISO)',
    example: '2026-12-31T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Ordinal mensuel : N-ième occurrence du dayOfWeek dans le mois (1=1er, …, 5=dernier). Requis pour MONTHLY_ORDINAL.',
    example: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  monthlyOrdinal?: number;

  @ApiPropertyOptional({
    description:
      'Jour du mois (1..31). Requis pour MONTHLY_DAY. Clampé au dernier jour du mois si le mois est plus court.',
    example: 15,
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDayOfMonth?: number;

  @ApiPropertyOptional({
    description: 'Intervalle en semaines (1=hebdo, 2=bihebdo, etc.)',
    example: 1,
    minimum: 1,
    maximum: 52,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weekInterval?: number;
}

export class UpdateRecurringRuleDto {
  @ApiPropertyOptional({
    description: 'Type de récurrence',
    enum: ['WEEKLY', 'MONTHLY_ORDINAL', 'MONTHLY_DAY'],
  })
  @IsOptional()
  @IsIn(['WEEKLY', 'MONTHLY_ORDINAL', 'MONTHLY_DAY'])
  recurrenceType?: string;

  @ApiPropertyOptional({
    description: 'Jour de la semaine (0=Lundi, ..., 6=Dimanche)',
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Ordinal mensuel (1..5, 5=dernier). Pour MONTHLY_ORDINAL.',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  monthlyOrdinal?: number;

  @ApiPropertyOptional({
    description: 'Jour du mois (1..31). Pour MONTHLY_DAY.',
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDayOfMonth?: number;

  @ApiPropertyOptional({
    description: 'Période',
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period?: string;

  @ApiPropertyOptional({
    description: 'Date de début de la règle (ISO)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la règle (ISO)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Statut actif/inactif',
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Intervalle en semaines (1=hebdo, 2=bihebdo, etc.)',
    minimum: 1,
    maximum: 52,
  })
  @IsInt()
  @Min(1)
  @Max(52)
  @IsOptional()
  weekInterval?: number;
}

export class GenerateFromRulesDto {
  @ApiProperty({
    description: 'Date de début de la plage (ISO)',
    example: '2026-04-01T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin de la plage (ISO)',
    example: '2026-04-30T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
