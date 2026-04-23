# Audit Module Clients — Phase 0

**Date** : 2026-04-23  
**Auditeur** : Claude Code (Sonnet 4.6)  
**Périmètre** : codebase tel qu'il existe au commit `ea6f6b2`

---

## Q1 — Convention de nommage des permissions

### Convention utilisée

**`:` (deux-points)**, exclusivement. Ex : `third_parties:create`, `projects:read`.

Source : `packages/rbac/atomic-permissions.ts:37–164` (type `PermissionCode`) et `packages/rbac/atomic-permissions.ts:577–705` (`CATALOG_PERMISSIONS`).

### Liste exhaustive des codes `third_parties` existants

Définis à `packages/rbac/atomic-permissions.ts:141–146` dans le type `PermissionCode`, et à `packages/rbac/atomic-permissions.ts:681–686` dans `CATALOG_PERMISSIONS` :

```typescript
// packages/rbac/atomic-permissions.ts:141–146
  // third_parties (6)
  | 'third_parties:assign_to_project'
  | 'third_parties:assign_to_task'
  | 'third_parties:create'
  | 'third_parties:delete'
  | 'third_parties:read'
  | 'third_parties:update'
```

L'atomique `THIRD_PARTIES_CRUD` (`packages/rbac/atomic-permissions.ts:475–481`) regroupe les 5 mutations + assignments :

```typescript
// packages/rbac/atomic-permissions.ts:475–481
export const THIRD_PARTIES_CRUD = [
  "third_parties:create",
  "third_parties:update",
  "third_parties:delete",
  "third_parties:assign_to_project",
  "third_parties:assign_to_task",
] as const satisfies readonly PermissionCode[];
```

`third_parties:read` est séparé dans `PROJECT_STRUCTURE_READ` (`packages/rbac/atomic-permissions.ts:212–220`).

### Coexistence de deux conventions

Non. La convention `.` (point) n'est présente nulle part dans `atomic-permissions.ts`. Seul `:` est utilisé. Vérification exhaustive : le type `PermissionCode` comprend 107 entrées, toutes au format `module:action`.

---

## Q2 — Mapping rôles métier ↔ rôles RBAC

### Architecture RBAC post-V4

Après la migration `20260420120000_rbac_v4_drop_legacy`, les tables `role_configs`, `permissions` et `role_permissions` ont été supprimées. La table `roles` (Prisma model `Role`, `@@map("roles")`) contient les colonnes `code`, `label`, `templateKey`. Les permissions sont résolues en mémoire via `ROLE_TEMPLATES[templateKey].permissions` (`packages/rbac/templates.ts`).

### Liste complète des 26 codes de rôles RBAC avec leur label par défaut

Source : `packages/rbac/templates.ts:293–918` (champ `defaultLabel` de chaque template) et `packages/database/prisma/seed.ts:1488–1505` (seed V0).

| Code RBAC                   | `defaultLabel`             |
| --------------------------- | -------------------------- |
| `ADMIN`                     | Administrateur             |
| `ADMIN_DELEGATED`           | Directeur adjoint          |
| `PORTFOLIO_MANAGER`         | Manager de portefeuille    |
| `MANAGER`                   | Manager                    |
| `MANAGER_PROJECT_FOCUS`     | Manager projet             |
| `MANAGER_HR_FOCUS`          | Chef de service            |
| `PROJECT_LEAD`              | Chef de projet             |
| `PROJECT_LEAD_JUNIOR`       | Chef de projet junior      |
| `TECHNICAL_LEAD`            | Référent technique         |
| `PROJECT_CONTRIBUTOR`       | Contributeur projet        |
| `PROJECT_CONTRIBUTOR_LIGHT` | Contributeur projet junior |
| `FUNCTIONAL_REFERENT`       | Référent fonctionnel       |
| `HR_OFFICER`                | Gestionnaire RH            |
| `HR_OFFICER_LIGHT`          | Assistant RH               |
| `THIRD_PARTY_MANAGER`       | Gestionnaire prestataires  |
| `CONTROLLER`                | Contrôleur de gestion      |
| `BUDGET_ANALYST`            | Analyste budgétaire        |
| `DATA_ANALYST`              | Analyste données           |
| `IT_SUPPORT`                | Technicien support         |
| `IT_INFRASTRUCTURE`         | Équipe infrastructure      |
| `OBSERVER_FULL`             | Observateur global         |
| `OBSERVER_PROJECTS_ONLY`    | Sponsor projet             |
| `OBSERVER_HR_ONLY`          | Audit social               |
| `BASIC_USER`                | Utilisateur standard       |
| `EXTERNAL_PRESTATAIRE`      | Prestataire externe        |
| `STAGIAIRE_ALTERNANT`       | Stagiaire / alternant      |

