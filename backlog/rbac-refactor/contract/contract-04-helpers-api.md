# contract-04 — API de helpers RBAC (signatures)

> Surface d'API du module RBAC cible : décorateurs, services back, hooks front, stratégie de partage des types. **Contrat d'interface, pas d'implémentation.** Les contrats implicites révélés par la lecture de `roles.guard.spec.ts` et `permissions.guard.spec.ts` (D14) sont intégrés à chaque signature concernée (marqués *SEC-03 contract*).

---

## 1. Contrats implicites hérités des tests guards (D14)

Avant de figer les signatures, voici les contrats révélés par la lecture des deux `*.spec.ts`. Ces contrats deviennent des **invariants de la Phase 2** (backend) et des **cas de test obligatoires** de la Vague 3.

### 1.1 `RolesGuard` — contrat SEC-03 (roles.guard.spec.ts)

| # | Invariant | Preuve test |
|---|---|---|
| S1 | Le rôle utilisé pour le check est EXCLUSIVEMENT `request.user.role`, populé par JwtStrategy depuis la DB. | `"IGNORES client-provided body.role"` / `"IGNORES client-provided headers.x-role"` |
| S2 | Tout `body.role` / `headers.x-role` / query-param est **ignoré** par le guard. | idem |
| S3 | Si `@Permissions()` est présent sur la route, `RolesGuard` **passe la main** (`return true`). | `"defers to PermissionsGuard when @Permissions decorator is set"` |
| S4 | Si aucun `@Roles()` ni `@Permissions()` : `return true` (pass-through). | `"allows when there is no @Roles decorator"` |
| S5 | Si `@Roles()` présent : `requiredRoles.some(r => r === user.role)` (sémantique OR). | `"allows when request.user.role matches one of the required roles"` |

**Conséquence pour D12 (suppression `@Roles()`/`RolesGuard`)** : la suppression doit préserver S1 (SEC-03) via `PermissionsGuard` seul. Le nouveau décorateur `@RequirePermissions()` (ou son équivalent) doit impérativement lire `request.user.role` / `request.user.roleId`, jamais de payload client.

### 1.2 `PermissionsGuard` (permissions.guard.spec.ts)

