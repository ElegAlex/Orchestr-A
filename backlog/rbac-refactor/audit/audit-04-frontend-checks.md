# Audit 04 — Contrôles d'accès côté frontend

> Phase 0, §1.4 — Audit des contrôles d'accès côté frontend. Scope : `apps/web/` (Next.js 16 App Router + React 19 + Zustand + TanStack Query + next-intl). Backend hors scope.

---

## 1. Provider d'auth

### Fichiers

- **Store Zustand** : `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/stores/auth.store.ts`
- **Provider React (gate de rendu + redirects)** : `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/AuthProvider.tsx`
- **Bootstrap hook (fetch serveur au mount)** : `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/useAuthBootstrap.ts`
- **Service + persistance** : `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/services/auth.service.ts`
- **Injection globale** : `/home/alex/Documents/REPO/ORCHESTRA/apps/web/app/layout.tsx` (wrap `<AuthProvider>`)

### Shape du user exposé

Type `User` défini dans `apps/web/src/types/index.ts:125-141` :

```ts
export interface User {
  id: string;
  email: string;
  login: string;
  firstName: string;
  lastName: string;
  role: Role;                       // enum (16 valeurs : ADMIN, RESPONSABLE, MANAGER, ...)
  departmentId?: string;
  isActive: boolean;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  userServices?: UserService[];
  managedServices?: ManagedService[];
}
```

**Important** : le user ne porte **PAS** `permissions: string[]` ni d'objet `LeaveTypeConfig`. Les permissions sont stockées **séparément** dans le store (champ `permissions: string[]`) et ne sont jamais embarquées dans `User`.

### State exposé par le store (AuthState)

```ts
user: User | null;
isAuthenticated: boolean;
isLoading: boolean;
permissions: string[];
permissionsLoaded: boolean;
displayCache: AuthUserDisplay | null;  // id, email, firstName, lastName, avatar — SANS role/perms
```

### Stockage — JWT décodé côté client ? Appel API ?

**Appel API au mount.** Le JWT n'est pas décodé côté front pour extraire role/permissions. Le pattern réel (SEC-03, documenté in-code) :

1. `access_token` (+ `refresh_token` depuis SEC-04) persisté en `localStorage` via `persistSession()` dans `auth.service.ts`.
2. Un cache d'affichage minimal (`auth_user_display` = `{id, email, firstName, lastName, avatar}`) est aussi persisté — **sans rôle ni permissions**, exactement pour empêcher la privilege escalation par tampering localStorage.
3. Au montage de l'app, `useAuthBootstrap` (appelé par `AuthProvider`) vérifie le token puis fait deux appels parallèles :

```ts
Promise.all([
  api.get<User>("/auth/me").then((r) => r.data),
  api.get<{ permissions: string[] }>("/auth/me/permissions").then((r) => r.data.permissions),
])
  .then(([user, permissions]) => {
    setAuth(user, permissions);   // peuple Zustand
  })
  .catch(() => {
    clear();                       // 401 / stale / désactivé → wipe
  })
```

4. `AuthProvider` bloque le rendu (spinner) tant que `!ready || isLoading || (isAuthenticated && !permissionsLoaded)` — aucun rendu UI basé sur un état incomplet.

Le commentaire explicite du store (l. 10-22) le confirme :
> "The store holds `user` (full object incl. role) and `permissions` in memory ONLY. Neither is ever persisted to localStorage. … this makes the backend the sole source of truth for role and permissions (client cannot forge them via localStorage tampering)."

---

## 2. Hook de permission

### Fichier

`/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/hooks/usePermissions.ts`

### Signature et implémentation intégrale

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

**Retour** : `{ permissions: string[]; permissionsLoaded: boolean; hasPermission(code): boolean; hasAnyPermission(codes[]): boolean; hasAllPermissions(codes[]): boolean; }`.

### Caching / appel API

