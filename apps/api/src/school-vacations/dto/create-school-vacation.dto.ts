import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsInt,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { SchoolVacationZone, SchoolVacationSource } from 'database';

export class CreateSchoolVacationDto {
  @ApiProperty({
    description: 'Nom des vacances scolaires',
    example: 'Vacances de Noël',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Date de début des vacances',
    example: '2025-12-20',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Date de fin des vacances',
    example: '2026-01-05',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Zone scolaire',
    enum: SchoolVacationZone,
    required: false,
  })
  @IsEnum(SchoolVacationZone)
  @IsOptional()
  zone?: SchoolVacationZone;

  @ApiProperty({
    description: "Année scolaire de début",
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiProperty({
    description: 'Source des données',
    enum: SchoolVacationSource,
    default: SchoolVacationSource.MANUAL,
    required: false,
  })
  @IsEnum(SchoolVacationSource)
  @IsOptional()
  source?: SchoolVacationSource = SchoolVacationSource.MANUAL;
}
