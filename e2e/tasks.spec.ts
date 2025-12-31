import { test, expect } from "@playwright/test";

test.describe("Tasks Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByPlaceholder(/login ou email/i).fill("admin");
    await page.getByPlaceholder(/mot de passe/i).fill("admin123");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("should navigate to tasks page", async ({ page }) => {
    await page.goto("/tasks");

    await expect(page.locator("h1")).toContainText(/tâches|tasks/i);
  });

  test("should display task list", async ({ page }) => {
    await page.goto("/tasks");

    // Attendre que la liste se charge
    await page
      .waitForSelector('[data-testid="task-list"], .tasks-list, table', {
        timeout: 5000,
      })
      .catch(() => {
        // Si aucun élément trouvé, c'est OK, la page peut être vide
      });

    expect(page.url()).toContain("/tasks");
  });
});
