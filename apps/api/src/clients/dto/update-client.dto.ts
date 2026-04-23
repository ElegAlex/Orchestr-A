import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Communauté de communes du Val', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Archive (false) or restore (true) the client' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
