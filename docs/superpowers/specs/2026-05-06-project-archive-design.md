# Project Archive — Design Spec

**Date**: 2026-05-06
**Status**: approved (brainstorm); pending implementation plan
**Owner**: alexandre.berge@cpam92.fr

## Problem

Users need to "archive" a project so it stops cluttering general progress tracking (Reports, project list, dashboards, Gantt) but remains fully accessible — direct URL works, search finds it, members still see their tasks, and unarchiving brings it back to active state. The current model has no archive concept; the only soft-state today is `status = CANCELLED` (used as soft-delete).

Triggering incident: same user has 36 projects in scope, many of which are old or wound down, and there is no way to clean up the active view without losing access to history.

## Goals

- Manual archive/unarchive at any time, regardless of project status (including `ACTIVE`).
- Archive is curatorial — it does **not** change the project's lifecycle status.
- Archived projects are excluded from "general progress tracking" surfaces by default but remain reachable everywhere else.
- Single, consistent backend filter param across all list-style endpoints.
- Permission-scoped — driven by RBAC permissions, not hardcoded roles.
- Audit-logged — archive and unarchive write entries in the existing audit log.

## Non-goals

- Bulk archive / multi-select archive.
- Auto-archive on `COMPLETED + N days` (or any timer-based archival).
- Read-only / frozen mode for archived projects (they remain editable; if a user wants to lock further edits, they archive **and** the team agrees not to touch — process, not enforcement).
- Archive at task or milestone granularity.
- A separate `/archives` page (a toggle on `/projects` is sufficient).
- Reports/analytics dashboards focused on archived projects (out of scope; if needed later, separate spec).

## Data model

Two new nullable columns on `Project`:

```prisma
model Project {
  // ... existing fields
  archivedAt    DateTime?
  archivedById  String?
  archivedBy    User?     @relation("ProjectArchiver", fields: [archivedById], references: [id], onDelete: SetNull)
  // ... existing relations
}
```

