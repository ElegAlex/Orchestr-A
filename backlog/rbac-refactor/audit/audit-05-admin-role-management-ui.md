# Audit 05 — UI admin "Gestion des rôles"

> Phase 0, §1.5 — Audit de l'UI admin qui sera largement démantelée en Spec 3 au profit d'une galerie de templates.

---

## 1. Page "Gestion des rôles" — structure fichiers

**Un seul fichier**, tout est inline (pas de sous-composants externalisés).

- `/home/alex/Documents/REPO/ORCHESTRA/apps/web/app/[locale]/admin/roles/page.tsx` (786 lignes)

### Arbre logique du fichier

```
page.tsx
├── Constantes locales
│   ├── FEATURE_LABELS                   (labels FR par module)
│   ├── FEATURE_ORDER                    (ordre d'affichage des modules)
│   └── ACTION_LABELS                    (labels FR par action)
├── Helpers : getActionLabel / getFeatureLabel
├── Composant PermissionGroup (inline)   (§2 — matrice par module)
└── Composant RolesPage (default export)
    ├── États : roles, permissions, selectedPermissions, formData, modales
    ├── Guard : isAdmin = currentUser?.role === Role.ADMIN (legacy enum)
    ├── Handlers : fetchRoles, fetchPermissions, handleCreate, handleEditInfo,
    │              handleSavePermissions, handleDelete, handleInitialize,
    │              togglePermission, toggleAllPermissionsForModule
    ├── Rendu : header + table des rôles (name/code/nb perms/isSystem/actions)
    ├── Create Modal (inline JSX)
    └── Edit Modal (inline JSX — form infos + matrice permissions)
```

**Note** : aucun fichier `.tsx` séparé pour la matrice, le form, le modal ou le sélecteur — tout est coalescé dans `page.tsx`.

---

## 2. Composants enfants (tous inline dans `page.tsx`)

| # | Composant | Localisation | Rôle |
|---|---|---|---|
| 2.1 | `PermissionGroup` | `page.tsx:103-158` | Affiche les permissions d'un module sous forme de pills/checkbox avec toggle "Tout activer/désactiver" |
| 2.2 | Create Modal | `page.tsx:540-621` | Form création d'un rôle custom (code/nom/description, pas de permissions à ce stade) |
| 2.3 | Edit Modal | `page.tsx:624-782` | Form infos + matrice complète de permissions (sauvegarde séparée infos vs permissions) |
| 2.4 | Confirm Delete | `page.tsx:311` | `window.confirm(t("confirmDelete"))` — **natif browser, pas de modal custom** |
| 2.5 | Sélecteur de rôle par utilisateur | `apps/web/app/[locale]/users/page.tsx:819-831` et `1214-1226` | `<select>` natif alimenté par `availableRoles` (fetché via `roleManagementService.getAllRoles()`) |

### 2.1 PermissionGroup (matrice par module)

```tsx
// page.tsx:133-156
<div className="flex flex-wrap gap-2">
  {permissions.map((perm) => {
    const isActive = selectedPermissions.has(perm.id);
    return (
      <label key={perm.id}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ... ${
          isActive ? "bg-blue-600 text-white ..." : "bg-white text-gray-700 ..."}`}>
        <input type="checkbox" checked={isActive}
          onChange={() => onToggle(perm.id)} className="sr-only" />
        {getActionLabel(perm.action)}
      </label>
    );
  })}
</div>
```

### 2.2 Create Modal (form création rôle)

```tsx
// page.tsx:546-618 (condensé)
<form onSubmit={handleCreate} className="space-y-4">
  <input required value={formData.code}
         onChange={(e) => setFormData({ ...formData,
           code: e.target.value.toUpperCase() })}
         placeholder="EX: CUSTOM_ROLE" />
  <input required value={formData.name} ... placeholder="Ex: Gestionnaire" />
  <textarea value={formData.description} ... />
  <button type="submit">{tCommon("actions.create")}</button>
</form>
```

### 2.3 Edit Modal (form infos + matrice)

```tsx
// page.tsx:652-709 (form infos, condensé)
<form onSubmit={handleEditInfo}>
  <input type="text" disabled={editingRole.isSystem} value={formData.code} ... />
  <input type="text" required value={formData.name} ... />
  <textarea value={formData.description} ... />
  <button type="submit">Mettre à jour les infos</button>
