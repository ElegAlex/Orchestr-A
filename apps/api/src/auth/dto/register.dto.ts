import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';
import { Role } from 'database';

export class RegisterDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'jean.dupont@orchestr-a.internal',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Login (format: prenom.nom)',
    example: 'jean.dupont',
  })
  @IsString()
  @MinLength(3)
  login: string;

  @ApiProperty({
    description: 'Mot de passe (minimum 6 caractères)',
    example: 'password123',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Jean',
  })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Dupont',
  })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({
    description: "Rôle de l'utilisateur",
    enum: Role,
    example: Role.CONTRIBUTEUR,
    required: false,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({
    description: 'ID du département',
    required: false,
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({
    description: 'IDs des services',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds?: string[];
}
