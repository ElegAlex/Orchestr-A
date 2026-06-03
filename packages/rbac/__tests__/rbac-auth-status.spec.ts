import { describe, it, expect } from "vitest";

/**
 * TST-013 — Characterization tests for the RBAC allowed-role status predicate.
 *
 * The original predicate in e2e/tests/rbac/api-permissions.spec.ts L114:
 *   expect(status).not.toBe(403)
 *
 * This is too weak: it passes for 500 (server error) and 401 (unauthenticated),
 * so a regression where the guard is disabled but the controller throws 500
 * stays green.
 *
 * Fix: export isAuthorizedStatus() from permission-matrix.ts and tighten to:
 *   status < 500 && status !== 401 && status !== 403
 *
 * These tests run the predicate logic inline (pure arithmetic, no I/O) so they
 * are gate-protected without booting the app.
 *
 * FAIL-PRE: the "desired behavior" describe block is RED when the old predicate
 * (status !== 403) is used; GREEN after the fix is applied.
 */

/** The FIXED predicate — imported from permission-matrix after fix */
import { isAuthorizedStatus } from "../../e2e/fixtures/permission-matrix";

describe("RBAC allowed-role status predicate — isAuthorizedStatus()", () => {
  describe("desired behavior (was RED before TST-013 fix)", () => {
    it("rejects 500 Internal Server Error as authorized", () => {
      // OLD code: status !== 403 → 500 !== 403 === true → test would FAIL
      // FIXED code: 500 < 500 === false → test PASSES
      expect(isAuthorizedStatus(500)).toBe(false);
    });

    it("rejects 401 Unauthorized as authorized", () => {
      // OLD code: status !== 403 → 401 !== 403 === true → test would FAIL
      // FIXED code: status !== 401 → false → test PASSES
      expect(isAuthorizedStatus(401)).toBe(false);
    });

    it("rejects 502 Bad Gateway as authorized", () => {
      expect(isAuthorizedStatus(502)).toBe(false);
    });
  });

  describe("valid authorized statuses (always accepted)", () => {
    it("accepts 200 OK", () => {
      expect(isAuthorizedStatus(200)).toBe(true);
    });

    it("accepts 201 Created", () => {
      expect(isAuthorizedStatus(201)).toBe(true);
    });

    it("accepts 204 No Content", () => {
      expect(isAuthorizedStatus(204)).toBe(true);
    });

    it("accepts 400 Bad Request (authorized but invalid input)", () => {
      expect(isAuthorizedStatus(400)).toBe(true);
    });

    it("accepts 404 Not Found (authorized, PLACEHOLDER_UUID resource absent)", () => {
      expect(isAuthorizedStatus(404)).toBe(true);
    });
  });

  describe("denial detection unchanged", () => {
    it("rejects 403 Forbidden", () => {
      expect(isAuthorizedStatus(403)).toBe(false);
    });
  });
});
