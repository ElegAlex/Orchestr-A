import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, MaxLength, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @ApiProperty({ description: 'Nom du milestone', example: 'Alpha Release' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ID du projet', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Date d\'échéance', example: '2025-12-31T00:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
