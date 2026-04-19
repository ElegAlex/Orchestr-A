import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLE_TEMPLATE_KEYS, type RoleTemplateKey } from 'rbac';

/**
 * UpdateRoleDto — édition rôle custom uniquement (les rôles isSystem sont
 * verrouillés côté service, cf. D9 PO).
 *
 * Note : `code` n'est PAS modifiable (le code est l'identifiant stable).
 * Pour renommer : supprimer + recréer.
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsIn(ROLE_TEMPLATE_KEYS as readonly string[])
  templateKey?: RoleTemplateKey;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
