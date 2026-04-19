# Audit 02 — Mapping endpoints ↔ permissions

> Phase 0, §1.2 — Cartographie complète `@Permissions` ↔ endpoints, détection des orphelines, trous de sécurité, incohérences front/back.

**Périmètre scanné** : `apps/api/src/**/*.controller.ts` (28 controllers, 187 occurrences de `@Permissions`) + `apps/web/src/**` et `apps/web/app/**` (126 appels à `hasPermission`/`hasAnyPermission`/`hasAllPermissions`).

**Source catalogue** : `/home/alex/Documents/REPO/ORCHESTRA/docs/rbac/ROLES-PERMISSIONS.md` (119 permissions, lignes 40-164).

**Rappel du comportement du `PermissionsGuard`** (`apps/api/src/auth/guards/permissions.guard.ts:24-27`) : il **laisse passer** toute route sans `@Permissions()`. Donc une route sans `@Public()` et sans `@Permissions()` ni `@Roles()` est **authentifiée mais sans contrôle fin** → tout utilisateur loggué y accède (**fail-open**).

---

## 1. Inventaire back — par module

### 1.1 `auth` — `apps/api/src/auth/auth.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/auth/login` | `@Public()` | auth.controller.ts:53-54 |
| POST | `/auth/refresh` | `@Public()` | auth.controller.ts:84-85 |
| POST | `/auth/logout` | _authenticated (no perm)_ | auth.controller.ts:103 |
| POST | `/auth/register` | `@Public()` | auth.controller.ts:124-125 |
| GET | `/auth/profile` | _authenticated (no perm)_ | auth.controller.ts:143 |
| GET | `/auth/me` | _authenticated (no perm)_ | auth.controller.ts:158 |
| GET | `/auth/me/permissions` | _authenticated (no perm)_ | auth.controller.ts:171 |
| POST | `/auth/reset-password-token` | `@Permissions('users:reset_password')` | auth.controller.ts:186-187 |
| POST | `/auth/reset-password` | `@Public()` | auth.controller.ts:212-213 |

### 1.2 `analytics` — `analytics.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/analytics` | `@Permissions('reports:view')` | analytics.controller.ts:16-17 |
| GET | `/analytics/export` | `@Permissions('reports:export')` | analytics.controller.ts:25-26 |

### 1.3 `comments` — `comments.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/comments` | `@Permissions('comments:create')` | comments.controller.ts:34-35 |
| GET | `/comments` | _authenticated (no perm)_ | comments.controller.ts:45 |
| GET | `/comments/:id` | _authenticated (no perm)_ | comments.controller.ts:58 |
| PATCH | `/comments/:id` | `@Permissions('comments:update')` | comments.controller.ts:64-65 |
| DELETE | `/comments/:id` | `@Permissions('comments:delete')` | comments.controller.ts:75-76 |

### 1.4 `departments` — `departments.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/departments` | `@Permissions('departments:create')` | departments.controller.ts:33-34 |
| GET | `/departments` | `@Permissions('departments:read')` | departments.controller.ts:54-55 |
| GET | `/departments/:id` | `@Permissions('departments:read')` | departments.controller.ts:72-73 |
| GET | `/departments/:id/stats` | `@Permissions('departments:read')` | departments.controller.ts:89-90 |
| PATCH | `/departments/:id` | `@Permissions('departments:update')` | departments.controller.ts:105-106 |
| DELETE | `/departments/:id` | `@Permissions('departments:delete')` | departments.controller.ts:129-130 |

### 1.5 `documents` — `documents.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/documents` | `@Permissions('documents:create')` | documents.controller.ts:38-39 |
| GET | `/documents` | `@Permissions('documents:read')` | documents.controller.ts:49-50 |
| GET | `/documents/:id` | `@Permissions('documents:read')` | documents.controller.ts:63-64 |
| PATCH | `/documents/:id` | `@Permissions('documents:update')` + `@OwnershipCheck(bypassPermission:'documents:manage_any')` | documents.controller.ts:70-73 |
| DELETE | `/documents/:id` | `@Permissions('documents:delete')` + `@OwnershipCheck(bypassPermission:'documents:manage_any')` | documents.controller.ts:82-85 |

### 1.6 `epics` — `epics.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/epics` | `@Permissions('epics:create')` | epics.controller.ts:34-35 |
| GET | `/epics` | _authenticated (no perm)_ | epics.controller.ts:42 |
| GET | `/epics/:id` | _authenticated (no perm)_ | epics.controller.ts:55 |
| PATCH | `/epics/:id` | `@Permissions('epics:update')` | epics.controller.ts:61-62 |
| DELETE | `/epics/:id` | `@Permissions('epics:delete')` | epics.controller.ts:73-74 |

### 1.7 `events` — `events.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/events` | `@Permissions('events:create')` | events.controller.ts:38-39 |
| GET | `/events` | `@Permissions('events:read')` | events.controller.ts:60-61 |
| GET | `/events/range` | `@Permissions('events:read')` | events.controller.ts:91-92 |
| GET | `/events/user/:userId` | `@Permissions('events:read')` | events.controller.ts:118-119 |
| GET | `/events/:id` | `@Permissions('events:read')` | events.controller.ts:146-147 |
| PATCH | `/events/:id` | `@Permissions('events:update')` + `@OwnershipCheck(bypassPermission:'events:manage_any')` | events.controller.ts:167-170 |
| DELETE | `/events/:id` | `@Permissions('events:delete')` + bypass `events:manage_any` | events.controller.ts:202-205 |
| DELETE | `/events/:id/recurrence` | `@Permissions('events:delete')` + bypass | events.controller.ts:228-231 |
| POST | `/events/:id/participants` | `@Permissions('events:update')` + bypass | events.controller.ts:252-255 |
| DELETE | `/events/:eventId/participants/:userId` | `@Permissions('events:update')` + bypass | events.controller.ts:287-294 |

### 1.8 `holidays` — `holidays.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/holidays` | _authenticated (no perm)_ | holidays.controller.ts:37 |
| GET | `/holidays/year/:year` | _authenticated (no perm)_ | holidays.controller.ts:44 |
| GET | `/holidays/range` | _authenticated (no perm)_ | holidays.controller.ts:55 |
| GET | `/holidays/:id` | _authenticated (no perm)_ | holidays.controller.ts:75 |
| POST | `/holidays` | `@Permissions('holidays:create')` | holidays.controller.ts:84-85 |
| POST | `/holidays/import-french` | `@Permissions('holidays:create')` | holidays.controller.ts:99-100 |
| PATCH | `/holidays/:id` | `@Permissions('holidays:update')` | holidays.controller.ts:130-131 |
| DELETE | `/holidays/:id` | `@Permissions('holidays:delete')` | holidays.controller.ts:147-148 |
| GET | `/holidays/working-days/count` | _authenticated (no perm)_ | holidays.controller.ts:158 |