### Mapping « RESPONSABLE » → RBAC

Le rôle métier **RESPONSABLE** migre vers le template **`ADMIN_DELEGATED`**.

Source de vérité : `packages/rbac/templates.ts:1020–1022` (table `LEGACY_ROLE_MIGRATION`) :

```typescript
// packages/rbac/templates.ts:1020–1022
export const LEGACY_ROLE_MIGRATION: Record<string, RoleTemplateKey> = {
  ADMIN: 'ADMIN',
  RESPONSABLE: 'ADMIN_DELEGATED',
  MANAGER: 'MANAGER',
  ...
};
```

Description du template `ADMIN_DELEGATED` (`packages/rbac/templates.ts:317–328`) :

```typescript
// packages/rbac/templates.ts:317–328
ADMIN_DELEGATED: {
  key: 'ADMIN_DELEGATED',
  defaultLabel: 'Directeur adjoint',
  category: 'ADMINISTRATION',
  description:
    'Direction opérationnelle de haut niveau sans droits de paramétrage système ni de gestion RBAC.',
  permissions: without(CATALOG_PERMISSIONS, [
    'users:manage_roles',
    'settings:update',
    'leaves:manage_any',
  ]),
},
```

Traduction i18n legacy (ancien code encore présent dans les locales) :

- `apps/web/messages/fr/common.json:40` → `"RESPONSABLE": "Responsable"`
- `apps/web/messages/en/common.json:40` → `"RESPONSABLE": "Supervisor"`

### Mapping « CHEF DE PROJET » → RBAC

Le rôle métier **CHEF_DE_PROJET** migre vers le template **`PROJECT_LEAD`**.

Source : `packages/rbac/templates.ts:1024` :

```typescript
  CHEF_DE_PROJET: 'PROJECT_LEAD',
```

Description (`packages/rbac/templates.ts:461–477`) :

```typescript
// packages/rbac/templates.ts:461–477
PROJECT_LEAD: {
  key: 'PROJECT_LEAD',
  defaultLabel: 'Chef de projet',
  category: 'PROJECT',
  description:
    'Chef de projet confirmé : CRUD projet complet + gestion des membres.',
  permissions: compose(
    STANDARD_CONTRIBUTOR_BASE,
    PROJECT_CONTRIB_CAPACITIES,
    REPORTS_FULL,
    THIRD_PARTIES_CRUD,
    TIME_TRACKING_FOR_THIRD_PARTY,
    ['telework:manage_any'],
  ),
},
```

Traductions i18n legacy :

- `apps/web/messages/fr/common.json:43` → `"CHEF_DE_PROJET": "Chef de projet"`
- `apps/web/messages/en/common.json:43` → `"CHEF_DE_PROJET": "Project Manager"`

---

## Q3 — Pattern du module `third-parties`

### Arborescence exhaustive

```
apps/api/src/third-parties/
├── dto/
│   ├── assign-third-party-to-project.dto.ts
│   ├── assign-third-party-to-task.dto.ts
│   ├── create-third-party.dto.ts
│   ├── query-third-party.dto.ts
│   └── update-third-party.dto.ts
├── projects-third-party-members.controller.ts
├── tasks-third-party-assignees.controller.ts
├── third-parties.controller.spec.ts
├── third-parties.controller.ts
├── third-parties.module.ts
├── third-parties.service.spec.ts
└── third-parties.service.ts
```

