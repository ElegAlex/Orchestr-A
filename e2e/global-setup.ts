/**
 * TST-017 — Playwright globalSetup: reset + reseed the E2E database before each run.
 *
 * 1. POST /api/testing/reset (registered only when NODE_ENV !== 'production')
 *    truncates every table atomically — a clean, deterministic starting state
 *    with no cross-spec data leakage.
 * 2. Because the reset empties the DB, we immediately reseed (E2E_SEED=true) so
 *    the 6 role users + reference data exist for auth.setup. The seed is
 *    idempotent and fast (~2s).
 *
 * SAFETY: the reset endpoint refuses production (server-side NODE_ENV guard) and
 * cleanDatabase itself refuses any database whose name is not a disposable test
 * target (`*_e2e` / `*_test` / `orchestr_a_int_*`). The reseed targets the SAME
 * database the API uses; keep DATABASE_URL consistent between the API and this
 * process (locally + in CI's e2e steps).
 *
 * If the API is unreachable (local dev without the API running) we skip both
 * steps and leave any existing data untouched.
 */

import { execSync } from "node:child_process";
import * as path from "node:path";
import { request } from "@playwright/test";

const DEFAULT_E2E_DATABASE_URL =
  "postgresql://orchestr_a:orchestr_a_dev_password@localhost:5433/orchestr_a_v2_e2e";

function reseed(): void {
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_E2E_DATABASE_URL;
  console.log("[globalSetup] reseeding E2E database…");
  execSync("pnpm --filter database run db:seed", {
    // repo root (this file lives in <root>/e2e)
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: databaseUrl, E2E_SEED: "true" },
    stdio: "inherit",
  });
  console.log("[globalSetup] E2E database reseeded.");
}

export default async function globalSetup(): Promise<void> {
  const apiUrl = process.env.API_URL || "http://localhost:4000";
  const context = await request.newContext({ baseURL: apiUrl });

  try {
    const response = await context.post("/api/testing/reset");

    if (response.ok() || response.status() === 204) {
      console.log("[globalSetup] E2E database reset successfully.");
      reseed();
      return;
    }

    // 403 means we're in production — hard stop, never wipe prod.
    if (response.status() === 403) {
      throw new Error(
        "[globalSetup] POST /api/testing/reset returned 403 — " +
          "the endpoint is not available in production. Aborting test run.",
      );
    }

    // Other non-2xx: log a warning but don't abort (endpoint may not be
    // deployed yet in a partial environment). Do NOT reseed — the DB state is
    // unknown and we must not assume it was emptied.
    console.warn(
      `[globalSetup] DB reset returned HTTP ${response.status()} — continuing without reseed.`,
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("returned 403")) {
      throw err;
    }
    // Connection refused = API not up yet (local dev without API running).
    // Log and continue — don't block local tests that don't need isolation.
    console.warn(
      `[globalSetup] Could not reach reset endpoint: ${String(err)}. Continuing without reset/reseed.`,
    );
  } finally {
    await context.dispose();
  }
}
