/**
 * e2e/tests/workflows/dashboard.spec.ts
 *
 * Tests du CTA des KPI Cards du dashboard.
 *
 * Chaque KPI card (Projets actifs, Tâches en cours, Tâches terminées, Tâches
 * bloquées) est cliquable et redirige vers la page correspondante avec un
 * filtre de statut pré-activé dans l'URL. Le scope "mes projets/tâches" est
 * déjà garanti par l'API via le RBAC (membership projet, permission
 * tasks:readAll), donc les query params ne peuvent pas contourner les
 * permissions.
 */

import { test, expect } from "../../fixtures/test-fixtures";

const ROLES_WITH_DASHBOARD = [
  "admin",
  "responsable",
  "manager",
  "referent",
  "contributeur",
  "observateur",
];

test.describe("Dashboard KPI CTA", () => {
  test("KPI Projets actifs → /projects?status=ACTIVE", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_DASHBOARD.includes(testInfo.project.name),
      "Dashboard accessible à tous les rôles authentifiés",
    );

    await page.goto("/fr/dashboard");
    await expect(page.getByText("Projets actifs")).toBeVisible();
    await page.locator('a[href$="/projects?status=ACTIVE"]').click();

    await expect(page).toHaveURL(/\/projects\?status=ACTIVE/);
    const statusSelect = page.locator("select").first();
    await expect(statusSelect).toHaveValue("ACTIVE");
  });

  test("KPI Tâches en cours → /tasks?status=IN_PROGRESS", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_DASHBOARD.includes(testInfo.project.name),
      "Dashboard accessible à tous les rôles authentifiés",
    );

    await page.goto("/fr/dashboard");
    await expect(page.getByText("Tâches en cours")).toBeVisible();
    await page.locator('a[href$="/tasks?status=IN_PROGRESS"]').click();

    await expect(page).toHaveURL(/\/tasks\?status=IN_PROGRESS/);
  });

  test("KPI Tâches terminées → /tasks?status=DONE", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_DASHBOARD.includes(testInfo.project.name),
      "Dashboard accessible à tous les rôles authentifiés",
    );

    await page.goto("/fr/dashboard");
    await expect(page.getByText("Tâches terminées")).toBeVisible();
    await page.locator('a[href$="/tasks?status=DONE"]').click();

    await expect(page).toHaveURL(/\/tasks\?status=DONE/);
  });

  test("KPI Tâches bloquées → /tasks?status=BLOCKED", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_DASHBOARD.includes(testInfo.project.name),
      "Dashboard accessible à tous les rôles authentifiés",
    );

    await page.goto("/fr/dashboard");
    await expect(page.getByText("Tâches bloquées")).toBeVisible();
    await page.locator('a[href$="/tasks?status=BLOCKED"]').click();

    await expect(page).toHaveURL(/\/tasks\?status=BLOCKED/);
  });

  test("query param status invalide est ignoré sur /projects", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["admin", "manager"].includes(testInfo.project.name),
      "Test rapide sur 2 rôles",
    );

    await page.goto("/fr/projects?status=NOT_A_REAL_STATUS");
    const statusSelect = page.locator("select").first();
    await expect(statusSelect).toHaveValue("ALL");
  });

  test("query param status invalide est ignoré sur /tasks", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["admin", "manager"].includes(testInfo.project.name),
      "Test rapide sur 2 rôles",
    );

    await page.goto("/fr/tasks?status=NOT_A_REAL_STATUS");
    // Pas de chip status visible si le param est invalide
    await expect(
      page.locator("text=× ").filter({ hasText: /NOT_A_REAL/ }),
    ).toHaveCount(0);
  });
});