### Endpoints du controller principal (`third-parties.controller.ts`)

| Méthode  | Path                                 | Décorateur de permission                      |
| -------- | ------------------------------------ | --------------------------------------------- |
| `POST`   | `/third-parties`                     | `@RequirePermissions('third_parties:create')` |
| `GET`    | `/third-parties`                     | `@RequirePermissions('third_parties:read')`   |
| `GET`    | `/third-parties/:id`                 | `@RequirePermissions('third_parties:read')`   |
| `GET`    | `/third-parties/:id/deletion-impact` | `@RequirePermissions('third_parties:delete')` |
| `PATCH`  | `/third-parties/:id`                 | `@RequirePermissions('third_parties:update')` |
| `DELETE` | `/third-parties/:id`                 | `@RequirePermissions('third_parties:delete')` |

Source : `apps/api/src/third-parties/third-parties.controller.ts:33–93`.

Les controllers secondaires (`projects-third-party-members.controller.ts`, `tasks-third-party-assignees.controller.ts`) gèrent les routes d'assignment imbriquées.

### Computed flags (`canEdit`, `canDelete`, `canDeleteHard`)

**Pas de computed flags dans ce module.**

Grep `canEdit\|canDelete\|canDeleteHard` sur tout `apps/api/src/third-parties/` : aucun résultat. Le module `third-parties` ne calcule ni ne retourne de flags `canEdit`/`canDelete`/`canDeleteHard` dans ses réponses. Le pattern de computed flags existe dans d'autres modules (ex. `leaves.service.ts:148–208`, `users.service.ts:671`), mais n'est pas implémenté ici.

### Endpoint `deletion-impact`

Route : `GET /third-parties/:id/deletion-impact`  
Décorateur : `@RequirePermissions('third_parties:delete')` (`third-parties.controller.ts:61`)  
Méthode service : `ThirdPartiesService.getDeletionImpact(id: string)` (`third-parties.service.ts:157`)

Interface de réponse définie à `third-parties.service.ts:13–17` :

```typescript
// apps/api/src/third-parties/third-parties.service.ts:13–17
export interface DeletionImpact {
  timeEntriesCount: number;
  taskAssignmentsCount: number;
  projectMembershipsCount: number;
}
```

Implémentation (`third-parties.service.ts:157–181`) : 3 COUNT parallèles en transaction Prisma sur `timeEntry` (où `isDismissal = false`), `taskThirdPartyAssignee`, `projectThirdPartyMember`.

### Helper `assertExistsAndActive`

Présent. Signature (`third-parties.service.ts:192–203`) :

```typescript
// apps/api/src/third-parties/third-parties.service.ts:192–203
async assertExistsAndActive(id: string): Promise<void> {
  const tp = await this.prisma.thirdParty.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!tp) {
    throw new NotFoundException(`Third party ${id} not found`);
  }
  if (!tp.isActive) {
    throw new BadRequestException(`Third party ${id} is archived`);
  }
}
```

Appelé dans `assignToTask` (ligne 291) et `attachToProject` (ligne 366) avant création de la relation.

### Frontend — composants `third-parties`

```
apps/web/src/components/third-parties/
├── ThirdPartyDeleteConfirmModal.tsx   — modal de confirmation suppression avec affichage DeletionImpact
├── ThirdPartyModal.tsx                — modal create/edit (formulaire React Hook Form)
└── ThirdPartySelector.tsx             — multi-select pour rattacher un tiers à une entité

apps/web/app/[locale]/third-parties/
├── page.tsx                           — liste paginée avec search, filtres, CRUD inline
└── [id]/page.tsx                      — détail d'un tiers (infos + onglets projets/tâches)
```

---

