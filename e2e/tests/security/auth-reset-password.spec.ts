/**
 * Security — Issue #2 (2026-05-05 plan): cross-tier password reset token
 * issuance via POST /api/auth/reset-password-token.
 *
 * Setup (admin):
 *   1. Create an institutional role bound to template ADMIN.
 *   2. Create a target user with that role (the "ADMIN-tier victim").
 *   3. Login as the target to obtain a refresh token (revocation probe).
 *
 * Tests:
 *   - responsable (template ADMIN_DELEGATED) holds `users:reset_password` but
 *     must be blocked by the new hierarchy gate when targeting an ADMIN-tier
 *     user → 403.
 *   - admin (template ADMIN) → 200, response carries `{ token, resetUrl }`
 *     (only because AUTH_EXPOSE_RESET_TOKEN=true in dev/E2E env). Performing
 *     POST /auth/reset-password with that token then revokes the target's
 *     pre-existing refresh tokens (RefreshTokenService.revokeAllForUser).
 *
 * Cleanup: hard-delete target user, delete the institutional role.
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

const TARGET_PASSWORD = "TargetPass1!";
const RESET_PASSWORD = "AfterReset1!";

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "auth-reset-password runs once under the admin project (API-only)",
  );
});

test.describe(
  "Security — Issue #2 hierarchy gate on POST /auth/reset-password-token",
  { tag: "@smoke" },
  () => {
    let adminTierRoleId: string | null = null;
    let adminTierRoleCode: string | null = null;
    let targetUserId: string | null = null;
    let targetLogin: string | null = null;
    let targetRefreshToken: string | null = null;

    test.beforeAll(async ({ request }) => {
      adminTierRoleCode = `INSTITUTIONAL_ADMIN_RESET_E2E_${Date.now()}`;
      const roleRes = await request.post(`${baseUrl()}/api/roles`, {
        headers: auth("admin", true),
        data: {
          code: adminTierRoleCode,
          label: "Admin institutionnel (E2E reset)",
          templateKey: "ADMIN",
        },
      });
      if (!roleRes.ok()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[auth-reset-password] role create failed ${roleRes.status()} — ${await roleRes.text()}`,
        );
        return;
      }
      const roleBody = await roleRes.json();
      adminTierRoleId = roleBody.id ?? roleBody.data?.id ?? null;

      const stamp = Date.now();
      targetLogin = `e2e-reset-target-${stamp}`;
      const userRes = await request.post(`${baseUrl()}/api/users`, {
        headers: auth("admin", true),
        data: {
          email: `${targetLogin}@orchestr-a.test`,
          login: targetLogin,
          password: TARGET_PASSWORD,
          firstName: "Reset",
          lastName: "Target",
          roleCode: adminTierRoleCode,
        },
      });
      if (!userRes.ok()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[auth-reset-password] target create failed ${userRes.status()} — ${await userRes.text()}`,
        );
        return;
      }
      const userBody = await userRes.json();
      targetUserId = userBody.id ?? userBody.data?.id ?? null;

      const loginRes = await request.post(`${baseUrl()}/api/auth/login`, {
        headers: { "Content-Type": "application/json" },
        data: { login: targetLogin, password: TARGET_PASSWORD },
      });
      if (loginRes.ok()) {
        const loginBody = await loginRes.json();
        targetRefreshToken = loginBody.refresh_token ?? null;
      }
    });

    test.afterAll(async ({ request }) => {
      if (targetUserId) {
        await request.delete(`${baseUrl()}/api/users/${targetUserId}/hard`, {
          headers: auth("admin"),
        });
      }
      if (adminTierRoleId) {
        await request.delete(`${baseUrl()}/api/roles/${adminTierRoleId}`, {
          headers: auth("admin"),
        });
      }
    });

    test("responsable (ADMIN_DELEGATED) cannot reset an ADMIN-tier user → 403", async ({
      request,
    }) => {
      expect(targetUserId, "target user setup failed in beforeAll").toBeTruthy();
      const res = await request.post(
        `${baseUrl()}/api/auth/reset-password-token`,
        {
          headers: auth("responsable", true),
          data: { userId: targetUserId },
        },
      );
      expect(
        res.status(),
        `responsable should be blocked by hierarchy gate, got ${res.status()}: ${await res.text()}`,
      ).toBe(403);
    });

    test("admin can reset, response carries token, target refresh tokens are revoked", async ({
      request,
    }) => {
      expect(targetUserId, "target user setup failed in beforeAll").toBeTruthy();

      const tokenRes = await request.post(
        `${baseUrl()}/api/auth/reset-password-token`,
        {
          headers: auth("admin", true),
          data: { userId: targetUserId },
        },
      );
      expect(tokenRes.status()).toBeGreaterThanOrEqual(200);
      expect(tokenRes.status()).toBeLessThan(300);
      const tokenBody = (await tokenRes.json()) as {
        ok?: boolean;
        token?: string;
        resetUrl?: string;
      };
      expect(tokenBody.ok).toBe(true);
      // Dev/E2E env exposes the token; CI must keep AUTH_EXPOSE_RESET_TOKEN=true.
      expect(
        tokenBody.token,
        "AUTH_EXPOSE_RESET_TOKEN should be true in E2E env (.env.example)",
      ).toBeTruthy();

      const resetRes = await request.post(
        `${baseUrl()}/api/auth/reset-password`,
        {
          headers: { "Content-Type": "application/json" },
          data: { token: tokenBody.token, newPassword: RESET_PASSWORD },
        },
      );
      expect(resetRes.status()).toBe(200);

      // Pre-reset refresh token must be revoked.
      if (targetRefreshToken) {
        const refreshRes = await request.post(
          `${baseUrl()}/api/auth/refresh`,
          {
            headers: { "Content-Type": "application/json" },
            data: { refreshToken: targetRefreshToken },
          },
        );
        expect(
          refreshRes.status(),
          "old refresh token must be invalidated by password reset",
        ).toBe(401);
      }

      // The new password works.
      const newLoginRes = await request.post(`${baseUrl()}/api/auth/login`, {
        headers: { "Content-Type": "application/json" },
        data: { login: targetLogin, password: RESET_PASSWORD },
      });
      expect(newLoginRes.status()).toBe(200);
    });
  },
);
