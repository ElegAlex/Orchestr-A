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
