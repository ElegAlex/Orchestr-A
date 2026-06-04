import { describe, it, expect } from 'vitest';
import { assertJwtSecretStrength, JWT_SECRET_MIN_LENGTH } from './jwt-secret';

/**
 * SEC-026: unit tests for the JWT_SECRET boot-time length assertion.
 *
 * Red condition (before the fix existed): the function did not exist, so
 * importing it threw a module-not-found error. Once the fix is applied the
 * behaviour tested below must hold.
 */
describe('assertJwtSecretStrength (SEC-026)', () => {
  const EXACTLY_32 = 'a'.repeat(JWT_SECRET_MIN_LENGTH);
  const TOO_SHORT = 'short';
  const STRONG = 'a'.repeat(JWT_SECRET_MIN_LENGTH + 1);

  // ── production environment ─────────────────────────────────────────────

  it('throws in production when JWT_SECRET is empty string', () => {
    expect(() => assertJwtSecretStrength('', 'production')).toThrow(
      /JWT_SECRET must be at least/,
    );
  });

  it('throws in production when JWT_SECRET is undefined', () => {
    expect(() => assertJwtSecretStrength(undefined, 'production')).toThrow(
      /JWT_SECRET must be at least/,
    );
  });

  it('throws in production when JWT_SECRET is too short', () => {
    expect(() => assertJwtSecretStrength(TOO_SHORT, 'production')).toThrow(
      /JWT_SECRET must be at least/,
    );
  });

  it('does NOT throw in production when JWT_SECRET is exactly 32 chars', () => {
    expect(() =>
      assertJwtSecretStrength(EXACTLY_32, 'production'),
    ).not.toThrow();
  });

  it('does NOT throw in production when JWT_SECRET is longer than 32 chars', () => {
    expect(() => assertJwtSecretStrength(STRONG, 'production')).not.toThrow();
  });

  // ── non-production environments — short secrets are allowed ───────────

  it('does NOT throw in development even with a short secret', () => {
    expect(() =>
      assertJwtSecretStrength(TOO_SHORT, 'development'),
    ).not.toThrow();
  });

  it('does NOT throw in test even with undefined JWT_SECRET', () => {
    expect(() => assertJwtSecretStrength(undefined, 'test')).not.toThrow();
  });

  it('does NOT throw when NODE_ENV is undefined (local dev without .env)', () => {
    expect(() => assertJwtSecretStrength(TOO_SHORT, undefined)).not.toThrow();
  });
});
