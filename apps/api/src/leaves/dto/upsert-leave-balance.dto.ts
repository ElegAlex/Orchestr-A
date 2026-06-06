import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class UpsertLeaveBalanceDto {
  @ApiPropertyOptional({
    description:
      "ID de l'utilisateur (null = solde global par défaut pour tous)",
    example: 'uuid-user-123',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'ID du type de congé',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
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
