import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'Nom du rôle',
    example: 'Rôle personnalisé',
    required: false,
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Description du rôle',
    example: 'Un rôle avec des permissions spécifiques',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
