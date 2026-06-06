import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Priority } from 'database';

export class CreateEpicDto {
  @ApiProperty({
    description: "Nom de l'epic",
    example: 'Module Authentification',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ID du projet', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Priorité',
    enum: Priority,
    default: Priority.NORMAL,
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;
}
