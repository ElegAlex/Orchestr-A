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

// OBS-028 — the real-DB audit specs (audit-immutability, audit-role-revoke,
// user-harddelete-fk, several schema-constraint specs) exercise AuditService,
// which HMACs row hashes with AUDIT_HASH_KEY (audit.service.ts) and throws if it
// is unset. Locally the key comes from apps/api/.env, but CI has no .env file and
// the `backend-tests` integration step passes only DATABASE_URL/TZ — so without
// this fallback the int suite is RED in CI (and gates e2e-tests via `needs`).
// Mirror vitest.setup.ts: a fixed, ≥32-char deterministic test key.
process.env.AUDIT_HASH_KEY ??=
  'test-audit-hash-key-deterministic-0123456789abcdef';
