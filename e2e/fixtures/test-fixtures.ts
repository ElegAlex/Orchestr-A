import * as fs from "fs";
import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import {
  ROLES,
  ROLE_LOGINS,
  ROLE_PASSWORD,
  ROLE_STORAGE_PATHS,
  type Role,
} from "./roles";

export type { Role };

/**
 * The app keeps its JWT in localStorage (deliberate design) and the axios client
 * adds the `Authorization: Bearer` header on each call. Playwright's
 * `page.request.*` is a Node-side context that does NOT run that interceptor, so
 * API-level calls made through it are unauthenticated → 401. Read the token from
 * the role's storage state and attach it as an `extraHTTPHeaders` default on the
 * context, so `page.request` calls authenticate as that role like the UI does.
 */
function tokenForRole(role: Role): string | undefined {
  try {
    const storage = JSON.parse(
      fs.readFileSync(ROLE_STORAGE_PATHS[role], "utf-8"),
    );
    const entry = storage.origins?.[0]?.localStorage?.find(
      (i: { name: string }) => i.name === "access_token",
    );
    return entry?.value as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fixture `asRole` — retourne une Page authentifiée pour un rôle donné.
 *
 * Usage dans un test multi-role :
 *   const adminPage = await asRole('admin');
 *   const observateurPage = await asRole('observateur');
 */
export type AsRoleFixture = (role: Role) => Promise<Page>;

type TestFixtures = {
  asRole: AsRoleFixture;
};

type WorkerFixtures = {
  _roleContexts: Map<Role, BrowserContext>;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Contexts par rôle — créés à la demande, nettoyés après chaque test
  asRole: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const asRole: AsRoleFixture = async (role: Role) => {
      const storagePath = ROLE_STORAGE_PATHS[role];
      const token = tokenForRole(role);
      const ctx = await browser.newContext({
        storageState: storagePath,
        // Authenticate page.request.* calls as this role (see tokenForRole note).
        ...(token
          ? { extraHTTPHeaders: { Authorization: `Bearer ${token}` } }
          : {}),
      });
      contexts.push(ctx);
      return ctx.newPage();
    };

    await use(asRole);

    // Cleanup
    for (const ctx of contexts) {
      await ctx.close();
    }
  },

  // Default-page contexts: in the per-role projects (project name === role) the
  // default `page` is built from that role's storageState. Attach the role's
  // Bearer token so `page.request.*` on the default page authenticates too — the
  // localStorage JWT alone does not reach Node-side request contexts. No-op for
  // the multi-role / chromium projects (name not a role) and for the unauth
  // negative tests, which use @playwright/test's standalone `request` fixture.
  context: async ({ context }, use, testInfo) => {
    const role = testInfo.project.name as Role;
    if ((ROLES as readonly string[]).includes(role)) {
      const token = tokenForRole(role);
      if (token) {
        await context.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
      }
    }
    await use(context);
  },
});

export { expect };

/**
 * Utilitaire : authentifie une page via l'API et injecte le token dans
 * localStorage. Utilisé par auth.setup.ts.
 */
export async function injectAuthToken(
  page: Page,
  baseURL: string,
  login: string,
  password: string,
): Promise<void> {
  // Appel API direct pour obtenir le JWT
  const response = await page.request.post(`${baseURL}/api/auth/login`, {
    data: { login, password },
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok()) {
    throw new Error(
      `Auth failed for login="${login}": ${response.status()} ${await response.text()}`,
    );
  }

  const body = await response.json();
  const token: string = body.access_token;
  const user = body.user;

  if (!token) {
    throw new Error(`No access_token in response for login="${login}"`);
  }

  // Naviguer vers la baseURL pour pouvoir écrire dans localStorage
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });

  // Injecter le token dans localStorage (même clé que le frontend)
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("access_token", token);
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }
    },
    { token, user },
  );
}
