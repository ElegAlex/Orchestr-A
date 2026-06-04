import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from 'database';

/**
 * DAT-036 — real-DB witness for the Client.name UNIQUE index added in
 * migration 20260528130000_dat036_client_name_unique.
 *
 * Closes the third instance of DAT-016's missing-UNIQUE failure mode (named in
 * DAT-016's Description, omitted from its literal Suggested-fix list).
 * Globally unique (NOT composite — unlike Service which is per-department):
 * two clients with identical names are now rejected at the DB regardless of
 * the app-layer pre-check.
 *
 * Prisma error-shape gotcha (DAT-016 jurisprudence): a 23505 surfaced through
 * `$executeRawUnsafe` keeps the `Key (<cols>)=(<vals>) already exists` tuple
 * but drops the index NAME — so the discriminating assertion is on the key
 * signature `Key (name)=` (not on `clients_name_key`). The index NAME is
 * locked in via a separate pg_indexes test that protects byte-equivalence
 * with Prisma's `migrate dev` output.
 *
 * Runs against the ephemeral migrated DB from vitest.int.global-setup.ts.
 */

const db = new PrismaClient();

async function expectUniqueViolation(
  insert: Promise<unknown>,
  keySignature: string,
): Promise<void> {
  let message = '';
  try {
    await insert;
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  expect(
    message,
    'expected a unique_violation (23505) but the INSERT was accepted',
  ).toMatch(/23505/);
  expect(message).toContain(keySignature);
}

function insertClient(name: string): Promise<unknown> {
  return db.$executeRawUnsafe(
    `INSERT INTO clients (id, name, "updatedAt") VALUES (gen_random_uuid(), $1, now())`,
    name,
  );
}

describe('DAT-036 — Client.name UNIQUE index (real DB)', () => {
  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('clients: rejects a second row with an identical name (clients_name_key)', async () => {
    const name = `DAT-036 client ${randomUUID()}`;
    await insertClient(name); // first row: accepted
    await expectUniqueViolation(insertClient(name), 'Key (name)=');
  });

  it('clients: accepts two rows with distinct names', async () => {
    await insertClient(`DAT-036 client a ${randomUUID()}`);
    await insertClient(`DAT-036 client b ${randomUUID()}`);
    expect(true).toBe(true);
  });

  it('index carries the exact Prisma-convention name (drift-clean migrate dev sees no diff)', async () => {
    const rows = await db.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE indexname IN ('clients_name_key', 'clients_name_idx')
       ORDER BY indexname`,
    );
    // The unique index must exist; the obsolete non-unique index must be gone.
    expect(rows.map((r) => r.indexname)).toEqual(['clients_name_key']);
  });
});
