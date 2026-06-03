/**
 * Security — Issue #1 (2026-05-05 plan): privilege escalation via
 * POST /api/users with an institutional role bound to template ADMIN.
 *
 * Setup (admin):
 *   1. Create an institutional role bound to template ADMIN via POST /api/roles.
 *
 * Tests:
 *   - For each of the 6 roles, POST /api/users with the institutional ADMIN role.
 *     Only `admin` (template ADMIN) may succeed (201). All others must be 403:
 *       * `responsable` (template ADMIN_DELEGATED) holds `users:create` but is
 *         blocked by the new hierarchy gate.
 *       * Other roles lack `users:create` and are blocked by the permission guard.
 *
 * Cleanup: hard-delete the user created by admin, then delete the institutional role.
 *
 * Auth: read JWT tokens from playwright/.auth/*.json (created by auth.setup.ts).
 */

import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { ROLES, ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

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

// Spec is role-agnostic (API-only): scope to admin project to avoid 6× runs
// trampling the same fixture role.
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "users-create-hierarchy runs once under the admin project (API-only)",
  );
});

test.describe(
  "Security — Issue #1 hierarchy gate on POST /users",
  { tag: "@smoke" },
  () => {
    let institutionalAdminRoleId: string | null = null;
    let institutionalAdminCode: string | null = null;
    const createdUserIds: string[] = [];

    test.beforeAll(async ({ request }) => {
      institutionalAdminCode = `INSTITUTIONAL_ADMIN_E2E_${Date.now()}`;
      const res = await request.post(`${baseUrl()}/api/roles`, {
        headers: auth("admin", true),
        data: {
          code: institutionalAdminCode,
          label: "Admin institutionnel (E2E)",
          templateKey: "ADMIN",
        },
      });
      if (!res.ok()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[users-create-hierarchy] role create failed ${res.status()} — ${await res.text()}`,
        );
        return;
      }
      const body = await res.json();
      institutionalAdminRoleId = body.id ?? body.data?.id ?? null;
    });

    test.afterAll(async ({ request }) => {
      // Best-effort cleanup: hard-delete any user we created, then the role.
      for (const userId of createdUserIds) {
        await request.delete(`${baseUrl()}/api/users/${userId}/hard`, {
          headers: auth("admin"),
        });
      }
      if (institutionalAdminRoleId) {
        await request.delete(
          `${baseUrl()}/api/roles/${institutionalAdminRoleId}`,
          { headers: auth("admin") },
        );
      }
    });

    function payloadFor(role: Role) {
      const stamp = `${Date.now()}-${role}`;
      return {
        email: `e2e-hier-${stamp}@orchestr-a.test`,
        login: `e2e-hier-${stamp}`,
        password: "Test1234!",
        firstName: "E2E",
        lastName: "Hierarchy",
        roleCode: institutionalAdminCode!,
      };
    }

    for (const role of ROLES) {
      test(`role "${role}" attempts POST /users with ADMIN-template role`, async ({
        request,
      }) => {
        expect(institutionalAdminRoleId, "Institutional ADMIN role setup failed in beforeAll").toBeTruthy();
        const res = await request.post(`${baseUrl()}/api/users`, {
          headers: auth(role, true),
          data: payloadFor(role),
        });
        const status = res.status();
        if (role === "admin") {
          expect(
            status >= 200 && status < 300,
            `admin should mint user, got ${status}: ${await res.text()}`,
          ).toBeTruthy();
          const body = await res.json();
          const id = body.id ?? body.data?.id;
          if (id) createdUserIds.push(id);
        } else {
          expect(
            status,
            `role "${role}" should be 403 Forbidden, got ${status}: ${await res.text()}`,
          ).toBe(403);
        }
      });
    }
  },
);
