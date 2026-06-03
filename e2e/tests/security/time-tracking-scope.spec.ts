/**
 * Security — Issue #3 (2026-05-05 plan): time-tracking entries on
 * out-of-scope task / project.
 *
 * Setup (admin):
 *   1. Create a private project owned by admin (no other members).
 *   2. Create a task inside that project.
 *
 * Tests:
 *   - contributeur (not a project member) POSTs /api/time-tracking against
 *     that task → expect 403.
 *   - contributeur posts directly against the projectId (no task) → expect 403.
 *   - admin POSTs against the same task (manage_any bypass) → expect 201.
 *
 * Cleanup: best-effort delete the time entry, the task, and the project.
 *
 * Auth: read JWT tokens from playwright/.auth/*.json (created by auth.setup.ts).
 */

import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

const tokenCache: Partial<Record<Role, string>> = {};

function tokenFor(role: Role): string {
  if (tokenCache[role]) return tokenCache[role]!;
  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Storage state not found for role "${role}" at ${storagePath}. Run auth.setup first.`,
    );
  }
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  tokenCache[role] = tokenEntry.value;
  return tokenEntry.value;
}

function auth(role: Role, contentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokenFor(role)}`,
  };
  if (contentType) headers["Content-Type"] = "application/json";
  return headers;
}

function baseUrl(): string {
  return test.info().project.use.baseURL ?? "http://localhost:4001";
}

// API-only spec: scope to admin project to avoid running 6× across roles.
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "time-tracking-scope runs once under the admin project (API-only)",
  );
});

test.describe(
  "Security — Issue #3 access-scope gate on POST /time-tracking",
  { tag: "@smoke" },
  () => {
    let projectId: string | null = null;
    let taskId: string | null = null;
    const createdEntryIds: string[] = [];

    test.beforeAll(async ({ request }) => {
      const stamp = Date.now();
      const projRes = await request.post(`${baseUrl()}/api/projects`, {
        headers: auth("admin", true),
        data: {
          name: `Scope Issue3 ${stamp}`,
          description: "E2E private project for time-tracking scope gate",
          status: "ACTIVE",
          startDate: "2027-01-01T00:00:00Z",
          endDate: "2027-12-31T00:00:00Z",
        },
      });
      if (!projRes.ok()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[time-tracking-scope] project create failed ${projRes.status()} — ${await projRes.text()}`,
        );
        return;
      }
      const projBody = await projRes.json();
      projectId = projBody.id ?? projBody.data?.id ?? null;

      if (!projectId) return;
      const taskRes = await request.post(`${baseUrl()}/api/tasks`, {
        headers: auth("admin", true),
        data: {
          title: `Scope Issue3 task ${stamp}`,
          status: "TODO",
          priority: "NORMAL",
          projectId,
        },
      });
      if (!taskRes.ok()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[time-tracking-scope] task create failed ${taskRes.status()} — ${await taskRes.text()}`,
        );
        return;
      }
      const taskBody = await taskRes.json();
      taskId = taskBody.id ?? taskBody.data?.id ?? null;
    });

    test.afterAll(async ({ request }) => {
      for (const id of createdEntryIds) {
        await request.delete(`${baseUrl()}/api/time-tracking/${id}`, {
          headers: auth("admin"),
        });
      }
      if (taskId) {
        await request.delete(`${baseUrl()}/api/tasks/${taskId}`, {
          headers: auth("admin"),
        });
      }
      if (projectId) {
        await request.delete(`${baseUrl()}/api/projects/${projectId}`, {
          headers: auth("admin"),
        });
      }
    });

    test("contributeur POST /time-tracking with out-of-scope taskId → 403", async ({
      request,
    }) => {
      expect(taskId, "Project/task setup failed in beforeAll").toBeTruthy();
      const res = await request.post(`${baseUrl()}/api/time-tracking`, {
        headers: auth("contributeur", true),
        data: {
          date: "2027-04-10T00:00:00Z",
          hours: 2,
          activityType: "DEVELOPMENT",
          taskId,
          description: "scope-issue3 cross-scope attempt (task)",
        },
      });
      expect(
        res.status(),
        `contributeur POST /time-tracking taskId=<admin-only> — expected 403, got ${res.status()}: ${await res.text()}`,
      ).toBe(403);
    });

    test("contributeur POST /time-tracking with out-of-scope projectId → 403", async ({
      request,
    }) => {
      expect(projectId, "Project/task setup failed in beforeAll").toBeTruthy();
      const res = await request.post(`${baseUrl()}/api/time-tracking`, {
        headers: auth("contributeur", true),
        data: {
          date: "2027-04-10T00:00:00Z",
          hours: 1,
          activityType: "DEVELOPMENT",
          projectId,
          description: "scope-issue3 cross-scope attempt (project)",
        },
      });
      expect(
        res.status(),
        `contributeur POST /time-tracking projectId=<admin-only> — expected 403, got ${res.status()}: ${await res.text()}`,
      ).toBe(403);
    });

    test("admin POST /time-tracking against same task → 201 (manage_any bypass)", async ({
      request,
    }) => {
      expect(taskId, "Project/task setup failed in beforeAll").toBeTruthy();
      const res = await request.post(`${baseUrl()}/api/time-tracking`, {
        headers: auth("admin", true),
        data: {
          date: "2027-04-10T00:00:00Z",
          hours: 3,
          activityType: "DEVELOPMENT",
          taskId,
          description: "scope-issue3 admin manage_any path",
        },
      });
      expect(
        res.status(),
        `admin POST /time-tracking — expected 201, got ${res.status()}: ${await res.text()}`,
      ).toBe(201);
      const body = await res.json();
      const id = body.id ?? body.data?.id;
      if (id) createdEntryIds.push(id);
    });
  },
);
