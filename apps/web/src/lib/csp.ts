/**
 * SEC-CSP-001 — Per-request nonce-based Content-Security-Policy builder.
 *
 * The nonce is generated in middleware.ts (crypto.randomUUID), injected here
 * into script-src, and applied both:
 *   1. As a request header (content-security-policy) so Next.js app-render
 *      auto-nonces its ~6 inline hydration scripts
 *   2. As a response header (Content-Security-Policy) visible to the browser
 *
 * IMPORTANT: unsafe-inline is intentionally DROPPED from script-src.
 *            style-src keeps it (common framework inline styles; lower risk).
 *
 * Only applied in production. Dev mode keeps unsafe-eval/unsafe-inline for HMR.
 */
export function buildCsp(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    // SEC-061 — explicit directives not covered by default-src fallback in all
    // browsers: object-src prevents Flash/plugin injection; base-uri prevents
    // <base href> attacks that redirect relative URLs to an attacker origin.
    `object-src 'none'`,
    `base-uri 'self'`,
  ];
  return directives.join("; ");
}
