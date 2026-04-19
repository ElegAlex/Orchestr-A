# Audit 03 — Logique d'ownership et de scope

> Phase 0, §1.3 — Logique de propriété (ownership) et de scope (visibilité par périmètre).

---

## 0. Fichiers sources analysés

- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/guards/ownership.guard.ts`
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/services/ownership.service.ts`
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/decorators/ownership-check.decorator.ts`
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/role-management/role-management.service.ts` (méthode `getPermissionsForRole`, ligne 1299)
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/leaves/leaves.service.ts` (scope périmètre + readAll)
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/telework/telework.service.ts` (readAll + manage_others)
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/tasks/tasks.service.ts` (readAll)
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/events/events.service.ts` (readAll + manage_any)
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/time-tracking/time-tracking.service.ts` (view_any)
- `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/projects/projects.service.ts`
- `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/schema.prisma`

---

## 1. Extraits complets `OwnershipGuard` + `OwnershipService`

### 1.1 `OwnershipGuard`

Chemin : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/guards/ownership.guard.ts`

```ts
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ownershipService: OwnershipService,
    private readonly roleManagementService: RoleManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<
      OwnershipCheckOptions | undefined
    >(OWNERSHIP_METADATA, [context.getHandler(), context.getClass()]);

    if (!opts) {
      return true;  // opt-in : pas de métadonnée → pas de vérif
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const paramKey = opts.paramKey ?? 'id';
    const resourceId: string | undefined = request.params?.[paramKey];
    if (!resourceId) {
      throw new BadRequestException(
        `Missing required route parameter "${paramKey}"`,
      );
    }

    if (opts.bypassPermission && user.role) {
      const permissions =
        (await this.roleManagementService.getPermissionsForRole(user.role)) ??
        [];
      if (permissions.includes(opts.bypassPermission)) {
        return true;   // ← short-circuit confirmé
      }
    }

    const isOwner = await this.ownershipService.isOwner(
      opts.resource,
      resourceId,
      user.id,
    );
    if (!isOwner) {
      throw new ForbiddenException('Resource ownership violation');
    }

    return true;
  }
}
```

### 1.2 `OwnershipService` (logique par resource)

Chemin : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/services/ownership.service.ts`

```ts
export type OwnedResource =
  | 'leave' | 'telework' | 'timeEntry' | 'project' | 'event' | 'document';

