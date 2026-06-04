/**
 * @jest-environment node
 *
 * Locale-root redirect regression witness.
 *
 * Context: the prior middleware was a bare `createMiddleware({ locales,
 * defaultLocale })`, which redirects bare `/` -> `/<locale>` (next-intl,
 * localePrefix "always"). The SEC-CSP-001 rewrite (785e6617) kept next-intl in
 * the chain but, in the PRODUCTION branch, handed it a plain `new Request(...)`
 * (which has no `.nextUrl`) instead of a `NextRequest`. next-intl needs
 * `nextUrl` to compute the locale redirect, so in production `/` stopped
 * redirecting and 404s (no root `app/page.tsx`) — which also fails the compose
 * healthcheck (`/` probe) -> container "unhealthy".
 *
 * This witnesses the ROOT CAUSE directly: next-intl is mocked to capture the
 * request it receives, and we assert that request still carries `.nextUrl`
 * (i.e. it is a NextRequest). next-intl's ESM build is not transformable by the
 * web Jest config, hence the mock; the real end-to-end `/` -> `/fr` redirect is
 * verified separately by a local production run (`next build` + `start`).
 *
 * RED pre-fix (prod branch passes a plain Request): captured `.nextUrl` is undefined.
 * GREEN post-fix (prod branch passes a NextRequest): captured `.nextUrl` is defined,
 * pathname preserved, and the SEC-CSP-001 CSP is still stamped on the response.
 */
import { NextRequest } from "next/server";

// Capture the request next-intl receives, without depending on its ESM build.
// The middleware only needs the returned response to expose `.headers.set`, so a
// minimal `{ headers }` stand-in avoids pulling next-intl's untransformable ESM.
jest.mock("next-intl/middleware", () => ({
  __esModule: true,
  default: () => (req: NextRequest) => {
    (globalThis as Record<string, unknown>).__lastIntlRequest = req;
    return { headers: new Headers() };
  },
}));

import middleware from "../../middleware";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "https://orchestr-a.com"));
}

function lastIntlRequest(): NextRequest {
  return (globalThis as Record<string, unknown>)
    .__lastIntlRequest as NextRequest;
}

describe("middleware locale-root redirect (prod path)", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "production";
  });
  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it("hands next-intl a NextRequest (with .nextUrl) so it can redirect /", () => {
    middleware(requestFor("/"));
    const seen = lastIntlRequest();
    // The regression: a plain Request loses .nextUrl, so next-intl cannot redirect.
    expect(seen.nextUrl).toBeDefined();
    expect(seen.nextUrl.pathname).toBe("/");
  });

  it("still injects the nonce CSP into the downstream request headers", () => {
    middleware(requestFor("/"));
    const seen = lastIntlRequest();
    expect(seen.headers.get("content-security-policy")).toContain("'nonce-");
    expect(seen.headers.get("x-nonce")).toBeTruthy();
  });

  it("still stamps the SEC-CSP-001 nonce CSP on the response", () => {
    const res = middleware(requestFor("/"));
    expect(res.headers.get("content-security-policy")).toContain("'nonce-");
  });
});
