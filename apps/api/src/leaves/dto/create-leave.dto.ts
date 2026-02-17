import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';
import { LeaveType, HalfDay } from 'database';

export class CreateLeaveDto {
  @ApiProperty({
    description: 'ID du type de congé',
    example: 'lt-cp-001',
  })
  @IsString()
  @IsNotEmpty()
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
  @IsString()
  @IsOptional()
  reason?: string;
}
