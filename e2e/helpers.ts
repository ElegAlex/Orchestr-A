import { Page } from "@playwright/test";

export async function login(page: Page, username = "admin", password = "admin123") {
  await page.goto("/login");
  await page.locator('input[id="login"]').fill(username);
  await page.locator('input[id="password"]').fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}
