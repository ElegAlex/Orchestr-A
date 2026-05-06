import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArchivedFilter } from './archived-filter.dto';

export class QueryProjectsDto {
  @ApiPropertyOptional({
    description: "Filtre par clients (CSV d'UUIDs)",
    example: 'uuid1,uuid2',
  })
  @IsOptional()
  @IsString()
  clients?: string;

  @ApiPropertyOptional({
    description: 'Filter by archive state',
    enum: ArchivedFilter,
    default: ArchivedFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
}
