-- DAT-014 — eliminate the leaves.type / leaveTypeId dual source of truth.
--
-- The Leave model carries TWO descriptors of a leave's type: the legacy enum
-- column `type "LeaveType"` ('Gardé pour rétrocompatibilité') and the FK
-- `leave_type_id → leave_type_configs(id)`. The audit's failure mode: code that
-- reads `type` instead of `leaveType.code` sees stale values when an admin
-- renames/recreates a type, because the two are written independently.
--
-- Path decision (see DAT-014 Learnings). The audit's primary fix — DROP the
-- column — is BLOCKED here: `leave.type` is still consumed by active frontend
-- display (apps/web .../leaves/page.tsx switch, .../users/[id]/suivi/page.tsx
-- i18n key, planning/DayCell.tsx legacy fallback) and by the findAll `?type=`
-- API filter. Dropping the column would null those out, so this takes the
-- audit's stopgap path (Path B): a trigger that guarantees consistency.
--
-- Style: AUTO-SYNC (self-healing), not validate-and-reject. A BEFORE INSERT OR
-- UPDATE trigger derives `NEW.type` from the joined config code, making the
-- column a pure read-only mirror of the FK — which removes the dual source of
-- truth (the column is no longer an independent writeable source) without
-- physically dropping it. This is strictly more robust than a CHECK/validation
-- trigger: it cannot wrongly reject the common case where a custom config code
-- (e.g. 'CP_E2E') legitimately maps to enum 'OTHER', and it heals pre-existing
-- drift on the next write instead of erroring on it.
--
-- Enum-mapping logic mirrors leaves.service.ts exactly: the config code is
-- stored verbatim IF it is a member of the "LeaveType" enum, otherwise 'OTHER'.
-- `enum_range(NULL::"LeaveType")` is used instead of a hardcoded member list so
-- that adding a future enum member (e.g. PARENTAL) does not silently miscoerce.
--
-- Pre-flight (dev DB, 2026-05-27): 3 leave rows — 2× {type=CP, code=CP}
-- (consistent), 1× {type=NULL, code=CP_E2E} (NULL, would coerce to OTHER). The
-- one-time backfill below reconciles existing rows so the invariant holds for
-- ALL rows immediately, not only those written after deploy.
--
-- Triggers are not expressible in the Prisma 6 schema DSL, so this migration is
-- hand-authored raw SQL (same pattern as 20260527120000 / 130000 / 140000).
-- schema.prisma is intentionally unchanged: the column stays `LeaveType?`.
--
-- Known limitation (out of DAT-014 scope, noted for a future task): the trigger
-- fires on writes to `leaves`, not on writes to `leave_type_configs`. If an
-- admin changes a config's `code`, existing leave rows keep their old derived
-- type until the leave row is next written. The audit's concern is write-time
-- drift, which this closes; a config-side propagation trigger would be a
-- separate change.

CREATE OR REPLACE FUNCTION leaves_sync_type_from_config()
  RETURNS TRIGGER AS $$
DECLARE
  cfg_code TEXT;
BEGIN
  -- leave_type_id is NOT NULL and FK-constrained, so this resolves for any row
  -- that will survive the (post-BEFORE-trigger) FK check. If a bad id slips in,
  -- cfg_code is NULL → coerces to OTHER, and the FK check rejects the row anyway.
  SELECT code INTO cfg_code
  FROM leave_type_configs
  WHERE id = NEW.leave_type_id;

  NEW.type := CASE
    WHEN cfg_code = ANY (enum_range(NULL::"LeaveType")::text[])
      THEN cfg_code::"LeaveType"
    ELSE 'OTHER'::"LeaveType"
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- One-time backfill of existing rows (run before attaching the trigger so it is
-- a single explicit pass; the IS DISTINCT FROM guard touches only drifted/NULL
-- rows). Same derivation as the trigger.
UPDATE "leaves" l
SET "type" = CASE
    WHEN lt.code = ANY (enum_range(NULL::"LeaveType")::text[])
      THEN lt.code::"LeaveType"
    ELSE 'OTHER'::"LeaveType"
  END
FROM "leave_type_configs" lt
WHERE l."leave_type_id" = lt.id
  AND l."type" IS DISTINCT FROM (CASE
      WHEN lt.code = ANY (enum_range(NULL::"LeaveType")::text[])
        THEN lt.code::"LeaveType"
      ELSE 'OTHER'::"LeaveType"
    END);

CREATE TRIGGER leaves_sync_type_trg
  BEFORE INSERT OR UPDATE ON "leaves"
  FOR EACH ROW
  EXECUTE FUNCTION leaves_sync_type_from_config();
