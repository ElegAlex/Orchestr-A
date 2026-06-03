-- TOOL-DBSYNC-001 — retire the DAT-005 Float→Decimal rollback safety net.
--
-- Migration 20260524100000_dat005_backup_float_columns created these backup
-- tables (CREATE TABLE … AS SELECT of the pre-conversion Float values) as a
-- rollback net. They are NOT in schema.prisma, so until a migration drops them
-- they sit in migration history but not the Prisma model — which makes
-- `prisma migrate dev` want to fold a spurious DROP into EVERY subsequent
-- migration and abort non-interactively, blocking the whole schema chain.
--
-- The Decimal conversion has been prod-stable since 2026-05-25 (>1 week, no
-- rollback). Drop the safety net so migration history, schema.prisma and the DB
-- agree. Idempotent (IF EXISTS) and contains no business data of its own.
--
-- PROD IMPACT: this runs on the next `prisma migrate deploy` and drops the prod
-- backup tables too. That is the intended (now-made) retention decision.

DROP TABLE IF EXISTS "_dat005_backup_leave_balances_total_days";
DROP TABLE IF EXISTS "_dat005_backup_leaves_days";
DROP TABLE IF EXISTS "_dat005_backup_project_snapshots_progress";
DROP TABLE IF EXISTS "_dat005_backup_tasks_estimated_hours";
DROP TABLE IF EXISTS "_dat005_backup_time_entries_hours";
