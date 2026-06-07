/**
 * e2e/tests/workflows/planning-half-day-leave.spec.ts
 *
 * Vérifie le rendu demi-journée d'un congé dans la grille planning :
 * un congé MORNING (validé) occupe la moitié haute de la cellule, et une
 * tâche du même jour reste visible (moitié basse). Régression de la feature
 * "visuel demi-journée des congés".
 */

import { test, expect } from "../../fixtures/test-fixtures";
import { runOnceUnderAdmin } from "../../fixtures/run-once";

// Creates + approves a half-day leave then renders the planning via the
// project-role `page`. Per-role re-runs collide on the approved leave (and
// non-admin roles can't approve) — run once under admin.
runOnceUnderAdmin(test, "half-day leave planning render");

interface OverviewUser {
  id: string;
  isActive?: boolean;
  userServices?: unknown[];
}

function currentMondayNoon(): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(12, 0, 0, 0);
  return monday;
}

test.describe("Planning — congé demi-journée", () => {
  let createdTaskId: string | null = null;
  let createdLeaveId: string | null = null;
  let authHeaders: Record<string, string> = {};

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      await page.request
        .delete(`/api/tasks/${createdTaskId}`, { headers: authHeaders })
        .catch(() => {});
      createdTaskId = null;
    }
    if (createdLeaveId) {
      await page.request
        .delete(`/api/leaves/${createdLeaveId}`, { headers: authHeaders })
        .catch(() => {});
      createdLeaveId = null;
    }
  });

  test("un congé du matin occupe la moitié haute et laisse la tâche visible @smoke", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      "Scénario création/rendu exécuté uniquement sous le projet admin",
    );

    await page.goto("/fr/planning");
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    );
    expect(token, "JWT admin présent").toBeTruthy();
    authHeaders = { Authorization: `Bearer ${token}` };

    const monday = currentMondayNoon();
    const mondayISO = monday.toISOString();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // 1. Utilisateur visible dans le planning (actif + service) — même filtre serveur.
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
    expect(visibleUser, "au moins un utilisateur visible").toBeTruthy();

    // 2. Type de congé OTHER (pas de jauge de solde → 201 inconditionnel).
    const typesRes = await page.request.get(`/api/leave-types`, {
      headers: authHeaders,
    });
    expect(typesRes.ok(), "GET /leave-types OK").toBeTruthy();
    const types = (await typesRes.json()) as { id: string; code: string }[];
    const otherType = types.find((t) => t.code === "OTHER");
    expect(otherType, "type de congé OTHER présent").toBeTruthy();

    // 3. Déclarer un congé MORNING pour l'utilisateur visible, puis l'approuver
    //    (APPROVED = validé = toujours affiché, indépendant du filtre "en attente").
    const leaveRes = await page.request.post(`/api/leaves`, {
      headers: authHeaders,
      data: {
        leaveTypeId: otherType!.id,
        targetUserId: visibleUser!.id,
        startDate: mondayISO,
        endDate: mondayISO,
        halfDay: "MORNING",
        reason: "E2E half-day",
      },
    });
    expect(
      leaveRes.ok(),
      `POST /leaves OK (${leaveRes.status()})`,
    ).toBeTruthy();
    const createdLeave = (await leaveRes.json()) as {
      id: string;
      status: string;
    };
    createdLeaveId = createdLeave.id;

    // An admin creating a leave FOR another user (targetUserId) with
    // leaves:manage_any lands it APPROVED directly — approving it again would be
    // 400 (not PENDING). Only approve when it's still pending.
    const approveRes =
      createdLeave.status === "APPROVED"
        ? null
        : await page.request.post(
            `/api/leaves/${createdLeaveId}/approve`,
            // data:{} — approve takes no payload, but the JSON Content-Type in
            // authHeaders makes Fastify reject an empty body.
            { headers: authHeaders, data: {} },
          );
    if (approveRes) {
      expect(
        approveRes.ok(),
        `approve OK (${approveRes.status()})`,
      ).toBeTruthy();
    }

    // 4. Une tâche le même jour, assignée au même utilisateur.
    const title = `E2E-HALF-${Date.now()}`;
    const taskRes = await page.request.post(`/api/tasks`, {
      headers: authHeaders,
      data: {
        title,
        status: "TODO",
        priority: "NORMAL",
        projectId: null,
        assigneeIds: [visibleUser!.id],
        startDate: mondayISO,
        endDate: mondayISO,
      },
    });
    expect(taskRes.ok(), `POST /tasks OK (${taskRes.status()})`).toBeTruthy();
    createdTaskId = (await taskRes.json()).id as string;

    // 5. Charger le planning et vérifier.
    await page.goto("/fr/planning");
    await expect(
      page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
    ).toBeVisible({ timeout: 15000 });

    // La tâche reste visible (la moitié libre montre le travail).
    const card = page.locator("div.cursor-move").filter({ hasText: title });
    await expect(card.first()).toBeVisible({ timeout: 15000 });

    // L'overlay congé demi-journée est en moitié haute (classes h-1/2 + top-0 + z-20).
    const morningOverlay = page.locator('div.h-1\\/2.top-0[class*="z-20"]');
    await expect(morningOverlay.first()).toBeVisible({ timeout: 10000 });
  });
});
