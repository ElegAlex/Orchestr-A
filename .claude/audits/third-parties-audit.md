# Audit factuel — Third Parties & Time Entry

Mode : read-only. Aucun fichier modifié hors ce rapport. Toutes les citations référencent le repo `ORCHESTRA` à son état actuel.

---

## 1. Modèle `TimeEntry` actuel

### 1.1 Bloc Prisma intégral

Source : `packages/database/prisma/schema.prisma:395-413`

```prisma
model TimeEntry {
  id            String       @id @default(uuid())
  userId        String
  projectId     String?
  taskId        String?
  date          DateTime     @db.Date
  hours         Float
  description   String?
  activityType  ActivityType
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  // Relations
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  project       Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)
  task          Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@map("time_entries")
}
```

Enum associé `ActivityType` : `DEVELOPMENT`, `MEETING`, `SUPPORT`, `TRAINING`, `OTHER` [schema.prisma:415-421].

### 1.2 Nullabilité des champs

| Champ          | Type                | Nullable ? |
| -------------- | ------------------- | ---------- |
| `id`           | `String`            | non        |
| `userId`       | `String`            | **non**    |
| `projectId`    | `String?`           | oui        |
| `taskId`       | `String?`           | oui        |
| `date`         | `DateTime @db.Date` | non        |
| `hours`        | `Float`             | non        |
| `description`  | `String?`           | oui        |
| `activityType` | `ActivityType`      | non        |
| `createdAt`    | `DateTime`          | non        |
| `updatedAt`    | `DateTime`          | non        |

### 1.3 Foreign keys et `onDelete`

- `user` → `User.id`, `onDelete: Cascade` [schema.prisma:408]
- `project` → `Project.id`, `onDelete: SetNull` [schema.prisma:409]
- `task` → `Task.id`, `onDelete: SetNull` [schema.prisma:410]

### 1.4 Index et contraintes

- Aucun `@@index` ou `@@unique` déclaré sur `TimeEntry` [schema.prisma:395-413].
- Seul `@@map("time_entries")` est présent.

### 1.5 Fichiers TS référençant `prisma.timeEntry` / `TimeEntry` dans `apps/api/src`

Résultat de recherche sur le pattern `prisma\.timeEntry|TimeEntry` (via Grep, fichiers .ts) :

- `apps/api/src/analytics/analytics.service.ts`
- `apps/api/src/projects/projects.service.ts`
- `apps/api/src/time-tracking/time-tracking.service.ts`
- `apps/api/src/time-tracking/time-tracking.controller.ts`
- `apps/api/src/time-tracking/time-tracking.controller.spec.ts`
- `apps/api/src/time-tracking/time-tracking.service.spec.ts`
- `apps/api/src/time-tracking/dto/create-time-entry.dto.ts`
- `apps/api/src/time-tracking/dto/update-time-entry.dto.ts`

Les fichiers tests .spec.ts de `analytics` référencent également `mockPrismaService.timeEntry.groupBy` (30+ occurrences dans `apps/api/src/analytics/analytics.service.spec.ts`).

Hors `apps/api/src`, le modèle est référencé dans `packages/database/prisma/seed.ts` et `packages/database/prisma/schema.prisma`. Aucune référence trouvée dans `apps/api/src/planning-export/**` ni `apps/api/src/telework/**`.

---

## 2. Module `time-tracking` actuel

### 2.1 Arborescence `apps/api/src/time-tracking/`

```
dto/
  create-time-entry.dto.ts
  update-time-entry.dto.ts
time-tracking.controller.spec.ts
time-tracking.controller.ts        (223 lignes)
time-tracking.module.ts
time-tracking.service.spec.ts
time-tracking.service.ts           (549 lignes)
```

### 2.2 Méthodes publiques du `TimeTrackingService`

Source : `apps/api/src/time-tracking/time-tracking.service.ts`

- `create(userId: string, createTimeEntryDto: CreateTimeEntryDto)` [time-tracking.service.ts:18]
- `findAll(page, limit, userId?, projectId?, taskId?, startDate?, endDate?)` [time-tracking.service.ts:104]
- `findOne(id: string)` [time-tracking.service.ts:179]
- `update(id: string, updateTimeEntryDto: UpdateTimeEntryDto)` [time-tracking.service.ts:218]
- `remove(id: string)` [time-tracking.service.ts:288]
- `getUserEntries(userId: string, startDate?: string, endDate?: string)` [time-tracking.service.ts:307]
- `getUserReport(userId: string, startDate: string, endDate: string)` [time-tracking.service.ts:363]
- `getProjectReport(projectId: string, startDate?: string, endDate?: string)` [time-tracking.service.ts:460]

Observations factuelles :

- `create` exige `taskId` OU `projectId` (`BadRequestException` sinon) [time-tracking.service.ts:59-63].
- `create` force `userId` à être l'utilisateur courant ; aucun champ « declaredBy » ni « forUserId » [time-tracking.service.ts:18, 65-73].
- Aucune méthode ne référence de tiers ; toutes les requêtes `include` ou `where` utilisent `userId` (scalar direct).

### 2.3 DTOs existants

`CreateTimeEntryDto` [apps/api/src/time-tracking/dto/create-time-entry.dto.ts:14-74] :

