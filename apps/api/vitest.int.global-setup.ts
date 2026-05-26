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

/** Re-point a connection string at the same DB/host but different credentials. */
function urlWithCredentials(
  base: string,
  user: string,
  password: string,
): string {
  const u = new URL(base);
  u.username = user;
  u.password = password;
  return u.toString();
}

// TOOL-DEPLOY-001 — the harness provisions the SAME two-role split as production
// (mirrors packages/database/prisma/init-roles.sql). The BASE_URL credentials are
// the owner / migration role (creates the DB, runs migrate deploy, owns the trigger).
// `app_user` is the restricted runtime role: full CRUD everywhere, but only
// INSERT+SELECT on audit_logs (UPDATE/DELETE/TRUNCATE revoked). Tests connect as
// app_user by default (`new PrismaClient()` → DATABASE_URL); specs that exercise the
// DDL/trigger path connect via DATABASE_MIGRATION_URL. If these grants drift from
// init-roles.sql, the audit-role-revoke.int.spec.ts witnesses break — self-checking.
const APP_ROLE = 'app_user';
const APP_ROLE_PASSWORD = 'int_test_app_pw';

// Unique per process + clock so parallel CI matrices / crash-leftover re-runs
// never collide. Lowercase + underscore only → safe unquoted identifier.
const EPHEMERAL_DB = `orchestr_a_int_${process.pid}_${Date.now()}`;
const MAINTENANCE_URL = urlForDatabase(BASE_URL, 'postgres');
const EPHEMERAL_URL = urlForDatabase(BASE_URL, EPHEMERAL_DB);
const APP_URL = urlWithCredentials(EPHEMERAL_URL, APP_ROLE, APP_ROLE_PASSWORD);

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
  // schema.prisma now requires directUrl (DATABASE_MIGRATION_URL) for migrate
  // deploy; here both point at the owner-credentialled ephemeral URL.
  execSync('pnpm --filter database run db:migrate:deploy', {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: EPHEMERAL_URL,
      DATABASE_MIGRATION_URL: EPHEMERAL_URL,
    },
    stdio: 'inherit',
  });

  // Provision the restricted runtime role on the freshly-migrated DB (all tables
  // + the audit trigger now exist). Connect as the owner (EPHEMERAL_URL) to run
  // the grants. Mirrors packages/database/prisma/init-roles.sql.
  const owner = new PrismaClient({
    datasources: { db: { url: EPHEMERAL_URL } },
  });
  try {
    // Cluster-level role: guard creation (another concurrent ephemeral DB on the
    // same server may have created it already). Password re-asserted so it matches
    // APP_URL regardless of which process created it.
    await owner.$executeRawUnsafe(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_ROLE}') THEN
           CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${APP_ROLE_PASSWORD}';
         END IF;
       END $$;`,
    );
    await owner.$executeRawUnsafe(
      `ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${APP_ROLE_PASSWORD}'`,
    );
    await owner.$executeRawUnsafe(
      `GRANT CONNECT ON DATABASE "${EPHEMERAL_DB}" TO ${APP_ROLE}`,
    );
    await owner.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`,
    );
    await owner.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`,
    );
    await owner.$executeRawUnsafe(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`,
    );
    // The defence-in-depth REVOKE: audit_logs is append-only for the runtime role.
    await owner.$executeRawUnsafe(
      `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ${APP_ROLE}`,
    );
  } finally {
    await owner.$disconnect();
  }

  // Workers (forked after this resolves) inherit these. Default `new PrismaClient()`
  // connects as the restricted app role (production parity); specs that need DDL or
  // a trigger-disable connect explicitly via DATABASE_MIGRATION_URL (the owner).
  process.env.DATABASE_URL = APP_URL;
  process.env.DATABASE_MIGRATION_URL = EPHEMERAL_URL;
  console.log(
    `[int-harness] provisioned restricted role "${APP_ROLE}" on "${EPHEMERAL_DB}".`,
  );
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
