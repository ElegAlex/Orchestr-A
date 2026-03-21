/**
 * e2e/tests/workflows/planning.spec.ts
 *
 * Tests du workflow du planning des ressources.
 *
 * Page : /fr/planning
 * Composant : PlanningView (showFilters, showControls, showGroupHeaders, showLegend)
 * Titre i18n : "Planning des Ressources"
 *
 * Le PlanningView dispose de deux modes : "Semaine" et "Mois".
 * En mode semaine, le header affiche "Semaine du [start] au [end]".
 * En mode mois, le header affiche le mois courant.
 * Les boutons de basculement sont dans un groupe .bg-gray-100.rounded-lg.
 */

import { test, expect } from "../../fixtures/test-fixtures";

// ─── Vue planning accessible ──────────────────────────────────────────────────

test("vue planning accessible", async ({ page }) => {
  await page.goto("/fr/planning");
  await expect(page).toHaveURL(/\/planning/);

  // Le titre principal
  await expect(
    page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
  ).toBeVisible({ timeout: 10000 });
});

// ─── Vue hebdomadaire ─────────────────────────────────────────────────────────

test("vue hebdomadaire affiche les jours de la semaine", async ({ page }) => {
  await page.goto("/fr/planning");

  // Attendre le chargement du planning
  await expect(
    page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // Le bouton "Semaine" doit être visible dans les contrôles
  const weekButton = page.getByRole("button", { name: "Semaine", exact: true });
  await expect(weekButton).toBeVisible({ timeout: 10000 });

  // Cliquer sur "Semaine" pour s'assurer qu'on est en mode semaine
  await weekButton.click();

  // En mode semaine, le sous-titre affiche "Semaine du ... au ..."
  await expect(page.getByText(/semaine du/i)).toBeVisible({ timeout: 5000 });
});

// ─── Basculer entre vue semaine et mensuelle ──────────────────────────────────

test("basculer entre vue hebdomadaire et mensuelle", async ({ page }) => {
  await page.goto("/fr/planning");

  // Attendre le chargement
  await expect(
    page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // S'assurer qu'on est en mode semaine d'abord
  const weekButton = page.getByRole("button", { name: "Semaine", exact: true });
  await expect(weekButton).toBeVisible({ timeout: 10000 });
  await weekButton.click();
  await expect(page.getByText(/semaine du/i)).toBeVisible({ timeout: 5000 });

  // Basculer vers la vue mensuelle
  const monthButton = page.getByRole("button", { name: "Mois", exact: true });
  await expect(monthButton).toBeVisible();
  await monthButton.click();

  // En mode mois, le sous-titre affiche le nom du mois (ex: "mars 2026")
  // La date-fns format "MMMM yyyy" avec locale fr donne "mars 2026"
  // On vérifie qu'il n'y a plus "Semaine du" dans le sous-titre
  await expect(page.getByText(/semaine du/i)).not.toBeVisible({
    timeout: 3000,
  });

  // Le bouton "Mois" doit maintenant être mis en évidence (bg-white shadow-sm)
  await expect(monthButton).toHaveClass(/bg-white/);

  // Revenir en vue semaine
  await weekButton.click();
  await expect(page.getByText(/semaine du/i)).toBeVisible({ timeout: 5000 });
  await expect(weekButton).toHaveClass(/bg-white/);
});
