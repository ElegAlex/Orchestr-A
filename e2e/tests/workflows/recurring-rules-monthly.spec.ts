/**
 * e2e/tests/workflows/recurring-rules-monthly.spec.ts
 *
 * Test E2E Wave 2 — Epic E2 : récurrence mensuelle.
 *
 * Scénario : via l'API, créer une règle MONTHLY_DAY, déclencher la génération
 * d'occurrences sur une plage, vérifier le nombre d'assignations créées.
 *
 * L'UI de création de règle (RecurringRulesModal W2.3) est couverte par les
 * tests Jest unitaires. Ici on valide le contrat end-to-end API avec un jeu
 * de données isolé (nettoyé en afterEach).
 *
 * Rôle : admin.
 */

import { test, expect } from "@playwright/test";

const TASK_NAME_PREFIX = "Test MONTHLY_DAY W2";

test.describe("E2 — Récurrence mensuelle (API)", () => {
  let createdTaskId: string | null = null;
  let createdRuleId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (createdRuleId) {
      await request.delete(`/api/predefined-tasks/recurring-rules/${createdRuleId}`);
      createdRuleId = null;
    }
    if (createdTaskId) {
      await request.delete(`/api/predefined-tasks/${createdTaskId}`);
      createdTaskId = null;
    }
  });

  test("Créer règle MONTHLY_DAY et générer 3 occurrences sur 3 mois", async ({
    request,
  }) => {
    // 1. Créer une tâche prédéfinie
    const taskName = `${TASK_NAME_PREFIX} ${Date.now()}`;
    const taskRes = await request.post("/api/predefined-tasks", {
      data: {
        name: taskName,
        color: "#3B82F6",
        icon: "📅",
        defaultDuration: "FULL_DAY",
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const task = await taskRes.json();
    createdTaskId = task.id;

    // 2. Récupérer un user (premier user actif)
    const usersRes = await request.get("/api/users?page=1&limit=1");
    expect(usersRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const userId = (usersJson.data ?? usersJson)[0]?.id;
    expect(userId).toBeDefined();

    // 3. Créer une règle MONTHLY_DAY, jour 15, plage 2026-05-01 → 2026-07-31
    const ruleRes = await request.post(
      "/api/predefined-tasks/recurring-rules",
      {
        data: {
          predefinedTaskId: createdTaskId,
          userId,
          recurrenceType: "MONTHLY_DAY",
          monthlyDayOfMonth: 15,
          period: "FULL_DAY",
          startDate: "2026-05-01",
          endDate: "2026-07-31",
        },
      },
    );
    expect(ruleRes.ok()).toBeTruthy();
    const rule = await ruleRes.json();
    createdRuleId = rule.id;
    expect(rule.recurrenceType).toBe("MONTHLY_DAY");
    expect(rule.monthlyDayOfMonth).toBe(15);

    // 4. Déclencher generateFromRules
    const genRes = await request.post(
      "/api/predefined-tasks/recurring-rules/generate",
      {
        data: { startDate: "2026-05-01", endDate: "2026-07-31" },
      },
    );
    expect(genRes.ok()).toBeTruthy();
    const genResult = await genRes.json();
    expect(genResult.created).toBeGreaterThanOrEqual(3);

    // 5. Vérifier les 3 assignations aux dates attendues (15 mai, 15 juin, 15 juillet)
    const assignmentsRes = await request.get(
      `/api/predefined-tasks/assignments?startDate=2026-05-01&endDate=2026-07-31&predefinedTaskId=${createdTaskId}`,
    );
    expect(assignmentsRes.ok()).toBeTruthy();
    const assignmentsJson = await assignmentsRes.json();
    const list = assignmentsJson.data ?? assignmentsJson;
    const dates = list.map((a: { date: string }) => a.date.slice(0, 10));
    expect(dates).toEqual(
      expect.arrayContaining(["2026-05-15", "2026-06-15", "2026-07-15"]),
    );
  });
});
