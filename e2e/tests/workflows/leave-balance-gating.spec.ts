/**
 * e2e/tests/workflows/leave-balance-gating.spec.ts
 *
 * Scenarios:
 *   1. (@smoke) Leave type with no LeaveBalance configured (OTHER) → 201 regardless of days
 *   2. (@smoke) ADMIN creates own leave on CP (requiresApproval=true) → status APPROVED,
 *              validatorId null (self-approval via leaves:self_approve permission)
 *   3.          CONTRIBUTEUR creates own leave on CP → status PENDING, validatorId set
 *              (negative control — no self_approve permission)
 *
 * NOTE: Tests are API-level only (page.request.*). Dev servers must be running for
 * execution. These tests are NOT run locally in this batch — they will run in CI.
 */

import { test, expect } from "../../fixtures/test-fixtures";
import { runOnceUnderAdmin } from "../../fixtures/run-once";

// Mutates leaves + balances against the once-seeded shared DB; roles are
// exercised internally via asRole. Run once instead of 6× to avoid cumulative
// seed mutation across the per-role re-runs.
runOnceUnderAdmin(test, "leave self-approval / balance-gating flow");

test.describe("Leave balance gating + self-approval", () => {
  test("@smoke type without configured balance allows arbitrary leave", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");

    // Fetch all available leave types
    const typesRes = await page.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();

    // Pick the OTHER type — it has no LeaveBalance configured per the balance-gating audit,
    // so any number of days should be accepted without a balance check.
    const otherType = types.find((t: { code: string }) => t.code === "OTHER");
    expect(
      otherType,
      "OTHER leave type must exist in the database",
    ).toBeDefined();

    // POST a 5-day leave — should succeed (201) even though no balance is configured
    const res = await page.request.post("/api/leaves", {
      data: {
        leaveTypeId: otherType.id,
        startDate: "2027-09-01",
        endDate: "2027-09-05",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();

    // Cleanup: delete the created leave (best-effort — do not fail the test)
    try {
      await page.request.delete(`/api/leaves/${body.id}`);
    } catch {
      /* ignore cleanup failures */
    }
  });

  test("@smoke ADMIN auto-approves own leave via leaves:self_approve", async ({
    asRole,
  }) => {
    const adminPage = await asRole("admin");

    // Fetch leave types and pick CP (requiresApproval = true)
    const typesRes = await adminPage.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();
    const cp = types.find((t: { code: string }) => t.code === "CP");
    expect(cp, "CP leave type must exist in the database").toBeDefined();

    // ADMIN posts their own leave on CP — the leaves:self_approve permission
    // should trigger auto-approval with no manual validator.
    const res = await adminPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: cp.id,
        startDate: "2027-10-12",
        endDate: "2027-10-14",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();

    // Wave 3 / finding #6: self-approval must be auditable from the row.
    //   - status APPROVED immediately (no PENDING limbo)
    //   - validatorId = actor (the user is their own validator of record)
    //   - selfApproved = true (the explicit discriminator column)
    expect(body.status).toBe("APPROVED");
    expect(body.validatorId).toBe(body.userId);
    expect(body.selfApproved).toBe(true);

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/${body.id}`);
    } catch {
      /* ignore cleanup failures */
    }
  });

  test("CONTRIBUTEUR own leave stays PENDING (no self_approve permission)", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");

    // Fetch leave types and pick CP (requiresApproval = true)
    const typesRes = await page.request.get("/api/leave-types");
    expect(typesRes.ok()).toBeTruthy();
    const types = await typesRes.json();
    const cp = types.find((t: { code: string }) => t.code === "CP");
    expect(cp, "CP leave type must exist in the database").toBeDefined();

    // CONTRIBUTEUR has no leaves:self_approve → leave must stay PENDING
    // and a validator must be assigned by the system.
    const res = await page.request.post("/api/leaves", {
      data: {
        leaveTypeId: cp.id,
        startDate: "2027-11-09",
        endDate: "2027-11-13",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();

    expect(body.status).toBe("PENDING");
    expect(body.validatorId).not.toBeNull();

    // Cleanup
    try {
      await page.request.delete(`/api/leaves/${body.id}`);
    } catch {
      /* ignore cleanup failures */
    }
  });
});

/**
 * Wave 5 mandated E2E scenarios for the uniform-leave-balance remediation.
 * Each scenario exercises one end-to-end behavior the user's brief named:
 *   A. ADMIN self-approves a leave spanning Dec 28 → Jan 8 with mixed allocations.
 *   B. Manager edits a CANCELLED leave (per Wave 1 acceptance).
 *   C. User with zero allocation in destination year tries to span.
 *   D. Concurrent global-balance upsert — partial unique index + P2002 retry.
 *
 * Pre-Wave-3 codified-bug assertions were corrected above; these scenarios
 * exist on top of (not replacing) the smoke set.
 */
test.describe("Wave 5 — uniform leave balance gating (cross-year + audit)", () => {
  // Far-future dates avoid collision with other test data; the year-window
  // helper is stateless so dates are arbitrary as long as they reach the
  // production code path through the same DTO surface.
  const YEAR_A = 2030;
  const YEAR_B = 2031;

  test("A. ADMIN self-approves Dec 28 → Jan 8 with both years funded", async ({
    asRole,
  }) => {
    const adminPage = await asRole("admin");
    const meRes = await adminPage.request.get("/api/auth/me");
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();

    const typesRes = await adminPage.request.get("/api/leave-types");
    const types = await typesRes.json();
    const cp = types.find((t: { code: string }) => t.code === "CP");
    expect(cp).toBeDefined();

    // Provision per-user balances on both years (isolated from globals).
    const bal2030 = await adminPage.request.post("/api/leaves/balances", {
      data: {
        userId: me.id,
        leaveTypeId: cp.id,
        year: YEAR_A,
        totalDays: 25,
      },
    });
    expect(bal2030.ok()).toBeTruthy();
    const bal2030Body = await bal2030.json();

    const bal2031 = await adminPage.request.post("/api/leaves/balances", {
      data: {
        userId: me.id,
        leaveTypeId: cp.id,
        year: YEAR_B,
        totalDays: 25,
      },
    });
    expect(bal2031.ok()).toBeTruthy();
    const bal2031Body = await bal2031.json();

    // Year-spanning leave: Mon Dec 30 2030 → Wed Jan 8 2031 (Paris).
    // Helper splits to { 2030: 2 days, 2031: 6 days }. Both years
    // have 25 days available → must accept and self-approve.
    const leaveRes = await adminPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: cp.id,
        startDate: `${YEAR_A}-12-30`,
        endDate: `${YEAR_B}-01-08`,
      },
    });
    expect(leaveRes.status()).toBe(201);
    const leave = await leaveRes.json();
    expect(leave.status).toBe("APPROVED");
    expect(leave.selfApproved).toBe(true);
    expect(leave.validatorId).toBe(me.id);

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/${leave.id}`);
      await adminPage.request.delete(`/api/leaves/balances/${bal2030Body.id}`);
      await adminPage.request.delete(`/api/leaves/balances/${bal2031Body.id}`);
    } catch {
      /* best-effort */
    }
  });

  test("B. ADMIN edits a CANCELLED leave — gate must permit (CANCELLED is filtered)", async ({
    asRole,
  }) => {
    // The user's Wave 1 acceptance lists "manager edits a CANCELLED
    // leave" as a mandatory scenario. We use ADMIN because the test
    // seed's manager-test user isn't guaranteed to have perimeter
    // access to contributeur-test's leaves; ADMIN has manage_any.
    // The architectural point is the same: a non-owner with permission
    // can edit a non-PENDING leave, and the gate must accept because
    // CANCELLED days are not in the subtraction set (Wave 1 #5).
    const adminPage = await asRole("admin");
    const contributeurPage = await asRole("contributeur");

    const meRes = await contributeurPage.request.get("/api/auth/me");
    const contributeur = await meRes.json();

    const typesRes = await adminPage.request.get("/api/leave-types");
    const types = await typesRes.json();
    const other = types.find((t: { code: string }) => t.code === "OTHER");
    expect(other).toBeDefined();

    // contributeur creates a 3-day leave on OTHER (no balance gate).
    const createRes = await contributeurPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: other.id,
        startDate: `${YEAR_A}-04-08`,
        endDate: `${YEAR_A}-04-10`,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // ADMIN cancels the leave (status becomes CANCELLED in DB).
    const cancelRes = await adminPage.request.post(
      `/api/leaves/${created.id}/cancel`,
    );
    expect(cancelRes.ok()).toBeTruthy();

    // ADMIN now edits the (CANCELLED) leave's date range. Gate must
    // accept: the row is in CANCELLED status, not in
    // {APPROVED, CANCELLATION_REQUESTED, PENDING}, so it does not
    // appear in getAvailableDays' subtraction even without
    // excludeLeaveId — proving finding #5 is structurally closed.
    const editRes = await adminPage.request.patch(`/api/leaves/${created.id}`, {
      data: {
        startDate: `${YEAR_A}-04-15`,
        endDate: `${YEAR_A}-04-17`,
      },
    });
    expect(editRes.ok()).toBeTruthy();
    const edited = await editRes.json();
    expect(new Date(edited.startDate).toISOString().slice(0, 10)).toBe(
      `${YEAR_A}-04-15`,
    );

    // Cleanup — the leave row stays in DB (DELETE on CANCELLED is
    // best-effort; the seed will be reset between CI runs).
    void contributeur;
    try {
      await adminPage.request.delete(`/api/leaves/${created.id}`);
    } catch {
      /* best-effort */
    }
  });

  test("C. CONTRIBUTEUR with zero allocation in destination year is rejected with the failing year named", async ({
    asRole,
  }) => {
    const adminPage = await asRole("admin");
    const contributeurPage = await asRole("contributeur");

    const meRes = await contributeurPage.request.get("/api/auth/me");
    const contributeur = await meRes.json();

    const typesRes = await adminPage.request.get("/api/leave-types");
    const types = await typesRes.json();
    const cp = types.find((t: { code: string }) => t.code === "CP");
    expect(cp).toBeDefined();

    // Year A funded with 25 days; year B funded with 0 days.
    const balA = await adminPage.request.post("/api/leaves/balances", {
      data: {
        userId: contributeur.id,
        leaveTypeId: cp.id,
        year: YEAR_A,
        totalDays: 25,
      },
    });
    expect(balA.ok()).toBeTruthy();
    const balABody = await balA.json();

    const balB = await adminPage.request.post("/api/leaves/balances", {
      data: {
        userId: contributeur.id,
        leaveTypeId: cp.id,
        year: YEAR_B,
        totalDays: 0,
      },
    });
    expect(balB.ok()).toBeTruthy();
    const balBBody = await balB.json();

    // Year-spanning leave with destination year exhausted.
    const leaveRes = await contributeurPage.request.post("/api/leaves", {
      data: {
        leaveTypeId: cp.id,
        startDate: `${YEAR_A}-12-30`,
        endDate: `${YEAR_B}-01-08`,
      },
    });
    expect(leaveRes.status()).toBe(400);
    const body = await leaveRes.json();
    // Wave 2 acceptance: rejection message names the failing year AND
    // states the exact shortfall in days.
    expect(body.message).toMatch(new RegExp(`en ${YEAR_B}`));
    expect(body.message).toMatch(/il manque \d+(\.\d+)? jours/);

    // Cleanup
    try {
      await adminPage.request.delete(`/api/leaves/balances/${balABody.id}`);
      await adminPage.request.delete(`/api/leaves/balances/${balBBody.id}`);
    } catch {
      /* best-effort */
    }
  });

  test("D. Concurrent global-balance upsert converges on a single row (partial unique index)", async ({
    asRole,
  }) => {
    // Wave 3 / finding #11. Two ADMIN calls hit
    // POST /api/leaves/balances for the same
    // (leaveTypeId, year, userId=null). Under Fastify's single-process
    // dispatcher the two requests may serialize at the application
    // layer (request 1 commits before request 2 reads), in which case
    // the P2002 retry branch in upsertBalance never fires. This test
    // therefore proves:
    //   - the partial unique index allows convergent upserts (both
    //     respond ok, both point to the SAME row id);
    //   - the response shape stays stable under concurrency.
    // It does NOT prove that the catch (P2002) → retry branch
    // executes — that requires a deterministic Postgres-level race
    // (Testcontainers + pg_advisory_lock or an in-tx barrier). The
    // retry branch is verified by code review against the advisor's
    // tx-abort analysis; an integration test for it is tracked in
    // the closeout's "Outstanding follow-ups" list.
    const adminPage = await asRole("admin");
    const typesRes = await adminPage.request.get("/api/leave-types");
    const types = await typesRes.json();
    const cp = types.find((t: { code: string }) => t.code === "CP");
    expect(cp).toBeDefined();

    // Use a far-future year to avoid colliding with any seeded global.
    const YEAR_RACE = 2099;

    // Fire two upsert requests concurrently. They share the same
    // (leaveTypeId, year, userId=null) tuple.
    const [resA, resB] = await Promise.all([
      adminPage.request.post("/api/leaves/balances", {
        data: { leaveTypeId: cp.id, year: YEAR_RACE, totalDays: 17 },
      }),
      adminPage.request.post("/api/leaves/balances", {
        data: { leaveTypeId: cp.id, year: YEAR_RACE, totalDays: 23 },
      }),
    ]);
    expect(resA.ok()).toBeTruthy();
    expect(resB.ok()).toBeTruthy();
    const bodyA = await resA.json();
    const bodyB = await resB.json();
    // Both responses point to the same row (same id). If the partial
    // unique index were absent or the retry broken, the two requests
    // could create two distinct rows or one of them could 5xx.
    expect(bodyA.id).toBe(bodyB.id);

    // Read back via the balances endpoint to confirm only ONE global
    // exists for (leaveTypeId, YEAR_RACE).
    const listRes = await adminPage.request.get(
      `/api/leaves/balances/defaults?year=${YEAR_RACE}`,
    );
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    const matches = list.filter(
      (b: { leaveTypeId: string }) => b.leaveTypeId === cp.id,
    );
    expect(matches.length).toBe(1);

    // Cleanup — remove the global so re-runs are deterministic.
    try {
      await adminPage.request.delete(`/api/leaves/balances/${bodyA.id}`);
    } catch {
      /* best-effort */
    }
  });
});
