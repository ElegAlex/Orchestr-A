/**
 * E2E Tests — Module Clients (W5)
 *
 * Scénarios couverts :
 *   1. [@smoke] ADMIN — CRUD complet client : POST / GET list / GET :id / PATCH / DELETE
 *   2. ADMIN — GET /api/clients/:id/projects : structure { projects, summary }
 *   3. MANAGER — Assignation client ↔ projet : POST + DELETE /api/projects/:projectId/clients/:clientId
 *   4. [@smoke] Filtre liste projets par client : GET /api/projects?clients=<uuid>
 *   5. [@smoke] Refus 403 observateur → POST /api/clients
 *   6. Refus 403 contributeur → POST /api/projects/:projectId/clients (assign)
 *
 * Pattern : API-only (pas d'UI), tokens extraits des storage states.
 * Cleanup : afterAll supprime les ressources créées dans l'ordre inverse.
 */

import * as fs from "fs";
import { test, expect } from "./fixtures/test-fixtures";
import { ROLE_STORAGE_PATHS, type Role } from "./fixtures/roles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function authHeadersNoBody(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

// ─── Suite 1 : CRUD admin + /projects endpoint ───────────────────────────────

test.describe("Clients — CRUD admin @smoke", () => {
  let clientId: string;
  let adminToken: string;
  let baseURL: string;

  test.beforeAll(async () => {
    adminToken = getToken("admin");
  });

  test(
    "POST /api/clients — admin crée un client (201) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      const name = uniqueLabel("E2E-Client-Create");

      const res = await request.post(`${baseURL}/api/clients`, {
        headers: authHeaders(adminToken),
        data: { name },
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe(name);
      expect(body.isActive).toBe(true);
      clientId = body.id;
    },
  );

  test(
    "GET /api/clients — liste contient le client créé @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      expect(clientId).toBeDefined();

      const res = await request.get(
        `${baseURL}/api/clients?search=${encodeURIComponent("E2E-Client-Create")}`,
        { headers: authHeadersNoBody(adminToken) },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(
        body.data.some((c: { id: string }) => c.id === clientId),
      ).toBe(true);
    },
  );

  test("GET /api/clients/:id — détail du client (200)", async ({ request }) => {
    baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    expect(clientId).toBeDefined();

    const res = await request.get(`${baseURL}/api/clients/${clientId}`, {
      headers: authHeadersNoBody(adminToken),
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(clientId);
  });

  test("PATCH /api/clients/:id — admin modifie le nom (200)", async ({
    request,
  }) => {
    baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    expect(clientId).toBeDefined();
    const newName = uniqueLabel("E2E-Client-Updated");

    const res = await request.patch(`${baseURL}/api/clients/${clientId}`, {
      headers: authHeaders(adminToken),
      data: { name: newName },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(newName);
  });

  test("GET /api/clients/:id/deletion-impact — retourne projectsCount (200)", async ({
    request,
  }) => {
    baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    expect(clientId).toBeDefined();

    const res = await request.get(
      `${baseURL}/api/clients/${clientId}/deletion-impact`,
      { headers: authHeadersNoBody(adminToken) },
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.projectsCount).toBe("number");
  });

  test(
    "DELETE /api/clients/:id — admin supprime le client (204) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      expect(clientId).toBeDefined();

      const res = await request.delete(`${baseURL}/api/clients/${clientId}`, {
        headers: authHeadersNoBody(adminToken),
      });

      expect(res.status()).toBe(204);

      // Verify 404 post-delete
      const getRes = await request.get(
        `${baseURL}/api/clients/${clientId}`,
        { headers: authHeadersNoBody(adminToken) },
      );
      expect(getRes.status()).toBe(404);

      // Mark cleaned up
      clientId = "";
    },
  );

  test.afterAll(async ({ request }) => {
    // Cleanup if a test failed before the DELETE step
    if (!clientId) return;
    const token = getToken("admin");
    const base = "http://localhost:4001";
    await request
      .delete(`${base}/api/clients/${clientId}`, {
        headers: authHeadersNoBody(token),
      })
      .catch(() => {});
  });
});

// ─── Suite 2 : /clients/:id/projects ─────────────────────────────────────────

test.describe("Clients — GET :id/projects structure summary", () => {
  test("GET /api/clients/:id/projects — structure { projects, summary } avec clés attendues", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const adminToken = getToken("admin");

    // Créer un client de test
    const name = uniqueLabel("E2E-ClientProjects");
    const createRes = await request.post(`${baseURL}/api/clients`, {
      headers: authHeaders(adminToken),
      data: { name },
    });
    expect(createRes.status()).toBe(201);
    const { id: clientId } = await createRes.json();

    try {
      const res = await request.get(
        `${baseURL}/api/clients/${clientId}/projects`,
        { headers: authHeadersNoBody(adminToken) },
      );

      expect(res.status()).toBe(200);
      const body = await res.json();

      // Vérifier la structure
      expect(body).toHaveProperty("projects");
      expect(body).toHaveProperty("summary");
      expect(Array.isArray(body.projects)).toBe(true);

      // Vérifier les clés de summary (même si le client n'a pas de projets)
      const summary = body.summary;
      expect(typeof summary.projectsTotal).toBe("number");
      expect(typeof summary.budgetHoursTotal).toBe("number");
      expect(typeof summary.hoursLoggedTotal).toBe("number");
      expect(typeof summary.varianceHours).toBe("number");
    } finally {
      // Cleanup
      await request.delete(`${baseURL}/api/clients/${clientId}`, {
        headers: authHeadersNoBody(adminToken),
      });
    }
  });
});

// ─── Suite 3 : Assignation manager ↔ projet ──────────────────────────────────

test.describe("Clients — Assignation client ↔ projet (manager) @smoke", () => {
  let clientId: string;
  let projectId: string;
  const adminToken = () => getToken("admin");
  const managerToken = () => getToken("manager");

  test.beforeAll(async ({ request }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";

    // Admin crée un client actif
    const clientRes = await request.post(`${baseURL}/api/clients`, {
      headers: authHeaders(adminToken()),
      data: { name: uniqueLabel("E2E-ClientAssign") },
    });
    expect(clientRes.status()).toBe(201);
    clientId = (await clientRes.json()).id;

    // Admin crée un projet
    const projectRes = await request.post(`${baseURL}/api/projects`, {
      headers: authHeaders(adminToken()),
      data: {
        name: uniqueLabel("E2E-Project-ForClientAssign"),
        description: "Test assignation client E2E",
        status: "ACTIVE",
      },
    });
    expect(projectRes.status()).toBe(201);
    projectId = (await projectRes.json()).id;
  });

  test(
    "POST /api/projects/:projectId/clients — manager assigne un client (201) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";

      const res = await request.post(
        `${baseURL}/api/projects/${projectId}/clients`,
        {
          headers: authHeaders(managerToken()),
          data: { clientId },
        },
      );

      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.clientId).toBe(clientId);
      expect(body.projectId).toBe(projectId);
    },
  );

  test("GET /api/projects/:projectId/clients — liste clients rattachés (200)", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";

    const res = await request.get(
      `${baseURL}/api/projects/${projectId}/clients`,
      { headers: authHeadersNoBody(managerToken()) },
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(
      body.some((entry: { clientId: string }) => entry.clientId === clientId),
    ).toBe(true);
  });

  test(
    "DELETE /api/projects/:projectId/clients/:clientId — manager détache (204) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";

      const res = await request.delete(
        `${baseURL}/api/projects/${projectId}/clients/${clientId}`,
        { headers: authHeadersNoBody(managerToken()) },
      );

      expect(res.status()).toBe(204);
    },
  );

  test.afterAll(async ({ request }) => {
    const baseURL = "http://localhost:4001";
    const token = adminToken();

    // Détacher le client du projet si encore rattaché
    await request
      .delete(`${baseURL}/api/projects/${projectId}/clients/${clientId}`, {
        headers: authHeadersNoBody(token),
      })
      .catch(() => {});

    // Supprimer le client (hard delete OK car détaché)
    if (clientId) {
      await request
        .delete(`${baseURL}/api/clients/${clientId}`, {
          headers: authHeadersNoBody(token),
        })
        .catch(() => {});
    }

    // Supprimer le projet
    if (projectId) {
      await request
        .delete(`${baseURL}/api/projects/${projectId}`, {
          headers: authHeadersNoBody(token),
        })
        .catch(() => {});
    }
  });
});

