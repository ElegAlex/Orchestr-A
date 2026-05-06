# Project Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual, curatorial archive action to projects so they disappear from general progress tracking (project list / Reports / dashboards) while remaining fully accessible by direct URL, in personal task lists, and on resource-scoped views — with unarchive available at any time.

**Architecture:** Two new nullable columns on `Project` (`archivedAt`, `archivedById`) orthogonal to `ProjectStatus`. A single `?archived=active|archived|all` query param (default `active`) on every list-style endpoint. Two new endpoints `POST /projects/:id/archive` and `POST /projects/:id/unarchive` gated by a new `projects:archive` permission. Computed `canArchive`/`canUnarchive` flags returned on the project resource. Frontend gains a toggle on `/projects`, an action-menu entry per row, and an archived banner on the detail page.

**Tech Stack:** NestJS 11 (Fastify), Prisma 6 (PostgreSQL 18), Vitest, Next.js 16 (App Router) + React 19 + TanStack Query, Tailwind, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-06-project-archive-design.md`

---

## File Structure

**Created:**
- `packages/database/prisma/migrations/<timestamp>_project_archive/migration.sql` — schema migration
- `apps/api/src/projects/dto/archived-filter.dto.ts` — shared `ArchivedFilter` enum + helper builder
- `e2e/tests/projects/archive.spec.ts` — Playwright E2E covering archive/unarchive + Reports exclusion across roles

**Modified — packages/database:**
- `packages/database/prisma/schema.prisma` — add `archivedAt`, `archivedById` to `Project`; add inverse relation on `User`

**Modified — packages/rbac:**
- `packages/rbac/permissions.ts` (or wherever the permission-code list lives — discover via `grep -n '"projects:update"' packages/rbac`) — register `projects:archive`
- `packages/rbac/templates.ts` — add `projects:archive` to the same bundle that holds `projects:update`; add it to the `without(...)` exclusion lists where `projects:update` is excluded (`PROJECT_CONTRIBUTOR_LIGHT`, `FUNCTIONAL_REFERENT`)
- `packages/rbac/__tests__/templates.spec.ts` — keep entry-count assertion green (no count change), add a focused assertion that templates holding `projects:update` also hold `projects:archive`

**Modified — apps/api:**
- `apps/api/src/projects/dto/query-projects.dto.ts` — add `archived` field
- `apps/api/src/projects/projects.controller.ts` — wire `archived` query param into `findAll`; add `POST /projects/:id/archive` + `POST /projects/:id/unarchive`
- `apps/api/src/projects/projects.service.ts` — accept `archived` filter in `findAll`; implement `archive` + `unarchive`; populate `canArchive`/`canUnarchive` in response
- `apps/api/src/projects/projects.module.ts` — import `AuditModule` if not already imported (for `AuditPersistenceService`)
- `apps/api/src/projects/projects.service.spec.ts` — unit tests for filter + archive/unarchive
- `apps/api/src/projects/projects.controller.spec.ts` — controller wiring tests
- `apps/api/src/analytics/dto/analytics-query.dto.ts` — add `archived` field (default `active`)
- `apps/api/src/analytics/analytics.service.ts` — propagate `archived` into project/task scope filter
- `apps/api/src/analytics/analytics.service.spec.ts` — assert default excludes archived; `all` includes both
- `apps/api/src/analytics/advanced/services/project-health.service.ts` — apply archived filter
- `apps/api/src/analytics/advanced/services/milestones-completion.service.ts` — apply archived filter
- `apps/api/src/analytics/advanced/services/recent-activity.service.ts` — apply archived filter
- `apps/api/src/analytics/advanced/services/tasks-breakdown.service.ts` — apply archived filter
- `apps/api/src/analytics/advanced/services/workload.service.ts` — apply archived filter
- `apps/api/src/analytics/advanced/services/snapshots-query.service.ts` — apply archived filter
- (corresponding `*.spec.ts` files for each advanced service — assert default excludes archived)

**Modified — apps/web:**
- `apps/web/app/[locale]/projects/page.tsx` — toggle, archive/unarchive menu item, badge & dimming
- `apps/web/app/[locale]/projects/[id]/page.tsx` (or wherever detail lives — confirm path) — archived banner + Désarchiver button
- `apps/web/src/services/projects.service.ts` (or equivalent — confirm) — add `archive(id)`, `unarchive(id)`, accept `archived` query param in list call
- `apps/web/src/types/project.ts` (or wherever the `Project` type is defined — confirm) — add `archivedAt`, `archivedById`, `canArchive`, `canUnarchive`

> **Confirmation needed during execution** for the three frontend paths marked "confirm" — search before editing, e.g. `find apps/web/src -name 'projects*.ts' -o -name 'project.ts'`.

---

## Task 1: Schema migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_project_archive/migration.sql` (generated)

- [ ] **Step 1: Edit `schema.prisma`**

