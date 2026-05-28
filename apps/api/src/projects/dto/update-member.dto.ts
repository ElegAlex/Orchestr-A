import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Length,
  IsDateString,
} from 'class-validator';

export class UpdateMemberDto {
  @ApiProperty({
    description: 'Rôle du membre dans le projet',
    example: 'Développeur Frontend',
    required: false,
    minLength: 1,
    maxLength: 100,
  })
  // DAT-035 — same trim + length contract as AddMemberDto; see that file for
  // the layer-of-rejection rationale.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  @IsOptional()
  role?: string;

  @ApiProperty({
    description: "Pourcentage d'allocation (0-100)",
    example: 80,
    required: false,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  allocation?: number;

  @ApiProperty({
    description: 'Date de début dans le projet',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Date de fin dans le projet',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
