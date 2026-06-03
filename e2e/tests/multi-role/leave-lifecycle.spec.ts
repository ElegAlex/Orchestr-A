/**
 * Test multi-rôle : Cycle de vie complet d'un congé
 *
 * Scénario :
 *   1. CONTRIBUTEUR lit son solde CP via API (GET /api/leaves/me/balance)
 *   2. CONTRIBUTEUR crée une demande de congé CP via API (POST /api/leaves)
 *   3. ADMIN approuve la demande via API (POST /api/leaves/:id/approve)
 *      (Admin has leaves:manage_any — approval guaranteed regardless of service scope)
 *   4. CONTRIBUTEUR relit son solde CP et vérifie que used a augmenté de leave.days
 *
 * Correction TST-004 : remplace la tautologie L182-184 (right operand always true)
 * par une assertion réelle de débit de balance (used += leave.days après approbation).
 */

import * as fs from "fs";
import { test, expect } from "../../fixtures/test-fixtures";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

function getToken(role: Role): string {
  const storagePath = ROLE_STORAGE_PATHS[role];
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

test.describe("Leave Lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test(
    "contributeur soumet un congé CP, admin approuve, solde used augmente du bon nombre de jours",
    { tag: "@smoke" },
    async ({ request }) => {
      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:4001";

      const contributeurToken = getToken("contributeur");
      const adminToken = getToken("admin");

      // ─── Étape 1 : Lire le solde CP initial du contributeur ──────────────
      const balanceBefore = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(
        balanceBefore.ok(),
        `GET /api/leaves/me/balance failed: ${balanceBefore.status()}`,
      ).toBe(true);

      const balanceBeforeBody = await balanceBefore.json();

      // Résoudre le leaveTypeId CP depuis byType
      const cpBefore = (
        balanceBeforeBody.byType as Array<{
          leaveTypeId: string;
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");

      expect(
        cpBefore,
        "Type CP introuvable dans le solde du contributeur",
      ).toBeDefined();

      const leaveTypeId = cpBefore!.leaveTypeId;
      const usedBefore = cpBefore!.used;

      // ─── Étape 2 : Créer une demande de congé CP via API ────────────────
      // Dates 2026 (dans l'année courante de la fenêtre de calcul du solde).
      // Mardi 25 août → mercredi 26 août 2026 = 2 jours ouvrés, sans jour férié.
      const createRes = await request.post(`${baseURL}/api/leaves`, {
        headers: authHeaders(contributeurToken),
        data: {
          leaveTypeId,
          startDate: "2026-08-25T00:00:00.000Z",
          endDate: "2026-08-26T00:00:00.000Z",
        },
      });
      expect(
        createRes.ok(),
        `POST /api/leaves échoué: ${createRes.status()} ${await createRes.text()}`,
      ).toBe(true);

      const createdLeave = await createRes.json();
      const leaveId: string = createdLeave.id;
      const expectedDelta: number = createdLeave.days;

      expect(leaveId, "La réponse de création doit contenir un id").toBeTruthy();
      expect(
        expectedDelta,
        "La réponse de création doit contenir le nombre de jours calculés",
      ).toBeGreaterThan(0);

      // ─── Étape 3 : ADMIN approuve la demande (leaves:manage_any) ─────────
      const approveRes = await request.post(
        `${baseURL}/api/leaves/${leaveId}/approve`,
        { headers: authHeaders(adminToken) },
      );
      expect(
        approveRes.ok(),
        `POST /api/leaves/${leaveId}/approve échoué: ${approveRes.status()} ${await approveRes.text()}`,
      ).toBe(true);

      // ─── Étape 4 : Vérifier le débit du solde ────────────────────────────
      const balanceAfter = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(
        balanceAfter.ok(),
        `GET /api/leaves/me/balance (après approbation) échoué: ${balanceAfter.status()}`,
      ).toBe(true);

      const balanceAfterBody = await balanceAfter.json();
      const cpAfter = (
        balanceAfterBody.byType as Array<{
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");

      expect(
        cpAfter,
        "Type CP introuvable dans le solde après approbation",
      ).toBeDefined();

      const usedAfter = cpAfter!.used;

      // Assertion réelle : used doit avoir augmenté exactement de leave.days
      expect(
        usedAfter,
        `Le solde used CP doit augmenter de ${expectedDelta} jour(s) après approbation ` +
          `(before=${usedBefore}, after=${usedAfter})`,
      ).toBe(usedBefore + expectedDelta);
    },
  );

  test(
    "ADMIN peut voir les congés dans /reports",
    { tag: "@smoke" },
    async ({ asRole }) => {
      const adminPage = await asRole("admin");
      await adminPage.goto("/reports");
      await adminPage.waitForLoadState("domcontentloaded");

      // La page reports doit être accessible à l'admin
      expect(adminPage.url()).not.toContain("/login");
      expect(adminPage.url()).not.toContain("/403");
      expect(adminPage.url()).not.toContain("/unauthorized");

      // Chercher une section liée aux congés ou au personnel
      const pageContent = adminPage.locator("h1, h2, main");
      await expect(pageContent.first()).toBeVisible({ timeout: 10000 });
    },
  );
});
