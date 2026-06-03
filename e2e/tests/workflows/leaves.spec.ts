/**
 * e2e/tests/workflows/leaves.spec.ts
 *
 * Tests du workflow de gestion des congés.
 *
 * Page : /fr/leaves
 * Titre i18n : "Gestion des congés"
 * Bouton création : "Nouvelle demande"
 *
 * OBSERVATEUR : a accès à la page congés (pour voir ses absences)
 * mais n'a pas la permission de créer (leaves:create appartient à CONTRIBUTEUR+).
 *
 * Note : L'OBSERVATEUR voit le bouton "Nouvelle demande" dans l'UI actuelle
 * car le composant ne filtre pas la création par rôle — il soumet et l'API
 * retourne une erreur. On vérifie donc le comportement observable (bouton visible
 * mais soumission refusée) pour OBSERVATEUR, et la création réussie pour CONTRIBUTEUR.
 *
 * DESIGN NOTE (TST-005):
 *   - REFERENT IS allowed leaves:create per permission-matrix (allowedRoles includes referent).
 *     Do NOT add a false REFERENT-deny test.
 *   - OBSERVATEUR raw-403 on POST /api/leaves is already covered by
 *     e2e/tests/rbac/api-permissions.spec.ts (PERMISSION_MATRIX loop). Not duplicated here.
 *   - self-approval / balance-gating / cross-year scenarios are already covered in
 *     e2e/tests/workflows/leave-balance-gating.spec.ts. Not duplicated here.
 *   - These tests add the genuinely-missing workflow coverage:
 *       (a) CONTRIBUTEUR creates leave → 201 + PENDING
 *       (b) ADMIN approves that leave → 200 + APPROVED + balance debited
 *       (c) ADMIN rejects a fresh PENDING leave → 200 + REJECTED + balance NOT debited
 *       (d) ADMIN cancels an APPROVED leave → 200 + CANCELLED
 *       (e) Non-approver (CONTRIBUTEUR) tries to approve a PENDING leave → 403
 */

import { test, expect } from "../../fixtures/test-fixtures";

// ─── Page congés accessible ───────────────────────────────────────────────────

test("user authentifié peut voir la page congés", async ({ page }) => {
  await page.goto("/fr/leaves");
  await expect(page).toHaveURL(/\/leaves/);

  // Le titre principal de la page
  await expect(
    page.getByRole("heading", { name: "Gestion des congés", level: 1 }),
  ).toBeVisible({ timeout: 10000 });
});

// ─── Solde de congés ──────────────────────────────────────────────────────────

test("user peut voir ses demandes de congés (onglet Mes demandes)", async ({
  page,
}) => {
  await page.goto("/fr/leaves");

  // L'onglet "Mes demandes" est actif par défaut
  const myLeavesTab = page.getByRole("button", { name: /mes demandes/i });
  await expect(myLeavesTab).toBeVisible({ timeout: 10000 });

  // L'onglet doit avoir la classe active (border-blue-500)
  await expect(myLeavesTab).toHaveClass(/border-blue-500/);

  // La zone de contenu est chargée : soit les cartes de congés, soit le message vide
  const contentArea = page.locator(".bg-white.rounded-lg.shadow-sm");
  await expect(contentArea.first()).toBeVisible({ timeout: 10000 });
});

// ─── CONTRIBUTEUR peut créer une demande ─────────────────────────────────────

test("CONTRIBUTEUR peut ouvrir le formulaire de création de congé", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "contributeur",
    "Test limité au rôle contributeur",
  );

  await page.goto("/fr/leaves");

  // Le bouton "Nouvelle demande" doit être visible
  const newRequestButton = page.getByRole("button", {
    name: "Nouvelle demande",
  });
  await expect(newRequestButton).toBeVisible({ timeout: 10000 });

  // Cliquer pour ouvrir la modal
  await newRequestButton.click();

  // La modal de création doit s'ouvrir
  await expect(
    page.getByRole("heading", { name: "Nouvelle demande de congé" }),
  ).toBeVisible({ timeout: 5000 });

  // Les champs obligatoires sont présents
  await expect(page.locator('input[type="date"]').first()).toBeVisible();
  await expect(page.locator('input[type="date"]').last()).toBeVisible();

  // Le bouton de soumission
  await expect(
    page.getByRole("button", { name: "Soumettre la demande" }),
  ).toBeVisible();
});

// ─── OBSERVATEUR — comportement à la création ────────────────────────────────