### 1.9 `leaves` — `leaves.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/leaves` | _authenticated (no perm)_ | leaves.controller.ts:48 |
| GET | `/leaves/balances` | `@Permissions('leaves:manage')` | leaves.controller.ts:79-80 |
| GET | `/leaves/balances/defaults` | `@Permissions('leaves:manage')` | leaves.controller.ts:94-95 |
| POST | `/leaves/balances` | `@Permissions('leaves:manage')` | leaves.controller.ts:107-108 |
| DELETE | `/leaves/balances/:id` | `@Permissions('leaves:manage')` | leaves.controller.ts:120-121 |
| GET | `/leaves` | `@Permissions('leaves:read')` | leaves.controller.ts:130-131 |
| GET | `/leaves/me` | _authenticated (no perm)_ | leaves.controller.ts:181 |
| GET | `/leaves/me/balance` | _authenticated (no perm)_ | leaves.controller.ts:191 |
| GET | `/leaves/pending-validation` | `@Permissions('leaves:approve')` | leaves.controller.ts:201-202 |
| GET | `/leaves/import-template` | `@Permissions('leaves:read')` | leaves.controller.ts:214-215 |
| POST | `/leaves/import/validate` | `@Permissions('leaves:create')` | leaves.controller.ts:231-232 |
| POST | `/leaves/import` | `@Permissions('leaves:create')` | leaves.controller.ts:247-248 |
| GET | `/leaves/balance/:userId` | `@Permissions('leaves:read')` + check runtime `leaves:validate` | leaves.controller.ts:270-292 |
| GET | `/leaves/subordinates` | `@Permissions('leaves:read')` | leaves.controller.ts:301-302 |
| GET | `/leaves/:id` | `@Permissions('leaves:read')` | leaves.controller.ts:318-319 |
| PATCH | `/leaves/:id` | _authenticated (no perm)_ | leaves.controller.ts:337 |
| DELETE | `/leaves/:id` | _authenticated (no perm)_ | leaves.controller.ts:367 |
| POST | `/leaves/:id/approve` | `@Permissions('leaves:approve')` | leaves.controller.ts:393-394 |
| POST | `/leaves/:id/reject` | `@Permissions('leaves:approve')` | leaves.controller.ts:433-434 |
| POST | `/leaves/:id/request-cancel` | _authenticated (no perm)_ | leaves.controller.ts:473 |
| POST | `/leaves/:id/cancel` | `@Permissions('leaves:delete')` | leaves.controller.ts:501-502 |
| POST | `/leaves/:id/reject-cancellation` | `@Permissions('leaves:approve')` | leaves.controller.ts:528-529 |
| POST | `/leaves/delegations` | `@Permissions('leaves:manage_delegations')` | leaves.controller.ts:555-556 |
| GET | `/leaves/delegations/me` | _authenticated (no perm)_ | leaves.controller.ts:602 |
| DELETE | `/leaves/delegations/:id` | _authenticated (no perm)_ | leaves.controller.ts:614 |

### 1.10 `leave-types` — `leave-types.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/leave-types` | `@Permissions('leaves:update')` | leave-types.controller.ts:33-34 |
| GET | `/leave-types` | _authenticated (no perm)_ | leave-types.controller.ts:44 |
| GET | `/leave-types/:id` | _authenticated (no perm)_ | leave-types.controller.ts:57 |
| GET | `/leave-types/code/:code` | _authenticated (no perm)_ | leave-types.controller.ts:65 |
| PATCH | `/leave-types/:id` | `@Permissions('leaves:update')` | leave-types.controller.ts:73-74 |
| DELETE | `/leave-types/:id` | `@Permissions('leaves:delete')` | leave-types.controller.ts:91-92 |
| POST | `/leave-types/reorder` | `@Permissions('leaves:update')` | leave-types.controller.ts:108-109 |

### 1.11 `milestones` — `milestones.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/milestones` | `@Permissions('milestones:create')` | milestones.controller.ts:42-43 |
| GET | `/milestones` | _authenticated (no perm)_ | milestones.controller.ts:50 |
| GET | `/milestones/:id` | _authenticated (no perm)_ | milestones.controller.ts:65 |
| PATCH | `/milestones/:id` | `@Permissions('milestones:update')` | milestones.controller.ts:71-72 |
| POST | `/milestones/:id/complete` | `@Permissions('milestones:update')` | milestones.controller.ts:83-84 |
| DELETE | `/milestones/:id` | `@Permissions('milestones:delete')` | milestones.controller.ts:91-92 |
| POST | `/milestones/project/:projectId/import/validate` | `@Permissions('milestones:create')` | milestones.controller.ts:103-104 |
| POST | `/milestones/project/:projectId/import` | `@Permissions('milestones:create')` | milestones.controller.ts:125-126 |
| GET | `/milestones/project/:projectId/export` | _authenticated (no perm)_ | milestones.controller.ts:147 |
| GET | `/milestones/project/:projectId/import-template` | _authenticated (no perm)_ | milestones.controller.ts:163 |

### 1.12 `personal-todos` — `personal-todos.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/personal-todos` | _authenticated (no perm)_ | personal-todos.controller.ts:21 |
| POST | `/personal-todos` | _authenticated (no perm)_ | personal-todos.controller.ts:26 |
| PATCH | `/personal-todos/:id` | _authenticated (no perm)_ | personal-todos.controller.ts:31 |
| DELETE | `/personal-todos/:id` | _authenticated (no perm)_ | personal-todos.controller.ts:40 |

### 1.13 `planning` / `planning-export`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/planning/overview` | `@Permissions('users:read')` | planning.controller.ts:20-21 |
| GET | `/planning-export/ics` | _authenticated (no perm)_ | planning-export.controller.ts:21 |
| POST | `/planning-export/ics/import/preview` | _authenticated (no perm)_ | planning-export.controller.ts:43 |
| POST | `/planning-export/ics/import` | _authenticated (no perm)_ | planning-export.controller.ts:56 |

### 1.14 `predefined-tasks` — `predefined-tasks.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/predefined-tasks` | `@Permissions('predefined_tasks:view')` | predefined-tasks.controller.ts:47-48 |
| POST | `/predefined-tasks` | `@Permissions('predefined_tasks:create')` | predefined-tasks.controller.ts:58-59 |
| PATCH | `/predefined-tasks/:id` | `@Permissions('predefined_tasks:edit')` | predefined-tasks.controller.ts:70-71 |
| DELETE | `/predefined-tasks/:id` | `@Permissions('predefined_tasks:delete')` | predefined-tasks.controller.ts:82-83 |
| GET | `/predefined-tasks/assignments` | `@Permissions('predefined_tasks:view')` | predefined-tasks.controller.ts:96-97 |
| POST | `/predefined-tasks/assignments` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:130-131 |
| POST | `/predefined-tasks/assignments/bulk` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:146-147 |
| DELETE | `/predefined-tasks/assignments/:id` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:166-167 |
| GET | `/predefined-tasks/recurring-rules` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:180-181 |
| POST | `/predefined-tasks/recurring-rules` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:196-197 |
| POST | `/predefined-tasks/recurring-rules/bulk` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:211-212 |
| PATCH | `/predefined-tasks/recurring-rules/:id` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:226-227 |
| DELETE | `/predefined-tasks/recurring-rules/:id` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:241-242 |
| POST | `/predefined-tasks/recurring-rules/generate` | `@Permissions('predefined_tasks:assign')` | predefined-tasks.controller.ts:251-252 |

