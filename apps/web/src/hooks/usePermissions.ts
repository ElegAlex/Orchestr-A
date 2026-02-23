/**
 * RÈGLE RBAC FRONTEND — NE JAMAIS VÉRIFIER user.role DIRECTEMENT
 *
 * Tout check d'autorisation dans le frontend passe par ce hook.
 * Seule exception : Role.ADMIN comme bypass de sécurité (géré ici).
 *
 * Exemples :
 *   const { hasPermission } = usePermissions();
 *   if (hasPermission('projects:create')) { ... }
 *   if (hasAnyPermission(['leaves:read', 'leaves:approve'])) { ... }
 */

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
