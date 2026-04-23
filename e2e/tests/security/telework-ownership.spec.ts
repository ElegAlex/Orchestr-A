import { test } from "@playwright/test";

/**
 * Placeholder for Wave 5 (W5.1 — E2E ownership IDOR).
 *
 * BUG-01 / SEC-06: ensure the telework planning page and API cannot be used
 * to modify another user's TTV. Service-level ownership checks live in
 * `apps/api/src/telework/telework.service.ts`; defense-in-depth is provided
 * by `@OwnershipCheck({ resource: 'telework', bypassPermission: 'telework:manage_others' })`
 * on single-resource routes (`GET/PATCH/DELETE /telework/:id`).
 *
 * The full cross-role coverage (CONTRIBUTEUR, OBSERVATEUR, REFERENT_TECHNIQUE,
 * MANAGER out-of-perimeter → 403; ADMIN → 200) is implemented in Wave 5 inside
 * `e2e/tests/security/ownership-idor.spec.ts`.
 */
test.describe("telework ownership (placeholder — see Wave 5)", () => {
  test.skip("cross-user TTV modification returns 403", () => {
    // Implemented in Wave 5 ownership-idor.spec.ts
  });
});
