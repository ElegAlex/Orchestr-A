import React from "react";
import { useTranslations } from "next-intl";

interface DepartmentHeaderProps {
  name: string;
  /** Nombre total d'agents (services confondus) affichés pour ce département. */
  userCount: number;
  /** True si ce département est celui de l'utilisateur connecté (mise en avant). */
  isCurrentUserDepartment: boolean;
}

/**
 * Bande de regroupement de niveau "département", insérée dans la grille de
 * planning avant les services d'un même département. Permet à un agent de
 * distinguer visuellement son département des autres. Le département de
 * l'utilisateur connecté est mis en avant (accent + libellé "Mon département").
 *
 * Non sticky (contrairement à GroupHeader) pour éviter tout conflit d'empilement
 * avec l'en-tête de jours (sticky top-0) et les en-têtes de service (sticky
 * top-[48px]).
 */
export const DepartmentHeader = React.memo(
  ({ name, userCount, isCurrentUserDepartment }: DepartmentHeaderProps) => {
    const t = useTranslations("planning");

    const containerClass = isCurrentUserDepartment
      ? "px-4 py-2 border-y-2 border-indigo-500 bg-indigo-600"
      : "px-4 py-2 border-y border-gray-300 bg-gray-700";

    return (
      <div className={containerClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              {t("department.label")}
            </span>
            <span className="text-sm font-bold uppercase tracking-wide text-white">
              {name}
            </span>
            {isCurrentUserDepartment && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {t("department.mine")}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-white/80">
            {userCount} {userCount > 1 ? t("group.people") : t("group.person")}
          </span>
        </div>
      </div>
    );
  },
);

DepartmentHeader.displayName = "DepartmentHeader";
