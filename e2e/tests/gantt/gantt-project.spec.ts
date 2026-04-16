/**
 * e2e/tests/gantt/gantt-project.spec.ts
 *
 * Tests E2E du Gantt Projet sur la page /projects/[id] (onglet "Gantt").
 *
 * Le Gantt Projet affiche les taches et jalons d'un projet sur une timeline.
 * Le seed cree un "Projet E2E" accessible a la plupart des roles.
 *
 * Exécuté par les projets par role (admin, responsable, etc.).
 * Chaque test filtre les roles autorisés via test.skip().
 */

import { test, expect } from "../../fixtures/test-fixtures";

const ROLES_WITH_PROJECT_ACCESS = [
  "admin",
  "responsable",
  "manager",
  "referent",
  "contributeur",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to the first project's detail page, then click the Gantt tab.
 * Returns the project URL so tests can navigate back if needed.
 */
async function navigateToProjectGantt(
  page: import("@playwright/test").Page,
): Promise<string> {
  // Go to projects list, find the first project link
  await page.goto("/fr/projects");
  await page.waitForLoadState("networkidle");

  // Wait for the project list to load
  await expect(
    page.getByRole("heading", { name: "Projets", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // Click the first project link — the "Projet E2E" from seed or any project
  const projectLink = page.locator('a[href*="/projects/"]').first();
  await expect(projectLink).toBeVisible({ timeout: 10000 });
  await projectLink.click();

  // Wait for the project detail page to load
  await page.waitForURL(/\/projects\//, { timeout: 10000 });
  const projectUrl = page.url();

  // Click the Gantt tab
  const ganttTab = page.getByRole("button", { name: /gantt/i });
  await expect(ganttTab).toBeVisible({ timeout: 10000 });
  await ganttTab.click();

  // Wait for the Gantt to render
  await page.waitForTimeout(1000);

  return projectUrl;
}

// ─── LOADING ─────────────────────────────────────────────────────────────────

test.describe("Gantt Projet", () => {
  test("@smoke le Gantt Projet se charge correctement", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_PROJECT_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant acces aux projets",
    );

    await navigateToProjectGantt(page);

    // The Gantt container or an empty state should be visible
    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const emptyState = page.getByText("Aucun élément à afficher");
    const hasGantt = await ganttContainer.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(
      hasGantt || hasEmpty,
      "Le Gantt ou l'etat vide devrait etre affiche",
    ).toBeTruthy();
  });

  // ─── NAVIGATION ──────────────────────────────────────────────────────────────

  test("la navigation prev/next met a jour la timeline", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_PROJECT_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant acces aux projets",
    );

    await navigateToProjectGantt(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucune tache)");

    // Capture the initial header bucket text
    const headerBuckets = ganttContainer.locator(
      ".sticky.top-0 .flex.flex-1 span.text-xs.font-medium",
    );
    const initialTexts = await headerBuckets.allTextContents();

    // Click "Période suivante" (next arrow)
    const nextButton = ganttContainer.getByLabel("Période suivante");
    await expect(nextButton).toBeVisible();
    await nextButton.click();
    await page.waitForTimeout(500);

    const afterNextTexts = await headerBuckets.allTextContents();
    expect(afterNextTexts).not.toEqual(initialTexts);

    // Click "Aujourd'hui" to reset
    const todayButton = ganttContainer.getByText("Aujourd'hui", {
      exact: false,
    });
    await todayButton.click();
    await page.waitForTimeout(500);

    const afterTodayTexts = await headerBuckets.allTextContents();
    expect(afterTodayTexts).toEqual(initialTexts);
  });

  // ─── VIEW CHANGE ─────────────────────────────────────────────────────────────

  test("le changement de vue Jour/Semaine/Mois/Trimestre fonctionne", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_PROJECT_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant acces aux projets",
    );

    await navigateToProjectGantt(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucune tache)");

    // Project Gantt starts in "Jour" view by default
    const jourButton = ganttContainer.getByRole("button", {
      name: "Jour",
      exact: true,
    });
    const semaineButton = ganttContainer.getByRole("button", {
      name: "Semaine",
      exact: true,
    });
    const moisButton = ganttContainer.getByRole("button", {
      name: "Mois",
      exact: true,
    });
    const trimestreButton = ganttContainer.getByRole("button", {
      name: "Trimestre",
      exact: true,
    });

    // Initial: Jour is active
    await expect(jourButton).toHaveClass(/bg-gray-800/);

    // Switch to Semaine
    await semaineButton.click();
    await page.waitForTimeout(300);
    await expect(semaineButton).toHaveClass(/bg-gray-800/);

    // Switch to Mois
    await moisButton.click();
    await page.waitForTimeout(300);
    await expect(moisButton).toHaveClass(/bg-gray-800/);

    // Switch to Trimestre
    await trimestreButton.click();
    await page.waitForTimeout(300);
    await expect(trimestreButton).toHaveClass(/bg-gray-800/);

    // Back to Jour
    await jourButton.click();
    await page.waitForTimeout(300);
    await expect(jourButton).toHaveClass(/bg-gray-800/);
  });

  // ─── GROUPBY CHANGE ─────────────────────────────────────────────────────────

  test("le changement de groupement Jalon/Épopée/Aucun fonctionne", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      "Exécuté uniquement par le role admin",
    );

    await navigateToProjectGantt(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucune tache)");

    // The groupBy dropdown should be present (project scope only)
    const groupByLabel = ganttContainer.getByText("Grouper :");
    await expect(groupByLabel).toBeVisible();

    const groupBySelect = ganttContainer.locator("select");
    await expect(groupBySelect).toBeVisible();

    // Default is "Jalon" (milestone)
    await expect(groupBySelect).toHaveValue("milestone");

    // Switch to "Aucun"
    await groupBySelect.selectOption("none");
    await page.waitForTimeout(300);
    await expect(groupBySelect).toHaveValue("none");

    // With "Aucun", group headers should disappear
    const groupHeaders = ganttContainer.locator('[role="row"][aria-expanded]');
    await expect(groupHeaders).toHaveCount(0);

    // Switch to "Épopée"
    await groupBySelect.selectOption("epic");
    await page.waitForTimeout(300);
    await expect(groupBySelect).toHaveValue("epic");

    // Switch back to "Jalon"
    await groupBySelect.selectOption("milestone");
    await page.waitForTimeout(300);
    await expect(groupBySelect).toHaveValue("milestone");
  });

  // ─── GROUP EXPAND/COLLAPSE ───────────────────────────────────────────────────

  test("les en-tetes de groupe se replient et se deplient", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      "Exécuté uniquement par le role admin",
    );

    await navigateToProjectGantt(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucune tache)");

    // Ensure groupBy is "milestone" (default)
    const groupBySelect = ganttContainer.locator("select");
    const hasGroupBy = await groupBySelect.isVisible().catch(() => false);
    test.skip(!hasGroupBy, "Pas de select de groupement");

    await groupBySelect.selectOption("milestone");
    await page.waitForTimeout(300);

    // Find group headers (they have aria-expanded attribute)
    const groupHeaders = ganttContainer.locator('[role="row"][aria-expanded]');
    const headerCount = await groupHeaders.count();
    test.skip(headerCount === 0, "Aucun en-tete de groupe");

    const firstHeader = groupHeaders.first();

    // Initially expanded
    await expect(firstHeader).toHaveAttribute("aria-expanded", "true");

    // Count visible task rows before collapse
    const allRows = ganttContainer.locator(
      '[role="row"]:not([aria-expanded])',
    );
    const rowCountBefore = await allRows.count();

    // Click to collapse
    await firstHeader.click();
    await page.waitForTimeout(300);

    // After collapse, aria-expanded should be "false"
    await expect(firstHeader).toHaveAttribute("aria-expanded", "false");

    // Task rows should decrease (some hidden)
    const rowCountAfter = await allRows.count();
    expect(rowCountAfter).toBeLessThan(rowCountBefore);

    // Click again to expand
    await firstHeader.click();
    await page.waitForTimeout(300);
    await expect(firstHeader).toHaveAttribute("aria-expanded", "true");
  });

  // ─── DOUBLE-CLICK → MODAL ───────────────────────────────────────────────────

  test("double-clic sur une tache ouvre la modale de dependances", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      "Exécuté uniquement par le role admin",
    );

    await navigateToProjectGantt(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucune tache)");

    // Find task rows (not group headers — no aria-expanded attribute)
    const taskRows = ganttContainer.locator(
      '[role="row"]:not([aria-expanded])',
    );
    const taskCount = await taskRows.count();
    test.skip(taskCount === 0, "Aucune tache dans le Gantt");

    // Double-click the first task row
    await taskRows.first().dblclick();

    // The dependency modal should appear (TaskDependencyModal)
    // It's a dialog/modal with dependency-related content
    const modal = page.locator('[role="dialog"], .fixed.inset-0');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── EXPORT PDF BUTTON ──────────────────────────────────────────────────────

  test("le bouton Export PDF est present", async ({ page }, testInfo) => {
    test.skip(
      !ROLES_WITH_PROJECT_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant acces aux projets",
    );

    await navigateToProjectGantt(page);

    // The "Export PDF" button is in the Gantt tab header (above the GanttChart)
    const exportButton = page.getByRole("button", { name: /export pdf/i });
    await expect(exportButton).toBeVisible({ timeout: 5000 });
  });
});
