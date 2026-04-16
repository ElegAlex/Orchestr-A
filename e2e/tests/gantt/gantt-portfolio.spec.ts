/**
 * e2e/tests/gantt/gantt-portfolio.spec.ts
 *
 * Tests E2E du Gantt Portfolio sur la page /reports (onglet index 2).
 *
 * Le Gantt Portfolio affiche tous les projets sur une timeline.
 * Accessible aux roles ADMIN, RESPONSABLE, MANAGER (reports:view).
 *
 * Exécuté par les projets par role (admin, responsable, etc.).
 * Chaque test filtre les roles autorisés via test.skip().
 */

import { test, expect } from "../../fixtures/test-fixtures";

const ROLES_WITH_REPORTS_ACCESS = ["admin", "responsable", "manager"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to /reports and click the Gantt Portfolio tab (3rd tab).
 * Returns the Gantt container locator.
 */
async function navigateToGanttPortfolio(page: import("@playwright/test").Page) {
  await page.goto("/fr/reports");
  await page.waitForLoadState("networkidle");

  // Click the Gantt Portfolio tab (3rd tab button in the header)
  const ganttTab = page.getByRole("button", { name: /gantt/i });
  await expect(ganttTab).toBeVisible({ timeout: 10000 });
  await ganttTab.click();

  // Wait for the Gantt container or the empty state to appear
  await page.waitForTimeout(1000);
}

// ─── LOADING ─────────────────────────────────────────────────────────────────

test.describe("Gantt Portfolio", () => {
  test("@smoke le Gantt Portfolio se charge correctement", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_REPORTS_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant reports:view",
    );

    await navigateToGanttPortfolio(page);

    // Le conteneur Gantt doit etre visible (role="grid" avec aria-label)
    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    // Si pas de projets, on aura un empty state a la place
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
      !ROLES_WITH_REPORTS_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant reports:view",
    );

    await navigateToGanttPortfolio(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucun projet)");

    // Capture the initial header bucket text
    const headerBuckets = ganttContainer.locator(
      ".sticky.top-0 .flex.flex-1 span.text-xs.font-medium",
    );
    const initialTexts = await headerBuckets.allTextContents();

    // Click "Période suivante" (next arrow)
    const nextButton = ganttContainer.getByLabel("Période suivante");
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Wait for re-render
    await page.waitForTimeout(500);

    // Header should have changed
    const afterNextTexts = await headerBuckets.allTextContents();
    expect(afterNextTexts).not.toEqual(initialTexts);

    // Click "Aujourd'hui" to reset
    const todayButton = ganttContainer.getByText("Aujourd'hui", {
      exact: false,
    });
    await todayButton.click();
    await page.waitForTimeout(500);

    // Header should be back near the initial state
    const afterTodayTexts = await headerBuckets.allTextContents();
    expect(afterTodayTexts).toEqual(initialTexts);
  });

  // ─── VIEW CHANGE ─────────────────────────────────────────────────────────────

  test("le changement de vue Semaine/Mois/Trimestre met a jour les buckets", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_REPORTS_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant reports:view",
    );

    await navigateToGanttPortfolio(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucun projet)");

    // The view buttons are: Jour, Semaine, Mois, Trimestre
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

    // Switch to Semaine
    await semaineButton.click();
    await page.waitForTimeout(300);
    // The active button should have the dark bg class
    await expect(semaineButton).toHaveClass(/bg-gray-800/);

    // Switch to Trimestre
    await trimestreButton.click();
    await page.waitForTimeout(300);
    await expect(trimestreButton).toHaveClass(/bg-gray-800/);

    // Switch back to Mois
    await moisButton.click();
    await page.waitForTimeout(300);
    await expect(moisButton).toHaveClass(/bg-gray-800/);
  });

  // ─── ZOOM ────────────────────────────────────────────────────────────────────

  test("le zoom +/- change la vue", async ({ page }, testInfo) => {
    test.skip(
      !ROLES_WITH_REPORTS_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant reports:view",
    );

    await navigateToGanttPortfolio(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucun projet)");

    // Start at Mois (default for portfolio)
    const moisButton = ganttContainer.getByRole("button", {
      name: "Mois",
      exact: true,
    });
    await expect(moisButton).toHaveClass(/bg-gray-800/);

    // Zoom in should switch to Semaine
    const zoomIn = ganttContainer.getByLabel("Zoom avant");
    await zoomIn.click();
    await page.waitForTimeout(300);

    const semaineButton = ganttContainer.getByRole("button", {
      name: "Semaine",
      exact: true,
    });
    await expect(semaineButton).toHaveClass(/bg-gray-800/);

    // Zoom out should switch back to Mois
    const zoomOut = ganttContainer.getByLabel("Zoom arrière");
    await zoomOut.click();
    await page.waitForTimeout(300);
    await expect(moisButton).toHaveClass(/bg-gray-800/);
  });

  // ─── ROW CLICK → NAVIGATION ─────────────────────────────────────────────────

  test("cliquer sur une ligne projet navigue vers /projects/[id]", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      "Exécuté uniquement par le role admin",
    );

    await navigateToGanttPortfolio(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucun projet)");

    // Click the first project row in the left column
    const projectRows = ganttContainer.locator('[role="row"]');
    const rowCount = await projectRows.count();
    test.skip(rowCount === 0, "Aucune ligne projet dans le Gantt");

    await projectRows.first().click();

    // Should navigate to a project detail page
    await page.waitForURL(/\/projects\//, { timeout: 10000 });
    expect(page.url()).toMatch(/\/projects\//);
  });

  // ─── LEGEND ──────────────────────────────────────────────────────────────────

  test("la legende de sante est visible avec 5 points colores", async ({
    page,
  }, testInfo) => {
    test.skip(
      !ROLES_WITH_REPORTS_ACCESS.includes(testInfo.project.name),
      "Limité aux roles ayant reports:view",
    );

    await navigateToGanttPortfolio(page);

    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    const isGanttVisible = await ganttContainer.isVisible().catch(() => false);
    test.skip(!isGanttVisible, "Pas de Gantt visible (aucun projet)");

    // The legend should show 5 health statuses
    const legendLabels = [
      "En bonne voie",
      "À risque",
      "En retard",
      "À venir",
      "Terminé",
    ];

    for (const label of legendLabels) {
      await expect(ganttContainer.getByText(label)).toBeVisible();
    }

    // 5 colored dots (rounded-full spans)
    const dots = ganttContainer.locator(
      ".rounded-full.inline-block.h-2\\.5.w-2\\.5",
    );
    await expect(dots).toHaveCount(5);
  });

  // ─── ROLES NON-AUTORISES ─────────────────────────────────────────────────────

  test("CONTRIBUTEUR ne peut pas acceder a /reports", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "contributeur",
      "Test limité au role contributeur",
    );

    await page.goto("/fr/reports");
    await page.waitForLoadState("networkidle");

    const isRedirected = page
      .url()
      .match(/\/unauthorized|\/403|\/login|\/fr\/?$/);
    const hasErrorMessage = await page
      .locator(
        "text=Accès non autorisé, text=Accès refusé, text=Forbidden, text=Non autorisé",
      )
      .isVisible()
      .catch(() => false);

    expect(
      isRedirected || hasErrorMessage,
      `CONTRIBUTEUR ne devrait pas accéder à /reports. URL: ${page.url()}`,
    ).toBeTruthy();
  });
});