| Champ          | Type           | Validators                                            | Obligatoire |
| -------------- | -------------- | ----------------------------------------------------- | ----------- |
| `date`         | `string`       | `@IsDateString()` `@IsNotEmpty()`                     | oui         |
| `hours`        | `number`       | `@IsNumber()` `@Min(0.25)` `@Max(24)` `@IsNotEmpty()` | oui         |
| `activityType` | `ActivityType` | `@IsEnum(ActivityType)` `@IsNotEmpty()`               | oui         |
| `taskId`       | `string`       | `@IsUUID()` `@IsOptional()`                           | non         |
| `projectId`    | `string`       | `@IsUUID()` `@IsOptional()`                           | non         |
| `description`  | `string`       | `@IsString()` `@IsOptional()`                         | non         |

`UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto)` [apps/api/src/time-tracking/dto/update-time-entry.dto.ts:3].

Aucun champ relatif à un tiers ou à un déclarant.

### 2.4 Endpoints exposés par `TimeTrackingController`

Source : `apps/api/src/time-tracking/time-tracking.controller.ts`

Toutes les routes sont préfixées par `@Controller('time-tracking')` [line 29] et `@ApiBearerAuth()` [line 30]. Aucun `@UseGuards` spécifique : dépend du guard global (non vérifié dans ce fichier).

| Méthode | Route                                      | Décorateurs permissions                      | Ligne   |
| ------- | ------------------------------------------ | -------------------------------------------- | ------- |
| POST    | `/time-tracking`                           | `@Permissions('time_tracking:create')`       | 34-35   |
| GET     | `/time-tracking`                           | _(aucun `@Permissions`)_                     | 56      |
| GET     | `/time-tracking/me`                        | _(aucun `@Permissions`)_                     | 92      |
| GET     | `/time-tracking/me/report`                 | _(aucun `@Permissions`)_                     | 108     |
| GET     | `/time-tracking/user/:userId/report`       | `@Permissions('time_tracking:read_reports')` | 124-125 |
| GET     | `/time-tracking/project/:projectId/report` | `@Permissions('time_tracking:read_reports')` | 148-149 |
| GET     | `/time-tracking/:id`                       | _(aucun `@Permissions`)_                     | 176     |
| PATCH   | `/time-tracking/:id`                       | `@Permissions('time_tracking:update')`       | 190-191 |
| DELETE  | `/time-tracking/:id`                       | `@Permissions('time_tracking:delete')`       | 208-209 |

Fait brut : les 4 endpoints GET (`findAll`, `getMyEntries`, `getMyReport`, `findOne`) ne portent aucun `@Permissions`. Le `PermissionsGuard` laisse passer si aucune permission requise [apps/api/src/auth/guards/permissions.guard.ts:25-27].

---

## 3. Modèle d'assignation Task et Project

### 3.1 `model Project` intégral

Source : `packages/database/prisma/schema.prisma:145-177`

```prisma
model Project {
  id            String        @id @default(uuid())
  name          String
  description   String?
  status        ProjectStatus @default(DRAFT)
  priority      Priority      @default(NORMAL)
  startDate     DateTime?
  endDate       DateTime?
  budgetHours     Int?
  icon            String?
  hiddenStatuses  TaskStatus[]  @default([])
  visibleStatuses String[]      @default([])
  createdById   String?
  managerId     String?
  sponsorId     String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Relations
  createdBy     User?           @relation("ProjectCreator", fields: [createdById], references: [id], onDelete: SetNull)
  manager       User?           @relation("ProjectManager", fields: [managerId], references: [id], onDelete: SetNull)
  sponsor       User?           @relation("ProjectSponsor", fields: [sponsorId], references: [id], onDelete: SetNull)
  members       ProjectMember[]
  epics         Epic[]
  milestones    Milestone[]
  tasks         Task[]
  documents     Document[]
  timeEntries   TimeEntry[]
  events        Event[]
  snapshots     ProjectSnapshot[]

  @@map("projects")
}
```

### 3.2 `model Task` intégral

Source : `packages/database/prisma/schema.prisma:269-306`

```prisma
model Task {
  id                      String     @id @default(uuid())
  title                   String
  description             String?
  status                  TaskStatus @default(TODO)
  priority                Priority   @default(NORMAL)
  projectId               String?    // Nullable pour permettre les tâches orphelines (réunions, tâches transverses)
  epicId                  String?
  milestoneId             String?
  assigneeId              String?    // Assigné principal (rétrocompatibilité)
  estimatedHours          Float?
  progress                Int        @default(0) // 0-100%
  startDate               DateTime?
  endDate                 DateTime?
  startTime               String?    // Horaire de début optionnel (format HH:MM)
  endTime                 String?    // Horaire de fin optionnel (format HH:MM)
  isExternalIntervention  Boolean    @default(false)
  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt

  // Relations
  project         Project?         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  epic            Epic?            @relation(fields: [epicId], references: [id], onDelete: SetNull)
  milestone       Milestone?       @relation(fields: [milestoneId], references: [id], onDelete: SetNull)
  assignee        User?            @relation(fields: [assigneeId], references: [id], onDelete: SetNull)
  assignees       TaskAssignee[]   // Relation many-to-many pour multiple assignés
  dependencies    TaskDependency[] @relation("TaskDependencies")
  dependents      TaskDependency[] @relation("DependentTasks")
  timeEntries     TimeEntry[]
  comments        Comment[]
  raci            TaskRACI[]
  subtasks        Subtask[]

  @@index([projectId])
  @@index([assigneeId])
  @@index([status])
  @@map("tasks")
}
```

### 3.3 `ProjectMember` et `TaskAssignee`

Source : `packages/database/prisma/schema.prisma:201-217`

```prisma
model ProjectMember {
  id            String   @id @default(uuid())
  projectId     String
  userId        String
  role          String   // Chef de projet, Membre, Observateur...
  allocation    Int?     // Pourcentage d'allocation (0-100)
  startDate     DateTime?
  endDate       DateTime?
  createdAt     DateTime @default(now())

  // Relations
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@map("project_members")
}
```

