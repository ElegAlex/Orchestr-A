import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * UpdateRoleDto — édition rôle éditable uniquement (les rôles `isSystem=true`
 * sont verrouillés côté service, cf. D9 PO).
 *
 * Champs immuables après création :
 *   - `code` : identifiant technique stable (jamais renommable ; pour
 *     renommer : supprimer + recréer).
 *   - `templateKey` : un rôle créé sur un template y reste à vie. Les
 *     permissions effectives du rôle sont strictement celles du template
 *     initialement choisi, sans aucune personnalisation.
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
