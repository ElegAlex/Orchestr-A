import type { TestType } from "@playwright/test";

/**
 * E2E isolation helper — run a spec ONCE (under the `admin` project) instead of
 * 6× across the per-role projects.
 *
 * Why this exists: the 6 role projects all point at `./e2e/tests`, so every spec
 * runs 6× in parallel against ONE shared API + ONE database that `global-setup`
 * seeds exactly ONCE per run. For specs that mutate seed data or perform logins,
 * the 6 concurrent (and, even serialized, cumulative) re-runs:
 *   - deplete / mutate the single shared seed (a leave approved in the admin run
 *     is no longer PENDING for the contributeur run), and
 *   - contend on the global login throttle (5/min), yielding flaky
 *     `[401,401,401,429,429,429]`-style failures.
 *
 * This was the real interference in the suite — NOT classic data-races (the bulk
 * of failures were spec-vs-app drift). Per-role behavior is still covered: the
 * `rbac/` specs + permission matrix run across all roles, and role-discriminating
 * functional specs exercise multiple roles INTERNALLY via the `asRole` fixture
 * with explicit per-role tokens, so they lose no coverage when run once.
 *
 * Use it at the top of a role-agnostic / seed-mutating / login-heavy spec:
 *
 *   import { runOnceUnderAdmin } from "../../fixtures/run-once";
 *   runOnceUnderAdmin(test, "functional flow; roles covered via asRole");
 *
 * Mirrors the inline `beforeEach(test.skip(project !== 'admin'))` already used by
 * the API-only security specs (leave-delegation, leave-balance-skills,
 * time-tracking-scope), centralised so the rationale lives in one place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runOnceUnderAdmin(
  test: TestType<any, any>,
  reason: string,
): void {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      `Runs once under the admin project — ${reason}`,
    );
  });
}
