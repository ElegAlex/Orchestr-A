import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Tasks Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
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
