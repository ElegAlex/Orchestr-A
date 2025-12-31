import { test, expect } from "@playwright/test";

test.describe("Projects CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // Login avant chaque test
    await page.goto("/login");
    await page.getByPlaceholder(/login ou email/i).fill("admin");
    await page.getByPlaceholder(/mot de passe/i).fill("admin123");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("should display projects list", async ({ page }) => {
    await page.goto("/projects");

    await expect(page.locator("h1")).toContainText(/projets/i);
  });

  test("should navigate to project details", async ({ page }) => {
    await page.goto("/projects");

    // Cliquer sur le premier projet (s'il existe)
    const firstProject = page.locator('[data-testid="project-item"]').first();
    if (await firstProject.isVisible()) {
      await firstProject.click();
      await expect(page).toHaveURL(/.*projects\/[a-z0-9-]+/);
    }
  });
});
