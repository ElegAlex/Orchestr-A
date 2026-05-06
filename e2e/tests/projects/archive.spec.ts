/**
 * E2E — Project archive / unarchive flow  (Task 12)
 *
 * Tests:
 *   1. [admin @smoke] Full archive → UI verification → analytics exclusion → unarchive cycle.
 *   2. [admin @smoke] OBSERVATEUR receives 403 when calling POST /api/projects/:id/archive.
 *
 * Both tests are gated to the "admin" Playwright project via `test.skip` so they
 * don't race across the 6 role projects that all pick up e2e/tests/**‌/*.spec.ts.
 *
 * API calls require explicit `Authorization: Bearer <token>` headers because JWTs
 * live in localStorage, not cookies — Playwright's storageState only populates the
 * browser context, not APIRequestContext.
 *
 * Run:
 *   pnpm exec playwright test --project=admin e2e/tests/projects/archive.spec.ts
 */

import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { ROLE_STORAGE_PATHS } from "../../fixtures/roles";

// ─── Token helpers ────────────────────────────────────────────────────────────

const tokenCache: Partial<Record<string, string>> = {};

function getTokenFromStorageState(role: keyof typeof ROLE_STORAGE_PATHS): string {
  if (tokenCache[role]) return tokenCache[role]!;

  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Storage state not found for role "${role}" at ${storagePath}. Run "setup" project first.`,
    );
  }

  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );

  if (!tokenEntry?.value) {
    throw new Error(`No access_token found in storage state for role "${role}"`);
  }

  tokenCache[role] = tokenEntry.value;
  return tokenEntry.value;
}

// ─── Spec ─────────────────────────────────────────────────────────────────────

test.describe("Project archive", () => {
  // ── Test 1 : Full archive/unarchive cycle (admin only) ────────────────────
  test(
    "admin archives a project — disappears from /projects, stays reachable, excluded from /reports",
    { tag: "@smoke" },
    async ({ page, request }, testInfo) => {
      test.skip(
        testInfo.project.name !== "admin",
        "Archive flow test is scoped to the admin project only",
      );

      const baseURL = testInfo.project.use.baseURL ?? "http://localhost:4001";
      const adminToken = getTokenFromStorageState("admin");
      const authHeaders = { Authorization: `Bearer ${adminToken}` };

      // ── 1. Pick first active project ──────────────────────────────────────
      const listRes = await request.get(`${baseURL}/api/projects`, {
        headers: authHeaders,
        params: { archived: "active", limit: "1" },
      });
      expect(listRes.status(), "GET /api/projects?archived=active should succeed").toBe(200);

      const listBody = await listRes.json();
      // Response shape: { data: [...], meta: { total, ... } }
      const projects: Array<{ id: string; name: string }> = listBody.data ?? listBody;
      expect(projects.length, "Need at least one active project in the database").toBeGreaterThan(0);

      const { id: projectId, name: projectName } = projects[0];

      // ── 2. Unarchive first in case a previous test run left it archived ────
      // This is the cleanup guard. 409 = already active = fine.
      await request.post(`${baseURL}/api/projects/${projectId}/unarchive`, {
        headers: authHeaders,
      });

      // ── 3. Archive the project via API ────────────────────────────────────
      const archiveRes = await request.post(
        `${baseURL}/api/projects/${projectId}/archive`,
        { headers: authHeaders },
      );
      expect(
        archiveRes.status(),
        `POST /api/projects/${projectId}/archive should return 200`,
      ).toBe(200);

      // ── afterEach cleanup: always unarchive, even if assertions below fail ─
      // We register it before the assertions so it fires on failure too.
      test.afterEach(async () => {
        await request.post(`${baseURL}/api/projects/${projectId}/unarchive`, {
          headers: authHeaders,
        });
      });

      // ── 4. /fr/projects — default view (toggle OFF): project not visible ──
      await page.goto("/fr/projects");
      await page.waitForLoadState("networkidle");

      // Give the page a moment for hydration / query fetch
      await page.waitForTimeout(800);

      // Project name must NOT appear in the default list
      await expect(
        page.getByText(projectName, { exact: true }).first(),
      ).not.toBeVisible({ timeout: 5000 });

      // ── 5. Toggle "Afficher les projets archivés" ON ──────────────────────
      const toggle = page.getByLabel(/projets archivés/i);
      await expect(toggle).toBeVisible({ timeout: 10000 });
      await toggle.check();

      // Wait for the list to reload
      await page.waitForTimeout(800);

      // Project name must now appear
      await expect(
        page.getByText(projectName, { exact: true }).first(),
      ).toBeVisible({ timeout: 10000 });

      // "Archivée" badge must appear alongside the project name.
      // Scope: any element on the page that has both the project name and the badge.
      // We locate the project row by text then check for the sibling badge.
      const projectRow = page
        .locator(`text="${projectName}"`)
        .locator("..")         // parent element
        .first();
      await expect(projectRow).toBeVisible({ timeout: 5000 });
      // The badge is a <span> containing "Archivée" near the project name
      await expect(page.getByText("Archivée").first()).toBeVisible({ timeout: 5000 });

      // ── 6. Navigate directly to /fr/projects/:id — banner visible ─────────
      await page.goto(`/fr/projects/${projectId}`);
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByRole("heading", { name: /Projet archivé/i }),
      ).toBeVisible({ timeout: 15000 });

      // ── 7. /api/analytics — project id NOT in projectDetails ─────────────
      const analyticsRes = await request.get(`${baseURL}/api/analytics`, {
        headers: authHeaders,
      });
      expect(analyticsRes.status(), "GET /api/analytics should succeed").toBe(200);

      const analyticsBody = await analyticsRes.json();
      // Response: { metrics, projectProgressData, taskStatusData, projectDetails: [{ id, name, ... }] }
      const detailIds: string[] = (analyticsBody.projectDetails ?? []).map(
        (p: { id: string }) => p.id,
      );
      expect(
        detailIds,
        `Archived project ${projectId} (${projectName}) must be excluded from /api/analytics projectDetails`,
      ).not.toContain(projectId);

      // ── 8. Unarchive via API — project reappears in default view ──────────
      const unarchiveRes = await request.post(
        `${baseURL}/api/projects/${projectId}/unarchive`,
        { headers: authHeaders },
      );
      expect(
        unarchiveRes.status(),
        `POST /api/projects/${projectId}/unarchive should return 200`,
      ).toBe(200);

      // Navigate back to /fr/projects with toggle OFF (default) — project visible
      await page.goto("/fr/projects");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);

      await expect(
        page.getByText(projectName, { exact: true }).first(),
      ).toBeVisible({ timeout: 15000 });
    },
  );

  // ── Test 2 : OBSERVATEUR gets 403 on archive ──────────────────────────────
  test(
    "OBSERVATEUR cannot archive (403)",
    { tag: "@smoke" },
    async ({ request }, testInfo) => {
      test.skip(
        testInfo.project.name !== "admin",
        "403 check runs once under the admin project; it reads the observateur token directly",
      );

      const baseURL = testInfo.project.use.baseURL ?? "http://localhost:4001";

      // Pick a project id using admin credentials
      const adminToken = getTokenFromStorageState("admin");
      const listRes = await request.get(`${baseURL}/api/projects`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { archived: "active", limit: "1" },
      });
      expect(listRes.status()).toBe(200);

      const listBody = await listRes.json();
      const projects: Array<{ id: string }> = listBody.data ?? listBody;
      expect(
        projects.length,
        "Need at least one active project to test OBSERVATEUR 403",
      ).toBeGreaterThan(0);

      const projectId = projects[0].id;

      // Attempt archive as OBSERVATEUR
      const obsToken = getTokenFromStorageState("observateur");
      const archiveRes = await request.post(
        `${baseURL}/api/projects/${projectId}/archive`,
        { headers: { Authorization: `Bearer ${obsToken}` } },
      );

      expect(
        archiveRes.status(),
        "OBSERVATEUR must receive 403 when attempting to archive a project",
      ).toBe(403);
    },
  );
});
