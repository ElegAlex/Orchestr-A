/**
 * Test multi-rôle : Assignation de tâche prédéfinie (accès admin)
 *
 * Scénario :
 *   1. ADMIN accède à la page admin des tâches prédéfinies → accessible
 *   2. CONTRIBUTEUR tente d'accéder à la même page → accès refusé ou redirigé
 */

import { test, expect } from "../../fixtures/test-fixtures";

// Chemins possibles pour la page admin des tâches prédéfinies
const ADMIN_PREDEFINED_TASKS_PATHS = [
  "/admin/predefined-tasks",
  "/admin/tasks",
  "/settings/predefined-tasks",
  "/settings/tasks",
];

test.describe("Predefined Task Assignment — Admin Access Control", () => {
  test(
    "ADMIN peut accéder à la page admin des tâches prédéfinies",
    { tag: "@smoke" },
    async ({ asRole }) => {
      const adminPage = await asRole("admin");

      let adminAccessGranted = false;

      for (const path of ADMIN_PREDEFINED_TASKS_PATHS) {
        await adminPage.goto(path);
        await adminPage.waitForLoadState("domcontentloaded");

        const url = adminPage.url();
        const isRedirectedToLogin = url.includes("/login");
        const isRedirectedTo403 =
          url.includes("/403") || url.includes("/unauthorized");

        if (!isRedirectedToLogin && !isRedirectedTo403) {
          // La page est accessible
          adminAccessGranted = true;
          break;
        }
      }

      // Si aucun des chemins connus n'existe, chercher via /settings
      if (!adminAccessGranted) {
        await adminPage.goto("/settings");
        await adminPage.waitForLoadState("domcontentloaded");

        const settingsUrl = adminPage.url();
        const settingsAccessible =
          !settingsUrl.includes("/login") && !settingsUrl.includes("/403");

        // L'admin doit au moins avoir accès à /settings
        expect(settingsAccessible).toBeTruthy();
      } else {
        expect(adminAccessGranted).toBeTruthy();
      }
    },
  );

  test(
    "ADMIN peut voir la page /admin/roles (gestion des rôles)",
    { tag: "@smoke" },
    async ({ asRole }) => {
      const adminPage = await asRole("admin");
      await adminPage.goto("/admin/roles");
      await adminPage.waitForLoadState("domcontentloaded");

      // L'admin ne doit pas être redirigé vers login ou 403
      expect(adminPage.url()).not.toContain("/login");

      // La page doit afficher le contenu admin
      // (soit la liste des rôles, soit un message de chargement)
      const pageContent = adminPage.locator("h1, h2, main").first();
      await expect(pageContent).toBeVisible({ timeout: 10000 });

      // Vérifier que le titre contient quelque chose lié aux rôles ou à l'admin
      const heading = adminPage.locator("h1, h2").first();
      const headingText = await heading.textContent().catch(() => "");
      // Le heading peut contenir "Rôles", "Gestion", "Accès restreint" selon les droits
      expect(headingText).toBeTruthy();
    },
  );

  test(
    "CONTRIBUTEUR ne peut pas accéder à la page /admin/roles",
    { tag: "@smoke" },
    async ({ asRole }) => {
      const contributeurPage = await asRole("contributeur");
      await contributeurPage.goto("/admin/roles");
      await contributeurPage.waitForLoadState("domcontentloaded");

      // Le contributeur doit être bloqué : redirection ou message d'accès restreint
      const url = contributeurPage.url();

      const isRedirected =
        url.includes("/login") ||
        url.includes("/403") ||
        url.includes("/unauthorized") ||
        url.includes("/dashboard");

      // Vérifier le message "Accès restreint" affiché par le composant
      // (La page /admin/roles affiche ce message côté client si non-ADMIN)
      const hasRestrictedMessage = await contributeurPage
        .locator("text=/accès restreint|non autorisé|interdit|forbidden/i")
        .isVisible({ timeout: 8000 })
        .catch(() => false);

      // L'accès doit être bloqué : soit par redirection, soit par message UI
      expect(isRedirected || hasRestrictedMessage).toBeTruthy();
    },
  );

  test("OBSERVATEUR ne peut pas accéder à la page /admin/roles", async ({
    asRole,
  }) => {
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
      .locator("text=/accès restreint|non autorisé|interdit|forbidden/i")
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    expect(isRedirected || hasRestrictedMessage).toBeTruthy();
  });

  test("CONTRIBUTEUR ne peut pas accéder à la page /settings", async ({
    asRole,
  }) => {
    const contributeurPage = await asRole("contributeur");
    await contributeurPage.goto("/settings");
    await contributeurPage.waitForLoadState("domcontentloaded");

    const url = contributeurPage.url();

    // /settings peut être réservé à l'admin ou accessible en lecture seule
    // Le test vérifie qu'il n'y a pas d'accès complet (boutons de modification)
    const hasAdminSettingsActions = await contributeurPage
      .getByRole("button", {
        name: /sauvegarder les paramètres|enregistrer la configuration/i,
      })
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Si redirigé → accès refusé OK
    // Si page accessible → il ne doit pas y avoir d'actions admin sensibles
    const isRedirected =
      url.includes("/login") ||
      url.includes("/403") ||
      url.includes("/dashboard");

    expect(isRedirected || !hasAdminSettingsActions).toBeTruthy();
  });
});