Source : `packages/database/prisma/schema.prisma:309-323`

```prisma
model TaskAssignee {
  id        String   @id @default(uuid())
  taskId    String
  userId    String
  createdAt DateTime @default(now())

  // Relations
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId])
  @@index([taskId])
  @@index([userId])
  @@map("task_assignees")
}
```

Fait : `TaskAssignee.userId` est non nullable et en FK `Cascade` vers `User`. Aucun champ « tiers ».

### 3.4 Usage de `TaskAssignee` dans `apps/api/src/tasks/tasks.service.ts`

Lignes contenant `taskAssignee` ou `assignees:` (via Grep) :

- L.212 — bloc `include { assignees: { … } }` dans une query read
- L.244 — idem
- L.294 — filtre `where` : `{ assignees: { some: { userId: currentUser.id } } }`
- L.349 — `include`
- L.427 — `include`
- L.623 — `tx.taskAssignee.deleteMany({ where: { taskId: id } })`
- L.628 — `tx.taskAssignee.createMany({ data: assigneeIds.map((userId) => ({ taskId: id, userId })) })`
- L.665 — `include`
- L.692 — `include assignees: true`
- L.710 — filtre JS : `task.assignees.some((a) => a.userId === user.id)`
- L.933 — `where: { OR: [{ assigneeId: userId }, { assignees: { some: { userId } } }] }`
- L.950 — `include`
- L.1002 — `include`
- L.1478 — `include`

Fait : la mise à jour des assignés est effectuée via `delete-all + create-all` dans une transaction [tasks.service.ts:618-631]. Aucun champ de type « thirdParty » présent dans aucune de ces requêtes.

---

## 4. RBAC dynamique

### 4.1 Module dédié

Commande `find apps/api/src -type d -iname "*rbac*" -o -iname "*permission*" -o -iname "*role*"` → un seul hit :

- `apps/api/src/role-management/` contenant `role-management.controller.ts` (178 lignes), `role-management.service.ts` (1283 lignes), `role-management.module.ts`, `dto/`.

Les décorateurs/guards de permissions vivent dans `apps/api/src/auth/` :

- `apps/api/src/auth/decorators/permissions.decorator.ts`
- `apps/api/src/auth/decorators/roles.decorator.ts`
- `apps/api/src/auth/guards/permissions.guard.ts`
- `apps/api/src/auth/guards/roles.guard.ts`

### 4.2 Modèles Prisma RBAC

Source : `packages/database/prisma/schema.prisma:918-950`

```prisma
model Permission {
  id          String   @id @default(uuid())
  code        String   @unique
  module      String
  action      String
  description String?
  rolePermissions RolePermission[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("permissions")
}

model RoleConfig {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  description String?
  isSystem    Boolean  @default(false)
  isDefault   Boolean  @default(false)
  permissions RolePermission[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("role_configs")
}

model RolePermission {
  roleConfigId String
  roleConfig   RoleConfig @relation(fields: [roleConfigId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleConfigId, permissionId])
  @@map("role_permissions")
}
```

Tables : `permissions`, `role_configs`, `role_permissions`.

### 4.3 Déclaration d'une permission

Via seed Prisma. Fichier : `packages/database/prisma/seed.ts` (2964 lignes au total).

Bloc permissions : `seed.ts:1304-1960`. Upsert idempotent :

```ts
// seed.ts:1962-1973
const permissionsMap = new Map<string, string>();
for (const perm of permissionsData) {
  const permission = await prisma.permission.upsert({
    where: { code: perm.code },
    update: { description: perm.description },
    create: perm,
  });
  permissionsMap.set(perm.code, permission.id);
}
console.log(`✅ ${permissionsData.length} permissions upserted`);
```

Idempotent confirmé : `upsert` sur `code` (unique). Les rôles aussi sont idempotents : ils ne suppriment pas les permissions déjà en BDD si le rôle existe ; ils diffèrent (`toAdd` / `toRemove`) [seed.ts:2581-2638].

Exemple de 3 permissions existantes [seed.ts:1308-1325] :

```ts
{
  code: "projects:create",
  module: "projects",
  action: "create",
  description: "Créer un projet",
},
{
  code: "projects:read",
  module: "projects",
  action: "read",
  description: "Voir les projets",
},
{
  code: "projects:update",
  module: "projects",
  action: "update",
  description: "Modifier un projet",
},
```

### 4.4 Guard et décorateur

Décorateur `@Permissions(...codes)` [apps/api/src/auth/decorators/permissions.decorator.ts:1-6] :

```ts
import { SetMetadata } from "@nestjs/common";
export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

Guard [apps/api/src/auth/guards/permissions.guard.ts:1-43] :

```ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private roleManagementService: RoleManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || !user.role) {
      return false;
    }
    const userPermissions =
      await this.roleManagementService.getPermissionsForRole(user.role);
    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}