In the `model Project { ... }` block, add the two new fields right after `updatedAt`:

```prisma
  updatedAt       DateTime      @updatedAt
  archivedAt      DateTime?
  archivedById    String?
```

In the `// Relations` section of `Project`, after `sponsor`, add:

```prisma
  archivedBy        User?                     @relation("ProjectArchiver", fields: [archivedById], references: [id], onDelete: SetNull)
```

At the end of the `Project` block, before `@@map("projects")`, add the index:

```prisma
  @@index([archivedAt])
  @@map("projects")
```

In the `model User { ... }` block, find the existing project relations (e.g. `managedProjects`, `sponsoredProjects`, `createdProjects`) and add:

```prisma
  archivedProjects                  Project[]                     @relation("ProjectArchiver")
```

- [ ] **Step 2: Generate migration**

Run from repo root:
```bash
pnpm exec prisma migrate dev --schema=packages/database/prisma/schema.prisma --name project_archive
```

Expected: a new folder `packages/database/prisma/migrations/<timestamp>_project_archive/` with `migration.sql` containing `ALTER TABLE "projects" ADD COLUMN "archivedAt" TIMESTAMP(3)`, `ADD COLUMN "archivedById" TEXT`, the FK on `archivedById`, and `CREATE INDEX "projects_archivedAt_idx"`. No data backfill.

- [ ] **Step 3: Verify Prisma client compiles**

Run:
```bash
pnpm --filter database exec prisma generate
pnpm --filter api exec tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "Add archivedAt/archivedById to Project"
```

---

## Task 2: New `projects:archive` permission in RBAC templates

**Files:**
- Modify: `packages/rbac/permissions.ts` (or the file that exports the master permission list — discover with `grep -rn '"projects:update"' packages/rbac --include='*.ts' | head -5`)
- Modify: `packages/rbac/templates.ts`
- Modify: `packages/rbac/__tests__/templates.spec.ts`

- [ ] **Step 1: Register the permission code**

Find the permission catalog (the single array/Record listing all permission strings). Add `"projects:archive"` next to `"projects:update"` and `"projects:delete"`.

- [ ] **Step 2: Write a failing test in `templates.spec.ts`**

Append to `packages/rbac/__tests__/templates.spec.ts`:

```typescript
describe("projects:archive coupling with projects:update", () => {
  it("every template that grants projects:update also grants projects:archive", () => {
    for (const [key, tpl] of Object.entries(ROLE_TEMPLATES)) {
      if (tpl.permissions.includes("projects:update")) {
        expect(tpl.permissions).toContain("projects:archive");
      }
    }
  });

  it("templates without projects:update do not grant projects:archive", () => {
    for (const [key, tpl] of Object.entries(ROLE_TEMPLATES)) {
      if (!tpl.permissions.includes("projects:update")) {
        expect(tpl.permissions).not.toContain("projects:archive");
      }
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter rbac exec vitest run __tests__/templates.spec.ts
```
Expected: FAIL — both new assertions report missing `projects:archive`.

- [ ] **Step 4: Add `projects:archive` to the bundle holding `projects:update`**

Open `packages/rbac/templates.ts`. Locate the bundle constant that contains `"projects:update"` (search with `grep -n '"projects:update"' packages/rbac/templates.ts`). Add `"projects:archive"` immediately after `"projects:update"` in every such bundle.

Then locate the two `without(DRAFT_PROJECT_CONTRIB(), [...])` calls for `PROJECT_CONTRIBUTOR_LIGHT` (around line 555) and `FUNCTIONAL_REFERENT` (around line 576). In each, add `"projects:archive"` to the exclusion list right after `"projects:update"`.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --filter rbac exec vitest run __tests__/templates.spec.ts
```
Expected: PASS — full test file green.

- [ ] **Step 6: Commit**

```bash
git add packages/rbac
git commit -m "Add projects:archive permission to templates"
```

---

## Task 3: Backend — shared `ArchivedFilter` DTO helper

**Files:**
- Create: `apps/api/src/projects/dto/archived-filter.dto.ts`

- [ ] **Step 1: Write the DTO + helper**

Create `apps/api/src/projects/dto/archived-filter.dto.ts`:

```typescript
import { Prisma } from 'database';
import { IsEnum, IsOptional } from 'class-validator';

export enum ArchivedFilter {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  ALL = 'all',
}

export class ArchivedFilterDto {
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
}

