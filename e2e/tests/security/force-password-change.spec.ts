/**
 * SEC-004 — enforce forcePasswordChange.
 *
 * Witness (AC#2): a user flagged `forcePasswordChange=true` receives a full JWT
 * but is confined to the change-password endpoint — every other API route is
 * rejected with 403 `PASSWORD_CHANGE_REQUIRED` until the flag is cleared.
 *
 * No API path sets the flag (only seed.ts does, for the bootstrap admin), so the
 * fixture flags a freshly-created user directly in the compose Postgres via
 * `docker exec … psql`. If that container is unreachable (e.g. CI without the
 * compose DB) the suite skips cleanly — the binding regression witness lives in
 * the vitest specs (force-password-change.guard.spec.ts, users.service.spec.ts),
 * which were also exercised end-to-end against a live API.
 *
 * Runs once under the admin project (API-only, mirrors auth-reset-password.spec).
 */

import * as fs from "fs";
import { execFileSync } from "child_process";
import { test, expect } from "@playwright/test";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

const DB_CONTAINER = process.env.ORCHESTRA_DB_CONTAINER ?? "orchestr-a-db";
const DB_USER = process.env.ORCHESTRA_DB_USER ?? "orchestr_a";
const DB_NAME = process.env.ORCHESTRA_DB_NAME ?? "orchestr_a_v2";

function tokenFor(role: Role): string {
  const storage = JSON.parse(
    fs.readFileSync(ROLE_STORAGE_PATHS[role], "utf-8"),
  );
  const tokenEntry = storage.origins?.[0]?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value as string;
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

/** Flag (or unflag) a user via the compose DB. Returns false if unreachable. */
function setForcePasswordChange(userId: string, value: boolean): boolean {
  try {
    execFileSync(
      "docker",
      [
        "exec",
        DB_CONTAINER,
        "psql",
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "-c",
        `UPDATE users SET "forcePasswordChange"=${value} WHERE id='${userId}';`,
      ],
      { stdio: "pipe", timeout: 10_000 },
    );
    return true;
  } catch {
    return false;
  }
}

const TARGET_PASSWORD = "TargetPass1!";
const NEW_PASSWORD = "NewP@ssw0rd1";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "force-password-change runs once under the admin project (API-only)",
  );
});

test.describe(
  "Security — SEC-004 forcePasswordChange confines the session to change-password",
  { tag: "@smoke" },
  () => {
    let roleId: string | null = null;
    let roleCode: string | null = null;
    let targetUserId: string | null = null;
    let flaggedToken: string | null = null;
    let dbUnavailable = false;

    test.beforeAll(async ({ request }) => {
      // Self-contained assignable role (system blueprints can't be assigned).
      roleCode = `INSTITUTIONAL_FORCEPWD_E2E_${Date.now()}`;
      const roleRes = await request.post(`${baseUrl()}/api/roles`, {
        headers: auth("admin", true),
        data: {
          code: roleCode,
          label: "Force-pwd target (E2E)",
          templateKey: "BASIC_USER",
        },
      });
      if (!roleRes.ok()) return;
      roleId = (await roleRes.json()).id ?? null;

      const login = `e2e-forcepwd-${Date.now()}`;
      const userRes = await request.post(`${baseUrl()}/api/users`, {
        headers: auth("admin", true),
        data: {
          email: `${login}@orchestr-a.test`,
          login,
          password: TARGET_PASSWORD,
          firstName: "Force",
          lastName: "Pwd",
          roleCode,
        },
      });
      if (!userRes.ok()) return;
      targetUserId = (await userRes.json()).id ?? null;

      if (!targetUserId || !setForcePasswordChange(targetUserId, true)) {
        dbUnavailable = true;
        return;
      }

      const loginRes = await request.post(`${baseUrl()}/api/auth/login`, {
        headers: { "Content-Type": "application/json" },
        data: { login, password: TARGET_PASSWORD },
      });
      if (loginRes.ok()) {
        flaggedToken = (await loginRes.json()).access_token ?? null;
      }
    });

    test.afterAll(async ({ request }) => {
      // Hard-delete is refused once a PASSWORD_CHANGED audit row exists, so the
      // user is deactivated and unflagged to leave no usable account behind.
      if (targetUserId) {
        setForcePasswordChange(targetUserId, false);
        await request
          .delete(`${baseUrl()}/api/users/${targetUserId}/hard`, {
            headers: auth("admin"),
          })
          .catch(() => undefined);
        await request
          .patch(`${baseUrl()}/api/users/${targetUserId}`, {
            headers: auth("admin", true),
            data: { isActive: false },
          })
          .catch(() => undefined);
      }
      if (roleId) {
        await request
          .delete(`${baseUrl()}/api/roles/${roleId}`, {
            headers: auth("admin"),
          })
          .catch(() => undefined);
      }
    });

    test("a flagged user is BLOCKED on normal routes with 403 PASSWORD_CHANGE_REQUIRED", async ({
      request,
    }) => {
      test.skip(dbUnavailable, `compose DB (${DB_CONTAINER}) not reachable`);
      test.skip(!flaggedToken, "flagged-user setup failed in beforeAll");
      const headers = { Authorization: `Bearer ${flaggedToken}` };

      // A representative business route is fully blocked.
      const tasksRes = await request.get(`${baseUrl()}/api/tasks`, { headers });
      expect(
        tasksRes.status(),
        `flagged user must be blocked on /tasks, got ${tasksRes.status()}: ${await tasksRes.text()}`,
      ).toBe(403);
      const body = (await tasksRes.json()) as { code?: string };
      expect(body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    test("the same flagged session is ALLOWED on change-password, and is unblocked immediately after", async ({
      request,
    }) => {
      test.skip(dbUnavailable, `compose DB (${DB_CONTAINER}) not reachable`);
      test.skip(!flaggedToken, "flagged-user setup failed in beforeAll");

      const changeRes = await request.patch(
        `${baseUrl()}/api/users/me/change-password`,
        {
          headers: {
            Authorization: `Bearer ${flaggedToken}`,
            "Content-Type": "application/json",
          },
          data: { currentPassword: TARGET_PASSWORD, newPassword: NEW_PASSWORD },
        },
      );
      expect(
        changeRes.status(),
        `change-password must be reachable while flagged, got ${changeRes.status()}: ${await changeRes.text()}`,
      ).toBe(200);

      // DB-authoritative enforcement: the flag is now cleared, so the SAME
      // (still-valid) access token passes a normal route on the next request —
      // no re-login, no waiting out the token TTL.
      const tasksRes = await request.get(`${baseUrl()}/api/tasks`, {
        headers: { Authorization: `Bearer ${flaggedToken}` },
      });
      expect(
        tasksRes.status(),
        `flag cleared → /tasks should pass, got ${tasksRes.status()}: ${await tasksRes.text()}`,
      ).toBe(200);
    });
  },
);