```

Exemple d'usage réel dans un controller [apps/api/src/time-tracking/time-tracking.controller.ts:34-35] :

```ts
@Post()
@Permissions('time_tracking:create')
```

Autre exemple [apps/api/src/analytics/analytics.controller.ts:16-17] :

```ts
@Get()
@Permissions('reports:view')
```

### 4.5 Chargement des permissions (service)

Méthode `getPermissionsForRole(roleCode)` [apps/api/src/role-management/role-management.service.ts:1219-1270] :

```ts
async getPermissionsForRole(roleCode: string): Promise<string[]> {
  const cacheKey = `role-permissions:${roleCode}`;
  try {
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const cachedPermissions = JSON.parse(cached);
      this.logger.debug(`[RBAC] ${roleCode}: ${cachedPermissions.length} permissions (source: cache)`);
      return cachedPermissions;
    }
  } catch (error) {
    console.warn('Redis cache read error:', error);
  }
  const role = await this.prisma.roleConfig.findUnique({
    where: { code: roleCode },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) { return []; }
  const permissionCodes = role.permissions.map((rp) => rp.permission.code);
  this.logger.debug(`[RBAC] ${roleCode}: ${permissionCodes.length} permissions (source: db)`);
  try {
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(permissionCodes));
  } catch (error) {
    console.warn('Redis cache write error:', error);
  }
  return permissionCodes;
}
```

Cache Redis (TTL via `this.CACHE_TTL`, non cité dans l'extrait). Invalidation via `invalidateRoleCache(roleCode)` [role-management.service.ts:1275-1281].

### 4.6 Liste exhaustive des permissions seed actuelles

Extraites depuis `seed.ts:1307-1960` (code uniquement, ordre du fichier) :

**Projects** : `projects:create`, `projects:read`, `projects:update`, `projects:delete`, `projects:manage_members`, `projects:view`, `projects:edit`
**Tasks** : `tasks:create`, `tasks:read`, `tasks:update`, `tasks:delete`, `tasks:readAll`, `tasks:create_in_project`, `tasks:create_orphan`
**Events** : `events:create`, `events:read`, `events:update`, `events:delete`, `events:readAll`
**Epics** : `epics:create`, `epics:read`, `epics:update`, `epics:delete`
**Milestones** : `milestones:create`, `milestones:read`, `milestones:update`, `milestones:delete`
**Leaves** : `leaves:create`, `leaves:read`, `leaves:update`, `leaves:delete`, `leaves:readAll`, `leaves:approve`, `leaves:manage_delegations`, `leaves:view`, `leaves:manage`, `leaves:declare_for_others`
**Telework** : `telework:create`, `telework:read`, `telework:update`, `telework:delete`, `telework:readAll`, `telework:read_team`, `telework:manage_others`, `telework:view`, `telework:manage_recurring`
**Skills** : `skills:create`, `skills:read`, `skills:update`, `skills:delete`, `skills:manage_matrix`, `skills:view`, `skills:edit`
**Time Tracking** : `time_tracking:create`, `time_tracking:read`, `time_tracking:update`, `time_tracking:delete`, `time_tracking:read_reports`
**Users** : `users:create`, `users:read`, `users:update`, `users:delete`, `users:import`, `users:manage_roles`, `users:view`, `users:edit`, `users:manage`, `users:reset_password`
**Departments** : `departments:create`, `departments:read`, `departments:update`, `departments:delete`, `departments:view`, `departments:edit`
**Services** : `services:create`, `services:read`, `services:update`, `services:delete`
**Documents** : `documents:create`, `documents:read`, `documents:update`, `documents:delete`
**Comments** : `comments:create`, `comments:read`, `comments:update`, `comments:delete`
**Settings** : `settings:read`, `settings:update`
**Analytics** : `analytics:read`, `analytics:export`
**Reports** : `reports:view`, `reports:export`
**Holidays** : `holidays:create`, `holidays:read`, `holidays:update`, `holidays:delete`
**School Vacations** : `school_vacations:create`, `school_vacations:read`, `school_vacations:update`, `school_vacations:delete`
**Predefined Tasks** : `predefined_tasks:view`, `predefined_tasks:create`, `predefined_tasks:edit`, `predefined_tasks:delete`, `predefined_tasks:assign`

Aucune permission `third_parties:*` ou `time_tracking:declare_for_others` existante.

### 4.7 Lecture frontend des permissions

Hook `usePermissions` [apps/web/src/hooks/usePermissions.ts:1-43] :

```ts
import { useAuthStore } from "@/stores/auth.store";
import { Role } from "@/types";