const PROJECT_LEADER_MEMBER_ROLES = ['Chef de projet', 'OWNER', 'LEAD'];

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async isOwner(resource, resourceId, userId) {
    if (!resourceId || !userId) return false;
    switch (resource) {
      case 'leave':     return this.isLeaveOwner(...);
      case 'telework':  return this.isTeleworkOwner(...);
      case 'timeEntry': return this.isTimeEntryOwner(...);
      case 'project':   return this.isProjectOwner(...);
      case 'event':     return this.isEventOwner(...);
      case 'document':  return this.isDocumentOwner(...);
      default: return false;
    }
  }
}
```

### 1.3 Logique `isOwner` par resource

| Resource | Modèle Prisma | Mécanisme | Requête | Champs consultés |
|---|---|---|---|---|
| `leave` | `Leave` (table `leaves`) | FK simple | `prisma.leave.findUnique({ where:{id}, select:{userId:true} })` → `row.userId === userId` | `Leave.userId` |
| `telework` | `TeleworkSchedule` (table `telework_schedules`) | FK simple | `prisma.teleworkSchedule.findUnique({ where:{id}, select:{userId:true} })` → `row.userId === userId` | `TeleworkSchedule.userId` |
| `timeEntry` | `TimeEntry` (table `time_entries`) | FK double | `prisma.timeEntry.findUnique({ where:{id}, select:{userId:true, declaredById:true} })` → `row.userId === userId \|\| row.declaredById === userId` | `TimeEntry.userId` (nullable pour déclarations tiers) + `TimeEntry.declaredById` |
| `project` | `Project` | Tri-FK + fallback membership | (1) `prisma.project.findUnique({select:{createdById, managerId, sponsorId}})` ; si l'un === userId → true. (2) Sinon `prisma.projectMember.findFirst({where:{projectId, userId, role:{in:['Chef de projet','OWNER','LEAD']}}})` | `Project.createdById` / `managerId` / `sponsorId` + `ProjectMember.role` |
| `event` | `Event` | FK simple | `prisma.event.findUnique({ where:{id}, select:{createdById:true} })` → `row.createdById === userId` | `Event.createdById` |
| `document` | `Document` | FK simple | `prisma.document.findUnique({ where:{id}, select:{uploadedBy:true} })` → `row.uploadedBy === userId` | `Document.uploadedBy` |

Notes :
- `leave`, `telework`, `event`, `document` : **FK plate** (un seul champ).
- `timeEntry` : **deux FK** (le déclarant d'une entrée pour tiers est considéré propriétaire — `TimeEntry.userId` est nullable, `declaredById` ne l'est pas).
- `project` : seule resource avec join (`ProjectMember.role` free-form string, liste hardcodée `['Chef de projet', 'OWNER', 'LEAD']` — contrat non garanti par la DB).
- **Aucun appel Prisma** du service ne touche `role_permissions`, `roleConfig`, ou quoi que ce soit lié au RBAC. Le service est RBAC-free.

---

## 2. Bypass `*:manage_any` — confirmation

**Confirmé.** Le bypass passe par `RoleManagementService.getPermissionsForRole(user.role)`, testé via `.includes(opts.bypassPermission)`, et le guard `return true` sans appeler `OwnershipService.isOwner`.

Extrait chirurgical (guard, lignes 60-67) :

```ts
if (opts.bypassPermission && user.role) {
  const permissions =
    (await this.roleManagementService.getPermissionsForRole(user.role)) ??
    [];
  if (permissions.includes(opts.bypassPermission)) {
    return true;
  }
}
```

`getPermissionsForRole` (role-management.service.ts:1299-1350) :
- Lit Redis (`role-permissions:${roleCode}`) en premier ;
- Sur miss, requête `roleConfig.findUnique({where:{code:roleCode}, include:{permissions:{include:{permission:true}}}})` → `role.permissions.map(rp => rp.permission.code)` ;
- Cache 5 min.

Donc le guard dépend **strictement** de la table RBAC dynamique `role_permissions` → `permissions` pour évaluer le bypass. C'est **le seul couplage RBAC** dans le chemin ownership.

Permissions bypass effectivement câblées dans les controllers :

| Resource | `bypassPermission` | Lieu |
|---|---|---|
| `leave` | — | **aucun** `@OwnershipCheck` dans `leaves.controller.ts` (cf. §6) |
| `telework` | `telework:manage_others` | `telework.controller.ts:190, 210, 235` |
| `timeEntry` | `time_tracking:manage_any` | `time-tracking.controller.ts:212, 241` |
| `project` | `projects:manage_any` | `projects.controller.ts:152, 179, 201, 220, 249, 270` |
| `event` | `events:manage_any` | `events.controller.ts:169, 204, 230, 254, 292` |
| `document` | `documents:manage_any` | `documents.controller.ts:73, 85` |

**Remarques** :
- `documents:manage_any` est utilisée en code mais **absente** de la matrice `ROLES-PERMISSIONS.md` (119 permissions) — soit non seedée, soit seedée ailleurs. À vérifier en audit-02.
- `telework:manage_others` est le bypass telework, pas `telework:manage_any` — divergence nominale entre modules.

---

## 3. Pattern `readAll` vs `read` par module

**Pattern dominant : query-filter dans le service** (pas d'endpoint séparé `/tasks/all`). Controller uniforme avec `@Permissions('resource:read')` ; c'est le service qui, via `getPermissionsForRole`, décide si `where.userId` est forcé à `currentUser.id` ou laissé ouvert.

Exception mineure : certains controllers exposent aussi un endpoint dédié « me » (`GET /leaves/me`, `GET /telework/me/week`, `GET /telework/me/stats`) qui court-circuite en forçant explicitement `currentUser.id`.

### 3.1 Tasks — `tasks.service.ts:290-302`

```ts
if (currentUser) {
  const permissions =
    await this.roleManagementService.getPermissionsForRole(currentUser.role);
  if (!permissions.includes('tasks:readAll')) {
    where.OR = [
      { assigneeId: currentUser.id },
      { assignees: { some: { userId: currentUser.id } } },
    ];
  }
}
```

Complément `getTasksByAssignee` (`tasks.service.ts:980-991`) : si `userId` requis ≠ `currentUser.id`, refus sauf `tasks:readAll`.

### 3.2 Leaves — `leaves.service.ts:532-539`

```ts
if (currentUserRole) {
  const permissions =
    await this.roleManagementService.getPermissionsForRole(currentUserRole);
  if (!permissions.includes('leaves:readAll')) {
    userId = currentUserId;
  }
}
```

**Coercition silencieuse** : `userId = currentUserId` remplace le filtre demandé sans erreur.

### 3.3 Telework — `telework.service.ts:123-131`

```ts
const permissions =
  await this.roleManagementService.getPermissionsForRole(currentUserRole);
