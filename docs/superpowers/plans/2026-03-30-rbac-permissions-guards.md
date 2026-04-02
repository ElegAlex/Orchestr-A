# RBAC Permissions Guards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@Permissions()` guards to 34 unprotected GET endpoints across 7 controllers, extend the seed to prevent access regressions, and align the frontend sidebar with the new permission model.

**Architecture:** Each controller gets `@Permissions('<module>:read')` on its GET endpoints (except `/me/*` personal routes which stay open). The seed is extended in the same commit so no role loses existing access. Frontend nav items get matching `permission` fields.

**Tech Stack:** NestJS (guards, decorators), Prisma (seed), React (MainLayout), Vitest (unit tests), Playwright (E2E permission matrix)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/api/src/role-management/role-management.service.ts` | Modify | Add missing permissions to 6 system roles in seed |
| `apps/api/src/tasks/tasks.controller.ts` | Modify | Add `@Permissions('tasks:read')` to 7 GET endpoints |
| `apps/api/src/departments/departments.controller.ts` | Modify | Add `@Permissions('departments:read')` to 3 GET endpoints |
| `apps/api/src/users/users.controller.ts` | Modify | Add `@Permissions('users:read')` to 6 GET endpoints |
| `apps/api/src/skills/skills.controller.ts` | Modify | Add `@Permissions('skills:read')` to 5 GET endpoints (skip `me/my-skills`) |
| `apps/api/src/leaves/leaves.controller.ts` | Modify | Add `@Permissions` to 5 GET endpoints (skip `me/*`) |
| `apps/api/src/telework/telework.controller.ts` | Modify | Add `@Permissions('telework:read')` to 3 GET endpoints (skip `me/*`) |
| `apps/api/src/events/events.controller.ts` | Modify | Add `@Permissions('events:read')` to 4 GET endpoints |
| `apps/web/src/components/MainLayout.tsx` | Modify | Add `permission` to 6 nav items, remove dead `isManager` |
| `e2e/fixtures/permission-matrix.ts` | Modify | Add entries for newly-guarded endpoints |

---

## Seed Gap Analysis (critical — prevents regressions)

These roles are **missing permissions for endpoints they currently access** (because the endpoints had no guard):

| Role | Missing permissions | Why needed |
|------|-------------------|------------|
| `REFERENT_TECHNIQUE` | `leaves:create`, `leaves:read`, `leaves:view` | Employee — must request leave |
| `CHEF_DE_PROJET` | `leaves:create`, `leaves:read`, `leaves:view`, `telework:read`, `telework:view` | Employee + manages team telework |
| `DEVELOPPEUR_CONCEPTEUR` | `leaves:create`, `leaves:read`, `leaves:view` | Employee — must request leave |
| `CORRESPONDANT_FONCTIONNEL_APPLICATION` | `leaves:create`, `leaves:read`, `leaves:view` | Employee — must request leave |
| `CHARGE_DE_MISSION` | `leaves:create`, `leaves:read`, `leaves:view` | Employee — must request leave |
| `CONSULTANT_TECHNOLOGIE_SI` | `leaves:create`, `leaves:read`, `leaves:view` | Employee — must request leave |

**No regression** for: ADMIN (all perms), RESPONSABLE (all minus 2), MANAGER (already has all needed), CONTRIBUTEUR (already has tasks:read, events:read, leaves:read, telework:read), OBSERVATEUR (dynamic filter gets all `*:read` + `*:view`).

## `/me/*` Routes — Must Stay Unprotected

These 6 routes are personal data endpoints, accessible to any authenticated user. Do **NOT** add `@Permissions`:

| Controller | Route | Method |
|-----------|-------|--------|
| `skills` | `GET me/my-skills` | `getMySkills` |
| `leaves` | `GET me` | `getMyLeaves` |
| `leaves` | `GET me/balance` | `getMyBalance` |
| `leaves` | `GET delegations/me` | `getMyDelegations` |
| `telework` | `GET me/week` | `getMyWeeklySchedule` |
| `telework` | `GET me/stats` | `getMyStats` |

---

### Task 1: Extend seed permissions (prevent regressions)

**Files:**
- Modify: `apps/api/src/role-management/role-management.service.ts:471-840`

- [ ] **Step 1: Add leaves permissions to REFERENT_TECHNIQUE**

In `apps/api/src/role-management/role-management.service.ts`, find the `REFERENT_TECHNIQUE` role config (around line 472). Add these 3 permissions at the end of its `permissions` array, before the closing `]`:

```typescript
          'predefined_tasks:view',
          'leaves:create',
          'leaves:read',
          'leaves:view',
```

- [ ] **Step 2: Add leaves + telework permissions to CHEF_DE_PROJET**

Find the `CHEF_DE_PROJET` role config (around line 426). Add these 5 permissions at the end of its `permissions` array:

```typescript
          'reports:view',
          'telework:read',
          'telework:view',
          'leaves:create',
          'leaves:read',
          'leaves:view',
```

- [ ] **Step 3: Add leaves permissions to DEVELOPPEUR_CONCEPTEUR**

Find the `DEVELOPPEUR_CONCEPTEUR` role config (around line 618). Add these 3 permissions at the end:

```typescript
          'telework:manage_others',
          'leaves:create',
          'leaves:read',
          'leaves:view',
```

- [ ] **Step 4: Add leaves permissions to CORRESPONDANT_FONCTIONNEL_APPLICATION**

Find the `CORRESPONDANT_FONCTIONNEL_APPLICATION` role config (around line 668). Add these 3 permissions at the end:

```typescript
          'telework:manage_others',
          'leaves:create',
          'leaves:read',
          'leaves:view',
```

- [ ] **Step 5: Add leaves permissions to CHARGE_DE_MISSION**

Find the `CHARGE_DE_MISSION` role config (around line 718). Add these 3 permissions at the end:

```typescript
          'telework:manage_others',
          'leaves:create',
          'leaves:read',
          'leaves:view',
```

- [ ] **Step 6: Add leaves permissions to CONSULTANT_TECHNOLOGIE_SI**

Find the `CONSULTANT_TECHNOLOGIE_SI` role config (around line 792). Add these 3 permissions at the end:

```typescript
          'telework:manage_others',
          'leaves:create',
          'leaves:read',
          'leaves:view',
```

- [ ] **Step 7: Run unit tests to verify seed logic is intact**

Run: `cd apps/api && npx vitest run src/role-management/ --reporter=verbose`
Expected: All existing tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/role-management/role-management.service.ts
git commit -m "fix(rbac): extend seed permissions to prevent regressions

Add leaves:create/read/view to 6 system roles (REFERENT_TECHNIQUE,
CHEF_DE_PROJET, DEVELOPPEUR_CONCEPTEUR, CORRESPONDANT_FONCTIONNEL_APPLICATION,
CHARGE_DE_MISSION, CONSULTANT_TECHNOLOGIE_SI) and telework:read/view to
CHEF_DE_PROJET. These roles currently access these endpoints because they
have no @Permissions guard — adding guards in the next commit would break
access without this seed extension."
```

---

### Task 2: Add @Permissions guards to tasks controller

**Files:**
- Modify: `apps/api/src/tasks/tasks.controller.ts`

The `@Permissions` decorator import should already exist in the file. If not, add it:
```typescript
import { Permissions } from '../auth/decorators/permissions.decorator';
```

- [ ] **Step 1: Verify Permissions import exists**

Read `apps/api/src/tasks/tasks.controller.ts` lines 1-20 and check if `Permissions` is imported from `../auth/decorators/permissions.decorator`. If not, add the import.

- [ ] **Step 2: Add @Permissions('tasks:read') to findAll (line ~70)**

Add the decorator immediately before the `@ApiOperation` line of the `findAll` method:

```typescript
  @Get()
  @Permissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer toutes les tâches (avec pagination et filtres)' })
```

- [ ] **Step 3: Add @Permissions('tasks:read') to getTasksByAssignee (line ~115)**

```typescript
  @Get('assignee/:userId')
  @Permissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer toutes les tâches assignées à un utilisateur' })
```

- [ ] **Step 4: Add @Permissions('tasks:read') to getTasksByProject (line ~127)**

```typescript
  @Get('project/:projectId')
  @Permissions('tasks:read')
  @ApiOperation({ summary: "Récupérer toutes les tâches d'un projet" })
```

- [ ] **Step 5: Add @Permissions('tasks:read') to exportProjectTasks (line ~141)**

```typescript
  @Get('project/:projectId/export')
  @Permissions('tasks:read')
  @ApiOperation({ summary: "Exporter les tâches d'un projet en CSV" })
```

- [ ] **Step 6: Add @Permissions('tasks:read') to findOrphans (line ~157)**

```typescript
  @Get('orphans')
  @Permissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer les tâches orphelines (sans projet)' })
```

- [ ] **Step 7: Add @Permissions('tasks:read') to findOne (line ~167)**

```typescript
  @Get(':id')
  @Permissions('tasks:read')
  @ApiOperation({ summary: 'Récupérer une tâche par ID avec tous les détails' })
```

- [ ] **Step 8: Add @Permissions('tasks:read') to getImportTemplate (line ~350)**

```typescript
  @Get('project/:projectId/import-template')
  @Permissions('tasks:read')
  @ApiOperation({ summary: "Télécharger le template CSV pour l'import de tâches" })
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/tasks/tasks.controller.ts
git commit -m "fix(rbac): add @Permissions('tasks:read') to 7 GET endpoints in tasks controller"
```

---

### Task 3: Add @Permissions guards to departments controller

**Files:**
- Modify: `apps/api/src/departments/departments.controller.ts`

- [ ] **Step 1: Verify Permissions import exists**

Read the imports at the top. If `Permissions` is not imported, add:
```typescript
import { Permissions } from '../auth/decorators/permissions.decorator';
```

- [ ] **Step 2: Add @Permissions('departments:read') to findAll (line ~54)**

```typescript
  @Get()
  @Permissions('departments:read')
  @ApiOperation({ summary: 'Récupérer tous les départements (avec pagination)' })
```

- [ ] **Step 3: Add @Permissions('departments:read') to findOne (line ~72)**

```typescript
  @Get(':id')
  @Permissions('departments:read')
  @ApiOperation({ summary: 'Récupérer un département par ID avec tous les détails' })
```

- [ ] **Step 4: Add @Permissions('departments:read') to getStats (line ~89)**

```typescript
  @Get(':id/stats')
  @Permissions('departments:read')
  @ApiOperation({ summary: "Récupérer les statistiques d'un département" })
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/departments/departments.controller.ts
git commit -m "fix(rbac): add @Permissions('departments:read') to 3 GET endpoints in departments controller"
```

---

### Task 4: Add @Permissions guards to users controller

**Files:**
- Modify: `apps/api/src/users/users.controller.ts`

- [ ] **Step 1: Verify Permissions import exists**

Read the imports. The file likely already imports `Permissions` since it has `@Permissions('users:create')` etc. on write endpoints. Confirm.

- [ ] **Step 2: Add @Permissions('users:read') to findAll (line ~109)**

```typescript
  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'Récupérer tous les utilisateurs (avec pagination)' })
```

- [ ] **Step 3: Add @Permissions('users:read') to getUsersPresence (line ~141)**

```typescript
  @Get('presence')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Récupérer les statuts de présence des utilisateurs pour une date' })
```

- [ ] **Step 4: Add @Permissions('users:read') to getUsersByDepartment (line ~160)**

```typescript
  @Get('department/:departmentId')
  @Permissions('users:read')
  @ApiOperation({ summary: "Récupérer les utilisateurs d'un département" })
```

- [ ] **Step 5: Add @Permissions('users:read') to getUsersByService (line ~173)**

```typescript
  @Get('service/:serviceId')
  @Permissions('users:read')
  @ApiOperation({ summary: "Récupérer les utilisateurs d'un service" })
```

- [ ] **Step 6: Add @Permissions('users:read') to getUsersByRole (line ~184)**

```typescript
  @Get('role/:role')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Récupérer les utilisateurs par rôle' })
```

- [ ] **Step 7: Add @Permissions('users:read') to findOne (line ~195)**

```typescript
  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Récupérer un utilisateur par ID' })
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/users/users.controller.ts
git commit -m "fix(rbac): add @Permissions('users:read') to 6 GET endpoints in users controller"
```

---

### Task 5: Add @Permissions guards to skills controller

**Files:**
- Modify: `apps/api/src/skills/skills.controller.ts`

**IMPORTANT:** Do NOT touch `GET me/my-skills` (line ~310) — it stays unprotected (personal data).

- [ ] **Step 1: Verify Permissions import exists**

The file already uses `@Permissions('skills:create')` etc. Confirm import is present.

- [ ] **Step 2: Add @Permissions('skills:read') to findAll (line ~58)**

```typescript
  @Get()
  @Permissions('skills:read')
  @ApiOperation({ summary: 'Récupérer toutes les compétences (avec pagination)' })
```

- [ ] **Step 3: Add @Permissions('skills:read') to findUsersBySkill (line ~96)**

```typescript
  @Get('search/:skillId')
  @Permissions('skills:read')
  @ApiOperation({ summary: 'Rechercher des utilisateurs par compétence...' })
```

- [ ] **Step 4: Add @Permissions('skills:read') to getImportTemplate (line ~118)**

```typescript
  @Get('import-template')
  @Permissions('skills:read')
  @ApiOperation({ summary: "Télécharger le template CSV pour l'import de compétences" })
```

- [ ] **Step 5: Add @Permissions('skills:read') to findOne (line ~154)**

```typescript
  @Get(':id')
  @Permissions('skills:read')
  @ApiOperation({ summary: 'Récupérer une compétence par ID avec ses utilisateurs' })
```

- [ ] **Step 6: Add @Permissions('skills:read') to getUserSkills (line ~295)**

```typescript
  @Get('user/:userId')
  @Permissions('skills:read')
  @ApiOperation({ summary: "Récupérer les compétences d'un utilisateur" })
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/skills/skills.controller.ts
git commit -m "fix(rbac): add @Permissions('skills:read') to 5 GET endpoints in skills controller (me/my-skills stays open)"
```

---

### Task 6: Add @Permissions guards to leaves controller

**Files:**
- Modify: `apps/api/src/leaves/leaves.controller.ts`

**IMPORTANT:** Do NOT touch these `/me/*` routes — they stay unprotected:
- `GET me` (getMyLeaves)
- `GET me/balance` (getMyBalance)
- `GET delegations/me` (getMyDelegations)

- [ ] **Step 1: Verify Permissions import exists**

The file already has `@Permissions('leaves:read')` on `getUserBalance`. Confirm import present.

- [ ] **Step 2: Add @Permissions('leaves:read') to findAll (line ~124)**

```typescript
  @Get()
  @Permissions('leaves:read')
  @ApiOperation({ summary: 'Récupérer toutes les demandes de congé (avec pagination et filtres)' })
```

- [ ] **Step 3: Add @Permissions('leaves:approve') to getPendingForValidation (line ~194)**

This endpoint is for validators specifically — use `leaves:approve`, not `leaves:read`:

```typescript
  @Get('pending-validation')
  @Permissions('leaves:approve')
  @ApiOperation({ summary: 'Récupérer les demandes en attente de ma validation' })
```

- [ ] **Step 4: Add @Permissions('leaves:read') to getImportTemplate (line ~206)**

```typescript
  @Get('import-template')
  @Permissions('leaves:read')
  @ApiOperation({ summary: 'Télécharger le modèle CSV pour import de congés' })
```

- [ ] **Step 5: Add @Permissions('leaves:read') to getSubordinates (line ~279)**

```typescript
  @Get('subordinates')
  @Permissions('leaves:read')
  @ApiOperation({ summary: 'Récupérer les collaborateurs sous la responsabilité du manager...' })
```

- [ ] **Step 6: Add @Permissions('leaves:read') to findOne (line ~294)**

```typescript
  @Get(':id')
  @Permissions('leaves:read')
  @ApiOperation({ summary: 'Récupérer une demande de congé par ID' })
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/leaves/leaves.controller.ts
git commit -m "fix(rbac): add @Permissions to 5 GET endpoints in leaves controller (me/* stays open)"
```

---

### Task 7: Add @Permissions guards to telework controller

**Files:**
- Modify: `apps/api/src/telework/telework.controller.ts`

**IMPORTANT:** Do NOT touch these `/me/*` routes — they stay unprotected:
- `GET me/week` (getMyWeeklySchedule)
- `GET me/stats` (getMyStats)

- [ ] **Step 1: Verify Permissions import exists or add it**

Check imports. If `Permissions` is not imported:
```typescript
import { Permissions } from '../auth/decorators/permissions.decorator';
```

- [ ] **Step 2: Add @Permissions('telework:read') to findAll (line ~60)**

```typescript
  @Get()
  @Permissions('telework:read')
  @ApiOperation({ summary: 'Récupérer tous les télétravails (avec pagination et filtres)' })
```

- [ ] **Step 3: Add @Permissions('telework:read') to findOne (line ~186)**

```typescript
  @Get(':id')
  @Permissions('telework:read')
  @ApiOperation({ summary: 'Récupérer un télétravail par ID' })
```

- [ ] **Step 4: Add @Permissions('telework:read') to findAllRecurringRules (line ~252)**

```typescript
  @Get('recurring-rules')
  @Permissions('telework:read')
  @ApiOperation({ summary: 'Lister les règles de télétravail récurrent (filtrable par userId)' })
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telework/telework.controller.ts
git commit -m "fix(rbac): add @Permissions('telework:read') to 3 GET endpoints in telework controller (me/* stays open)"
```

---

### Task 8: Add @Permissions guards to events controller

**Files:**
- Modify: `apps/api/src/events/events.controller.ts`

- [ ] **Step 1: Verify Permissions import exists or add it**

```typescript
import { Permissions } from '../auth/decorators/permissions.decorator';
```

- [ ] **Step 2: Add @Permissions('events:read') to findAll (line ~56)**

```typescript
  @Get()
  @Permissions('events:read')
  @ApiOperation({ summary: 'Récupérer tous les événements (avec filtres optionnels)' })
```

- [ ] **Step 3: Add @Permissions('events:read') to getEventsByRange (line ~86)**

```typescript
  @Get('range')
  @Permissions('events:read')
  @ApiOperation({ summary: 'Récupérer les événements dans une plage de dates' })
```

- [ ] **Step 4: Add @Permissions('events:read') to getEventsByUser (line ~102)**

```typescript
  @Get('user/:userId')
  @Permissions('events:read')
  @ApiOperation({ summary: "Récupérer tous les événements d'un utilisateur" })
```

Note: This endpoint has an inline role check for MANAGEMENT_ROLES. The `@Permissions` guard adds the permission layer; the inline check can stay for additional business logic.

- [ ] **Step 5: Add @Permissions('events:read') to findOne (line ~129)**

```typescript
  @Get(':id')
  @Permissions('events:read')
  @ApiOperation({ summary: 'Récupérer un événement par ID avec tous les détails' })
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/events/events.controller.ts
git commit -m "fix(rbac): add @Permissions('events:read') to 4 GET endpoints in events controller"
```

---

### Task 9: Fix MainLayout navigation permissions

**Files:**
- Modify: `apps/web/src/components/MainLayout.tsx`

- [ ] **Step 1: Add permission fields to 6 navigation items (lines ~35-41)**

Replace the navigation array items that are missing `permission`:

```typescript
  const navigation: (NavItem & { permission?: string })[] = [
    { key: "dashboard", href: `/${locale}/dashboard`, icon: "🎯" },
    {
      key: "projects",
      href: `/${locale}/projects`,
      icon: "📁",
      permission: "projects:read",
    },
    { key: "tasks", href: `/${locale}/tasks`, icon: "✓", permission: "tasks:read" },
    { key: "events", href: `/${locale}/events`, icon: "📣", permission: "events:read" },
    { key: "planning", href: `/${locale}/planning`, icon: "🗓️" },
    { key: "timeTracking", href: `/${locale}/time-tracking`, icon: "⏱️", permission: "time_tracking:read" },
    { key: "leaves", href: `/${locale}/leaves`, icon: "🏖️", permission: "leaves:create" },
    { key: "telework", href: `/${locale}/telework`, icon: "🏠", permission: "telework:create" },
  ];
```

Note: `planning` stays without permission (composite view). `leaves` and `telework` use `:create` because all employees who can use these features have at minimum the create permission — OBSERVATEUR (read-only) should not see create-oriented pages but CAN see them in the admin nav if they have `*:read`.

- [ ] **Step 2: Remove dead isManager variable (line ~82)**

Delete this line:
```typescript
  const isManager = hasAnyPermission(["projects:read", "projects:create"]);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MainLayout.tsx
git commit -m "fix(rbac): add permission fields to MainLayout nav items, remove dead isManager"
```

---

### Task 10: Update E2E permission matrix

**Files:**
- Modify: `e2e/fixtures/permission-matrix.ts`

- [ ] **Step 1: Add tasks:read entry**

Add after the PROJECTS section (line ~100):

```typescript
  // ═══════════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════════
  {
    action: "tasks:read",
    resource: "tasks",
    method: "GET",
    apiEndpoint: "/api/tasks",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les tâches — tous les rôles (tasks:read dans tous les seeds)",
  },
```

- [ ] **Step 2: Add events:read entry**

Add after the TASKS section:

```typescript
  // ═══════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════
  {
    action: "events:read",
    resource: "events",
    method: "GET",
    apiEndpoint: "/api/events",
    allowedRoles: [
      "admin",
      "responsable",
      "manager",
      "referent",
      "contributeur",
      "observateur",
    ],
    deniedRoles: [],
    description:
      "Lister les événements — tous les rôles (events:read dans tous les seeds)",
  },
```

- [ ] **Step 3: Commit**

```bash
git add e2e/fixtures/permission-matrix.ts
git commit -m "test(rbac): add tasks:read and events:read entries to permission matrix"
```

---

### Task 11: Build verification

- [ ] **Step 1: Run full build**

```bash
pnpm run build
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run API unit tests**

```bash
cd apps/api && npx vitest run --reporter=verbose
```

Expected: All tests PASS, including PermissionsGuard granularity tests.

- [ ] **Step 3: Run frontend lint/build**

```bash
cd apps/web && pnpm run build
```

Expected: No build errors.

---

### Task 12: Manual verification checklist

- [ ] **Step 1: Start dev environment**

```bash
pnpm run docker:dev && pnpm run dev
```

- [ ] **Step 2: Reset roles to defaults to apply seed changes**

```bash
curl -X POST http://localhost:3001/api/role-management/reset-to-defaults \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"
```

- [ ] **Step 3: Test permission isolation**

Create a custom role with ONLY `projects:create` + `projects:read`. Assign to a test user. Verify:
- Can access `GET /api/projects` → 200
- Cannot access `GET /api/users` → 403
- Cannot access `GET /api/departments` → 403
- Cannot access `GET /api/skills` → 403
- Cannot access `GET /api/reports` → 403
- CAN access `GET /api/leaves/me` → 200 (personal route)
- CAN access `GET /api/telework/me/week` → 200 (personal route)

- [ ] **Step 4: Test CONTRIBUTEUR regression**

Login as CONTRIBUTEUR. Verify:
- Can access `GET /api/tasks` → 200
- Can access `GET /api/events` → 200
- Can access `GET /api/leaves` → 200
- Can access `GET /api/telework` → 200
- Can access `GET /api/leaves/me/balance` → 200
- Cannot access `GET /api/users` → 403
- Cannot access `GET /api/departments` → 403

- [ ] **Step 5: Test OBSERVATEUR regression**

Login as OBSERVATEUR. Verify:
- Can access all `GET` endpoints (has all `*:read` + `*:view`)
- Cannot POST/PATCH/DELETE anything → 403