// ─── Suite 4 : Filtre GET /api/projects?clients= ─────────────────────────────

test.describe("Clients — Filtre projets par client @smoke", () => {
  test(
    "GET /api/projects?clients=<uuid> retourne uniquement les projets rattachés @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      const adminToken = getToken("admin");

      // Créer un client
      const clientRes = await request.post(`${baseURL}/api/clients`, {
        headers: authHeaders(adminToken),
        data: { name: uniqueLabel("E2E-ClientFilter") },
      });
      expect(clientRes.status()).toBe(201);
      const { id: clientId } = await clientRes.json();

      // Créer projet A (sera associé au client)
      const projectARes = await request.post(`${baseURL}/api/projects`, {
        headers: authHeaders(adminToken),
        data: {
          name: uniqueLabel("E2E-ProjectA-WithClient"),
          status: "ACTIVE",
        },
      });
      expect(projectARes.status()).toBe(201);
      const { id: projectAId } = await projectARes.json();

      // Créer projet B (sans client)
      const projectBRes = await request.post(`${baseURL}/api/projects`, {
        headers: authHeaders(adminToken),
        data: {
          name: uniqueLabel("E2E-ProjectB-NoClient"),
          status: "ACTIVE",
        },
      });
      expect(projectBRes.status()).toBe(201);
      const { id: projectBId } = await projectBRes.json();

      // Associer le client au projet A seulement
      const assignRes = await request.post(
        `${baseURL}/api/projects/${projectAId}/clients`,
        {
          headers: authHeaders(adminToken),
          data: { clientId },
        },
      );
      expect(assignRes.status()).toBe(201);

      try {
        // Filtrer les projets par client
        const filterRes = await request.get(
          `${baseURL}/api/projects?clients=${clientId}`,
          { headers: authHeadersNoBody(adminToken) },
        );

        expect(filterRes.status()).toBe(200);
        const body = await filterRes.json();
        const projectIds: string[] = (body.data ?? body).map(
          (p: { id: string }) => p.id,
        );

        // Le projet A doit être présent
        expect(projectIds).toContain(projectAId);
        // Le projet B ne doit pas être présent dans les résultats filtrés
        expect(projectIds).not.toContain(projectBId);
      } finally {
        // Cleanup dans l'ordre : détacher → supprimer client → supprimer projets
        await request
          .delete(`${baseURL}/api/projects/${projectAId}/clients/${clientId}`, {
            headers: authHeadersNoBody(adminToken),
          })
          .catch(() => {});

        await request
          .delete(`${baseURL}/api/clients/${clientId}`, {
            headers: authHeadersNoBody(adminToken),
          })
          .catch(() => {});

        await request
          .delete(`${baseURL}/api/projects/${projectAId}`, {
            headers: authHeadersNoBody(adminToken),
          })
          .catch(() => {});

        await request
          .delete(`${baseURL}/api/projects/${projectBId}`, {
            headers: authHeadersNoBody(adminToken),
          })
          .catch(() => {});
      }
    },
  );
});

