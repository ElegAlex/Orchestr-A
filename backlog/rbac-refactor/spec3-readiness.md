# Spec 3 — Readiness Phase 0

**Date :** 2026-04-20
**Pré-requis Spec 2 :** V0→V3 + V2bis + V2ter déployés en prod (HEAD master `88829af`).
**Statut global :** **PRÊT sous réserve de 1 blocker et 2 points PO** (détaillés §3).

---

## 1. Vérification déploiement Spec 2

### 1.1 `/api/roles/templates` (ADMIN `alexandre.berge`)

```
GET https://orchestr-a.com/api/roles/templates → 200, 26 entries
```

✅ Les 26 templates sont exposés en prod comme attendu (contract-05 §1.1).

### 1.2 Shape du user depuis `/api/auth/me`

```json
{
  "id": "843555cf-5a31-4ba6-bb30-88f9fa0f0f80",
  "role": "ADMIN",
  "roleId": "76d93232-e94e-4669-be3b-9eea97958b72",
  "roleEntity": {
    "id": "76d93232-e94e-4669-be3b-9eea97958b72",
    "code": "ADMIN",
    "label": "Administrateur",
    "templateKey": "ADMIN",
    "isSystem": true
  }
}
```

✅ Le JWT expose bien `roleEntity.code` + `roleEntity.templateKey` + `roleEntity.label`. Le hook `usePermissions` post-refactor pourra lire `user.roleEntity.templateKey` directement.

**Écart vs contract-04 §2.7** : le shape spéc (`request.user.role = { id, code, label, templateKey }`) imagine un champ `role` objet remplaçant l'enum. Le back actuel conserve **à la fois** `role: "ADMIN"` (enum legacy) **et** `roleEntity: { … }` (objet). C'est attendu — la suppression du champ `role` (string) est Spec 2 V4, pas V3. Spec 3 lit `roleEntity.*` et doit **éviter** toute nouvelle consommation de `user.role` string. Point de vigilance pour Teammate A.

---

## 2. Baselines frontend

### 2.1 Type-check (`pnpm --filter web exec tsc --noEmit`)

**96 erreurs TS** pré-existantes. Ce baseline est stable depuis plusieurs semaines (Spec 2 n'a rien changé côté web). Spec 3 doit ne pas l'aggraver — la cible est ≤ 96 en fin de Vague 2, idéalement en baisse (remplacement des `user.role === 'ADMIN'` par `usePermissions` typé PermissionCode retire potentiellement des erreurs de string comparison).

### 2.2 Lint (`pnpm --filter web lint`)

```
✖ 34 problems (10 errors, 24 warnings)
```

**10 erreurs + 24 warnings** — pré-existant. Baseline à respecter. Critères d'acceptation §5 : `pnpm --filter web build` passe sans warning nouveau.

### 2.3 Package `rbac` consommable depuis `apps/web` — **BLOCKER**

```
grep '"rbac"' apps/web/package.json → aucun match
grep '"rbac"' apps/web/src → aucun match
```

❌ `apps/web/package.json` n'a **pas** `rbac` en dépendance workspace. Aucun fichier front n'importe `rbac` ni `@orchestra/rbac`.

**Impact :** Vague 0 (teammate A) ne peut pas créer `usePermissions` typé `PermissionCode` sans d'abord ajouter `"rbac": "workspace:*"` à `apps/web/package.json` + `pnpm install` pour relancer la résolution. **Tâche Vague 0 #1 obligatoire**, avant tout refactor de hook.

Nota : le Dockerfile `apps/web/Dockerfile` copie déjà `packages/rbac` en build stage (ajouté en commit `d359dd0` durant Spec 2 V0 deploy) — la plumberie Docker est prête, il ne manque que la dépendance `package.json` + l'import TS.

---

## 3. Inventaire fichiers front à toucher (cross-check contract-05 §5)

### 3.1 Existants (7/8)

| Chemin | Taille | Rôle |
|---|---|---|
| `apps/web/src/hooks/usePermissions.ts` | 43 L | Hook actuel — à refactorer (typage strict, sélecteurs atomiques) |
| `apps/web/src/stores/auth.store.ts` | 140 L | Store Zustand — shape user à adapter post contrat-04 §2.7 |
| `apps/web/src/types/index.ts` | ? | Contient enum `Role` legacy — retirer en fin Spec 3 V2 |
| `apps/web/src/components/MainLayout.tsx` | ? | Sidebar (teammate B) |
| `apps/web/src/components/predefined-tasks/AssignmentModal.tsx` | ? | Check D6 #3 à corriger |
| `apps/web/app/[locale]/admin/roles/page.tsx` | **785 L** | Ancienne UI admin — **à supprimer** (teammate E), remplacée par galerie |
| `apps/web/src/services/role-management.service.ts` | 107 L | À renommer en `roles.service.ts`, simplifier API |

### 3.2 Manquants (1/8)

| Chemin | Action | Vague |
|---|---|---|
| `apps/web/src/components/withAccessControl.tsx` | CRÉER (HOC D10) | Vague 0 (teammate A) |

### 3.3 Nouveaux composants à créer (contract-05 §5.4)

- `apps/web/src/components/roles/TemplateGalleryCard.tsx`
- `apps/web/src/components/roles/RoleFromTemplateModal.tsx`
- `apps/web/src/components/roles/SystemBadge.tsx`
- `apps/web/src/components/roles/UserRoleSelect.tsx`

Aucun existe actuellement (répertoire `apps/web/src/components/roles/` absent). Vague 1 D (teammate D).

### 3.4 État actuel du hook (observation importante)

```ts
// apps/web/src/hooks/usePermissions.ts:14-19
import { Role } from "@/types";
export function usePermissions() {
  const { permissions, permissionsLoaded, user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;   // ← hardcode enum legacy
  const hasPermission = (code: string): boolean => {
    if (isAdmin) return true;                  // ← bypass ADMIN
    return permissions.includes(code);
  };
```

Le hook actuel (a) type `code: string` non contraint et (b) bypass codé en dur `user.role === Role.ADMIN`. Ces deux points sont exactement ce que Spec 3 V0 doit retirer :
- `code: PermissionCode` (typage strict depuis `rbac`).
- Bypass ADMIN reste prévu par le contrat-04 §3.1 mais via `user.roleEntity.code === 'ADMIN'` (nouveau chemin) — pas via enum legacy.

Ce n'est pas un blocker, juste le point de départ du refactor Vague 0.

---

## 4. Tests E2E existants (baseline pour détection régression)

### 4.1 Fichiers RBAC-pertinents

```
e2e/permissions.spec.ts
e2e/fixtures/permission-matrix.ts       ← 6 rôles legacy (admin → observateur)
e2e/fixtures/roles.ts
e2e/tests/rbac/api-permissions.spec.ts
e2e/tests/rbac/ui-permissions.spec.ts
e2e/tests/multi-role/*.spec.ts          ← 6 fichiers
```

### 4.2 Constats

- `permission-matrix.ts` liste **6 rôles legacy** (`admin`, `responsable`, `manager`, `referent`, `contributeur`, `observateur`). Contract-05 §5.5 demande l'extension à **26 templates**. Teammate F doit créer une version étendue sans casser les tests existants (deux options : doubler la matrice, ou remplacer après migration des specs qui l'utilisent).
- `e2e/permissions.spec.ts` à la racine **et** `e2e/tests/rbac/*.spec.ts` — il y a redondance potentielle. À auditer par teammate F au moment de Vague 1 E pour éviter doublons.

