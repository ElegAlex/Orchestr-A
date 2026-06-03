/**
 * SEC-CSP-001 — Nonce-based CSP middleware.
 *
 * Strategy:
 *   1. Generate a per-request nonce (crypto.randomUUID — base64-safe, no HTML escapes)
 *   2. Set content-security-policy on the DOWNSTREAM REQUEST headers so that
 *      Next.js app-render (app-render.js L166) picks it up and auto-nonces
 *      all ~6 inline hydration scripts.
 *   3. Set Content-Security-Policy on the RESPONSE so the browser enforces it.
 *   4. Compose with next-intl middleware (locale routing).
 *
 * In development: strict CSP is skipped to allow HMR / React Refresh
 * (they inject eval and unsigned inline scripts).
 *
 * nginx: the frontend location / MUST NOT emit a conflicting CSP — two
 * CSP headers are enforced as an intersection, which would drop nonce support.
 * nginx CSP for the HTML path has been removed. The /api path keeps its own
 * separate CSP via @fastify/helmet.
 */
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./src/i18n/config";
import { buildCsp } from "./src/lib/csp";

const handleI18n = createIntlMiddleware({
  locales,
  defaultLocale,
});

export default function middleware(request: NextRequest): NextResponse {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    // Dev: skip nonce CSP — HMR needs unsafe-eval + unsigned inlines.
    return handleI18n(request);
  }

  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  // Clone the request headers and inject the CSP so Next.js auto-nonces
  // its inline hydration scripts (reads headers['content-security-policy']).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-nonce", nonce);

  // Run next-intl middleware with the augmented request.
  const intlRequest = new Request(request, { headers: requestHeaders });
  // next-intl expects a NextRequest; cast via type assertion (same shape).
  const response = handleI18n(intlRequest as unknown as NextRequest);

  // Stamp the CSP on the response so the browser enforces it.
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  // Match all pathnames except Next.js internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
