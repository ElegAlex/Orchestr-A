import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  Matches,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Role } from 'database';

export class CreateUserDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'marie.martin@orchestr-a.internal',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Login (format: prenom.nom)',
    example: 'marie.martin',
  })
  @IsString()
  @MinLength(3)
  login: string;

  @ApiProperty({
    description:
      'Mot de passe (minimum 8 caractères, avec majuscule, chiffre et caractère spécial)',
    example: 'P@ssword1',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial',
  })
  password: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Marie',
  })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Martin',
  })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({
    description: "Rôle de l'utilisateur",
    enum: Role,
    example: Role.CONTRIBUTEUR,
    default: Role.CONTRIBUTEUR,
  })
  @IsEnum(Role)
  role: Role;

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
  @IsString({ each: true })
  serviceIds?: string[];

  @ApiProperty({
    description: "URL de l'avatar",
    required: false,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({
    description: 'Compte actif',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
