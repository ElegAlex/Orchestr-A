import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login");

    // Check page title and form elements
    await expect(page.locator("h1")).toContainText(/orchestr/i);
    await expect(page.locator('input[id="login"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[id="login"]').fill("wronguser");
    await page.locator('input[id="password"]').fill("wrongpass");
    await page.getByTestId("login-submit").click();

    // Wait a bit for potential redirect, then verify we're still on login
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/.*login/);
    // Form should still be visible (not redirected)
    await expect(page.locator('input[id="login"]')).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[id="login"]').fill("admin");
    await page.locator('input[id="password"]').fill("admin123");
    await page.getByTestId("login-submit").click();

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
