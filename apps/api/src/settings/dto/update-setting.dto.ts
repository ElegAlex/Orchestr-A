import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({
    description: 'La valeur du paramètre (JSON stringifié)',
    example: '"dd/MM/yyyy"',
  })
  @MaxLength(10000)
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: 'Description du paramètre',
    example: "Format de date utilisé dans l'application",
  })
  @MaxLength(500)
  @IsString()
  @IsOptional()
  description?: string;
}

export class BulkUpdateSettingsDto {
  @ApiProperty({
    description: 'Liste des paramètres à mettre à jour',
  })
  @IsObject()
  settings: Record<string, any>;
}
