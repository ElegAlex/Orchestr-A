/**
 * V6-A Spec 3 — Dashboard OBSERVATEUR hiding (test négatif, D8)
 *
 * OBSERVATEUR a accès au dashboard (dashboard:read implicite via l'absence
 * de gating) mais N'A PAS `time_tracking:create`. D8 impose :
 *   - sous-section "Mes tâches à venir" visible, mais les cartes n'affichent
 *     AUCUN input[type="number"] inline (le QuickTimeEntryInput n'est pas
 *     rendu pour ce rôle — gating côté TaskCard via canLogTime).
 *   - sous-section "Mes tâches non déclarées" COMPLÈTEMENT absente (le
 *     wrapper <section> lui-même est gaté par `canLogTime` dans
 *     MyTasksSection).
 *
 * Ce test est un check d'état statique : on ne crée pas de fixtures, on
 * vérifie juste la structure HTML après chargement du dashboard.
 */

import * as fs from "fs";
import * as path from "path";
import { test, expect } from "@playwright/test";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  ".claude-screenshots",
  "dashboard-my-tasks",
);
function screenshotPath(name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  return path.join(SCREENSHOT_DIR, name);
}

test.describe("Dashboard - OBSERVATEUR hiding", () => {
  // Limite au project observateur (tests/ est scanné par les 6 projects).
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "observateur",
    "Test négatif spécifique au rôle OBSERVATEUR",
  );

  test("OBSERVATEUR voit le dashboard mais PAS l'input inline ni la section non déclarées (D8)", async ({
    page,
  }) => {
    await page.goto("/fr/dashboard");

    // ── Accès au dashboard OK : H2 "Mes tâches" visible ──────────────────────
    await expect(
      page.getByRole("heading", { name: /^mes tâches$/i, level: 2 }),
    ).toBeVisible({ timeout: 15_000 });

    // ── Sous-section "Mes tâches à venir" visible ────────────────────────────
    await expect(
      page.getByRole("heading", { name: /mes tâches à venir/i, level: 3 }),
    ).toBeVisible();

    // ── Aucun input[type="number"] dans les cartes "upcoming" ────────────────
    // Scope au panneau "Mes tâches" pour éviter de faux positifs (un autre
    // input number pourrait exister ailleurs sur la page — Personal Todos
    // utilise un input text, pas number, mais on borne par sûreté).
    const tasksSection = page.locator("section", {
      has: page.getByRole("heading", {
        name: /mes tâches à venir/i,
        level: 3,
      }),
    });
    await expect(tasksSection).toBeVisible();
    await expect(tasksSection.locator('input[type="number"]')).toHaveCount(0);

    // ── Section "Mes tâches non déclarées" TOTALEMENT absente ────────────────
    // Le toggle button est le seul rendu si canLogTime — absent pour OBS.
    await expect(
      page.getByRole("button", { name: /mes tâches non déclarées/i }),
    ).toHaveCount(0);

    // Le panneau associé non plus.
    await expect(page.locator("#dashboard-undeclared-panel")).toHaveCount(0);

    // Aucun titre h3 "non déclarées" n'existe.
    await expect(
      page.getByRole("heading", { name: /mes tâches non déclarées/i }),
    ).toHaveCount(0);

    // ── Screenshot pour review manuelle ──────────────────────────────────────
    await page.screenshot({
      path: screenshotPath("observateur-hidden.png"),
      fullPage: true,
    });
  });
});
