import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Projects CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
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