</form>

// page.tsx:711-759 (matrice, condensé)
<div className="border-t pt-6">
  <button onClick={handleSavePermissions}>{t("savePermissions")}</button>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {sortedModules.map((module) => (
      <PermissionGroup key={module} module={module}
        permissions={permissions[module] ?? []}
        selectedPermissions={selectedPermissions}
        onToggle={togglePermission}
        onToggleAll={toggleAllPermissionsForModule} />
    ))}
  </div>
</div>
```

### 2.4 Confirm Delete (natif)

```tsx
// page.tsx:305-318
const handleDelete = async (role: RoleConfigWithPermissions) => {
  if (role.isSystem) {
    toast.error(t("cannotDeleteSystem"));
    return;
  }
  if (!confirm(t("confirmDelete"))) return;
  try {
    await roleManagementService.deleteRole(role.id);
    toast.success(t("messages.deleteSuccess"));
    fetchRoles();
  } catch (err) { ... }
};
```

### 2.5 Sélecteur de rôle par utilisateur

```tsx
// apps/web/app/[locale]/users/page.tsx:819-831 (modal création)
<select value={formData.role}
  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}>
  {availableRoles.map((role) => (
    <option key={role.code} value={role.code}>{role.name}</option>
  ))}
</select>
```

`availableRoles` est un `useState<RoleConfigWithPermissions[]>` peuplé par `roleManagementService.getAllRoles()` (page.tsx:96-102). Le même `<select>` est dupliqué dans le modal d'édition (lignes 1214-1226).

**Typage incohérent** : `formData.role` est typé `Role` (enum legacy 15 valeurs codées en dur dans `apps/web/src/types/index.ts:5`), mais les `option.value` proviennent de `roleConfig.code` (dynamique côté DB). Un rôle custom créé via `/admin/roles` serait donc cassé par le cast `as Role`.

---

## 3. Endpoints backend alimentant cette UI

### 3.1 `apps/api/src/role-management/role-management.controller.ts`

| Verbe | Path | Protection | Résumé |
|---|---|---|---|
| `GET` | `/role-management/roles` | `@Roles(Role.ADMIN)` | Liste tous les rôles + permissions (include relations Prisma) |
| `POST` | `/role-management/roles` | `@Roles(Role.ADMIN)` | Crée un rôle custom (`isSystem: false`, conflict 409 si code dupliqué) |
| `GET` | `/role-management/roles/:id` | `@Roles(Role.ADMIN)` | Détail rôle + permissions |
| `PATCH` | `/role-management/roles/:id` | `@Roles(Role.ADMIN)` | MAJ nom/description (**ne bloque PAS isSystem côté service** — voir §6) |
| `DELETE` | `/role-management/roles/:id` | `@Roles(Role.ADMIN)` | Supprime un rôle — `BadRequestException` si `isSystem: true` |
| `GET` | `/role-management/permissions` | `@Roles(Role.ADMIN)` | Liste permissions groupées par module |
| `PUT` | `/role-management/roles/:id/permissions` | `@Roles(Role.ADMIN)` | Remplace les permissions (delete-all + create-many, **ne bloque PAS isSystem**) |
| `POST` | `/role-management/seed` | `@Roles(Role.ADMIN)` | Déclenche `seedPermissionsAndRoles` idempotent (même logique que `onModuleInit`) |
| `POST` | `/role-management/reset-to-defaults` | `@Permissions('users:manage_roles')` | Réinitialise les permissions des rôles système aux valeurs par défaut (force = true) — **UI ne l'expose pas** |

**Incohérence RBAC** : tous les endpoints utilisent `@Roles(Role.ADMIN)` (rôle statique), sauf `reset-to-defaults` qui bascule sur `@Permissions('users:manage_roles')` (permission dynamique). À revoir en Spec 3.

### 3.2 `apps/api/src/users/users.controller.ts` — changement de rôle d'un user

| Verbe | Path | Protection | Résumé |
|---|---|---|---|
| `GET` | `/users` (query `?role=`) | `@Permissions('users:read')` | Liste users filtrable par rôle (enum legacy) |
| `GET` | `/users/role/:role` | `@Permissions('users:read')` | Users par rôle (paramètre enum) |
| `PATCH` | `/users/:id` | `@Permissions('users:update')` | MAJ user — si `updateUserDto.role` présent, déclenche le check hiérarchique |

**Il n'y a PAS d'endpoint dédié `changeRole`** — le changement de rôle passe par `PATCH /users/:id` avec le champ `role` dans le body.

Logique hiérarchique dans `apps/api/src/users/users.service.ts:305-327` :

```ts
if (updateUserDto.role && callerRole) {
  if (updateUserDto.role === 'ADMIN' && callerRole !== 'ADMIN') {
    throw new ForbiddenException('Seul un administrateur peut attribuer le rôle ADMIN');
  }
  if (!this.canAssignRole(callerRole, updateUserDto.role)) {
    throw new ForbiddenException('Vous ne pouvez attribuer que des rôles inférieurs au vôtre');
  }
}
```

`canAssignRole` s'appuie sur un `ROLE_HIERARCHY` en dur (users.service.ts:54) — **incompatible avec des rôles custom** créés via l'UI.

---

## 4. Service frontend — `role-management.service.ts`

Chemin : `/home/alex/Documents/REPO/ORCHESTRA/apps/web/src/services/role-management.service.ts`

```ts
export const roleManagementService = {
  getAllRoles():                          Promise<RoleConfigWithPermissions[]>
  createRole(data: CreateRoleConfigDto):  Promise<RoleConfigWithPermissions>
  getRole(id: string):                    Promise<RoleConfigWithPermissions>
  updateRole(id, data: UpdateRoleConfigDto): Promise<RoleConfigWithPermissions>
  deleteRole(id: string):                 Promise<void>
  getAllPermissions():                    Promise<PermissionsGroupedByModule>
  replaceRolePermissions(id, permissionIds: string[]): Promise<RoleConfigWithPermissions>
  seedPermissionsAndRoles():              Promise<{ message, permissionsCreated, rolesCreated }>
}
```

Type helper : `PermissionsGroupedByModule = { [module: string]: Permission[] }`.

**Aucun appel à `POST /role-management/reset-to-defaults`** exposé dans ce service : le bouton "Initialiser" (`handleInitialize`, page.tsx:327) appelle `seedPermissionsAndRoles()` (`POST /seed`), pas le reset. Le endpoint `reset-to-defaults` est **inaccessible depuis l'UI**.

---

## 5. Patterns réutilisables — verdict

| Composant | Chemin | Verdict | Raison |
|---|---|---|---|
| `PermissionGroup` (matrice par module) | `page.tsx:103-158` | **JETER** | Finalité = édition des permissions atomiques par l'admin. La galerie de templates enferme les perms dans la définition du template : plus d'édition manuelle de la matrice. |
| Edit Modal (form infos + matrice) | `page.tsx:624-782` | **JETER** | Couple (infos libres + permissions atomiques) = l'antithèse de la philosophie "templates". |
| Create Modal (form code/nom/description) | `page.tsx:540-621` | **REFACTORER** | Squelette réutilisable pour un éventuel "Créer rôle depuis template" : garder nom/description, remplacer le champ `code` libre par une sélection de template. |
| Confirm Delete (`window.confirm`) | `page.tsx:305-325` | **REFACTORER** | Pattern `if (isSystem) toast.error; else confirm; else delete` encore valide ; remplacer par un modal custom (référence : `apps/web/src/components/third-parties/ThirdPartyDeleteConfirmModal.tsx`). |
| Table des rôles | `page.tsx:446-536` | **REFACTORER** | Layout tabulaire pertinent pour une liste "rôles actifs" ; remplacer colonne "nb permissions" par "template source" + date d'attribution. |
| Badge `isSystem` (icône bouclier + pill bleu) | `page.tsx:490-507` et `631-648` | **CONSERVER** | Concept de rôle "système non supprimable" reste valide. Extraire en `<SystemBadge />`. |
| Bouton "Initialiser permissions/rôles" | `page.tsx:422-429` | **JETER** | Le seed doit rester déclenché par `onModuleInit` côté API. Exposer un bouton manuel = source de confusion. |
| Sélecteur rôle utilisateur (`<select>`) | `users/page.tsx:819-831 / 1214-1226` | **REFACTORER et EXTRAIRE** | Pattern `UserRoleSelect` réutilisable (fetch dynamique, option = code/name). Problème d'interop avec `enum Role` statique à corriger. |
| Dictionnaires `FEATURE_LABELS` / `ACTION_LABELS` / `FEATURE_ORDER` | `page.tsx:16-85` | **REFACTORER** | Traductions FR des codes perms — à migrer vers `messages/fr/admin.json` ou un registre central (utile aussi pour la galerie en lecture seule). |
| `roleManagementService.*` | `services/role-management.service.ts` | **REFACTORER (partiel)** | Garder `getAllRoles`/`getRole`/`deleteRole`. Retirer/restreindre `replaceRolePermissions`/`createRole` libre / `seedPermissionsAndRoles`. |

---

## 6. Liens avec le seed et protection des rôles `isSystem`

### 6.1 Le seed idempotent

- `RoleManagementService.seedPermissionsAndRoles()` (`role-management.service.ts:44`) appelé automatiquement par `onModuleInit()` — garde-fou au boot.
- Le seed fait un `upsert` Prisma sur `code` pour rôles et permissions, puis un `createMany(...skipDuplicates: true)` pour les `RolePermission` (lignes 1037-1092). Idempotent : n'écrase jamais les perms ajoutées manuellement.
- Un mode "force" existe (`_syncPermissionsAndRoles(true)` via `POST /role-management/reset-to-defaults`, lignes 1007-1036) qui supprime toutes les `rolePermission` et les recrée. **Non exposé dans l'UI.**

### 6.2 L'UI permet-elle de modifier des rôles système ?

**Oui, partiellement — et la protection est inconsistante** :

| Action sur rôle `isSystem: true` | Front bloque ? | Back bloque ? |
|---|---|---|
| **Supprimer** (`DELETE /roles/:id`) | Oui — bouton `disabled` + vérif `handleDelete` | Oui — `BadRequestException` |
| **Changer le `code`** (PATCH `/roles/:id`) | Oui — input `disabled` + payload conditionnel (page.tsx:263-272) | **NON bloqué** — `updateRole` ne vérifie pas `isSystem`. Le DTO `UpdateRoleDto` (`update-role.dto.ts`) n'expose que `name` et `description` — class-validator stripper dépend de `whitelist: true` dans le ValidationPipe global. **À vérifier**. |
| **Changer `name` / `description`** | Non — autorisé | Non — autorisé |
| **Modifier la matrice de permissions** (`PUT /roles/:id/permissions`) | **NON bloqué** — `handleSavePermissions` (page.tsx:285) ne teste jamais `isSystem` ; bouton toujours actif | **NON bloqué** — `replaceRolePermissions` ne teste jamais `isSystem` |

**Conclusion §6** : aujourd'hui, un admin peut **librement réécrire les permissions d'un rôle système** (ex. ADMIN, RESPONSABLE) via l'UI. Le seed ne les restaurera pas au prochain boot (non-force). Seul `POST /role-management/reset-to-defaults` (non exposé dans l'UI) permet de revenir en arrière.

**Faille de cohérence** à traiter en Spec 3 :
- soit ajouter côté back `if (role.isSystem) throw new BadRequestException(...)` dans `replaceRolePermissions` et `updateRole`,
- soit assumer la modification et prévoir un rollback lisible dans l'UI.

---

## 7. Incertitudes

1. **Validation globale NestJS** : non confirmé si le `ValidationPipe` global active `whitelist: true` + `forbidNonWhitelisted: true`. Si non, un `PATCH /roles/:id` avec `{ code: "X", isSystem: false }` dans le body passerait. Si oui, les champs hors DTO sont silencieusement droppés. → Vérification à inclure dans `main.ts`.
2. **Rôle enum legacy vs RoleConfig dynamique** : `User.role` côté Prisma est vraisemblablement un enum statique — à confirmer dans `packages/database/prisma/schema.prisma`. Si enum figé, créer un rôle custom via `/admin/roles` ne permet pas de l'assigner à un user (backend rejette à la validation). **Central pour Spec 3**.
3. **Endpoint `reset-to-defaults`** : aucun appel détecté côté `apps/web` (grep exhaustif non réalisé ; à confirmer).
4. **Pattern "UserSelectWithRole"** : non trouvé sous ce nom. Le plus proche = `<select>` inline dans `users/page.tsx` (§2.5).
5. **`page.tsx` des rôles n'importe pas de composants partagés** hormis `MainLayout` — rien à casser ailleurs en supprimant la page.
