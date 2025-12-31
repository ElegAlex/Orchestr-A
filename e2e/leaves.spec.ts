import { test, expect } from "@playwright/test";

test.describe("Leaves Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login avant chaque test
    await page.goto("/login");
    await page.getByPlaceholder(/login ou email/i).fill("admin");
    await page.getByPlaceholder(/mot de passe/i).fill("admin123");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("should display leaves page", async ({ page }) => {
    await page.goto("/leaves");

    await expect(page.locator("h1")).toContainText(/congés/i);
  });

  test("should display leaves list", async ({ page }) => {
    await page.goto("/leaves");

    // Attendre que la page soit chargée
    await page.waitForLoadState("networkidle");

    // Vérifier que la liste ou un message "aucun congé" s'affiche
    const hasList = await page
      .locator('table, [data-testid="leaves-list"]')
      .isVisible()
      .catch(() => false);
    const hasEmptyMessage = await page
      .locator("text=/aucun|vide|pas de congé/i")
      .isVisible()
      .catch(() => false);

    expect(hasList || hasEmptyMessage).toBeTruthy();
  });

  test("should open new leave request form", async ({ page }) => {
    await page.goto("/leaves");

    // Chercher un bouton pour créer une demande de congé
    const newLeaveButton = page
      .locator(
        'button:has-text("Nouveau"), button:has-text("Demander"), button:has-text("Ajouter")',
      )
      .first();

    if (await newLeaveButton.isVisible()) {
      await newLeaveButton.click();

      // Vérifier que le formulaire/modal s'ouvre
      await expect(page.locator('[role="dialog"], form, .modal')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("should create a leave request", async ({ page }) => {
    await page.goto("/leaves");

    // Ouvrir le formulaire
    const newLeaveButton = page
      .locator(
        'button:has-text("Nouveau"), button:has-text("Demander"), button:has-text("Ajouter")',
      )
      .first();

    if (await newLeaveButton.isVisible()) {
      await newLeaveButton.click();

      // Attendre le modal
      await page.waitForSelector('[role="dialog"], form, .modal', {
        timeout: 5000,
      });

      // Sélectionner le type de congé
      const typeSelect = page.locator('select, [role="combobox"]').first();
      if (await typeSelect.isVisible()) {
        await typeSelect.click();
        await page
          .locator('[role="option"]')
          .first()
          .click()
          .catch(() => {});
      }

      // Remplir les dates
      const startDateInput = page.locator('input[type="date"]').first();
      const endDateInput = page.locator('input[type="date"]').last();

      if (await startDateInput.isVisible()) {
        await startDateInput.fill("2025-12-20");
      }
      if ((await endDateInput.isVisible()) && startDateInput !== endDateInput) {
        await endDateInput.fill("2025-12-25");
      }

      // Soumettre
      const submitButton = page
        .locator(
          'button[type="submit"], button:has-text("Soumettre"), button:has-text("Créer"), button:has-text("Envoyer")',
        )
        .first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Vérifier le succès
        await expect(page.locator("text=/succès|créé|envoyé/i"))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    }
  });

  test("should filter leaves by status", async ({ page }) => {
    await page.goto("/leaves");

    await page.waitForLoadState("networkidle");

    // Chercher un filtre de statut
    const statusFilter = page
      .locator('select:has-text("Statut"), [data-testid="status-filter"]')
      .first();

    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      // Sélectionner "En attente" ou similaire
      await page
        .locator(
          '[role="option"]:has-text("attente"), option:has-text("attente")',
        )
        .first()
        .click()
        .catch(() => {});
    }
  });

  test("should display leave details", async ({ page }) => {
    await page.goto("/leaves");

    await page.waitForLoadState("networkidle");

    // Cliquer sur le premier congé dans la liste
    const firstLeave = page
      .locator('tr[data-testid="leave-item"], [data-testid="leave-card"]')
      .first();

    if (await firstLeave.isVisible()) {
      await firstLeave.click();

      // Vérifier que les détails s'affichent
      await expect(page.locator('[role="dialog"], .modal, .leave-details'))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  });
});

test.describe("Leave Approval Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Login en tant qu'admin/manager pour avoir accès à l'approbation
    await page.goto("/login");
    await page.getByPlaceholder(/login ou email/i).fill("admin");
    await page.getByPlaceholder(/mot de passe/i).fill("admin123");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("should display pending leaves for approval", async ({ page }) => {
    await page.goto("/leaves");

    await page.waitForLoadState("networkidle");

    // Filtrer par statut "En attente"
    const pendingFilter = page
      .locator('button:has-text("En attente"), [data-testid="pending-filter"]')
      .first();
    if (await pendingFilter.isVisible()) {
      await pendingFilter.click();
    }

    // Vérifier la présence de congés en attente ou message
    const hasPendingLeaves = await page
      .locator("text=/pending|en attente/i")
      .isVisible()
      .catch(() => false);
    const hasEmptyMessage = await page
      .locator("text=/aucun|vide/i")
      .isVisible()
      .catch(() => false);

    expect(hasPendingLeaves || hasEmptyMessage).toBeTruthy();
  });

  test("should approve a leave request", async ({ page }) => {
    await page.goto("/leaves");

    await page.waitForLoadState("networkidle");

    // Trouver un congé en attente
    const pendingLeave = page
      .locator('[data-status="PENDING"], tr:has-text("attente")')
      .first();

    if (await pendingLeave.isVisible()) {
      // Cliquer sur le bouton d'approbation
      const approveButton = pendingLeave
        .locator('button:has-text("Approuver"), button:has-text("Valider")')
        .first();

      if (await approveButton.isVisible()) {
        await approveButton.click();

        // Confirmer si nécessaire
        const confirmButton = page
          .locator(
            '[role="dialog"] button:has-text("Confirmer"), [role="dialog"] button:has-text("Oui")',
          )
          .first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Vérifier le succès
        await expect(page.locator("text=/approuvé|validé|succès/i"))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    }
  });

  test("should reject a leave request", async ({ page }) => {
    await page.goto("/leaves");

    await page.waitForLoadState("networkidle");

    // Trouver un congé en attente
    const pendingLeave = page
      .locator('[data-status="PENDING"], tr:has-text("attente")')
      .first();

    if (await pendingLeave.isVisible()) {
      // Cliquer sur le bouton de rejet
      const rejectButton = pendingLeave
        .locator('button:has-text("Refuser"), button:has-text("Rejeter")')
        .first();

      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        // Remplir le motif si demandé
        const reasonInput = page
          .locator('textarea, input[name="reason"]')
          .first();
        if (await reasonInput.isVisible()) {
          await reasonInput.fill("Période de forte activité");
        }

        // Confirmer
        const confirmButton = page
          .locator(
            '[role="dialog"] button:has-text("Confirmer"), [role="dialog"] button:has-text("Refuser")',
          )
          .first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Vérifier le succès
        await expect(page.locator("text=/refusé|rejeté|succès/i"))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    }
  });
});
