/**
 * V6-A Spec 2 — Dashboard Undeclared tasks : checkbox dismissal
 *
 * Scénario (D8) : une tâche DONE assignée à un CONTRIBUTEUR sans déclaration
 * apparaît dans la sous-section "Mes tâches non déclarées" du dashboard.
 * Cocher la checkbox déclenche timeTrackingService.createDismissal (=
 * POST /time-tracking avec isDismissal:true, hours:0) puis la ligne
 * disparaît optimiste (onDismissalSuccess).
 *
 * Fixtures API :
 *   - 1 projet (admin)
 *   - 1 tâche assignée contributeur, créée en IN_PROGRESS puis patch DONE
 *     (un flow via endpoint /tasks/:id/transition peut différer ; on utilise
 *     PATCH classique qui accepte `status: 'DONE'`).
 *
 * @smoke
 */

import * as fs from "fs";
import * as path from "path";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readStorage(role: Role) {
  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Storage state not found for role "${role}" at ${storagePath}. Run auth.setup first.`,
    );
  }
  return JSON.parse(fs.readFileSync(storagePath, "utf-8"));
}

function getToken(role: Role): string {
  const storage = readStorage(role);
  const tokenEntry = storage.origins?.[0]?.localStorage?.find(
    (i: { name: string; value: string }) => i.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
}

function getUserId(role: Role): string {
  const storage = readStorage(role);
  const userEntry = storage.origins?.[0]?.localStorage?.find(
    (i: { name: string; value: string }) => i.name === "user",
  );
  if (!userEntry?.value) {
    throw new Error(`No user in storage state for role "${role}"`);
  }
  return (JSON.parse(userEntry.value) as { id: string }).id;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function authHeadersNoContentType(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function createProjectViaAdmin(
  request: APIRequestContext,
  baseURL: string,
  adminToken: string,
  name: string,
) {
  const res = await request.post(`${baseURL}/api/projects`, {
    headers: authHeaders(adminToken),
    data: {
      name,
      description: "E2E V6-A dismissal",
      status: "ACTIVE",
      startDate: "2026-04-01T00:00:00Z",
      endDate: "2026-12-31T00:00:00Z",
    },
  });
  expect(res.status(), `createProject ${name}`).toBe(201);
  return (await res.json()) as { id: string; name: string };
}

async function createTaskAssignedTo(
  request: APIRequestContext,
  baseURL: string,
  adminToken: string,
  title: string,
  projectId: string,
  assigneeId: string,
) {
  const res = await request.post(`${baseURL}/api/tasks`, {
    headers: authHeaders(adminToken),
    data: {
      title,
      projectId,
      status: "IN_PROGRESS",
      priority: "NORMAL",
      assigneeId,
    },
  });
  expect(res.status(), `createTask ${title}`).toBe(201);
  return (await res.json()) as { id: string };
}

async function setTaskDone(
  request: APIRequestContext,
  baseURL: string,
  adminToken: string,
  taskId: string,
) {
  const res = await request.patch(`${baseURL}/api/tasks/${taskId}`, {
    headers: authHeaders(adminToken),
    data: { status: "DONE" },
  });
  expect(res.status(), `patch DONE ${taskId}`).toBeLessThan(300);
}

async function deleteTask(
  request: APIRequestContext,
  baseURL: string,
  adminToken: string,
  taskId: string,
) {
  await request.delete(`${baseURL}/api/tasks/${taskId}`, {
    headers: authHeadersNoContentType(adminToken),
  });
}

async function deleteProject(
  request: APIRequestContext,
  baseURL: string,
  adminToken: string,
  projectId: string,
) {
  await request.delete(`${baseURL}/api/projects/${projectId}`, {
    headers: authHeadersNoContentType(adminToken),
  });
}

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  ".claude-screenshots",
  "dashboard-my-tasks",
);
function screenshotPath(name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  return path.join(SCREENSHOT_DIR, name);
}

// ─── Spec ─────────────────────────────────────────────────────────────────────

test.describe("@smoke Dashboard - Dismissal checkbox", () => {
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "contributeur",
    "Spec V6-A spécifique au rôle CONTRIBUTEUR",
  );

  const stamp = Date.now();

  test("CONTRIBUTEUR coche dismissal → toast + retrait optimiste + API isDismissal=true", async ({
    page,
    request,
    baseURL,
  }) => {
    const url = baseURL ?? "http://localhost:4001";
    const adminToken = getToken("admin");
    const contribToken = getToken("contributeur");
    const contribUserId = getUserId("contributeur");

    // ── Setup fixtures : projet + tâche DONE sans TimeEntry du user ───────────
    const project = await createProjectViaAdmin(
      request,
      url,
      adminToken,
      `V6A-Dismissal ${stamp}`,
    );
    const taskTitle = `e2e-dismissal-${stamp}`;
    const task = await createTaskAssignedTo(
      request,
      url,
      adminToken,
      taskTitle,
      project.id,
      contribUserId,
    );
    await setTaskDone(request, url, adminToken, task.id);

    try {
      // ── Navigation dashboard ────────────────────────────────────────────────
      await page.goto("/fr/dashboard");

      await expect(
        page.getByRole("heading", { name: /^mes tâches$/i, level: 2 }),
      ).toBeVisible({ timeout: 15_000 });

      // ── Déplier la sous-section "non déclarées" (repliée par défaut) ────────
      const toggleBtn = page.getByRole("button", {
        name: /mes tâches non déclarées/i,
      });
      await expect(toggleBtn).toBeVisible();
      await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      await toggleBtn.click();
      await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

      // Screenshot BEFORE (sous-section dépliée, checkbox non cochée)
      await page.screenshot({
        path: screenshotPath("dismissal-before.png"),
        fullPage: true,
      });

      // ── Retrouver la ligne de la tâche fixture dans le panel ────────────────
      const panel = page.locator("#dashboard-undeclared-panel");
      await expect(panel).toBeVisible();

      const undeclaredCard = panel
        .locator("div")
        .filter({
          has: page.getByRole("heading", { name: taskTitle, exact: true }),
        })
        .filter({ has: page.locator('input[type="checkbox"]') })
        .first();
      await expect(undeclaredCard).toBeVisible();

      const checkbox = undeclaredCard.locator('input[type="checkbox"]').first();
      await expect(checkbox).toBeVisible();
      await expect(checkbox).not.toBeChecked();

      // ── Cocher → déclenche createDismissal ──────────────────────────────────
      await checkbox.check();

      // ── Toast de succès ────────────────────────────────────────────────────
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: /Tâche validée sans déclaration/i })
          .first(),
      ).toBeVisible({ timeout: 10_000 });

      // ── Optimistic : la carte disparaît ─────────────────────────────────────
      await expect(
        panel.getByRole("heading", { name: taskTitle, exact: true }),
      ).toHaveCount(0, { timeout: 5_000 });

      // Screenshot AFTER
      await page.screenshot({
        path: screenshotPath("dismissal-after.png"),
        fullPage: true,
      });

      // ── Vérification API : TimeEntry dismissal créée (hours:0, isDismissal:true, activityType:'OTHER') ─
      const listRes = await request.get(
        `${url}/api/time-tracking?taskId=${task.id}&includeDismissals=true`,
        { headers: authHeadersNoContentType(contribToken) },
      );
      expect(listRes.status()).toBe(200);
      const body = await listRes.json();
      const entries = Array.isArray(body) ? body : (body.data ?? []);
      const dismissal = entries.find(
        (e: {
          taskId?: string;
          userId?: string;
          isDismissal?: boolean;
        }) =>
          e.taskId === task.id &&
          e.userId === contribUserId &&
          e.isDismissal === true,
      );
      expect(dismissal, "Dismissal entry should exist").toBeDefined();
      expect(Number(dismissal.hours)).toBe(0);
      expect(dismissal.activityType).toBe("OTHER");

      // La tâche ne doit plus apparaître dans GET /tasks/my/done-undeclared
      const undeclaredRes = await request.get(
        `${url}/api/tasks/my/done-undeclared`,
        { headers: authHeadersNoContentType(contribToken) },
      );
      expect(undeclaredRes.status()).toBe(200);
      const undeclaredList = (await undeclaredRes.json()) as Array<{
        id: string;
      }>;
      expect(undeclaredList.some((t) => t.id === task.id)).toBe(false);
    } finally {
      await deleteTask(request, url, adminToken, task.id);
      await deleteProject(request, url, adminToken, project.id);
    }
  });
});
