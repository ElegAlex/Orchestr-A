import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { HolidayType } from 'database';

export class CreateHolidayDto {
  @ApiProperty({
    description: 'Date du jour férié',
    example: '2025-01-01',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Nom du jour férié',
    example: "Jour de l'An",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Type de jour férié',
    enum: HolidayType,
    default: HolidayType.LEGAL,
  })
  @IsEnum(HolidayType)
  @IsOptional()
  type?: HolidayType = HolidayType.LEGAL;

  @ApiProperty({
    description: 'Indique si ce jour est ouvré malgré son statut de jour férié',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isWorkDay?: boolean = false;

  @ApiProperty({
    description: 'Description ou notes additionnelles',
    example: 'Premier jour de l\'année',
    required: false,
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Indique si ce jour férié se répète chaque année',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  recurring?: boolean = false;
}
