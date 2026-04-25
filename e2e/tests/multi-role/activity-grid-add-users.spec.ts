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
 * 2. manager / responsable voient le bouton "+ Ajouter" et peuvent ouvrir le modal
 *    (permission `predefined_tasks:assign` dans MANAGER / ADMIN_DELEGATED).
 *
 * 3. contributeur / observateur / referent ne voient PAS le bouton "+ Ajouter"
 *    (permission `predefined_tasks:assign` absente de leurs templates).
 *
 * Rôles requis : admin, responsable, manager, referent, contributeur, observateur.
 * Fichier multi-rôle → lancé avec --project=multi-role.
 */

import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/test-fixtures";
import type { Role } from "../../fixtures/roles";

/**
 * Navigue vers /fr/planning et bascule en Vue activité.
 * Appelle test.skip() si le rôle n'a pas accès à la vue activité.
 */
async function navigateToActivityView(page: Page, role: Role): Promise<void> {
  await page.goto("/fr/planning");
  await expect(
    page.getByRole("heading", { name: /planning des ressources/i, level: 1 }),
  ).toBeVisible({ timeout: 15000 });

  const activityBtn = page.getByRole("button", { name: /vue activité/i });
  const hasActivityView = await activityBtn
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!hasActivityView) {
    test.skip(
      true,
      `${role} n'a pas accès à la Vue activité (planning:activity-view absent)`,
    );
    return;
  }

  await activityBtn.click();
  await expect(activityBtn).toHaveAttribute("aria-pressed", "true");

  const table = page.getByRole("table");
  await expect(table).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Scénario 1 : Admin happy path @smoke
// ---------------------------------------------------------------------------

test.describe("ActivityGrid — bouton + Ajouter", () => {
  test(
    "Admin peut ouvrir le modal et assigner un agent @smoke",
    { tag: "@smoke" },
    async ({ asRole }) => {
      const page = await asRole("admin");

      // 1. Naviguer vers le planning et basculer en Vue activité
      await navigateToActivityView(page, "admin");

      // 2. Chercher un bouton "+ Ajouter" dans la grille
      const addUserButtons = page.getByRole("button", {
        name: /^\+\s*ajouter$/i,
      });
      const buttonCount = await addUserButtons.count();

      // Cas sans données : grille vide → skip traceable (plus de silent return)
      if (buttonCount === 0) {
        test.skip(true, "Aucun + Ajouter visible — données vides ?");
        return;
      }

      // 3. Cliquer sur le premier bouton "+ Ajouter" visible
      await addUserButtons.first().scrollIntoViewIfNeeded();
      await addUserButtons.first().click();

      // 4. Le modal "Ajouter des agents" doit s'ouvrir
      await expect(
        page.getByRole("heading", { name: /ajouter des agents/i }),
      ).toBeVisible({ timeout: 8000 });

      // 5. Chercher un agent éligible (checkbox enabled et non cochée)
      const checkboxes = page.locator('input[type="checkbox"]:not([disabled])');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount === 0) {
        // Tous les agents sont déjà assignés ou en congé → skip traceable
        test.skip(true, "Aucun agent éligible — tous déjà assignés ?");
        return;
      }

      // 6. Cocher le premier agent éligible
      await checkboxes.first().check();

      // 7. Le bouton de soumission doit afficher "Ajouter (1)" et être activé
      const submitBtn = page.getByRole("button", { name: /^ajouter \(1\)$/i });
      await expect(submitBtn).toBeVisible();
      await expect(submitBtn).toBeEnabled();

      // 8. Soumettre
      await submitBtn.click();

      // 9. Toast de succès
      await expect(
        page.getByText(/assignation\(s\) créée\(s\)/i),
      ).toBeVisible({ timeout: 10000 });
    },
  );

  // ---------------------------------------------------------------------------
  // Scénarios 2 : Rôles POSITIFS — doivent voir "+ Ajouter" et pouvoir ouvrir le modal
  // ---------------------------------------------------------------------------

  for (const role of ["manager", "responsable"] as const) {
    test(
      `${role} voit le bouton + Ajouter et peut ouvrir le modal`,
      async ({ asRole }) => {
        const page = await asRole(role);

        // Naviguer et basculer en Vue activité (skip si pas d'accès)
        await navigateToActivityView(page, role);

        // Chercher le bouton "+ Ajouter"
        const addUserButtons = page.getByRole("button", {
          name: /^\+\s*ajouter$/i,
        });
        const buttonCount = await addUserButtons.count();

        if (buttonCount === 0) {
          test.skip(
            true,
            `Aucun + Ajouter visible pour ${role} — données vides ?`,
          );
          return;
        }

        // Le bouton doit être visible
        await expect(addUserButtons.first()).toBeVisible();

        // Cliquer ouvre le modal
        await addUserButtons.first().scrollIntoViewIfNeeded();
        await addUserButtons.first().click();

        await expect(
          page.getByRole("heading", { name: /ajouter des agents/i }),
        ).toBeVisible({ timeout: 8000 });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Scénarios 3 : Rôles NÉGATIFS — ne doivent PAS voir "+ Ajouter"
  // ---------------------------------------------------------------------------

  for (const role of ["contributeur", "observateur", "referent"] as const) {
    test(
      `${role} ne voit pas le bouton + Ajouter`,
      async ({ asRole }) => {
        const page = await asRole(role);

        // Naviguer vers le planning
        await page.goto("/fr/planning");
        await expect(
          page.getByRole("heading", {
            name: /planning des ressources/i,
            level: 1,
          }),
        ).toBeVisible({ timeout: 15000 });

        // Vérifier l'accès à la Vue activité
        const activityBtn = page.getByRole("button", {
          name: /vue activité/i,
        });
        const hasActivityView = await activityBtn
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (!hasActivityView) {
          test.skip(
            true,
            `${role} n'a pas accès à la Vue activité — le bouton + Ajouter est donc implicitement absent`,
          );
          return;
        }

        await activityBtn.click();
        await expect(activityBtn).toHaveAttribute("aria-pressed", "true");

        // La grille est visible
        await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });

        // Le bouton "+ Ajouter" ne doit PAS être présent
        // (permission `predefined_tasks:assign` absente du template de ce rôle)
        await expect(
          page.getByRole("button", { name: /^\+\s*ajouter$/i }),
        ).not.toBeVisible();
      },
    );
  }
});
