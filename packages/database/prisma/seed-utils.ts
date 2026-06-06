/**
 * seed-utils.ts — pure helpers extracted from seed.ts for testability.
 *
 * These functions have no side effects and take their inputs explicitly,
 * making them easy to unit-test without importing the full seed module
 * (which creates a PrismaClient + Redis client at module level).
 */

/**
 * Returns true when the E2E test-user block should run.
 *
 * DAT-030: the original condition was an OR-only gate; an accidental
 * E2E_SEED=true in a production shell could land test users with
 * predictable credentials into the prod database.  Adding the hard
 * `NODE_ENV !== 'production'` refusal closes that window.
 *
 * @param env — pass `process.env` in production, or a stub in tests.
 */
export function shouldSeedE2EUsers(
  env: Record<string, string | undefined>,
): boolean {
  return (
    (env.E2E_SEED === "true" || env.NODE_ENV === "test") &&
    env.NODE_ENV !== "production"
  );
}