export function usePermissions() {
  const { permissions, permissionsLoaded, user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;

  const hasPermission = (code: string): boolean => {
    if (isAdmin) return true;
    return permissions.includes(code);
  };
  const hasAnyPermission = (codes: string[]): boolean => {
    if (isAdmin) return true;
    return codes.some((code) => permissions.includes(code));
  };
  const hasAllPermissions = (codes: string[]): boolean => {
    if (isAdmin) return true;
    return codes.every((code) => permissions.includes(code));
  };
  return {
    permissions,
    permissionsLoaded,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
```

Les permissions sont récupérées via `apps/web/src/services/permissions.service.ts:1-10` :

```ts
import { api } from "@/lib/api";
export const permissionsService = {
  async getMyPermissions(): Promise<string[]> {
    const response = await api.get<{ permissions: string[] }>(
      "/auth/me/permissions",
    );
    return response.data.permissions;
  },
};
```

Exemple de gating sidebar [apps/web/src/components/MainLayout.tsx:35-41] :

```tsx
{ key: "tasks", href: `/${locale}/tasks`, icon: "✓", permission: "tasks:read" },
{ key: "events", href: `/${locale}/events`, icon: "📣", permission: "events:read" },
{ key: "planning", href: `/${locale}/planning`, icon: "🗓️" },
{ key: "timeTracking", href: `/${locale}/time-tracking`, icon: "⏱️", permission: "time_tracking:read" },
{ key: "leaves", href: `/${locale}/leaves`, icon: "🏖️", permission: "leaves:read" },
{ key: "telework", href: `/${locale}/telework`, icon: "🏠", permission: "telework:read" },
```

Exemples supplémentaires de `hasPermission` dans le code : `PlanningView.tsx:65`, `PlanningGrid.tsx:205-208`, `TaskCreateModal.tsx:37,76-92`, `EventCreateModal.tsx:30,68-83`, `RecurringRulesModal.tsx:71,89` (non exhaustif).

---

## 5. Module analytics & Analytics V4

### 5.1 Arborescence `apps/api/src/analytics/`

```
dto/
analytics.controller.spec.ts
analytics.controller.ts       (32 lignes)
analytics.module.ts
analytics.service.spec.ts
analytics.service.ts          (347 lignes)
```

### 5.2 Endpoints analytics

Source : `apps/api/src/analytics/analytics.controller.ts:1-32`

| Méthode | Route               | Permission                 | Handler                                     |
| ------- | ------------------- | -------------------------- | ------------------------------------------- |
| GET     | `/analytics`        | `reports:view` [line 17]   | `getAnalytics(query: AnalyticsQueryDto)`    |
| GET     | `/analytics/export` | `reports:export` [line 26] | `exportAnalytics(query: AnalyticsQueryDto)` |

### 5.3 Calcul de la charge par collaborateur (« workload per collaborator ») — **non trouvé**

Commande : `grep -rn "workload|charge.*collaborateur|timeEntry.*groupBy" apps/api` →

- **Fichiers de production** qui contiennent un `groupBy` sur TimeEntry : **seul** `apps/api/src/analytics/analytics.service.ts:282` (et la fonction `getProjectDetails`).
- Aucun fichier nommé `workload*` dans `apps/api/src`. Aucun symbole `workloadPerCollaborator` ou équivalent trouvé via grep.
- Aucune agrégation `TimeEntry` par `userId` dans `analytics.service.ts` (le `groupBy` est fait par `projectId`, pas `userId`).

La seule agrégation `TimeEntry` du service analytics (`getProjectDetails`) [analytics.service.ts:276-336] :

```ts
private async getProjectDetails(
  projects: ProjectWithDetails[],
  tasks: Task[],
): Promise<ProjectDetailDto[]> {
  const projectIds = projects.map((p) => p.id);
  const timeEntries = await this.prisma.timeEntry.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
    },
    _sum: {
      hours: true,
    },
  });

  const timeEntriesMap = timeEntries.reduce(
    (acc, entry) => {
      if (entry.projectId) {
        acc[entry.projectId] = entry._sum.hours || 0;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
  // … suite : mapping sur projects
}
```

**Filtrage userId** : cette requête **ne filtre pas** sur `userId IS NOT NULL`. Le `where` ne contient que `projectId: { in: projectIds }`.

### 5.4 Autres agrégations `TimeEntry.hours` dans analytics/

Résultat grep : aucune autre agrégation dans `analytics.service.ts` hormis celle ci-dessus. Les 30+ occurrences de `mockPrismaService.timeEntry.groupBy` sont toutes dans `analytics.service.spec.ts` (mocks de la méthode unique ci-dessus).

Aucun endpoint ni fonction « Analytics V4 workload per collaborator » trouvé dans le module analytics. Voir §11 Zones d'incertitude.

---

## 6. Planning et télétravail

### 6.1 Planning export

Fichier : `apps/api/src/planning-export/planning-export.service.ts` (220 lignes).

Grep `timeEntry|TimeEntry` dans `planning-export.service.ts` et `planning-export.controller.ts` → **aucune occurrence**. Le module planning-export ne lit pas `TimeEntry`.

### 6.2 Vue planning côté API

Les composants de planning côté frontend (`PlanningView.tsx`, `PlanningGrid.tsx`) lisent des permissions (`telework:read_team`, `telework:manage_others`, `predefined_tasks:assign`) mais le service backend correspondant n'a pas été inspecté au-delà de `planning-export`. Le rapport ne peut confirmer s'il existe un autre endpoint « planning » qui lirait `TimeEntry`. Grep global : aucune référence `TimeEntry` dans `planning-export/**` ni `telework/**`.

### 6.3 Telework

Fichier : `apps/api/src/telework/telework.service.ts` (886 lignes).

Grep `timeEntry|TimeEntry` dans `telework.service.ts` → **aucune occurrence**. Le module télétravail ne lit pas `TimeEntry`.

---

## 7. Frontend — fichiers impactés prévisibles

### 7.1 Existence et chemins (Next.js App Router, `apps/web/app/[locale]/`)

| Fichier               | Chemin                                           | Lignes                        |
| --------------------- | ------------------------------------------------ | ----------------------------- |
| Time-tracking service | `apps/web/src/services/time-tracking.service.ts` | 110                           |
| Page time-tracking    | `apps/web/app/[locale]/time-tracking/page.tsx`   | 535                           |
| Page tasks            | `apps/web/app/[locale]/tasks/page.tsx`           | 1147                          |
| Page project détail   | `apps/web/app/[locale]/projects/[id]/page.tsx`   | 2284                          |
| Page tasks détail     | `apps/web/app/[locale]/tasks/[id]/page.tsx`      | non mesurée (fichier présent) |
| TaskModal (root)      | `apps/web/src/components/TaskModal.tsx`          | 668                           |
| TaskModal (planning)  | `apps/web/src/components/planning/TaskModal.tsx` | non mesurée (fichier présent) |
| Sidebar / layout      | `apps/web/src/components/MainLayout.tsx`         | 218                           |
| Permissions hook      | `apps/web/src/hooks/usePermissions.ts`           | 43                            |
| Permissions service   | `apps/web/src/services/permissions.service.ts`   | 10                            |

### 7.2 Arborescence pertinente `apps/web/app/[locale]/`

```
admin  dashboard  departments  events  forgot-password  layout.tsx
leaves  login  page.tsx  planning  profile  projects  register
reports  reset-password  settings  skills  tasks  telework
time-tracking  users
```

### 7.3 Gating sidebar

Voir §4.7 — chaque entrée du tableau `MainLayout.tsx:35-41` porte une clé `permission` ; le composant filtre sur `hasPermission()` (implémentation du filtre non affichée dans les extraits récupérés, mais pattern cohérent avec l'usage de `usePermissions`).

### 7.4 Composant Combobox / Command réutilisable

`find apps/web/src -type f -iname "*combobox*"` → aucun fichier.
Grep `combobox|Combobox|Command` dans `apps/web/src/components` → aucun fichier.

**Non trouvé** : aucun composant Combobox shadcn-style réutilisable dans `apps/web/src/components`. Un sélecteur de tiers devra être construit ou un composant tiers adopté.

Présence de `UserMultiSelect.tsx` et `ServiceMultiSelect.tsx` [listing de `apps/web/src/components/`] qui peuvent servir de référence de pattern de sélecteur, mais non inspectés en détail.

---

## 8. Tests E2E Playwright

### 8.1 Arborescence `e2e/`

```
auth.setup.ts
auth.spec.ts
fixtures/
  permission-matrix.ts
  roles.ts
  test-fixtures.ts
full-workflow.spec.ts
helpers.ts
leaves.spec.ts
permissions.spec.ts
planning.spec.ts
projects.spec.ts
tasks.spec.ts
tests/
  multi-role/
  rbac/
  workflows/
```

Il n'existe pas de répertoire `apps/web/e2e/` ; les tests sont en racine `e2e/`.

### 8.2 Fichiers e2e touchant time-tracking ou tasks

- `grep -rln "time-tracking|timeTracking" e2e/` → **aucun fichier**. Pas de test e2e existant pour time-tracking.
- Tests présents : `tasks.spec.ts`, `projects.spec.ts`, `planning.spec.ts`, `leaves.spec.ts`, `auth.spec.ts`, `permissions.spec.ts`, `full-workflow.spec.ts`, plus sous-répertoires `tests/multi-role`, `tests/rbac`, `tests/workflows` (contenus non listés en détail).

### 8.3 Pattern de fixtures de rôles

Source : `e2e/fixtures/roles.ts:1-41`

```ts
import * as path from "path";

export const ROLES = [
  "admin",
  "responsable",
  "manager",
  "referent",
  "contributeur",
  "observateur",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_EMAILS: Record<Role, string> = {
  admin: "admin-test@orchestr-a.test",
  responsable: "responsable-test@orchestr-a.test",
  manager: "manager-test@orchestr-a.test",
  referent: "referent-test@orchestr-a.test",
  contributeur: "contributeur-test@orchestr-a.test",
  observateur: "observateur-test@orchestr-a.test",
};

export const ROLE_LOGINS: Record<Role, string> = {
  /* ... */
};

export const ROLE_STORAGE_PATHS: Record<Role, string> = {
  admin: path.join("playwright", ".auth", "admin.json"),
  // ...
};

export const ROLE_PASSWORD = "Test1234!";
```

Le login par rôle passe par un `storageState` préconstruit dans `playwright/.auth/<role>.json` (setup via `auth.setup.ts`, non inspecté).

Note : fixture `MANAGER` existe sous la clé `manager`. Pas de rôle `CHEF_DE_PROJET` ni `TECHNICIEN_SUPPORT` dans la matrice e2e alors que le schéma Prisma déclare 15 valeurs d'enum `Role` [schema.prisma:71-87].

### 8.4 Hook PostToolUse / smoke test

Source : `.claude/settings.json:33-45`

```json
"hooks": {
  "PostToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        {
          "type": "command",
          "command": "npx playwright test --reporter=line --grep @smoke 2>&1 | tail -20"
        }
      ]
    }
  ]
}
```

Déclenche les tests Playwright taggés `@smoke` après chaque Edit/Write.

---

## 9. Migrations récentes

### 9.1 Liste (par date de modification)

```
20260409112404_add_school_vacations
20260405215351_add_external_intervention_to_predefined_tasks
20260405131548_add_timeslot_to_predefined_tasks
20260405120000_remove_started_status
20260404215113_add_project_icon_manager_sponsor
20260404211126_add_project_snapshots
20260402072633_add_subtasks
20260330185549_add_week_interval_to_recurring_rules
```

### 9.2 Convention de nommage

`YYYYMMDDHHmmss_<snake_case_description>` — horodatage Prisma standard + description en `snake_case`.

### 9.3 Pattern backfill

Grep `UPDATE ` sur toutes les migrations :

- `20251116093059_init/migration.sql`
- `20251215120000_add_missing_tables/migration.sql`
- `20251225160000_add_task_assignees/migration.sql`
- `20260104102501_add_holidays_and_task_fields/migration.sql`
- `20260214192223_add_chef_projet_events_ext_intervention/migration.sql`
- `20260214200033_add_rbac_dynamic_permissions/migration.sql`
- `20260224231534_add_event_recurrence/migration.sql`
- `20260321105758_add_leave_balances_and_rbac_granularity/migration.sql`
- `20260321112607_add_predefined_tasks_telework_recurring_password_reset/migration.sql`
- `20260402072633_add_subtasks/migration.sql`
- `20260404211126_add_project_snapshots/migration.sql`
- `20260404215113_add_project_icon_manager_sponsor/migration.sql`
- `20260405120000_remove_started_status/migration.sql`
- `20260409112404_add_school_vacations/migration.sql`

La migration la plus proche du cas d'usage (ajout d'une table de liaison à une entité existante) est `20251225160000_add_task_assignees/migration.sql` — extrait intégral :

```sql
-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignees_taskId_idx" ON "task_assignees"("taskId");

