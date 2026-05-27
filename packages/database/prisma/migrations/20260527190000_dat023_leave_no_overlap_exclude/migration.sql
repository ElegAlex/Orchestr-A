-- DAT-023 — Leave no-overlap invariant as a DB-level EXCLUDE constraint.
--
-- Nothing at the DB level prevented a single user from holding two APPROVED leaves
-- whose [startDate, endDate] ranges overlap. The service layer (leaves.service.ts
-- checkOverlap) rejects overlaps on create/update with a ConflictException, but it
-- runs against status IN (PENDING, APPROVED) at request time — a TOCTOU race
-- (two concurrent creates, or a manager declaring a leave while another approval
-- lands; see the audit Description) can slip two overlapping leaves past the
-- application check and both reach APPROVED. This EXCLUDE constraint is the DB floor
-- that closes that race independent of the application layer.
--
-- Mechanism — GiST exclusion constraint:
--   EXCLUDE USING gist ("userId" WITH =, daterange(...) WITH &&) WHERE (status = 'APPROVED')
-- rejects (SQLSTATE 23P01) any pair of rows that share the same userId AND whose
-- date ranges overlap (&&), but ONLY among rows matching the partial predicate.
--
-- Three deliberate choices, all matching the audit's literal Suggested fix and the
-- existing service semantics:
--
--   1. Partial WHERE (status = 'APPROVED'): only APPROVED leaves mutually exclude.
--      PENDING / REJECTED / CANCELLED leaves may overlap freely — only an approved
--      leave consumes the user's calendar. Because the predicate is partial, the
--      constraint also re-checks on UPDATE when a row ENTERS the predicate
--      (PENDING → APPROVED), which is exactly the audit's race path.
--
--   2. daterange(..., '[]') inclusive on BOTH bounds: a leave ending Mar 5 and a
--      leave starting Mar 5 register as an overlap (they share Mar 5). This matches
--      checkOverlap's `startDate <= endDate AND endDate >= startDate` (inclusive)
--      semantics. Same-day half-day pairs (morning + afternoon) are NOT a supported
--      feature: checkOverlap ignores the `halfDay` enum entirely and already treats
--      two same-day leaves as a conflict, so the inclusive `[]` introduces no
--      regression and needs no half-day carve-out in the WHERE clause.
--
--   3. No ::date cast: leaves."startDate" / "endDate" are already Postgres `date`
--      (Prisma `@db.Date`), so daterange(date, date, text) resolves directly.
--
-- btree_gist is required because the constraint mixes an equality operator (= on the
-- text userId) with a range overlap operator (&&) in one GiST index; stock GiST has
-- no equality opclass for scalar/text types. CREATE EXTENSION IF NOT EXISTS is
-- idempotent. NOTE: CREATE EXTENSION requires superuser (or a role with the
-- privilege). The migration/owner role is superuser on dev and in the integration
-- harness; on production the deploy doc surfaces the superuser requirement for this
-- step explicitly (run it before `migrate deploy` if the deploy role lacks it).
--
-- EXCLUDE constraints are not expressible in the Prisma 6 schema DSL, so this
-- migration is hand-authored raw SQL (same pattern as 20260527120000 dat003/004,
-- 20260527140000 dat013, 20260527170000 dat017, 20260527180000 dat018).
-- schema.prisma is intentionally unchanged.
--
-- Pre-flight (dev DB, 2026-05-27): 0 overlapping APPROVED pairs (3 leaves total),
-- so the ADD CONSTRAINT validates cleanly against existing data.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "leaves"
  ADD CONSTRAINT "leaves_no_overlap"
  EXCLUDE USING gist (
    "userId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE (status = 'APPROVED');
