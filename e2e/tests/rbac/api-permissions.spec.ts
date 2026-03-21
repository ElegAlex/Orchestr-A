/**
 * Tests RBAC — Permissions API
 *
 * Pour chaque entrée de la PERMISSION_MATRIX :
 *   - Chaque rôle AUTORISÉ : login + appel endpoint → réponse != 403
 *   - Chaque rôle INTERDIT  : login + appel endpoint → réponse === 403
 *
 * Les tests utilisent playwright.request (APIRequestContext) directement,
 * sans dépendance au storage state ou au navigateur.
 */

import { test, expect } from "@playwright/test";
import {
  PERMISSION_MATRIX,
  getResources,
  type PermissionEntry,
} from "../../fixtures/permission-matrix";
import { ROLE_LOGINS, ROLE_PASSWORD, type Role } from "../../fixtures/roles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Obtenir un JWT pour un rôle donné via l'API /api/auth/login.
 * On refait le login à chaque test pour isoler chaque appel.
 */
async function getToken(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
  role: Role,
): Promise<string> {
  const response = await request.post(`${baseURL}/api/auth/login`, {
    data: {
      login: ROLE_LOGINS[role],
      password: ROLE_PASSWORD,
    },
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok()) {
    throw new Error(
      `Login failed for role "${role}" (login="${ROLE_LOGINS[role]}"): ` +
        `${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  const token: string = body.access_token;

  if (!token) {
    throw new Error(`No access_token in login response for role "${role}"`);
  }

  return token;
}

/**
 * Effectuer un appel API authentifié avec le token du rôle.
 */
async function callApi(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
  entry: PermissionEntry,
  token: string,
): Promise<import("@playwright/test").APIResponse> {
  const url = `${baseURL}${entry.apiEndpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  switch (entry.method) {
    case "GET":
      return request.get(url, { headers });
    case "POST":
      return request.post(url, { headers, data: entry.testBody ?? {} });
    case "PATCH":
      return request.patch(url, { headers, data: entry.testBody ?? {} });
    case "DELETE":
      return request.delete(url, { headers });
    default:
      throw new Error(`Méthode HTTP non supportée : ${entry.method}`);
  }
}

// ─── Cache des tokens par rôle (évite les logins en double par describe block) ─
// Note : ce cache est local à chaque worker Playwright.
const tokenCache: Partial<Record<Role, string>> = {};

async function getCachedToken(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
  role: Role,
): Promise<string> {
  if (!tokenCache[role]) {
    tokenCache[role] = await getToken(request, baseURL, role);
  }
  return tokenCache[role]!;
}

// ─── Génération des tests par ressource ──────────────────────────────────────

const resources = getResources();

for (const resource of resources) {
  const entries = PERMISSION_MATRIX.filter((e) => e.resource === resource);

  test.describe(`RBAC — ${resource}`, () => {
    for (const entry of entries) {
      // Tests pour les rôles AUTORISÉS
      for (const role of entry.allowedRoles as Role[]) {
        test(`[AUTORISÉ] ${entry.method} ${entry.apiEndpoint} — rôle: ${role} — ${entry.action}`, async ({
          request,
        }) => {
          const baseURL =
            test.info().project.use.baseURL ?? "http://localhost:4001";

          const token = await getCachedToken(
            request,
            baseURL,
            role,
          );
          const response = await callApi(request, baseURL, entry, token);

          expect(
            response.status(),
            `[${role}] ${entry.method} ${entry.apiEndpoint} ne devrait PAS retourner 403.\n` +
              `Action: ${entry.action}\n` +
              `Description: ${entry.description ?? "—"}\n` +
              `Statut reçu: ${response.status()}`,
          ).not.toBe(403);
        });
      }

      // Tests pour les rôles INTERDITS
      for (const role of entry.deniedRoles as Role[]) {
        test(`[INTERDIT] ${entry.method} ${entry.apiEndpoint} — rôle: ${role} — ${entry.action}`, async ({
          request,
        }) => {
          const baseURL =
            test.info().project.use.baseURL ?? "http://localhost:4001";

          const token = await getCachedToken(
            request,
            baseURL,
            role,
          );
          const response = await callApi(request, baseURL, entry, token);

          expect(
            response.status(),
            `[${role}] ${entry.method} ${entry.apiEndpoint} DEVRAIT retourner 403.\n` +
              `Action: ${entry.action}\n` +
              `Description: ${entry.description ?? "—"}\n` +
              `Statut reçu: ${response.status()}`,
          ).toBe(403);
        });
      }
    }
  });
}

// ─── Test de santé : vérifier que l'API répond ───────────────────────────────

test.describe("RBAC — Santé API", () => {
  test("L'API doit répondre sur /api/auth/login", async ({ request }) => {
    const baseURL =
      test.info().project.use.baseURL ?? "http://localhost:4001";

    // Un login invalide doit retourner 401, pas 500 ou connection refused
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { login: "nobody", password: "wrong" },
      headers: { "Content-Type": "application/json" },
    });

    expect([401, 400]).toContain(response.status());
  });

  test("Un appel sans token doit retourner 401 sur /api/projects", async ({
    request,
  }) => {
    const baseURL =
      test.info().project.use.baseURL ?? "http://localhost:4001";

    const response = await request.get(`${baseURL}/api/projects`);

    expect(response.status()).toBe(401);
  });
});
