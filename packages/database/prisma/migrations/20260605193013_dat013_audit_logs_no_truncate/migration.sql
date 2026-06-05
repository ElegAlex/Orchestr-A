-- DAT-013 — the audit_logs immutability trigger (20260525190000) covered
-- UPDATE/DELETE but NOT TRUNCATE: a privileged role could `TRUNCATE audit_logs`
-- and wipe the entire append-only ledger silently. Add a statement-level
-- BEFORE TRUNCATE trigger reusing the same audit_logs_immutable() function
-- (it raises on any TG_OP, so it rejects TRUNCATE too). Statement-level is
-- required — TRUNCATE has no per-row context.
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();
