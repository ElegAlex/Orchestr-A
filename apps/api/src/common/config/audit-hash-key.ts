/**
 * OBS-028: AUDIT_HASH_KEY boot-time validation.
 *
 * AuditService stores the attempted-login identifier of a LOGIN_FAILURE /
 * ACCOUNT_LOCKED event as a KEYED HMAC (audit.service.ts → hashAttemptedSubject)
 * so no raw identifier enters the immutable, retained-forever audit trail. The
 * HMAC needs a secret key. The only alternatives to having one are storing the
 * raw identifier (a forward PII leak) or an unkeyed hash (dictionary-reversible)
 * — both unacceptable. So, unlike JWT_SECRET's production-only gate, this check
 * is enforced in EVERY environment: there is no safe degraded mode.
 *
 * The key MUST be stable / long-lived — rotating it breaks hash-correlation of
 * historical attempts. Provision it once per environment and never change it.
 *
 * Extracted into a pure function so it can be unit-tested without booting main.ts.
 */
export const AUDIT_HASH_KEY_MIN_LENGTH = 32;

/**
 * Throw if AUDIT_HASH_KEY is absent or too short. Enforced in all environments.
 *
 * @param auditHashKey - value of process.env.AUDIT_HASH_KEY (may be undefined)
 */
export function assertAuditHashKey(auditHashKey: string | undefined): void {
  if (!auditHashKey || auditHashKey.length < AUDIT_HASH_KEY_MIN_LENGTH) {
    throw new Error(
      `AUDIT_HASH_KEY must be set and at least ${AUDIT_HASH_KEY_MIN_LENGTH} characters ` +
        `(current length: ${auditHashKey?.length ?? 0}). It keys the HMAC that ` +
        `pseudonymises attempted-login identifiers in the immutable audit trail; ` +
        `without it the application refuses to boot rather than store raw identifiers. ` +
        `Generate a strong, STABLE key — rotating it breaks historical correlation.`,
    );
  }
}