if (!permissions.includes('telework:readAll')) {
  where.userId = currentUserId;
} else if (userId) {
  where.userId = userId;
}
```

### 3.4 Events — `events.service.ts:235-249`

```ts
const permissions =
  await this.roleManagementService.getPermissionsForRole(currentUserRole);
if (!permissions.includes('events:readAll')) {
  where.OR = [
    { participants: { some: { userId: currentUserId } } },
    { createdById: currentUserId },
  ];
} else if (userId) {
  where.participants = { some: { userId } };
}
```

Dupliqué aussi dans `getEventsByRange` (ligne 610-614) et dans `findOne` (ligne 338-352, via helper `hasManagementAccess`).

### 3.5 Synthèse

| Module | Fichier:ligne | Pattern | Short-circuit sur manque |
|---|---|---|---|
| tasks | `tasks.service.ts:290-302` | query-filter `where.OR` | coerce silencieusement à soi |
| leaves | `leaves.service.ts:532-539` | query-filter `userId = currentUserId` | coerce silencieusement à soi |
| telework | `telework.service.ts:123-131` | query-filter `where.userId = currentUserId` | coerce silencieusement à soi |
| events | `events.service.ts:235-249` | query-filter `where.OR` | coerce silencieusement à soi |
| time_tracking | `time-tracking.service.ts:191-227` | **rejet 403** si `userId` ≠ soi sans `time_tracking:view_any` | ForbiddenException explicite (**divergent**) |

Pattern `readAll` **uniforme sur la permission** (`<module>:readAll`) mais **divergent sur le short-circuit** : tasks/leaves/telework/events coercent, time-tracking rejette avec un 403. Le commentaire `time-tracking.service.ts:185-189` prétend s'aligner sur un "pattern défensif" qui est en réalité minoritaire. Incohérence à trancher en Phase 1.

---

## 4. Scope « périmètre services »

### 4.1 Modèle de données

`packages/database/prisma/schema.prisma` :

```prisma
model Service {
  id           String
  managerId    String?
  manager      User?  @relation("ServiceManager", fields: [managerId], references: [id], onDelete: SetNull)
  userServices UserService[]
}

model UserService {
  userId    String
  serviceId String
  @@unique([userId, serviceId])
}

