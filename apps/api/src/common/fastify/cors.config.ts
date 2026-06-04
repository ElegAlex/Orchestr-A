/**
 * cors.config.ts — SEC-012
 *
 * Resolves the list of allowed CORS origins from environment variables.
 *
 * Environment variables (checked in priority order):
 *  - CORS_ORIGIN      canonical — documented in .env.production.example
 *  - ALLOWED_ORIGINS  deprecated alias — kept for backward compatibility
 *
 * Both accept a comma-separated list of origins.
 *
 * Boot assertion: if NODE_ENV=production and neither variable is set, the
 * application throws at startup rather than silently falling through.
 */

function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Returns the resolved allowed origins for CORS configuration.
 *
 * @param env  A subset of `process.env` (injected for testability).
 */
export function resolveAllowedOrigins(
  env: Partial<Record<string, string>> = process.env,
): string[] | false {
  // SEC-012: read canonical CORS_ORIGIN first, fall back to legacy ALLOWED_ORIGINS
  const raw = env['CORS_ORIGIN'] || env['ALLOWED_ORIGINS'];

  if (raw) {
    const origins = parseOrigins(raw);
    if (origins.length > 0) return origins;
  }

  if (env['NODE_ENV'] === 'production') {
    throw new Error(
      '[SEC-012] CORS_ORIGIN (or ALLOWED_ORIGINS) must be set in production. ' +
        'Refusing to start with an unconfigured CORS allowlist.',
    );
  }

  // Development / test fallback
  return ['http://localhost:4001', 'http://localhost:3000'];
}