export function archivedWhere(
  filter: ArchivedFilter = ArchivedFilter.ACTIVE,
): Prisma.ProjectWhereInput {
  switch (filter) {
    case ArchivedFilter.ARCHIVED:
      return { archivedAt: { not: null } };
    case ArchivedFilter.ALL:
      return {};
    case ArchivedFilter.ACTIVE:
    default:
      return { archivedAt: null };
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
pnpm --filter api exec tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/projects/dto/archived-filter.dto.ts
git commit -m "Add ArchivedFilter DTO and archivedWhere helper"
```

---

## Task 4: Backend — extend `findAll` with archived filter

**Files:**
- Modify: `apps/api/src/projects/dto/query-projects.dto.ts`
- Modify: `apps/api/src/projects/projects.controller.ts`
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.service.spec.ts`

- [ ] **Step 1: Write a failing service test**

Add to `apps/api/src/projects/projects.service.spec.ts` inside the `findAll` describe block:

```typescript
import { ArchivedFilter } from './dto/archived-filter.dto';

it('default findAll excludes archived projects (archivedAt: null)', async () => {
  await service.findAll(1, 10);
  const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
    where: Record<string, unknown>;
  };
  // Either at top level or inside an AND clause; assert presence by stringify
  expect(JSON.stringify(callArgs.where)).toContain('"archivedAt":null');
});

it('archived=archived returns only archived projects', async () => {
  await service.findAll(1, 10, undefined, undefined, undefined, undefined, ArchivedFilter.ARCHIVED);
  const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
    where: Record<string, unknown>;
  };
  expect(JSON.stringify(callArgs.where)).toContain('"archivedAt":{"not":null}');
});

it('archived=all does not filter on archivedAt', async () => {
  await service.findAll(1, 10, undefined, undefined, undefined, undefined, ArchivedFilter.ALL);
  const callArgs = mockPrismaService.project.findMany.mock.calls[0][0] as {
    where: Record<string, unknown>;
  };
  expect(JSON.stringify(callArgs.where)).not.toContain('archivedAt');
});
```

> The trailing positional `ArchivedFilter` argument is the new `archived` parameter you're about to add to `findAll`. Match its position to your final signature.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm exec vitest run src/projects/projects.service.spec.ts -t "findAll"
```
Expected: FAIL — `archived` argument unknown / `archivedAt` not present.

- [ ] **Step 3: Add `archived` to `query-projects.dto.ts`**

In `apps/api/src/projects/dto/query-projects.dto.ts`:

```typescript
import { ArchivedFilter } from './archived-filter.dto';
import { IsEnum, IsOptional } from 'class-validator';

// inside the existing class:
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
```

- [ ] **Step 4: Wire the param through the controller**

In `apps/api/src/projects/projects.controller.ts`, extend the `findAll` signature:

```typescript
import { ArchivedFilter } from './dto/archived-filter.dto';

@ApiQuery({ name: 'archived', required: false, enum: ArchivedFilter })
findAll(
  @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  @Query('status') status?: ProjectStatus,
  @CurrentUser('id') userId?: string,
  @CurrentUserRoleCode() userRole?: string | null,
  @Query('clients') clients?: string,
  @Query('archived') archived?: ArchivedFilter,
) {
  return this.projectsService.findAll(
    page,
    limit,
    status,
    userId,
    userRole ?? undefined,
    clients,
    archived,
  );
}
```

- [ ] **Step 5: Apply the filter in the service**

In `apps/api/src/projects/projects.service.ts`, locate `findAll` and:

1. Import the helper at the top of the file:
```typescript
import { ArchivedFilter, archivedWhere } from './dto/archived-filter.dto';
```

2. Add `archived` as the last parameter and AND-merge `archivedWhere(archived)` into the existing `where` clause. Example shape:

```typescript
async findAll(
  page = 1,
  limit = 10,
  status?: ProjectStatus,
  userId?: string,
  userRole?: string,
  clients?: string,
  archived: ArchivedFilter = ArchivedFilter.ACTIVE,
) {
  const where: Prisma.ProjectWhereInput = {
    ...existingClauses,
    AND: [...(existingAnd ?? []), archivedWhere(archived)],
  };
  // ... rest unchanged
}
```

> If the existing `where` already uses `AND`, append; if not, introduce one. Don't break existing scope/status/clients filtering — read the current implementation first and merge minimally.

- [ ] **Step 6: Run tests**

```bash
cd apps/api && pnpm exec vitest run src/projects/projects.service.spec.ts
```
Expected: PASS — all `findAll` tests green, including the three new ones.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/projects
git commit -m "Filter /projects list by archived state"
```

---

## Task 5: Backend — `archive` and `unarchive` endpoints

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.controller.ts`
- Modify: `apps/api/src/projects/projects.module.ts`
- Modify: `apps/api/src/projects/projects.service.spec.ts`
- Modify: `apps/api/src/projects/projects.controller.spec.ts`

- [ ] **Step 1: Write failing service tests**

Add to `apps/api/src/projects/projects.service.spec.ts`:

```typescript
describe('archive / unarchive', () => {
  const userCtx = { id: 'user-1', role: 'ADMIN' };

  beforeEach(() => {
    mockPrismaService.project.findUnique.mockResolvedValue({
      ...mockProject,
      archivedAt: null,
    });
    mockPrismaService.project.update.mockImplementation(async ({ data }) => ({
      ...mockProject,
      ...data,
    }));
    mockPrismaService.auditLog = { create: vi.fn() };
  });

  it('archives a project: sets archivedAt + archivedById and writes audit log', async () => {
    const result = await service.archive('project-1', userCtx);
    expect(mockPrismaService.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        archivedAt: expect.any(Date),
        archivedById: 'user-1',
      }),
    });
    expect(result.archivedAt).toBeDefined();
  });

  it('refuses to archive an already-archived project (409)', async () => {
    mockPrismaService.project.findUnique.mockResolvedValue({
      ...mockProject,
      archivedAt: new Date(),
    });
    await expect(service.archive('project-1', userCtx)).rejects.toThrow(
      /déjà archivé|already archived/i,
    );
  });

  it('unarchives a project: clears both fields', async () => {
    mockPrismaService.project.findUnique.mockResolvedValue({
      ...mockProject,
      archivedAt: new Date(),
      archivedById: 'user-1',
    });
    await service.unarchive('project-1', userCtx);
    expect(mockPrismaService.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { archivedAt: null, archivedById: null },
    });
  });

  it('refuses to unarchive a non-archived project (409)', async () => {
    await expect(service.unarchive('project-1', userCtx)).rejects.toThrow(
      /n'est pas archivé|not archived/i,
    );
  });

  it('refuses archive when project not found (404)', async () => {
    mockPrismaService.project.findUnique.mockResolvedValue(null);
    await expect(service.archive('missing', userCtx)).rejects.toThrow(
      /introuvable|not found/i,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec vitest run src/projects/projects.service.spec.ts -t "archive"
```
Expected: FAIL — `service.archive`/`service.unarchive` not defined.

- [ ] **Step 3: Implement `archive` and `unarchive` in the service**

In `apps/api/src/projects/projects.service.ts`, add the two methods (place near `remove`):

```typescript
import { ConflictException } from '@nestjs/common';
import { AuditPersistenceService } from '../audit/audit-persistence.service';

// in the constructor:
//   private readonly auditPersistence: AuditPersistenceService,

async archive(id: string, user: { id: string; role?: string | null }) {
  // Scope/ownership check (same as remove/update)
  await this.assertProjectOwnershipOrBypass(id, user);

  const project = await this.prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new NotFoundException('Projet introuvable');
  }
  if (project.archivedAt) {
    throw new ConflictException('Projet déjà archivé');
  }

  const updated = await this.prisma.project.update({
    where: { id },
    data: { archivedAt: new Date(), archivedById: user.id },
  });

  await this.auditPersistence.log({
    action: 'PROJECT_ARCHIVED',
    entityType: 'Project',
    entityId: id,
    actorId: user.id,
    payload: { archivedAt: updated.archivedAt },
  });

  return updated;
}

async unarchive(id: string, user: { id: string; role?: string | null }) {
  await this.assertProjectOwnershipOrBypass(id, user);

  const project = await this.prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new NotFoundException('Projet introuvable');
  }
  if (!project.archivedAt) {
    throw new ConflictException("Projet n'est pas archivé");
  }

  const updated = await this.prisma.project.update({
    where: { id },
    data: { archivedAt: null, archivedById: null },
  });

  await this.auditPersistence.log({
    action: 'PROJECT_UNARCHIVED',
    entityType: 'Project',
    entityId: id,
    actorId: user.id,
    payload: { previousArchivedAt: project.archivedAt },
  });

  return updated;
}
```

- [ ] **Step 4: Wire the constructor injection in service + module**

In `projects.service.ts` constructor, add `private readonly auditPersistence: AuditPersistenceService`.

In `apps/api/src/projects/projects.module.ts`, ensure `AuditModule` is imported. If it isn't:

```typescript
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule, /* ... existing imports */],
  // ...
})
```

- [ ] **Step 5: Add the controller endpoints**

In `apps/api/src/projects/projects.controller.ts`, after the existing `Delete(':id/hard')` block:

```typescript
@Post(':id/archive')
@RequirePermissions('projects:archive')
@OwnershipCheck({ resource: 'project', bypassPermission: 'projects:manage_any' })
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Archiver un projet (le retire du suivi général, reste accessible)' })
@ApiResponse({ status: 200, description: 'Projet archivé' })
@ApiResponse({ status: 404, description: 'Projet introuvable' })
@ApiResponse({ status: 409, description: 'Projet déjà archivé' })
archive(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.projectsService.archive(id, {
    id: user.id,
    role: user.role?.code ?? null,
  });
}

