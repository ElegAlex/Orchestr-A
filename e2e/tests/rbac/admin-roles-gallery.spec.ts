/**
 * Tests RBAC — Galerie d'admin des rôles (route /fr/admin/roles)
 *
 * Cible la NOUVELLE UI V1D qui remplacera l'actuelle /fr/admin/roles (V2).
 * Structure attendue :
 *   - 26 templates RBAC affichés en cards, groupés par 9 catégories
 *   - Chips/badges de catégorie pour filtrage
 *   - Click sur card → modale détail (liste des permissions groupées par module)
 *   - Formulaire de création de rôle custom :
 *       code (SCREAMING_SNAKE_CASE), label, templateKey (dropdown)
 *   - Route protégée : ADMIN uniquement (users:manage_roles)
 */

import { test, expect, type Page } from "../../fixtures/test-fixtures";

const BASE = process.env.CI ? "http://localhost:3000" : "http://localhost:4001";

async function gotoRolesGallery(page: Page) {
  await page.goto(`${BASE}/fr/admin/roles`);
  await page.waitForLoadState("networkidle", { timeout: 20000 });
}

test.describe("UI — Galerie rôles V1D (/fr/admin/roles)", () => {
  test(
    "ADMIN : voit 26 templates affichés, groupés par 9 catégories",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesGallery(page);

      // 26 cards de templates visibles
      const templateCards = page.locator("[data-testid='template-card']");
      await expect(templateCards).toHaveCount(26);

      // 9 chips de catégories
      const categoryChips = page.locator("[data-testid='category-chip']");
      await expect(categoryChips).toHaveCount(9);
    },
  );

  test(
    "ADMIN : cliquer sur une chip catégorie filtre les cards affichées",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesGallery(page);

      const categoryChips = page.locator("[data-testid='category-chip']");
      const initialCount = await page
        .locator("[data-testid='template-card']")
        .count();

      // Click sur la première chip (autre que "Tous")
      await categoryChips.nth(1).click();

      // Le nombre de cards affichées doit avoir diminué (sauf cas dégénéré où
      // une catégorie contient tous les templates — peu probable à 9 catégories)
      const filteredCount = await page
        .locator("[data-testid='template-card']")
        .count();
      expect(filteredCount).toBeLessThan(initialCount);
      expect(filteredCount).toBeGreaterThan(0);
    },
  );

  test(
    "ADMIN : click sur une card template ouvre une modale avec permissions groupées par module",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesGallery(page);

      // Click sur la 1ère card template
      await page.locator("[data-testid='template-card']").first().click();

      // Une modale doit apparaître
      const modal = page.locator("[role='dialog']");
      await expect(modal).toBeVisible({ timeout: 5000 });

      // La modale contient des sections de permissions groupées par module
      const permissionGroups = modal.locator("[data-testid='permission-group']");
      await expect(permissionGroups.first()).toBeVisible();

      // Au moins une permission listée
      const permissionItems = modal.locator("[data-testid='permission-item']");
      expect(await permissionItems.count()).toBeGreaterThan(0);
    },
  );

  test(
    "ADMIN : peut créer un rôle custom via formulaire (code, label, templateKey)",
    async ({ asRole }) => {
      const page = await asRole("admin");
      await gotoRolesGallery(page);

      // Ouvrir le formulaire de création
      await page.getByRole("button", { name: /Nouveau rôle|Créer un rôle/i }).click();

      // Remplir le formulaire — code suffixé pour idempotence (éviter 409 aux
      // runs répétés sur la même DB).
      const uniqueCode = `CUSTOM_TEST_ROLE_${Date.now()}`;
      await page.locator("input[name='code']").fill(uniqueCode);
      await page.locator("input[name='label']").fill("Rôle de test custom");
      await page.locator("select[name='templateKey']").selectOption("BASIC_USER");

      // Soumettre
      await page.getByRole("button", { name: /Enregistrer|Créer/i }).click();

      // Toast ou redirection de succès
      const success = page.locator("text=/créé|enregistré/i");
      await expect(success.first()).toBeVisible({ timeout: 10000 });
    },
  );

  test(
    "BASIC_USER (contributeur) : navigation vers /admin/roles → 403 ou redirect dashboard",
    async ({ asRole }) => {
      const page = await asRole("contributeur");
      await gotoRolesGallery(page);

      // Comportement attendu : redirect dashboard OU 403/unauthorized
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
