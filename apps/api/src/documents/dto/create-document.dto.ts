import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: 'Nom du document', example: 'Spécifications_techniques.pdf' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Description du document', example: 'Document de spécifications techniques', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'URL du fichier', example: 'https://storage.cloud.com/file.pdf' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'Type MIME du fichier', example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'Taille en bytes', example: 2048576 })
  @IsNotEmpty()
  size: number;

  @ApiProperty({ description: 'ID du projet', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;
}
