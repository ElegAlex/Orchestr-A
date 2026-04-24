/**
 * e2e/tests/workflows/predefined-tasks-weight.spec.ts
 *
 * Test E2E Wave 1 — Epic E1 : Pondération des tâches prédéfinies.
 *
 * Scénario : un admin crée une tâche prédéfinie avec weight=3 via l'UI admin,
 * vérifie qu'elle apparaît dans la liste avec le libellé "Normale", puis
 * appelle l'API pour confirmer que le backend persiste bien weight=3.
 *
 * Rôle : admin (dependency du project `admin` dans playwright.config.ts).
 * Nettoyage : la tâche test est supprimée après assertion pour idempotence.
 */

import { test, expect } from "@playwright/test";

const TASK_NAME = "Tâche test W1 weight";

test.describe("E1 — Pondération tâches prédéfinies", () => {
  test.afterEach(async ({ request }) => {
    // Nettoyage idempotent : supprimer la tâche test si elle existe
    const res = await request.get("/api/predefined-tasks");
    if (!res.ok()) return;
    const tasks = await res.json();
    const list = Array.isArray(tasks) ? tasks : (tasks?.data ?? []);
    const created = list.find((t: { name: string }) => t.name === TASK_NAME);
    if (created) {
      await request.delete(`/api/predefined-tasks/${created.id}`);
    }
  });

  test("Un admin crée une tâche avec weight=3 via l'UI et l'API la renvoie avec weight=3", async ({
    page,
    request,
  }) => {
    await page.goto("/fr/admin/predefined-tasks");

    // Ouvrir le formulaire de création
    await page
      .getByRole("button", { name: /nouvelle tâche|créer|\+ tâche/i })
      .first()
      .click();

    // Remplir le nom
    await page.getByLabel(/nom/i).first().fill(TASK_NAME);

    // Sélectionner le poids "Normale" (=3) dans le WeightInput (radiogroup)
    const weightGroup = page.getByRole("radiogroup", { name: /poids/i });
    await expect(weightGroup).toBeVisible();
    await weightGroup.getByRole("radio", { name: /normale/i }).click();

    // Le bouton radio "Normale" doit être aria-checked=true
    await expect(
      weightGroup.getByRole("radio", { name: /normale/i }),
    ).toHaveAttribute("aria-checked", "true");

    // Soumettre
    await page.getByRole("button", { name: /enregistrer|créer/i }).click();

    // Attendre le retour à la liste + la tâche visible
    await expect(page.getByText(TASK_NAME).first()).toBeVisible({
      timeout: 10000,
    });

    // Vérification API : weight=3 bien persisté
    const res = await request.get("/api/predefined-tasks");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const list = Array.isArray(json) ? json : (json?.data ?? []);
    const created = list.find((t: { name: string }) => t.name === TASK_NAME);
    expect(created).toBeDefined();
    expect(created.weight).toBe(3);
  });
});
