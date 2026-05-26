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
