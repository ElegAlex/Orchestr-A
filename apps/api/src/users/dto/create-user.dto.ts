import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsArray,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-policy';

/**
 * SEC-010 — avatarUrl is a stored-XSS / SSRF sink: rendered as `<img src>` and
 * `background-image` across the UI, so a caller-supplied `javascript:`/`data:`
 * scheme or an external tracking-pixel host must never reach the DB.
 *
 * Every avatar in the app is server-issued by the upload flow
 * (`users.service.uploadAvatar` → `/api/uploads/avatars/<id>.<ext>`); there is
 * no Gravatar/OAuth/external-avatar path, and a stored-value sweep (dev + prod +
 * seed) found only this shape. So we lock to that relative prefix alone — the
 * strongest fix: it admits no external host at all, kills the tracking-pixel/
 * SSRF vector outright, and (by forbidding `/` after the prefix) also denies the
 * `../` traversal that feeds SEC-015's avatar-delete path.
 *
 * The single literal `.` plus dot-free name segment makes a `..` filename
 * impossible. The server's own values match this matcher, so a round-trip PATCH
 * of a legit avatarUrl is never rejected.
 */
export const AVATAR_URL_PATTERN =
  /^\/api\/uploads\/avatars\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

export class CreateUserDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'marie.martin@orchestr-a.internal',
  })
  // DAT-015: RFC 5321 maximum email length
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Login (format: prenom.nom)',
    example: 'marie.martin',
  })
  @IsString()
  @MinLength(3)
  login: string;

  @ApiProperty({
    description:
      'Mot de passe (minimum 8 caractères, avec majuscule, chiffre et caractère spécial)',
    example: 'P@ssword1',
  })
  @IsStrongPassword()
  password: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Marie',
  })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Martin',
  })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({
    description: "Code du rôle de l'utilisateur (cf. table roles)",
    example: 'CONTRIBUTEUR',
    default: 'CONTRIBUTEUR',
  })
  @IsString()
  roleCode: string;

  @ApiProperty({
    description: 'ID du département',
    required: false,
  })
  @IsOptional()
  // SEC-025: departmentId is a FK → must be a v4 UUID; @IsString admitted
  // non-UUID strings that caused Prisma findUnique to throw a 500.
  @IsUUID('4')
  departmentId?: string;

  @ApiProperty({
    description: 'IDs des services',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  // SEC-025: each item is a FK → must be UUID v4; @IsString({ each: true })
  // admitted non-UUID items that caused Prisma to throw a 500.
  @IsUUID('4', { each: true })
  serviceIds?: string[];

  @ApiProperty({
    description:
      "URL de l'avatar — chemin relatif émis par le serveur uniquement (/api/uploads/avatars/...)",
    required: false,
  })
  @IsOptional()
  @IsString()
  // SEC-010: only the server-issued relative avatar path is accepted; blocks
  // javascript:/data:/file: schemes, external hosts, and ../ traversal.
  @MaxLength(256)
  @Matches(AVATAR_URL_PATTERN, {
    message:
      'avatarUrl must be a server-issued avatar path (/api/uploads/avatars/<file>)',
  })
  avatarUrl?: string;

  // SEC-011 — isActive is intentionally NOT a create field. Admins create active
  // users (Model A: no activate route/permission); the server forces isActive
  // server-side in users.service.create(). The global ValidationPipe runs with
  // forbidNonWhitelisted:true, so a caller-supplied isActive on create is
  // rejected (400) rather than silently honored. State changes happen only on
  // the UPDATE path (PATCH), where isActive stays settable — see UpdateUserDto,
  // which re-declares it explicitly so removing it here does not break the
  // PartialType(CreateUserDto) inheritance that the USER_DEACTIVATED /
  // USER_REACTIVATED audit flow depends on.
}
