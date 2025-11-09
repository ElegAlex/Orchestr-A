import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText(/connexion/i);
    await expect(page.getByPlaceholder(/login ou email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/mot de passe/i)).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/login ou email/i).fill('wronguser');
    await page.getByPlaceholder(/mot de passe/i).fill('wrongpass');
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Attendre le message d'erreur
    await expect(page.locator('text=/incorrect|invalide|erreur/i')).toBeVisible({ timeout: 5000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/login ou email/i).fill('admin');
    await page.getByPlaceholder(/mot de passe/i).fill('admin123');
    await page.getByRole('button', { name: /se connecter/i }).click();

    // Attendre la redirection vers le dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
