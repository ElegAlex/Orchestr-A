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

test.describe("Leave balance gating + self-approval", () => {
  test(
    "@smoke type without configured balance allows arbitrary leave",
    async ({ asRole }) => {
      const page = await asRole("contributeur");

      // Fetch all available leave types
      const typesRes = await page.request.get("/api/leave-types");
      expect(typesRes.ok()).toBeTruthy();
      const types = await typesRes.json();

      // Pick the OTHER type — it has no LeaveBalance configured per the balance-gating audit,
      // so any number of days should be accepted without a balance check.
      const otherType = types.find((t: { code: string }) => t.code === "OTHER");
      expect(otherType, "OTHER leave type must exist in the database").toBeDefined();

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
    },
  );

  test(
    "@smoke ADMIN auto-approves own leave via leaves:self_approve",
    async ({ asRole }) => {
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

      // Self-approval: status must be APPROVED immediately, validatorId must be null
      // (the system approved it automatically, no human validator needed)
      expect(body.status).toBe("APPROVED");
      expect(body.validatorId).toBeNull();

      // Cleanup
      try {
        await adminPage.request.delete(`/api/leaves/${body.id}`);
      } catch {
        /* ignore cleanup failures */
      }
    },
  );

  test(
    "CONTRIBUTEUR own leave stays PENDING (no self_approve permission)",
    async ({ asRole }) => {
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
    },
  );
});