- **Pas d'appel API** dans ce hook. Il lit uniquement le store Zustand (lecture synchrone).
- **Le seul appel API permissions** se fait dans `useAuthBootstrap` (une fois, au mount / après login / après register). Pas de revalidation automatique ni de TTL.
- **Bypass ADMIN** : `user.role === Role.ADMIN` court-circuite tous les checks — **seule lecture directe autorisée** de `user.role` dans le front (documentée par le commentaire de tête du fichier : "RÈGLE RBAC FRONTEND — NE JAMAIS VÉRIFIER user.role DIRECTEMENT").

### Autres hooks RBAC

Aucun autre hook (`useCan`, `useHasRole`, `useHasPermission`) n'existe. `usePermissions` est l'unique entrée.

---

## 3. Sidebar — Items de menu

### Fichier

`/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/components/MainLayout.tsx`

Deux tableaux statiques : `navigation` (items standards) et `adminNavigation`. Chaque item porte optionnellement `permission?: string` ou `adminOnly?: boolean`. Filtrage :
- `navigation.filter(item => !item.permission || hasPermission(item.permission))`
- `adminNavigation.filter(item => item.adminOnly ? isAdmin : (!item.permission || hasPermission(item.permission)))`
- Où `isAdmin = hasPermission("users:manage_roles")` — **notez : pas `user.role === ADMIN` ici**, donc tout rôle possédant `users:manage_roles` voit `roleManagement` et `settings`.

### Navigation principale

| Clé i18n | Route | Icône | Permission requise |
|---|---|---|---|
| `dashboard` | `/:locale/dashboard` | 🎯 | *(aucune — toujours visible)* |
| `projects` | `/:locale/projects` | 📁 | `projects:read` |
| `tasks` | `/:locale/tasks` | ✓ | `tasks:read` |
| `events` | `/:locale/events` | 📣 | `events:read` |
| `planning` | `/:locale/planning` | 🗓️ | *(aucune — toujours visible)* |
| `timeTracking` | `/:locale/time-tracking` | ⏱️ | `time_tracking:read` |
| `leaves` | `/:locale/leaves` | 🏖️ | `leaves:read` |
| `telework` | `/:locale/telework` | 🏠 | `telework:read` |

### Navigation Administration

| Clé i18n | Route | Icône | Visibilité |
|---|---|---|---|
| `reports` | `/:locale/reports` | 📊 | `reports:view` |
| `users` | `/:locale/users` | 👥 | `users:manage` ⚠️ **code inexistant côté back** (cf. §6) |
| `departments` | `/:locale/departments` | 🏢 | `departments:read` |
| `skills` | `/:locale/skills` | ⭐ | `skills:read` |
| `thirdParties` | `/:locale/third-parties` | 🤝 | `third_parties:read` |
| `roleManagement` | `/:locale/admin/roles` | 🛡️ | `adminOnly` → `hasPermission("users:manage_roles")` |
| `settings` | `/:locale/settings` | ⚙️ | `adminOnly` → `hasPermission("users:manage_roles")` |

Note : `isAdmin` est mal nommé ici — ce n'est pas une vérification de rôle ADMIN, c'est un alias de `hasPermission("users:manage_roles")`.

---

## 4. Checks granulaires dans les components

80 occurrences de `hasPermission(...)` réparties sur 29 fichiers. Patterns les plus représentatifs :

