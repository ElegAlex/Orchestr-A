-- Wave 3 / Cluster B — uniform leave balance remediation.
--
-- Change 1: explicit audit trail for self-approval (finding #6).
--   The previous code path produced rows with status=APPROVED and
--   validatorId=NULL, leaving an auditor unable to tell self-approval
--   apart from automatic approval of a type with requiresApproval=false.
--   The new boolean column makes the distinction trivially readable from
--   a plain `SELECT * FROM leaves`.
ALTER TABLE "leaves"
  ADD COLUMN "selfApproved" BOOLEAN NOT NULL DEFAULT false;

-- Change 2: prevent duplicate global LeaveBalance rows (finding #11,
-- promoted by Wave 0). The existing unique constraint
-- "leave_balances_userId_leaveTypeId_year_key" treats NULL userId rows
-- as distinct (default Postgres NULLS DISTINCT semantics), so
-- upsertBalance can race-create two global rows for the same
-- (leaveTypeId, year). `resolveAllocatedDays` then becomes
-- non-deterministic. A partial unique index on the userId-IS-NULL slice
-- closes the gap without touching the existing index for per-user rows.
CREATE UNIQUE INDEX "leave_balances_global_unique"
  ON "leave_balances" ("leaveTypeId", "year")
  WHERE "userId" IS NULL;
