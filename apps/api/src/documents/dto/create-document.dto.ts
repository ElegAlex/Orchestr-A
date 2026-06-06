import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsUrl,
  IsIn,
  IsInt,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * SEC-009 — pragmatic allowlist for the client-supplied `mimeType`. There is no
 * canonical mime source in the app (no upload pipeline, no frontend allowlist),
 * so this set covers the office/image/text document types this project handles,
 * anchored on `application/pdf` (the DTO example + existing spec value).
 * `image/svg+xml` is deliberately excluded: SVG can carry inline script, so it
 * is never accepted as a stored document type.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Nom du document',
    example: 'Spécifications_techniques.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Description du document',
    example: 'Document de spécifications techniques',
    required: false,
  })
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'URL du fichier (schéma http/https uniquement)',
    example: 'https://storage.cloud.com/file.pdf',
  })
  // SEC-009: scheme-allowlist the URL to block stored XSS via javascript:/data:/
  // file: schemes rendered as <a href={doc.url}>. require_tld rejects scheme-less
  // and dotless-host forms; all existing/legit values are external https URLs.
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: true,
  })
  @MaxLength(2048)
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'Type MIME du fichier',
    example: 'application/pdf',
    enum: ALLOWED_DOCUMENT_MIME_TYPES,
  })
  // SEC-009: client-set mimeType must be one of the allowed document types.
  @IsIn(ALLOWED_DOCUMENT_MIME_TYPES)
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'Taille en bytes', example: 2048576 })
  // COR-011: byte count must be a non-negative integer; floats and negative
  // values are semantically invalid and would corrupt quota calculations.
  @IsInt()
  @Min(0)
  size: number;

  @ApiProperty({ description: 'ID du projet', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;
}
