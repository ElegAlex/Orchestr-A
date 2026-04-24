import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, MinLength, ValidateIf } from 'class-validator';

export const COMPLETION_STATUSES = [
  'NOT_DONE',
  'IN_PROGRESS',
  'DONE',
  'NOT_APPLICABLE',
] as const;

export class UpdateCompletionStatusDto {
  @ApiProperty({
    enum: COMPLETION_STATUSES,
    description: 'Nouveau statut de complétion',
  })
  @IsIn(COMPLETION_STATUSES)
  status!: string;

  @ApiPropertyOptional({
    description:
      'Raison requise si status = NOT_APPLICABLE (min 3 caractères)',
  })
  @ValidateIf((o: UpdateCompletionStatusDto) => o.status === 'NOT_APPLICABLE')
  @IsString()
  @MinLength(3)
  reason?: string;
}
