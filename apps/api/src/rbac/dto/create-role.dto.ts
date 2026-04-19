import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLE_TEMPLATE_KEYS, type RoleTemplateKey } from 'rbac';

export class CreateRoleDto {
  /**
   * Code unique du rôle, SCREAMING_SNAKE_CASE. Ex: "CUSTOM_LEAD_PROJECT".
   * Réservé : ne peut pas correspondre à un templateKey système (collision).
   */
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'code must be SCREAMING_SNAKE_CASE',
  })
  code!: string;

  /**
   * Libellé affiché dans l'UI (éditable).
   */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  /**
   * Template hardcodé qui détermine les permissions effectives.
   * Doit être l'un des 26 RoleTemplateKey.
   */
  @IsIn(ROLE_TEMPLATE_KEYS as readonly string[])
  templateKey!: RoleTemplateKey;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Marquer ce rôle comme défaut (premier rôle assigné aux nouveaux users).
   * Note : si plusieurs rôles sont marqués isDefault=true, le service
   * conserve uniquement le plus récent.
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
