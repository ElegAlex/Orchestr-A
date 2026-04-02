import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class CreateSubtaskDto {
  @ApiProperty({ description: 'Titre de la sous-tâche', example: 'Vérifier les prérequis' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @ApiProperty({ description: 'Description optionnelle', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Cochée ou non', default: false })
  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  @ApiProperty({ description: 'Position dans la liste', default: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;
}
