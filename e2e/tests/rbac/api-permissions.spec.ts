/**
 * Tests RBAC — Permissions API
 *
 * Pour chaque entrée de la PERMISSION_MATRIX :
 *   - Chaque rôle AUTORISÉ : appel endpoint → réponse != 403
 *   - Chaque rôle INTERDIT  : appel endpoint → réponse === 403
 *
 * Les tokens sont lus depuis les storage states créés par auth.setup.ts,
 * évitant tout login supplémentaire (pas de rate limiting).
 */

import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
  PERMISSION_MATRIX,
  getResources,
  type PermissionEntry,
} from "../../fixtures/permission-matrix";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Lire le token JWT depuis le storage state du rôle (fichier JSON créé par auth.setup).
 * Pas de login API = pas de rate limiting.
 */
const tokenCache: Partial<Record<Role, string>> = {};

function getTokenFromStorageState(role: Role): string {
  if (tokenCache[role]) return tokenCache[role]!;

  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Storage state not found for role "${role}" at ${storagePath}. Run setup first.`,
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

          const token = getTokenFromStorageState(role);
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

          const token = getTokenFromStorageState(role);
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
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";

    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { login: "nobody", password: "wrong" },
      headers: { "Content-Type": "application/json" },
    });

    expect([401, 400]).toContain(response.status());
  });

  test("Un appel sans token doit retourner 401 sur /api/projects", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";

    const response = await request.get(`${baseURL}/api/projects`);

    expect(response.status()).toBe(401);
  });
});
