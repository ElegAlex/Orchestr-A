/**
 * SEC-030 — server-side managed-perimeter on cross-user leave-balance and skills
 * reads, plus the `leaves:read_balance_any` org-wide grant.
 *
 * GET /api/leaves/balance/:userId
 *   - self → always allowed.
 *   - else: `leaves:manage_any` OR `leaves:read_balance_any` → org-wide bypass;
 *     otherwise `leaves:approve` + managed-service perimeter (assertCanManageUser).
 * GET /api/skills/user/:userId
 *   - self → always allowed; else assertCanManageUser (NO read_balance_any bypass).
 *
 * Discriminating matrix (target = a main-seed employee OUTSIDE testService, i.e.
 * outside MANAGER's managed perimeter):
 *   role         balance(out)   skills(out)
 *   MANAGER      403            403          ← perimeter denial (no org-wide grant)
 *   HR_OFFICER   200            403          ← read_balance_any lifts balance ONLY
 *   ADMIN        200            200          ← manage_any / ADMIN-template
 *
 * The HR_OFFICER balance-200 / skills-403 contrast isolates `leaves:read_balance_any`:
 * HR_OFFICER is NOT ADMIN-template (skills still denied) and has NO manage_any, so
 * its org-wide balance read can only come from that grant. MANAGER (which DOES hold
 * `leaves:readAll` + `leaves:approve`) stays denied — proving the discriminator is
 * the narrow `read_balance_any`, not a near-universal read permission.
 *
 * HR_OFFICER is a SYSTEM role and not directly assignable via POST /users, so we
 * provision an institutional role bound to the HR_OFFICER template (the product's
 * intended mechanism) and create a user against it.
 *
 * API-only; runs once under the admin project. Auth uses the real role logins from
 * auth.setup (storage states) + a real login for the provisioned HR user.
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

/** Real login tolerant of the 5/min login throttle (mirrors auth.setup). */
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
  if (!res.ok()) {
    throw new Error(
      `login ${login} failed: ${res.status()} ${await res.text()}`,
    );
  }
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
    "SEC-030 balance/skills scope runs once under the admin project (API-only)",
  );
});

// Serial: one worker, one beforeAll (provisions a shared HR_OFFICER user/role).
test.describe
  .serial("SEC-030 — leave-balance & skills managed-perimeter scope", () => {
  const stamp = Date.now();
  const ROLE_CODE = `E2E_HR_OFFICER_${stamp}`;
  let roleId: string | null = null;
  let hrUserId: string | null = null;
  let hrToken = "";
  let outOfPerimeterId = ""; // main-seed employee, outside testService
  let inPerimeterId = ""; // contributeur-test, shares testService with manager

  test.beforeAll(async ({ request }) => {
    // API-only spec: only the admin project executes it (see beforeEach skip).
    // Don't run the heavy provisioning under the other 5 role projects.
    if (test.info().project.name !== "admin") return;
    test.setTimeout(180_000); // provisioning + a possible 60s login-throttle retry
    const admin = tokenFor("admin");

    // Provision an institutional role bound to the HR_OFFICER template.
    const roleRes = await request.post(`${baseUrl()}/api/roles`, {
      headers: bearer(admin, true),
      data: {
        code: ROLE_CODE,
        label: `E2E HR Officer ${stamp}`,
        templateKey: "HR_OFFICER",
      },
    });
    expect(
      roleRes.ok(),
      `create HR_OFFICER role: ${roleRes.status()} ${await roleRes.text()}`,
    ).toBe(true);
    roleId = (await roleRes.json()).id;

    // Create a user holding that role, then log in as them (real login).
    const userRes = await request.post(`${baseUrl()}/api/users`, {
      headers: bearer(admin, true),
      data: {
        email: `hr-${stamp}@orchestr-a.test`,
        login: `hr-${stamp}`,
        password: "HrE2e1234!",
        firstName: "HR",
        lastName: "Officer",
        roleCode: ROLE_CODE,
      },
    });
    expect(
      userRes.ok(),
      `create HR user: ${userRes.status()} ${await userRes.text()}`,
    ).toBe(true);
    hrUserId = (await userRes.json()).id;
    hrToken = await loginWithRetry(request, `hr-${stamp}`, "HrE2e1234!");

    // Out-of-perimeter target: a main-seed employee (not a *-test user, not ADMIN),
    // hence not in testService → outside MANAGER's managed perimeter.
    const usersRes = await request.get(`${baseUrl()}/api/users?limit=200`, {
      headers: bearer(admin),
    });
    const body = await usersRes.json();
    const list: Array<{ id: string; login: string; role?: { code?: string } }> =
      Array.isArray(body) ? body : (body.data ?? body.items ?? []);
    const target = list.find(
      (u) =>
        !u.login.endsWith("-test") &&
        u.login !== "admin" &&
        !u.login.startsWith("hr-") &&
        u.role?.code !== "ADMIN",
    );
    expect(target, "no out-of-perimeter employee found in seed").toBeTruthy();
    outOfPerimeterId = target!.id;

    // In-perimeter target: contributeur-test shares testService with manager-test.
    inPerimeterId = idForRole("contributeur");
  });

  test.afterAll(async ({ request }) => {
    const admin = tokenFor("admin");
    if (hrUserId) {
      await request
        .delete(`${baseUrl()}/api/users/${hrUserId}`, {
          headers: bearer(admin),
        })
        .catch(() => undefined);
    }
    if (roleId) {
      await request
        .delete(`${baseUrl()}/api/roles/${roleId}`, { headers: bearer(admin) })
        .catch(() => undefined);
    }
  });

  // ─── BALANCE ──────────────────────────────────────────────────────────────
  test("MANAGER is denied an out-of-perimeter balance (403)", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/leaves/balance/${outOfPerimeterId}`,
      { headers: bearer(tokenFor("manager")) },
    );
    expect(res.status(), await res.text()).toBe(403);
  });

  test("HR_OFFICER reads any balance org-wide via leaves:read_balance_any (200)", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/leaves/balance/${outOfPerimeterId}`,
      { headers: bearer(hrToken) },
    );
    expect(res.status(), await res.text()).toBe(200);
  });

  test("ADMIN reads the same balance (200) — confirms the target balance is readable", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/leaves/balance/${outOfPerimeterId}`,
      { headers: bearer(tokenFor("admin")) },
    );
    expect(res.status(), await res.text()).toBe(200);
  });

  test("MANAGER reads an IN-perimeter balance (shared service) (200)", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/leaves/balance/${inPerimeterId}`,
      { headers: bearer(tokenFor("manager")) },
    );
    expect(res.status(), await res.text()).toBe(200);
  });

  // ─── SKILLS (no read_balance_any bypass — assertCanManageUser only) ─────────
  test("MANAGER is denied out-of-perimeter skills (403)", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/skills/user/${outOfPerimeterId}`,
      { headers: bearer(tokenFor("manager")) },
    );
    expect(res.status(), await res.text()).toBe(403);
  });

  test("HR_OFFICER is STILL denied out-of-perimeter skills (403) — isolates read_balance_any to balance", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/skills/user/${outOfPerimeterId}`,
      { headers: bearer(hrToken) },
    );
    expect(res.status(), await res.text()).toBe(403);
  });

  test("ADMIN reads out-of-perimeter skills (200) — ADMIN-template bypass", async ({
    request,
  }) => {
    const res = await request.get(
      `${baseUrl()}/api/skills/user/${outOfPerimeterId}`,
      { headers: bearer(tokenFor("admin")) },
    );
    expect(res.status(), await res.text()).toBe(200);
  });
});