## Q4 — Sidebar et icônes

### Chemin exact

`apps/web/src/components/MainLayout.tsx`

### Liste ordonnée des entrées de la sidebar

**Section principale** (`navigation`, lignes 29–42) :

| Ordre | `key`          | `icon` | `permission`         |
| ----- | -------------- | ------ | -------------------- |
| 1     | `dashboard`    | `🎯`   | —                    |
| 2     | `projects`     | `📁`   | `projects:read`      |
| 3     | `tasks`        | `✓`    | `tasks:read`         |
| 4     | `events`       | `📣`   | `events:read`        |
| 5     | `planning`     | `🗓️`   | —                    |
| 6     | `timeTracking` | `⏱️`   | `time_tracking:read` |
| 7     | `leaves`       | `🏖️`   | `leaves:read`        |
| 8     | `telework`     | `🏠`   | `telework:read`      |

**Section Administration** (`adminNavigation`, lignes 44–87) :

| Ordre | `key`            | `icon` | `permission` / `adminOnly` |
| ----- | ---------------- | ------ | -------------------------- |
| 1     | `reports`        | `📊`   | `reports:view`             |
| 2     | `users`          | `👥`   | `users:manage`             |
| 3     | `departments`    | `🏢`   | `departments:read`         |
| 4     | `skills`         | `⭐`   | `skills:read`              |
| 5     | `thirdParties`   | `🤝`   | `third_parties:read`       |
| 6     | `roleManagement` | `🛡️`   | `adminOnly: true`          |
| 7     | `settings`       | `⚙️`   | `adminOnly: true`          |

Source : `apps/web/src/components/MainLayout.tsx:28–87`.

### Convention de position

Les icônes sont des emoji Unicode littéraux (pas de composants `lucide-react`). Il n'y a pas d'import de lucide-react dans `MainLayout.tsx`. La sidebar utilise deux tableaux distincts : un pour la navigation principale (fonctions daily-use), un pour l'administration (section labellisée « Administration »). L'entrée « Tiers » est dans la section Administration.

### Icône actuelle pour « Tiers »

`🤝` (handshake emoji), clé `thirdParties` dans `adminNavigation` (`MainLayout.tsx:69–74`).

### 3 suggestions d'icônes pour « Clients »

La sidebar utilise des emoji et non des composants lucide-react. Les suggestions suivantes sont des emoji distincts de `🤝` :

1. **`🏛️`** (building with pillars) — évoque une institution, commanditaire public, distinct du handshake tiers
2. **`📋`** (clipboard) — connotation commandite/cahier des charges, distinct des projets (`📁`) et tiers (`🤝`)
3. **`🎯`** — déjà utilisé pour `dashboard` ; à exclure si conflit de sens. Alternative : **`🏗️`** (construction site) — commanditaire = maître d'ouvrage, distinct de tous les icônes existants

---

## Q5 — Seed RBAC

### Chemin exact

`packages/database/prisma/seed.ts`

### Fonction principale de seed RBAC

```typescript
// packages/database/prisma/seed.ts:14
export async function seedPermissionsAndRoles(prisma: PrismaClient) {
```

### Architecture RBAC V4 — absence de table `role_permissions`

**Point critique** : après la migration `20260420120000_rbac_v4_drop_legacy/migration.sql`, les tables `permissions`, `role_configs`, et `role_permissions` ont été supprimées (`DROP TABLE IF EXISTS "role_permissions"`, `DROP TABLE IF EXISTS "permissions"`, `DROP TABLE IF EXISTS "role_configs"` — migration.sql:10–12).

La fonction `seedPermissionsAndRoles` dans `seed.ts` écrit encore dans ces tables via `prisma.permission.upsert()`, `prisma.roleConfig.upsert()`, `prisma.rolePermission.createMany()` — **ces modèles Prisma n'existent plus**. En RBAC V4, les permissions sont résolues entièrement en mémoire via `ROLE_TEMPLATES[templateKey].permissions` (`apps/api/src/rbac/permissions.service.ts:14–23`).

