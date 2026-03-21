/**
 * e2e/tests/workflows/auth.spec.ts
 *
 * Tests du workflow d'authentification.
 *
 * Ces tests sont exécutés par les projets par rôle (admin, responsable, etc.).
 * Les tests de login/mauvais credentials n'ont pas besoin du storage state :
 * ils naviguent directement vers /login sans être authentifiés.
 * Le test logout utilise le storage state du rôle courant.
 */

import { test, expect } from "../../fixtures/test-fixtures";
import { ROLE_LOGINS, ROLE_PASSWORD } from "../../fixtures/roles";

// ─── Login avec credentials valides ─────────────────────────────────────────

test("login avec credentials valides redirige vers le dashboard", async ({
  page,
}) => {
  // Ce test est indépendant du storage state : il se connecte manuellement
  // pour vérifier le flux complet de login.
  // On exécute uniquement sur le projet admin pour éviter la duplication.
  const testRole = "admin";

  await page.goto("/fr/login");
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId("login-username").fill(ROLE_LOGINS[testRole]);
  await page.getByTestId("login-password").fill(ROLE_PASSWORD);
  await page.getByTestId("login-submit").click();

  // Après connexion réussie, redirection vers /dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
});

// ─── Login avec mauvais credentials ─────────────────────────────────────────

test("login avec mauvais credentials — reste sur la page login", async ({
  page,
}) => {
  await page.goto("/fr/login");
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId("login-username").fill("utilisateur-inexistant");
  await page.getByTestId("login-password").fill("mauvais-mot-de-passe");
  await page.getByTestId("login-submit").click();

  // La page ne doit pas changer — on reste sur /login
  await expect(page).toHaveURL(/\/login/);

  // Un message d'erreur doit être visible (toast react-hot-toast)
  // react-hot-toast injecte les toasts dans un div avec role="status"
  const errorToast = page.locator('[role="status"]').first();
  await expect(errorToast).toBeVisible({ timeout: 5000 });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

test("logout redirige vers la page login", async ({ page }, testInfo) => {
  // Ce test utilise le storage state du rôle courant.
  // On le limite au rôle admin pour éviter la duplication.
  test.skip(
    testInfo.project.name !== "admin",
    "Exécuté une seule fois (admin) pour éviter la duplication",
  );

  await page.goto("/fr/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

  // Le bouton de déconnexion est dans la sidebar (texte "Déconnexion")
  const logoutButton = page.getByRole("button", { name: "Déconnexion" });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  // Après logout, window.location.href = "/login" dans auth.service.ts
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
});