@Post(':id/unarchive')
@RequirePermissions('projects:archive')
@OwnershipCheck({ resource: 'project', bypassPermission: 'projects:manage_any' })
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Désarchiver un projet' })
@ApiResponse({ status: 200, description: 'Projet désarchivé' })
@ApiResponse({ status: 404, description: 'Projet introuvable' })
@ApiResponse({ status: 409, description: "Projet n'est pas archivé" })
unarchive(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.projectsService.unarchive(id, {
    id: user.id,
    role: user.role?.code ?? null,
  });
}
```

- [ ] **Step 6: Run service + controller tests**

```bash
cd apps/api && pnpm exec vitest run src/projects
```
Expected: PASS — all green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/projects
git commit -m "Add /projects/:id/archive and unarchive endpoints"
```

---

## Task 6: Backend — `canArchive` / `canUnarchive` computed flags

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts`
- Modify: `apps/api/src/projects/projects.service.spec.ts`

- [ ] **Step 1: Write a failing test in `projects.service.spec.ts`**

```typescript
describe('computed canArchive / canUnarchive', () => {
  it('returns canArchive=true and canUnarchive=false on an active project for a manager', async () => {
    mockPrismaService.project.findUnique.mockResolvedValue({
      ...mockProject,
      archivedAt: null,
    });
    // assume mockPermissionsService grants projects:archive
    const result = await service.findOne('project-1', { id: 'user-1', role: 'MANAGER' });
    expect(result.canArchive).toBe(true);
    expect(result.canUnarchive).toBe(false);
  });

  it('returns canArchive=false and canUnarchive=true on an archived project', async () => {
    mockPrismaService.project.findUnique.mockResolvedValue({
      ...mockProject,
      archivedAt: new Date(),
    });
    const result = await service.findOne('project-1', { id: 'user-1', role: 'MANAGER' });
    expect(result.canArchive).toBe(false);
    expect(result.canUnarchive).toBe(true);
  });

  it('returns both flags false when user lacks projects:archive', async () => {
    mockPrismaService.project.findUnique.mockResolvedValue({
      ...mockProject,
      archivedAt: null,
    });
    const result = await service.findOne('project-1', { id: 'user-1', role: 'OBSERVER' });
    expect(result.canArchive).toBe(false);
    expect(result.canUnarchive).toBe(false);
  });
});
```

> Adapt the role codes used here to whatever names the existing `permissionsService` mock recognises in this spec file (`grep -n 'mockPermissionsService\|projects:update' apps/api/src/projects/projects.service.spec.ts`).

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm exec vitest run src/projects/projects.service.spec.ts -t "computed canArchive"
```
Expected: FAIL — properties absent on result.