-- CreateIndex
CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_userId_key" ON "task_assignees"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Cette migration ne contient **pas** de bloc `UPDATE` de backfill : elle n'en a pas eu besoin (table nouvelle, pas de colonne nullable → non-nullable). Aucune migration inspectée ne contient un pattern de backfill explicite pour une colonne nouvellement ajoutée à une table existante. Non trouvé dans les extraits.

---

## 10. Volumétrie et état DB

**Non accessible depuis ce contexte** : aucun accès PSQL n'a été tenté dans cet audit. À exécuter manuellement par Alexandre (VPS prod Orchestr'A) avant la migration :

```sql
SELECT COUNT(*) FROM time_entries;
SELECT COUNT(*) FROM time_entries WHERE user_id IS NULL;
SELECT COUNT(DISTINCT user_id) FROM time_entries;
```

Note factuelle : la colonne s'appelle `userId` dans Prisma mais en base PostgreSQL le nom réel dépend de la migration init (non vérifié). La ligne 397 de `schema.prisma` déclare `userId String` sans `@map`, donc Prisma utilisera le nom `userId` tel quel dans SQL.

---

## 11. Zones d'incertitude

1. **Analytics V4 « workload per collaborator »** : la fonction décrite dans le brief n'a pas été retrouvée par grep (`workload`, `charge.*collaborateur`, agrégation par `userId`) dans `apps/api/src/`. Soit elle n'existe pas encore dans le code ; soit elle porte un nom complètement différent (non deviné) ; soit elle est implémentée côté frontend. **Non tranché**.