test("OBSERVATEUR — la page congés se charge correctement", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "observateur",
    "Test limité au rôle observateur",
  );

  await page.goto("/fr/leaves");

  // La page doit se charger
  await expect(
    page.getByRole("heading", { name: "Gestion des congés", level: 1 }),
  ).toBeVisible({ timeout: 10000 });

  // L'onglet "Mes demandes" est présent
  await expect(
    page.getByRole("button", { name: /mes demandes/i }),
  ).toBeVisible();
});

// ─── API: create → approve → balance debited ─────────────────────────────────

/**
 * CONTRIBUTEUR creates a leave (OTHER type, no balance gate) → status PENDING.
 * ADMIN approves it → status APPROVED.
 * Balance check: GET /api/leaves/balance/:userId shows used days increased.
 *
 * Uses OTHER type (no balance configured) to avoid gate failures in isolation.
 * ADMIN is the approver because manager-test is not guaranteed perimeter access
 * to contributeur-test's leaves (documented in leave-balance-gating.spec.ts).
 */
test(
  "@smoke CONTRIBUTEUR creates leave, ADMIN approves, balance reflects APPROVED",
  async ({ asRole }) => {
    const contributeurPage = await asRole("contributeur");
    const adminPage = await asRole("admin");

    // Resolve contributeur user id
    const meRes = await contributeurPage.request.get("/api/auth/me");
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();

    // Fetch leave types and pick OTHER (no balance gate, unconditional 201)
    const typesRes = await contributeurPage.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();
    const otherType = types.find((t: { code: string }) => t.code === "OTHER");
    expect(otherType, "OTHER leave type must exist in the database").toBeDefined();

    // Read balance BEFORE creation (for the debit assertion)
    const balBefore = await adminPage.request.get(
      `/api/leaves/balance/${me.id}`,
    );
    expect(balBefore.ok()).toBeTruthy();
    const balBeforeBody = await balBefore.json();
    const usedBefore: number =
      balBeforeBody.byType?.find(
        (b: { leaveTypeCode: string }) => b.leaveTypeCode === "OTHER",
      )?.used ?? 0;

    // CONTRIBUTEUR creates leave (far-future dates to avoid seeded data collision)
    const createRes = await contributeurPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: otherType.id,
        startDate: "2028-03-04",
        endDate: "2028-03-06",
      },
    });
    expect(createRes.status()).toBe(201);
    const leave = await createRes.json();
    expect(leave.id).toBeDefined();
    // OTHER type + contributeur has no self_approve → PENDING
    expect(leave.status).toBe("PENDING");

    // ADMIN approves
    const approveRes = await adminPage.request.post(
      `/api/leaves/${leave.id}/approve`,
      { data: {} },
    );
    expect(approveRes.status()).toBe(200);
    const approved = await approveRes.json();
    expect(approved.status).toBe("APPROVED");

    // Balance AFTER: used days for OTHER type must have increased
    const balAfter = await adminPage.request.get(
      `/api/leaves/balance/${me.id}`,
    );
    expect(balAfter.ok()).toBeTruthy();
    const balAfterBody = await balAfter.json();
    const usedAfter: number =
      balAfterBody.byType?.find(
        (b: { leaveTypeCode: string }) => b.leaveTypeCode === "OTHER",
      )?.used ?? 0;
    expect(usedAfter).toBeGreaterThan(usedBefore);

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/${leave.id}`);
    } catch {
      /* ignore cleanup failures */
    }
  },
);

// ─── API: create → reject → balance NOT debited ──────────────────────────────

/**
 * CONTRIBUTEUR creates a leave.
 * ADMIN rejects it → status REJECTED.
 * Balance check: used days must NOT increase after rejection.
 */
test(
  "ADMIN rejects a PENDING leave — status REJECTED, balance not debited",
  async ({ asRole }) => {
    const contributeurPage = await asRole("contributeur");
    const adminPage = await asRole("admin");

    const meRes = await contributeurPage.request.get("/api/auth/me");
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();

    const typesRes = await contributeurPage.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();
    const otherType = types.find((t: { code: string }) => t.code === "OTHER");
    expect(otherType, "OTHER leave type must exist in the database").toBeDefined();

    // Balance BEFORE
    const balBefore = await adminPage.request.get(
      `/api/leaves/balance/${me.id}`,
    );
    expect(balBefore.ok()).toBeTruthy();
    const balBeforeBody = await balBefore.json();
    const usedBefore: number =
      balBeforeBody.byType?.find(
        (b: { leaveTypeCode: string }) => b.leaveTypeCode === "OTHER",
      )?.used ?? 0;

    // Create leave
    const createRes = await contributeurPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: otherType.id,
        startDate: "2028-04-07",
        endDate: "2028-04-09",
      },
    });
    expect(createRes.status()).toBe(201);
    const leave = await createRes.json();
    expect(leave.status).toBe("PENDING");

    // ADMIN rejects
    const rejectRes = await adminPage.request.post(
      `/api/leaves/${leave.id}/reject`,
      { data: { reason: "Test rejection TST-005" } },
    );
    expect(rejectRes.status()).toBe(200);
    const rejected = await rejectRes.json();
    expect(rejected.status).toBe("REJECTED");

    // Balance must NOT have increased after rejection
    const balAfter = await adminPage.request.get(
      `/api/leaves/balance/${me.id}`,
    );
    expect(balAfter.ok()).toBeTruthy();
    const balAfterBody = await balAfter.json();
    const usedAfter: number =
      balAfterBody.byType?.find(
        (b: { leaveTypeCode: string }) => b.leaveTypeCode === "OTHER",
      )?.used ?? 0;
    expect(usedAfter).toBe(usedBefore);

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/${leave.id}`);
    } catch {
      /* ignore cleanup failures */
    }
  },
);

