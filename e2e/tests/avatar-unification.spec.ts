import { test, expect } from "@playwright/test";

test.describe("@smoke Avatar unification", () => {
  test("avatar visible on /users first row", async ({ page }) => {
    await page.goto("/fr/users");
    // First row's avatar — UserAvatar renders with title attribute equal to full name.
    const firstAvatar = page
      .locator("tbody tr")
      .first()
      .locator("[title]")
      .first();
    await expect(firstAvatar).toBeVisible();
  });

  test("avatar visible in task kanban stack", async ({ page }) => {
    await page.goto("/fr/tasks");
    // Kanban stack wrapper has `-space-x-1`; stacked avatars have the title attribute.
    const stackedAvatar = page.locator(".-space-x-1 [title]").first();
    await expect(stackedAvatar).toBeVisible();
  });
});