2. **Module « planning » côté API** : seul `planning-export` existe en backend (export lecture). Le frontend (`PlanningView`, `PlanningGrid`) consomme probablement d'autres endpoints (`telework`, `tasks`, `leaves`) mais **aucun service backend nommé `planning` dédié** n'a été trouvé. Les données de planning sont donc agrégées côté client ou via des appels multiples.

3. **Projection frontend du flux time-tracking par page détail projet/tâche** : les pages `[id]/page.tsx` sont volumineuses (2284 lignes pour projet, non inspectées en détail) ; non vérifié qu'elles affichent ou créent des `TimeEntry`. À confirmer avant implémentation.

4. **Route `/auth/me/permissions`** : appelée par `permissionsService.getMyPermissions()` [permissions.service.ts:5] mais le handler backend correspondant n'a pas été localisé dans cet audit. Probablement dans `apps/api/src/auth/auth.controller.ts` (non lu).

5. **Guards globaux** : le `TimeTrackingController` n'a pas de `@UseGuards` explicite ; le chaînage global `JwtAuthGuard → RolesGuard → PermissionsGuard` est supposé mais non vérifié dans `app.module.ts` / `main.ts` (non lus dans cet audit).

6. **Backfill migration** : aucun pattern de backfill `UPDATE … SET … WHERE` n'a été extrait. Les migrations précédentes semblent toujours ajouter des colonnes soit nullable, soit avec `DEFAULT`. Pattern à définir.

7. **Rôles RBAC non-système** : `getPermissionsForRole` interroge `roleConfig.code` ; mais le modèle `User` a un champ `role Role @default(CONTRIBUTEUR)` qui est **enum Prisma** [schema.prisma:24,71-87]. La relation entre `User.role` (enum) et `RoleConfig.code` (string) est donc par correspondance de nom — aucune FK formelle. Cela a un impact pour toute permission granulaire sur tiers si on veut distinguer « déclarant habilité » par rôle.

8. **TaskAssignee.userId non-nullable** : si l'on veut assigner un tiers à une tâche, il faudra soit créer une nouvelle table `TaskThirdPartyAssignee`, soit rendre `userId` nullable et ajouter `thirdPartyId` nullable + contrainte XOR (même dilemme que TimeEntry). La décision n'a pas été prise dans le code actuel.

9. **Usage de `timeEntries` dans `projects.service.ts:689-698`** : calcule `totalActualHours` comme la somme de toutes les heures TimeEntry liées aux tâches d'un projet, **sans filtrer par `userId`**. Si la ségrégation doit être stricte pour l'analytics, cette fonction devra être revue aussi.

---

## 12. Liste définitive des fichiers à modifier

Basée uniquement sur les fichiers existants vérifiés dans ce rapport. Les fichiers « à créer » sont identifiés comme tels.

### 12.1 Schema / migrations

- `packages/database/prisma/schema.prisma` — modifier `TimeEntry` (userId nullable, ajout `thirdPartyId`, ajout `declaredById`), créer `ThirdParty`, éventuellement `TaskThirdPartyAssignee` / `ProjectThirdPartyAssignee`.
- `packages/database/prisma/migrations/<YYYYMMDDHHmmss>_add_third_parties/migration.sql` — **nouveau** (migration SQL manuelle recommandée pour gérer la transition `userId NOT NULL → nullable` + contraintes).
- `packages/database/prisma/seed.ts` — ajouter les nouvelles permissions `third_parties:*`, `time_tracking:declare_for_third_party`, étendre les rôles concernés [seed.ts:1307-1960 pour le bloc permissions, :1975-… pour les rôles].

### 12.2 Backend — module `third-parties` (à créer)

