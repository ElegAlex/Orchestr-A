import * as path from "path";
import { defineConfig, devices } from "@playwright/test";

// Absolute, repo-root-anchored auth dir — must match e2e/fixtures/roles.ts
// (ROLE_STORAGE_PATHS) so the role projects read exactly what auth.setup wrote,
// independent of the process cwd (e.g. `pnpm --filter web exec` runs in apps/web).
const authPath = (role: string) =>
  path.resolve(__dirname, "playwright", ".auth", `${role}.json`);

const baseURL = process.env.CI
  ? "http://localhost:3000"
  : "http://localhost:4001";

// TST-017: reset the E2E DB to a clean state before each full Playwright run.
// The globalSetup module calls POST /api/testing/reset (NODE_ENV!==production
// guard on server) then lets CI re-seed via pnpm db:seed.
// This gives a deterministic starting state and eliminates cross-spec data leakage.
const apiURL = process.env.CI
  ? "http://localhost:3001"
  : "http://localhost:3001";

export { apiURL };

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout:
    Number(process.env.PLAYWRIGHT_TIMEOUT) || (process.env.CI ? 45000 : 30000),
  workers: process.env.CI ? 4 : undefined,
  reporter: "html",
  use: {
    baseURL,
    locale: "fr-FR",
    trace: "on-first-retry",
  },

  projects: [
    // ─── Setup : authentification des 6 rôles ───────────────────────────────
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // ─── Anciens tests dans e2e/ (racine, hors sous-dossiers) ───────────────
    {
      name: "chromium",
      testDir: "./e2e",
      testMatch: /[/\\]e2e[/\\][^/\\]+\.spec\.[jt]s$/,
      // These root specs (e.g. clients.spec.ts) read the role storage states
      // from disk via getToken(); without depending on `setup` they race the
      // serial login project under workers>1 → ENOENT on the .auth/*.json files.
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },

    // ─── Tests structurés par rôle dans e2e/tests/ ──────────────────────────
    {
      name: "admin",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authPath("admin"),
      },
    },
    {
      name: "responsable",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authPath("responsable"),
      },
    },
    {
      name: "manager",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authPath("manager"),
      },
    },
    {
      name: "referent",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authPath("referent"),
      },
    },
    {
      name: "contributeur",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authPath("contributeur"),
      },
    },
    {
      name: "observateur",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authPath("observateur"),
      },
    },

    // ─── Tests multi-rôle (fixture asRole) ──────────────────────────────────
    {
      name: "multi-role",
      testDir: "./e2e/tests/multi-role",
      dependencies: ["setup"],
      // Pas de storageState global : chaque test gère ses propres rôles via asRole
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.CI
    ? undefined // In CI, we start the server manually
    : {
        command: "pnpm --filter web dev --port 4001",
        url: "http://localhost:4001",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
