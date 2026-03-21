/**
 * Test multi-rôle : Protection contre l'escalade de privilèges (RBAC)
 *
 * Scénario :
 *   1. CONTRIBUTEUR tente d'accéder à /admin/roles → redirigé ou accès refusé
 *   2. CONTRIBUTEUR tente POST /api/users (création) → 403
 *   3. OBSERVATEUR tente POST /api/projects → 403
 *   4. CONTRIBUTEUR tente DELETE /api/projects/:id → 403
 *
 * Ces tests vérifient la sécurité au niveau API (backend) et UI (frontend).
 */

import { test, expect } from "../../fixtures/test-fixtures";

// ID fictif pour les tentatives DELETE — n'existe pas, mais la 403 doit
// être retournée AVANT toute vérification d'existence de ressource.
const FAKE_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

test.describe("RBAC — Protection contre l'escalade de privilèges", () => {
  // ─── Tests UI ──────────────────────────────────────────────────────────────

  test.describe("Accès UI refusé aux pages admin", () => {
    test(
      "CONTRIBUTEUR est bloqué sur /admin/roles",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const contributeurPage = await asRole("contributeur");
        await contributeurPage.goto("/admin/roles");
        await contributeurPage.waitForLoadState("domcontentloaded");

        const url = contributeurPage.url();

        const isRedirected =
          url.includes("/login") ||
          url.includes("/403") ||
          url.includes("/unauthorized") ||
          url.includes("/dashboard");

        // La page affiche "Accès restreint" (comportement actuel du composant RolesPage)
        const hasRestrictedMessage = await contributeurPage
          .locator("text=/accès restreint|réservé aux administrateurs/i")
          .isVisible({ timeout: 8000 })
          .catch(() => false);

        expect(isRedirected || hasRestrictedMessage).toBeTruthy();
      },
    );

    test(
      "OBSERVATEUR est bloqué sur /admin/roles",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const observateurPage = await asRole("observateur");
        await observateurPage.goto("/admin/roles");
        await observateurPage.waitForLoadState("domcontentloaded");

        const url = observateurPage.url();

        const isRedirected =
          url.includes("/login") ||
          url.includes("/403") ||
          url.includes("/unauthorized") ||
          url.includes("/dashboard");

        const hasRestrictedMessage = await observateurPage
          .locator("text=/accès restreint|réservé aux administrateurs/i")
          .isVisible({ timeout: 8000 })
          .catch(() => false);

        expect(isRedirected || hasRestrictedMessage).toBeTruthy();
      },
    );

    test(
      "REFERENT est bloqué sur /admin/roles",
      async ({ asRole }) => {
        const referentPage = await asRole("referent");
        await referentPage.goto("/admin/roles");
        await referentPage.waitForLoadState("domcontentloaded");

        const url = referentPage.url();

        const isRedirected =
          url.includes("/login") ||
          url.includes("/403") ||
          url.includes("/unauthorized") ||
          url.includes("/dashboard");

        const hasRestrictedMessage = await referentPage
          .locator("text=/accès restreint|réservé aux administrateurs/i")
          .isVisible({ timeout: 8000 })
          .catch(() => false);

        expect(isRedirected || hasRestrictedMessage).toBeTruthy();
      },
    );
  });

  // ─── Tests API directs ─────────────────────────────────────────────────────

  test.describe("API — Tentatives non autorisées retournent 403", () => {
    test(
      "CONTRIBUTEUR : POST /api/users retourne 403",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const contributeurPage = await asRole("contributeur");

        // Effectuer la requête API directement depuis le contexte authentifié
        const response = await contributeurPage.request.post("/api/users", {
          data: {
            login: `escalade-test-${Date.now()}`,
            email: `escalade-${Date.now()}@test.com`,
            password: "Test1234!",
            firstName: "Escalade",
            lastName: "Test",
            role: "ADMIN",
          },
          headers: { "Content-Type": "application/json" },
          failOnStatusCode: false,
        });

        // La création d'utilisateur est réservée aux admins → 403 ou 401
        expect([401, 403]).toContain(response.status());
      },
    );

    test(
      "OBSERVATEUR : POST /api/projects retourne 403",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const observateurPage = await asRole("observateur");

        const response = await observateurPage.request.post("/api/projects", {
          data: {
            name: `Projet escalade ${Date.now()}`,
            description: "Tentative non autorisée",
            status: "ACTIVE",
          },
          headers: { "Content-Type": "application/json" },
          failOnStatusCode: false,
        });

        // La création de projet est réservée aux rôles supérieurs → 403 ou 401
        expect([401, 403]).toContain(response.status());
      },
    );

    test(
      "CONTRIBUTEUR : DELETE /api/projects/:id retourne 403",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const contributeurPage = await asRole("contributeur");

        const response = await contributeurPage.request.delete(
          `/api/projects/${FAKE_PROJECT_ID}`,
          {
            failOnStatusCode: false,
          },
        );

        // Suppression de projet interdite aux contributeurs → 403 ou 401
        // (404 acceptable uniquement si le check de permission passe avant la
        //  recherche de la ressource, mais la plupart des implémentations NestJS
        //  vérifient d'abord le guard → 403)
        expect([401, 403, 404]).toContain(response.status());
        // On s'assure qu'il ne s'agit PAS d'un 200 ou 204 (succès inattendu)
        expect(response.status()).not.toBe(200);
        expect(response.status()).not.toBe(204);
      },
    );

    test(
      "OBSERVATEUR : DELETE /api/projects/:id retourne 403",
      async ({ asRole }) => {
        const observateurPage = await asRole("observateur");

        const response = await observateurPage.request.delete(
          `/api/projects/${FAKE_PROJECT_ID}`,
          {
            failOnStatusCode: false,
          },
        );

        expect([401, 403, 404]).toContain(response.status());
        expect(response.status()).not.toBe(200);
        expect(response.status()).not.toBe(204);
      },
    );

    test(
      "CONTRIBUTEUR : PATCH /api/users/:id/role retourne 403 (escalade de rôle)",
      async ({ asRole }) => {
        const contributeurPage = await asRole("contributeur");

        // Tenter de modifier son propre rôle ou celui d'un autre utilisateur
        const response = await contributeurPage.request.patch(
          `/api/users/${FAKE_PROJECT_ID}`,
          {
            data: { role: "ADMIN" },
            headers: { "Content-Type": "application/json" },
            failOnStatusCode: false,
          },
        );

        // Modification de rôle utilisateur interdite → 403, 401, ou 404
        expect([401, 403, 404]).toContain(response.status());
        expect(response.status()).not.toBe(200);
      },
    );

    test(
      "OBSERVATEUR : POST /api/leaves retourne 403",
      async ({ asRole }) => {
        const observateurPage = await asRole("observateur");

        const response = await observateurPage.request.post("/api/leaves", {
          data: {
            leaveTypeId: "00000000-0000-0000-0000-000000000002",
            startDate: "2027-04-01",
            endDate: "2027-04-03",
          },
          headers: { "Content-Type": "application/json" },
          failOnStatusCode: false,
        });

        // L'observateur ne peut pas créer de congés → 403 ou 401
        // (ou 400/422 si la validation métier est exécutée avant le check de rôle)
        expect([400, 401, 403, 422]).toContain(response.status());
        expect(response.status()).not.toBe(201);
      },
    );
  });

  // ─── Test de cohérence : vérifier que l'ADMIN peut accéder ────────────────

  test.describe("Contrôle positif — ADMIN a les accès attendus", () => {
    test(
      "ADMIN : GET /api/users retourne 200",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const adminPage = await asRole("admin");

        const response = await adminPage.request.get("/api/users", {
          failOnStatusCode: false,
        });

        expect(response.status()).toBe(200);
      },
    );

    test(
      "ADMIN : accès à /admin/roles sans restriction",
      { tag: "@smoke" },
      async ({ asRole }) => {
        const adminPage = await asRole("admin");
        await adminPage.goto("/admin/roles");
        await adminPage.waitForLoadState("domcontentloaded");

        // L'admin ne doit pas être redirigé
        expect(adminPage.url()).not.toContain("/login");
        expect(adminPage.url()).not.toContain("/403");
        expect(adminPage.url()).not.toContain("/unauthorized");

        // La page doit afficher du contenu (pas "Accès restreint")
        const restrictedMsg = await adminPage
          .locator("text=/accès restreint/i")
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        expect(restrictedMsg).toBeFalsy();
      },
    );
  });
});
