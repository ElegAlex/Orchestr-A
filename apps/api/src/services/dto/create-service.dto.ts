import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({
    description: 'Nom du service',
    example: 'Recrutement',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description du service',
    example: "Service en charge du recrutement et de l'intégration",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ID du département auquel appartient le service',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty({
    description: 'ID du manager du service',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  managerId?: string;

  @ApiProperty({
    description: 'Couleur du service au format hexadécimal',
    example: '#3B82F6',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'La couleur doit être au format hexadécimal (#RRGGBB)',
  })
  color?: string;
}
