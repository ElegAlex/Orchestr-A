import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryProjectsDto {
  @ApiPropertyOptional({
    description: "Filtre par clients (CSV d'UUIDs)",
    example: 'uuid1,uuid2',
  })
  @IsOptional()
  @IsString()
  clients?: string;
}
