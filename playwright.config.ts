import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.CI
  ? "http://localhost:3000"
  : "http://localhost:4001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: Number(process.env.PLAYWRIGHT_TIMEOUT) || (process.env.CI ? 45000 : 30000),
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    locale: "fr-FR",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
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
