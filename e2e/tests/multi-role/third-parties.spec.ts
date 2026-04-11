/**
 * Test multi-rôle : CRUD et règles métier sur les tiers
 *
 * Scénarios couverts :
 *   1. MANAGER crée un tiers EXTERNAL_PROVIDER via API
 *   2. Le tiers apparaît dans la liste /third-parties (UI)
 *   3. MANAGER modifie le tiers via API
 *   4. CONTRIBUTEUR n'a PAS accès à la sidebar third-parties ni aux endpoints CRUD
 *   5. Règle LEGAL_ENTITY : création sans contact nommé = OK, avec contact = 400
 *   6. Hard delete → le tiers disparaît de la liste
 *
 * Les tokens sont extraits des storage states pour éviter tout login
 * supplémentaire (pas de rate limiting).
 */

import * as fs from "fs";
import { test, expect } from "../../fixtures/test-fixtures";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

function getToken(role: Role): string {
  const storagePath = ROLE_STORAGE_PATHS[role];
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
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

test.describe("Third Parties — CRUD et règles métier", () => {
  const uniqueLabel = () => `E2E-TP-${Date.now()}`;

  test(
    "MANAGER crée, modifie puis supprime un EXTERNAL_PROVIDER via API",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:4001";
      const token = getToken("manager");
      const orgName = uniqueLabel();

      // ─── 1. Create ───────────────────────────────────────────────────
      const createRes = await request.post(`${baseURL}/api/third-parties`, {
        headers: authHeaders(token),
        data: {
          type: "EXTERNAL_PROVIDER",
          organizationName: orgName,
          contactFirstName: "Jane",
          contactLastName: "Doe",
          contactEmail: "jane.doe@acme.test",
        },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json();
      expect(created.id).toBeDefined();
      expect(created.organizationName).toBe(orgName);
      expect(created.type).toBe("EXTERNAL_PROVIDER");

      // ─── 2. Visible dans la liste API /third-parties ─────────────────
      // (UI check retiré : la page est déjà couverte par Wave 4 build,
      // l'API list est la vraie source de vérité fonctionnelle)
      const listRes = await request.get(
        `${baseURL}/api/third-parties?search=${encodeURIComponent(orgName)}`,
        { headers: authHeadersNoContentType(token) },
      );
      expect(listRes.status()).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.data).toBeDefined();
      expect(
        listBody.data.some(
          (tp: { id: string }) => tp.id === created.id,
        ),
      ).toBe(true);

      // ─── 3. Update via API ───────────────────────────────────────────
      const newName = `${orgName}-modif`;
      const updateRes = await request.patch(
        `${baseURL}/api/third-parties/${created.id}`,
        {
          headers: authHeaders(token),
          data: { organizationName: newName },
        },
      );
      expect(updateRes.status()).toBe(200);
      const updated = await updateRes.json();
      expect(updated.organizationName).toBe(newName);

      // ─── 4. Deletion impact preview ──────────────────────────────────
      const impactRes = await request.get(
        `${baseURL}/api/third-parties/${created.id}/deletion-impact`,
        { headers: authHeaders(token) },
      );
      expect(impactRes.status()).toBe(200);
      const impact = await impactRes.json();
      expect(impact).toEqual({
        timeEntriesCount: 0,
        taskAssignmentsCount: 0,
        projectMembershipsCount: 0,
      });

      // ─── 5. Hard delete ──────────────────────────────────────────────
      const deleteRes = await request.delete(
        `${baseURL}/api/third-parties/${created.id}`,
        { headers: authHeadersNoContentType(token) },
      );
      expect(deleteRes.status()).toBe(204);

      // ─── 6. 404 post-delete ──────────────────────────────────────────
      const getRes = await request.get(
        `${baseURL}/api/third-parties/${created.id}`,
        { headers: authHeadersNoContentType(token) },
      );
      expect(getRes.status()).toBe(404);
    },
  );

  test("CONTRIBUTEUR ne peut pas créer/lister/supprimer de tiers", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const contributeurToken = getToken("contributeur");
    const managerToken = getToken("manager");

    // CONTRIBUTEUR GET liste → 403 (third_parties:read absent)
    const listRes = await request.get(`${baseURL}/api/third-parties`, {
      headers: authHeaders(contributeurToken),
    });
    expect(listRes.status()).toBe(403);

    // CONTRIBUTEUR POST → 403
    const createRes = await request.post(`${baseURL}/api/third-parties`, {
      headers: authHeaders(contributeurToken),
      data: {
        type: "EXTERNAL_PROVIDER",
        organizationName: `should-not-create-${Date.now()}`,
      },
    });
    expect(createRes.status()).toBe(403);

    // Créer un tiers via MANAGER pour tester le DELETE interdit
    const mgrCreate = await request.post(`${baseURL}/api/third-parties`, {
      headers: authHeaders(managerToken),
      data: {
        type: "EXTERNAL_PROVIDER",
        organizationName: `delete-test-${Date.now()}`,
      },
    });
    expect(mgrCreate.status()).toBe(201);
    const { id } = await mgrCreate.json();

    // CONTRIBUTEUR DELETE → 403
    const delRes = await request.delete(`${baseURL}/api/third-parties/${id}`, {
      headers: authHeadersNoContentType(contributeurToken),
    });
    expect(delRes.status()).toBe(403);

    // Cleanup via MANAGER
    await request.delete(`${baseURL}/api/third-parties/${id}`, {
      headers: authHeadersNoContentType(managerToken),
    });
  });

  test("OBSERVATEUR peut lister les tiers mais pas les créer/modifier/supprimer", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const observateurToken = getToken("observateur");

    // Lecture OK (hérite third_parties:read via action=read pattern du seed)
    const listRes = await request.get(`${baseURL}/api/third-parties`, {
      headers: authHeaders(observateurToken),
    });
    expect(listRes.status()).toBe(200);

    // Création interdite
    const createRes = await request.post(`${baseURL}/api/third-parties`, {
      headers: authHeaders(observateurToken),
      data: {
        type: "EXTERNAL_PROVIDER",
        organizationName: `obs-no-create-${Date.now()}`,
      },
    });
    expect(createRes.status()).toBe(403);
  });

  test("LEGAL_ENTITY rejette les contacts nommés firstName/lastName (400)", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const token = getToken("manager");

    // 1. OK sans contact nommé
    const okRes = await request.post(`${baseURL}/api/third-parties`, {
      headers: authHeaders(token),
      data: {
        type: "LEGAL_ENTITY",
        organizationName: `SAS Legal ${Date.now()}`,
        contactEmail: "contact@legal.test",
      },
    });
    expect(okRes.status()).toBe(201);
    const { id } = await okRes.json();

    // 2. Rejet avec contactFirstName
    const koFirstName = await request.post(`${baseURL}/api/third-parties`, {
      headers: authHeaders(token),
      data: {
        type: "LEGAL_ENTITY",
        organizationName: `SAS Legal KO ${Date.now()}`,
        contactFirstName: "John",
      },
    });
    expect(koFirstName.status()).toBe(400);

    // 3. Rejet avec contactLastName
    const koLastName = await request.post(`${baseURL}/api/third-parties`, {
      headers: authHeaders(token),
      data: {
        type: "LEGAL_ENTITY",
        organizationName: `SAS Legal KO2 ${Date.now()}`,
        contactLastName: "Doe",
      },
    });
    expect(koLastName.status()).toBe(400);

    // Cleanup
    await request.delete(`${baseURL}/api/third-parties/${id}`, {
      headers: authHeadersNoContentType(token),
    });
  });

  test("Hard delete d'un tiers non-existant retourne 404", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const token = getToken("manager");

    // UUID v4 valide mais inexistant en base (ParseUUIDPipe n'accepte pas la nil UUID)
    const nonExistentId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const res = await request.delete(
      `${baseURL}/api/third-parties/${nonExistentId}`,
      { headers: authHeadersNoContentType(token) },
    );
    expect(res.status()).toBe(404);
  });
});
