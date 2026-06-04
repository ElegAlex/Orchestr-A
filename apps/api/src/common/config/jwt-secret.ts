/**
 * SEC-026: JWT_SECRET boot-time validation.
 *
 * In production a weak or absent JWT_SECRET allows an attacker to forge
 * valid-looking tokens. We refuse to boot rather than run insecurely.
 *
 * The check is gated on NODE_ENV === 'production' so test / dev
 * environments (which commonly use short placeholder secrets) are
 * unaffected. This matches the SEC-001 / SEC-018 pattern used elsewhere
 * in bootstrap().
 */
export const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Throw if the application is in production and JWT_SECRET is too short.
 *
 * Extracted into a pure function so it can be unit-tested in isolation
 * without importing main.ts (which would trigger a full app boot).
 *
 * @param jwtSecret  - value of process.env.JWT_SECRET (may be undefined)
 * @param nodeEnv    - value of process.env.NODE_ENV   (may be undefined)
 */
export function assertJwtSecretStrength(
  jwtSecret: string | undefined,
  nodeEnv: string | undefined,
): void {
  if (
    nodeEnv === 'production' &&
    (!jwtSecret || jwtSecret.length < JWT_SECRET_MIN_LENGTH)
  ) {
    throw new Error(
      `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters in production ` +
        `(current length: ${jwtSecret?.length ?? 0}). ` +
        'Generate a strong secret and set it in your environment.',
    );
  }
}
