"use client";

import type { ComponentType } from "react";
import type { PermissionCode } from "rbac";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * HOC d'accès RBAC — gate un composant UI derrière une (ou plusieurs) permissions.
 *
 * Règle : ce HOC est UI-only. Il NE redirige PAS et NE lève PAS d'erreur —
 * il rend `null` lorsque l'utilisateur n'a aucune des permissions requises.
 * La redirection de page doit être gérée par la page elle-même.
 *
 * Sémantique :
 *   - Si `permission` est un tableau : "any-of" (au moins une permission suffit).
 *   - Si c'est une string : équivalent à `[permission]`.
 *   - Pendant le chargement initial (`permissionsLoaded === false`), rend un
 *     placeholder vide (div transparent) pour éviter un flash de contenu.
 *
 * Exemples :
 *   const AdminPanel = withAccessControl('users:manage_roles')(RawAdminPanel);
 *   const Reports = withAccessControl(['reports:view_all', 'reports:view_team'])(RawReports);
 */
export function withAccessControl<P extends object>(
  permission: PermissionCode | readonly PermissionCode[],
) {
  return function wrap(Component: ComponentType<P>): ComponentType<P> {
    const codes: readonly PermissionCode[] = Array.isArray(permission)
      ? (permission as readonly PermissionCode[])
      : ([permission] as readonly PermissionCode[]);

    function AccessControlled(props: P) {
      const { permissionsLoaded, hasAnyPermission } = usePermissions();

      if (!permissionsLoaded) {
        return <div aria-hidden className="w-full h-0" />;
      }

      if (!hasAnyPermission(codes)) {
        return null;
      }

      return <Component {...props} />;
    }

    const name =
      Component.displayName || Component.name || "AccessControlledComponent";
    AccessControlled.displayName = `withAccessControl(${name})`;

    return AccessControlled;
  };
}