### 1.15 `projects` — `projects.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/projects` | `@Permissions('projects:create')` | projects.controller.ts:38-39 |
| GET | `/projects` | `@Permissions('projects:read')` | projects.controller.ts:67-68 |
| POST | `/projects/snapshots/capture` | **`@Permissions('admin:access')`** ⚠️ perm inexistante | projects.controller.ts:87-88 |
| GET | `/projects/user/:userId` | `@Permissions('projects:read')` | projects.controller.ts:94-95 |
| GET | `/projects/:id` | `@Permissions('projects:read')` | projects.controller.ts:109-110 |
| GET | `/projects/:id/stats` | `@Permissions('projects:read')` | projects.controller.ts:124-125 |
| GET | `/projects/:id/snapshots` | `@Permissions('reports:view')` | projects.controller.ts:139-140 |
| PATCH | `/projects/:id` | `@Permissions('projects:update')` + bypass `projects:manage_any` | projects.controller.ts:150-152 |
| DELETE | `/projects/:id` | `@Permissions('projects:delete')` + bypass | projects.controller.ts:177-179 |
| DELETE | `/projects/:id/hard` | `@Permissions('projects:delete')` + bypass | projects.controller.ts:199-201 |
| POST | `/projects/:id/members` | `@Permissions('projects:manage_members')` + bypass | projects.controller.ts:218-220 |
| PATCH | `/projects/:projectId/members/:userId` | `@Permissions('projects:manage_members')` + bypass | projects.controller.ts:244-249 |
| DELETE | `/projects/:projectId/members/:userId` | `@Permissions('projects:manage_members')` + bypass | projects.controller.ts:265-270 |

### 1.16 `role-management` — `role-management.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/role-management/roles` | `@Roles(Role.ADMIN)` | role-management.controller.ts:34-35 |
| POST | `/role-management/roles` | `@Roles(Role.ADMIN)` | role-management.controller.ts:45-46 |
| GET | `/role-management/roles/:id` | `@Roles(Role.ADMIN)` | role-management.controller.ts:60-61 |
| PATCH | `/role-management/roles/:id` | `@Roles(Role.ADMIN)` | role-management.controller.ts:75-76 |
| DELETE | `/role-management/roles/:id` | `@Roles(Role.ADMIN)` | role-management.controller.ts:93-94 |
| GET | `/role-management/permissions` | `@Roles(Role.ADMIN)` | role-management.controller.ts:113-114 |
| PUT | `/role-management/roles/:id/permissions` | `@Roles(Role.ADMIN)` | role-management.controller.ts:126-127 |
| POST | `/role-management/seed` | `@Roles(Role.ADMIN)` | role-management.controller.ts:151-152 |
| POST | `/role-management/reset-to-defaults` | `@Permissions('users:manage_roles')` | role-management.controller.ts:165-166 |

### 1.17 `school-vacations` — `school-vacations.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/school-vacations` | _authenticated (no perm)_ | school-vacations.controller.ts:43 |
| GET | `/school-vacations/range` | _authenticated (no perm)_ | school-vacations.controller.ts:56 |
| GET | `/school-vacations/:id` | _authenticated (no perm)_ | school-vacations.controller.ts:69 |
| POST | `/school-vacations` | `@Permissions('school_vacations:create')` | school-vacations.controller.ts:78-79 |
| POST | `/school-vacations/import` | `@Permissions('school_vacations:create')` | school-vacations.controller.ts:93-94 |
| PATCH | `/school-vacations/:id` | `@Permissions('school_vacations:update')` | school-vacations.controller.ts:128-129 |
| DELETE | `/school-vacations/:id` | `@Permissions('school_vacations:delete')` | school-vacations.controller.ts:143-144 |

### 1.18 `services` — `services.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/services` | `@Permissions('services:create')` | services.controller.ts:33-34 |
| GET | `/services` | _authenticated (no perm)_ | services.controller.ts:59 |
| GET | `/services/department/:departmentId` | _authenticated (no perm)_ | services.controller.ts:76 |
| GET | `/services/:id` | _authenticated (no perm)_ | services.controller.ts:92 |
| GET | `/services/:id/stats` | _authenticated (no perm)_ | services.controller.ts:108 |
| PATCH | `/services/:id` | `@Permissions('services:update')` | services.controller.ts:122-123 |
| DELETE | `/services/:id` | `@Permissions('services:delete')` | services.controller.ts:147-148 |

### 1.19 `settings` — `settings.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/settings` | _authenticated (no perm)_ | settings.controller.ts:23 |
| GET | `/settings/category/:category` | _authenticated (no perm)_ | settings.controller.ts:30 |
| GET | `/settings/:key` | _authenticated (no perm)_ | settings.controller.ts:37 |
| PUT | `/settings/:key` | `@Permissions('settings:update')` | settings.controller.ts:44-45 |
| POST | `/settings/bulk` | `@Permissions('settings:update')` | settings.controller.ts:67-68 |
| POST | `/settings/:key/reset` | `@Permissions('settings:update')` | settings.controller.ts:77-78 |
| POST | `/settings/reset-all` | `@Permissions('settings:update')` | settings.controller.ts:88-89 |
| DELETE | `/settings/:key` | `@Permissions('settings:update')` | settings.controller.ts:98-99 |

### 1.20 `skills` — `skills.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/skills` | `@Permissions('skills:create')` | skills.controller.ts:42-43 |
| GET | `/skills` | `@Permissions('skills:read')` | skills.controller.ts:59-60 |
| GET | `/skills/matrix` | `@Permissions('skills:manage_matrix')` | skills.controller.ts:79-80 |
| GET | `/skills/search/:skillId` | `@Permissions('skills:read')` | skills.controller.ts:97-98 |
| GET | `/skills/import-template` | `@Permissions('skills:read')` | skills.controller.ts:119-120 |
| POST | `/skills/import/validate` | `@Permissions('skills:create')` | skills.controller.ts:132-133 |
| POST | `/skills/import` | `@Permissions('skills:create')` | skills.controller.ts:144-145 |
| GET | `/skills/:id` | `@Permissions('skills:read')` | skills.controller.ts:156-157 |
| PATCH | `/skills/:id` | `@Permissions('skills:update')` | skills.controller.ts:173-174 |
| DELETE | `/skills/:id` | `@Permissions('skills:delete')` | skills.controller.ts:197-198 |
| POST | `/skills/me/assign` | _authenticated (no perm)_ | skills.controller.ts:219 |
| POST | `/skills/user/:userId/assign` | `@Permissions('skills:manage_matrix')` | skills.controller.ts:236-237 |
| DELETE | `/skills/me/remove/:skillId` | _authenticated (no perm)_ | skills.controller.ts:257 |
| DELETE | `/skills/user/:userId/remove/:skillId` | `@Permissions('skills:manage_matrix')` | skills.controller.ts:275-276 |
| GET | `/skills/user/:userId` | `@Permissions('skills:read')` | skills.controller.ts:297-298 |
| GET | `/skills/me/my-skills` | _authenticated (no perm)_ | skills.controller.ts:313 |
| PATCH | `/skills/user/:userId/skill/:skillId` | `@Permissions('skills:manage_matrix')` | skills.controller.ts:323-324 |

