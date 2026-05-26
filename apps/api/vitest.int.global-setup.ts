/* eslint-disable no-console */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from 'database';

/**
 * TST-DB-001 — global setup for the real-DB integration suite (`*.int.spec.ts`).
 *
 * Mechanism (BACKLOG option (b), industrialising the AUD-READ-001 / DAT-021
 * throwaway-DB prototype): connect to a PROVIDED Postgres (the dev container on
 * :5433 locally; the `services: postgres` of the CI `backend-tests` job), CREATE
 * an ephemeral database, `prisma migrate deploy` the REAL migration set into it,
 * and hand the ephemeral DATABASE_URL to the worker processes. The database is
 * DROPped on teardown. testcontainers (option (a)) was rejected: CI already
 * provisions a migrated Postgres service, and adding `@testcontainers/postgresql`
 * would break `pnpm install --frozen-lockfile` until the lockfile ships — see the
 * fix commit body.
 *
 * Worker propagation: vitest forks its worker pool AFTER globalSetup resolves, so
 * the workers inherit the `process.env.DATABASE_URL` set here. The suite runs
 * `singleFork` (one DB, one writer) to keep the audit_logs hash chain serial.
 */

const REPO_ROOT = resolve(__dirname, '../..');

const BASE_URL =
  process.env.INTEGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://orchestr_a:orchestr_a_dev_password@localhost:5433/orchestr_a_v2';

/** Re-point a base connection string at a different database on the same server. */
function urlForDatabase(base: string, dbName: string): string {
  const u = new URL(base);
  u.pathname = `/${dbName}`;
  return u.toString();
}

// Unique per process + clock so parallel CI matrices / crash-leftover re-runs
// never collide. Lowercase + underscore only → safe unquoted identifier.
const EPHEMERAL_DB = `orchestr_a_int_${process.pid}_${Date.now()}`;
const MAINTENANCE_URL = urlForDatabase(BASE_URL, 'postgres');
const EPHEMERAL_URL = urlForDatabase(BASE_URL, EPHEMERAL_DB);

let created = false;

async function withAdmin<T>(
  fn: (admin: PrismaClient) => Promise<T>,
): Promise<T> {
  const admin = new PrismaClient({
    datasources: { db: { url: MAINTENANCE_URL } },
  });
  try {
    return await fn(admin);
  } finally {
    await admin.$disconnect();
  }
}

export async function setup(): Promise<void> {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${EPHEMERAL_DB}" WITH (FORCE)`,
    );
    await admin.$executeRawUnsafe(`CREATE DATABASE "${EPHEMERAL_DB}"`);
    created = true;
  });

  console.log(`[int-harness] migrating ephemeral DB "${EPHEMERAL_DB}"…`);
  execSync('pnpm --filter database run db:migrate:deploy', {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: EPHEMERAL_URL },
    stdio: 'inherit',
  });

  // Workers (forked after this resolves) read this for `new PrismaClient()`.
  process.env.DATABASE_URL = EPHEMERAL_URL;
}

export async function teardown(): Promise<void> {
  if (!created) return;
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${EPHEMERAL_DB}" WITH (FORCE)`,
    );
  });
  console.log(`[int-harness] dropped ephemeral DB "${EPHEMERAL_DB}".`);
}
