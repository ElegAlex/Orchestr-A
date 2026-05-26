-- ============================================================================
-- TOOL-DEPLOY-001 — Two-role DB split for audit_logs defence-in-depth
-- ============================================================================
-- Creates the restricted RUNTIME role (`app_user`) and grants it full CRUD on
-- every table EXCEPT audit_logs, where UPDATE / DELETE / TRUNCATE are REVOKEd.
-- audit_logs keeps only INSERT + SELECT for app_user, so even a hypothetical
-- immutability-trigger bypass (an operator running `ALTER TABLE … DISABLE
-- TRIGGER` then mutating) is blocked at the PRIVILEGE layer for the runtime
-- role — RBAC enforced by Postgres, not just by application convention. This
-- composes with the OBS-002/DAT-009 immutability trigger (d6299cc) as
-- defence-in-depth: the trigger raises if the app accidentally tries; the
-- REVOKE means the attempt is never authorized in the first place.
--
-- THE MIGRATION ROLE IS NOT CREATED HERE. It is the existing schema-owning role
-- (the one that runs `prisma migrate deploy` and owns audit_logs — typically the
-- POSTGRES_USER, e.g. `orchestr_a`). Reusing the existing owner avoids reassigning
-- ownership of every pre-existing table, and that owner already has the ALTER
-- TABLE privilege the hash-chain maintenance scripts need to DISABLE the trigger.
--   DATABASE_MIGRATION_URL  → existing owner credentials (DDL + maintenance)
--   DATABASE_URL            → app_user credentials (runtime)
--
-- RUN ONCE PER ENVIRONMENT, by a superuser / the owner role (with CREATEROLE),
-- AFTER the first `prisma migrate deploy` (so all tables + the trigger exist):
--
--   psql "$DATABASE_MIGRATION_URL" \
--        -v app_password="'CHANGE_ME_strong_password'" \
--        -f packages/database/prisma/init-roles.sql
--
-- The `-v app_password` value MUST include the surrounding single quotes as shown
-- (it is interpolated as a SQL string literal). Idempotent: safe to re-run — role
-- creation is guarded, the ALTER ROLE re-asserts (rotates) the password, and the
-- GRANT/REVOKE/ALTER DEFAULT PRIVILEGES statements are declarative.
-- ============================================================================

-- 1. Restricted application role (runtime). Postgres has no CREATE ROLE IF NOT
--    EXISTS; guard with \gexec. Password is set by the ALTER below (psql does NOT
--    interpolate :'app_password' inside a dollar-quoted DO block, so we avoid one).
SELECT 'CREATE ROLE app_user WITH LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user')
\gexec

-- (Re)assert the password — also lets this script rotate it on a later run.
ALTER ROLE app_user WITH LOGIN PASSWORD :'app_password';

-- 2. Allow app_user to connect to this database + use the schema.
SELECT format('GRANT CONNECT ON DATABASE %I TO app_user', current_database())
\gexec
GRANT USAGE ON SCHEMA public TO app_user;

-- 3. Full CRUD on every CURRENT table + sequence (audit_logs narrowed in step 4).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 4. The whole point: audit_logs is append-only for the runtime role.
--    INSERT (emissions) + SELECT (reads) remain from step 3's blanket grant;
--    UPDATE / DELETE / TRUNCATE are revoked at the privilege layer.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user;

-- 5. Future tables: migrations create new tables owned by the migration role.
--    Without default privileges, app_user would silently lose access to every
--    new table until a manual re-GRANT. Run this script connected AS the
--    migration/owner role so these defaults attach to ITS future objects.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- NOTE: a future migration that introduces ANOTHER append-only table must add a
-- matching REVOKE here (the default privileges above grant it full CRUD). Only
-- audit_logs is special today.
