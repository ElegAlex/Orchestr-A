/**
 * e2e/tests/gantt/gantt-project.spec.ts
 *
 * Tests E2E du Gantt Projet sur la page /projects/[id] (onglet "Gantt").
 *
 * Le Gantt Projet affiche les taches et jalons d'un projet sur une timeline.
 * Un beforeAll provisionne les dates start/end sur les taches E2E via l'API admin,
 * garantissant que le Gantt est toujours rendu — independamment de la forme du seed.
 *
 * Exécuté par les projets par role (admin, responsable, etc.).
 * Chaque test filtre les roles autorisés via test.skip().
 */

import * as fs from "fs";
import { test, expect, request as newRequest } from "@playwright/test";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

const ROLES_WITH_PROJECT_ACCESS = [
  "admin",
  "responsable",
  "manager",
  "referent",
  "contributeur",
];

// ─── Auth helpers (admin token, read from storage state) ─────────────────────

function getToken(role: Role): string {
  const storagePath = ROLE_STORAGE_PATHS[role];
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ─── Provision fixture ────────────────────────────────────────────────────────

/**
 * Module-level state provisioned once per worker by beforeAll.
 * The admin adds startDate/endDate on the 3 E2E tasks so the Gantt renders.
 */
let provisionedProjectId: string | null = null;

test.beforeAll(async () => {
  // Route API calls through the app baseURL (web proxy → API). The API does not
  // listen on a fixed :3001 in CI (it is on :4000, reached via the :3000 web
  // proxy), so a hardcoded :3001 → ECONNREFUSED. baseURL resolves to :3000 in
  // CI and :4001 locally.
  const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
  const token = getToken("admin");
  const headers = authHeaders(token);

  const req = await newRequest.newContext({ baseURL });

  try {
    // 1. Find the "Projet E2E"
    const projectsRes = await req.get("/api/projects", { headers });
    if (!projectsRes.ok()) {
      throw new Error(
        `GET /api/projects failed: ${projectsRes.status()} ${await projectsRes.text()}`,
      );
    }
    const projectsBody = await projectsRes.json();
    // The endpoint may return an array or a paginated object
    const projectsList: Array<{ id: string; name: string }> = Array.isArray(
      projectsBody,
    )
      ? projectsBody
      : (projectsBody.data ?? projectsBody.items ?? []);

    const e2eProject = projectsList.find((p) => p.name === "Projet E2E");
    if (!e2eProject) {
      throw new Error(
        "Provisioning failed: 'Projet E2E' not found — run pnpm db:seed with E2E_SEED=true",
      );
    }
    provisionedProjectId = e2eProject.id;

    // 2. Get the tasks for this project
    const tasksRes = await req.get(`/api/tasks/project/${e2eProject.id}`, {
      headers,
    });
    if (!tasksRes.ok()) {
      throw new Error(
        `GET /api/tasks/project/${e2eProject.id} failed: ${tasksRes.status()}`,
      );
    }
    const tasksBody = await tasksRes.json();
    const tasks: Array<{ id: string; title: string }> = Array.isArray(tasksBody)
      ? tasksBody
      : (tasksBody.data ?? tasksBody.items ?? []);

    // 3. PATCH each task to add startDate/endDate (idempotent)
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(today.getDate() + 7);
    const startDate = today.toISOString().split("T")[0];
    const endDate = weekLater.toISOString().split("T")[0];

    for (const task of tasks) {
      const patchRes = await req.patch(`/api/tasks/${task.id}`, {
        headers,
        data: { startDate, endDate },
      });
      // 200 OK or 204 — accept both
      if (patchRes.status() >= 300) {
        throw new Error(
          `PATCH /api/tasks/${task.id} failed: ${patchRes.status()} ${await patchRes.text()}`,
        );
      }
    }
  } finally {
    await req.dispose();
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to the provisioned E2E project's Gantt tab.
 * Falls back to the first available project link if provisioning data is absent.
 */
async function navigateToProjectGantt(
  page: import("@playwright/test").Page,
): Promise<void> {
  if (provisionedProjectId) {
    await page.goto(`/fr/projects/${provisionedProjectId}`);
  } else {
    await page.goto("/fr/projects");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Projets", level: 1 }),
    ).toBeVisible({ timeout: 10000 });
    const projectLink = page.locator('a[href*="/projects/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });
    await projectLink.click();
  }

  // Wait for the project detail page to load
  await page.waitForURL(/\/projects\//, { timeout: 10000 });

  // Click the Gantt tab
  const ganttTab = page.getByRole("button", { name: /gantt/i });
  await expect(ganttTab).toBeVisible({ timeout: 10000 });
  await ganttTab.click();

  // Wait for the Gantt to render
  await page.waitForTimeout(1000);
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

    // With provisioned dated tasks, the Gantt container must be visible
    const ganttContainer = page.locator(
      '[role="grid"][aria-label="Diagramme de Gantt"]',
    );
    await expect(
      ganttContainer,
      "Le Gantt doit etre visible apres provisionnement des taches avec dates",
    ).toBeVisible({ timeout: 10000 });
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
    await expect(ganttContainer).toBeVisible({ timeout: 10000 });

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
    await expect(ganttContainer).toBeVisible({ timeout: 10000 });

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
    await expect(ganttContainer).toBeVisible({ timeout: 10000 });

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
    await expect(ganttContainer).toBeVisible({ timeout: 10000 });

    // Ensure groupBy is "milestone" (default)
    const groupBySelect = ganttContainer.locator("select");
    await expect(groupBySelect).toBeVisible();
    await groupBySelect.selectOption("milestone");
    await page.waitForTimeout(300);

    // Find group headers (they have aria-expanded attribute)
    const groupHeaders = ganttContainer.locator('[role="row"][aria-expanded]');
    await expect(groupHeaders).not.toHaveCount(0);

    const firstHeader = groupHeaders.first();

    // Initially expanded
    await expect(firstHeader).toHaveAttribute("aria-expanded", "true");

    // Count visible task rows before collapse
    const allRows = ganttContainer.locator('[role="row"]:not([aria-expanded])');
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
    await expect(ganttContainer).toBeVisible({ timeout: 10000 });

    // Find task rows (not group headers — no aria-expanded attribute)
    const taskRows = ganttContainer.locator(
      '[role="row"]:not([aria-expanded])',
    );
    await expect(taskRows).not.toHaveCount(0);

    // Double-click the first task row
    await taskRows.first().dblclick();

    // The dependency modal should appear (TaskDependencyModal)
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
