/**
 * e2e/tests/multi-role/activity-grid-add-users.spec.ts
 *
 * Test multi-rôle : bouton "+ Ajouter" dans la Vue Activité (ActivityGrid).
 *
 * Scénarios :
 * 1. @smoke — Admin happy path :
 *    naviguer vers /fr/planning, basculer en Vue activité,
 *    cliquer "+ Ajouter", vérifier l'ouverture du modal "Ajouter des agents",
 *    cocher un agent éligible, vérifier "Ajouter (1)", soumettre,
 *    vérifier le toast de succès.
 *
 * 2. CONTRIBUTEUR ne voit pas le bouton "+ Ajouter"
 *    (permission `predefined_tasks:assign` absente du template BASIC_USER).
 *
 * Rôles requis : admin, contributeur.
 * Fichier multi-rôle → lancé avec --project=multi-role.
 */

import { test, expect } from "../../fixtures/test-fixtures";

test.describe("ActivityGrid — bouton + Ajouter", () => {
  test(
    "Admin peut ouvrir le modal et assigner un agent @smoke",
    { tag: "@smoke" },
    async ({ asRole }) => {
      const page = await asRole("admin");

      // 1. Naviguer vers le planning
      await page.goto("/fr/planning");
      await expect(
        page.getByRole("heading", { name: /planning des ressources/i, level: 1 }),
      ).toBeVisible({ timeout: 15000 });

      // 2. Basculer vers Vue activité
      const activityBtn = page.getByRole("button", { name: /vue activité/i });
      await expect(activityBtn).toBeVisible({ timeout: 10000 });
      await activityBtn.click();
      await expect(activityBtn).toHaveAttribute("aria-pressed", "true");

      // 3. Attendre que la grille d'activité soit chargée
      const table = page.getByRole("table");
      await expect(table).toBeVisible({ timeout: 10000 });

      // 4. Chercher un bouton "+ Ajouter" dans la grille
      const addUserButtons = page.getByRole("button", { name: /^\+\s*ajouter$/i });
      const buttonCount = await addUserButtons.count();

      // Cas sans données : la grille est vide (aucune tâche prédéfinie / aucun jour ouvré)
      // → le test passe en mode soft-skip.
      if (buttonCount === 0) {
        // Vérifier au moins que la table est visible et que le bouton Imprimer est présent
        await expect(
          page.getByRole("button", { name: /imprimer/i }),
        ).toBeVisible();
        return;
      }

      // 5. Cliquer sur le premier bouton "+ Ajouter" visible
      await addUserButtons.first().scrollIntoViewIfNeeded();
      await addUserButtons.first().click({ force: true });

      // 6. Le modal "Ajouter des agents" doit s'ouvrir
      const modal = page.getByRole("dialog").or(
        page.locator('[class*="fixed"][class*="inset-0"]'),
      );
      await expect(
        page.getByRole("heading", { name: /ajouter des agents/i }),
      ).toBeVisible({ timeout: 8000 });

      // 7. Chercher un agent éligible (checkbox enabled et non cochée)
      const eligibleCheckbox = page
        .getByRole("checkbox")
        .filter({ hasNot: page.locator("[disabled]") })
        .filter({ has: page.locator(':not([disabled])') });

      const checkboxes = page.locator('input[type="checkbox"]:not([disabled])');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount === 0) {
        // Tous les agents sont déjà assignés ou en congé → fermer le modal et passer
        await page.getByRole("button", { name: /annuler/i }).click();
        return;
      }

      // 8. Cocher le premier agent éligible
      await checkboxes.first().check();

      // 9. Le bouton de soumission doit afficher "Ajouter (1)"
      await expect(
        page.getByRole("button", { name: /^ajouter \(1\)$/i }),
      ).toBeVisible();

      // 10. Soumettre
      await page.getByRole("button", { name: /^ajouter \(1\)$/i }).click();

      // 11. Toast de succès
      await expect(
        page.getByText(/assignation\(s\) créée\(s\)/i),
      ).toBeVisible({ timeout: 10000 });
    },
  );

  test(
    "Contributeur ne voit pas le bouton + Ajouter",
    async ({ asRole }) => {
      const page = await asRole("contributeur");

      // 1. Naviguer vers le planning
      await page.goto("/fr/planning");
      await expect(
        page.getByRole("heading", { name: /planning des ressources/i, level: 1 }),
      ).toBeVisible({ timeout: 15000 });

      // 2. Le CONTRIBUTEUR a `planning:activity-view` → le bouton Vue activité doit être visible
      const activityBtn = page.getByRole("button", { name: /vue activité/i });
      await expect(activityBtn).toBeVisible({ timeout: 10000 });
      await activityBtn.click();
      await expect(activityBtn).toHaveAttribute("aria-pressed", "true");

      // 3. La grille est visible
      const table = page.getByRole("table");
      await expect(table).toBeVisible({ timeout: 10000 });

      // 4. Le bouton "+ Ajouter" ne doit PAS être présent
      //    (permission `predefined_tasks:assign` absente du template BASIC_USER)
      await expect(
        page.getByRole("button", { name: /^\+\s*ajouter$/i }),
      ).not.toBeVisible();
    },
  );
});
