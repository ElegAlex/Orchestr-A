# Phase 2 Audit-Hardening — Production Deploy Execution Log (RETROACTIVE)

> ⚠️ **RETROACTIVE RECONSTRUCTION — NOT A REAL-TIME RUNBOOK.**
>
> This document was **authored on 2026-05-28** (closure of DOC-001), **after** the deploy it
> describes had already shipped to production on **2026-05-26**. Unlike the Phase 1 and Phase 3
> deploy docs in this directory, it was **not seeded ahead of execution** — there is no pre-deploy
> checklist, no Gate-by-Gate decision trail, and no command-by-command output capture, because none
> were recorded at the time. The deploy rode along with the TOOL-DEPLOY-001 closeout session as a
> logistically-coupled set of migrations and was framed as a tooling task, not as a standalone
> "Phase 2 deploy" event with its own runbook.
>
> The content below is **reconstructed from durable post-hoc evidence only**:
> - the four committed migration files (verbatim SQL — non-negotiable source of truth);
> - the `_prisma_migrations` table on prod (`finished_at` timestamps, verified on 2026-05-28 12:43 UTC);
> - the `PROGRESS_LOG.md` entries of 2026-05-26 (TOOL-DEPLOY-001, AUD-READ-001, DAT-021, OBS-012,
>   OBS-002+DAT-009, DAT-007 closeouts) — these are the operator's contemporaneous record;
> - the BACKLOG entries DAT-009, DAT-007, OBS-012, DAT-021, OBS-002.
>
> Anything that cannot be traced to one of those sources is flagged inline as a **gap**
> ("non-sourçable", "not recorded at the time"). Operator recall is admitted only where it can be
> cross-verified against the post-hoc state on prod. No detail in this document is invented to
> fill a gap.
>
> **Why backfill at all?** Deploy-doc completeness. The `docs/deploy/` directory
> is the durable institutional record of every schema mutation reaching production; missing the
> Phase 2 batch breaks that promise. The gap was surfaced at Gate 0 of the Phase 3 deploy (the
> doc's "Expected last applied = `20260524100100_dat005`" baseline turned out to be stale — prod
> actually had through `20260526120000`, confirming Phase 2 had deployed out-of-band).

---

## Scope & metadata

- **Date of deploy (reconstructed):** 2026-05-26.
  - The four migrations' `finished_at` timestamps in `_prisma_migrations` on prod cluster around
    **2026-05-26 ~21:09 UTC** (verified on prod 2026-05-28 12:43 UTC during the Phase 3 deploy's
    Gate-0 sanity sweep). The exact per-migration `finished_at` values were not captured into a
    deploy log at the time; the cluster timestamp is what the durable evidence yields.
  - Closure of the source TOOL-DEPLOY-001 commit (`8c37e1d`) on master: 2026-05-26 20:31 UTC
    (22:31 Europe/Paris). Deploy gesture followed ~38 min later.