### 1.21 `tasks` — `tasks.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/tasks` | _authenticated (no perm)_ ⚠️ | tasks.controller.ts:47 |
| GET | `/tasks` | `@Permissions('tasks:read')` | tasks.controller.ts:72-73 |
| GET | `/tasks/assignee/:userId` | `@Permissions('tasks:read')` | tasks.controller.ts:129-130 |
| GET | `/tasks/project/:projectId` | `@Permissions('tasks:read')` | tasks.controller.ts:145-146 |
| GET | `/tasks/project/:projectId/export` | `@Permissions('tasks:read')` | tasks.controller.ts:160-161 |
| GET | `/tasks/orphans` | `@Permissions('tasks:read')` | tasks.controller.ts:177-178 |
| GET | `/tasks/:id` | `@Permissions('tasks:read')` | tasks.controller.ts:188-189 |
| PATCH | `/tasks/:id` | `@Permissions('tasks:update')` | tasks.controller.ts:203-204 |
| DELETE | `/tasks/:id` | _authenticated (no perm)_ ⚠️ | tasks.controller.ts:226 |
| POST | `/tasks/:id/dependencies` | `@Permissions('tasks:update')` | tasks.controller.ts:252-253 |
| DELETE | `/tasks/:taskId/dependencies/:dependsOnId` | `@Permissions('tasks:update')` | tasks.controller.ts:278-279 |
| POST | `/tasks/:id/raci` | `@Permissions('tasks:update')` | tasks.controller.ts:297-298 |
| DELETE | `/tasks/:taskId/raci/:userId/:role` | `@Permissions('tasks:update')` | tasks.controller.ts:321-322 |
| POST | `/tasks/project/:projectId/import/validate` | `@Permissions('tasks:create')` | tasks.controller.ts:341-342 |
| POST | `/tasks/project/:projectId/import` | `@Permissions('tasks:create')` | tasks.controller.ts:360-361 |
| GET | `/tasks/project/:projectId/import-template` | `@Permissions('tasks:read')` | tasks.controller.ts:379-380 |
| POST | `/tasks/:id/attach-project` | `@Permissions('tasks:update')` | tasks.controller.ts:392-393 |
| POST | `/tasks/:id/detach-project` | `@Permissions('tasks:update')` | tasks.controller.ts:410-411 |
| POST | `/tasks/:taskId/subtasks` | `@Permissions('tasks:update')` | tasks.controller.ts:429-430 |
| GET | `/tasks/:taskId/subtasks` | `@Permissions('tasks:read')` | tasks.controller.ts:440-441 |
| PATCH | `/tasks/:taskId/subtasks/:subtaskId` | `@Permissions('tasks:update')` | tasks.controller.ts:447-448 |
| DELETE | `/tasks/:taskId/subtasks/:subtaskId` | `@Permissions('tasks:update')` | tasks.controller.ts:458-459 |
| POST | `/tasks/:taskId/subtasks/reorder` | `@Permissions('tasks:update')` | tasks.controller.ts:468-469 |

### 1.22 `telework` — `telework.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/telework` | `@Permissions('telework:create')` | telework.controller.ts:38-39 |
| GET | `/telework` | `@Permissions('telework:read')` | telework.controller.ts:61-62 |
| GET | `/telework/me/week` | _authenticated (no perm)_ | telework.controller.ts:95 |
| GET | `/telework/me/stats` | _authenticated (no perm)_ | telework.controller.ts:111 |
| GET | `/telework/team/:date` | `@Permissions('telework:read_team')` | telework.controller.ts:126-127 |
| GET | `/telework/user/:userId/week` | `@Permissions('telework:read_team')` | telework.controller.ts:144-145 |
| GET | `/telework/user/:userId/stats` | `@Permissions('telework:read_team')` | telework.controller.ts:166-167 |
| GET | `/telework/:id` | `@Permissions('telework:read')` + bypass `telework:manage_others` | telework.controller.ts:188-190 |
| PATCH | `/telework/:id` | `@Permissions('telework:update')` + bypass | telework.controller.ts:208-210 |
| DELETE | `/telework/:id` | `@Permissions('telework:delete')` + bypass | telework.controller.ts:233-235 |
| GET | `/telework/recurring-rules` | `@Permissions('telework:read')` | telework.controller.ts:258-259 |
| POST | `/telework/recurring-rules` | `@Permissions('telework:create')` | telework.controller.ts:278-279 |
| PATCH | `/telework/recurring-rules/:id` | `@Permissions('telework:update')` | telework.controller.ts:295-296 |
| DELETE | `/telework/recurring-rules/:id` | `@Permissions('telework:delete')` | telework.controller.ts:309-310 |
| POST | `/telework/recurring-rules/generate` | `@Permissions('telework:create')` | telework.controller.ts:323-324 |

### 1.23 `third-parties`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/third-parties` | `@Permissions('third_parties:create')` | third-parties.controller.ts:33-34 |
| GET | `/third-parties` | `@Permissions('third_parties:read')` | third-parties.controller.ts:45-46 |
| GET | `/third-parties/:id` | `@Permissions('third_parties:read')` | third-parties.controller.ts:52-53 |
| GET | `/third-parties/:id/deletion-impact` | `@Permissions('third_parties:delete')` | third-parties.controller.ts:60-61 |
| PATCH | `/third-parties/:id` | `@Permissions('third_parties:update')` | third-parties.controller.ts:70-71 |
| DELETE | `/third-parties/:id` | `@Permissions('third_parties:delete')` | third-parties.controller.ts:81-82 |
| GET | `/projects/:projectId/third-party-members` | `@Permissions('third_parties:read')` | projects-third-party-members.controller.ts:29-30 |
| POST | `/projects/:projectId/third-party-members` | `@Permissions('third_parties:assign_to_project')` | projects-third-party-members.controller.ts:36-37 |
| DELETE | `/projects/:projectId/third-party-members/:thirdPartyId` | `@Permissions('third_parties:assign_to_project')` | projects-third-party-members.controller.ts:55-56 |
| GET | `/tasks/:taskId/third-party-assignees` | `@Permissions('third_parties:read')` | tasks-third-party-assignees.controller.ts:29-30 |
| POST | `/tasks/:taskId/third-party-assignees` | `@Permissions('third_parties:assign_to_task')` | tasks-third-party-assignees.controller.ts:36-37 |
| DELETE | `/tasks/:taskId/third-party-assignees/:thirdPartyId` | `@Permissions('third_parties:assign_to_task')` | tasks-third-party-assignees.controller.ts:54-55 |

### 1.24 `time-tracking` — `time-tracking.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/time-tracking` | `@Permissions('time_tracking:create')` | time-tracking.controller.ts:39-40 |
| GET | `/time-tracking` | _authenticated (no perm)_ (+ runtime `time_tracking:view_any` pour cross-user) | time-tracking.controller.ts:61 |
| GET | `/time-tracking/me` | _authenticated (no perm)_ | time-tracking.controller.ts:107 |
| GET | `/time-tracking/me/report` | _authenticated (no perm)_ | time-tracking.controller.ts:123 |
| GET | `/time-tracking/user/:userId/report` | `@Permissions('time_tracking:read_reports')` | time-tracking.controller.ts:139-140 |
| GET | `/time-tracking/project/:projectId/report` | `@Permissions('time_tracking:read_reports')` | time-tracking.controller.ts:163-164 |
| GET | `/time-tracking/:id` | _authenticated (no perm)_ | time-tracking.controller.ts:191 |
| PATCH | `/time-tracking/:id` | `@Permissions('time_tracking:update')` + bypass `time_tracking:manage_any` | time-tracking.controller.ts:208-214 |
| DELETE | `/time-tracking/:id` | `@Permissions('time_tracking:delete')` + bypass | time-tracking.controller.ts:237-243 |

