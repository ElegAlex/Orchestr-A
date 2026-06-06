/**
 * COR-001 — a leave-validation delegation only empowers the delegate for leaves
 * whose ASSIGNED validator is the delegator (delegatorId === leave.validatorId).
 *
 * Before the fix, canValidate() honoured ANY active delegation naming the caller
 * as delegate, so any delegate could approve any leave — bypassing the assigned
 * validator / managed-perimeter checks. The fix scopes the delegation fallback to
 * `delegatorId = leave.validatorId`.
 *
 * Discriminating setup. The delegation fallback is only reachable by an approver
 * who (a) holds leaves:approve, (b) is NOT the assigned validator, (c) lacks
 * manage_any, and (d) does NOT share the leave-owner's service (otherwise the
 * managed-perimeter branch approves first). Every seeded *-test user shares
 * testService, so we provision a fresh leave-owner inside testDepartment (its
 * manager — responsable-test — becomes the assigned validator) but in NO service,
 * making MANAGER (manager-test) a foreign approver whose only possible path is the
 * delegation fallback.
 *
 *   Arm A (wrong delegator): ADMIN delegates → MANAGER. MANAGER approves the
 *     leave → 403. The active delegation does NOT emanate from the leave's
 *     validator (responsable-test), so it is inert. (Pre-fix: this returned 200.)
 *   Arm B (right delegator): RESPONSABLE (= the assigned validator) delegates →
 *     MANAGER. MANAGER approves the same leave → 200. Proves the discriminator is
 *     delegator identity, not "delegations don't work".
 *
 * API-only; runs once under the admin project. Real role logins (storage states)
 * + one real login for the provisioned leave-owner.
 */

import * as fs from "fs";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

function tokenFor(role: Role): string {
  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(`Storage state missing for "${role}" at ${storagePath}.`);
  }
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const entry = storage.origins?.[0]?.localStorage?.find(
    (i: { name: string }) => i.name === "access_token",
  );
  if (!entry?.value) throw new Error(`No access_token for "${role}"`);
  return entry.value as string;
}

function baseUrl(): string {
  return test.info().project.use.baseURL ?? "http://localhost:4001";
}

function bearer(token: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function loginWithRetry(
  request: APIRequestContext,
  login: string,
  password: string,
): Promise<string> {
  let res = await request.post(`${baseUrl()}/api/auth/login`, {
    data: { login, password },
  });
  for (let i = 0; i < 3 && res.status() === 429; i++) {
    await new Promise((r) => setTimeout(r, 60_000));
    res = await request.post(`${baseUrl()}/api/auth/login`, {
      data: { login, password },
    });
  }
  if (!res.ok())
    throw new Error(
      `login ${login} failed: ${res.status()} ${await res.text()}`,
    );
  return (await res.json()).access_token as string;
}

/** Read a role's own user id straight from its storage state (no /users/me route). */
function idForRole(role: Role): string {
  const storage = JSON.parse(
    fs.readFileSync(ROLE_STORAGE_PATHS[role], "utf-8"),
  );
  const entry = storage.origins?.[0]?.localStorage?.find(
    (i: { name: string }) => i.name === "user",
  );
  if (!entry?.value) throw new Error(`No user entry in storage for "${role}"`);
  return JSON.parse(entry.value).id as string;
}

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "COR-001 delegation scope runs once under the admin project (API-only)",
  );
});