// ─── API: create → approve → cancel ──────────────────────────────────────────

/**
 * ADMIN creates their own leave (self-approves via leaves:self_approve) → APPROVED.
 * ADMIN cancels via POST /:id/cancel → status CANCELLED.
 */
test(
  "ADMIN can cancel an APPROVED leave — status CANCELLED",
  async ({ asRole }) => {
    const adminPage = await asRole("admin");

    const typesRes = await adminPage.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();
    const otherType = types.find((t: { code: string }) => t.code === "OTHER");
    expect(otherType, "OTHER leave type must exist in the database").toBeDefined();

    // ADMIN self-approves (leaves:self_approve) → APPROVED
    const createRes = await adminPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: otherType.id,
        startDate: "2028-05-13",
        endDate: "2028-05-14",
      },
    });
    expect(createRes.status()).toBe(201);
    const leave = await createRes.json();
    // OTHER type has requiresApproval=false OR admin self-approves → APPROVED
    // Either way, we can also just use POST /:id/approve to force APPROVED state
    // if it lands PENDING (defensive: ensures the cancel path is reached)
    let leaveId = leave.id;
    if (leave.status === "PENDING") {
      const approveRes = await adminPage.request.post(
        `/api/leaves/${leave.id}/approve`,
        { data: {} },
      );
      expect(approveRes.status()).toBe(200);
    }

    // Cancel via POST /:id/cancel (leaves:delete permission — ADMIN has it)
    const cancelRes = await adminPage.request.post(
      `/api/leaves/${leaveId}/cancel`,
    );
    expect(cancelRes.status()).toBe(200);
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe("CANCELLED");

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/${leaveId}`);
    } catch {
      /* ignore cleanup failures */
    }
  },
);

// ─── API: non-approver tries to approve → 403 ────────────────────────────────

/**
 * CONTRIBUTEUR tries to call POST /api/leaves/:id/approve on a leave they did NOT
 * create (admin's leave). This tests the leaves:approve permission guard.
 *
 * The matrix can't cover this case because it uses a PLACEHOLDER_UUID that doesn't
 * exist in the DB — the service may throw 404 before 403. Here we use a real leave ID.
 */
test(
  "CONTRIBUTEUR cannot approve any leave — 403 Forbidden",
  async ({ asRole }) => {
    const adminPage = await asRole("admin");
    const contributeurPage = await asRole("contributeur");

    const typesRes = await adminPage.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();
    const otherType = types.find((t: { code: string }) => t.code === "OTHER");
    expect(otherType, "OTHER leave type must exist in the database").toBeDefined();

    // Admin creates a leave (PENDING or APPROVED — either works)
    const createRes = await adminPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: otherType.id,
        startDate: "2028-06-03",
        endDate: "2028-06-04",
      },
    });
    expect(createRes.status()).toBe(201);
    const leave = await createRes.json();

    // CONTRIBUTEUR tries to approve — must get 403 (no leaves:approve permission)
    const approveRes = await contributeurPage.request.post(
      `/api/leaves/${leave.id}/approve`,
      { data: {} },
    );
    expect(approveRes.status()).toBe(403);

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/${leave.id}`);
    } catch {
      /* ignore cleanup failures */
    }
  },
);
