import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectLeaveDto {
  @ApiPropertyOptional({
    description: 'Motif du refus (max 2000 caractères)',
    maxLength: 2000,
    example: 'Effectifs insuffisants sur la période.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
