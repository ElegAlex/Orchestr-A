import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: "ID de l'utilisateur à ajouter",
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Rôle du membre dans le projet',
    example: 'Développeur Frontend',
    required: false,
  })
  @IsString()
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
    example: '2025-01-01T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Date de fin dans le projet',
    example: '2025-12-31T00:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