| # | Invariant | Preuve test |
|---|---|---|
| P1 | Pas de décorateur → `return true`. | `"should allow access when no @Permissions() decorator is present"` |
| P2 | Décorateur vide `[]` → `return true` (même sémantique qu'absence). | `"should allow access when @Permissions() decorator is empty"` |
| P3 | User absent (`request.user === undefined`) → `return false` (403). | `"should deny access when user is not authenticated"` |
| P4 | User sans rôle (`user.role === null`) → `return false`. | `"should deny access when user has no role"` |
| P5 | Sémantique **AND** : `requiredPermissions.every(p ∈ userPermissions)`. | `"should deny access when user lacks one of multiple required permissions"` |
| P6 | Cache Redis géré par `RoleManagementService` (interne). Le guard appelle simplement `getPermissionsForRole(user.role)` à chaque requête. | `"should use cache from RoleManagementService (Redis)"` |
| P7 | **Granularité stricte** : permissions isolées par feature. `projects:view` ≠ `users:view` ≠ `departments:read` ≠ `reports:view` ≠ `skills:read`. Aucune "propagation" entre modules. | `"GRANULARITÉ — un rôle avec seulement projects:view ne doit pas accéder à users:view"` (×4 tests) |
| P8 | Rôle string libre accepté (pas d'enum strict). Les tests utilisent `'CUSTOM_PROJECTS_ONLY' as Role` et `'CUSTOM_PROJECTS_USERS_READ' as Role`. | `"GRANULARITÉ — un rôle avec projects:view ET users:read..."` |

**Conséquence pour D1** : le support de `'CUSTOM_*'` dans les tests confirme que l'architecture actuelle est déjà découplée du shape enum figé. La migration vers `User.roleId` préserve ce contrat sans rupture fonctionnelle pour les guards.

**Conséquence pour D2 (zero-trust)** : l'invariant P1 (pas de décorateur → allow) est incompatible avec zero-trust. Spec 2 Vague 2 devra **inverser** cet invariant en ajoutant une étape amont :

```
if (route est dans ALLOWLIST or has @Public()) return true;
if (pas de @Permissions() et pas dans ALLOWLIST) return false;
```

Option d'implémentation : un 6e guard global `ZeroTrustGuard` qui s'exécute juste après `JwtAuthGuard` et refuse toute route non-allowlistée sans `@Permissions()` ni `@Public()`. Alternative : absorber le check dans `PermissionsGuard` (simpler). À arbitrer Spec 2 Vague 2.

---

## 2. Backend — signatures

### 2.1 `PermissionsService` refactorisé

```ts
// apps/api/src/rbac/permissions.service.ts (nouveau chemin, cf. contract-05)

import type { PermissionCode, RoleTemplateKey } from '@orchestra/rbac';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Résout les permissions d'un rôle par son code DB.
   *
   * Flow :
   *   1. Lecture cache Redis `role-permissions:<code>` (TTL 5min).
   *   2. Sur miss : `prisma.role.findUnique({ where: { code } })` → templateKey.
   *   3. Résolution : `ROLE_TEMPLATES[templateKey].permissions` (in-memory).
   *   4. Écriture cache.
   *
   * @param roleCode code du rôle (Role.code en DB).
   * @returns liste des PermissionCode; tableau vide si rôle inconnu ou
   *   templateKey orphelin (log warning).
   *
   * Contrat P6 (cache Redis transparent pour le guard).
   * Fail-soft : en cas de panne Redis, fallback DB silencieux (warning console).
   */
  async getPermissionsForRole(roleCode: string): Promise<readonly PermissionCode[]>;

  /**
   * Vérifie si un rôle donné possède toutes les permissions demandées.
   * Équivaut à `permissions.every(p => userPerms.includes(p))`.
   * Contrat P5 (sémantique AND).
   */
  async roleHasAll(roleCode: string, permissions: readonly PermissionCode[]): Promise<boolean>;

  /**
   * Vérifie si un rôle donné possède au moins une des permissions demandées.
   */
  async roleHasAny(roleCode: string, permissions: readonly PermissionCode[]): Promise<boolean>;

  /**
   * Retourne le templateKey actif pour un rôle. Utilisé par l'UI admin pour
   * badger "issu du template X".
   */
  async getTemplateKeyForRole(roleCode: string): Promise<RoleTemplateKey | null>;

  /**
   * Retourne la liste des codes de rôles qui ont une permission donnée (lookup
   * inverse). Utilisé par `leaves.service.ts` pour trouver les validateurs
   * disponibles (cf. audit-03 §5).
   *
   * Résolu en itérant sur `ROLE_TEMPLATES` in-memory + jointure avec les rôles
   * en DB qui pointent sur les templates concernés.
   */
  async getRoleCodesWithPermission(permission: PermissionCode): Promise<readonly string[]>;

  /**
   * Invalide le cache Redis d'un rôle donné. Appelé après `PATCH /roles/:id`
   * (changement templateKey) ou `DELETE /roles/:id`.
   */
  async invalidateRoleCache(roleCode: string): Promise<void>;
}
```

### 2.2 `RolesService` (gestion CRUD des rôles)

```ts
// apps/api/src/rbac/roles.service.ts

import type { RoleTemplateKey } from '@orchestra/rbac';
import type { Role } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Liste tous les rôles définis en DB (system + custom), avec leur template
   * et le nombre d'utilisateurs rattachés.
   */
  async listRoles(): Promise<ReadonlyArray<RoleWithStats>>;

  /**
   * Récupère un rôle par id. 404 si inexistant.
   */
  async getRoleById(id: string): Promise<Role>;

  /**
   * Crée un rôle custom. Le PO (D9) interdit la modification des rôles système.
   * `isSystem` est toujours forcé à `false` côté service (ignore l'input).
   *
   * @throws ConflictException si `code` déjà pris.
   * @throws BadRequestException si `templateKey` inconnu.
   */
  async createRole(dto: CreateRoleDto): Promise<Role>;

  /**
   * Met à jour un rôle custom (label, description, templateKey).
   * D9 : refuse si `role.isSystem === true`.
   *
   * @throws ForbiddenException si `role.isSystem === true`.
   * @throws BadRequestException si nouveau `templateKey` inconnu.
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role>;

  /**
   * Supprime un rôle custom. Refuse si des users y sont rattachés.
   * D9 : refuse si `role.isSystem === true`.
   *
   * @throws ForbiddenException si isSystem.
   * @throws BadRequestException si des users rattachés.
   */
  async deleteRole(id: string): Promise<void>;

  /**
   * Seed idempotent des 26 rôles templates en DB (sys rôles). Appelé au boot
   * via `onModuleInit`. Ne touche jamais aux rôles custom.
   */
  async seedSystemRoles(): Promise<void>;
}

// Types d'input (DTOs Nest avec class-validator)
interface CreateRoleDto {
  code: string;       // unique, SCREAMING_SNAKE_CASE
  label: string;
  templateKey: RoleTemplateKey;
  description?: string;
  isDefault?: boolean;
}

interface UpdateRoleDto {
  label?: string;
  templateKey?: RoleTemplateKey;
  description?: string;
  isDefault?: boolean;
}

interface RoleWithStats {
  id: string;
  code: string;
  label: string;
  templateKey: RoleTemplateKey;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 Décorateur `@RequirePermissions()` (remplace `@Permissions()`)

```ts
// apps/api/src/rbac/decorators/require-permissions.decorator.ts

import type { PermissionCode } from '@orchestra/rbac';

/**
 * Restreint l'accès à une route aux utilisateurs dont le rôle possède toutes
 * les permissions listées.
 *
 * Sémantique AND (P5). Équivalent logique du `@Permissions(...)` actuel mais
 * avec typage strict `PermissionCode` (au lieu de `string[]` ouvert).
 *
 * Contrat P7 : chaque permission est strictement isolée. Aucune propagation
 * entre modules.
 *
 * @example
 *   @RequirePermissions('projects:create')
 *   @Post()
 *   createProject(...) { ... }
 *
 *   @RequirePermissions('tasks:update', 'projects:manage_members')  // AND
 *   @Patch('...')
 *   update(...) { ... }
 */
export const RequirePermissions: (...perms: PermissionCode[]) => MethodDecorator & ClassDecorator;
```

**Note D12** : le décorateur `@Roles()` est supprimé en Vague 4 de Spec 2. Sa seule occurrence restante (`role-management.controller.ts`) est migrée vers `@RequirePermissions('users:manage_roles')` en Vague 2.

### 2.4 Décorateur `@RequireAnyPermission()` (bonus, optionnel)

```ts
/**
 * Restreint l'accès aux utilisateurs dont le rôle possède AU MOINS UNE des
 * permissions listées (sémantique OR).
 *
 * Utilisation type : routes où plusieurs permissions pertinentes existent
 * (ex. POST /tasks peut être accordé via `tasks:create`, `tasks:create_orphan`
 * OU `tasks:create_in_project`).
 *
 * @example
 *   @RequireAnyPermission('tasks:create', 'tasks:create_in_project', 'tasks:create_orphan')
 *   @Post()
 *   createTask(...) { ... }
 */
export const RequireAnyPermission: (...perms: PermissionCode[]) => MethodDecorator & ClassDecorator;
```

**Arbitrage Phase 1** : je recommande de ne **pas** introduire ce décorateur en Spec 2 Vague 2. Raison : l'audit n'a identifié qu'un seul cas (`POST /tasks`) où la logique OR est pertinente, et elle est déjà résolue au niveau du service. Sur-ingénierie sinon. À réexaminer en Spec 2 s'il apparaît nécessaire.

### 2.5 Décorateur `@Public()` — conservé

Inchangé. Même sémantique qu'aujourd'hui. Avec D2 (zero-trust), c'est le **seul** décorateur qui bypass la contrainte `@RequirePermissions()` obligatoire.

### 2.6 Décorateur `@CurrentUser()` — conservé

Inchangé. Mais le shape de `request.user` évolue (cf. §2.7 ci-dessous).

### 2.7 `JwtStrategy.validate` — évolution du shape `request.user`

```ts
// Avant
interface RequestUser extends User {
  role: Role; // enum string
}

// Après (post D1)
interface RequestUser extends User {
  role: {
    id: string;
    code: string;        // utilisé par PermissionsGuard et OwnershipGuard
    label: string;
    templateKey: RoleTemplateKey;
  };
}
```

**Impact** :
- `PermissionsGuard` consomme `request.user.role.code` à la place de `request.user.role`. Changement localisé.
- `OwnershipGuard` consomme `request.user.role.code` à la place de `request.user.role` pour le bypass `manage_any`. Changement localisé.
- Tout handler utilisant `@CurrentUser()` qui accède à `user.role` doit passer par `user.role.code`. Audit des usages requis en Vague 2.

**Contrat SEC-03 préservé** : `request.user.role.code` reste populé par `JwtStrategy.validate` depuis la DB. Jamais depuis body/headers/query.

---

## 3. Frontend — signatures

### 3.1 Hook `useHasPermission`

```ts
// apps/web/src/hooks/usePermissions.ts (refactoré)

import type { PermissionCode, RoleTemplateKey } from '@orchestra/rbac';

/**
 * Hook RBAC principal côté frontend. Typage strict `PermissionCode` → tout
 * typo casse le build.
 *
 * Conservation du contrat SEC-03 côté front : la résolution des permissions
 * reste autoritative côté back. Le hook expose une vue lecture seule du set
 * de permissions déjà résolu au bootstrap (`/auth/me/permissions`).
 *
 * Règle ADMIN : le bypass est conservé — `user.role.code === 'ADMIN'` →
 * toutes les permissions returned true. Cela reflète le contrat CATALOG
 * complet pour ADMIN et évite les désynchros front-back.
 */
export function usePermissions(): {
  permissions: readonly PermissionCode[];
  permissionsLoaded: boolean;
  templateKey: RoleTemplateKey | null;   // pour l'UI admin (badges)
  hasPermission: (code: PermissionCode) => boolean;
  hasAnyPermission: (codes: readonly PermissionCode[]) => boolean;
  hasAllPermissions: (codes: readonly PermissionCode[]) => boolean;
};
```

**Note perf** (audit-04 §7) : la signature ci-dessus suppose l'usage de sélecteurs atomiques dans le store Zustand, pas une destructuration. L'implémentation Spec 3 doit :

```ts
const permissions = useAuthStore(s => s.permissions);
const permissionsLoaded = useAuthStore(s => s.permissionsLoaded);
const templateKey = useAuthStore(s => s.user?.role?.templateKey ?? null);
// + useMemo sur les closures pour stabilité d'identité
```

### 3.2 Hook `useHasAnyOfTemplates` (nouveau)

```ts
/**
 * Vérifie si le rôle du user courant correspond à au moins un des templates
 * donnés. Utilisé principalement par la galerie de templates (UI admin) et
 * par des composants qui veulent conditionner par "famille" de rôles plutôt
 * que par permission atomique.
 *
 * Exemple :
 *   const isManager = useHasAnyOfTemplates(['MANAGER', 'MANAGER_PROJECT_FOCUS',
 *     'MANAGER_HR_FOCUS', 'PORTFOLIO_MANAGER']);
 *
 * ⚠️ À utiliser avec parcimonie. Dans la plupart des cas `hasPermission()`
 * est préférable (plus granulaire, moins couplé au catalogue templates).
 */
export function useHasAnyOfTemplates(
  templates: readonly RoleTemplateKey[],
): boolean;
```

### 3.3 HOC `withAccessControl(permission)` (D10)

```ts
// apps/web/src/components/withAccessControl.tsx

import type { PermissionCode } from '@orchestra/rbac';

/**
 * HOC de protection des pages Next.js App Router. Redirige vers /dashboard
 * si l'utilisateur n'a pas la permission requise.
 *
 * Usage (D10 — amélioration UX uniquement, pas une mesure de sécurité ; les
 * guards back restent authoritative) :
 *
 *   export default withAccessControl('users:manage')(UsersPage);
 *
 * Comportement :
 *   - Si `permissionsLoaded === false` : affiche spinner.
 *   - Si l'utilisateur a la permission : rend le composant enfant.
 *   - Sinon : `router.replace('/<locale>/dashboard')` + rend spinner le temps
 *     de la transition.
 */
export function withAccessControl<P extends object>(
  permission: PermissionCode,
): (Component: React.ComponentType<P>) => React.ComponentType<P>;
```

---

## 4. Stratégie de partage des types

### 4.1 Option retenue : nouveau package `packages/rbac/`

**Justification** :
- Le catalogue RBAC est un contrat **partagé back + front** (et potentiellement d'autres consommateurs : scripts de migration, E2E tests, CLI future).
- `packages/types` est déjà lourd (types de domaine Prisma) et ne devrait pas porter de logique (templates, atomiques) — juste des types.
- `packages/rbac` isole la logique RBAC dans un module dédié, versionnable, importable via alias `@orchestra/rbac`.

**Contenu du package** :

```
packages/rbac/
├── package.json           # name: "@orchestra/rbac", main: "dist/index.js"
├── tsconfig.json
├── src/
│   ├── atomic-permissions.ts   # = contract-01 (intégré sans modif)
│   ├── templates.ts            # = contract-02 (intégré sans modif)
│   └── index.ts                # barrel export
└── dist/                       # build output (tsc --declaration)
```

**Exports publics** (barrel `index.ts`) :

```ts
// Types
export type { PermissionCode, RoleTemplateKey, RoleCategoryKey, RoleTemplate } from './...';

// Catalogues
export { CATALOG_PERMISSIONS, ROLE_TEMPLATES, ROLE_TEMPLATE_KEYS, LEGACY_ROLE_MIGRATION, TEMPLATE_TO_LEGACY_LABELS } from './...';

// Atomiques (exposées pour consommation directe en Spec 2 seeding)
export { ANNUAIRE_READ, CALENDAR_CONTEXT_READ, ... } from './...';

// Helpers (optionnels)
export { dedupe, without, compose } from './...';  // à voir si utilisés hors contract-02
```

### 4.2 Options rejetées

- **Ajouter à `packages/types`** : non — dilue la vocation de ce package (types Prisma). Les templates = logique, pas des types.
- **Créer dans `apps/api`** : non — le frontend en a aussi besoin (hook `useHasPermission`, HOC). Duplication à bannir.
- **Générer depuis un .json** : non — la force du contract-01/02 est d'être TypeScript compilable (union types stricts). Un fichier JSON perdrait la sécurité typing.

### 4.3 Impacts packaging

- `apps/api/package.json` : ajouter `"@orchestra/rbac": "workspace:*"`.
- `apps/web/package.json` : idem.
- `pnpm-workspace.yaml` : déjà couvre `packages/*`.
- `turbo.json` : ajouter `@orchestra/rbac` aux dépendances des pipelines `build` et `test` de `apps/api` et `apps/web`.

---

## 5. Convention de nommage (résumé)

| Legacy | Cible | Raison |
|---|---|---|
| `@Permissions(code)` | `@RequirePermissions(code)` | Typage strict `PermissionCode` + nom explicite. |
| `@Roles(role)` | *supprimé (D12)* | Remplacé par `@RequirePermissions('users:manage_roles')` sur l'unique occurrence restante. |
| `RolesGuard` | *supprimé (D12)* | `PermissionsGuard` suffit post-unification. |
| `RoleManagementService` | `RolesService` + `PermissionsService` | Séparation des responsabilités (CRUD rôles vs résolution permissions). |
| `User.role: Role` (enum) | `User.role: Role` (relation DB) | FK vers table `roles`. Le champ TypeScript `user.role` devient un objet, plus une string. |
| `request.user.role` (string) | `request.user.role.code` (string) | Toujours une string, mais navigation via relation Prisma. |

---

## 6. Checklist inputs Spec 2 (pour contract-05)

Cette section récapitule ce que Spec 2 devra implémenter pour matcher le contrat Phase 1.

- [ ] Créer `packages/rbac/` avec contract-01/02 intégrés (Vague 0).
- [ ] Refactorer `RoleManagementService` en `RolesService` + `PermissionsService` (Vague 1).
- [ ] Remplacer `@Permissions` par `@RequirePermissions` (migration déclarative, Vague 2) — **186 occurrences** à updater.
- [ ] Ajouter `@Public()` à toutes les routes de la ALLOWLIST (cf. contract-05 §2) — Vague 2.
- [ ] Câbler `@RequirePermissions()` sur les 8 endpoints mutants non protégés (cf. contract-05 §3) — Vague 2.
- [ ] Activer fail-closed dans `PermissionsGuard` (D2) — Vague 2.
- [ ] Harmoniser `readAll` en coercion partout (D8) — Vague 2 (adapte `time-tracking.service.ts`).
- [ ] Supprimer `@Roles()` et `RolesGuard` physiquement — Vague 4.
- [ ] Drop DB : enum `Role`, tables `role_configs`, `permissions`, `role_permissions` — Vague 4.
- [ ] Ajouter les tests intégration couvrant S1-S5 et P1-P8 sur le nouveau `PermissionsGuard` — Vague 3.
