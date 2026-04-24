/**
 * e2e/tests/workflows/assignment-completion-status.spec.ts
 *
 * Test E2E Wave 2 — Epic E3.1 : transitions de statut d'exécution via API.
 *
 * L'UI (AssignmentStatusBadge + popover) est reportée (W2.5, gated sur mockup
 * PO). Cet E2E valide le contrat API + la persistance audit côté backend :
 *
 * - Un admin crée une assignation
 * - L'admin PATCH /completion avec status=DONE → 200, completedAt/By set
 * - L'admin PATCH /completion avec status=IN_PROGRESS (transition invalide
 *   depuis DONE) → 409 Conflict
 * - Un status invalide (ex: FOO) → 400
 *
 * Rôle : admin.
 */

import { test, expect } from "@playwright/test";

const TASK_NAME_PREFIX = "Test completion W2";

test.describe("E3.1 — Statut d'exécution (API)", () => {
  let createdTaskId: string | null = null;
  let createdAssignmentId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (createdAssignmentId) {
      await request.delete(
        `/api/predefined-tasks/assignments/${createdAssignmentId}`,
      );
      createdAssignmentId = null;
    }
    if (createdTaskId) {
      await request.delete(`/api/predefined-tasks/${createdTaskId}`);
      createdTaskId = null;
    }
  });

  test("PATCH /completion transitions valides + invalides + status invalide", async ({
    request,
  }) => {
    // 1. Créer une tâche prédéfinie
    const taskName = `${TASK_NAME_PREFIX} ${Date.now()}`;
    const taskRes = await request.post("/api/predefined-tasks", {
      data: {
        name: taskName,
        color: "#10B981",
        icon: "✅",
        defaultDuration: "FULL_DAY",
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const task = await taskRes.json();
    createdTaskId = task.id;

    // 2. Récupérer un user
    const usersRes = await request.get("/api/users?page=1&limit=1");
    const usersJson = await usersRes.json();
    const userId = (usersJson.data ?? usersJson)[0]?.id;

    // 3. Créer une assignation NOT_DONE (default)
    const assignRes = await request.post(
      "/api/predefined-tasks/assignments",
      {
        data: {
          predefinedTaskId: createdTaskId,
          userId,
          date: "2026-04-24",
          period: "FULL_DAY",
        },
      },
    );
    expect(assignRes.ok()).toBeTruthy();
    const assignment = await assignRes.json();
    createdAssignmentId = assignment.id;

    // 4. Transition valide NOT_DONE → DONE
    const doneRes = await request.patch(
      `/api/predefined-tasks/assignments/${createdAssignmentId}/completion`,
      { data: { status: "DONE" } },
    );
    expect(doneRes.ok()).toBeTruthy();
    const updated = await doneRes.json();
    expect(updated.completionStatus).toBe("DONE");
    expect(updated.completedAt).toBeTruthy();
    expect(updated.completedById).toBeTruthy();

    // 5. Transition invalide DONE → IN_PROGRESS (409 Conflict attendu)
    const conflictRes = await request.patch(
      `/api/predefined-tasks/assignments/${createdAssignmentId}/completion`,
      { data: { status: "IN_PROGRESS" } },
    );
    expect(conflictRes.status()).toBe(409);

    // 6. Status invalide → 400
    const badRes = await request.patch(
      `/api/predefined-tasks/assignments/${createdAssignmentId}/completion`,
      { data: { status: "BOGUS" } },
    );
    expect(badRes.status()).toBe(400);

    // 7. NOT_APPLICABLE sans reason → 400 (DTO ValidateIf)
    const missingReasonRes = await request.patch(
      `/api/predefined-tasks/assignments/${createdAssignmentId}/completion`,
      { data: { status: "NOT_APPLICABLE" } },
    );
    expect(missingReasonRes.status()).toBe(400);

    // 8. NOT_APPLICABLE avec reason >= 3 chars → 200
    const okReasonRes = await request.patch(
      `/api/predefined-tasks/assignments/${createdAssignmentId}/completion`,
      { data: { status: "NOT_APPLICABLE", reason: "Agent absent" } },
    );
    expect(okReasonRes.ok()).toBeTruthy();
    const finalUpdate = await okReasonRes.json();
    expect(finalUpdate.completionStatus).toBe("NOT_APPLICABLE");
    expect(finalUpdate.notApplicableReason).toBe("Agent absent");
  });
});
