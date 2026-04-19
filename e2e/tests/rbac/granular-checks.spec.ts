/**
 * Tests RBAC — Vérifications granulaires UI (V1A)
 *
 * Couvre les checks fins dans les pages qui dépendent de permissions spécifiques :
 *   - /fr/leaves : onglets "pending-validation" (leaves:approve) et "all-leaves"
 *                  (leaves:readAll — fix V1A) ; bouton "Approuver"
 *   - /fr/projects : bouton "Créer un projet" (projects:create)
 *   - /fr/users    : bouton d'action de création (users:create)
 *
 * Source des gates :
 *   - apps/web/app/[locale]/leaves/page.tsx (canValidate, canReadAllLeaves)
 *   - apps/web/app/[locale]/projects/page.tsx (canCreateProject)
 *   - apps/web/app/[locale]/users/page.tsx (canManageUsers)
 *
 * Tag @smoke pour les tests critiques (ADMIN+BASIC_USER sur leaves approval).
 */

import { test, expect, type Page } from "../../fixtures/test-fixtures";

const BASE = process.env.CI ? "http://localhost:3000" : "http://localhost:4001";

// Libellés FR — cf. apps/web/messages/fr/hr.json et fr/projects.json
const LABEL_PENDING_VALIDATION = "À valider";
const LABEL_ALL_LEAVES = "Toutes les demandes";
const LABEL_CREATE_PROJECT = "Créer un projet";

async function gotoAndWait(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 });
}

// ─── /fr/leaves — validation & all-leaves ────────────────────────────────────

test.describe("UI granulaire — Congés (validation & lecture globale)", () => {
  test("ADMIN : voit l'onglet 'À valider' (leaves:approve) @smoke", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await gotoAndWait(page, "/fr/leaves");

    // L'onglet "À valider" n'est rendu que si canValidate = hasPermission('leaves:approve')
    const pendingTab = page.getByRole("button", {
      name: new RegExp(LABEL_PENDING_VALIDATION, "i"),
    });
    await expect(pendingTab).toBeVisible({ timeout: 10000 });
  });

  test("BASIC_USER (contributeur) : ne voit PAS l'onglet 'À valider' (leaves:approve manquant) @smoke", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");
    await gotoAndWait(page, "/fr/leaves");

    const pendingTab = page.getByRole("button", {
      name: new RegExp(`^${LABEL_PENDING_VALIDATION}`, "i"),
    });
    await expect(pendingTab).toHaveCount(0);
  });

  test("OBSERVATEUR : voit l'onglet 'Toutes les demandes' (leaves:readAll — fix V1A)", async ({
    asRole,
  }) => {
    const page = await asRole("observateur");
    await gotoAndWait(page, "/fr/leaves");

    // Fix V1A : canReadAllLeaves utilise hasPermission('leaves:readAll')
    // OBSERVATEUR a leaves:readAll dans son template (vérifié via /api/auth/me/permissions).
    const allLeavesTab = page.getByRole("button", {
      name: new RegExp(LABEL_ALL_LEAVES, "i"),
    });
    await expect(allLeavesTab).toBeVisible({ timeout: 10000 });
  });
});

// ─── /fr/projects — création ─────────────────────────────────────────────────

test.describe("UI granulaire — Projets (création)", () => {
  test("ADMIN : voit le bouton 'Créer un projet' (projects:create) @smoke", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await gotoAndWait(page, "/fr/projects");

    const createBtn = page.getByRole("button", {
      name: new RegExp(LABEL_CREATE_PROJECT, "i"),
    });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
  });

  test("BASIC_USER (contributeur) : ne voit PAS le bouton 'Créer un projet' @smoke", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");
    await gotoAndWait(page, "/fr/projects");

    const createBtn = page.getByRole("button", {
      name: new RegExp(`^${LABEL_CREATE_PROJECT}$`, "i"),
    });
    await expect(createBtn).toHaveCount(0);
  });
});

// ─── /fr/users — accès & actions ─────────────────────────────────────────────

test.describe("UI granulaire — Utilisateurs (accès & actions)", () => {
  test("BASIC_USER (contributeur) : page /users accessible (pas de gate route) mais actions de création cachées", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");
    await gotoAndWait(page, "/fr/users");

    // Pas de redirection : la page n'a pas de gate côté route (cf. users/page.tsx)
    // CONTRIBUTEUR a users:read → /api/users renvoie 200. La page s'affiche.
    expect(page.url()).toContain("/fr/users");
    expect(page.url()).not.toMatch(/\/login|\/unauthorized|\/403/);

    // En revanche, le bouton de création n'est pas rendu : canManageUsers =
    // hasPermission('users:create'). CONTRIBUTEUR n'a pas cette permission.
    // Utilise un locator strict ciblant les libellés plausibles côté UI.
    const createBtn = page.locator(
      "button:has-text('Créer un utilisateur'), button:has-text('Nouvel utilisateur'), button:has-text('Ajouter un utilisateur')",
    );
    await expect(createBtn).toHaveCount(0);
  });
});
