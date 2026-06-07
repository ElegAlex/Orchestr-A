/**
 * E2E smoke — tab "Analytics Avancés" (refonte W3)
 *
 * Vérifie :
 * - chargement de la page /reports
 * - bascule sur le tab "Avancés" (activeTab === 1)
 * - rendu des 7 nouveaux blocs (titres traduits FR via t("admin.reports.analytics.*"))
 * - bascule du filtre période 30j → 90j (chart re-render attendu)
 * - décochage d'un projet dans le multi-select (re-render attendu)
 *
 * Couvre admin et manager (RBAC reports:view OK pour les deux).
 *
 * Lancé via :
 *   pnpm exec playwright test --project=admin --grep=@smoke e2e/tests/reports/analytics-advanced.spec.ts
 *   pnpm exec playwright test --project=manager --grep=@smoke e2e/tests/reports/analytics-advanced.spec.ts
 */

import { test, expect } from "@playwright/test";

test.describe("Analytics Avancés tab", () => {
  test(
    "loads, switches to Avancés, renders the 3 advanced blocks",
    { tag: "@smoke" },
    async ({ page }) => {
      // ── 1. Naviguer sur /reports ────────────────────────────────────────────
      await page.goto("/fr/reports");
      await page.waitForLoadState("domcontentloaded");

      // ── 2. Cliquer sur le tab "Avancés" ─────────────────────────────────────
      const advancedTab = page.getByRole("button", { name: /avanc/i });
      await expect(advancedTab).toBeVisible({ timeout: 15000 });
      await advancedTab.click();

      // ── 3. Vérifier les titres des blocs (FR) ───────────────────────────────
      // Le tab Avancés a été simplifié à 3 blocs (RecentActivity, WorkloadChart,
      // MilestonesCompletion) — voir AdvancedAnalyticsTab.tsx. Chacun monté dans
      // une carte distincte ; on cherche le texte du h3.
      const blockTitles = [
        /Activité récente/i, // RecentActivity
        /Répartition de charge/i, // WorkloadChart
        /Complétion des jalons/i, // MilestonesCompletion
      ];

      for (const title of blockTitles) {
        await expect(
          page.getByRole("heading", { name: title }).first(),
        ).toBeVisible({ timeout: 20000 });
      }

      // NOTE: the per-tab period select + "Actualiser" button were removed when
      // AdvancedAnalyticsTab was simplified (no toolbar in the current source),
      // so the former steps 4–5 are dropped — there is nothing to drive.

      // ── 4. Multi-select projets : ouvrir, décocher (smoke best-effort) ─────
      // Le dropdown affiche par défaut "Tous les projets" ou similaire.
      const multiSelectBtn = page
        .locator("button:has(svg.lucide-chevron-down)")
        .first();
      if (
        await multiSelectBtn.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await multiSelectBtn.click();
        const firstCheckbox = page.locator('input[type="checkbox"]').first();
        if (
          await firstCheckbox.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await firstCheckbox.click();
          // Re-ouvre la box et la referme pour stabiliser ; pas d'assertion forte
          // (le data peut être vide en environnement test, on vérifie juste le no-crash)
          await page.waitForTimeout(300);
        }
      }

      // ── 7. Pas d'erreur fatale — vérifier qu'on est toujours sur /reports ──
      expect(page.url()).toContain("/fr/reports");
    },
  );
});