- [ ] **Step 3: Compute the flags in `findOne` (and `findAll`)**

In `apps/api/src/projects/projects.service.ts`, in `findOne`, before returning, compute:

```typescript
const hasArchivePerm = await this.permissionsService
  .getPermissionsForRole(user?.role ?? null)
  .then((perms) => perms.includes('projects:archive'));

const canArchive = hasArchivePerm && project.archivedAt == null;
const canUnarchive = hasArchivePerm && project.archivedAt != null;

return { ...project, canArchive, canUnarchive };
```

Apply the same enrichment in `findAll` for each row in the response page (resolve `hasArchivePerm` once outside the map).

- [ ] **Step 4: Run tests**

```bash
cd apps/api && pnpm exec vitest run src/projects/projects.service.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/projects.service.ts apps/api/src/projects/projects.service.spec.ts
git commit -m "Return canArchive/canUnarchive computed flags"
```

---

## Task 7: Analytics — exclude archived from `/analytics`

**Files:**
- Modify: `apps/api/src/analytics/dto/analytics-query.dto.ts`
- Modify: `apps/api/src/analytics/analytics.service.ts`
- Modify: `apps/api/src/analytics/analytics.service.spec.ts`

- [ ] **Step 1: Write a failing test**

Add to `apps/api/src/analytics/analytics.service.spec.ts`:

```typescript
import { ArchivedFilter } from '../projects/dto/archived-filter.dto';

it('default analytics excludes archived projects (archivedAt: null on project where)', async () => {
  mockPrismaService.project.findMany.mockResolvedValue([]);
  mockPrismaService.task.findMany.mockResolvedValue([]);
  mockPrismaService.user.findMany.mockResolvedValue([]);
  mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

  await service.getAnalytics({});

  const projectWhere = (mockPrismaService.project.findMany.mock.calls[0][0] as {
    where: Record<string, unknown>;
  }).where;
  expect(JSON.stringify(projectWhere)).toContain('"archivedAt":null');
});

it('archived=all does NOT filter on archivedAt', async () => {
  mockPrismaService.project.findMany.mockResolvedValue([]);
  mockPrismaService.task.findMany.mockResolvedValue([]);
  mockPrismaService.user.findMany.mockResolvedValue([]);
  mockPrismaService.timeEntry.groupBy.mockResolvedValue([]);

  await service.getAnalytics({ archived: ArchivedFilter.ALL });

  const projectWhere = (mockPrismaService.project.findMany.mock.calls[0][0] as {
    where: Record<string, unknown>;
  }).where;
  expect(JSON.stringify(projectWhere)).not.toContain('archivedAt');
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm exec vitest run src/analytics/analytics.service.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Add `archived` to the DTO**

In `apps/api/src/analytics/dto/analytics-query.dto.ts`:

```typescript
import { ArchivedFilter } from '../../projects/dto/archived-filter.dto';
import { IsEnum, IsOptional } from 'class-validator';

