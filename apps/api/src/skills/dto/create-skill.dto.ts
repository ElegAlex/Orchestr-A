import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SkillCategory } from 'database';

export class CreateSkillDto {
  @ApiProperty({
    description: 'Nom de la compétence',
    example: 'React',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Description de la compétence',
    example:
      'Bibliothèque JavaScript pour construire des interfaces utilisateur',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Catégorie de la compétence',
    enum: SkillCategory,
    example: SkillCategory.TECHNICAL,
  })
  @IsEnum(SkillCategory)
  @IsNotEmpty()
  category: SkillCategory;
}
