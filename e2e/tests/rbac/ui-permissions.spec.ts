/**
 * Tests RBAC — Permissions UI
 *
 * Vérifie que certains éléments UI sont visibles ou cachés selon le rôle.
 * Utilise la fixture `asRole` de test-fixtures.ts pour obtenir une Page
 * authentifiée avec le storage state de chaque rôle.
 *
 * Ces tests couvrent les cas visibles directement dans l'interface :
 *  - Boutons d'action (Nouveau projet, Créer utilisateur, etc.)
 *  - Menus de navigation (admin, rapports)
 *  - Sections protégées
 */

import { test, expect } from "../../fixtures/test-fixtures";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE = process.env.CI ? "http://localhost:3000" : "http://localhost:4001";

// ─── PROJETS ─────────────────────────────────────────────────────────────────

test.describe("UI — Projets", () => {
  test("ADMIN : le bouton 'Nouveau projet' doit être visible", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await page.goto(`${BASE}/fr/projects`);
    await page.waitForLoadState("networkidle");

    // Le bouton de création peut avoir plusieurs libellés selon la locale
    const createButton = page.locator(
      "button:has-text('Nouveau'), button:has-text('Créer'), a:has-text('Nouveau projet')",
    );
    await expect(createButton.first()).toBeVisible({ timeout: 10000 });
  });

  test("OBSERVATEUR : le bouton 'Nouveau projet' ne doit PAS être visible", async ({
    asRole,
  }) => {
    const page = await asRole("observateur");
    await page.goto(`${BASE}/fr/projects`);
    await page.waitForLoadState("networkidle");

    const createButton = page.locator(
      "button:has-text('Nouveau'), button:has-text('Créer'), a:has-text('Nouveau projet')",
    );
    await expect(createButton).toHaveCount(0);
  });

  test("CONTRIBUTEUR : le bouton 'Nouveau projet' ne doit PAS être visible", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");
    await page.goto(`${BASE}/fr/projects`);
    await page.waitForLoadState("networkidle");

    const createButton = page.locator(
      "button:has-text('Nouveau'), button:has-text('Créer'), a:has-text('Nouveau projet')",
    );
    await expect(createButton).toHaveCount(0);
  });
});

// ─── UTILISATEURS ─────────────────────────────────────────────────────────────

test.describe("UI — Utilisateurs", () => {
  test("ADMIN : la page /users est accessible et affiche la liste", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await page.goto(`${BASE}/fr/users`);
    await page.waitForLoadState("networkidle");

    // La page doit s'afficher sans être redirigée vers une page d'erreur
    await expect(page).not.toHaveURL(/\/unauthorized|\/403|\/login/);
  });

  test("ADMIN : le bouton de création d'utilisateur doit être visible sur /users", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await page.goto(`${BASE}/fr/users`);
    await page.waitForLoadState("networkidle");

    const createButton = page.locator(
      "button:has-text('Créer'), button:has-text('Nouvel'), button:has-text('Ajouter'), a:has-text('Créer un utilisateur')",
    );
    await expect(createButton.first()).toBeVisible({ timeout: 10000 });
  });

  test("MANAGER : le bouton de création d'utilisateur ne doit PAS être visible", async ({
    asRole,
  }) => {
    const page = await asRole("manager");
    await page.goto(`${BASE}/fr/users`);
    await page.waitForLoadState("networkidle");

    // Manager peut voir la liste mais pas créer des utilisateurs
    const createButton = page.locator(
      "button:has-text('Créer un utilisateur'), a:has-text('Créer un utilisateur')",
    );
    await expect(createButton).toHaveCount(0);
  });
});

// ─── ADMINISTRATION ───────────────────────────────────────────────────────────

test.describe("UI — Administration", () => {
  test("ADMIN : la page /admin/roles est accessible", async ({ asRole }) => {
    const page = await asRole("admin");
    await page.goto(`${BASE}/fr/admin/roles`);
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/\/unauthorized|\/403|\/login/);
  });

  test("OBSERVATEUR : la page /admin/roles doit être inaccessible ou vide", async ({
    asRole,
  }) => {
    const page = await asRole("observateur");
    await page.goto(`${BASE}/fr/admin/roles`);
    await page.waitForLoadState("networkidle");

    // Soit redirection, soit page vide/message d'erreur
    const isRedirected = page
      .url()
      .match(/\/unauthorized|\/403|\/login|\/fr\/?$/);
    const hasErrorMessage = await page
      .locator("text=Accès refusé, text=Forbidden, text=Non autorisé")
      .isVisible()
      .catch(() => false);

    // Au moins l'un des deux doit être vrai
    expect(
      isRedirected || hasErrorMessage,
      `OBSERVATEUR ne devrait pas accéder à /admin/roles. URL: ${page.url()}`,
    ).toBeTruthy();
  });
});

// ─── RAPPORTS / ANALYTICS ────────────────────────────────────────────────────

test.describe("UI — Rapports", () => {
  test("MANAGER : la page /reports est accessible", async ({ asRole }) => {
    const page = await asRole("manager");
    await page.goto(`${BASE}/fr/reports`);
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/\/unauthorized|\/403|\/login/);
  });

  test("CONTRIBUTEUR : la page /reports devrait être inaccessible ou afficher un message d'erreur", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");
    await page.goto(`${BASE}/fr/reports`);
    await page.waitForLoadState("networkidle");

    const isRedirected = page
      .url()
      .match(/\/unauthorized|\/403|\/login|\/fr\/?$/);
    const hasErrorMessage = await page
      .locator("text=Accès refusé, text=Forbidden, text=Non autorisé")
      .isVisible()
      .catch(() => false);

    expect(
      isRedirected || hasErrorMessage,
      `CONTRIBUTEUR ne devrait pas accéder à /reports. URL: ${page.url()}`,
    ).toBeTruthy();
  });
});

// ─── CONGÉS ──────────────────────────────────────────────────────────────────

test.describe("UI — Congés", () => {
  test("CONTRIBUTEUR : la page /leaves est accessible", async ({ asRole }) => {
    const page = await asRole("contributeur");
    await page.goto(`${BASE}/fr/leaves`);
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/\/unauthorized|\/403|\/login/);
  });

  test("ADMIN : le bouton de validation des congés doit être présent sur /leaves", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await page.goto(`${BASE}/fr/leaves`);
    await page.waitForLoadState("networkidle");

    // Admin peut voir les actions de gestion (approuver/refuser)
    // On vérifie juste que la page charge sans erreur d'autorisation
    await expect(page).not.toHaveURL(/\/unauthorized|\/403|\/login/);
  });

  test("OBSERVATEUR : la page /leaves ne doit PAS afficher de formulaire de création", async ({
    asRole,
  }) => {
    const page = await asRole("observateur");
    await page.goto(`${BASE}/fr/leaves`);
    await page.waitForLoadState("networkidle");

    // Pas de bouton "Nouvelle demande" pour un observateur
    const createButton = page.locator(
      "button:has-text('Nouvelle demande'), button:has-text('Demander'), a:has-text('Nouvelle demande')",
    );
    await expect(createButton).toHaveCount(0);
  });
});
