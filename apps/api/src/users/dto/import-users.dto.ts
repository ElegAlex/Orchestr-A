import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from 'database';

export class ImportUserDto {
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
    description: 'Mot de passe (minimum 6 caractères)',
    example: 'password123',
  })
  @IsString()
  @MinLength(6)
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
    description: 'Nom du département (sera résolu en ID)',
    required: false,
  })
  @IsOptional()
  @IsString()
  departmentName?: string;

  @ApiProperty({
    description: 'Noms des services séparés par virgules',
    required: false,
  })
  @IsOptional()
  @IsString()
  serviceNames?: string;
}

export class ImportUsersDto {
  @ApiProperty({
    description: 'Liste des utilisateurs à importer',
    type: [ImportUserDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUserDto)
  users: ImportUserDto[];
}

export class ImportUsersResultDto {
  @ApiProperty({
    description: "Nombre d'utilisateurs créés avec succès",
  })
  created: number;

  @ApiProperty({
    description: "Nombre d'utilisateurs ignorés (existants)",
  })
  skipped: number;

  @ApiProperty({
    description: "Nombre d'erreurs",
  })
  errors: number;

  @ApiProperty({
    description: 'Détails des erreurs',
    type: [String],
  })
  errorDetails: string[];

  @ApiProperty({
    description: 'Utilisateurs créés',
  })
  createdUsers: any[];
}

// Types de statut pour la prévisualisation
export type UserPreviewStatus = 'valid' | 'duplicate' | 'error' | 'warning';

export class UserPreviewItemDto {
  @ApiProperty({ description: 'Index de la ligne dans le CSV' })
  lineNumber: number;

  @ApiProperty({ description: "Données de l'utilisateur" })
  user: ImportUserDto;

  @ApiProperty({
    description: 'Statut de validation',
    enum: ['valid', 'duplicate', 'error', 'warning'],
  })
  status: UserPreviewStatus;

  @ApiProperty({ description: 'Messages de validation' })
  messages: string[];

  @ApiProperty({ description: 'Département résolu', required: false })
  resolvedDepartment?: { id: string; name: string };

  @ApiProperty({ description: 'Services résolus', required: false })
  resolvedServices?: Array<{ id: string; name: string }>;
}

export class UsersValidationPreviewDto {
  @ApiProperty({
    description: 'Éléments valides prêts à être importés',
    type: [UserPreviewItemDto],
  })
  valid: UserPreviewItemDto[];

  @ApiProperty({
    description: 'Éléments qui seront ignorés (doublons)',
    type: [UserPreviewItemDto],
  })
  duplicates: UserPreviewItemDto[];

  @ApiProperty({
    description: 'Éléments avec erreurs',
    type: [UserPreviewItemDto],
  })
  errors: UserPreviewItemDto[];

  @ApiProperty({
    description: 'Éléments avec avertissements (seront importés)',
    type: [UserPreviewItemDto],
  })
  warnings: UserPreviewItemDto[];

  @ApiProperty({ description: 'Résumé de la validation' })
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
}