// inside the existing class:
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
```

- [ ] **Step 4: Apply the filter in the service**

In `apps/api/src/analytics/analytics.service.ts`:

```typescript
import { ArchivedFilter, archivedWhere } from '../projects/dto/archived-filter.dto';
```

In `getAnalytics`, after computing `projectScope`, build the merged where:

```typescript
const archivedClause = archivedWhere(query.archived ?? ArchivedFilter.ACTIVE);
const projectWhere: Prisma.ProjectWhereInput = {
  AND: [projectScope, archivedClause],
};
```

Pass `projectWhere` (not `projectScope`) into `getProjects`, `getTasks`, and `getActiveUsers`. Update those private methods' parameter to accept the merged `Prisma.ProjectWhereInput`. The task query becomes `{ project: projectWhere }`.

- [ ] **Step 5: Run tests**

```bash
cd apps/api && pnpm exec vitest run src/analytics
```
Expected: PASS — all 108+ analytics tests green, including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/analytics
git commit -m "Exclude archived projects from /analytics by default"
```

---

## Task 8: Analytics advanced — exclude archived everywhere else

**Files (one per service):**
- Modify each `apps/api/src/analytics/advanced/services/<name>.service.ts` and its spec

For **each** of: `project-health`, `milestones-completion`, `recent-activity`, `tasks-breakdown`, `workload`, `snapshots-query`:

- [ ] **Step 1: Write a failing spec**

