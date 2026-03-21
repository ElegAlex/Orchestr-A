/**
 * e2e/tests/workflows/projects.spec.ts
 *
 * Tests du workflow de gestion des projets.
 *
 * Ces tests sont exécutés par les projets par rôle (admin, responsable, etc.).
 * Chaque test porte en lui-même les filtres de rôle nécessaires via test.skip().
 *
 * Rôles ayant accès aux projets : tous sauf OBSERVATEUR (qui n'a pas projects:read).
 * Rôles pouvant créer : ADMIN, RESPONSABLE, MANAGER (permission projects:create).
 * Le seed crée un projet "Projet E2E" visible pour tous les rôles autorisés.
 */

import { test, expect } from "../../fixtures/test-fixtures";

const ROLES_WITH_PROJECT_ACCESS = [
  "admin",
  "responsable",
  "manager",
  "referent",
  "contributeur",
];

const ROLES_WITH_CREATE_ACCESS = ["admin", "responsable", "manager"];

// ─── Voir la liste des projets ────────────────────────────────────────────────

test("ADMIN/MANAGER peut voir la liste des projets", async ({
  page,
}, testInfo) => {
  test.skip(
    !["admin", "manager"].includes(testInfo.project.name),
    "Test limité aux rôles admin et manager",
  );

  await page.goto("/fr/projects");
  await expect(page).toHaveURL(/\/projects/);

  // Le titre de la page est "Projets"
  await expect(
    page.getByRole("heading", { name: "Projets", level: 1 }),
  ).toBeVisible({ timeout: 10000 });
});

// ─── Le projet "Projet E2E" est visible ──────────────────────────────────────

test('le projet "Projet E2E" du seed est visible', async ({
  page,
}, testInfo) => {
  test.skip(
    !ROLES_WITH_PROJECT_ACCESS.includes(testInfo.project.name),
    "L'observateur n'a pas accès aux projets",
  );

  await page.goto("/fr/projects");

  // Attendre que les projets se chargent
  await expect(
    page.getByRole("heading", { name: "Projets", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // Le projet "Projet E2E" créé par le seed doit apparaître dans la liste
  await expect(page.getByText("Projet E2E")).toBeVisible({ timeout: 10000 });
});

// ─── ADMIN peut créer un projet ───────────────────────────────────────────────

test("ADMIN peut créer un projet via le formulaire modal", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "Exécuté uniquement par le rôle admin",
  );

  await page.goto("/fr/projects");

  // Attendre la liste des projets
  await expect(
    page.getByRole("heading", { name: "Projets", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // Cliquer sur le bouton "Créer un projet"
  const createButton = page.getByRole("button", { name: /créer un projet/i });
  await expect(createButton).toBeVisible();
  await createButton.click();

  // La modal de création doit apparaître
  await expect(
    page.getByRole("heading", { name: "Créer un projet" }),
  ).toBeVisible({ timeout: 5000 });

  // Remplir le formulaire
  const projectName = `Projet Test E2E ${Date.now()}`;
  await page.getByPlaceholder(/ex.*refonte/i).fill(projectName);

  // Dates obligatoires
  const today = new Date();
  const startDate = today.toISOString().split("T")[0];
  const endDateObj = new Date(today);
  endDateObj.setDate(endDateObj.getDate() + 30);
  const endDate = endDateObj.toISOString().split("T")[0];

  await page.locator('input[type="date"]').first().fill(startDate);
  await page.locator('input[type="date"]').last().fill(endDate);

  // Sélectionner un responsable : le <select> contenant le placeholder "-- Sélectionner --"
  const managerSelectLocator = page.locator("select").filter({
    has: page.locator("option").filter({ hasText: /sélectionner/i }),
  });
  const firstOption = managerSelectLocator
    .locator("option:not([value=''])")
    .first();
  const firstOptionValue = await firstOption.getAttribute("value");
  if (firstOptionValue) {
    await managerSelectLocator.selectOption(firstOptionValue);
  }

  // Soumettre
  const submitButton = page.getByRole("button", {
    name: "Créer le projet",
    exact: true,
  });
  await expect(submitButton).toBeVisible();
  await submitButton.click();

  // Après création, la modal se ferme et le projet apparaît dans la liste
  await expect(
    page.getByRole("heading", { name: "Créer un projet" }),
  ).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
});

// ─── CONTRIBUTEUR ne voit pas le bouton "Nouveau projet" ─────────────────────

test('CONTRIBUTEUR ne voit pas le bouton "Créer un projet"', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "contributeur",
    "Test limité au rôle contributeur",
  );

  await page.goto("/fr/projects");

  // Attendre le chargement de la page
  await expect(
    page.getByRole("heading", { name: "Projets", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // Le bouton de création ne doit pas être visible pour ce rôle
  const createButton = page.getByRole("button", { name: /créer un projet/i });
  await expect(createButton).not.toBeVisible();
});