// User :
//   managedServices  Service[]  @relation("ServiceManager")
```

Deux jointures :
- `services.managerId` → le user qui *manage* un service ;
- `user_services(userId, serviceId)` → appartenance au service.

### 4.2 Module `leaves` — implémentation

Méthode centralisée `getManagedUserIds(currentUserId, currentUserRole?)` : `leaves.service.ts:80-115`.

```ts
private async getManagedUserIds(
  currentUserId: string,
  currentUserRole?: string,
): Promise<Set<string> | 'all'> {
  if (
    currentUserRole &&
    (await this.roleHasPermission(currentUserRole, MANAGE_ANY_LEAVES))
  ) {
    return 'all';
  }

  const managedServices = await this.prisma.service.findMany({
    where: { managerId: currentUserId },
    select: { id: true },
  });
  const userServices = await this.prisma.userService.findMany({
    where: { userId: currentUserId },
    select: { serviceId: true },
  });

  const serviceIds = [
    ...new Set([
      ...managedServices.map((s) => s.id),
      ...userServices.map((us) => us.serviceId),
    ]),
  ];

  if (serviceIds.length === 0) return new Set<string>();

  const usersInServices = await this.prisma.userService.findMany({
    where: { serviceId: { in: serviceIds } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(usersInServices.map((us) => us.userId));
}
```

**Algorithme** : (1) services managés (`managerId = currentUserId`) ∪ services d'appartenance (`UserService.userId = currentUserId`) → (2) tous les users de ces services. Retourne `'all'` si `leaves:manage_any`.

Utilisation :
- `canManageLeave` (ligne 46-68) : autorisation de mutation (delete/approve) pour un leave de tiers ;
- `enrichLeavesWithPermissions` (ligne 141-199) : calcul de `canEdit`/`canDelete` envoyé au frontend ;
- `findAll` (ligne 532) — **non**, `findAll` utilise uniquement `leaves:readAll`. Le scope services n'est donc **pas** appliqué au listing principal, seulement aux flags d'enrichissement.

Pattern **répliqué à la main** (copié-collé) dans 4 endroits supplémentaires :
- `create` (ligne 263-297) pour `targetUserId` en declaring-for-others ;
- `getPendingForValidator` (ligne 682-723) ;
- `getSubordinates` (ligne 784-829) ;
- `canValidate` (ligne 1175-1201).

### 4.3 Module `telework` — **pas de scope périmètre**

Aucune occurrence de `managerId` / `userServices` / `getManagedUserIds` dans `telework.service.ts`. Le module ne connaît pas la notion de périmètre.

Modèle d'autorité binaire :
- `telework:readAll` → voit tout (sinon query filtrée sur soi) ;
- `telework:manage_others` → peut créer/modifier/supprimer pour autrui (sinon refus 403) ;
- `telework:read_team` → accès aux endpoints `/team/:date`, `/user/:userId/week`, `/user/:userId/stats`.

`getTeamSchedule` (ligne 834) accepte `departmentId` optionnel mais **ne filtre pas par périmètre manager**.

### 4.4 Autres modules

- `time-tracking` : pas de scope services. Binaire `time_tracking:view_any` / `time_tracking:manage_any`.
- `events` : pas de scope services. Binaire `events:readAll` / `events:manage_any`.
- `tasks` : pas de scope services. Binaire `tasks:readAll` / `tasks:manage_any` + membership projet.
- `projects` : pas de scope services **mais** un short-circuit par rôle hardcodé — `projects.service.ts:29`, `const FULL_VISIBILITY_ROLES = ['ADMIN', 'RESPONSABLE', 'MANAGER']`, consulté ligne 181-186. **Résidu** indépendant du RBAC dynamique, à refactorer.

### 4.5 Indépendance du RBAC dynamique — verdict

**Tranché : partiellement indépendant, partiellement couplé.**

Le calcul (lignes 91-114 de `leaves.service.ts`) est **100% FK Prisma** (`Service.managerId`, `UserService.userId`, `UserService.serviceId`). Aucune requête `role_permissions` / `roleConfig`.

Mais le scope n'est *activé* que si le user possède certaines permissions dynamiques :
- `MANAGE_ANY_LEAVES` → retour `'all'` (bypass) ;
- `APPROVE_LEAVES` ou `DELETE_LEAVES` → condition d'entrée dans `canManageLeave` (ligne 56-60).

**Décision** : le scope `getManagedUserIds` est **conservable tel quel** (pure FK). Le RBAC décide *si* on l'applique ou *si* on le bypass. Le refactor Phase 1 peut extraire `getManagedUserIds` dans un `ScopeService` générique consommable par tasks/telework/events/time-tracking sans aucune dépendance au futur RBAC.

---

## 5. Couplage RBAC — conclusion tranchée

**Verdict : (b) couplage uniquement via `bypassPermission` + `readAll`, refactor simple.**

Preuves :

1. **`OwnershipService`** (ownership.service.ts:36-135) : **aucune** référence à `roleManagementService`, `roleConfig`, `rolePermission`, ou `getPermissionsForRole`. Les 6 branches sont toutes des lookups Prisma FK-only. Injection constructeur ligne 34 : `constructor(private readonly prisma: PrismaService)`.

2. **`OwnershipGuard`** : une seule consultation RBAC (ligne 60-66), exclusivement pour `bypassPermission`. Si `opts.bypassPermission` est `undefined`, cette branche est skippée et le guard reste 100% FK.

3. **Scope périmètre (`leaves.service.ts:80-115`)** : pur FK. Seul couplage RBAC = le test d'entrée `roleHasPermission(..., MANAGE_ANY_LEAVES)` (ligne 84-89), qui est un bypass, pas un calcul de scope.

4. **`getRoleCodesWithPermission`** (leaves.service.ts:122-134) : **une requête RBAC hors bypass** existe pour construire la liste des rôles ayant `leaves:manage_delegations` (utilisé dans `findValidatorForUser` ligne 477-479) et `leaves:manage_any` (fallback validator ligne 504-506). Lookup inverse (trouver qui a une permission). **Seul couplage ownership/scope qui dépasse `manage_any`**, localisé dans `leaves`. Remplaçable par une table `delegator_user_ids` ou un flag `can_delegate_leaves: boolean` — pas bloquant.

5. **Couplage résiduel hors ownership/scope** : `projects.service.ts:29` (`FULL_VISIBILITY_ROLES = ['ADMIN','RESPONSABLE','MANAGER']`) et `telework.service.ts:18` (`MANAGEMENT_ROLES = ['ADMIN','RESPONSABLE','MANAGER']`) sont des constantes **hardcodées sur les rôles** (non RBAC dynamique). Le `MANAGEMENT_ROLES` de telework semble inutilisé (code mort probable).

### Verdict final

- **Ownership (`OwnershipService`)** : totalement indépendant du RBAC. **À conserver tel quel**.
- **Guard (`OwnershipGuard`)** : couplé au RBAC uniquement via `bypassPermission`. **À conserver tel quel** — pattern sain.
- **Scope périmètre services** : pur FK. **À extraire en `ScopeService` générique** pour réutilisation dans tasks/telework/time-tracking.
- **`readAll`** : pattern query-filter uniforme (sauf time-tracking → 403). Aucun besoin de refactor, mais l'incohérence coercion-vs-403 à trancher.
- **Résidus à refactorer** : deux listes de rôles hardcodées (`FULL_VISIBILITY_ROLES`, `MANAGEMENT_ROLES`) à remplacer par permissions dynamiques (`projects:readAll`, `telework:read_team` / `telework:manage_others` existent déjà → hardcodes redondants et supprimables).

---

## 6. Incertitudes

1. **`telework.service.ts:18` `MANAGEMENT_ROLES`** : constante déclarée sans appel trouvé. Code mort probable post-refactor. À confirmer avant suppression.

2. **Coercition silencieuse vs 403 sur `readAll` manquant** : le commentaire `time-tracking.service.ts:185-189` prétend aligner sur un "pattern défensif des autres modules" — empiriquement faux. Incohérence de design non tranchée ici.

3. **`PROJECT_LEADER_MEMBER_ROLES = ['Chef de projet','OWNER','LEAD']`** : liste hardcodée (`ownership.service.ts:24`). Le champ `ProjectMember.role` étant free-form, un label créé dynamiquement ne serait pas pris en compte comme owner. Intentionnel ou faille ? Non tranché.

4. **Pas d'`@OwnershipCheck` sur `leaves.controller.ts`** : contrairement aux autres modules mutants, `leaves` ne déclare aucun `@OwnershipCheck`. Protection repose uniquement sur `canManageLeave` / `canValidate` dans le service. Cohérent mais atypique — vérifier que **toutes** les routes mutantes passent par ces helpers (ex. `DELETE /leaves/:id` ligne 502 → `@Permissions('leaves:delete')` seulement, vérif ownership déléguée au service ?).

5. **`documents:manage_any`** : utilisée en code (`documents.controller.ts:73,85`) mais absente de la matrice `ROLES-PERMISSIONS.md`. À vérifier en audit-02.

6. **`telework:manage_others` vs `telework:manage_any`** : telework est le seul module à ne pas utiliser le suffixe `:manage_any` pour son bypass. Divergence nominale voulue (sémantique différente) ou inconsistance historique ? À trancher pour harmoniser.
