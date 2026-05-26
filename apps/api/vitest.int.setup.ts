import 'reflect-metadata';

/**
 * TST-DB-001 — per-process setup for the integration suite.
 *
 * Deliberately does NOT load `vitest.setup.ts`: that file's `vi.mock('database')`
 * swaps PrismaClient for a stub and would defeat the whole point of a real-DB
 * harness. The integration suite resolves the REAL `database` module (aliased +
 * inlined in vitest.int.config.ts) against the ephemeral Postgres provisioned by
 * vitest.int.global-setup.ts. The only shared concern kept from the unit setup is
 * the deterministic timezone (`reflect-metadata` is required for Nest decorators
 * should an integration test instantiate a provider).
 */
if (process.env.LEAVE_TZ_OVERRIDE_OFF !== '1') {
  process.env.TZ = 'Europe/Paris';
}
