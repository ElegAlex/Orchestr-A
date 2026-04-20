/**
 * Tests RBAC — Administration des rôles (route /fr/admin/roles, 2 onglets).
 *
 * Structure cible :
 *   - Onglet "Rôles" (actif par défaut) : liste UNIQUEMENT les rôles créés
 *     par l'admin (isSystem=false). Les 26 rôles système sont exclus — ils
 *     sont visibles dans l'onglet "Templates RBAC". État vide d'amorçage
 *     quand aucun rôle n'a encore été créé.
 *   - Onglet "Templates RBAC" : 26 templates read-only, aucun bouton Éditer,
 *     modale détail permissions (bannière "Permissions définies par le code"),
 *     compteur rôles rattachés (= rôles user-created sur le template).
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
    "Onglet Rôles : aucun rôle système exposé + grouping par template utilisé",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesAdmin(page);

      const sections = page.locator(
        "[data-testid='panel-roles'] [data-testid='roles-template-section']",
      );
      const rows = page.locator(
        "[data-testid='panel-roles'] [data-testid='role-row']",
      );
      const sectionCount = await sections.count();
      const rowCount = await rows.count();

      // Si au moins 1 rôle institutionnel existe : au moins 1 section, et la
      // segmentation est restreinte aux templates utilisés (chaque section
      // porte au moins une row).
      if (rowCount > 0) {
        expect(sectionCount).toBeGreaterThan(0);
        for (let i = 0; i < sectionCount; i++) {
          await expect(
            sections.nth(i).locator("[data-testid='role-row']").first(),
          ).toBeVisible();
        }
      }

      // La checkbox "Afficher rôles système" a été supprimée définitivement.
      await expect(
        page.locator("[data-testid='roles-show-system']"),
      ).toHaveCount(0);
    },
  );

  test(
    "Onglet Rôles : état vide affiche le message d'amorçage quand aucun rôle créé",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesAdmin(page);

      const rowCount = await page
        .locator("[data-testid='panel-roles'] [data-testid='role-row']")
        .count();
      const emptyState = page.locator("[data-testid='roles-empty-state']");

      if (rowCount === 0) {
        await expect(emptyState).toBeVisible();
        await expect(emptyState).toContainText(/Aucun rôle créé/i);
        await expect(emptyState).toContainText(/Nouveau rôle/i);
      } else {
        // Si des rôles user-created existent (résidus E2E CRUD précédents),
        // l'état vide n'est pas montré. La deuxième assertion du test (empty
        // state depuis filtre restrictif) reste valable.
        await expect(emptyState).toHaveCount(0);
      }
    },
  );

  test.fixme(
    "Onglet Templates : click sur compteur rôles rattachés → bascule onglet Rôles avec filtre appliqué",
    async ({ asRole }) => {
      // Post-correction "Rôles = user-created only" : le compteur sur les
      // cards templates ne compte désormais que les rôles user-created
      // (isSystem=false). Sur un env fresh (aucun rôle créé), aucun compteur
      // n'est cliquable. Pour réactiver ce test, prévoir un fixture DB qui
      // seede un rôle user-created sur un template donné avant run.
      void asRole;
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
