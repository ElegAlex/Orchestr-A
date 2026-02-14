import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Code unique du rôle (en MAJUSCULES)',
    example: 'CUSTOM_ROLE',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  code: string;

  @ApiProperty({
    description: 'Nom du rôle',
    example: 'Rôle personnalisé',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description du rôle',
    example: 'Un rôle avec des permissions spécifiques',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