| # | Fichier:ligne | Permission | Extrait / contexte |
|---|---|---|---|
| 1 | `users/page.tsx:89-91, 540, 683` | `users:create`, `:update`, `:reset_password`, `:delete` | `{canManageUsers && (<button>+ {t("createButton")}</button>)}` / `{hasPermission("users:delete") && (<button>)}` |
| 2 | `third-parties/page.tsx:36-38, 119` | `third_parties:create`, `:update`, `:delete` | `{canCreate && (<button>+ Nouveau tiers</button>)}` |
| 3 | `projects/[id]/page.tsx:882-887, 1027, 1044` | `projects:update`, `:delete`, `third_parties:assign_to_project`, `:read` | `{canEditProject && (<button>)}` / `{canDeleteProject && (<button>)}` |
| 4 | `projects/page.tsx:273-274, 306` | `projects:create` | `const canCreateProject = () => hasPermission("projects:create");` puis `{canCreateProject() && (<button>+ nouveau projet</button>)}` |
| 5 | `tasks/page.tsx:291-297, 419` | `tasks:create` OR `:create_orphan` OR `:create_in_project` | `const canCreateTask = () => hasPermission("tasks:create") \|\| hasPermission("tasks:create_orphan") \|\| hasPermission("tasks:create_in_project");` |
| 6 | `events/page.tsx:278-284, 349, 473` | `events:create`, `events:delete` | `{canCreateEvent() && (<button>+ {t("createEvent")}</button>)}` |
| 7 | `leaves/page.tsx:101-105, 871, 924` | `leaves:read`, `:approve`, `:manage`, `:declare_for_others` | `const canValidate = hasPermission("leaves:approve") \|\| isAdmin;` |
| 8 | `reports/page.tsx:44-45, 281` | `reports:view`, `reports:export` | `const canView = !permissionsLoaded \|\| hasPermission("reports:view");` |
| 9 | `skills/page.tsx:57, 444, 663, 695` | `skills:manage_matrix` | `{canManageSkills && viewMode === "skills" && (<button>Configurer</button>)}` |
| 10 | `settings/page.tsx:68-72` | `settings:update` | `useEffect(() => { if (!isAdmin) { router.push(.../dashboard); } })` — **seul route-guard-like avec redirect** |
| 11 | `telework/page.tsx:380, 393, 630` | `telework:manage_others`, `users:read` | `{canManageOthers && allUsers.length > 0 && (<section>)}` |
| 12 | `admin/predefined-tasks/page.tsx:90-91, 300, 315, 393` | `predefined_tasks:view`, `:create` | `{canCreate && (<button>+ Nouveau</button>)}` |
| 13 | `components/predefined-tasks/AssignmentModal.tsx:64, 250, 300` | `predefined_tasks:view`, `:manage`, `:create` | `{hasPermission("predefined_tasks:manage") && (<Link>Configurer…</Link>)}` ⚠️ cf. §6 |
| 14 | `components/tasks/TaskForm.tsx:297` | `tasks:assign_any_user` | `const canAssignAnyUser = hasPermission("tasks:assign_any_user");` (filtre users assignables) |
| 15 | `components/planning/PlanningGrid.tsx:207-208` | `telework:manage_others`, `predefined_tasks:assign` | `const canManageOthersTelework = hasPermission("telework:manage_others");` (prop propagée aux cellules) |
| 16 | `tasks/[id]/page.tsx:398-400, 505` | `tasks:update` | `const canEdit = () => { if (!user) return false; return hasPermission("tasks:update"); };` |
| 17 | `users/page.tsx:683-695` | `users:delete` | `{hasPermission("users:delete") && (<button disabled={user.id === currentUser?.id}>)}` |
| 18 | `components/TaskModal.tsx:105`, `TaskCreateModal.tsx:129` | `third_parties:assign_to_task` | `enableThirdParties={hasPermission("third_parties:assign_to_task")}` (prop booléenne) |

**Pattern dominant** : check évalué en top-level du component (`const canX = hasPermission("module:action")`), stocké dans variable, utilisé soit en `{canX && (…)}` soit passé en prop booléenne. Très peu de checks inline.

