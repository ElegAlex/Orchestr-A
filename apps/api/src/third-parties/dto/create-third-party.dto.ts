import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ThirdPartyType } from 'database';

export class CreateThirdPartyDto {
  @ApiProperty({ enum: ThirdPartyType })
  @IsEnum(ThirdPartyType)
  @IsNotEmpty()
  type!: ThirdPartyType;

  @ApiProperty({ example: 'Acme Consulting' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
