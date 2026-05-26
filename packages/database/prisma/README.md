# Prisma — database roles & migrations (ORCHESTR'A)

## Two-role DB split (TOOL-DEPLOY-001)

`audit_logs` is an append-only, hash-chained audit trail (OBS-002 / DAT-009). It is
protected by **two independent controls**:

1. **Immutability trigger** `audit_logs_no_update_delete` — `RAISE`s on any
   `UPDATE`/`DELETE` (SQLSTATE 23514, `/append-only/`). Blocks _every_ role,
   including a superuser, unless the trigger is explicitly disabled.
2. **Privilege REVOKE** (this split) — the application runtime connects as a
   restricted role that simply _has no_ `UPDATE`/`DELETE`/`TRUNCATE` privilege on
   `audit_logs` (SQLSTATE 42501, `permission denied`). Postgres checks this
   **before** any trigger fires, so even a trigger bypass (an operator running
   `ALTER TABLE … DISABLE TRIGGER`) leaves the runtime role unable to mutate the
   trail.

The two roles:

| Role                 | Connection string                                 | Used by                                                           | Privileges                                                   |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| **app** (`app_user`) | `DATABASE_URL` (datasource `url`)                 | NestJS runtime (`PrismaService`)                                  | full CRUD everywhere; **only INSERT+SELECT on `audit_logs`** |
| **migration/owner**  | `DATABASE_MIGRATION_URL` (datasource `directUrl`) | `prisma migrate deploy`, `db push/pull`, audit hash-chain scripts | full privileges (owns the schema + trigger)                  |

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")            // restricted app role (runtime)
  directUrl = env("DATABASE_MIGRATION_URL")  // DDL/owner role (migrate + maintenance)
}
```

> `prisma generate` does **not** require `DATABASE_MIGRATION_URL` (it only parses the
> schema). `prisma migrate deploy` / `db push` / `db pull` **do**.

## One-time provisioning per environment

The migration role is the **existing schema owner** (the `POSTGRES_USER`, e.g.
`orchestr_a`) — it is _not_ created by the script (reusing it avoids reassigning
ownership of every table, and it already holds the `ALTER TABLE` privilege the
maintenance scripts need). Run **once**, AFTER the first `prisma migrate deploy`
(so every table + the trigger exist), as a superuser / the owner role:

```bash
psql "$DATABASE_MIGRATION_URL" \
     -v app_password="'CHANGE_ME_strong_password'" \
     -f packages/database/prisma/init-roles.sql
```

Then point the runtime at the restricted role:

```dotenv
# .env.production
DATABASE_USER=orchestr_a                 # owner → DATABASE_MIGRATION_URL
DATABASE_PASSWORD=<owner-password>
APP_DATABASE_USER=app_user               # restricted → DATABASE_URL
APP_DATABASE_PASSWORD=CHANGE_ME_strong_password
```

`docker-compose.prod.yml` composes `DATABASE_URL` from `APP_DATABASE_*` and
`DATABASE_MIGRATION_URL` from `DATABASE_*`. `init-roles.sql` is **idempotent** (the
role is created only if absent; the password is re-asserted on every run, which also
makes the script a rotation tool; `ALTER DEFAULT PRIVILEGES` keeps future migration
tables accessible to `app_user` automatically).

### Verify the split

```bash
# app role — expect: ERROR: permission denied for table audit_logs (42501)
psql "$DATABASE_URL" -c "UPDATE audit_logs SET action='x' WHERE false;"

# app role — expect: success (emissions + reads must keep working)
psql "$DATABASE_URL" -c "SELECT count(*) FROM audit_logs;"
```

## Audit hash-chain maintenance scripts

`normalize-action-codes.ts` (AUD-READ-001) and `recompute-chain-on-schema-bump.ts`
(DAT-021) `DISABLE`/`ENABLE` the immutability trigger and rewrite rows — DDL that the
restricted app role cannot perform. They **refuse to run** unless
`DATABASE_MIGRATION_URL` is exported, and connect through it (never the app role):

```bash
DATABASE_MIGRATION_URL="postgresql://orchestr_a:<owner-pw>@host:5432/db" \
  node apps/api/dist/scripts/normalize-action-codes.js --dry-run
```
