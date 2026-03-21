import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.CI
  ? "http://localhost:3000"
  : "http://localhost:4001";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout:
    Number(process.env.PLAYWRIGHT_TIMEOUT) || (process.env.CI ? 45000 : 30000),
  workers: process.env.CI ? 1 : undefined,
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
      testMatch: /^[^/\\]+\.spec\.[jt]s$/,
      use: { ...devices["Desktop Chrome"] },
    },

    // ─── Tests structurés par rôle dans e2e/tests/ ──────────────────────────
    {
      name: "admin",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
    },
    {
      name: "responsable",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/responsable.json",
      },
    },
    {
      name: "manager",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/manager.json",
      },
    },
    {
      name: "referent",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/referent.json",
      },
    },
    {
      name: "contributeur",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/contributeur.json",
      },
    },
    {
      name: "observateur",
      testDir: "./e2e/tests",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/observateur.json",
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
