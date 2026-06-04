/**
 * Centralised frontend logger (OBS-016).
 *
 * Behaviours:
 * - NODE_ENV guard: debug / info / warn are suppressed in production.
 *   error is always emitted (visible in prod DevTools for critical failures).
 * - PII scrubbing: object payloads have token / password / email replaced
 *   with "[REDACTED]" before they reach the console.
 * - DSN-optional error reporter: if NEXT_PUBLIC_ERROR_REPORTER_DSN is set,
 *   error-level events are forwarded to the reporting endpoint. Otherwise
 *   the reporter is a no-op (no Sentry / PostHog dependency required).
 *
 * Note: console.* are called at invocation time (not bound at module load)
 * so that Jest spies can intercept them in tests.
 */

const PII_KEYS = new Set(["token", "password", "email", "accessToken", "refreshToken"]);

/**
 * Recursively scrub PII keys from a plain object.
 * Non-object values are returned as-is.
 */
function scrub(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = PII_KEYS.has(k) ? "[REDACTED]" : scrub(v);
  }
  return result;
}

function scrubArgs(args: unknown[]): unknown[] {
  return args.map(scrub);
}

/** Forward critical errors to an external reporter if DSN is configured. */
function reportError(...args: unknown[]): void {
  const dsn =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_ERROR_REPORTER_DSN
      : undefined;
  if (!dsn) return; // no-op stub — no Sentry / PostHog dependency
  try {
    navigator.sendBeacon(dsn, JSON.stringify({ level: "error", args }));
  } catch {
    // Reporter failures must never crash the app
  }
}

/** Whether verbose levels (debug/info/warn) should be suppressed. */
function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export const logger = {
  // eslint-disable-next-line no-console
  debug(...args: unknown[]): void {
    if (isProd()) return;
    // eslint-disable-next-line no-console
    console.debug(...scrubArgs(args));
  },
  // eslint-disable-next-line no-console
  info(...args: unknown[]): void {
    if (isProd()) return;
    // eslint-disable-next-line no-console
    console.info(...scrubArgs(args));
  },
  // eslint-disable-next-line no-console
  warn(...args: unknown[]): void {
    if (isProd()) return;
    // eslint-disable-next-line no-console
    console.warn(...scrubArgs(args));
  },
  // eslint-disable-next-line no-console
  error(...args: unknown[]): void {
    const scrubbed = scrubArgs(args);
    // eslint-disable-next-line no-console
    console.error(...scrubbed);
    reportError(...scrubbed);
  },
};
