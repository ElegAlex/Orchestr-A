/**
 * Tests RBAC — Administration des rôles (route /fr/admin/roles, 2 onglets).
 *
 * Structure cible :
 *   - Onglet "Rôles" (actif par défaut) : CRUD sur entrées DB, rôles système
 *     sans action, rôles éditables (Renommer + Supprimer), filtre par template.
 *   - Onglet "Templates RBAC" : 26 templates read-only, aucun bouton Éditer,
 *     modale détail permissions (bannière "Permissions définies par le code"),
 *     compteur rôles rattachés cliquable → bascule onglet Rôles avec filtre.
 *   - Route protégée : users:manage_roles (redirect dashboard sinon).
 */

import { test, expect, type Page } from "../../fixtures/test-fixtures";

const BASE = process.env.CI ? "http://localhost:3000" : "http://localhost:4001";

async function gotoRolesAdmin(page: Page) {
  await page.goto(`${BASE}/fr/admin/roles`);
  await page.waitForLoadState("networkidle", { timeout: 20000 });
}

async function gotoTemplatesTab(page: Page) {
  await gotoRolesAdmin(page);
  await page.locator("[data-testid='tab-templates']").click();
  await page
    .locator("[data-testid='panel-templates']")
    .waitFor({ state: "visible" });
}