### 1.25 `users` — `users.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| POST | `/users` | `@Permissions('users:create')` | users.controller.ts:46-47 |
| POST | `/users/import/validate` | `@Permissions('users:import')` | users.controller.ts:67-68 |
| POST | `/users/import` | `@Permissions('users:import')` | users.controller.ts:89-90 |
| GET | `/users` | `@Permissions('users:read')` | users.controller.ts:110-111 |
| GET | `/users/import/template` | `@Permissions('users:import')` | users.controller.ts:130-131 |
| GET | `/users/presence` | `@Permissions('users:read')` | users.controller.ts:143-144 |
| GET | `/users/department/:departmentId` | `@Permissions('users:read')` | users.controller.ts:162-163 |
| GET | `/users/service/:serviceId` | `@Permissions('users:read')` | users.controller.ts:175-176 |
| GET | `/users/role/:role` | `@Permissions('users:read')` | users.controller.ts:186-187 |
| GET | `/users/:id` | `@Permissions('users:read')` | users.controller.ts:197-198 |
| POST | `/users/me/avatar` | _authenticated (no perm)_ | users.controller.ts:212 |
| PATCH | `/users/me/avatar/preset` | _authenticated (no perm)_ | users.controller.ts:231 |
| DELETE | `/users/me/avatar` | _authenticated (no perm)_ | users.controller.ts:242 |
| PATCH | `/users/me/change-password` | _authenticated (no perm)_ | users.controller.ts:250 |
| PATCH | `/users/:id` | `@Permissions('users:update')` | users.controller.ts:268-269 |
| DELETE | `/users/:id` | `@Permissions('users:delete')` | users.controller.ts:293-294 |
| GET | `/users/:id/dependencies` | `@Permissions('users:delete')` | users.controller.ts:311-312 |
| DELETE | `/users/:id/hard` | `@Permissions('users:delete')` | users.controller.ts:329-330 |
| POST | `/users/:id/reset-password` | `@Permissions('users:manage_roles')` | users.controller.ts:354-355 |

### 1.26 Racine — `app.controller.ts`

| METHOD | PATH | Protection | fichier:ligne |
|---|---|---|---|
| GET | `/` | _authenticated (no perm)_ | app.controller.ts:6 |
| GET | `/health` | `@Public()` | app.controller.ts:24-25 |

---

## 2. Inventaire front — appels `hasPermission`

Aucun pattern dynamique `hasPermission(\`${module}:${action}\`)` n'a été trouvé (0 match) — tous les appels sont littéraux.

| Code | Fichier:ligne | Contexte |
|---|---|---|
| `projects:read` | MainLayout.tsx:33 | navigation sidebar |
| `tasks:read` | MainLayout.tsx:35 | navigation |
| `events:read` | MainLayout.tsx:36 | navigation |
| `time_tracking:read` | MainLayout.tsx:38 | navigation |
| `leaves:read` | MainLayout.tsx:39 | navigation |
| `telework:read` | MainLayout.tsx:40 | navigation |
| `reports:view` | MainLayout.tsx:48 | navigation admin |
| `users:manage` | MainLayout.tsx:54 | navigation admin — **n'existe pas côté back** |
| `departments:read` | MainLayout.tsx:60 | navigation admin |
| `skills:read` | MainLayout.tsx:66 | navigation admin |
| `third_parties:read` | MainLayout.tsx:72 | navigation admin |
| `users:manage_roles` | MainLayout.tsx:88 | variable `isAdmin` |
| `users:read` | PresenceDialog.tsx:99 | gate modal |
| `predefined_tasks:view` | AssignmentModal.tsx:64 | gate modal |
| `predefined_tasks:manage` | AssignmentModal.tsx:250 | **n'existe pas côté back** |
| `predefined_tasks:create` | AssignmentModal.tsx:300 | conditionnel UI |
| `users:read` | RecurringRulesModal.tsx:89 | gate |
| `tasks:assign_any_user` | TaskForm.tsx:297 | capability |
| `projects:read` | EventCreateModal.tsx:68 / TaskCreateModal.tsx:49 | préchargement |
| `events:readAll` | EventCreateModal.tsx:70 / events/page.tsx:66 | filtre lecture |
| `events:update` | EventCreateModal.tsx:83 / events/page.tsx:96 | capability |
| `tasks:readAll` | TaskCreateModal.tsx:51 / tasks/page.tsx:72,97 | filtre |
| `tasks:update` | TaskCreateModal.tsx:65 / tasks/[id]/page.tsx:400 / tasks/page.tsx:127 | capability |
| `third_parties:assign_to_task` | TaskModal.tsx:105 / TaskCreateModal.tsx:129 / tasks/page.tsx:786 | prop enable |
| `telework:read_team` | PlanningView.tsx:127 | permission |
| `telework:manage_others` | PlanningGrid.tsx:207 / telework/page.tsx:380 | capability |
| `predefined_tasks:assign` | PlanningGrid.tsx:208 | capability |
| `third_parties:create` / `:update` / `:delete` | third-parties/page.tsx:36-38, [id]/page.tsx:32-33 | variables |
| `leaves:read` (renommée `isAdmin`) | leaves/page.tsx:101 | — |
| `leaves:approve` / `leaves:manage` / `leaves:declare_for_others` | leaves/page.tsx:102-105 | capabilities |
| `users:read` | telework/page.tsx:393 / events/page.tsx:96 / tasks/page.tsx:127 / PresenceDialog / RecurringRules / EventCreate / TaskCreate | capabilities |
| `events:create` / `events:delete` | events/page.tsx:279, 283 | boutons |
| `projects:create` | projects/page.tsx:274 | bouton |
| `projects:update` / `projects:delete` | projects/[id]/page.tsx:882, 884 | capabilities |
| `third_parties:assign_to_project` / `third_parties:read` | projects/[id]/page.tsx:886-887 | capabilities |
| `skills:manage_matrix` | skills/page.tsx:57 | capability |
| `reports:view` / `reports:export` | reports/page.tsx:44-45 | gate + capability |
| `predefined_tasks:view` / `:create` | admin/predefined-tasks/page.tsx:90-91 | gate + capability |
| `users:create` / `users:update` / `users:reset_password` / `users:delete` | users/page.tsx:89-91, 683 | capabilities |
| `time_tracking:declare_for_third_party` | time-tracking/page.tsx:46 | capability |
| `settings:update` (renommée `isAdmin`) | settings/page.tsx:68 | — |
| `departments:create` (renommée `isAdmin`) | departments/page.tsx:51 | — |

---

## 3. Mapping permission → endpoints (119 entrées)