In the corresponding `*.service.spec.ts`, add (adapt to the service's mock shape):

```typescript
import { ArchivedFilter } from '../../../projects/dto/archived-filter.dto';

it('default excludes archived projects', async () => {
  // arrange existing mocks
  await service.<entryMethod>(/* default args */);
  // grab the where used on the project-bound query (project.findMany or { project: ... })
  const stringified = JSON.stringify(/* mock.calls capture */);
  expect(stringified).toContain('"archivedAt":null');
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/api && pnpm exec vitest run src/analytics/advanced/services/<name>.service.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Apply the filter**

In each service, AND-merge `archivedWhere(query.archived ?? ArchivedFilter.ACTIVE)` into the existing project where (or `task.where.project`). Pull `archived` from the controller-passed query DTO (extend the DTO if it doesn't already accept it; reuse `ArchivedFilter`).

If the controller endpoint has no DTO accepting `archived`, add it the same way as in Task 7 Step 3.

- [ ] **Step 4: Verify test passes + the rest of the file is still green**

```bash
cd apps/api && pnpm exec vitest run src/analytics/advanced/services/<name>.service.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Commit (one commit per service or one bundled — pick one)**

```bash
git add apps/api/src/analytics/advanced
git commit -m "Exclude archived projects from advanced analytics"
```

---

## Task 9: Frontend — type + service updates

**Files:**
- Modify: `apps/web/src/types/project.ts` (or wherever `Project` type lives — discover with `grep -rn "interface Project\b\|type Project = " apps/web/src/types apps/web/src 2>/dev/null | head -5`)
- Modify: `apps/web/src/services/projects.service.ts` (or equivalent)

- [ ] **Step 1: Extend the `Project` type**

```typescript
export interface Project {
  // ... existing fields
  archivedAt?: string | null;
  archivedById?: string | null;
  canArchive?: boolean;
  canUnarchive?: boolean;
}
```

- [ ] **Step 2: Add archive/unarchive service methods + accept `archived` query param**

In the projects axios service, add:

```typescript
export type ArchivedFilter = 'active' | 'archived' | 'all';

export const projectsService = {
  // ... existing methods
  list(params: { archived?: ArchivedFilter; /* other filters */ } = {}) {
    return api.get('/projects', { params });
  },
  archive(id: string) {
    return api.post(`/projects/${id}/archive`).then((r) => r.data);
  },
  unarchive(id: string) {
    return api.post(`/projects/${id}/unarchive`).then((r) => r.data);
  },
};
```

> If list isn't currently a wrapper, inline the `params` change at the call sites that already exist on `apps/web/app/[locale]/projects/page.tsx`.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "Add archive/unarchive client methods and Project flags"
```

---

## Task 10: Frontend — toggle + action menu on `/projects`

**Files:**
- Modify: `apps/web/app/[locale]/projects/page.tsx`

- [ ] **Step 1: Add the toggle state + query**

Near the other useState filters (around line 42-46):

```typescript
const [showArchived, setShowArchived] = useState(false);
```

In the `loadProjects` callback (or wherever `api.get('/projects', ...)` is invoked), pass `archived: showArchived ? 'all' : 'active'` as a query param. Add `showArchived` to the dependency array.

- [ ] **Step 2: Render the toggle in the toolbar**

In the JSX toolbar (next to the existing status filter):

```tsx
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={showArchived}
    onChange={(e) => setShowArchived(e.target.checked)}
  />
  Afficher les projets archivés
</label>
```

- [ ] **Step 3: Render the "Archivée" badge + dim styling**

In the project row JSX, conditionally:

```tsx
{project.archivedAt && (
  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">
    Archivée
  </span>
)}
```

Apply `opacity-60` to the row container when `project.archivedAt` is set.

- [ ] **Step 4: Add Archiver / Désarchiver to the row action menu**

Wherever the existing per-row menu (Edit / Delete) is rendered:

```tsx
{project.canArchive && (
  <button onClick={() => onArchive(project.id)}>Archiver</button>
)}
{project.canUnarchive && (
  <button onClick={() => onUnarchive(project.id)}>Désarchiver</button>
)}
```

Implement the handlers:

```typescript
const onArchive = async (id: string) => {
  if (!confirm("Archiver ce projet ? Il n'apparaîtra plus dans le suivi général mais restera accessible.")) return;
  await projectsService.archive(id);
  await loadProjects();
};

const onUnarchive = async (id: string) => {
  await projectsService.unarchive(id);
  await loadProjects();
};
```

- [ ] **Step 5: Manual verification with dev server**

```bash
pnpm run dev
```

Open https://localhost:3000/fr/projects:
- Toggle off → only active projects.
- Toggle on → archived rows visible, dimmed, with "Archivée" badge.
- Archiver action on an active project → row disappears (toggle off) or dims (toggle on).
- Désarchiver on archived project → row returns to normal styling.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/[locale]/projects/page.tsx
git commit -m "Add archive toggle + actions to project list"
```

---

## Task 11: Frontend — archived banner on detail page

**Files:**
- Modify: `apps/web/app/[locale]/projects/[id]/page.tsx`

- [ ] **Step 1: Render the banner**

At the top of the page content, before the existing project detail panels:

```tsx
{project.archivedAt && (
  <div className="border-l-4 border-amber-500 bg-amber-50 p-4 mb-6 flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-amber-800">Projet archivé</h3>
      <p className="text-sm text-amber-700">
        Archivé le {format(new Date(project.archivedAt), 'dd/MM/yyyy')}
        {project.archivedBy ? ` par ${project.archivedBy.firstName} ${project.archivedBy.lastName}` : ''}.
      </p>
    </div>
    {project.canUnarchive && (
      <button
        onClick={onUnarchive}
        className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
      >
        Désarchiver
      </button>
    )}
  </div>
)}
```

> If `project.archivedBy` (the relation) isn't included in the GET /:id response, decide between (a) extending the API response to include it (preferred — small, justifies one extra include), or (b) showing only the date.

- [ ] **Step 2: Add the unarchive handler**

```typescript
const onUnarchive = async () => {
  await projectsService.unarchive(project.id);
  // refetch the project so the banner disappears
  await refetch();
};
```

- [ ] **Step 3: Manual smoke**

Visit `/fr/projects/<archivedId>` directly — banner shows; click Désarchiver — banner disappears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/[locale]/projects/[id]
git commit -m "Show archived banner with Désarchiver on project detail"
```

---

## Task 12: E2E — Playwright archive flow + Reports exclusion

**Files:**
- Create: `e2e/tests/projects/archive.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Project archive", () => {
  test(
    "admin archives a project — disappears from /projects, stays reachable, excluded from /reports",
    { tag: "@smoke" },
    async ({ page, request, asRole }) => {
      // 1. Pick an active project via API as ADMIN
      const list = await request.get("/api/projects?archived=active&limit=1");
      const { data } = await list.json();
      const project = data[0];
      expect(project).toBeDefined();
      const projectId = project.id;
      const projectName = project.name;

      // 2. Archive it
      const archived = await request.post(`/api/projects/${projectId}/archive`);
      expect(archived.ok()).toBeTruthy();

      // 3. /projects (default) no longer lists it
      await page.goto("/fr/projects");
      await expect(page.getByText(projectName)).not.toBeVisible({ timeout: 5000 });

      // 4. Toggle on → reappears with "Archivée" badge
      await page.getByLabel(/projets archivés/i).check();
      await expect(page.getByText(projectName)).toBeVisible();
      await expect(page.getByText("Archivée").first()).toBeVisible();

      // 5. Direct URL still works, banner shown
      await page.goto(`/fr/projects/${projectId}`);
      await expect(page.getByText(/Projet archivé/i)).toBeVisible();

      // 6. /reports analytics excludes it
      const reports = await request.get("/api/analytics");
      const json = await reports.json();
      const ids = (json.projectDetails ?? []).map((p: { id: string }) => p.id);
      expect(ids).not.toContain(projectId);

      // 7. Unarchive → restored to default list
      const unarchived = await request.post(`/api/projects/${projectId}/unarchive`);
      expect(unarchived.ok()).toBeTruthy();
      await page.goto("/fr/projects");
      await expect(page.getByText(projectName)).toBeVisible();
    },
  );

  test("OBSERVATEUR cannot archive (403)", async ({ request }) => {
    // pre-arranged active project id from seed/fixtures
    const projectId = process.env.E2E_OBSERVABLE_PROJECT_ID ?? "<seed-id>";
    const res = await request.post(`/api/projects/${projectId}/archive`);
    expect(res.status()).toBe(403);
  });
});
```

> Adapt to your repo's Playwright fixtures. The `asRole` fixture, `request` per-role storage state, and `E2E_OBSERVABLE_PROJECT_ID` (or whatever fixture pattern exists) follow the conventions already in `e2e/`. Mirror the patterns from `e2e/tests/reports/analytics-advanced.spec.ts`.

- [ ] **Step 2: Run E2E**

```bash
pnpm run test:e2e --grep="Project archive"
```
Expected: PASS for both tests across `--project=admin` (and `--project=observateur` for the 403 case).

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/projects
git commit -m "E2E: project archive across admin + 403 on observateur"
```