### 4.3 Non-bloquant mais à flagger

Les tests `e2e/tests/rbac/ui-permissions.spec.ts` dépendent probablement de sélecteurs liés à l'ancienne UI admin (`/admin/roles/page.tsx` 785 L). Sa suppression en Vague 2 (teammate E) cassera ces tests si non anticipée. Teammate F doit **d'abord** écrire les nouveaux tests sur la nouvelle galerie **avant** que teammate E supprime l'ancienne page.

---

## 5. Synthèse Phase 0

### Go / No-Go

| # | Check | État |
|---|---|---|
| 1 | Spec 2 déployée prod | ✅ (V0→V3 + V2bis + V2ter, 107 perms ADMIN validé) |
| 2 | `/api/roles/templates` → 26 | ✅ |
| 3 | JWT `user.roleEntity.templateKey` exposé | ✅ |
| 4 | Baseline type-check | ✅ 96 erreurs TS à respecter |
| 5 | Baseline lint | ✅ 34 problèmes à respecter |
| 6 | Package `rbac` consommable depuis `apps/web` | ❌ **BLOCKER** — à ajouter dans Vague 0 #1 |
| 7 | Fichiers contract-05 §5 localisés | ✅ 7/8 existent ; `withAccessControl.tsx` à créer |
| 8 | Baseline E2E RBAC | ✅ inventaire fait ; extension matrice + ordre Vague 1 E à coordonner |

### Points PO à arbitrer avant Vague 0

**(P1) Dépendance `rbac` côté web** — ajouter `"rbac": "workspace:*"` dans `apps/web/package.json`, puis `pnpm install`. Action triviale mais irréversible sans revert ; je confirme et exécute quand PO valide.

**(P2) Cohabitation `user.role` (enum) et `user.roleEntity` (objet)** — contract-04 §2.7 imagine `user.role = { id, code, label, templateKey }` remplaçant l'enum. La prod actuelle a les deux. Spec 3 doit **consommer `user.roleEntity`** et **ne jamais lire `user.role` (string)** — confirmation PO sur cette règle ?

**(P3) Ordre Vagues 2 vs 1 E** — Teammate E supprime l'ancienne page `/admin/roles/page.tsx` (785 L). Les tests E2E actuels `e2e/tests/rbac/ui-permissions.spec.ts` risquent de s'appuyer dessus. Proposition : inverser localement les vagues en faisant Vague 1 E (écriture nouveaux tests) **avant** Vague 2 (suppression ancienne UI). PO d'accord ?

---

## 6. Prochaines étapes (si PO valide)

1. Résoudre P1 (ajout dépendance rbac) — ~2 min.
2. Vague 0 Teammate A — refactor `usePermissions` + nouveau hook typé `PermissionCode` + `withAccessControl.tsx`. Tests unitaires Jest.
3. Arrêt pour validation PO avant Vague 1 (B, C, D en parallèle).