// ─── Suite 5 : Refus 403 par rôle ────────────────────────────────────────────

test.describe("Clients — Refus 403 par rôle @smoke", () => {
  test(
    "OBSERVATEUR ne peut PAS créer un client (403) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      const observateurToken = getToken("observateur");

      const res = await request.post(`${baseURL}/api/clients`, {
        headers: authHeaders(observateurToken),
        data: { name: `obs-should-not-create-${Date.now()}` },
      });

      expect(res.status()).toBe(403);
    },
  );

  test(
    "OBSERVATEUR ne peut PAS modifier un client (403) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      const observateurToken = getToken("observateur");
      const adminToken = getToken("admin");

      // Admin crée un client pour le test
      const createRes = await request.post(`${baseURL}/api/clients`, {
        headers: authHeaders(adminToken),
        data: { name: uniqueLabel("E2E-Client-ObsEdit") },
      });
      expect(createRes.status()).toBe(201);
      const { id } = await createRes.json();

      try {
        // Observateur tente de modifier → 403
        const patchRes = await request.patch(`${baseURL}/api/clients/${id}`, {
          headers: authHeaders(observateurToken),
          data: { name: "forbidden-edit" },
        });
        expect(patchRes.status()).toBe(403);
      } finally {
        await request
          .delete(`${baseURL}/api/clients/${id}`, {
            headers: authHeadersNoBody(adminToken),
          })
          .catch(() => {});
      }
    },
  );

  test(
    "OBSERVATEUR ne peut PAS supprimer un client (403) @smoke",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      const observateurToken = getToken("observateur");
      const adminToken = getToken("admin");

      // Admin crée un client pour le test
      const createRes = await request.post(`${baseURL}/api/clients`, {
        headers: authHeaders(adminToken),
        data: { name: uniqueLabel("E2E-Client-ObsDel") },
      });
      expect(createRes.status()).toBe(201);
      const { id } = await createRes.json();

      try {
        // Observateur tente de supprimer → 403
        const delRes = await request.delete(`${baseURL}/api/clients/${id}`, {
          headers: authHeadersNoBody(observateurToken),
        });
        expect(delRes.status()).toBe(403);
      } finally {
        await request
          .delete(`${baseURL}/api/clients/${id}`, {
            headers: authHeadersNoBody(adminToken),
          })
          .catch(() => {});
      }
    },
  );

  test("CONTRIBUTEUR ne peut PAS assigner un client à un projet (403)", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const contributeurToken = getToken("contributeur");
    const adminToken = getToken("admin");

    // Admin crée le client et le projet pour le test
    const clientRes = await request.post(`${baseURL}/api/clients`, {
      headers: authHeaders(adminToken),
      data: { name: uniqueLabel("E2E-Client-ContribAssign") },
    });
    expect(clientRes.status()).toBe(201);
    const { id: clientId } = await clientRes.json();

    const projectRes = await request.post(`${baseURL}/api/projects`, {
      headers: authHeaders(adminToken),
      data: {
        name: uniqueLabel("E2E-Project-ContribAssign"),
        status: "ACTIVE",
      },
    });
    expect(projectRes.status()).toBe(201);
    const { id: projectId } = await projectRes.json();

    try {
      // Contributeur tente d'assigner → 403
      const assignRes = await request.post(
        `${baseURL}/api/projects/${projectId}/clients`,
        {
          headers: authHeaders(contributeurToken),
          data: { clientId },
        },
      );
      expect(assignRes.status()).toBe(403);
    } finally {
      // Cleanup (client pas assigné, donc delete direct OK)
      await request
        .delete(`${baseURL}/api/clients/${clientId}`, {
          headers: authHeadersNoBody(adminToken),
        })
        .catch(() => {});

      await request
        .delete(`${baseURL}/api/projects/${projectId}`, {
          headers: authHeadersNoBody(adminToken),
        })
        .catch(() => {});
    }
  });

  test("REFERENT ne peut PAS assigner un client à un projet (403)", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const referentToken = getToken("referent");
    const adminToken = getToken("admin");

    // Admin crée le client et le projet pour le test
    const clientRes = await request.post(`${baseURL}/api/clients`, {
      headers: authHeaders(adminToken),
      data: { name: uniqueLabel("E2E-Client-RefAssign") },
    });
    expect(clientRes.status()).toBe(201);
    const { id: clientId } = await clientRes.json();

    const projectRes = await request.post(`${baseURL}/api/projects`, {
      headers: authHeaders(adminToken),
      data: {
        name: uniqueLabel("E2E-Project-RefAssign"),
        status: "ACTIVE",
      },
    });
    expect(projectRes.status()).toBe(201);
    const { id: projectId } = await projectRes.json();

    try {
      // Référent tente d'assigner → 403
      const assignRes = await request.post(
        `${baseURL}/api/projects/${projectId}/clients`,
        {
          headers: authHeaders(referentToken),
          data: { clientId },
        },
      );
      expect(assignRes.status()).toBe(403);
    } finally {
      await request
        .delete(`${baseURL}/api/clients/${clientId}`, {
          headers: authHeadersNoBody(adminToken),
        })
        .catch(() => {});

      await request
        .delete(`${baseURL}/api/projects/${projectId}`, {
          headers: authHeadersNoBody(adminToken),
        })
        .catch(() => {});
    }
  });

  test("MANAGER ne peut PAS créer un client (403)", async ({ request }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
    const managerToken = getToken("manager");

    const res = await request.post(`${baseURL}/api/clients`, {
      headers: authHeaders(managerToken),
      data: { name: `mgr-should-not-create-${Date.now()}` },
    });

    expect(res.status()).toBe(403);
  });
});

// ─── Suite 6 : Lecture autorisée pour tous les rôles ─────────────────────────

test.describe("Clients — Lecture autorisée pour tous les rôles", () => {
  const allRoles: Role[] = [
    "admin",
    "responsable",
    "manager",
    "referent",
    "contributeur",
    "observateur",
  ];

  for (const role of allRoles) {
    test(`GET /api/clients — 200 pour ${role}`, async ({ request }) => {
      const baseURL = test.info().project.use.baseURL ?? "http://localhost:4001";
      const token = getToken(role);

      const res = await request.get(`${baseURL}/api/clients`, {
        headers: authHeadersNoBody(token),
      });

      expect(res.status()).toBe(200);
    });
  }
});
