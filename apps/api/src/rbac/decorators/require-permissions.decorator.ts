import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from 'rbac';

/**
 * Métadonnées clés (réutilisent la clé existante PERMISSIONS_KEY pour
 * compatibilité descendante avec l'ancien `PermissionsGuard` actif jusqu'à V4).
 */
export const REQUIRE_PERMISSIONS_KEY = 'permissions';
export const REQUIRE_ANY_PERMISSION_KEY = 'permissions_any';

/**
 * Restreint l'accès aux utilisateurs dont le rôle possède **toutes** les
 * permissions listées (sémantique AND). Typage strict `PermissionCode` —
 * tout typo casse le build.
 *
 * Aligne sur le contrat-04 §2.3. Émet la même clé de métadonnées que
 * l'ancien `@Permissions()` pour compat descendante : tant que le
 * PermissionsGuard legacy est actif, les deux décorateurs sont équivalents.
 *
 * @example
 *   @RequirePermissions('projects:create')
 *   @Post()
 *   createProject() { ... }
 *
 *   @RequirePermissions('tasks:update', 'projects:manage_members')
 *   @Patch(':id')
 *   update() { ... }
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

/**
 * Restreint l'accès aux utilisateurs dont le rôle possède **au moins une**
 * des permissions listées (sémantique OR).
 *
 * Utilisation type : routes où plusieurs permissions sont pertinentes
 * (ex. `POST /tasks` accordable via `tasks:create`, `tasks:create_orphan` ou
 * `tasks:create_in_project`).
 */
export const RequireAnyPermission = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);
