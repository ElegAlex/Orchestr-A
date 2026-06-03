/**
 * TST-017 — Playwright globalSetup: reset the E2E database before each run.
 *
 * Calls POST /api/testing/reset (registered only when NODE_ENV !== 'production').
 * This gives a clean, deterministic starting state and eliminates cross-spec
 * data leakage (specs that hardcoded year 2030/2031 to avoid collisions can
 * use real years once this is in place).
 *
 * NOTE: This gives a clean *start* for the full run. It does NOT isolate the
 * 4 parallel workers from each other within a run — full per-spec isolation
 * would require per-test transaction wrapping or serialised workers (future work).
 *
 * After this resets the DB, CI re-seeds via `pnpm --filter database db:seed`
 * (see .github/workflows/ci.yml) before Playwright starts. In local dev the
 * developer seeds manually or the server carries existing data.
 */

import { request } from "@playwright/test";

export default async function globalSetup(): Promise<void> {
  // In CI the web proxy is at localhost:3000; API at localhost:4000 directly.
  // We hit the API directly to avoid depending on the web server being up.
  const apiUrl =
    process.env.API_URL ||
    (process.env.CI ? "http://localhost:4000" : "http://localhost:4000");

  const context = await request.newContext({ baseURL: apiUrl });

  try {
    const response = await context.post("/api/testing/reset");

    if (!response.ok() && response.status() !== 204) {
      // 403 means we're in production — hard stop, never wipe prod.
      if (response.status() === 403) {
        throw new Error(
          "[globalSetup] POST /api/testing/reset returned 403 — " +
            "the endpoint is not available in production. Aborting test run.",
        );
      }
      // Other non-2xx: log a warning but don't abort (endpoint may not be
      // deployed yet in a partial environment).
      console.warn(
        `[globalSetup] DB reset returned HTTP ${response.status()} — continuing.`,
      );
    } else {
      console.log("[globalSetup] E2E database reset successfully.");
    }
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("returned 403")
    ) {
      throw err;
    }
    // Connection refused = API not up yet (local dev without API running).
    // Log and continue — don't block local tests that don't need isolation.
    console.warn(
      `[globalSetup] Could not reach reset endpoint: ${String(err)}. Continuing without reset.`,
    );
  } finally {
    await context.dispose();
  }
}
