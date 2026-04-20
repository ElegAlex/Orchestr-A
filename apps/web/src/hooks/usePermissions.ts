/**
 * RÈGLE RBAC FRONTEND — NE JAMAIS VÉRIFIER user.role DIRECTEMENT
 *
 * Tout check d'autorisation dans le frontend passe par ce hook.
 *
 * La résolution se base UNIQUEMENT sur le tableau `permissions` du store,
 * peuplé par `/api/auth/me/permissions`. Pour ADMIN, le template contient déjà
 * l'ensemble des 108 codes du catalogue — il n'y a donc plus de bypass par
 * rôle côté frontend (Spec 3 V0).
 *
 * Exemples :
 *   const { hasPermission } = usePermissions();
 *   if (hasPermission('projects:create')) { ... }
 *   if (hasAnyPermission(['leaves:read', 'leaves:approve'])) { ... }
 */

import { useCallback } from "react";
import type { PermissionCode } from "rbac";
import { useAuthStore } from "@/stores/auth.store";

export function usePermissions() {
  const { permissions, permissionsLoaded, user } = useAuthStore();

  // Références stables : évite les boucles `Maximum update depth` quand
  // ces fonctions sont en dépendance de useEffect (PlanningView, etc.).
  const hasPermission = useCallback(
    (code: PermissionCode): boolean => permissions.includes(code),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (codes: readonly PermissionCode[]): boolean =>
      codes.some((code) => permissions.includes(code)),
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (codes: readonly PermissionCode[]): boolean =>
      codes.every((code) => permissions.includes(code)),
    [permissions],
  );

  return {
    permissions,
    permissionsLoaded,
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
