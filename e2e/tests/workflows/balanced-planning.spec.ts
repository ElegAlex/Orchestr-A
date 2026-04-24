/**
 * e2e/tests/workflows/balanced-planning.spec.ts
 *
 * Test E2E Wave 3 — Epic E4 : algorithme d'équilibrage.
 *
 * Scénario API end-to-end :
 * 1. Un admin crée une tâche prédéfinie + 2 règles WEEKLY sur 2 users
 * 2. Admin POST /generate-balanced mode 'preview' → assignations proposées
 * 3. Admin POST /generate-balanced mode 'apply' → assignations créées,
 *    audit BALANCER_APPLIED inséré
 * 4. Replay apply sur même plage → idempotence (assignmentsCreated=0)
 *
 * L'UI BalancedPlanningModal est couverte par les tests Jest unitaires W3.3.
 *
 * Rôle : admin.
 */

import { test, expect } from "@playwright/test";

const TASK_NAME_PREFIX = "Test balancer W3";

test.describe("E4 — Planning équilibré (API)", () => {
  const createdTaskIds: string[] = [];
  const createdRuleIds: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of createdRuleIds.splice(0)) {
      await request.delete(`/api/predefined-tasks/recurring-rules/${id}`);
    }
    for (const id of createdTaskIds.splice(0)) {
      await request.delete(`/api/predefined-tasks/${id}`);
    }
    // Cleanup éventuel des assignations générées (gérée par cascade via rule.recurringRuleId=null skipDuplicates)
  });

  test("Preview + apply + idempotence sur 2 règles WEEKLY", async ({
    request,
  }) => {
    // 1. Créer une tâche prédéfinie
    const taskName = `${TASK_NAME_PREFIX} ${Date.now()}`;
    const taskRes = await request.post("/api/predefined-tasks", {
      data: {
        name: taskName,
        color: "#3B82F6",
        icon: "⚖️",
        defaultDuration: "FULL_DAY",
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const task = await taskRes.json();
    createdTaskIds.push(task.id);

    // 2. Récupérer 2 users
    const usersRes = await request.get("/api/users?page=1&limit=5");
    const usersJson = await usersRes.json();
    const users = (usersJson.data ?? usersJson).slice(0, 2);
    expect(users.length).toBeGreaterThanOrEqual(2);
    const userIds = users.map((u: { id: string }) => u.id);

    // 3. Créer 2 règles WEEKLY (lundi + mardi) pour chaque user
    for (const userId of userIds) {
      for (const dayOfWeek of [0, 1]) {
        const ruleRes = await request.post(
          "/api/predefined-tasks/recurring-rules",
          {
            data: {
              predefinedTaskId: task.id,
              userId,
              recurrenceType: "WEEKLY",
              dayOfWeek,
              period: "FULL_DAY",
              startDate: "2026-05-01",
              endDate: "2026-05-31",
            },
          },
        );
        if (ruleRes.ok()) {
          const rule = await ruleRes.json();
          createdRuleIds.push(rule.id);
        }
      }
    }

    // 4. Preview
    const previewRes = await request.post(
      "/api/predefined-tasks/recurring-rules/generate-balanced",
      {
        data: {
          startDate: "2026-05-04",
          endDate: "2026-05-29",
          userIds,
          taskIds: [task.id],
          mode: "preview",
        },
      },
    );
    expect(previewRes.ok()).toBeTruthy();
    const preview = await previewRes.json();
    expect(preview.mode).toBe("preview");
    expect(preview.assignmentsCreated).toBe(0);
    expect(preview.proposedAssignments.length).toBeGreaterThan(0);
    expect(preview.equityRatio).toBeGreaterThanOrEqual(0);
    expect(preview.equityRatio).toBeLessThanOrEqual(1);

    // 5. Apply
    const applyRes = await request.post(
      "/api/predefined-tasks/recurring-rules/generate-balanced",
      {
        data: {
          startDate: "2026-05-04",
          endDate: "2026-05-29",
          userIds,
          taskIds: [task.id],
          mode: "apply",
        },
      },
    );
    expect(applyRes.ok()).toBeTruthy();
    const applied = await applyRes.json();
    expect(applied.mode).toBe("apply");
    expect(applied.assignmentsCreated).toBeGreaterThan(0);

    // 6. Replay apply sur même plage → idempotence via skipDuplicates
    const replayRes = await request.post(
      "/api/predefined-tasks/recurring-rules/generate-balanced",
      {
        data: {
          startDate: "2026-05-04",
          endDate: "2026-05-29",
          userIds,
          taskIds: [task.id],
          mode: "apply",
        },
      },
    );
    expect(replayRes.ok()).toBeTruthy();
    const replay = await replayRes.json();
    expect(replay.mode).toBe("apply");
    // Toutes les assignations proposées existent déjà → 0 nouvelle création
    expect(replay.assignmentsCreated).toBe(0);
  });
});
