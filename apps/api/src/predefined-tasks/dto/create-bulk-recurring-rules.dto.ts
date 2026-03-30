import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsNotEmpty,
  IsIn,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateBulkRecurringRulesDto {
  @ApiProperty({
    description: 'ID de la tache predéfinie',
    example: 'uuid-predefined-task',
  })
  @IsUUID()
  @IsNotEmpty()
  predefinedTaskId: string;

  @ApiProperty({
    description: 'IDs des utilisateurs',
    example: ['uuid-user-1', 'uuid-user-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Jours de la semaine (0=Lundi, ..., 6=Dimanche)',
    example: [0, 2],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @ApiProperty({
    description: 'Période',
    enum: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
    example: 'FULL_DAY',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MORNING', 'AFTERNOON', 'FULL_DAY'])
  period: string;

  @ApiPropertyOptional({
    description: 'Intervalle en semaines (1=hebdo, 2=bihebdo)',
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

  @ApiProperty({
    description: 'Date de début (ISO)',
    example: '2026-01-06T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Date de fin (ISO)',
    example: '2026-12-31T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
