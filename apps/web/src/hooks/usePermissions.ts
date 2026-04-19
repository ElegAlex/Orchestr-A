/**
 * RÈGLE RBAC FRONTEND — NE JAMAIS VÉRIFIER user.role DIRECTEMENT
 *
 * Tout check d'autorisation dans le frontend passe par ce hook.
 *
 * La résolution se base UNIQUEMENT sur le tableau `permissions` du store,
 * peuplé par `/api/auth/me/permissions`. Pour ADMIN, le template contient déjà
 * l'ensemble des 107 codes du catalogue — il n'y a donc plus de bypass par
 * rôle côté frontend (Spec 3 V0).
 *
 * Exemples :
 *   const { hasPermission } = usePermissions();
 *   if (hasPermission('projects:create')) { ... }
 *   if (hasAnyPermission(['leaves:read', 'leaves:approve'])) { ... }
 */

import type { PermissionCode } from "rbac";
import { useAuthStore } from "@/stores/auth.store";

export function usePermissions() {
  const { permissions, permissionsLoaded, user } = useAuthStore();

  const hasPermission = (code: PermissionCode): boolean => {
    return permissions.includes(code);
  };

  const hasAnyPermission = (codes: readonly PermissionCode[]): boolean => {
    return codes.some((code) => permissions.includes(code));
  };

  const hasAllPermissions = (codes: readonly PermissionCode[]): boolean => {
    return codes.every((code) => permissions.includes(code));
  };

  return {
    permissions,
    permissionsLoaded,
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
