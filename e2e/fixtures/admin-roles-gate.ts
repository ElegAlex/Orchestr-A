import { expect, type Page } from "@playwright/test";

/**
 * Assert that a non-admin landing on /admin/roles is blocked by the client-side
 * gate.
 *
 * The RolesAdminPage gate (apps/web/app/[locale]/admin/roles/page.tsx) resolves
 * only AFTER the async permission fetch completes: when the user lacks
 * `users:manage_roles` it both `router.replace('/<locale>/dashboard')` AND
 * renders an "Accès refusé / Vous n'avez pas la permission" panel. Reading
 * page.url() synchronously right after `domcontentloaded` races that post-fetch
 * redirect (it always reads the pre-redirect URL), and the panel copy is
 * "Accès refusé", not the legacy "accès restreint" the tests grepped for.
 *
 * Wait for whichever block signal resolves first: the redirect away, or the
 * access-denied panel.
 */
export async function expectBlockedFromAdminRoles(page: Page): Promise<void> {
  const redirected = page
    .waitForURL(/\/(login|403|unauthorized|dashboard)(\/|\?|$)/, {
      timeout: 15000,
    })
    .then(() => true)
    .catch(() => false);

  const deniedPanel = page
    .getByText(/accès refusé|n'avez pas la permission|accès restreint/i)
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  const blocked = await Promise.race([redirected, deniedPanel]);
  expect(
    blocked,
    `non-admin must be blocked on /admin/roles (final url=${page.url()})`,
  ).toBeTruthy();
}
