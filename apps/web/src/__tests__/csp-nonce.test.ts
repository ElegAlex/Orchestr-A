/**
 * SEC-CSP-001 — CSP nonce middleware unit test
 *
 * RED pre-fix: buildCsp does not exist (middleware is a pure next-intl wrapper)
 * GREEN post-fix: buildCsp returns script-src with nonce and without unsafe-inline
 */

import { buildCsp } from "@/lib/csp";

describe("buildCsp (SEC-CSP-001)", () => {
  const TEST_NONCE = "abc123testNonce456";

  it("includes the nonce in script-src", () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain(`'nonce-${TEST_NONCE}'`);
  });

  it("does NOT allow unsafe-inline for script-src", () => {
    const csp = buildCsp(TEST_NONCE);
    const scriptSrcDirective = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));
    expect(scriptSrcDirective).toBeDefined();
    expect(scriptSrcDirective).not.toContain("'unsafe-inline'");
  });

  it("still allows unsafe-inline for style-src", () => {
    const csp = buildCsp(TEST_NONCE);
    const styleSrcDirective = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("style-src"));
    expect(styleSrcDirective).toBeDefined();
    expect(styleSrcDirective).toContain("'unsafe-inline'");
  });

  it("includes frame-ancestors none", () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