| Permission | Endpoints back | Usages front |
|---|---|---|
| `analytics:export` | — | — |
| `analytics:read` | — | — |
| `comments:create` | POST /comments | — |
| `comments:delete` | DELETE /comments/:id | — |
| `comments:read` | — | — |
| `comments:update` | PATCH /comments/:id | — |
| `departments:create` | POST /departments | departments/page.tsx |
| `departments:delete` | DELETE /departments/:id | — |
| `departments:edit` | — | — |
| `departments:read` | GET /departments ; GET /departments/:id ; GET /departments/:id/stats | MainLayout.tsx |
| `departments:update` | PATCH /departments/:id | — |
| `departments:view` | — | — |
| `documents:create` | POST /documents | — |
| `documents:delete` | DELETE /documents/:id | — |
| `documents:read` | GET /documents ; GET /documents/:id | — |
| `documents:update` | PATCH /documents/:id | — |
| `epics:create` | POST /epics | — |
| `epics:delete` | DELETE /epics/:id | — |
| `epics:read` | — | — |
| `epics:update` | PATCH /epics/:id | — |
| `events:create` | POST /events | events/page.tsx |
| `events:delete` | DELETE /events/:id ; DELETE /events/:id/recurrence | events/page.tsx |
| `events:manage_any` | — (bypass OwnershipGuard uniquement, 5 endpoints events) | — |
| `events:read` | GET /events ; GET /events/range ; GET /events/user/:userId ; GET /events/:id | MainLayout.tsx |
| `events:readAll` | — (filtrage scope dans `events.service.ts:25,238,610`) | EventCreateModal.tsx, events/page.tsx |
| `events:update` | PATCH /events/:id ; POST /events/:id/participants ; DELETE /events/:eventId/participants/:userId | EventCreateModal.tsx, events/page.tsx |
| `holidays:create` | POST /holidays ; POST /holidays/import-french | — |
| `holidays:delete` | DELETE /holidays/:id | — |
| `holidays:read` | — | — |
| `holidays:update` | PATCH /holidays/:id | — |
| `leaves:approve` | GET /leaves/pending-validation ; POST /leaves/:id/approve ; POST /leaves/:id/reject ; POST /leaves/:id/reject-cancellation | leaves/page.tsx |
| `leaves:create` | POST /leaves/import/validate ; POST /leaves/import | — |
| `leaves:declare_for_others` | — (check runtime `leaves.service.ts:236`) | leaves/page.tsx |
| `leaves:delete` | POST /leaves/:id/cancel ; DELETE /leave-types/:id | — |
| `leaves:manage` | GET /leaves/balances ; GET /leaves/balances/defaults ; POST /leaves/balances ; DELETE /leaves/balances/:id | leaves/page.tsx |
| `leaves:manage_any` | — (constante interne `MANAGE_ANY_LEAVES` dans `leaves.service.ts:20`) | — |
| `leaves:manage_delegations` | POST /leaves/delegations | — |
| `leaves:read` | GET /leaves ; GET /leaves/import-template ; GET /leaves/balance/:userId ; GET /leaves/subordinates ; GET /leaves/:id | MainLayout.tsx, leaves/page.tsx |
| `leaves:readAll` | — (scope bypass uniquement) | — |
| `leaves:update` | POST /leave-types ; PATCH /leave-types/:id ; POST /leave-types/reorder | — |
| `leaves:view` | — | — |
| `milestones:create` | POST /milestones ; POST /milestones/project/:projectId/import/validate ; POST /milestones/project/:projectId/import | — |
| `milestones:delete` | DELETE /milestones/:id | — |
| `milestones:read` | — | — |
| `milestones:update` | PATCH /milestones/:id ; POST /milestones/:id/complete | — |
| `predefined_tasks:assign` | 9 endpoints predefined-tasks (assignments + recurring-rules) | PlanningGrid.tsx |
| `predefined_tasks:create` | POST /predefined-tasks | AssignmentModal.tsx, admin/predefined-tasks/page.tsx |
| `predefined_tasks:delete` | DELETE /predefined-tasks/:id | — |
| `predefined_tasks:edit` | PATCH /predefined-tasks/:id | — |
| `predefined_tasks:view` | GET /predefined-tasks ; GET /predefined-tasks/assignments | AssignmentModal.tsx, admin/predefined-tasks/page.tsx |
| `projects:create` | POST /projects | projects/page.tsx |
| `projects:delete` | DELETE /projects/:id ; DELETE /projects/:id/hard | projects/[id]/page.tsx |
| `projects:edit` | — | — |
| `projects:manage_any` | — (bypass sur 6 endpoints projects) | — |
| `projects:manage_members` | POST /projects/:id/members ; PATCH /projects/:projectId/members/:userId ; DELETE /projects/:projectId/members/:userId | — |
| `projects:read` | GET /projects ; GET /projects/user/:userId ; GET /projects/:id ; GET /projects/:id/stats | MainLayout + 7 fichiers front |
| `projects:update` | PATCH /projects/:id | projects/[id]/page.tsx |
| `projects:view` | — | — |
| `reports:export` | GET /analytics/export | reports/page.tsx |
| `reports:view` | GET /analytics ; GET /projects/:id/snapshots | MainLayout.tsx, reports/page.tsx |
| `school_vacations:create` | POST /school-vacations ; POST /school-vacations/import | — |
| `school_vacations:delete` | DELETE /school-vacations/:id | — |
| `school_vacations:read` | — | — |
| `school_vacations:update` | PATCH /school-vacations/:id | — |
| `services:create` | POST /services | — |
| `services:delete` | DELETE /services/:id | — |
| `services:read` | — | — |
| `services:update` | PATCH /services/:id | — |
| `settings:read` | — | — |
| `settings:update` | PUT /settings/:key ; POST /settings/bulk ; POST /settings/:key/reset ; POST /settings/reset-all ; DELETE /settings/:key | settings/page.tsx |
| `skills:create` | POST /skills ; POST /skills/import/validate ; POST /skills/import | — |
| `skills:delete` | DELETE /skills/:id | — |
| `skills:edit` | — | — |
| `skills:manage_matrix` | GET /skills/matrix ; POST /skills/user/:userId/assign ; DELETE /skills/user/:userId/remove/:skillId ; PATCH /skills/user/:userId/skill/:skillId | skills/page.tsx |
| `skills:read` | 5 endpoints skills | MainLayout.tsx |
| `skills:update` | PATCH /skills/:id | — |
| `skills:view` | — | — |
| `tasks:assign_any_user` | — (check service `tasks.service.ts:104-105`) | TaskForm.tsx |
| `tasks:create` | POST /tasks/project/:projectId/import/validate ; POST /tasks/project/:projectId/import | tasks/page.tsx |
| `tasks:create_in_project` | — | tasks/page.tsx |
| `tasks:create_orphan` | — | tasks/page.tsx |
| `tasks:delete` | — | — |
| `tasks:manage_any` | — (check service `tasks.service.ts:547`) | — |
| `tasks:read` | 8 endpoints tasks | MainLayout.tsx |
| `tasks:readAll` | — (scope filter service) | tasks/page.tsx, TaskCreateModal.tsx |
| `tasks:update` | 11 endpoints tasks (update + subtasks + dependencies + raci + attach/detach) | TaskCreateModal + tasks/page.tsx + tasks/[id]/page.tsx |
| `telework:create` | POST /telework ; POST /telework/recurring-rules ; POST /telework/recurring-rules/generate | — |
| `telework:delete` | DELETE /telework/:id ; DELETE /telework/recurring-rules/:id | — |
| `telework:manage_others` | — (bypass sur 3 endpoints) | PlanningGrid.tsx, telework/page.tsx |
| `telework:manage_recurring` | — | — |
| `telework:read` | GET /telework ; GET /telework/:id ; GET /telework/recurring-rules | MainLayout.tsx |
| `telework:readAll` | — (scope filter) | — |
| `telework:read_team` | GET /telework/team/:date ; GET /telework/user/:userId/week ; GET /telework/user/:userId/stats | PlanningView.tsx |
| `telework:update` | PATCH /telework/:id ; PATCH /telework/recurring-rules/:id | — |
| `telework:view` | — | — |
| `third_parties:assign_to_project` | POST & DELETE /projects/:projectId/third-party-members | projects/[id]/page.tsx |
| `third_parties:assign_to_task` | POST & DELETE /tasks/:taskId/third-party-assignees | TaskModal, TaskCreateModal, tasks/page.tsx |
| `third_parties:create` | POST /third-parties | third-parties/page.tsx |
| `third_parties:delete` | GET /third-parties/:id/deletion-impact ; DELETE /third-parties/:id | third-parties/page.tsx, [id]/page.tsx |
| `third_parties:read` | GET /third-parties ; GET /third-parties/:id ; GET /projects/.../third-party-members ; GET /tasks/.../third-party-assignees | MainLayout.tsx, projects/[id]/page.tsx |
| `third_parties:update` | PATCH /third-parties/:id | third-parties/page.tsx, [id]/page.tsx |
| `time_tracking:create` | POST /time-tracking | — |
| `time_tracking:declare_for_third_party` | — | time-tracking/page.tsx |
| `time_tracking:delete` | DELETE /time-tracking/:id | — |
| `time_tracking:manage_any` | — (bypass PATCH/DELETE /time-tracking/:id) | — |
| `time_tracking:read` | — | MainLayout.tsx |
| `time_tracking:read_reports` | GET /time-tracking/user/:userId/report ; GET /time-tracking/project/:projectId/report | — |
| `time_tracking:update` | PATCH /time-tracking/:id | — |
| `time_tracking:view_any` | — (check runtime `time-tracking.service.ts:18`) | — |
| `users:create` | POST /users | users/page.tsx |
| `users:delete` | DELETE /users/:id ; GET /users/:id/dependencies ; DELETE /users/:id/hard | users/page.tsx |
| `users:edit` | — | — |
| `users:import` | POST /users/import/validate ; POST /users/import ; GET /users/import/template | — |
| `users:manage` | — | MainLayout.tsx |
| `users:manage_roles` | POST /users/:id/reset-password ; POST /role-management/reset-to-defaults | MainLayout.tsx |
| `users:read` | 7 endpoints users + GET /planning/overview | 7 fichiers front |
| `users:reset_password` | POST /auth/reset-password-token | users/page.tsx |
| `users:update` | PATCH /users/:id | users/page.tsx |
| `users:view` | — | — |

