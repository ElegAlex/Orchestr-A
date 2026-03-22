/**
 * e2e/tests/workflows/telework.spec.ts
 *
 * Tests du workflow de gestion du télétravail.
 *
 * Page : /fr/telework
 * Titre i18n : clé "hr.telework.title" → "Télétravail" (à partir de la page)
 *
 * La page affiche un calendrier sur 6 mois. Chaque case de jour ouvrable est
 * cliquable pour basculer la déclaration de télétravail.
 *
 * La section "Jours fixes" (récurrence) est visible pour tous et contient
 * le bouton de configuration ainsi que la liste des règles actives.
 */

import { test, expect } from "../../fixtures/test-fixtures";

// ─── Page télétravail accessible ─────────────────────────────────────────────

test("user peut voir la page télétravail", async ({ page }) => {
  await page.goto("/fr/telework");
  await expect(page).toHaveURL(/\/telework/);

  // Un titre h1 doit être présent — le texte exact dépend de la traduction
  // mais la page doit se charger sans erreur
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });
});

// ─── Calendrier mensuel ───────────────────────────────────────────────────────

test("le calendrier télétravail affiche les mois", async ({ page }) => {
  await page.goto("/fr/telework");

  // La page affiche 6 calendriers mensuels avec un en-tête coloré (bg-blue-600)
  // Chaque mois a un header avec son nom
  const monthHeaders = page.locator(".bg-blue-600.text-white");
  await expect(monthHeaders.first()).toBeVisible({ timeout: 10000 });

  // Il doit y avoir au moins un mois affiché
  const count = await monthHeaders.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// ─── Déclarer du télétravail ──────────────────────────────────────────────────

test("user peut cliquer sur un jour pour déclarer du télétravail", async ({
  page,
}, testInfo) => {
  // Ce test est limité à un seul rôle pour éviter les conflits de données
  test.skip(
    testInfo.project.name !== "contributeur",
    "Exécuté uniquement par le rôle contributeur",
  );

  await page.goto("/fr/telework");

  // Attendre le chargement du calendrier
  const monthHeaders = page.locator(".bg-blue-600.text-white");
  await expect(monthHeaders.first()).toBeVisible({ timeout: 10000 });

  // Trouver un jour ouvrable cliquable (non weekend, non grisé)
  // Les jours ouvrables ont la classe cursor-pointer et bg-white
  const clickableDays = page.locator(".aspect-square.cursor-pointer.bg-white");

  const dayCount = await clickableDays.count();
  if (dayCount === 0) {
    // Aucun jour disponible ce mois-ci (rare) : on passe le test
    test.skip(true, "Aucun jour ouvrable disponible dans la période affichée");
    return;
  }

  // Cliquer sur le premier jour ouvrable disponible
  await clickableDays.first().click();

  // Après le clic, un toast de confirmation doit apparaître
  // react-hot-toast utilise role="status"
  const toast = page.locator('[role="status"]').first();
  await expect(toast).toBeVisible({ timeout: 5000 });
});

// ─── Section jours fixes (récurrence) ────────────────────────────────────────

test("user peut voir la section de configuration des jours fixes", async ({
  page,
}) => {
  await page.goto("/fr/telework");

  // Le panneau "Jours fixes" (recurringRules) doit être visible
  // La traduction fr contient "recurringRules.title"
  // On cherche le bouton "Configurer des jours fixes" ou le titre de la section
  const recurringPanel = page.locator(
    ".bg-white.rounded-lg.shadow-sm.border.border-gray-200",
  );
  await expect(recurringPanel.first()).toBeVisible({ timeout: 10000 });

  // Le bouton de configuration de jours fixes doit être présent
  // Son texte contient le contenu de t("recurringRules.configureButton")
  // En inspectant la page, c'est le bouton indigo "+ Configurer..."
  const configButton = page.locator(".bg-indigo-600").first();
  await expect(configButton).toBeVisible({ timeout: 10000 });
});