La seule table RBAC active est `roles` (Prisma model `Role`, `@@map("roles")`), peuplée par la migration `20260419192835_rbac_v0_add_roles_table/migration.sql:42–70` avec les 26 rôles templates. La seed re-remplit aussi ces 26 rôles via le bloc `SYSTEM_ROLE_TEMPLATES` (`seed.ts:1482–1505`).

### Logique d'idempotence (seed legacy — tables supprimées)

L'ancien bloc `seedPermissionsAndRoles` (`seed.ts:718–727`) upsertiait les permissions via :

```typescript
// packages/database/prisma/seed.ts:721–726
const permission = await prisma.permission.upsert({
  where: { code: perm.code },
  update: { description: perm.description },
  create: perm,
});
```

Pour les `role_permissions` (`seed.ts:1374–1426`) : comparer `existingPermIds` vs `targetPermIds`, insert des manquantes via `createMany({ skipDuplicates: true })`, delete des obsolètes. Si le rôle avait des permissions existantes, il passait dans `rolesSkipped++` et continuait (`continue` ligne 1411).

**Point de silent skip** : si `existingRole.permissions.length > 0` (ligne 1374), le seed entre dans la branche diff et loggue uniquement `+${toAdd.length} permissions, -${toRemove.length} permissions` si et seulement si `toAdd.length > 0 || toRemove.length > 0`. Si le rôle a exactement les bonnes permissions, **rien n'est loggué** (`seed.ts:1405–1411`). Le log de succès (`seed.ts:1429–1431`) affiche uniquement `${rolesCreated} rôles créés, ${rolesSkipped} rôles existants synchronisés`.

### Procédure de vérification post-seed

**En RBAC V4 les tables `permissions` et `role_permissions` n'existent plus.** La vérification porte sur la table `roles` et sur l'état du cache Redis.

**Vérification de la table `roles`** (colonnes réelles : `id`, `code`, `label`, `templateKey`, `description`, `isSystem`, `isDefault`, `createdAt`, `updatedAt`) :

```sql
-- Vérifier que les 26 rôles sont présents avec leur templateKey
SELECT code, label, "templateKey", "isSystem"
FROM roles
ORDER BY code;

-- Vérifier un rôle spécifique
SELECT code, "templateKey" FROM roles WHERE code = 'ADMIN_DELEGATED';
-- Attendu : templateKey = 'ADMIN_DELEGATED'
```

**Vérification des permissions résolues** : puisqu'il n'y a pas de table `role_permissions`, la vérification se fait via l'API ou le code :

```sql
-- Vérifier que le templateKey est bien reconnu (dans ROLE_TEMPLATES)
-- La résolution est en mémoire ; consulter les logs de PermissionsService :
-- "[RBAC v4] ADMIN_DELEGATED → ADMIN_DELEGATED: 104 perms (template)"
```

**Vérification du cache Redis** (après seed) :

```bash
redis-cli KEYS "role-permissions:*"
redis-cli DEL "role-permissions:*"   # flush si stale
```

Pour les nouvelles permissions `clients:*`, aucune table SQL n'est à vérifier. Il faut s'assurer que :

1. Le code `clients:read` (et les 4 autres) est ajouté à `PermissionCode` dans `packages/rbac/atomic-permissions.ts`
2. Les templates concernés dans `packages/rbac/templates.ts` incluent bien ces permissions
3. Le cache Redis est flushed après déploiement

---

## Q6 — i18n

### Fichiers de locale

La structure i18n utilise plusieurs fichiers par locale (namespace `next-intl`), organisés par domaine :

```
apps/web/messages/fr/
├── admin.json
├── auth.json
├── common.json      ← contient nav.thirdParties + roles.*
├── dashboard.json
├── events.json
├── hr.json
├── planning.json
├── profile.json
├── projects.json
├── settings.json
├── suivi.json
└── tasks.json

apps/web/messages/en/
└── (miroir identique)
```

