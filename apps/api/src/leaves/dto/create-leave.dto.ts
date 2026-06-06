import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LeaveType, HalfDay } from 'database';

export class CreateLeaveDto {
  @ApiProperty({
    description: 'ID du type de congé',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID('4')
  leaveTypeId: string;

  @ApiPropertyOptional({
    description: 'Type de congé (déprécié, utiliser leaveTypeId)',
    enum: LeaveType,
    example: LeaveType.CP,
  })
  @IsEnum(LeaveType)
  @IsOptional()
  type?: LeaveType;

  @ApiProperty({
    description: 'Date de début du congé',
    example: '2025-11-15T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin du congé',
    example: '2025-11-20T00:00:00Z',
  })
  @IsDateString()
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

  @ApiProperty({
    description:
      'Demi-journée de début (MORNING ou AFTERNOON) - déprécié, utiliser halfDay',
    enum: HalfDay,
    required: false,
  })
  @IsEnum(HalfDay)
  @IsOptional()
  startHalfDay?: HalfDay;

  @ApiProperty({
    description:
      'Demi-journée de fin (MORNING ou AFTERNOON) - déprécié, utiliser halfDay',
    enum: HalfDay,
    required: false,
  })
  @IsEnum(HalfDay)
  @IsOptional()
  endHalfDay?: HalfDay;

  @ApiProperty({
    description: 'Raison du congé',
    example: "Vacances d'été",
    required: false,
  })
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description:
      "ID de l'utilisateur cible (pour déclarer un congé au nom d'un collaborateur, nécessite leaves:declare_for_others)",
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  @IsOptional()
  targetUserId?: string;
}