---

## 4. Permissions orphelines

### 4.1 Vraies orphelines (0 usage réel, ni back, ni front, ni service, ni bypass)

**21 permissions à supprimer candidates** :

| # | Permission | Preuve |
|---|---|---|
| 1 | `analytics:export` | Aucune occurrence hors catalogue + seed |
| 2 | `analytics:read` | idem |
| 3 | `comments:read` | Aucun `@Permissions`, aucun `hasPermission` |
| 4 | `departments:edit` | seed `role-management.service.ts:374` uniquement |
| 5 | `departments:view` | seed uniquement |
| 6 | `epics:read` | Aucun usage effectif |
| 7 | `holidays:read` | Aucun `@Permissions` sur `/holidays` GET |
| 8 | `leaves:view` | seed uniquement |
| 9 | `milestones:read` | Aucun `@Permissions` sur `/milestones` GET |
| 10 | `projects:edit` | seed uniquement |
| 11 | `projects:view` | seed uniquement |
| 12 | `school_vacations:read` | Aucun `@Permissions` sur `/school-vacations` GET |
| 13 | `services:read` | Aucun `@Permissions` sur `/services` GET |
| 14 | `settings:read` | Aucun `@Permissions` sur `/settings` GET |
| 15 | `skills:edit` | seed uniquement |
| 16 | `skills:view` | seed uniquement |
| 17 | `tasks:delete` | **seed uniquement**, DELETE `/tasks/:id` ne la vérifie pas |
| 18 | `telework:manage_recurring` | seed uniquement |
| 19 | `telework:view` | seed uniquement |
| 20 | `users:edit` | seed uniquement |
| 21 | `users:view` | seed uniquement |

### 4.2 Vérifiées uniquement via logique service (scope filter), pas via `@Permissions()`

**5 permissions à garder mais à surveiller** :

- `tasks:readAll` — `tasks.service.ts:296, 986`
- `leaves:readAll` — `leaves.service.ts:536`
- `telework:readAll` — `telework.service.ts:126`
- `events:readAll` — `events.service.ts:25, 238, 610`
- `leaves:manage_any` — `leaves.service.ts:20` (constante `MANAGE_ANY_LEAVES`)

À arbitrer Phase 1 : convention RBAC — `readAll` en scope-filter uniquement (status quo) ou migration vers `@Permissions()` déclaratif ?

---

## 5. Endpoints authentifiés sans `@Permissions` ni `@Roles`

Total : **~63 routes**. Segmentation :

### 5.1 Oublis de sécurité CRITIQUES (mutations sans check RBAC)

| Endpoint | Fichier:ligne | Risque |
|---|---|---|
| POST `/tasks` | tasks.controller.ts:47 | Création tâche sans check RBAC. Service vérifie `tasks:create_in_project`/`tasks:create_orphan` en runtime, mais pas de barrière déclarative. |
| DELETE `/tasks/:id` | tasks.controller.ts:226 | Permission `tasks:delete` existe en DB (9 rôles) mais **jamais vérifiée**. Protection repose uniquement sur le service. |
| POST `/leaves` | leaves.controller.ts:48 | Création congé sans check. Service vérifie `leaves:create` + logique service. |
| PATCH `/leaves/:id` | leaves.controller.ts:337 | Modification congé sans `@Permissions`, ownership deléguée au service. |
| DELETE `/leaves/:id` | leaves.controller.ts:367 | Suppression sans `@Permissions`. |
| DELETE `/leaves/delegations/:id` | leaves.controller.ts:614 | Aucune garantie RBAC. |

### 5.2 Oublis probables (lecture accessible à tout utilisateur loggué)