Il n'existe **pas** de fichier `fr.json` ou `en.json` unique — les locales sont fragmentées par namespace.

### Sous-arbre complet de la clé `thirdParties`

**Résultat : la clé `thirdParties` n'a qu'une seule entrée dans les locales, dans le namespace `nav`.** Il n'existe pas de namespace dédié `thirdParties.*` avec des sous-clés.

`apps/web/messages/fr/common.json:12` :

```json
"nav": {
  "thirdParties": "Tiers"
}
```

`apps/web/messages/en/common.json:12` :

```json
"nav": {
  "thirdParties": "Third Parties"
}
```

Les pages et composants `third-parties` utilisent le namespace `"common"` et les clés génériques `actions.*` (ex. `tc("actions.edit")`, `tc("actions.delete")`, `tc("actions.loading")`). Il n'existe pas de clés spécifiques `thirdParties.title`, `thirdParties.create`, etc. dans les fichiers de locale.

### Pattern d'utilisation côté composant

Les composants utilisent `useTranslations("common")` (alias `tc`) et accèdent aux clés d'actions génériques :

- `apps/web/src/components/third-parties/ThirdPartyModal.tsx:5,32` :

  ```typescript
  import { useTranslations } from "next-intl";
  const t = useTranslations("common");
  ```

- `apps/web/app/[locale]/third-parties/page.tsx:5,32` :

  ```typescript
  import { useTranslations } from "next-intl";
  const tc = useTranslations("common");
  // Usage: tc("actions.loading"), tc("actions.edit"), tc("actions.delete")
  ```

- `apps/web/app/[locale]/third-parties/[id]/page.tsx:5,29` :
  ```typescript
  const tc = useTranslations("common");
  // Usage: tc("actions.edit"), tc("actions.delete")
  ```

**Conséquence pour le module Clients** : pas de namespace dédié `thirdParties.*` à cloner — le pattern est d'utiliser `useTranslations("common")` et les clés `actions.*` génériques. Les libellés spécifiques (titre de page, headers de colonnes) sont des strings littérales dans le JSX, pas des clés i18n.

---

## Q7 — ExportService

### Chemin exact

`apps/web/src/services/export.service.ts`

### Signature de `exportToPDF`

```typescript
// apps/web/src/services/export.service.ts:59–63
static async exportToPDF(
  data: AnalyticsData,
  dateRange: string,
  selectedProject?: string,
): Promise<void>
```

Type `AnalyticsData` (`export.service.ts:8–29`) :

```typescript
interface AnalyticsData {
  metrics: Array<{
    title: string;
    value: string | number;
    change?: string;
  }>;
  projectDetails: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    progress: number;
    totalTasks: number;
    completedTasks: number;
    projectManager?: string;
    loggedHours: number;
    budgetHours: number;
    startDate: string;
    dueDate?: string;
    isOverdue: boolean;
  }>;
}
```

### Signature de `exportToExcel`

```typescript
// apps/web/src/services/export.service.ts:195–198
static async exportToExcel(
  data: AnalyticsData,
  dateRange: string,
): Promise<void>
```

### Colonnes actuelles exportées pour les projets

**PDF** — headers du tableau `autoTable` (`export.service.ts:142–151`) :

```
["Projet", "Statut", "Progression", "Tâches", "Manager", "Heures", "Échéance"]
```

**Excel** — headers feuille « Projets » (`export.service.ts:226–239`) :

```
["Code", "Nom", "Statut", "Progression (%)", "Tâches Complétées", "Tâches Totales",
 "Chef de Projet", "Heures Consommées", "Heures Budgétées", "Date Début",
 "Date Échéance", "En Retard"]
```

### Point d'insertion pour la colonne « Clients »

**PDF** (`export.service.ts:130–166`) : modifier le mapping `projectsData` et ajouter `"Clients"` dans le tableau `head`. La colonne « Clients » s'insérerait après « Manager » :

