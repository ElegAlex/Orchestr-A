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

/**
 * Per-test throttle-bucket isolation.
 *
 * POST /auth/login is throttled to 5 req / 60s, keyed on the real client IP
 * (ThrottlerBehindProxyGuard → clientIp → Fastify trustProxy). Under workers>1
 * the whole CI suite (auth.setup's 6 logins + these tests) shares ONE IP, so the
 * bucket is already partially consumed before SEC-05 even starts — the cause of
 * the flaky `[401,401,401,429,…]`.
 *
 * Give each auth test its own client identity via X-Forwarded-For. TRUST_PROXY =
 * ['loopback','uniquelocal'] resolves the leftmost UNTRUSTED hop as the client,
 * so a public TEST-NET-2 address (198.51.100.0/24, outside uniquelocal) becomes
 * the throttle key — a private bucket per test. The web proxy forwards
 * x-forwarded-for verbatim (only x-real-ip / x-forwarded-host are stripped).
 * This simulates distinct clients (production reality); it does NOT weaken the
 * throttle — SEC-05 still proves the 6th attempt for ITS client returns 429.
 */
function xffHeaders(ip: string): Record<string, string> {
  return { "X-Forwarded-For": ip };
}

async function loginAs(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string | undefined,
  login: string,
  password: string,
  clientIp: string,
) {
  const res = await request.post(apiUrl(baseURL, "/auth/login"), {
    data: { login, password },
    headers: { "Content-Type": "application/json", ...xffHeaders(clientIp) },
  });
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    access_token: string;
    user: {
      id: string;
      role: {
        id: string;
        code: string;
        label: string;
        templateKey: string;
        isSystem: boolean;
      } | null;
    };
  };

  // refresh_token is placed in an HttpOnly Set-Cookie header (not the JSON body).
  // Extract it here so callers can pass it to /auth/refresh and /auth/logout.
  // The server encodeURIComponent-encodes the value; decode it on the way out.
  // Match both the legacy name (orchestr_a_refresh_token) and the __Host- variant
  // (used in production) so the helper works in dev and prod environments.
  let refresh_token: string | undefined;
  const setCookieHeaders = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  for (const header of setCookieHeaders) {
    const match = header.match(/(?:__Host-)?orchestr_a_refresh_token=([^;]+)/);
    if (match) {
      refresh_token = decodeURIComponent(match[1]);
      break;
    }
  }

  return { ...body, refresh_token };
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
      "198.51.100.3",
    );
    // role is an object {id, code, label, templateKey, isSystem} — assert the code.
    // The seeded user contributeur-test has role code BASIC_USER (see seed.ts:1722).
    expect(user.role?.code).toBe("BASIC_USER");

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
    // /auth/me returns AuthenticatedUser where role is the same object shape.
    expect(meBody.role?.code).toBe("BASIC_USER");

    await ctx.close();
  });

  test("SEC-05 — login throttle: 6th rapid wrong attempt returns 429 @smoke", async ({
    request,
    baseURL,
  }) => {
    // Own client IP (X-Forwarded-For) → a private 5/60s throttle bucket that no
    // other test or auth.setup login touches, so the first 5 attempts are the
    // only consumers and the 6th deterministically trips 429.
    const unknownLogin = `throttle-probe-${Date.now()}`;
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await request.post(apiUrl(baseURL, "/auth/login"), {
        data: { login: unknownLogin, password: "wrong-password-xyz" },
        headers: {
          "Content-Type": "application/json",
          ...xffHeaders("198.51.100.50"),
        },
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
      "198.51.100.41",
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
      "198.51.100.42",
    );

    // 1. Legitimate rotation: exchange old refresh for a new pair.
    //    The API returns { access_token } in the body and a new refresh token
    //    in the Set-Cookie header (same pattern as /auth/login).
    const rotate1 = await request.post(apiUrl(baseURL, "/auth/refresh"), {
      data: { refreshToken: first.refresh_token },
      headers: { "Content-Type": "application/json" },
    });
    expect(rotate1.status()).toBe(200);

    // Extract the new refresh token from the Set-Cookie header.
    let rotatedRefreshToken: string | undefined;
    for (const header of rotate1
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value)) {
      const match = header.match(
        /(?:__Host-)?orchestr_a_refresh_token=([^;]+)/,
      );
      if (match) {
        rotatedRefreshToken = decodeURIComponent(match[1]);
        break;
      }
    }
    expect(rotatedRefreshToken).toBeTruthy();
    expect(rotatedRefreshToken).not.toBe(first.refresh_token);

    // 2. Replay of the OLD (already-consumed) refresh → 401.
    const replay = await request.post(apiUrl(baseURL, "/auth/refresh"), {
      data: { refreshToken: first.refresh_token },
      headers: { "Content-Type": "application/json" },
    });
    expect(replay.status()).toBe(401);

    // 3. Reuse detection must revoke ALL tokens for that user —
    //    even the freshly issued refresh must now be 401.
    const afterReuse = await request.post(apiUrl(baseURL, "/auth/refresh"), {
      data: { refreshToken: rotatedRefreshToken },
      headers: { "Content-Type": "application/json" },
    });
    expect(afterReuse.status()).toBe(401);
  });
});