test.describe("UI — Administration des rôles (/fr/admin/roles)", () => {
  test("ADMIN : voit les 2 onglets et l'onglet Rôles est actif par défaut", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await gotoRolesAdmin(page);

    const tabRoles = page.locator("[data-testid='tab-roles']");
    const tabTemplates = page.locator("[data-testid='tab-templates']");
    await expect(tabRoles).toBeVisible();
    await expect(tabTemplates).toBeVisible();

    // Onglet Rôles actif par défaut.
    await expect(tabRoles).toHaveAttribute("aria-selected", "true");
    await expect(tabTemplates).toHaveAttribute("aria-selected", "false");
    await expect(page.locator("[data-testid='panel-roles']")).toBeVisible();
  });

  test(
    "Onglet Templates : 26 templates read-only, aucun bouton 'Éditer'",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoTemplatesTab(page);

      const templateCards = page.locator("[data-testid='template-card']");
      await expect(templateCards).toHaveCount(26);

      // AUCUN bouton d'édition sur les cartes templates (règle PO stricte).
      const editButtons = page.locator(
        "[data-testid='panel-templates'] button:has-text('Éditer')",
      );
      await expect(editButtons).toHaveCount(0);
    },
  );

  test(
    "Onglet Templates : 9 chips catégories et filtrage fonctionnel",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoTemplatesTab(page);

      const categoryChips = page.locator("[data-testid='category-chip']");
      await expect(categoryChips).toHaveCount(9);

      const initialCount = await page
        .locator("[data-testid='template-card']")
        .count();
      await categoryChips.nth(1).click();
      const filteredCount = await page
        .locator("[data-testid='template-card']")
        .count();
      expect(filteredCount).toBeLessThan(initialCount);
      expect(filteredCount).toBeGreaterThan(0);
    },
  );

  test(
    "Onglet Templates : click sur card ouvre modale détail avec bannière read-only",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoTemplatesTab(page);

      await page.locator("[data-testid='template-card']").first().click();

      const modal = page.locator("[role='dialog']");
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Bannière "Permissions définies par le code. Non modifiables..."
      await expect(
        modal.locator("[data-testid='readonly-banner']"),
      ).toBeVisible();
      await expect(
        modal.locator("[data-testid='readonly-banner']"),
      ).toContainText(/non modifiables/i);

      const permissionGroups = modal.locator(
        "[data-testid='permission-group']",
      );
      await expect(permissionGroups.first()).toBeVisible();
      expect(
        await modal.locator("[data-testid='permission-item']").count(),
      ).toBeGreaterThan(0);
    },
  );

  test(
    "Onglet Templates : click sur compteur rôles rattachés → bascule onglet Rôles avec filtre appliqué",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoTemplatesTab(page);

      // Cibler la card du template ADMIN (au moins 1 rôle rattaché : ADMIN lui-même).
      const adminCard = page
        .locator("[data-testid='template-card'][data-template-key='ADMIN']")
        .first();
      await expect(adminCard).toBeVisible();

      const counter = adminCard.locator("[data-testid='template-role-count']");
      await expect(counter).toBeVisible();
      await counter.click();

      // Bascule automatique sur l'onglet Rôles.
      await expect(page.locator("[data-testid='tab-roles']")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(
        page.locator("[data-testid='panel-roles']"),
      ).toBeVisible();

      // Filtre du dropdown réglé sur ADMIN.
      await expect(
        page.locator("[data-testid='roles-template-filter']"),
      ).toHaveValue("ADMIN");
    },
  );

  test(
    "Onglet Rôles : cocher 'Afficher rôles système' expose les lignes système sans action",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesAdmin(page);

      // Activer l'affichage des rôles système.
      await page.locator("[data-testid='roles-show-system']").check();

      // Au moins 1 ligne avec data-is-system=true (les 26 rôles seedés).
      const systemRows = page.locator(
        "[data-testid='role-row'][data-is-system='true']",
      );
      expect(await systemRows.count()).toBeGreaterThan(0);

      // AUCUNE action (Renommer ou Supprimer) sur une ligne système.
      const firstSystemRow = systemRows.first();
      await expect(
        firstSystemRow.locator("[data-testid='role-rename']"),
      ).toHaveCount(0);
      await expect(
        firstSystemRow.locator("[data-testid='role-delete']"),
      ).toHaveCount(0);
    },
  );

  test(
    "Onglet Rôles : ADMIN peut créer + renommer + supprimer un rôle éditable",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesAdmin(page);

      // Code ET label suffixés par timestamp — isole le rôle de ce run des
      // rôles laissés par les runs précédents (pas de nettoyage garanti).
      const stamp = Date.now();
      const uniqueCode = `E2E_CRUD_${stamp}`;
      const initialLabel = `Rôle E2E CRUD ${stamp}`;
      const renamedLabel = `${initialLabel} renommé`;

      // 1. Création.
      await page
        .getByRole("button", { name: /Nouveau rôle|Créer un rôle/i })
        .click();
      await page.locator("input[name='code']").fill(uniqueCode);
      await page.locator("input[name='label']").fill(initialLabel);
      await page
        .locator("select[name='templateKey']")
        .selectOption("BASIC_USER");
      await page.getByRole("button", { name: /^Créer$/ }).click();
      await expect(
        page.locator("text=/créé|enregistré/i").first(),
      ).toBeVisible({ timeout: 10000 });

      // Isoler par code unique (selector stable, pas sensible au re-render).
      const rowByCode = page
        .locator("[data-testid='role-row']")
        .filter({ has: page.locator(`span.font-mono:has-text("${uniqueCode}")`) });
      await expect(rowByCode).toHaveCount(1, { timeout: 10000 });

      // 2. Renommer.
      await rowByCode.locator("[data-testid='role-rename']").click();
      const input = rowByCode.locator("input[type='text']");
      await expect(input).toBeVisible({ timeout: 5000 });
      await input.fill(renamedLabel);
      await rowByCode.getByRole("button", { name: /Enregistrer/ }).click();
      await expect(
        rowByCode.locator(`text="${renamedLabel}"`),
      ).toBeVisible({ timeout: 10000 });

      // 3. Supprimer (dialogue confirm → accepter).
      page.once("dialog", (dialog) => void dialog.accept());
      await rowByCode.locator("[data-testid='role-delete']").click();
      await expect(
        page.locator("text=/supprimé/i").first(),
      ).toBeVisible({ timeout: 10000 });
      // La row du rôle supprimé doit avoir disparu.
      await expect(rowByCode).toHaveCount(0, { timeout: 10000 });
    },
  );

  test.fixme(
    "Onglet Rôles : suppression d'un rôle avec users rattachés déclenche toast 409",
    async ({ asRole }) => {
      // TODO: nécessite un fixture DB qui crée un rôle custom + assigne au
      // moins 1 user à ce rôle. Le flow E2E pur "créer le rôle" ne permet
      // pas d'y attacher un user sans API utilisateurs supplémentaire.
      // Test à réactiver quand une fixture dédiée sera disponible.
      void asRole;
    },
  );

  test(
    "BASIC_USER (contributeur) : navigation vers /admin/roles → 403 ou redirect dashboard",
    async ({ asRole }) => {
      const page = await asRole("contributeur");
      await gotoRolesAdmin(page);

      const url = page.url();
      const isRedirected =
        /\/dashboard|\/unauthorized|\/403|\/login/.test(url) ||
        !url.includes("/admin/roles");
      const has403 = await page
        .locator("text=/Accès refusé|Forbidden|Non autorisé|403/i")
        .first()
        .isVisible()
        .catch(() => false);

      expect(
        isRedirected || has403,
        `BASIC_USER ne devrait pas accéder à /admin/roles. URL: ${url}`,
      ).toBeTruthy();
    },
  );
});
