/**
 * e2e/tests/workflows/planning-external-task.spec.ts
 *
 * Régression bug "tâche externe sans visuel rouge dans le planning".
 *
 * Cause racine : l'endpoint /planning/overview (TasksService.findForPlanningOverview)
 * utilise un `select` Prisma explicite qui omettait `isExternalIntervention`. Le
 * front recevait donc `undefined` (falsy) et DayCell rendait la tâche comme une
 * tâche normale au lieu de la carte rouge `border-red-400`.
 *
 * Ce test crée une tâche externe assignée à un utilisateur visible du planning,
 * sur le lundi de la semaine courante (toujours dans les jours visibles Lun–Ven),
 * puis vérifie que la carte porte bien le visuel externe rouge. Avant le correctif
 * du select, l'assertion `border-red-400` échoue ; après, elle passe.
 *
 * Projet : admin (storageState admin.json — auth via API, jamais via l'UI).
 */

import { test, expect } from "../../fixtures/test-fixtures";

interface OverviewUser {
  id: string;
  isActive?: boolean;
  userServices?: unknown[];
}

// Lundi (12:00 local) de la semaine courante — toujours un jour visible du planning.
function currentMondayNoon(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche … 6 = samedi
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(12, 0, 0, 0);
  return monday;
}

test.describe("Planning — visuel tâche externe", () => {
  let createdTaskId: string | null = null;
  let authHeaders: Record<string, string> = {};

  test.afterEach(async ({ page }) => {
    // Nettoyage : supprimer la tâche créée pour ne pas polluer le planning.
    if (createdTaskId) {
      await page.request
        .delete(`/api/tasks/${createdTaskId}`, { headers: authHeaders })
        .catch(() => {});
      createdTaskId = null;
    }
  });

  test("une tâche externe s'affiche avec le visuel rouge dans le planning @smoke", async ({
    page,
  }, testInfo) => {
    // Le visuel externe est indépendant du rôle : on l'exerce une fois en ADMIN
    // (qui a les droits de création de tâche orpheline + assignation cross-user).
    test.skip(
      testInfo.project.name !== "admin",
      "Scénario création/rendu exécuté uniquement sous le projet admin",
    );

    // 1. Charger l'app pour récupérer le JWT injecté dans localStorage (storageState).
    await page.goto("/fr/planning");
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    );
    expect(token, "JWT admin présent dans localStorage").toBeTruthy();
    authHeaders = { Authorization: `Bearer ${token}` };

    const monday = currentMondayNoon();
    const mondayISO = monday.toISOString();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // 2. Trouver un utilisateur réellement rendu dans la grille : on réplique
    //    exactement le filtre serveur (actif + au moins un service).
    const overviewRes = await page.request.get(
      `/api/planning/overview?startDate=${mondayISO}&endDate=${sunday.toISOString()}`,
      { headers: authHeaders },
    );
    expect(overviewRes.ok(), "GET /planning/overview OK").toBeTruthy();
    const overview = await overviewRes.json();
    const visibleUser = (overview.users as OverviewUser[]).find(
      (u) =>
        u?.isActive !== false &&
        Array.isArray(u?.userServices) &&
        u.userServices.length > 0,
    );
    expect(
      visibleUser,
      "au moins un utilisateur visible (actif + service) dans le planning",
    ).toBeTruthy();

    // 3. Créer la tâche externe assignée à cet utilisateur, sur le lundi courant.
    const title = `E2E-EXT-${Date.now()}`;
    const createRes = await page.request.post(`/api/tasks`, {
      headers: authHeaders,
      data: {
        title,
        status: "TODO",
        priority: "NORMAL",
        projectId: null,
        assigneeIds: [visibleUser!.id],
        startDate: mondayISO,
        endDate: mondayISO,
        isExternalIntervention: true,
      },
    });
    expect(
      createRes.ok(),
      `POST /tasks OK (${createRes.status()})`,
    ).toBeTruthy();
    const created = await createRes.json();
    createdTaskId = created.id as string;
    expect(created.isExternalIntervention).toBe(true);

    // 4. Recharger le planning (semaine courante, contient le lundi) et localiser
    //    la carte de la tâche. La carte porte la classe `cursor-move`.
    await page.goto("/fr/planning");
    await expect(
      page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
    ).toBeVisible({ timeout: 15000 });

    const card = page.locator("div.cursor-move").filter({ hasText: title });
    await expect(card.first()).toBeVisible({ timeout: 15000 });

    // 5. Assertion clé : la carte porte le visuel externe rouge (régression).
    await expect(card.first()).toHaveClass(/border-red-400/);
  });
});