**Fetches conditionnels** : `tasks/page.tsx`, `events/page.tsx`, `time-tracking/page.tsx`, `dashboard/page.tsx` gate aussi les appels API (`if (hasPermission("projects:read")) { … }`) — évite les 403 côté user mais n'est pas un contrôle d'accès (le back reste l'autorité).

---

## 5. Route guards

### Pattern réel

**Il n'y a pas de route guard dédié** (pas de HOC `withAuth`, pas de middleware Next.js RBAC, pas de layout sous-arbre qui filtre).

1. **`middleware.ts`** (`/home/alex/Documents/REPO/ORCHESTRA/apps/web/middleware.ts`) — uniquement `createMiddleware` de `next-intl` pour la détection de locale. Aucune logique d'auth/RBAC :

```ts
export default createMiddleware({ locales, defaultLocale });
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

2. **`app/[locale]/layout.tsx`** — valide juste la locale, `notFound()` sinon. Aucune vérification d'auth.

3. **`app/layout.tsx`** — wrap global `<AuthProvider>` qui pilote deux choses (`AuthProvider.tsx:26-50`) :
   - bloque le rendu jusqu'à `ready && !isLoading && (permissionsLoaded \|\| !isAuthenticated)` ;
   - effectue le seul **redirect centralisé** sur la base d'une whitelist de routes publiques :

```ts
const isPublicRoute =
  pathname === "/" ||
  pathname.match(/^\/(fr|en)$/) ||
  pathname.match(/^\/(fr|en)\/login$/) ||
  pathname.match(/^\/(fr|en)\/register$/) ||
  pathname.match(/^\/(fr|en)\/forgot-password$/) ||
  pathname.match(/^\/(fr|en)\/reset-password$/);

if (!isAuthenticated && !isPublicRoute) {
  router.push(`/${locale}/login`);
} else if (isAuthenticated && (pathname.match(/^\/(fr|en)\/login$/) || pathname.match(/^\/(fr|en)\/register$/))) {
  router.push(`/${locale}/dashboard`);
}
```

4. **Redirect ad-hoc dans les pages "admin"** — seulement deux cas :
   - `settings/page.tsx:70-74` : `useEffect(() => { if (!isAdmin) router.push(.../dashboard); }, [isAdmin, router]);` où `isAdmin = hasPermission("settings:update")`.
   - `admin/roles/page.tsx:190-198` : `const isAdmin = currentUser?.role === Role.ADMIN;` puis `useEffect(() => { if (!isAdmin) return; … })` — **ne redirige pas, affiche simplement vide**.

5. **Pages comme `reports`** : pas de redirect, juste `const canView = !permissionsLoaded \|\| hasPermission("reports:view"); if (canView) { loadAnalytics() }` — l'API renvoie 403 si non autorisé, la page reste accessible visuellement.

### Conclusion

**Pas de guard de route front unifié ; auth gate global dans `<AuthProvider>` (redirect login si non-authentifié) + checks d'UI cosmétiques dans chaque page.** Deux pages (settings, admin/roles) ajoutent un `useEffect` de redirect ou un early-return basé sur une permission. Le reste des pages "privilégiées" (users, reports, third-parties, leaves, etc.) sont **accessibles par URL directe** et ne masquent que les boutons/onglets qui demandent la permission manquante. La sécurité repose intégralement sur les guards backend.

---

## 6. Codes de permissions référencés côté front — cartographie

**Source back** : `/home/alex/Documents/REPO/ORCHESTRA/docs/rbac/ROLES-PERMISSIONS.md` (119 permissions).
**Source front** : extraction des littéraux `"module:action"` dans `apps/web/src` + `apps/web/app` (49 codes distincts utilisés).

### 6.1 Permissions front inconnues du back (typos / checks morts)

| Code front | Fichier(s) | Analyse |
|---|---|---|
| `users:manage` | `MainLayout.tsx:54` | **⚠ Typo / naming drift.** Le back n'a pas `users:manage`. Résultat : la section "Users" de la sidebar est **visible uniquement pour ADMIN** (bypass ADMIN), *personne d'autre* ne la voit même avec `users:create` ou `users:update`. |
| `predefined_tasks:manage` | `AssignmentModal.tsx:250` | **⚠ Typo / drift.** Le back n'a que `predefined_tasks:edit`, `:delete`, `:assign`, `:view`, `:create`. Le lien "Configurer les tâches prédéfinies" visible uniquement pour ADMIN. |
| `anything:at_all` | `hooks/usePermissions.test.ts:37` | **Faux positif** — test unitaire du bypass ADMIN. À ignorer. |
| `auth:cleared` | `lib/api.ts:47`, `hooks/useAuthBootstrap.ts:30-31` | **Faux positif** — nom d'event DOM (`new Event("auth:cleared")`). À ignorer. |

**Vrais trous de naming** : **2** (`users:manage`, `predefined_tasks:manage`).

### 6.2 Permissions back jamais utilisées en front (capacités non exposées)

**71 permissions** du catalogue back n'apparaissent nulle part dans le code front. Catégorisation :

#### A. Normal (back-only — logique métier interne)
- `*:manage_any` (bypass OwnershipGuard) : `events:manage_any`, `leaves:manage_any`, `projects:manage_any`, `tasks:manage_any`, `time_tracking:manage_any`
- `*:readAll` côté leaves/telework : `leaves:readAll`, `telework:readAll` (scope-filter côté API)
- `time_tracking:view_any`, `time_tracking:read_reports`, `leaves:manage_delegations` : back-only
- `analytics:read`, `analytics:export` : le front utilise `reports:view` / `reports:export` → **deux modules parallèles** dans le back

#### B. Capacités CRUD non exposées dans l'UI (= features cachées / gap UI)
- **Comments** (`comments:create/update/delete/read`) : aucun check front
- **Documents** (`documents:*`) : idem
- **Epics** (`epics:create/update/delete/read`) : aucun check
- **Milestones** (`milestones:*`) : aucun check (`MilestoneModal.tsx` n'appelle pas `hasPermission`)
- **Holidays** (`holidays:*`) : aucun check
- **School vacations** (`school_vacations:*`) : aucun check
- **Services** (`services:*`) : aucun check
- **Telework recurring** (`telework:manage_recurring`, `:create`, `:update`, `:delete`) : aucun check (`RecurringRulesModal.tsx` ne check que `users:read`)
- **Leaves** CRUD (`leaves:create`, `:update`, `:delete`, `:view`) : front ne check que `leaves:read / approve / manage / declare_for_others`
- **Tasks delete** (`tasks:delete`) : jamais checké côté front
- **Settings read** (`settings:read`) : front check `settings:update`, jamais `settings:read`
- **Users import** (`users:import`) : bouton "Import" gate via `users:create`, pas `:import`

### 6.3 Écarts de naming réels (impact UX)

| Front appelle | Back expose | Conséquence |
|---|---|---|
| `users:manage` (sidebar) | `users:manage_roles`, `users:create`, `users:update`, `users:delete`, `users:reset_password` | Item "Users" invisible pour non-ADMIN même avec permissions légitimes |
| `predefined_tasks:manage` (modal) | `predefined_tasks:edit` / `:create` / `:delete` / `:assign` / `:view` | Lien "Configurer" invisible pour non-ADMIN |
| `users:manage_roles` (proxy "isAdmin" sidebar) | Existe (OK) | Mais proxy ADMIN discutable : un rôle avec seulement `users:manage_roles` accède à `/admin/roles` et `/settings` |
| `reports:view` / `reports:export` | Existent ; back expose aussi `analytics:read/export` | Doublon back, pas un trou front |
| `tasks:readAll`, `events:readAll` | Existent (camelCase — convention incohérente avec `manage_any` snake_case) | Convention mixte fragile |

---

## 7. Lecture du store d'auth & impact re-render

### Mode de consommation

Deux patterns cohabitent :

**Pattern 1 — sélecteur atomique (bon, pas de re-render inutile)**
- `dashboard/page.tsx:31` : `const user = useAuthStore((state) => state.user);`
- `tasks/page.tsx:33`, `projects/page.tsx:30`, `events/page.tsx:26`, `telework/page.tsx:372`, `time-tracking/page.tsx:25`, `profile/page.tsx:31-33`, `leaves/page.tsx:36`, `admin/roles/page.tsx:163`, `TaskCreateModal.tsx:33`, `EventCreateModal.tsx:29`, `PlanningGrid.tsx:204`, `PlanningView.tsx:60`
- `hooks/useAuthBootstrap.ts:21-23` : sélecteurs atomiques

**Pattern 2 — destructuration complète (mauvais, re-render sur chaque changement du store)**
- `hooks/usePermissions.ts:17` : `const { permissions, permissionsLoaded, user } = useAuthStore();` → **aucun sélecteur**
- `components/MainLayout.tsx:23` : `const { user, logout } = useAuthStore();`
- `components/AuthProvider.tsx:12` : `const { isAuthenticated, isLoading, permissionsLoaded } = useAuthStore();`
- `tasks/[id]/page.tsx:55` : `const { user } = useAuthStore();`
- `skills/page.tsx:19` : `const { user: currentUser } = useAuthStore();`

### Impact sur les re-renders

- **`usePermissions`** est utilisé dans ~29 fichiers ; à chaque appel il souscrit à *toutes* les slices du store. Conséquences :
  - Chaque fois que `isLoading` change (setLoading true/false au bootstrap), chaque `displayCache` refresh, chaque `setUser`, **tous les consumers de `usePermissions` re-rendent**.
  - `hasPermission` est recréé à chaque render (nouvelle identité fonction), donc les `useEffect([hasPermission, …])` sont à éviter.
- **`hasPermission(code)`** est synchrone O(n) (array `.includes`) : sur ~80 appels top-level, négligeable (n < 120).
- **Chaque check** déclenche un re-render seulement si le composant est déjà subscribed au store via `useAuthStore()` sans sélecteur.

### Recommandation (pour Spec 3)

- Convertir `const { ... } = useAuthStore()` en sélecteurs atomiques `useAuthStore(s => s.permissions)`, `useAuthStore(s => s.user?.role)`, etc.
- Envelopper les handlers `hasPermission`, `hasAnyPermission`, `hasAllPermissions` dans un `useMemo` ou réécrire `usePermissions` avec sélecteurs shallow.

---

## 8. Incertitudes

1. **`users:manage` (sidebar)** : intention ? Typo historique pour `users:manage_roles` ? Ou ancienne permission supprimée du back ? Impact : item "Users" caché pour tout non-ADMIN, y compris managers devant créer/éditer leurs users.

2. **`predefined_tasks:manage` (AssignmentModal)** : idem. Candidats de remplacement : `predefined_tasks:edit` ou `predefined_tasks:create`.

3. **Doublons back `:edit` vs `:update`, `:view` vs `:read`** : le front a convergé vers `:read` et `:update`. À vérifier si le back vérifie réellement les variantes orphelines.

4. **Frontier `analytics:*` vs `reports:*`** : le front ne référence que `reports:view` / `reports:export` alors que le back expose les deux familles. Redondants ou sémantiquement distincts ?

5. **Re-render cost réel** : évalué sur lecture statique. Un profiling React DevTools à chaud serait nécessaire pour quantifier l'impact.

6. **Route `/planning`** : sidebar l'affiche sans permission gating, mais le composant interne (`PlanningView`) vérifie `telework:read_team` etc. Un user sans aucune permission RH voit-il une page blanche ou une erreur ?

7. **`tasks:create_orphan` / `tasks:create_in_project`** : existent côté back mais non vérifiées via `@Permissions()` (cf. audit-02). Front les OR avec `tasks:create`, suggérant relation hiérarchique.

8. **`permissionsLoaded` flag** : seul `reports/page.tsx` utilise le fallback `!permissionsLoaded || hasPermission(...)` pour permettre le premier render optimiste. Les autres masquent silencieusement — acceptable car le spinner `<AuthProvider>` bloque jusqu'à `permissionsLoaded`.
