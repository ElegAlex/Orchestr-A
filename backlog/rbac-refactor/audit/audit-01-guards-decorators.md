# Audit 01 — Guards & decorators RBAC

> Phase 0 de la refonte RBAC — **ne préjuge d'aucune implémentation** de la Phase 1 ou des specs suivantes. Objectif : inventaire exhaustif des mécanismes de contrôle d'accès backend actuels.

Repo : `/home/alex/Documents/REPO/ORCHESTRA` — branche `master` — date : 2026-04-19.

---

## 1. Guards (auth / RBAC)

Cinq guards présents dans `apps/api/src/` touchent directement à l'authentification ou à l'autorisation. Un sixième (`ThrottlerBehindProxyGuard`) est global mais purement rate-limit.

### 1.1 `JwtAuthGuard`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/guards/jwt-auth.guard.ts`

```ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

- Hérite de `AuthGuard('jwt')` (Passport) → délègue la validation du token à `JwtStrategy`.
- `IS_PUBLIC_KEY` short-circuit pour les routes `@Public()`.

### 1.2 `RolesGuard`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/guards/roles.guard.ts`

```ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'database';
import { User } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface AuthenticatedRequest {
  user: User;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const hasPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (hasPermissions && hasPermissions.length > 0) {
      return true; // PermissionsGuard s'en charge
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return requiredRoles.some((role) => user.role === role);
  }
}
```

- **Synchrone**, pas de DB.
- Court-circuite si `@Permissions()` est présent.
- Si aucun `@Roles()` → pass-through.

### 1.3 `PermissionsGuard`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/guards/permissions.guard.ts`

```ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleManagementService } from '../../role-management/role-management.service';

interface AuthenticatedRequest {
  user: User;
}

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

- **Asynchrone** : appel `RoleManagementService.getPermissionsForRole` (cache Redis + fallback Prisma).
- **Sémantique AND** : toutes les permissions listées doivent être présentes (`every`).
- Aucun check d'ownership — pure résolution rôle → permissions.

### 1.4 `OwnershipGuard`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/guards/ownership.guard.ts`

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

    if (!opts) return true;

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
        return true;
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

- **Opt-in** : sans `@OwnershipCheck`, pass-through.
- **Global** via `APP_GUARD` dans `CommonModule` (§3.2).
- **Double dépendance** : `OwnershipService` (Prisma par resource) + `RoleManagementService` (bypass via `manage_any`).
- Resources supportées (type `OwnedResource`) : `leave | telework | timeEntry | project | event | document`.

### 1.5 `ThrottlerBehindProxyGuard` (non-RBAC, cité pour complétude)

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/guards/throttler-behind-proxy.guard.ts`

- Étend `ThrottlerGuard` de `@nestjs/throttler` pour tracer l'IP via `x-forwarded-for` derrière Nginx.
- Premier `APP_GUARD` déclaré → s'exécute avant tous les autres.

### 1.6 Guards absents

Aucun `AuthGuard` custom, aucun `SkipAuth`. Le seul mécanisme de bypass auth est `@Public()`.

---

## 2. Décorateurs RBAC

### 2.1 `@Public()`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/decorators/public.decorator.ts`

```ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- Consommé par `JwtAuthGuard`.
- **5 routes publiques** réelles : `auth.controller.ts:53, 84, 124, 212` (login, register, refresh, reset-password) + `app.controller.ts:24` (racine/health).

### 2.2 `@Roles(...roles: Role[])`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/decorators/roles.decorator.ts`

```ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

- `Role` importé du package `database` (alias `packages/types`) = enum des 15 rôles système Prisma.
- Consommé par `RolesGuard`.
- **Quasi-déprécié** : seul `role-management.controller.ts` l'utilise encore (1 route ADMIN). Tout le reste du code a migré vers `@Permissions()`.

### 2.3 `@Permissions(...permissions: string[])` (vrai nom — pas `@RequirePermissions`)

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/decorators/permissions.decorator.ts`

