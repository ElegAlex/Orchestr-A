import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class UpsertLeaveBalanceDto {
  @ApiPropertyOptional({
    description:
      "ID de l'utilisateur (null = solde global par défaut pour tous)",
    example: 'uuid-user-123',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'ID du type de congé',
    example: 'uuid-leave-type-123',
  })
  @IsString()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({
    description: 'Année concernée',
    example: 2026,
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({
    description: 'Nombre total de jours attribués',
    example: 25,
  })
  @IsNumber()
  @Min(0)
  totalDays: number;
}
