/**
 * V6-A Spec 1 — Dashboard Quick Time Entry (saisie inline)
 *
 * Scénario principal (D8) : un CONTRIBUTEUR peut déclarer des heures
 * directement depuis sa carte de tâche sur le dashboard, sans passer
 * par la modal. Toast de succès + optimistic update du cumul affiché.
 *
 * Fixtures créées via API :
 *   - 1 projet (admin)
 *   - 1 tâche assignée au user contributeur, status IN_PROGRESS
 *
 * Teardown : deleteTask + deleteProject (soft delete) via admin.
 *
 * @smoke
 */

import * as fs from "fs";
import * as path from "path";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

// ─── Helpers token / user id (lus depuis storage state) ───────────────────────

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
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
}

function getUserId(role: Role): string {
  const storage = readStorage(role);
  const userEntry = storage.origins?.[0]?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "user",
  );
  if (!userEntry?.value) {
    throw new Error(`No user in storage state for role "${role}"`);
  }
  const parsed = JSON.parse(userEntry.value);
  if (!parsed?.id) {
    throw new Error(`No id in stored user payload for role "${role}"`);
  }
  return parsed.id as string;
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

// ─── Fixture helpers ──────────────────────────────────────────────────────────

async function createProjectViaAdmin(
  request: APIRequestContext,
  baseURL: string,
  adminToken: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const res = await request.post(`${baseURL}/api/projects`, {
    headers: authHeaders(adminToken),
    data: {
      name,
      description: "E2E V6-A quick entry",
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
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED" = "IN_PROGRESS",
): Promise<{ id: string; title: string }> {
  // endDate dans le futur pour rester dans "à venir" (MyTasksUpcomingList).
  const futureEndDate = new Date();
  futureEndDate.setDate(futureEndDate.getDate() + 14);

  const res = await request.post(`${baseURL}/api/tasks`, {
    headers: authHeaders(adminToken),
    data: {
      title,
      projectId,
      status,
      priority: "NORMAL",
      assigneeId,
      endDate: futureEndDate.toISOString(),
    },
  });
  expect(res.status(), `createTask ${title}`).toBe(201);
  return (await res.json()) as { id: string; title: string };
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
  // Soft delete → status CANCELLED
  await request.delete(`${baseURL}/api/projects/${projectId}`, {
    headers: authHeadersNoContentType(adminToken),
  });
}

// ─── Screenshots ──────────────────────────────────────────────────────────────

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

test.describe("@smoke Dashboard - Quick time entry", () => {
  // Ne cibler que le project "contributeur" — sinon tests dupliqués sur 6 rôles.
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "contributeur",
    "Spec V6-A spécifique au rôle CONTRIBUTEUR",
  );

  const stamp = Date.now();

  test("CONTRIBUTEUR saisit 2.5h inline → toast succès + cumul optimiste", async ({
    page,
    request,
    baseURL,
  }) => {
    const url = baseURL ?? "http://localhost:4001";
    const adminToken = getToken("admin");
    const contribUserId = getUserId("contributeur");

    // ── Setup fixtures via API ────────────────────────────────────────────────
    const project = await createProjectViaAdmin(
      request,
      url,
      adminToken,
      `V6A-QuickEntry ${stamp}`,
    );
    const taskTitle = `e2e-quick-entry-${stamp}`;
    const task = await createTaskAssignedTo(
      request,
      url,
      adminToken,
      taskTitle,
      project.id,
      contribUserId,
      "IN_PROGRESS",
    );

    try {
      // ── Navigation dashboard (storageState=contributeur via project) ────────
      await page.goto("/fr/dashboard");

      // Le H2 "Mes tâches" apparaît une fois le loading terminé.
      const segmentTitle = page.getByRole("heading", {
        name: /^mes tâches$/i,
        level: 2,
      });
      await expect(segmentTitle).toBeVisible({ timeout: 15_000 });

      // Sous-section "à venir" visible (dépliée par défaut).
      await expect(
        page.getByRole("heading", { name: /mes tâches à venir/i, level: 3 }),
      ).toBeVisible();

      // ── Retrouver la carte de la tâche fixture ─────────────────────────────
      // La carte contient le titre en <h3> et un input[type="number"] dans la
      // zone "upcoming". Scope via hasText sur le titre unique.
      const card = page
        .locator("div")
        .filter({
          has: page.getByRole("heading", { name: taskTitle, exact: true }),
        })
        .filter({ has: page.locator('input[type="number"]') })
        .first();

      await expect(card).toBeVisible();

      // Screenshot BEFORE
      await page.screenshot({
        path: screenshotPath("quick-entry-before.png"),
        fullPage: true,
      });

      const input = card.locator('input[type="number"]').first();
      await expect(input).toBeVisible();

      // ── Saisie inline : "2.5" + Enter ───────────────────────────────────────
      // stopPropagation() est déjà géré côté composant — click puis fill OK.
      await input.click();
      await input.fill("2.5");
      await input.press("Enter");

      // ── Toast de succès (react-hot-toast → role=status) ────────────────────
      // Texte FR attendu : "Temps enregistré" (cf. dashboard.json).
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: /Temps enregistré/i })
          .first(),
      ).toBeVisible({ timeout: 10_000 });

      // ── Optimistic update : cumul incrémenté de 2.5 h ───────────────────────
      // Le span affiche `toFixed(2) h` → "2.50 h" (avant: "0.00 h").
      await expect(
        card.getByText(/2\.50\s*h/i).first(),
      ).toBeVisible({ timeout: 5_000 });

      // L'input doit être vidé après succès.
      await expect(input).toHaveValue("");

      // Screenshot AFTER
      await page.screenshot({
        path: screenshotPath("quick-entry-after.png"),
        fullPage: true,
      });

      // ── Vérification API secondaire : TimeEntry créée ──────────────────────
      const contribToken = getToken("contributeur");
      const listRes = await request.get(
        `${url}/api/time-tracking?taskId=${task.id}`,
        { headers: authHeadersNoContentType(contribToken) },
      );
      expect(listRes.status()).toBe(200);
      const listBody = await listRes.json();
      const entries = Array.isArray(listBody)
        ? listBody
        : (listBody.data ?? []);
      const myEntry = entries.find(
        (e: { taskId?: string; userId?: string; hours?: number }) =>
          e.taskId === task.id && e.userId === contribUserId,
      );
      expect(myEntry).toBeDefined();
      expect(myEntry.hours).toBeCloseTo(2.5, 2);
    } finally {
      // ── Teardown ───────────────────────────────────────────────────────────
      await deleteTask(request, url, adminToken, task.id);
      await deleteProject(request, url, adminToken, project.id);
    }
  });
});