```ts
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

- **`string[]` ouvert** — aucune union type stricte côté back. Un typo (`'project:read'` au lieu de `'projects:read'`) ne lève aucune erreur de compilation et produit silencieusement un 403.
- **186 occurrences sur 29 controllers** (grep `@Permissions\(` dans `apps/api/src/`). C'est le mécanisme RBAC principal en production.
- Consommé par `PermissionsGuard` ; `RolesGuard` y répond par bypass.

### 2.4 `@CurrentUser(data?: keyof User)`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/decorators/current-user.decorator.ts`

```ts
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | User[keyof User] | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return data ? request.user?.[data] : request.user;
  },
);
```

- Param decorator, pas un guard consumer.
- Permet `@CurrentUser() user: User` ou `@CurrentUser('id') userId: string`.

### 2.5 `@OwnershipCheck({ resource, paramKey?, bypassPermission? })`

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/decorators/ownership-check.decorator.ts`

```ts
export const OWNERSHIP_METADATA = 'ownership';

export interface OwnershipCheckOptions {
  resource: OwnedResource;         // 'leave' | 'telework' | 'timeEntry' | 'project' | 'event' | 'document'
  paramKey?: string;               // défaut 'id'
  bypassPermission?: string;       // ex. 'projects:manage_any'
}

export const OwnershipCheck = (opts: OwnershipCheckOptions) =>
  SetMetadata(OWNERSHIP_METADATA, { paramKey: 'id', ...opts });
```

- Consommé uniquement par `OwnershipGuard`.
- **15 routes instrumentées** (grep) :
  - `documents/documents.controller.ts:73, 85` — resource `document`, bypass `documents:manage_any` (**noter** : `documents:manage_any` **n'existe pas** dans `ROLES-PERMISSIONS.md` — cf. §6 incertitude 1).
  - `events/events.controller.ts:169, 204, 230, 254, 289` — `event`, bypass `events:manage_any`.
  - `time-tracking/time-tracking.controller.ts:210, 239` — `timeEntry`.
  - `projects/projects.controller.ts:152, 179, 201, 220, 246, 267` — `project`, bypass `projects:manage_any`.
  - `telework/telework.controller.ts:190, 210, 235` — `telework`, bypass `telework:manage_others`.
  - **Aucune** occurrence réelle sur `leaves.controller.ts` malgré la documentation pointant vers `leave` comme resource possible. Cf. §6.

### 2.6 Décorateurs absents

Aucun `@SkipAuth`, `@Ownership`, `@RequirePermissions`, `@RequireTemplate` — seuls les 5 ci-dessus existent.

---

## 3. Injection globale vs locale

**Verdict** : tout le RBAC est câblé via `APP_GUARD` dans deux modules. `main.ts` n'installe aucun guard global manuellement.

### 3.1 `AuthModule` — 4 guards globaux (dans l'ordre)

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/auth/auth.module.ts`

```ts
providers: [
  AuthService,
  RefreshTokenService,
  JwtBlacklistService,
  JwtStrategy,
  LocalStrategy,
  { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_GUARD, useClass: PermissionsGuard },
],
```

Ordre d'exécution (ordre de déclaration = ordre Nest) :

1. `ThrottlerBehindProxyGuard` — rate-limit
2. `JwtAuthGuard` — authentification
3. `RolesGuard` — autorisation par rôle (bypass si `@Permissions` présent)
4. `PermissionsGuard` — autorisation par permissions (cache Redis)

### 3.2 `CommonModule` — 5e guard global

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/common/common.module.ts`

```ts
@Global()
@Module({
  imports: [RoleManagementModule],
  providers: [
    OwnershipService,
    OwnershipGuard,
    { provide: APP_GUARD, useClass: OwnershipGuard },
  ],
  exports: [OwnershipService, OwnershipGuard, RoleManagementModule],
})
export class CommonModule {}
```

- 5. `OwnershipGuard` — opt-in via `@OwnershipCheck`.

### 3.3 `main.ts` : aucun `useGlobalGuards`

Le fichier `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/main.ts` ne contient **aucun** guard global câblé manuellement — il gère Fastify, helmet, CORS, Swagger, ValidationPipe. **Toute la pile RBAC est donc dans les modules.**

### 3.4 `@UseGuards(...)` locaux — 9 occurrences redondantes

Seuls 3 controllers utilisent `@UseGuards` en plus des guards globaux, uniquement pour re-déclarer `OwnershipGuard` qui est pourtant déjà global :

- `documents/documents.controller.ts` (lignes 72, 84)
- `events/events.controller.ts` (lignes 168, 203, 229, 253, 288)
- `time-tracking/time-tracking.controller.ts` (lignes 209, 238)

→ Le guard s'exécute **deux fois** (sans incidence logique car seconde exécution idempotente). Vraisemblablement un héritage d'avant la globalisation. À signaler en nettoyage Spec 2.

---

## 4. Flow complet d'une requête authentifiée (cas : `@Permissions('projects:read')`)

| # | Étape | Redis | DB |
|---|---|---|---|
| 1 | Fastify reçoit la requête, logger + helmet + CORS | — | — |
| 2 | `ThrottlerBehindProxyGuard` (rate-limit, IP via `x-forwarded-for`) | — | — |
| 3 | `JwtAuthGuard` → délègue à `JwtStrategy.validate(payload)` | — | — |
| 3a | Vérifie blacklist `jwt:blacklist:<jti>` | `EXISTS` (fail-closed si Redis down) | — |
| 3b | Charge le user | — | `user.findUnique` (id, email, login, role, isActive, …) |
| 4 | `RolesGuard` → pass-through si `@Permissions` présent | — | — |
| 5 | `PermissionsGuard` → `getPermissionsForRole(user.role)` | `GET role-permissions:<role>` (HIT nominal, TTL 5min) | sur miss : `roleConfig.findUnique` + `rolePermission` + `permission` join, puis `SETEX` |
| 5a | `requiredPermissions.every(p ∈ userPermissions)` → 403 si refus | — | — |
| 6 | `OwnershipGuard` (si `@OwnershipCheck` présent) — bypass check | `GET role-permissions:<role>` (2e appel) | — |
| 6a | Si pas bypass → `OwnershipService.isOwner(resource, id, userId)` | — | 1 à 2 lookups Prisma selon resource |
| 7 | `ValidationPipe` + handler | — | — |

**Réponses directes aux questions de la spec** :

- **Le `RolesGuard` consulte-t-il la DB ?** Non, `user.role` est déjà dans le JWT / attaché par `JwtStrategy`.
- **Le `PermissionsGuard` consulte-t-il la DB ?** Oui potentiellement, mais via cache Redis (TTL 5min). Cache hit nominal → 0 DB.
- **Cache Redis ?** Deux usages :
  - `role-permissions:<CODE>` (TTL 300s) dans `RoleManagementService`
  - `jwt:blacklist:<jti>` (TTL = lifetime restant du token) dans `JwtBlacklistService`
- **Permissions dans le JWT ?** **Non**. Le JWT porte `{ sub, login, role, jti, exp, iat }` seulement. La résolution rôle→permissions est runtime via `RoleManagementService`.
- **Middleware Fastify ?** Aucun pour l'auth. Seul hook custom = Swagger Basic Auth (optionnel).

---

## 5. `RoleManagementService` (≡ `PermissionsService` du flow RBAC)

**Chemin** : `/home/alex/Documents/REPO/ORCHESTRA/apps/api/src/role-management/role-management.service.ts`

### 5.1 Méthodes publiques

| Méthode | Rôle |
|---|---|
| `onModuleInit()` | Appelle `seedPermissionsAndRoles()` au démarrage. |
| `seedPermissionsAndRoles()` | Seed **idempotent** (non-force) — ajoute permissions manquantes, préserve ajouts UI admin. |
| `resetRolesToDefaults()` | Reset **destructif** (force=true) — supprime toutes les `RolePermission` des rôles système et recrée depuis la config hardcodée. |
| `findAllRoles()` | Liste tous les rôles avec leurs permissions. |
| `findOneRole(id)` | Récupère un rôle. |
| `createRole(dto)` | Crée un rôle custom (`isSystem: false`). |
| `updateRole(id, dto)` | Patch nom/description. |
| `removeRole(id)` | Supprime un rôle (interdit si `isSystem`). Invalide cache. |
| `findAllPermissions()` | Permissions groupées par module. |
| `replaceRolePermissions(id, permissionIds)` | Remplace intégralement les permissions. Invalide cache. |
| **`getPermissionsForRole(code)`** | **Fonction critique RBAC runtime** (cache Redis + fallback DB). |
| `invalidateRoleCache(code)` (private) | `DEL role-permissions:<code>` |

### 5.2 Pattern de lookup (cœur du RBAC runtime)

```ts
async getPermissionsForRole(roleCode: string): Promise<string[]> {
  const cacheKey = `role-permissions:${roleCode}`;

  try {
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Redis cache read error:', error);
  }

  const role = await this.prisma.roleConfig.findUnique({
    where: { code: roleCode },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return [];

  const permissionCodes = role.permissions.map((rp) => rp.permission.code);

  try {
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(permissionCodes));
  } catch (error) {
    console.warn('Redis cache write error:', error);
  }

  return permissionCodes;
}
```

- **Clé Redis** : `role-permissions:<ROLE_CODE>` (TTL 300s).
- **Fail-soft** en cas de panne Redis : warning console mais exécution continue (**contraste avec `JwtBlacklistService` fail-closed**).
- **Invalidation explicite** après `replaceRolePermissions`, `removeRole`, et après un seed ayant ajouté des permissions.

### 5.3 Cas particulier `AuthService.getPermissionsForUser`

```ts
async getPermissionsForUser(role: string): Promise<string[]> {
  if (role === 'ADMIN') {
    const allPermissions = await this.prisma.permission.findMany();
    return allPermissions.map((p) => p.code);
  }
  return this.roleManagementService.getPermissionsForRole(role);
}
```

- Bypass direct DB pour ADMIN (pas de cache) → toutes les permissions de la table `permission`.
- Probablement utilisé par `/auth/me` ou `/auth/permissions`.

### 5.4 Modèle Prisma sous-jacent

- `Permission` : `{ id, code, module, action, description? }`
- `RoleConfig` : `{ id, code, name, description, isSystem, permissions: RolePermission[] }`
- `RolePermission` (jointure) : PK composite `(roleConfigId, permissionId)` — pas d'`id` propre (confirmé par memory `project_rbac_seed_silent_skip`).

---

## 6. Incertitudes & points à vérifier

1. **`documents:manage_any` non présente dans le catalogue** — `documents.controller.ts` référence `bypassPermission: 'documents:manage_any'` mais cette permission n'apparaît pas dans `ROLES-PERMISSIONS.md` (119 permissions). Soit la permission a été supprimée du seed, soit elle n'y a jamais été intégrée → bypass **permanent** (guard passe à `true` uniquement si la perm est présente ; sinon `isOwner` est appelé → probablement OK). À confirmer en audit-02.

2. **Pas d'`@OwnershipCheck` sur `leaves.controller.ts`** — le décorateur documente `resource: 'leave'` mais aucun grep ne remonte un usage réel. L'ownership des congés est-elle gérée service-side (dans `leaves.service.ts`) ou est-ce un oubli ? Déport à audit-03.

3. **`OwnershipGuard` listé 2× (global + local)** — héritage ou intention ? Sans incidence logique ; à nettoyer en Spec 2.

4. **`@Permissions` typé `string[]` ouvert** — aucun type d'union pour attraper les typos à la compilation. Risque moyen. À adresser dans la conception Phase 1 (`contract-01-atomic-permissions.ts` + type `PermissionCode`).

5. **Cache Redis fail-soft** — en panne Redis, chaque requête `@Permissions` touche la DB. Pas de circuit breaker, seulement un `console.warn`. À discuter (garder tel quel ? alerter via Sentry ?).

6. **Double appel `getPermissionsForRole`** (PermissionsGuard + OwnershipGuard sur même requête) — en cache hit = 2 GET Redis pour rien. Pas bloquant, à noter.

7. **`User.role` typé via enum Prisma `Role`** vs code string libre attendu par `getPermissionsForRole` — si un `RoleConfig.code` custom est créé (via `createRole`), il doit matcher exactement une valeur de l'enum, **sauf si** l'enum a été rendu libre dans `schema.prisma`. À confirmer sur `/home/alex/Documents/REPO/ORCHESTRA/packages/database/prisma/schema.prisma`.

8. **`@Roles()` quasi-obsolète** — 1 seule occurrence (role-management.controller.ts). La Phase 1 pourrait formaliser la dépréciation complète.

9. **Aucun audit des 403** — `PermissionsGuard` retourne `false` sans logger l'identité/la route. Pas d'`AuditService.log(ACCESS_DENIED, …)` dans les guards RBAC. À discuter sécurité (pertinent pour traçabilité CPAM).

10. **`OBSERVATEUR` reçoit potentiellement trop** — filtre seed `p.action === 'read' || p.action === 'view'` inclut `users:read`, `analytics:read`, `settings:read` → à valider métier.

11. **`roles.guard.spec.ts` et `permissions.guard.spec.ts`** non consultés dans ce lot — peuvent révéler des contrats implicites (gestion undefined, edge cases) utiles pour Spec 2.

12. **Pas de `@UseGuards` ailleurs** — si un module est importé en isolation (test d'intégration notamment), l'ordre des `APP_GUARD` peut être perturbé. Pertinent pour la couverture de tests en Spec 2.
