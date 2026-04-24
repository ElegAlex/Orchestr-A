/**
 * e2e/tests/workflows/activity-view.spec.ts
 *
 * Test E2E Wave 4 — Epic E5 : Vue Activité.
 *
 * Scénarios :
 * 1. Admin voit le bouton "Vue activité" et peut basculer dessus
 * 2. La grille rend les en-têtes (colonne Jour + tâches) + bouton Imprimer
 * 3. Bascule retour vers Semaine : PlanningGrid de nouveau visible
 *
 * Le composant ActivityGrid et son pivot jours × tâches sont testés
 * unitairement (9 tests Jest W4.3). L'E2E valide uniquement le gating
 * permission + la bascule viewMode.
 *
 * Rôle : admin.
 */

import { test, expect } from "@playwright/test";

test.describe("E5 — Vue Activité (bascule + rendu)", () => {
  test("Bascule semaine → activité → semaine avec gating permission", async ({
    page,
  }) => {
    await page.goto("/fr/planning");
    await expect(
      page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
    ).toBeVisible({ timeout: 10000 });

    // Le bouton "Vue activité" doit être visible pour un admin (permission planning:activity-view)
    const activityBtn = page.getByRole("button", { name: /vue activité/i });
    await expect(activityBtn).toBeVisible();
    await expect(activityBtn).toHaveAttribute("aria-pressed", "false");

    // Bascule vers Vue activité
    await activityBtn.click();
    await expect(activityBtn).toHaveAttribute("aria-pressed", "true");

    // La grille d'activité est rendue (<table>)
    const grid = page.getByRole("table");
    await expect(grid).toBeVisible();

    // Col 1 = Jour
    await expect(
      page.getByRole("columnheader", { name: /^jour$/i }).first(),
    ).toBeVisible();

    // Bouton Imprimer présent
    await expect(
      page.getByRole("button", { name: /imprimer/i }),
    ).toBeVisible();

    // Bascule retour vers Semaine
    const weekBtn = page.getByRole("button", { name: /^semaine$/i });
    await weekBtn.click();
    await expect(weekBtn).toHaveAttribute("aria-pressed", "true");
    await expect(activityBtn).toHaveAttribute("aria-pressed", "false");

    // Table activity masquée
    await expect(grid).not.toBeVisible();
  });
});
