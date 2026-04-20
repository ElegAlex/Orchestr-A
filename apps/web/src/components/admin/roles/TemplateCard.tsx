"use client";

import type { RoleTemplateView } from "@/services/roles.service";
import { CATEGORY_CONFIG } from "./category-config";

interface TemplateCardProps {
  template: RoleTemplateView;
  /** Nombre de rôles DB rattachés à ce template (custom + système). */
  roleCount: number;
  onClick: () => void;
}

/**
 * Card d'un des 26 templates RBAC (galerie admin Spec 3 V1D).
 *
 * - Badge catégorie coloré en haut (cf. `CATEGORY_CONFIG`).
 * - Titre = `defaultLabel` (ex: "Administrateur").
 * - Description (2-3 lignes max, truncate).
 * - Footer : count permissions + count rôles rattachés.
 */
export function TemplateCard({
  template,
  roleCount,
  onClick,
}: TemplateCardProps) {
  const categoryCfg = CATEGORY_CONFIG[template.category];

  return (
    <button
      type="button"
      data-testid="template-card"
      data-template-key={template.key}
      data-category={template.category}
      onClick={onClick}
      className={`group flex flex-col gap-3 p-4 text-left border-2 border-gray-200 rounded-lg bg-white transition-all hover:shadow-md ${categoryCfg.cardAccentClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryCfg.badgeClass}`}
        >
          {categoryCfg.label}
        </span>
        <span className="text-[10px] font-mono text-gray-400 truncate max-w-[140px]">
          {template.key}
        </span>
      </div>

      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          {template.defaultLabel}
        </h3>
        <p className="text-xs text-gray-600 line-clamp-3">
          {template.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
        <span>
          <span className="font-semibold text-gray-700">
            {template.permissions.length}
          </span>{" "}
          {template.permissions.length > 1 ? "permissions" : "permission"}
        </span>
        <span>
          <span className="font-semibold text-gray-700">{roleCount}</span>{" "}
          {roleCount > 1 ? "rôles" : "rôle"}
        </span>
      </div>
    </button>
  );
}
