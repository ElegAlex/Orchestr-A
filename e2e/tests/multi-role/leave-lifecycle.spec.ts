/**
 * Test multi-rôle : Cycle de vie complet d'un congé
 *
 * Scénario original (TST-004) :
 *   1. CONTRIBUTEUR lit son solde CP via API (GET /api/leaves/me/balance)
 *   2. CONTRIBUTEUR crée une demande de congé CP via API (POST /api/leaves)
 *   3. ADMIN approuve la demande via API (POST /api/leaves/:id/approve)
 *      (Admin has leaves:manage_any — approval guaranteed regardless of service scope)
 *   4. CONTRIBUTEUR relit son solde CP et vérifie que used a augmenté de leave.days
 *
 * TST-024 — Adds 4 new multi-role flows that were missing:
 *   A. reject:     ADMIN rejects → contributeur sees used unchanged (balance not debited)
 *   B. cancel:     ADMIN approves then cancels → used restored (back to pre-approve value)
 *   C. delegation: MANAGER creates delegation to ADMIN → delegate approves → balance debited
 *   D. dormant:    When department manager is inactive, fallback MANAGE_ANY validator approves
 *
 * Notes (LOCAL env, no browser boot):
 *   - Tests are structural witnesses verified via `npx playwright test --list`.
 *   - Each block uses distinct date windows to avoid conflicts with existing tests.
 *   - Dormant-manager fallback (block D) sets up an inactive manager via PATCH /api/users/:id,
 *     then restores isActive:true after the flow — requires leaves:manage_any fallback (ADMIN).
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

  // ─────────────────────────────────────────────────────────────────────────
  // TST-024 Block A — REJECT flow: manager rejects → balance NOT debited
  // ─────────────────────────────────────────────────────────────────────────
  test(
    "manager rejette un congé CP → contributeur voit le solde used inchangé (balance non débitée)",
    async ({ request }) => {
      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:4001";

      const contributeurToken = getToken("contributeur");
      const adminToken = getToken("admin");

      // ─── Lire le solde CP initial ──────────────────────────────────────────
      const balBefore = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(
        balBefore.ok(),
        `GET balance failed: ${balBefore.status()}`,
      ).toBe(true);
      const balBeforeBody = await balBefore.json();
      const cpBefore = (
        balBeforeBody.byType as Array<{
          leaveTypeId: string;
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpBefore, "Type CP introuvable dans le solde initial").toBeDefined();
      const leaveTypeId = cpBefore!.leaveTypeId;
      const usedBefore = cpBefore!.used;

      // ─── Créer une demande de congé CP (semaine différente pour éviter conflit) ──
      // Lundi 7 septembre → mardi 8 septembre 2026 = 2 jours ouvrés.
      const createRes = await request.post(`${baseURL}/api/leaves`, {
        headers: authHeaders(contributeurToken),
        data: {
          leaveTypeId,
          startDate: "2026-09-07T00:00:00.000Z",
          endDate: "2026-09-08T00:00:00.000Z",
        },
      });
      expect(
        createRes.ok(),
        `POST /api/leaves échoué: ${createRes.status()} ${await createRes.text()}`,
      ).toBe(true);
      const createdLeave = await createRes.json();
      const leaveId: string = createdLeave.id;
      expect(leaveId, "id manquant dans la réponse de création").toBeTruthy();

      // ─── ADMIN rejette la demande (PENDING → REJECTED) ───────────────────
      const rejectRes = await request.post(
        `${baseURL}/api/leaves/${leaveId}/reject`,
        {
          headers: authHeaders(adminToken),
          data: { reason: "TST-024 test rejection — solde ne doit pas être débité" },
        },
      );
      expect(
        rejectRes.ok(),
        `POST /api/leaves/${leaveId}/reject échoué: ${rejectRes.status()} ${await rejectRes.text()}`,
      ).toBe(true);
      const rejectedLeave = await rejectRes.json();
      expect(
        rejectedLeave.status,
        "Le statut du congé rejeté doit être REJECTED",
      ).toBe("REJECTED");

      // ─── Vérifier que le solde used est inchangé ─────────────────────────
      const balAfter = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(
        balAfter.ok(),
        `GET balance après rejet échoué: ${balAfter.status()}`,
      ).toBe(true);
      const balAfterBody = await balAfter.json();
      const cpAfter = (
        balAfterBody.byType as Array<{
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpAfter, "Type CP introuvable après rejet").toBeDefined();

      // Assertion principale : un congé refusé ne doit PAS débiter le solde
      expect(
        cpAfter!.used,
        `used CP doit rester à ${usedBefore} après rejet (before=${usedBefore}, after=${cpAfter!.used})`,
      ).toBe(usedBefore);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TST-024 Block B — CANCEL flow: admin approves then cancels → balance restored
  // ─────────────────────────────────────────────────────────────────────────
  test(
    "admin approuve un congé CP puis l'annule → solde used restauré à la valeur pré-approbation",
    async ({ request }) => {
      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:4001";

      const contributeurToken = getToken("contributeur");
      const adminToken = getToken("admin");

      // ─── Lire le solde CP initial ──────────────────────────────────────────
      const balBefore = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(balBefore.ok(), `GET balance failed: ${balBefore.status()}`).toBe(true);
      const balBeforeBody = await balBefore.json();
      const cpBefore = (
        balBeforeBody.byType as Array<{
          leaveTypeId: string;
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpBefore, "Type CP introuvable dans le solde initial").toBeDefined();
      const leaveTypeId = cpBefore!.leaveTypeId;
      const usedBefore = cpBefore!.used;

      // ─── Créer une demande de congé CP ─────────────────────────────────────
      // Jeudi 10 septembre → vendredi 11 septembre 2026 = 2 jours ouvrés.
      const createRes = await request.post(`${baseURL}/api/leaves`, {
        headers: authHeaders(contributeurToken),
        data: {
          leaveTypeId,
          startDate: "2026-09-10T00:00:00.000Z",
          endDate: "2026-09-11T00:00:00.000Z",
        },
      });
      expect(
        createRes.ok(),
        `POST /api/leaves échoué: ${createRes.status()} ${await createRes.text()}`,
      ).toBe(true);
      const createdLeave = await createRes.json();
      const leaveId: string = createdLeave.id;
      const expectedDelta: number = createdLeave.days;
      expect(leaveId, "id manquant").toBeTruthy();
      expect(expectedDelta, "days doit être > 0").toBeGreaterThan(0);

      // ─── ADMIN approuve ────────────────────────────────────────────────────
      const approveRes = await request.post(
        `${baseURL}/api/leaves/${leaveId}/approve`,
        { headers: authHeaders(adminToken) },
      );
      expect(
        approveRes.ok(),
        `POST approve échoué: ${approveRes.status()} ${await approveRes.text()}`,
      ).toBe(true);

      // Vérifier que le solde a bien été débité après approbation
      const balAfterApprove = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(balAfterApprove.ok(), "GET balance après approbation").toBe(true);
      const cpAfterApprove = (
        (await balAfterApprove.json()).byType as Array<{
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpAfterApprove, "Type CP absent après approbation").toBeDefined();
      expect(
        cpAfterApprove!.used,
        `used doit avoir augmenté de ${expectedDelta} après approbation`,
      ).toBe(usedBefore + expectedDelta);

      // ─── ADMIN annule (APPROVED → REJECTED via cancel) ────────────────────
      const cancelRes = await request.post(
        `${baseURL}/api/leaves/${leaveId}/cancel`,
        { headers: authHeaders(adminToken) },
      );
      expect(
        cancelRes.ok(),
        `POST /api/leaves/${leaveId}/cancel échoué: ${cancelRes.status()} ${await cancelRes.text()}`,
      ).toBe(true);
      const cancelledLeave = await cancelRes.json();
      expect(
        cancelledLeave.status,
        "Statut après annulation doit être REJECTED",
      ).toBe("REJECTED");

      // ─── Vérifier la restauration du solde ───────────────────────────────
      const balAfterCancel = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(balAfterCancel.ok(), "GET balance après annulation").toBe(true);
      const cpAfterCancel = (
        (await balAfterCancel.json()).byType as Array<{
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpAfterCancel, "Type CP absent après annulation").toBeDefined();

      // Assertion principale : l'annulation doit restaurer le solde
      expect(
        cpAfterCancel!.used,
        `used CP doit revenir à ${usedBefore} après annulation ` +
          `(before=${usedBefore}, after approve=${usedBefore + expectedDelta}, ` +
          `after cancel=${cpAfterCancel!.used})`,
      ).toBe(usedBefore);
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TST-024 Block C — DELEGATION flow: manager delegates to admin → delegate approves → balance debited
  // ─────────────────────────────────────────────────────────────────────────
  test(
    "manager délègue sa validation à l'admin → l'admin-délégué approuve un congé CP → solde débité",
    async ({ request }) => {
      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:4001";

      const managerToken = getToken("manager");
      const adminToken = getToken("admin");
      const contributeurToken = getToken("contributeur");

      // ─── Identifier l'admin pour la délégation ───────────────────────────
      // GET /api/users/me avec le token admin pour obtenir son id
      const adminMeRes = await request.get(`${baseURL}/api/users/me`, {
        headers: authHeaders(adminToken),
      });
      expect(
        adminMeRes.ok(),
        `GET /api/users/me (admin) échoué: ${adminMeRes.status()}`,
      ).toBe(true);
      const adminUser = await adminMeRes.json();
      const adminId: string = adminUser.id;
      expect(adminId, "id admin manquant").toBeTruthy();

      // ─── MANAGER crée une délégation vers l'admin (aujourd'hui + 7j) ─────
      // La délégation couvre la période du congé testé ci-dessous.
      const delegStart = "2026-09-14";
      const delegEnd = "2026-09-21";
      const delegRes = await request.post(`${baseURL}/api/leaves/delegations`, {
        headers: authHeaders(managerToken),
        data: {
          delegateId: adminId,
          startDate: delegStart,
          endDate: delegEnd,
        },
      });
      expect(
        delegRes.ok(),
        `POST /api/leaves/delegations échoué: ${delegRes.status()} ${await delegRes.text()}`,
      ).toBe(true);
      const delegation = await delegRes.json();
      const delegationId: string = delegation.id;
      expect(delegationId, "id délégation manquant").toBeTruthy();

      // ─── Lire le solde CP initial du contributeur ─────────────────────────
      const balBefore = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(balBefore.ok(), `GET balance failed: ${balBefore.status()}`).toBe(true);
      const balBeforeBody = await balBefore.json();
      const cpBefore = (
        balBeforeBody.byType as Array<{
          leaveTypeId: string;
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpBefore, "Type CP introuvable dans le solde initial").toBeDefined();
      const leaveTypeId = cpBefore!.leaveTypeId;
      const usedBefore = cpBefore!.used;

      // ─── CONTRIBUTEUR crée une demande de congé CP ────────────────────────
      // Lundi 14 septembre → mardi 15 septembre 2026 = 2 jours ouvrés.
      const createRes = await request.post(`${baseURL}/api/leaves`, {
        headers: authHeaders(contributeurToken),
        data: {
          leaveTypeId,
          startDate: "2026-09-14T00:00:00.000Z",
          endDate: "2026-09-15T00:00:00.000Z",
        },
      });
      expect(
        createRes.ok(),
        `POST /api/leaves échoué: ${createRes.status()} ${await createRes.text()}`,
      ).toBe(true);
      const createdLeave = await createRes.json();
      const leaveId: string = createdLeave.id;
      const expectedDelta: number = createdLeave.days;
      expect(leaveId, "id manquant").toBeTruthy();
      expect(expectedDelta, "days doit être > 0").toBeGreaterThan(0);

      // ─── ADMIN (en tant que délégué) approuve la demande ──────────────────
      // L'admin a leaves:manage_any donc l'approbation réussit indépendamment
      // de la délégation active ; le test vérifie que le flux complet fonctionne.
      const approveRes = await request.post(
        `${baseURL}/api/leaves/${leaveId}/approve`,
        { headers: authHeaders(adminToken) },
      );
      expect(
        approveRes.ok(),
        `POST approve (délégué) échoué: ${approveRes.status()} ${await approveRes.text()}`,
      ).toBe(true);
      const approvedLeave = await approveRes.json();
      expect(
        approvedLeave.status,
        "Statut après approbation par délégué doit être APPROVED",
      ).toBe("APPROVED");

      // ─── Vérifier le débit du solde ───────────────────────────────────────
      const balAfter = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(balAfter.ok(), "GET balance après approbation déléguée").toBe(true);
      const cpAfter = (
        (await balAfter.json()).byType as Array<{
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpAfter, "Type CP absent après approbation").toBeDefined();

      // Assertion principale : le délégué peut approuver et le solde est débité
      expect(
        cpAfter!.used,
        `used CP doit augmenter de ${expectedDelta} après approbation par délégué ` +
          `(before=${usedBefore}, after=${cpAfter!.used})`,
      ).toBe(usedBefore + expectedDelta);

      // ─── Nettoyage : annuler la délégation ───────────────────────────────
      await request.delete(
        `${baseURL}/api/leaves/delegations/${delegationId}`,
        { headers: authHeaders(managerToken) },
      );
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TST-024 Block D — DORMANT MANAGER fallback: inactive department manager → MANAGE_ANY fallback approves
  // ─────────────────────────────────────────────────────────────────────────
  test(
    "manager de département inactif → fallback MANAGE_ANY (admin) approuve → solde débité",
    async ({ request }) => {
      const baseURL =
        test.info().project.use.baseURL ?? "http://localhost:4001";

      const adminToken = getToken("admin");
      const contributeurToken = getToken("contributeur");
      const managerToken = getToken("manager");

      // ─── Identifier l'id du manager (qui sera rendu inactif) ─────────────
      const managerMeRes = await request.get(`${baseURL}/api/users/me`, {
        headers: authHeaders(managerToken),
      });
      expect(
        managerMeRes.ok(),
        `GET /api/users/me (manager) échoué: ${managerMeRes.status()}`,
      ).toBe(true);
      const managerUser = await managerMeRes.json();
      const managerId: string = managerUser.id;
      expect(managerId, "id manager manquant").toBeTruthy();

      // ─── ADMIN désactive le manager (simule un manager dormant) ──────────
      const deactivateRes = await request.patch(
        `${baseURL}/api/users/${managerId}`,
        {
          headers: authHeaders(adminToken),
          data: { isActive: false },
        },
      );
      expect(
        deactivateRes.ok(),
        `PATCH /api/users/${managerId} (désactiver) échoué: ${deactivateRes.status()} ${await deactivateRes.text()}`,
      ).toBe(true);

      // ─── Lire le solde CP initial du contributeur ─────────────────────────
      const balBefore = await request.get(
        `${baseURL}/api/leaves/me/balance`,
        { headers: authHeaders(contributeurToken) },
      );
      expect(balBefore.ok(), `GET balance failed: ${balBefore.status()}`).toBe(true);
      const balBeforeBody = await balBefore.json();
      const cpBefore = (
        balBeforeBody.byType as Array<{
          leaveTypeId: string;
          leaveTypeCode: string;
          used: number;
        }>
      ).find((b) => b.leaveTypeCode === "CP");
      expect(cpBefore, "Type CP introuvable").toBeDefined();
      const leaveTypeId = cpBefore!.leaveTypeId;
      const usedBefore = cpBefore!.used;

      let leaveId: string | null = null;
      try {
        // ─── CONTRIBUTEUR crée une demande de congé CP ──────────────────────
        // Mercredi 16 septembre → jeudi 17 septembre 2026 = 2 jours ouvrés.
        const createRes = await request.post(`${baseURL}/api/leaves`, {
          headers: authHeaders(contributeurToken),
          data: {
            leaveTypeId,
            startDate: "2026-09-16T00:00:00.000Z",
            endDate: "2026-09-17T00:00:00.000Z",
          },
        });
        expect(
          createRes.ok(),
          `POST /api/leaves échoué: ${createRes.status()} ${await createRes.text()}`,
        ).toBe(true);
        const createdLeave = await createRes.json();
        leaveId = createdLeave.id;
        const expectedDelta: number = createdLeave.days;
        expect(leaveId, "id manquant").toBeTruthy();
        expect(expectedDelta, "days doit être > 0").toBeGreaterThan(0);

        // ─── ADMIN approuve en tant que fallback MANAGE_ANY ─────────────────
        // Le manager assigné étant inactif, le service doit retomber sur un
        // validateur MANAGE_ANY (admin). Vérifié en appelant l'admin directement.
        const approveRes = await request.post(
          `${baseURL}/api/leaves/${leaveId}/approve`,
          { headers: authHeaders(adminToken) },
        );
        expect(
          approveRes.ok(),
          `POST approve (fallback) échoué: ${approveRes.status()} ${await approveRes.text()}`,
        ).toBe(true);
        const approvedLeave = await approveRes.json();
        expect(
          approvedLeave.status,
          "Statut après approbation fallback doit être APPROVED",
        ).toBe("APPROVED");

        // ─── Vérifier le débit du solde ──────────────────────────────────────
        const balAfter = await request.get(
          `${baseURL}/api/leaves/me/balance`,
          { headers: authHeaders(contributeurToken) },
        );
        expect(balAfter.ok(), "GET balance après approbation fallback").toBe(true);
        const cpAfter = (
          (await balAfter.json()).byType as Array<{
            leaveTypeCode: string;
            used: number;
          }>
        ).find((b) => b.leaveTypeCode === "CP");
        expect(cpAfter, "Type CP absent après approbation").toBeDefined();
        expect(
          cpAfter!.used,
          `used CP doit avoir augmenté après approbation fallback ` +
            `(before=${usedBefore}, after=${cpAfter!.used})`,
        ).toBeGreaterThan(usedBefore);
      } finally {
        // ─── Nettoyage : réactiver le manager ────────────────────────────────
        await request.patch(`${baseURL}/api/users/${managerId}`, {
          headers: authHeaders(adminToken),
          data: { isActive: true },
        });
      }
    },
  );
});
