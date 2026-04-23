import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Communauté de communes du Val', maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ description: 'Archive (false) or restore (true) the client' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
