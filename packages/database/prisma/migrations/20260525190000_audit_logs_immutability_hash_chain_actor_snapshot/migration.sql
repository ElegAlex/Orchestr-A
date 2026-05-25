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