- `apps/api/src/third-parties/third-parties.module.ts` **nouveau**
- `apps/api/src/third-parties/third-parties.controller.ts` **nouveau**
- `apps/api/src/third-parties/third-parties.service.ts` **nouveau**
- `apps/api/src/third-parties/dto/create-third-party.dto.ts` **nouveau**
- `apps/api/src/third-parties/dto/update-third-party.dto.ts` **nouveau**
- `apps/api/src/third-parties/dto/query-third-party.dto.ts` **nouveau**
- `apps/api/src/third-parties/third-parties.controller.spec.ts` **nouveau**
- `apps/api/src/third-parties/third-parties.service.spec.ts` **nouveau**
- `apps/api/src/app.module.ts` — déclarer le nouveau module (**non lu** dans cet audit, chemin vérifié existant).

### 12.3 Backend — modifications existantes

**Time-tracking** :

- `apps/api/src/time-tracking/time-tracking.service.ts` — `create` (prendre `declaredById`, valider XOR user/tiers, vérifier permission), `update`, `findAll` (filtres `thirdPartyId`), `getUserReport`, `getProjectReport` (ségrégation), nouvelle méthode `getThirdPartyReport`.
- `apps/api/src/time-tracking/time-tracking.controller.ts` — nouveau endpoint `POST /time-tracking/for-third-party` ou extension du POST existant + endpoint `GET /time-tracking/third-party/:id/report`.
- `apps/api/src/time-tracking/dto/create-time-entry.dto.ts` — champs `thirdPartyId?`, validation XOR, `declaredById` injecté server-side.
- `apps/api/src/time-tracking/dto/update-time-entry.dto.ts` — idem via `PartialType`.

**Tasks** (si assignation tiers aux tâches) :

- `apps/api/src/tasks/tasks.service.ts` — les blocs L.212, 244, 294, 349, 427, 623-631, 665, 692, 710, 933, 950, 1002, 1478 devront inclure le nouveau type d'assignation. À trancher selon §11 pt 8.
- `apps/api/src/tasks/dto/create-task.dto.ts` / `update-task.dto.ts` — ajout `thirdPartyAssigneeIds?`.
- `apps/api/src/tasks/tasks.controller.ts` — pas de changement structurel probable.

**Projects** :

- `apps/api/src/projects/projects.service.ts` — L.689-698 : calcul `totalActualHours` à revoir si ségrégation stricte.
- `apps/api/src/projects/projects.controller.ts` — nouveau endpoint de gestion des tiers sur projet si retenu.
- `apps/api/src/projects/dto/*` — ajout `thirdPartyMemberIds?`.

**Analytics** :

- `apps/api/src/analytics/analytics.service.ts` — L.282-290 : la requête `timeEntry.groupBy` par `projectId` n'agrège pas par user ni par type d'auteur. Si ségrégation voulue, ajouter un filtre sur `userId != null` (heures users uniquement) et dupliquer pour tiers.
- `apps/api/src/analytics/analytics.service.spec.ts` — adaptation mocks.
- Absence de fonction « workload per collaborator » : si elle est à créer, c'est ici.

**RBAC seed** :

- `packages/database/prisma/seed.ts` — bloc permissions [1307-1960] : ajout catégorie `third_parties` et permission `time_tracking:declare_for_third_party`. Bloc rôles [1977-…] : attribution aux rôles pertinents.

### 12.4 Frontend — nouveaux fichiers et modifications

**Nouveaux** :

- `apps/web/app/[locale]/third-parties/page.tsx` **nouveau** (liste)
- `apps/web/app/[locale]/third-parties/[id]/page.tsx` **nouveau** (détail/édition)
- `apps/web/src/services/third-parties.service.ts` **nouveau**
- `apps/web/src/components/third-parties/ThirdPartyModal.tsx` **nouveau**
- `apps/web/src/components/third-parties/ThirdPartySelector.tsx` **nouveau** (pattern à aligner sur `UserMultiSelect.tsx`, pas de Combobox shadcn existant — cf §7.4)

**Modifications** :

- `apps/web/src/components/MainLayout.tsx` — L.35-41 : ajouter entrée sidebar `third-parties` avec `permission: "third_parties:read"`.
- `apps/web/src/services/time-tracking.service.ts` — étendre l'interface pour `thirdPartyId` et nouveaux endpoints.
- `apps/web/app/[locale]/time-tracking/page.tsx` — ajouter un mode « déclarer pour un tiers » conditionnel sur `hasPermission('time_tracking:declare_for_third_party')`.
- `apps/web/src/components/TaskModal.tsx` — intégrer sélection tiers si retenu.
- `apps/web/src/components/planning/TaskModal.tsx` — idem.
- `apps/web/app/[locale]/projects/[id]/page.tsx` — affichage des heures tiers ségrégées.
- `apps/web/app/[locale]/tasks/page.tsx` et `apps/web/app/[locale]/tasks/[id]/page.tsx` — affichage et filtrage tiers.
- `apps/web/src/types/index.ts` — types `ThirdParty`, extension `TimeEntry`.

### 12.5 Tests E2E Playwright

- `e2e/third-parties.spec.ts` **nouveau**
- `e2e/time-tracking.spec.ts` **nouveau** (actuellement inexistant — cf §8.2)
- `e2e/fixtures/permission-matrix.ts` — ajouter les nouvelles permissions
- `e2e/fixtures/roles.ts` — éventuellement ajouter un rôle de test habilité à déclarer pour un tiers

---

## Fin du rapport

Chemin absolu : `/home/alex/Documents/REPO/ORCHESTRA/.claude/audits/third-parties-audit.md`
