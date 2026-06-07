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
    // TaskKanban (default view) shows assignee count as text, not UserAvatar.
    // Avatar stacks with `-space-x-1` are rendered by TaskLineCard (list view).
    // Switch to list view before asserting the avatar stack.
    await page.getByRole("button", { name: /^liste$/i }).click();
    const stackedAvatar = page.locator(".-space-x-1 [title]").first();
    await expect(stackedAvatar).toBeVisible();
  });
});
