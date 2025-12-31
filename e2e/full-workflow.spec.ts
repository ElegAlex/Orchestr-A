import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Full User Workflow", () => {
  test("complete workflow: login → dashboard → projects → tasks", async ({
    page,
  }) => {
    // 1. Login
    await login(page);

    // 2. Dashboard (already at dashboard after login)
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // 3. Navigate to Projects
    await page.goto("/projects");
    await expect(page.locator("h1")).toContainText(/projets/i);

    // 4. Navigate to Tasks
    await page.goto("/tasks");
    await expect(page).toHaveURL(/.*tasks/);

    // 5. Navigate to Planning
    await page.goto("/planning");
    await expect(page).toHaveURL(/.*planning/);
  });
});