test.describe
  .serial("COR-001 — delegation only valid from the leave's validator", () => {
  const stamp = Date.now();
  const ROLE_CODE = `E2E_LEAVE_OWNER_${stamp}`;
  let roleId: string | null = null;
  let ownerId: string | null = null;
  let leaveId: string | null = null;
  let managerId = "";
  let responsableId = "";
  const delegationIds: string[] = [];

  // Delegation window must cover "today" (canValidate checks active-now).
  const today = new Date();
  const delegStart = ymd(new Date(today.getTime() - 86_400_000));
  const delegEnd = ymd(new Date(today.getTime() + 30 * 86_400_000));

  test.beforeAll(async ({ request }) => {
    // API-only spec: only the admin project executes it (see beforeEach skip).
    // Don't run the heavy provisioning under the other 5 role projects.
    if (test.info().project.name !== "admin") return;
    test.setTimeout(180_000); // provisioning + a possible 60s login-throttle retry
    const admin = tokenFor("admin");
    managerId = idForRole("manager");
    responsableId = idForRole("responsable");

    // testDepartment id (its manager is responsable-test → assigned validator).
    const deptRes = await request.get(`${baseUrl()}/api/departments`, {
      headers: bearer(admin),
    });
    expect(deptRes.ok(), `GET /departments: ${deptRes.status()}`).toBe(true);
    const dl = await deptRes.json();
    const depts = Array.isArray(dl) ? dl : (dl.data ?? dl.items ?? []);
    const testDeptId = depts.find(
      (d: { name: string }) => d.name === "Test Department",
    )?.id;
    expect(testDeptId, "Test Department not found").toBeTruthy();

    // Institutional role (BASIC_USER template) for the leave-owner.
    const roleRes = await request.post(`${baseUrl()}/api/roles`, {
      headers: bearer(admin, true),
      data: {
        code: ROLE_CODE,
        label: `E2E Leave Owner ${stamp}`,
        templateKey: "BASIC_USER",
      },
    });
    expect(
      roleRes.ok(),
      `create role: ${roleRes.status()} ${await roleRes.text()}`,
    ).toBe(true);
    roleId = (await roleRes.json()).id;

    // Leave-owner: in testDepartment, NO service → MANAGER cannot approve via
    // the managed-perimeter branch (no shared service).
    const userRes = await request.post(`${baseUrl()}/api/users`, {
      headers: bearer(admin, true),
      data: {
        email: `leaveowner-${stamp}@orchestr-a.test`,
        login: `leaveowner-${stamp}`,
        password: "Owner1234!",
        firstName: "Leave",
        lastName: "Owner",
        roleCode: ROLE_CODE,
        departmentId: testDeptId,
      },
    });
    expect(
      userRes.ok(),
      `create owner: ${userRes.status()} ${await userRes.text()}`,
    ).toBe(true);
    ownerId = (await userRes.json()).id;

    const ownerToken = await loginWithRetry(
      request,
      `leaveowner-${stamp}`,
      "Owner1234!",
    );

    // A balance-tracked leave-type id from a seeded user's balance (the fresh
    // owner has none yet). The E2E seed uses code "CP_E2E"; fall back to whatever
    // type the seed exposes.
    const cbal = await request.get(`${baseUrl()}/api/leaves/me/balance`, {
      headers: bearer(tokenFor("contributeur")),
    });
    expect(cbal.ok(), `contributeur balance: ${cbal.status()}`).toBe(true);
    const byType = (await cbal.json()).byType as Array<{
      leaveTypeId: string;
      leaveTypeCode: string;
    }>;
    const cp = byType.find((b) => /CP/i.test(b.leaveTypeCode)) ?? byType[0];
    expect(cp, "no leave type available from balance").toBeTruthy();
    const cpTypeId = cp!.leaveTypeId;

    // Provision a balance for the owner (year 2026, matching the leave dates) so
    // the create passes the server-side balance gate. Admin holds leaves:manage.
    const balUp = await request.post(`${baseUrl()}/api/leaves/balances`, {
      headers: bearer(admin, true),
      data: {
        userId: ownerId,
        leaveTypeId: cpTypeId,
        year: 2026,
        totalDays: 25,
      },
    });
    expect(
      balUp.ok(),
      `provision owner balance: ${balUp.status()} ${await balUp.text()}`,
    ).toBe(true);

    // Owner self-creates a PENDING leave (future weekdays) → validatorId frozen to
    // the dept manager (responsable-test) since no delegation exists yet.
    const createRes = await request.post(`${baseUrl()}/api/leaves`, {
      headers: bearer(ownerToken, true),
      data: {
        leaveTypeId: cpTypeId,
        startDate: "2026-09-14T00:00:00.000Z",
        endDate: "2026-09-15T00:00:00.000Z",
      },
    });
    expect(
      createRes.ok(),
      `create leave: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);
    const leave = await createRes.json();
    leaveId = leave.id;
    expect(leave.status, "leave should be PENDING").toBe("PENDING");
    // The assigned validator must be responsable-test (the dept manager).
    expect(leave.validatorId, "validator should be responsable-test").toBe(
      responsableId,
    );
  });

  test.afterAll(async ({ request }) => {
    const admin = tokenFor("admin");
    for (const id of delegationIds) {
      await request
        .delete(`${baseUrl()}/api/leaves/delegations/${id}`, {
          headers: bearer(admin),
        })
        .catch(() => undefined);
    }
    if (ownerId)
      await request
        .delete(`${baseUrl()}/api/users/${ownerId}`, { headers: bearer(admin) })
        .catch(() => undefined);
    if (roleId)
      await request
        .delete(`${baseUrl()}/api/roles/${roleId}`, { headers: bearer(admin) })
        .catch(() => undefined);
  });

  test("Arm A — delegation from a NON-validator (admin) does NOT let the delegate approve (403)", async ({
    request,
  }) => {
    // ADMIN delegates approval to MANAGER. ADMIN is NOT the leave's validator.
    const delegRes = await request.post(`${baseUrl()}/api/leaves/delegations`, {
      headers: bearer(tokenFor("admin"), true),
      data: { delegateId: managerId, startDate: delegStart, endDate: delegEnd },
    });
    expect(
      delegRes.ok(),
      `admin delegation: ${delegRes.status()} ${await delegRes.text()}`,
    ).toBe(true);
    const adminDelegationId = (await delegRes.json()).id;
    delegationIds.push(adminDelegationId);

    const approveRes = await request.post(
      `${baseUrl()}/api/leaves/${leaveId}/approve`,
      { headers: bearer(tokenFor("manager")) },
    );
    expect(
      approveRes.status(),
      `MANAGER must be denied: a delegation from admin (≠ validator) is inert. Got ${approveRes.status()}: ${await approveRes.text()}`,
    ).toBe(403);

    // Remove the admin delegation before Arm B so only the validator's remains.
    await request
      .delete(`${baseUrl()}/api/leaves/delegations/${adminDelegationId}`, {
        headers: bearer(tokenFor("admin")),
      })
      .catch(() => undefined);
  });

  test("Arm B — delegation from the assigned validator (responsable) DOES let the delegate approve (200)", async ({
    request,
  }) => {
    // RESPONSABLE (= the leave's assigned validator) delegates to MANAGER.
    const delegRes = await request.post(`${baseUrl()}/api/leaves/delegations`, {
      headers: bearer(tokenFor("responsable"), true),
      data: { delegateId: managerId, startDate: delegStart, endDate: delegEnd },
    });
    expect(
      delegRes.ok(),
      `responsable delegation: ${delegRes.status()} ${await delegRes.text()}`,
    ).toBe(true);
    delegationIds.push((await delegRes.json()).id);

    const approveRes = await request.post(
      `${baseUrl()}/api/leaves/${leaveId}/approve`,
      { headers: bearer(tokenFor("manager")) },
    );
    expect(
      approveRes.ok(),
      `MANAGER should approve via the validator's delegation. Got ${approveRes.status()}: ${await approveRes.text()}`,
    ).toBe(true);
    expect((await approveRes.json()).status).toBe("APPROVED");
  });
});