- `archivedAt = null` → active (default).
- `archivedAt = <timestamp>` → archived; the value records when.
- `archivedById` records who performed the archive (nullable so deleting that user via `SetNull` doesn't break the project).
- The `User` model gets the inverse relation `archivedProjects Project[] @relation("ProjectArchiver")`.
- No new enum value on `ProjectStatus`. Status remains the lifecycle dimension (`DRAFT/ACTIVE/SUSPENDED/COMPLETED/CANCELLED`); archive is the orthogonal curatorial dimension.
- An index on `archivedAt` (`@@index([archivedAt])`) so the default `WHERE archivedAt IS NULL` filter stays fast on the project list.

Migration: additive, no backfill required (existing rows default to `null` = active).

## Backend behavior

### Single filter param

Introduce one query param, identical across all list-style endpoints:

```
?archived=active   (default — only non-archived)
?archived=archived (only archived)
?archived=all      (both)
```

Endpoints applying the filter (default `active`):
- `GET /projects`
- `GET /analytics` (already shipped scope-aware; archive filter layered on top)
- `GET /analytics/export`
- All `/analytics/advanced/*` endpoints (project-health, milestones-completion, recent-activity, tasks-breakdown, workload, snapshots-query)
- Any portfolio / dashboard endpoint surfacing project lists or aggregates

Endpoints **not** applying the filter (always return archived too):
- `GET /projects/:id` (direct access)
- `GET /tasks/:id`, `GET /tasks` (personal task list, search) — tasks of archived projects remain visible to assignees and members
- `GET /projects/:id/members`, `GET /projects/:id/documents`, etc. (resource-scoped reads)
- Search across projects (if/when added)

The DTO accepts `archived` as an optional enum (`active | archived | all`). The service builds the corresponding `Prisma.ProjectWhereInput` fragment (`{ archivedAt: null }` / `{ archivedAt: { not: null } }` / `{}`) and AND-merges it with the existing scope filter.

### Archive / unarchive endpoints

```
POST /projects/:id/archive
  → 200 { ...project, archivedAt, archivedById, canArchive: false, canUnarchive: true }
  → 403 if user lacks projects:archive on this resource
  → 404 if project does not exist or is out of scope
  → 409 if already archived

POST /projects/:id/unarchive
  → 200 { ...project, archivedAt: null, archivedById: null, canArchive: true, canUnarchive: false }
  → 403 / 404 same as above
  → 409 if not archived
```

Both endpoints use `AccessScopeService.assertCanAccessProject` for scope, then check `projects:archive` permission. They write an audit log row (`action = "PROJECT_ARCHIVED"` / `"PROJECT_UNARCHIVED"`, `entityType = "Project"`, `entityId`, `userId`).

### Permission

New permission: `projects:archive`.

- Bound to the same role templates that already hold `projects:edit` (project managers on their projects, ADMIN globally).
- Resolved compile-time via `ROLE_TEMPLATES[templateKey]` (V4 RBAC pattern — no DB `role_permissions` row).
- Per-resource enforcement: a user can archive a project only if they can `edit` it (i.e., they are the manager, sponsor, creator, or have `projects:manage_any`).

### Computed flags

The project response DTO gains two new computed booleans, set by the service:
- `canArchive: boolean` — true if user has `projects:archive` and the project is currently active.
- `canUnarchive: boolean` — true if user has `projects:archive` and the project is archived.

(Per project memory rule: API computes auth, frontend never recomputes.)

### Audit

Audit entries on archive and unarchive use the existing audit log infrastructure. Payload includes `previousStatus` (for unarchive — null since status is unchanged, but record the timestamp delta for historical clarity).

## Frontend behavior

### Project list (`/projects`)

- Toolbar gains a "Afficher les projets archivés" toggle (default **off**).
  - Off → query param `archived=active`.
  - On → query param `archived=all`. (Rationale: when the user opts in, they typically want to see both their active and archived projects in one list, not lose the active ones.)
- Archived rows render with reduced opacity and an "Archivée" badge next to the project name.
- The action menu per row gains "Archiver" (when `canArchive`) or "Désarchiver" (when `canUnarchive`). Confirmation dialog with single sentence — "Archiver « <name> » ? Le projet n'apparaîtra plus dans le suivi général mais restera accessible."

### Project detail page (`/projects/[id]`)

- When `archivedAt != null`, render a banner at the top of the page:
  - "Ce projet est archivé depuis le DD/MM/YYYY par <Prénom Nom>. [Désarchiver]"
  - The "Désarchiver" button is only shown if `canUnarchive`.
- All other sections (tasks, milestones, time entries, members, documents) continue to work normally — full read/write access subject to existing permissions. Archive does not freeze the project.

### Reports, Gantt, dashboards

- No UI change. These surfaces consume the analytics endpoints, which now exclude archived by default. No "include archived" toggle on these views (out of scope).

### Personal task list / "My tasks"

- No change. Tasks of archived projects continue to appear for their assignees. The Project link in the task row still works (lands on the project detail page with its archive banner).

### Search & navigation

- Archive does not remove the project from search or navigation breadcrumbs. (Search isn't currently in scope of this app's main flows; this clause is forward-looking.)

## Migration & rollout

1. Prisma migration adding `archivedAt`, `archivedById`, the relation, and the index. Additive — no data backfill needed.
2. Backend: DTO update, filter param, two endpoints, computed flags, audit hooks.
3. Permission seeding: add `projects:archive` to relevant role templates (per V4 compile-time pattern).
4. Frontend: toggle on `/projects`, action menu items, banner on detail page.
5. E2E tests:
   - Archive a project → it disappears from `/projects` (default), reappears with toggle on, accessible by direct URL.
   - Archive a project → excluded from `/reports` analytics for all role projects.
   - Unarchive → returns to active list.
   - Archive permission gating per role (ADMIN, RESPONSABLE, MANAGER, REFERENT_TECHNIQUE, CONTRIBUTEUR, OBSERVATEUR).
6. Deploy: API + Web + Prisma migrate (`pnpm prisma migrate deploy`) on the VPS using the documented `--env-file .env.production` pattern.

## Open questions

None at this point. Three originally raised, all confirmed:
- `archivedAt` timestamp orthogonal to status (not a new enum value): **yes**.
- Toggle on `/projects` list, no dedicated `/archives` page: **yes**.
- Archive allowed on any status, including ACTIVE: **yes**.
