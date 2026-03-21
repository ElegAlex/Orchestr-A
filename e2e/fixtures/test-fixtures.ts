import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import { ROLES, ROLE_LOGINS, ROLE_PASSWORD, ROLE_STORAGE_PATHS, type Role } from "./roles";

export type { Role };

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
      const ctx = await browser.newContext({
        storageState: storagePath,
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