- Ligne 130 (`const projectsData = data.projectDetails.map(...)`) : ajouter `p.clients?.join(', ') || '-'`
- Ligne 142 (tableau `head`) : ajouter `"Clients"` dans la liste des headers

**Excel** (`export.service.ts:226–254`) : modifier `projectsHeader` (ligne 226) et le mapping (ligne 241) de façon identique.

La colonne « Clients » n'existe pas dans `AnalyticsData.projectDetails` aujourd'hui — il faudra ajouter `clients?: string[]` à l'interface (`export.service.ts:8`).

---

## Q8 — PortfolioGantt

### Fichiers pertinents

- `apps/web/app/[locale]/reports/components/PortfolioGantt.tsx` — composant wrapper
- `apps/web/src/components/gantt/types.ts` — définitions de types dont `GanttPortfolioRow`
- `apps/web/src/components/gantt/GanttTooltip.tsx` — rendu du tooltip
- `apps/web/src/components/gantt/GanttRow.tsx` — rendu de la ligne Gantt

### Interface `GanttPortfolioRow` — tous les champs

Source : `apps/web/src/components/gantt/types.ts:21–38` :

```typescript
// apps/web/src/components/gantt/types.ts:21–38
export interface GanttPortfolioRow {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  /** 0–100 */
  progress: number;
  status: string;
  health: HealthStatus;
  /** Optional metadata */
  departmentName?: string;
  /** @deprecated use manager?.firstName + manager?.lastName instead — kept for tooltip text */
  managerName?: string;
  /** Full manager object for avatar rendering */
  manager?: UserSummary | null;
  code?: string;
  priority?: string;
}
```

### Structure du tooltip

Composant : `GanttTooltip` dans `apps/web/src/components/gantt/GanttTooltip.tsx`.

La fonction `PortfolioTooltip` (lignes 151–179) rend pour `scope === 'portfolio'` :

```typescript
// apps/web/src/components/gantt/GanttTooltip.tsx:151–179
function PortfolioTooltip({ row }: { row: GanttPortfolioRow }) {
  const color = HEALTH_COLORS[row.health];
  const label = HEALTH_LABELS[row.health];
  return (
    <>
      {/* Nom du projet */}
      <div className="truncate" style={{ fontSize: 13, fontWeight: 600, ... }}>
        {row.name}
      </div>
      {/* Santé */}
      <Row label="Santé"><StatusBadge color={color} label={label} /></Row>
      {/* Chef de projet (conditionnel) */}
      {(row.manager || row.managerName) && (
        <Row label="Chef de projet">
          {row.manager && <UserAvatar user={row.manager} size="xs" />}
          {row.managerName && <span>...</span>}
        </Row>
      )}
      {/* Dates */}
      <Row label="Dates">
        <span>{format(row.startDate, 'MMM yyyy')} — {format(row.endDate, 'MMM yyyy')}</span>
      </Row>
      {/* Progrès */}
      <Row label="Progrès"><span>{Math.round(row.progress)}%</span></Row>
    </>
  );
}
```

### Point d'insertion pour `clientName`

**1. Ajouter le champ dans l'interface** (`apps/web/src/components/gantt/types.ts:38`, après `priority?`) :

```typescript
  clientName?: string;   // à ajouter après la ligne 37 (priority?: string)
```

**2. Alimenter le champ dans `projectsToPortfolioRows`** (`apps/web/app/[locale]/reports/components/PortfolioGantt.tsx:42–54`) : ajouter `clientName: p.clients?.map(c => c.name).join(', ')` dans l'objet retourné.

**3. Afficher dans `PortfolioTooltip`** (`apps/web/src/components/gantt/GanttTooltip.tsx`, après la ligne 177 — bloc `<Row label="Progrès">`) :

```typescript
{row.clientName && (
  <Row label="Client">
    <span style={{ fontSize: 12, color: '#334155' }}>{row.clientName}</span>
  </Row>
)}
```
