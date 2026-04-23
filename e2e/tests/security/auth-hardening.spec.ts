import { test, expect } from "@playwright/test";
import { ROLE_LOGINS, ROLE_PASSWORD } from "../../fixtures/roles";

/**
 * W5.2 — Security E2E: SEC-03, SEC-04, SEC-05
 *
 * SEC-03 (commit 422b74d): role/permissions MUST NOT be persisted in localStorage.
 *                          Tampering `auth_user_display` must not grant privileges.
 * SEC-04 (commit 6dff276): 15-min access token with `jti`, refresh-token flow at
 *                          POST /auth/refresh, logout blacklists JWT via Redis,
 *                          refresh rotation + reuse detection revokes all user tokens.
 * SEC-05 (commit 3d977a8): POST /auth/login throttled to 5 req / 60s. The 6th rapid
 *                          attempt must return 429.
 *
 * All tests hit the API directly (no UI login) and do not rely on storageState,
 * so this spec runs in the default chromium project (no dependencies).
 */

// Ensure no storageState leaks from parent projects: each test creates its own context.
test.use({ storageState: { cookies: [], origins: [] } });

// This spec targets the API directly and is role-agnostic. Playwright is
// configured to pick up anything under `e2e/tests/` for each of the 6 role
// projects; running these tests 6× would just trample the shared login
// throttle bucket. Scope execution to the `admin` project (arbitrary choice).
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "admin",
    "auth hardening spec runs once under the admin project (API-only, role-agnostic)",
  );
});

// Helper: resolve the API URL (frontend proxies "/api" to the NestJS backend).
function apiUrl(baseURL: string | undefined, path: string): string {
  const base = baseURL ?? "http://localhost:4001";
  return `${base.replace(/\/$/, "")}/api${path}`;
}

async function loginAs(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string | undefined,
  login: string,
  password: string,
) {
  const res = await request.post(apiUrl(baseURL, "/auth/login"), {
    data: { login, password },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    user: { id: string; role: string };
  }>;
}

test.describe("Security — auth hardening (SEC-03/04/05)", () => {
  test("SEC-03 — tampering auth_user_display does not grant admin privileges @smoke", async ({
    browser,
    baseURL,
  }) => {
    // 1. Login as CONTRIBUTEUR via API
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const { access_token, user } = await loginAs(
      ctx.request,
      baseURL,
      ROLE_LOGINS.contributeur,
      ROLE_PASSWORD,
    );
    expect(user.role).toBe("CONTRIBUTEUR");

    // 2. Inject tampered auth_user_display claiming ADMIN role into localStorage
    await page.goto(baseURL ?? "http://localhost:4001", {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(
      ({ token, tampered }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("auth_user_display", tampered);
      },
      {
        token: access_token,
        tampered: JSON.stringify({
          id: user.id,
          email: "contributeur-test@orchestr-a.test",
          firstName: "Tampered",
          lastName: "Admin",
          role: "ADMIN", // ← privilege escalation attempt
          permissions: ["users:create", "users:delete"],
          isActive: true,
        }),
      },
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    // 3. Attempt an ADMIN-guarded call (POST /users requires `users:create`)
    const attempt = await ctx.request.post(apiUrl(baseURL, "/users"), {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      data: {
        email: "hacker@example.test",
        login: "hacker",
        firstName: "Hack",
        lastName: "Er",
        password: "Whatever1!",
        role: "CONTRIBUTEUR",
      },
    });

    // Backend guards are the source of truth → must be 403 regardless of
    // what localStorage says the role is.
    expect(attempt.status()).toBe(403);

    // 4. /auth/me must still return the REAL role from the JWT
    const me = await ctx.request.get(apiUrl(baseURL, "/auth/me"), {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(me.status()).toBe(200);
    const meBody = await me.json();
    expect(meBody.role).toBe("CONTRIBUTEUR");

    await ctx.close();
  });

  test("SEC-05 — login throttle: 6th rapid wrong attempt returns 429 @smoke", async ({
    request,
    baseURL,
  }) => {
    // Use a login that does not collide with seeded roles/throttle buckets in
    // other tests — a random unknown login still triggers the throttle (it
    // keys on IP/route, not on login identity).
    const unknownLogin = `throttle-probe-${Date.now()}`;
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await request.post(apiUrl(baseURL, "/auth/login"), {
        data: { login: unknownLogin, password: "wrong-password-xyz" },
        headers: { "Content-Type": "application/json" },
      });
      statuses.push(res.status());
    }

    // First 5 → 401 (unauthorized). 6th → 429 (Too Many Requests).
    expect(
      statuses.slice(0, 5).every((s) => s === 401),
      `expected first 5 attempts to be 401, got ${JSON.stringify(statuses)}`,
    ).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  test("SEC-04 — logout blacklists access token; subsequent /auth/me returns 401 @smoke", async ({
    request,
    baseURL,
  }) => {
    const { access_token, refresh_token } = await loginAs(
      request,
      baseURL,
      ROLE_LOGINS.contributeur,
      ROLE_PASSWORD,
    );

    // Sanity — token works before logout.
    const before = await request.get(apiUrl(baseURL, "/auth/me"), {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(before.status()).toBe(200);

    // Logout → blacklist jti in Redis + revoke refresh.
    const logout = await request.post(apiUrl(baseURL, "/auth/logout"), {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      data: { refreshToken: refresh_token },
    });
    expect(logout.status()).toBe(204);

    // Same JWT must now be rejected (blacklist hit).
    const after = await request.get(apiUrl(baseURL, "/auth/me"), {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(after.status()).toBe(401);
  });

  test("SEC-04 — refresh rotation: replaying old refresh triggers reuse detection @smoke", async ({
    request,
    baseURL,
  }) => {
    // Use REFERENT to avoid polluting CONTRIBUTEUR's refresh chain that other
    // tests rely on.
    const first = await loginAs(
      request,
      baseURL,
      ROLE_LOGINS.referent,
      ROLE_PASSWORD,
    );

    // 1. Legitimate rotation: exchange old refresh for a new pair.
    const rotate1 = await request.post(apiUrl(baseURL, "/auth/refresh"), {
      data: { refreshToken: first.refresh_token },
      headers: { "Content-Type": "application/json" },
    });
    expect(rotate1.status()).toBe(200);
    const rotated = (await rotate1.json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect(rotated.refresh_token).toBeTruthy();
    expect(rotated.refresh_token).not.toBe(first.refresh_token);

    // 2. Replay of the OLD (already-consumed) refresh → 401.
    const replay = await request.post(apiUrl(baseURL, "/auth/refresh"), {
      data: { refreshToken: first.refresh_token },
      headers: { "Content-Type": "application/json" },
    });
    expect(replay.status()).toBe(401);

    // 3. Reuse detection must revoke ALL tokens for that user —
    //    even the freshly issued refresh must now be 401.
    const afterReuse = await request.post(apiUrl(baseURL, "/auth/refresh"), {
      data: { refreshToken: rotated.refresh_token },
      headers: { "Content-Type": "application/json" },
    });
    expect(afterReuse.status()).toBe(401);
  });
});
