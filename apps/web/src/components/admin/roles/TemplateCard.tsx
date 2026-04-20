"use client";

import type { RoleTemplateView } from "@/services/roles.service";
import { CATEGORY_CONFIG } from "./category-config";

interface TemplateCardProps {
  template: RoleTemplateView;
  /** Nombre de rôles DB rattachés à ce template (système + éditables). */
  roleCount: number;
  /** Click sur la carte (ouvre la modale read-only des permissions). */
  onClick: () => void;
  /**
   * Click sur le compteur "X rôle(s)" — bascule sur l'onglet Rôles filtré
   * sur ce templateKey. Si non fourni, le compteur n'est pas cliquable.
   */
  onRoleCountClick?: () => void;
}

/**
 * Card d'un des 26 templates RBAC (galerie admin, onglet "Templates RBAC").
 *
 * Read-only stricte : aucune action d'édition. Click sur la carte ouvre la
 * modale détaillée des permissions. Click sur le compteur de rôles rattachés
 * renvoie à l'onglet "Rôles" avec filtre appliqué.
 */
export function TemplateCard({
  template,
  roleCount,
  onClick,
  onRoleCountClick,
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
        {onRoleCountClick && roleCount > 0 ? (
          <span
            role="button"
            tabIndex={0}
            data-testid="template-role-count"
            data-template-key={template.key}
            onClick={(e) => {
              e.stopPropagation();
              onRoleCountClick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onRoleCountClick();
              }
            }}
            className="text-blue-700 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            title={`Voir les ${roleCount} rôle(s) rattaché(s)`}
          >
            <span className="font-semibold">{roleCount}</span>{" "}
            {roleCount > 1 ? "rôles rattachés" : "rôle rattaché"}
          </span>
        ) : (
          <span data-testid="template-role-count" data-template-key={template.key}>
            <span className="font-semibold text-gray-700">{roleCount}</span>{" "}
            {roleCount > 1 ? "rôles" : "rôle"}
          </span>
        )}
      </div>
    </button>
  );
}
