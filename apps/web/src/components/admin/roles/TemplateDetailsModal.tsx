"use client";

import { useEffect, useMemo } from "react";
import type { PermissionCode } from "rbac";
import type { RoleTemplateView } from "@/services/roles.service";
import { CATEGORY_CONFIG, getModuleLabel } from "./category-config";

interface TemplateDetailsModalProps {
  template: RoleTemplateView | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Groupe les permissions (`module:action`) par module.
 */
function groupPermissionsByModule(
  permissions: readonly PermissionCode[],
): Record<string, PermissionCode[]> {
  const groups: Record<string, PermissionCode[]> = {};
  for (const code of permissions) {
    const [module] = code.split(":");
    if (!groups[module]) groups[module] = [];
    groups[module].push(code);
  }
  // Tri interne de chaque groupe par action (alpha) pour un affichage stable.
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.localeCompare(b));
  }
  return groups;
}

/**
 * Modale lecture seule détaillant les permissions d'un template RBAC.
 * Groupées par module (ex: `projects:*`, `tasks:*`), scrollable, fermeture
 * par bouton ou touche Escape.
 */
export function TemplateDetailsModal({
  template,
  isOpen,
  onClose,
}: TemplateDetailsModalProps) {
  const grouped = useMemo(() => {
    if (!template) return {};
    return groupPermissionsByModule(template.permissions);
  }, [template]);

  // Fermeture au clavier (Escape).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || !template) return null;

  const categoryCfg = CATEGORY_CONFIG[template.category];
  const moduleKeys = Object.keys(grouped).sort();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-details-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryCfg.badgeClass}`}
              >
                {categoryCfg.label}
              </span>
              <span className="text-[10px] font-mono text-gray-400 truncate">
                {template.key}
              </span>
            </div>
            <h2
              id="template-details-title"
              className="text-lg font-semibold text-gray-900"
            >
              {template.defaultLabel}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {template.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Bannière read-only */}
        <div
          className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900"
          data-testid="readonly-banner"
        >
          Permissions définies par le code. Non modifiables depuis
          l&apos;interface.
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              {template.permissions.length}
            </span>{" "}
            permissions réparties sur{" "}
            <span className="font-semibold text-gray-700">
              {moduleKeys.length}
            </span>{" "}
            modules
          </div>

          <div className="space-y-4">
            {moduleKeys.map((module) => (
              <div
                key={module}
                data-testid="permission-group"
                data-module={module}
                className="border border-gray-200 rounded-lg p-3"
              >
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  {getModuleLabel(module)}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    ({grouped[module].length})
                  </span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {grouped[module].map((code) => {
                    const [, action] = code.split(":");
                    return (
                      <span
                        key={code}
                        data-testid="permission-item"
                        data-permission-code={code}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-100"
                        title={code}
                      >
                        {action}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