- **Operator (recall):** repository owner, executing the operator runbook embedded in the closing
  commits of the source tasks (notably `5f87026` for AUD-READ-001 and `33f7a9c` for DAT-021).
  No operator identity was written into `audit_logs` for the migration step itself; the only
  operator-identity capture from this window are the `SYSTEM_BACKFILL` rows emitted by the
  `normalize-action-codes` and `recompute-chain-on-schema-bump` scripts (see §"Post-deploy
  verification" below).
- **VPS / repo path / compose invocation:** consistent with Phase 1 — `debian@92.222.35.25`,
  `/opt/orchestra`, `docker compose -f docker-compose.prod.yml --env-file .env.production …`.
  Not separately re-verified retroactively.
- **Pre-deploy prod state (reconstructed):**
  - Git: prod HEAD was `8e4b593` after Phase 1 (per `docs/deploy/2026-05-25-phase-1-remediation-deploy.md`
    "Final state" — confirmed in `_prisma_migrations` ordering).
  - Last migration applied to prod prior to this batch: `20260524100100_dat005_convert_float_to_decimal`
    (Phase 1's terminal migration).
  - API image: `sha256:7cd9b14a…` (the Phase-1 build hotfix image — BUILD-001).
- **Migrations applied (4 files, mapping to 5 source tasks — the first migration bundles two):**

| #  | Migration folder                                                                      | Source task(s)             | Closing commit (master) | Nature                                                          |
|----|---------------------------------------------------------------------------------------|----------------------------|-------------------------|-----------------------------------------------------------------|
| 1  | `20260525190000_audit_logs_immutability_hash_chain_actor_snapshot`                    | **OBS-002 + DAT-009**      | `d6299cc`               | audit_logs hardening: immutability trigger + hash chain + actor snapshot |
| 2  | `20260525200000_dat007_project_fk_restrict_preserve_history`                          | **DAT-007**                | `0eae219`               | Project FK Cascade/SetNull → RESTRICT on 4 edges (audit history preservation) |
| 3  | `20260525210000_obs012_deployments_table`                                             | **OBS-012**                | `189344f`               | New `deployments` ledger table (release-version pinning at boot) |
| 4  | `20260526120000_dat021_audit_payload_schema_version_gin_index`                        | **DAT-021**                | `33f7a9c`               | `audit_logs.schemaVersion INTEGER NOT NULL DEFAULT 1` + JSONB GIN index + btree on schemaVersion |

  > **Non-obvious mapping note.** Migration #1 is a *bundle* of two backlog tasks (OBS-002 +
  > DAT-009) — its header comment names both. The DOC-001 finding's task list named four IDs
  > (OBS-012 / DAT-009 / DAT-021 / DAT-007); OBS-002 was implicit (closed jointly with DAT-009
  > in `d6299cc`). The verbatim count is therefore **5 source tasks across 4 migrations**.

- **Post-deploy prod state (delta — also reconstructed):**
  - `_prisma_migrations`: was 41 rows (Phase 1 terminus) → **45 rows** after Phase 2 batch
    (verified post-hoc: Phase 3's Gate-0 sweep on 2026-05-28 showed pre-Phase-3 prod count = 43,
    which had not yet incorporated the 2 Phase-3-precursor data-fix migrations DAT-003+DAT-004
    + DAT-012 etc. — see Phase 3 deploy doc for the exact 43→56 evolution).
  - Git HEAD on prod: **not separately captured** for this batch. Reconstructed inference:
    operator pulled at least up to `33f7a9c` (the terminal Phase-2 migration commit) and likely
    up to `8c37e1d` (TOOL-DEPLOY-001) since the role-split + init-roles.sql operational steps
    were run in the same session window. Prod HEAD shown at Phase-3 Gate-0 (2026-05-28) was
    `3fd8986`, which is downstream of `8c37e1d` — so the prod git pointer advanced past
    `8c37e1d` between 2026-05-26 and 2026-05-28. **Gap:** the exact prod git SHA immediately
    after this deploy was not recorded.
  - API image: **not re-tagged** with a `pre-phase-2-…` rollback anchor at the time. Phase 1
    had tagged `orchestra-api:pre-phase1-remediation` (`5a9f56cc`); the next rollback anchor in
    the history is `orchestra-api:pre-phase3-defense-in-depth` (`10c69f6fbce8`), set on
    2026-05-28 ahead of Phase 3. The image that ran from 2026-05-26 deploy until Phase 3 was
    therefore the *unanchored* hotfix image (a rebuild that picked up commits up to and
    including the Phase-2 migrations + the TOOL-DEPLOY-001 init-roles changes). **Gap:** the
    image SHA running between Phase 1 (`7cd9b14a…`) and Phase 3 (`10c69f6fbce8`) was not
    recorded. This is the single largest audit-trail gap in this batch — Phase 3's anchor
    (`10c69f6fbce8`) effectively serves as the post-Phase-2 anchor by reconstruction.
- **DB:** `orchestr_a_prod`, owner `orchestr_a`. After this batch, `app_user` (the restricted
  runtime role) was provisioned via `packages/database/prisma/init-roles.sql` (TOOL-DEPLOY-001,
  same window) and `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs` was applied to it — adding
  the privilege-layer second control on `audit_logs` to complement the immutability trigger.
  See `init-roles.sql` for the canonical DDL; the script is idempotent and run by a superuser/
  owner once per environment, separate from per-deploy migrations.

---

## Migrations applied — verbatim SQL

The SQL below is reproduced verbatim from the four committed migration files. The header
comments inside each migration carry the original task-level rationale; they are preserved
here so a future reader does not have to leave this document to understand intent.

### Migration 1 — `20260525190000_audit_logs_immutability_hash_chain_actor_snapshot` (OBS-002 + DAT-009)

```sql
-- OBS-002 + DAT-009 — audit_logs durability hardening
-- (a) BEFORE UPDATE/DELETE trigger -> RAISE EXCEPTION (immutability)
-- (c) prevHash/rowHash sha256 integrity chain (computed at INSERT by the app;
--     legacy rows backfilled here as a self-consistent sealed segment)
-- (d) actorEmail/actorLabel snapshot columns (frozen at log time, additive to actorId)
--
-- Ordering is load-bearing: all backfill UPDATEs MUST run BEFORE the immutability
-- trigger is created, otherwise the trigger would reject its own backfill.
-- The DB role split (sub-piece b) is descoped to TOOL-DEPLOY-001 (single DATABASE_URL
-- pipeline; see OBS-002/DAT-009 Learnings) — no GRANT/REVOKE here.

-- ---------------------------------------------------------------------------
-- 1. Add new columns, all nullable initially.
-- ---------------------------------------------------------------------------
ALTER TABLE "audit_logs"
  ADD COLUMN "actorEmail" TEXT,
  ADD COLUMN "actorLabel" TEXT,
  ADD COLUMN "prevHash"   TEXT,
  ADD COLUMN "rowHash"    TEXT;

-- ---------------------------------------------------------------------------
-- 2. Backfill actor snapshot from the users table (LEFT JOIN semantics:
--    system events with NULL actorId, and any dangling actorId, stay NULL).
-- ---------------------------------------------------------------------------
UPDATE "audit_logs" a
SET "actorEmail" = u."email",
    "actorLabel" = NULLIF(
      TRIM(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')),
      ''
    )
FROM "users" u
WHERE a."actorId" = u."id";

-- ---------------------------------------------------------------------------
-- 3. Backfill the hash chain over existing rows, in (createdAt ASC, id ASC)
--    order, via a recursive CTE. Legacy rows form a SEALED segment hashed with
--    Postgres canonicalization (payload::text); new rows inserted by the app
--    use fast-key-sorted JSON. The two segments join transparently because each
--    new row chains off the previous row's STORED rowHash as an opaque string.
--    On a fresh/empty table (dev) this updates 0 rows and is a no-op.
-- ---------------------------------------------------------------------------
WITH RECURSIVE ordered AS (
  SELECT
    "id", "action", "entityType", "entityId", "actorId", "createdAt", "payload",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "audit_logs"
),
chain AS (
  -- genesis row: prevHash NULL
  SELECT
    o."id", o.rn,
    NULL::text AS prev_hash,
    encode(
      sha256(convert_to(
        o."action" || '|' || o."entityType" || '|' || o."entityId" || '|' ||
        COALESCE(o."actorId", '') || '|' ||
        to_char(o."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
        COALESCE(o."payload"::text, 'null') || '|' || ''
      , 'UTF8')),
      'hex'
    ) AS row_hash
  FROM ordered o
  WHERE o.rn = 1
  UNION ALL
  -- each subsequent row chains off the previous computed row_hash
  SELECT
    o."id", o.rn,
    c.row_hash AS prev_hash,
    encode(
      sha256(convert_to(
        o."action" || '|' || o."entityType" || '|' || o."entityId" || '|' ||
        COALESCE(o."actorId", '') || '|' ||
        to_char(o."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
        COALESCE(o."payload"::text, 'null') || '|' || c.row_hash
      , 'UTF8')),
      'hex'
    ) AS row_hash
  FROM ordered o
  JOIN chain c ON o.rn = c.rn + 1
)
UPDATE "audit_logs" a
SET "prevHash" = chain.prev_hash,
    "rowHash"  = chain.row_hash
FROM chain
WHERE a."id" = chain."id";

-- ---------------------------------------------------------------------------
-- 4. rowHash is now populated for every row -> enforce NOT NULL.
--    (prevHash stays nullable: the genesis row legitimately has none.
--     actorEmail/actorLabel stay nullable: system events have no actor.)
-- ---------------------------------------------------------------------------
ALTER TABLE "audit_logs" ALTER COLUMN "rowHash" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. actorId FK: SetNull -> NoAction. A SetNull on user deletion issues an
--    UPDATE on audit_logs that the immutability trigger (step 6) would reject,
--    making such users undeletable with a confusing error. The actorEmail/
--    actorLabel snapshot preserves actor identity, so SetNull is no longer
--    needed for data preservation (DAT-009 flagged the SetNull itself).
-- ---------------------------------------------------------------------------
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Immutability: reject every UPDATE and DELETE at the row level.
--    ERRCODE check_violation (23514) makes the trigger error distinguishable
--    from a role permission denial (42501) — see TOOL-DEPLOY-001 for the
--    role-split that would add the second, defence-in-depth layer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted (OBS-002/DAT-009)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
```

### Migration 2 — `20260525200000_dat007_project_fk_restrict_preserve_history` (DAT-007)

```sql
-- DAT-007 — Preserve audit/operational history on Project hard-delete
--
-- Flip the four Project FK edges that destroy (or silently unlink) historical
-- rows when a Project is hard-deleted, from Cascade/SetNull to RESTRICT:
--   tasks, project_snapshots, documents  (were Cascade  -> rows were erased)
--   time_entries                          (was SetNull  -> link was silently nulled)
--
-- After this, Postgres itself refuses to hard-delete a Project that still owns
-- any of these rows. ProjectsService.checkProjectDependencies() surfaces that as
-- a typed ConflictException BEFORE Prisma ever raises a raw P2003, and recommends
-- archiving the Project (the canonical removal action when history exists).
--
-- Epic / Milestone / ProjectMember / ProjectClient / ProjectThirdPartyMember
-- intentionally stay Cascade — operational link/planning data, not audit history.
--
-- audit_logs has NO FK to projects (it references entities by string entityId),
-- so this migration does not touch the audit_logs immutability trigger (d6299cc).
--
-- Pure constraint swap: no new columns, no backfill, no NOT NULL transition.

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_projectId_fkey",
  ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_snapshots" DROP CONSTRAINT "project_snapshots_projectId_fkey",
  ADD CONSTRAINT "project_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents" DROP CONSTRAINT "documents_projectId_fkey",
  ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_projectId_fkey",
  ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Migration 3 — `20260525210000_obs012_deployments_table` (OBS-012)

```sql
-- OBS-012 — Deploy / release ledger
--
-- The "Deploy to Server (SSH)" workflow step was echo-only: no real deploy, and
-- nothing recorded which release was live. This table is the durable source of
-- truth for "which version was running at time T". DeploymentsService writes one
-- row per container boot in a deploy context (OnApplicationBootstrap), pinning
-- the env-injected RELEASE_SHA. audit_logs additionally gets an informational
-- RELEASE_DEPLOYED row (deployments is the
-- operational source of truth; audit_logs is the cross-reference).
--
-- No FK: deployedBy is a frozen string (operator email / 'ci'), surviving user
-- deletion — same RGPD snapshot rationale as audit_logs.actorEmail. This is an
-- infra event, NOT bound by the audit_logs immutability trigger (d6299cc).
--
-- Pure additive table creation: no column changes elsewhere, no backfill,
-- no NOT NULL transition on existing data.

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "releaseSha" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedBy" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "nodeVersion" TEXT NOT NULL,
    "dbMigrationsApplied" JSONB,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deployments_deployedAt_idx" ON "deployments"("deployedAt");

-- CreateIndex
CREATE INDEX "deployments_environment_deployedAt_idx" ON "deployments"("environment", "deployedAt");
```

### Migration 4 — `20260526120000_dat021_audit_payload_schema_version_gin_index` (DAT-021)

```sql
-- DAT-021 — AuditLog.payload: schema version column + JSONB GIN index
--
-- Three orthogonal, additive sub-deliverables (per the finding's Suggested fix):
--
--   (a) schemaVersion column. Added NOT NULL DEFAULT 1 in a single statement:
--       Postgres backfills every existing row to 1 atomically as metadata
--       (PG11+ stores the default in the catalog, no table rewrite). v1 is the
--       implicit shape of all current action codes; the Zod registry
--       (apps/api/src/audit/payload-schemas.ts) describes it.
--
--   (b) GIN index on payload using jsonb_path_ops (NOT the default jsonb_ops).
--       Justified by the read pattern: audit queries are equality / containment
--       (`payload @> '{"key":"value"}'`), not full-text. jsonb_path_ops is
--       smaller and faster for @> than jsonb_ops, at the cost of not supporting
--       key-existence (`?`) operators — which audit reads do not use.
--
--   (c) btree index on schemaVersion, to support the future v1/v2 read dispatch
--       (Prisma-tracked via @@index([schemaVersion]) → audit_logs_schemaVersion_idx).
--
-- Interaction with the OBS-002/DAT-009 immutability trigger (d6299cc):
--   ADD COLUMN and CREATE INDEX are DDL — they do NOT fire the row-level
--   BEFORE UPDATE/DELETE trigger `audit_logs_no_update_delete`, and the DEFAULT
--   backfill is a catalog operation, not per-row UPDATEs. So this migration is
--   safe to run with the trigger in place; no DISABLE needed here.
--
-- Hash-chain consequence (NOT done in this migration — done by a one-shot script):
--   computeRowHash now folds schemaVersion into the canonical concat. Backfilling
--   schemaVersion=1 therefore changes every existing row's hash input → every
--   rowHash must be recomputed. That walk runs AFTER this migration via
--   scripts/recompute-chain-on-schema-bump.ts (advisory-lock + trigger-disable
--   inside one transaction, SYSTEM_BACKFILL-bracketed). See the runbook in the
--   DAT-021 closing commit body. Until the recompute runs, freshly inserted rows
--   are self-consistent (they hash with schemaVersion); pre-existing rows verify
--   only after the recompute.

-- AlterTable: (a) schemaVersion column, atomic NOT NULL DEFAULT 1 backfill.
ALTER TABLE "audit_logs" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex: (b) JSONB GIN index for containment/equality queries.
CREATE INDEX "audit_logs_payload_gin" ON "audit_logs" USING gin ("payload" jsonb_path_ops);

-- CreateIndex: (c) btree on schemaVersion for v1/v2 read dispatch.
CREATE INDEX "audit_logs_schemaVersion_idx" ON "audit_logs"("schemaVersion");
```

---

## Post-deploy verification (sourced from PROGRESS_LOG.md, 2026-05-26)

This section enumerates **only what is recorded in the PROGRESS_LOG** for the 2026-05-26 window
and is verifiable post-hoc on prod. It is not a checklist of what *should* have been verified
under a Phase-1/3-style runbook — it is the actual evidentiary trail.

### V1 — `init-roles.sql` applied (TOOL-DEPLOY-001 operator runbook, `8c37e1d`)

The privilege-layer second control on `audit_logs` was provisioned in the same operational
window as this deploy. Per PROGRESS_LOG (2026-05-26 — TOOL-DEPLOY-001 entry, lines 750–770):

> "Operational scripts — fail-fast (option ii): normalize-action-codes + recompute-chain-on-
> schema-bump `process.exit(1)` if `DATABASE_MIGRATION_URL` unset, and set `DATABASE_URL =
> DATABASE_MIGRATION_URL` BEFORE NestFactory (PrismaService binds at construction → owner role).
> No silent fallback to the restricted role."

> "init-roles.sql: creates `app_user` (idempotent — `\gexec` guard + `ALTER ROLE` password
> re-assert, also a rotation tool), GRANT full CRUD on all tables + sequences, `REVOKE UPDATE,
> DELETE, TRUNCATE ON audit_logs` (INSERT+SELECT remain), `ALTER DEFAULT PRIVILEGES` so future
> migration tables stay accessible."

Post-condition on prod (verifiable now):

- `app_user` role exists.
- `app_user` has `INSERT, SELECT` on `audit_logs` but **NOT** `UPDATE, DELETE, TRUNCATE`
  (SQLSTATE 42501 on attempt).
- Schema owner (`orchestr_a`, the migration role) retains full privileges, required to OWN
  `audit_logs` and to `DISABLE`/`ENABLE` its immutability trigger during controlled
  maintenance.
- Runtime app connects with `DATABASE_URL=app_user`; migration / maintenance scripts use
  `DATABASE_MIGRATION_URL=owner` (the post-DAT-021 datasource shape — `url` + `directUrl`).

**Gap:** the exact moment `init-roles.sql` was first run on prod was not recorded, only that it
was bundled into the 2026-05-26 operator session.

### V2 — `normalize-action-codes` script run (AUD-READ-001 operator runbook, `5f87026`)

Per PROGRESS_LOG 2026-05-26 — AUD-READ-001 entry (lines 632–653), this TS one-shot script
opens an interactive `$transaction`, advisory-locks the chain, finds the first affected row
(`PASSWORD_RESET_ADMIN` → `PASSWORD_RESET_BY_ADMIN`), `DISABLE`s the immutability trigger,
`UPDATE`s the affected action codes, recomputes the hash chain forward from the first
affected row via the **imported** `computeRowHash`, re-`ENABLE`s the trigger, and emits
`SYSTEM_BACKFILL` start/complete rows with operator identity + `payload.fromValue`/`toValue`/
`affectedCount`.

Post-condition on prod (verifiable now):

- `SELECT COUNT(*) FROM audit_logs WHERE action = 'PASSWORD_RESET_ADMIN';` → **0** (canonical
  legacy code fully migrated; PROGRESS_LOG 2026-05-28 entry "0 SYSTEM_BACKFILL" Gate-5 smoke
  confirms this on prod post Phase 3).
- At least two `SYSTEM_BACKFILL` rows exist with `payload.fromValue='PASSWORD_RESET_ADMIN'`
  and `payload.toValue='PASSWORD_RESET_BY_ADMIN'` (start + complete bracket). If `affectedCount`
  was zero (prod had no legacy rows), the start/complete pair would still have been emitted
  as a documented no-op trail.

**Gap:** the exact `affectedCount` on prod was not recorded contemporaneously. The 2026-05-28
Phase 3 Gate-5 smoke shows the *post-recompute* steady state ("0 SYSTEM_BACKFILL" appearing in
that gate refers to a different check — the absence of stale SYSTEM_BACKFILL pairs in flight,
not the absence of completed ones).

### V3 — `recompute-chain-on-schema-bump` script run (DAT-021 operator runbook, `33f7a9c`)

Per PROGRESS_LOG 2026-05-26 — DAT-021 entry (lines 655–683), this TS one-shot script anchors
at genesis (the entire chain) — not at a first-affected row like AUD-READ-001 — because
`computeRowHash` now folds `schemaVersion` into the canonical concat, changing every row's
hash input. Same transactional/lock/SYSTEM_BACKFILL discipline. Idempotent.

Post-condition on prod (verifiable now):

- Every `audit_logs.rowHash` matches a JS recomputation that includes `schemaVersion`.
- The chain verifies end-to-end (no prevHash gap).
- A `SYSTEM_BACKFILL` start/complete pair exists with `payload` referencing the schemaVersion
  bump (e.g. `payload.reason='schemaVersion=1 added to hash input'` or equivalent — the exact
  payload shape follows the helper in `audit/recompute-chain.ts`).

**Gap:** as with V2, the exact pre-existing audit_logs row count on prod at recompute time
was not recorded. The recompute helper was extracted to `audit/recompute-chain.ts` and shared
by both V2 and V3 — so a future verifier replays one canonical implementation, not two
independent ones.

### V4 — Service boot post-deploy (OBS-012's `OnApplicationBootstrap`)

OBS-012 (`189344f`) wired `DeploymentsService` to write one row to the new `deployments` table
per container boot, **only when** `NODE_ENV=production` OR `RELEASE_SHA` is set, and a second
informational `audit_logs` row (`AuditAction.RELEASE_DEPLOYED`) per boot for cross-reference.

Post-condition on prod (verifiable now):

- `SELECT COUNT(*) FROM deployments;` ≥ 1, with at least one row whose `deployedAt` falls in
  the 2026-05-26 window (the first boot after this batch landed). The 2026-05-28 Phase 3
  deploy will have added more rows.
- A matching `audit_logs.action='RELEASE_DEPLOYED'` row exists for each `deployments` row,
  with `entityType='Deployment'`.

**Gap:** the precise `releaseSha` value written for the first 2026-05-26 boot was not
captured in the PROGRESS_LOG. If the operator's `deploy-prod.sh` (introduced in OBS-012)
was used, `RELEASE_SHA` should be the prod git HEAD at that moment; if the boot happened
without `RELEASE_SHA` set, the row would carry `releaseSha='unknown'` (the documented
degraded-mode value). Cur-rent prod state can disambiguate.

### V5 — Implicit (no captured smoke beyond V1–V4)

- No frontend smoke checklist was recorded for this batch (no "operator UI sanity" pass like
  Phase 1's Gate 2, no JWT-driven backend smoke matrix like Phase 1's Phase 4.5).
- The PROGRESS_LOG of 2026-05-26 closes with "operator runbook executions still pending"
  for AUD-READ-001 prod normalize + DAT-021 prod migrate+recompute (see e.g. line 727, 748,
  770). The runbooks were then executed at some point on 2026-05-26 — the durable evidence
  for that is the post-hoc state (V2 + V3 post-conditions above), not a separate captured
  log.

**Gap:** no synchronous prod-write-then-read smoke was documented at the time. The defence-
in-depth witness ("can the runtime role mutate audit_logs?" → 42501; "can it INSERT?" → ok)
exists as integration tests (`audit-immutability.int.spec.ts`, `audit-role-revoke.int.spec.ts`)
that have shipped as repo CI gates since TOOL-DEPLOY-001 — they are not a *prod* witness, but
they pin the contract that prod must satisfy.

---

## Rollback path

> ⚠️ **Rollback was never executed for this batch and no anchor image was tagged
> (`orchestra-api:pre-phase-2-…` does not exist in `docker images`).** The DDL below is
> derived per-migration from the forward SQL and is presented for *deploy-doc completeness
> only* — to demonstrate that each migration has a theoretical reverse. Executing any of it
> retroactively, more than two days after the fact and with downstream Phase 3 migrations
> stacked on top, would be a destructive action requiring a separate runbook and explicit
> approval. **DO NOT** execute these statements without first restoring from a pre-Phase-2
> backup (none was tagged at the time — the earliest available backup is the Phase 3 pre-deploy
> dump `pre-phase3-batch-deploy-20260528-124439.sql` which is **post**-Phase-2, so a Phase 2
> rollback now would require either time-travel restore from an older backup, if one exists in
> `/opt/orchestra/backups/`, or surgical DDL reversal followed by data reconciliation).

### Rollback of Migration 1 (OBS-002 + DAT-009)

```sql
-- 1. Drop the immutability trigger and its function (reverse of step 6).
DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON "audit_logs";
DROP FUNCTION IF EXISTS audit_logs_immutable();

-- 2. Revert actorId FK NoAction → SetNull (reverse of step 5).
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actorId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Relax rowHash NOT NULL back to NULL (reverse of step 4).
ALTER TABLE "audit_logs" ALTER COLUMN "rowHash" DROP NOT NULL;

-- 4. Drop the four added columns (reverse of step 1).
--    NOTE: This destroys the backfilled hash chain + actor snapshot.
ALTER TABLE "audit_logs"
  DROP COLUMN "actorEmail",
  DROP COLUMN "actorLabel",
  DROP COLUMN "prevHash",
  DROP COLUMN "rowHash";

-- The recursive-CTE backfill (step 3) is not reversed: the columns it filled
-- are dropped above, so the backfill becomes a no-op.
```

### Rollback of Migration 2 (DAT-007)

```sql
-- Restore the prior FK semantics: tasks/project_snapshots/documents were Cascade,
-- time_entries was SetNull.

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_projectId_fkey",
  ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_snapshots" DROP CONSTRAINT "project_snapshots_projectId_fkey",
  ADD CONSTRAINT "project_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" DROP CONSTRAINT "documents_projectId_fkey",
  ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_projectId_fkey",
  ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

### Rollback of Migration 3 (OBS-012)

```sql
-- Pure additive table creation -> pure DROP TABLE reverse. Indexes drop with the table.
DROP INDEX IF EXISTS "deployments_environment_deployedAt_idx";
DROP INDEX IF EXISTS "deployments_deployedAt_idx";
DROP TABLE IF EXISTS "deployments";

-- The corresponding RELEASE_DEPLOYED rows in audit_logs cannot be removed (the OBS-002
-- immutability trigger created in Migration 1 forbids DELETE). They remain as an
-- inert historical trail of past boots. If Migration 1 was rolled back FIRST (see
-- above), then standard DELETE would work — but rolling back the immutability trigger
-- is itself a logged action.
```

### Rollback of Migration 4 (DAT-021)

```sql
-- (c) Drop the btree on schemaVersion.
DROP INDEX IF EXISTS "audit_logs_schemaVersion_idx";

-- (b) Drop the JSONB GIN index.
DROP INDEX IF EXISTS "audit_logs_payload_gin";

-- (a) Drop the schemaVersion column.
--     NOTE: This invalidates every rowHash that was recomputed by
--     scripts/recompute-chain-on-schema-bump.ts (the schemaVersion=1 input
--     is gone from computeRowHash's canonical concat) -> the hash chain
--     would then verify only against a code revert that also removes
--     schemaVersion from computeRowHash. Treat as a coordinated rollback,
--     not a standalone SQL operation.
ALTER TABLE "audit_logs" DROP COLUMN "schemaVersion";
```

### Image rollback

No `orchestra-api:pre-phase-2-…` tag was set. The nearest historical anchors are:

- `orchestra-api:pre-phase1-remediation` (`5a9f56cc`, set 2026-05-25, the *pre-Phase-1* image —
  rolling back to this would also reverse Phase 1 / DAT-005, which is **not** what a
  Phase-2-only rollback would want).
- `orchestra-api:pre-phase3-defense-in-depth` (`10c69f6fbce8`, set 2026-05-28, **after** the
  Phase 2 batch had been running for ~2 days — this is effectively a post-Phase-2 image,
  not a pre-Phase-2 one).

**Practical consequence:** there is no clean image-only Phase-2 rollback. A rollback now would
have to combine the SQL reversal above with either (a) rebuilding the API image off a
master commit that predates `d6299cc` while keeping later TOOL-DEPLOY-001 / build fixes (a
non-trivial cherry-pick), or (b) accepting an image that holds the new code paths against a
schema that has been DDL-reversed — which would error at runtime (the AuditPersistenceService
expects `rowHash`/`prevHash`/`schemaVersion` columns).

---

## Deviations from Phase 1 / Phase 3 deploy-doc structure

For audit-reader orientation: this document **intentionally omits** several sections present
in `2026-05-25-phase-1-remediation-deploy.md` and `2026-05-2x-phase-3-defense-in-depth-deploy.md`,
because they cannot be honestly reconstructed:

1. **No pre-deploy baseline** — no read-only `_prisma_migrations` / `information_schema` /
   `df -h` capture was made before this batch landed.
2. **No preflight on a throwaway DB** — Phase 1 ran the DAT-005 preflight script on a
   `pg_dump`-restored throwaway; this batch did not require an equivalent (no value-precision
   transformation), but no equivalent integrity sweep was recorded either.
3. **No Gate-by-Gate decision trail** — the deploy was operator-driven in one pass, not
   gated.
4. **No safety dump captured to a named file** — Phase 1 captured
   `orchestr_a_prod_predeploy_phase1_20260525_084554.dump`. No equivalent name exists in
   `backups-prod/` for this batch. **Gap.**
5. **No image rollback anchor** — see "Image rollback" above.
6. **No post-deploy frontend smoke checklist** — see V5 above.

These deviations are the structural reason DOC-001 was filed: the audit trail under
`docs/deploy/` requires a uniform format precisely so a reader can rely on the *presence*
of these sections, not have to read the surrounding code/PROGRESS_LOG to know what was
verified. This document closes the *existence* gap; it cannot close the *evidentiary* gap
retroactively.

---

## Process learnings (for future deploy batches)

1. **Any migration touching prod requires its own `docs/deploy/<date>-<scope>.md`** authored
   *ahead of* execution, with the Phase-1/3 structure (scope, baseline, preflight, gates,
   verification, rollback). Tooling sessions that ride migrations along are the high-risk
   class — DOC-001 was surfaced precisely because the Phase 2 batch was framed as a TOOL-
   DEPLOY-001 closeout, not as its own deploy event.
2. **Tag a rollback anchor image before every prod build** (`orchestra-api:pre-<scope>`). This
   batch's lack of one is the largest residual gap.
3. **Capture a named pg_dump before every batch.** Phase 1's
   `orchestr_a_prod_predeploy_phase1_…` is the model; Phase 3 followed it
   (`pre-phase3-batch-deploy-20260528-124439.sql`); Phase 2 did not.
4. **Probe `_prisma_migrations` at Gate 0 of every subsequent deploy** — never trust the doc's
   stated baseline. The Phase 3 deploy did this and discovered the Phase 2 batch had landed
   out-of-band, which is what surfaced DOC-001.
5. **A `Phase-1-tooling` deploy doc for TOOL-DEPLOY-001 itself (0 migrations, code+config-only,
   init-roles.sql one-shot)** could be a useful audit-trail addendum, mirroring this doc's
   structure for the role-split gesture. **Filed mentally as a candidate follow-up; not
   created in this commit per DOC-001 scope.**

---

## DEPLOY EXECUTION LOG — 2026-05-26 (UTC) — RETROACTIVE RECONSTRUCTION

| Step                                       | Status                          | Evidence                                                                         |
|--------------------------------------------|---------------------------------|----------------------------------------------------------------------------------|
| Pre-deploy baseline capture                | ❌ Not performed                 | Gap.                                                                             |
| Safety dump (named file)                   | ❌ Not captured                  | Gap.                                                                             |
| Rollback anchor image tag                  | ❌ Not set                       | Gap.                                                                             |
| `git pull` to ≥ `33f7a9c`                  | ✅ Inferred                      | Prod HEAD at 2026-05-28 Gate-0 = `3fd8986` (downstream of `8c37e1d`).            |
| `docker compose build api` (source-baked image) | ✅ Inferred                | Migrations applied imply a rebuilt image carrying the new audit-persistence code.|
| `migrate deploy` of 4 migrations           | ✅ **Verified post-hoc**         | `_prisma_migrations` cluster at 2026-05-26 ~21:09 UTC.                           |
| `init-roles.sql` one-shot (TOOL-DEPLOY-001) | ✅ Inferred (same window)        | PROGRESS_LOG 2026-05-26 — TOOL-DEPLOY-001 closeout.                              |
| `audit:normalize-action-codes` (AUD-READ-001) | ✅ Inferred                   | PROGRESS_LOG runbook + post-hoc 0 `PASSWORD_RESET_ADMIN` rows on prod.           |
| `audit:recompute-chain-on-schema-bump` (DAT-021) | ✅ Inferred                | PROGRESS_LOG runbook + Phase 3 Gate-5 "chain valid" smoke on 2026-05-28.         |
| `docker compose up -d api`                 | ✅ Inferred                      | Service healthy on 2026-05-28 pre-Phase-3 (Phase 3 doc Gate-0).                  |
| First boot writes `deployments` row + RELEASE_DEPLOYED audit row | ⚠ Conditional      | Depends on whether `RELEASE_SHA` was set in `.env.production` at the time.       |
| Post-deploy smoke (UI / API matrix)        | ❌ Not performed                 | Gap.                                                                             |

**This batch is on prod, the 4 migrations are applied, and the downstream Phase 3 deploy
(2026-05-28) validated the cumulative state. The audit-trail format gap is what DOC-001
exists to close — and what this retroactive document, with all its explicit "Gap" markers,
formally records.**
