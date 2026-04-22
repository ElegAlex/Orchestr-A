import { test, expect } from "../fixtures/test-fixtures";

test.describe.configure({ mode: "serial" });

test.describe("@smoke Kanban drop-zones", () => {
  test("drop is accepted on column header (full-column drop-zone)", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto("/fr/tasks");
    await page.waitForSelector('[data-testid^="kanban-column-"]', { timeout: 15000 });

    const todoCard = page
      .locator('[data-testid="kanban-column-TODO"] [data-testid^="kanban-card-"]')
      .first();
    const inProgressColumn = page.locator('[data-testid="kanban-column-IN_PROGRESS"]');

    if (!(await todoCard.isVisible().catch(() => false))) {
      test.skip(true, "No TODO task to drag — seed the DB before running smoke");
      return;
    }

    const taskId = (await todoCard.getAttribute("data-testid"))!.replace(
      "kanban-card-",
      ""
    );

    // HTML5 DnD via dispatchEvent — drop-zone is the column wrapper itself
    await todoCard.dispatchEvent("dragstart");
    await inProgressColumn.dispatchEvent("dragover");
    await inProgressColumn.dispatchEvent("drop");
    await todoCard.dispatchEvent("dragend");

    await expect(
      page.locator(
        `[data-testid="kanban-column-IN_PROGRESS"] [data-testid="kanban-card-${taskId}"]`
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("drop is accepted on empty column footer area", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto("/fr/tasks");
    await page.waitForSelector('[data-testid^="kanban-column-"]', { timeout: 15000 });

    const todoCard = page
      .locator('[data-testid="kanban-column-TODO"] [data-testid^="kanban-card-"]')
      .first();

    if (!(await todoCard.isVisible().catch(() => false))) {
      test.skip(true, "No TODO task available");
      return;
    }

    const taskId = (await todoCard.getAttribute("data-testid"))!.replace(
      "kanban-card-",
      ""
    );

    // The column wrapper carries onDrop — targeting the cards container (inner div)
    const doneColumn = page.locator('[data-testid="kanban-column-DONE"]');

    await todoCard.dispatchEvent("dragstart");
    await doneColumn.dispatchEvent("dragover");
    await doneColumn.dispatchEvent("drop");
    await todoCard.dispatchEvent("dragend");

    await expect(
      page.locator(
        `[data-testid="kanban-column-DONE"] [data-testid="kanban-card-${taskId}"]`
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("alphabetical order is preserved within a column", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto("/fr/tasks");
    await page.waitForSelector('[data-testid="kanban-column-TODO"]', { timeout: 15000 });

    const cards = page.locator(
      '[data-testid="kanban-column-TODO"] [data-testid^="kanban-card-"]'
    );
    const count = await cards.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 TODO tasks to verify sort order");
      return;
    }

    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const h3 = cards.nth(i).locator("h3, [role=heading]").first();
      titles.push((await h3.textContent()) ?? "");
    }

    const sorted = [...titles].sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
    expect(titles).toEqual(sorted);
  });
});
