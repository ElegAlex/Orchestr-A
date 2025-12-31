import { test, expect } from "@playwright/test";

test.describe("Full User Workflow", () => {
  test("complete workflow: login → dashboard → projects → tasks → logout", async ({
    page,
  }) => {
    // 1. Login
    await page.goto("/login");
    await page.getByPlaceholder(/login ou email/i).fill("admin");
    await page.getByPlaceholder(/mot de passe/i).fill("admin123");
    await page.getByRole("button", { name: /se connecter/i }).click();

    // 2. Dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // 3. Navigate to Projects
    await page.goto("/projects");
    await expect(page.locator("h1")).toContainText(/projets/i);

    // 4. Navigate to Tasks
    await page.goto("/tasks");
    await expect(page).toHaveURL(/.*tasks/);

    // 5. Logout (if logout button exists)
    const logoutButton = page
      .locator(
        'button:has-text("Déconnexion"), button:has-text("Logout"), [aria-label="Déconnexion"]',
      )
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/.*login/);
    }
  });
});
