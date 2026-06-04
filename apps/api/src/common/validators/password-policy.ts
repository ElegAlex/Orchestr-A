import { applyDecorators, BadRequestException } from '@nestjs/common';
import { IsString, MinLength, Matches } from 'class-validator';

/**
 * SEC-007 — single source of truth for the password *creation* policy.
 *
 * Min 8 characters + at least one uppercase letter, one digit and one special
 * character. There is intentionally NO lowercase requirement — this mirrors the
 * original `RegisterDto` rule byte-for-byte so the shared validator does not
 * reject passwords that were valid before the consolidation.
 *
 * This policy applies to credential CREATION/MUTATION only (register, create,
 * update, import, change/reset password). It must NOT be applied to `LoginDto`:
 * login validates an already-existing credential, and tightening it would lock
 * out users (including the seeded admin) who legitimately hold older, weaker
 * passwords.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/;

export const PASSWORD_LENGTH_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caractères';

export const PASSWORD_COMPLEXITY_MESSAGE =
  'Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial';

/**
 * Composite class-validator decorator for DTO password fields. Reuses the
 * constants above so the rule lives in exactly one place.
 */
export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_LENGTH_MESSAGE }),
    Matches(PASSWORD_COMPLEXITY_REGEX, {
      message: PASSWORD_COMPLEXITY_MESSAGE,
    }),
  );
}

/**
 * Imperative policy check for code paths that do NOT run the DTO through the
 * global ValidationPipe (e.g. `UsersService.importUsers`, which receives an
 * already-deserialized array and bcrypts the raw password). Returns the
 * violation message, or `null` when the password satisfies the policy.
 */
export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_LENGTH_MESSAGE;
  }
  if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
    return PASSWORD_COMPLEXITY_MESSAGE;
  }
  return null;
}

/**
 * Throwing variant for imperative call sites that want fail-fast semantics.
 */
export function assertStrongPassword(password: unknown): void {
  const error = validatePasswordStrength(password);
  if (error) {
    throw new BadRequestException(error);
  }
}
