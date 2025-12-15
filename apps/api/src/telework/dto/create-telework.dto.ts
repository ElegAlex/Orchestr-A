import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsString,
} from 'class-validator';

export class CreateTeleworkDto {
  @ApiProperty({
    description: 'Date du télétravail',
    example: '2025-11-15',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'ID de l\'utilisateur (optionnel, pour admin/manager)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Est en télétravail ce jour',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isTelework?: boolean;

  @ApiProperty({
    description: 'Est une exception au planning récurrent',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isException?: boolean;
}
