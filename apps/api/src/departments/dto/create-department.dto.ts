import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Nom du département',
    example: 'Ressources Humaines',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description du département',
    example: 'Département en charge de la gestion des ressources humaines',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ID du responsable du département',
    example: 'uuid-here',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  managerId?: string;
}
