import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveLeaveDto {
  @ApiPropertyOptional({
    description: 'Commentaire optionnel (max 2000 caractères)',
    maxLength: 2000,
    example: 'Approuvé pour la semaine demandée.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