---

## Task 13: Build, push, deploy

- [ ] **Step 1: Full monorepo build**

```bash
pnpm run build
```
Expected: 3/3 turbo tasks successful.

- [ ] **Step 2: Push**

```bash
git push origin master
```

- [ ] **Step 3: Deploy on VPS — pull + Prisma migrate + rebuild api + web**

Deploy command (per project memory `project_vps_deploy_env_file.md`, MUST include `--env-file .env.production`):

```bash
ssh debian@92.222.35.25 'cd /opt/orchestra && git pull origin master \
  && docker compose --env-file .env.production -f docker-compose.prod.yml build api web \
  && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T api pnpm prisma migrate deploy --schema=packages/database/prisma/schema.prisma \
  && docker compose --env-file .env.production -f docker-compose.prod.yml up -d api web'
```

> Run via Bash with `run_in_background: true` and arm a Monitor with grep alternation `Container|Started|Healthy|exited|ERROR|FAILED|fatal:|migration` per memory rule `feedback_never_trust_blind_monitor.md`.

- [ ] **Step 4: Verify**

```bash
ssh debian@92.222.35.25 'docker ps --format "{{.Names}}\t{{.Status}}" | grep orchestr-a'
curl -fsS -o /dev/null -w "API %{http_code} (401 expected)\n" https://orchestr-a.com/api/projects
```
Expected: api + web containers `Up (healthy)`; API returns 401.

---

## Self-Review

**Spec coverage:**
- Data model (`archivedAt`, `archivedById`, index, relation): Task 1 ✓
- Single `archived=active|archived|all` filter on list endpoints: Tasks 4, 7, 8 ✓
- Direct routes ignore the flag: not a code change — covered by NOT applying the filter to `findOne`, task list, etc. (no task needed because we only add the filter where called out) ✓
- Archive / unarchive endpoints with audit + scope guard: Task 5 ✓
- New `projects:archive` permission, bound to templates with `projects:update`: Task 2 ✓
- Per-resource enforcement via `OwnershipCheck`: Task 5 (decorator already wired) ✓
- Computed `canArchive`/`canUnarchive`: Task 6 ✓
- Audit on archive/unarchive: Task 5 ✓
- Frontend toggle on `/projects`: Task 10 ✓
- Frontend banner + Désarchiver on detail page: Task 11 ✓
- Reports / Gantt / dashboards excluded by default: Tasks 7 + 8 ✓
- Personal task lists unchanged: not a code change — verified by NOT modifying `tasks.service.ts` ✓
- E2E across roles: Task 12 ✓
- Migration & rollout: Tasks 1 + 13 ✓

**Placeholder scan:** No "TBD". Two soft notes ("confirm path during execution") for three frontend file paths that vary in the codebase — these have explicit `find`/`grep` discovery commands inline, not placeholders.

**Type / signature consistency:** `ArchivedFilter` enum imported consistently from `apps/api/src/projects/dto/archived-filter.dto.ts`. `archivedWhere(filter)` returns `Prisma.ProjectWhereInput`. `archive`/`unarchive` service methods both take `(id, user)` and return the updated `Project`. Audit action strings: `PROJECT_ARCHIVED` / `PROJECT_UNARCHIVED` (consistent across Task 5).

**Scope:** Single-feature plan, ~13 tasks, ~half a day of focused work. Manageable in one execution session.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-project-archive.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh Sonnet subagent per task, review the diff between tasks, fast iteration. Good fit here because tasks are independent (schema → permissions → backend filter → archive endpoints → flags → analytics → frontend → E2E → deploy).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints for your review.

Which approach?