- GET `/comments`, `/comments/:id` (`comments:read` existe)
- GET `/epics`, `/epics/:id` (`epics:read` existe)
- GET `/holidays*` (5 routes, `holidays:read` existe)
- GET `/milestones`, `/milestones/:id`, `/milestones/project/:projectId/export`, `/milestones/project/:projectId/import-template` (`milestones:read` existe)
- GET `/school-vacations*` (3 routes, `school_vacations:read` existe)
- GET `/services*` (4 routes, `services:read` existe)
- GET `/settings*` (3 routes, `settings:read` existe)
- GET `/leave-types*` (3 routes — peut-être voulu ?)
- POST `/planning-export/ics/import/preview`, `/ics/import` (mutations sans garde)
- GET `/time-tracking/:id` (lecture unitaire gardée uniquement par le service)

### 5.3 Volontaires (self-service)

~30 routes `/me/*`, `/personal-todos/*`, `/skills/me/*`, `/telework/me/*`, `/time-tracking/me*`, `/users/me/*`, `/leaves/me`, `/leaves/:id/request-cancel`, `/auth/me*`, `/auth/profile`, `/auth/logout`. À confirmer cas par cas — ce sont des endpoints self-service légitimes où le contrôle ownership est implicite (userId = currentUser.id).

---

## 6. Incohérences front/back

### 6.1 Permissions vérifiées **au front, jamais au back** (trou de sécurité masqué par UI)

| Permission | Front | Back |
|---|---|---|
| `users:manage` | MainLayout.tsx:54 (visibilité item menu `users`) | **Aucune** — `/users` GET utilise `users:read` |
| `predefined_tasks:manage` | AssignmentModal.tsx:250 | **N'existe pas en DB** |
| `tasks:create_orphan` | tasks/page.tsx:294 | **Aucune** — `POST /tasks` sans `@Permissions` |
| `tasks:create_in_project` | tasks/page.tsx:295 | **Aucune** — idem |
| `tasks:create` | tasks/page.tsx:114, 293 | vérifiée uniquement sur `/tasks/project/:id/import*`, **pas** sur `POST /tasks` |
| `tasks:assign_any_user` | TaskForm.tsx:297 | Service seulement, pas de `@Permissions` déclaratif |
| `time_tracking:declare_for_third_party` | time-tracking/page.tsx:46 | **Aucune** sur `POST /time-tracking` |
| `leaves:declare_for_others` | leaves/page.tsx:105 | Service uniquement (runtime) |

### 6.2 Permissions vérifiées **au back, jamais au front** (UI aveugle → 403)

Couvertes côté back, aucun check front :
- `comments:*`, `documents:*`, `epics:*`, `holidays:*`, `milestones:*`, `school_vacations:*`, `services:*` (pages inexistantes ou non protégées)
- `telework:create`, `telework:update`, `telework:delete` (tout le CRUD telework en mutation)
- `time_tracking:create/update/delete`, `time_tracking:read_reports`
- `skills:create`, `skills:update`, `skills:delete` (CRUD réel ; le front ne check que `skills:manage_matrix`)
- `users:import` (bouton Import gate via `users:create` et non `users:import`)
- `leaves:create` (import CSV), `leaves:delete` (leave-types)
- `leaves:update` (sur leave-types)

### 6.3 Codes perm inexistants référencés (bugs)

| Code | Emplacement | Impact |
|---|---|---|
| `admin:access` | `projects.controller.ts:88` (`@Permissions`) | `POST /projects/snapshots/capture` refusé à tous — **endpoint mort** |
| `leaves:validate` | `leaves.controller.ts:292` (check runtime) | Le check teste `permissions.includes('leaves:validate')` → toujours false → route bloquée pour rôles légitimes |
| `predefined_tasks:manage` | `AssignmentModal.tsx:250` | Lien « Configurer » masqué pour tous sauf ADMIN (bypass hook) |
| `documents:manage_any` | `documents.controller.ts:73, 85` (`bypassPermission`) | Permission absente du catalogue → bypass impossible, tout utilisateur tombe sur `isOwner` |

### 6.4 Permissions identiquement nommées mais sémantiquement mal câblées

- `leaves/page.tsx:101` : `const isAdmin = hasPermission("leaves:read")` — tous les 15 rôles ont `leaves:read` → `isAdmin` toujours `true` → la logique de branche admin est inefficace.
- `departments/page.tsx:51` : `const isAdmin = hasPermission("departments:create")` — nommage trompeur.
- `users/page.tsx` : pas de variable `isAdmin` cohérente ; `canManageUsers = hasPermission("users:create")` etc.

---

## 7. Doublons sémantiques — à supprimer

**10 paires `:view` vs `:read` et `:edit` vs `:update`** sont toutes strictement mortes côté variante `:view`/`:edit` :

| Paire | Variante consultée | Variante morte |
|---|---|---|
| `departments:edit` vs `departments:update` | `:update` | `:edit` (seed uniquement) |
| `departments:view` vs `departments:read` | `:read` | `:view` (seed) |
| `projects:edit` vs `projects:update` | `:update` | `:edit` (seed) |
| `projects:view` vs `projects:read` | `:read` | `:view` (seed) |
| `skills:edit` vs `skills:update` | `:update` | `:edit` (seed) |
| `skills:view` vs `skills:read` | `:read` | `:view` (seed) |
| `users:edit` vs `users:update` | `:update` | `:edit` (seed) |
| `users:view` vs `users:read` | `:read` | `:view` (seed) |
| `leaves:view` vs `leaves:read` | `:read` | `:view` (seed) |
| `telework:view` vs `telework:read` | `:read` | `:view` (seed) |

**Candidat à supprimer en Phase 2** : les 10 variantes `:view` / `:edit`. Passage 119 → 109 permissions.

Autre doublon à clarifier : **`analytics:*` vs `reports:*`** — les deux modules existent dans le catalogue mais seul `reports:*` est utilisé côté code (back et front). `analytics:read`/`analytics:export` sont orphelines.

**Bypass permissions** (`*:manage_any`, `telework:manage_others`) ne sont pas des doublons stricto sensu mais leur sémantique pourrait être harmonisée (`telework:manage_any` pour cohérence ?).

---

## 8. Incertitudes / points à vérifier

1. **`admin:access`** (projects.controller.ts:88) — bug ou permission à créer ?
2. **`leaves:validate`** (leaves.controller.ts:292 runtime) — typo pour `leaves:approve` ?
3. **`documents:manage_any`** — à créer ou à remplacer par un bypass existant (ex. `documents:delete` ?).
4. **`predefined_tasks:manage`** (AssignmentModal.tsx:250) — typo pour `predefined_tasks:edit` ou `:create` ?
5. **Routes self-service** — lister les endpoints `/me/*` à laisser sans `@Permissions` (décision explicite à formaliser).
6. **`POST /tasks`** et **`DELETE /tasks/:id`** — convention à trancher : `@Permissions` déclaratif ou logique service uniquement ?
7. **Scope filter `*:readAll`** — migrer en `@Permissions()` ou garder en service-side ?
8. **`permissions.guard.ts` fail-open** — inversion possible en zero-trust (toute route doit explicitement `@Public()` ou `@Permissions()`).
9. **`telework:manage_recurring`** : permission au catalogue, attribuée à 4 rôles, mais **jamais vérifiée** dans les endpoints `/telework/recurring-rules*` (qui utilisent `telework:create/update/delete/read`). À supprimer ou à câbler.
10. **Tests** : les `spec.ts` et `test.ts` contiennent des littéraux permission qui n'ont pas été comptés comme usages réels.
