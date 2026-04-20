"use client";

import { useMemo, useState } from "react";
import type { RoleCategoryKey, RoleTemplateKey } from "rbac";
import type { RoleTemplateView } from "@/services/roles.service";
import { TemplateCard } from "./TemplateCard";
import { CATEGORY_CONFIG, CATEGORY_ORDER } from "./category-config";

type CategoryFilter = RoleCategoryKey | "ALL";

interface TemplatesTabProps {
  templates: readonly RoleTemplateView[];
  roleCountByTemplate: Readonly<Partial<Record<RoleTemplateKey, number>>>;
  onOpenDetails: (template: RoleTemplateView) => void;
  /** Bascule vers l'onglet Rôles filtré sur le templateKey. */
  onRoleCountClick: (templateKey: RoleTemplateKey) => void;
}

/**
 * Onglet "Templates RBAC" — galerie read-only des 26 templates.
 *
 * Strict read-only :
 *   - Aucune action d'édition, aucun bouton "Éditer".
 *   - Click sur une card ouvre la modale détail (permissions read-only).
 *   - Click sur le compteur "X rôle(s) rattaché(s)" bascule sur l'onglet
 *     "Rôles" avec un filtre sur ce templateKey (deeplink cross-tab).
 */
export function TemplatesTab({
  templates,
  roleCountByTemplate,
  onOpenDetails,
  onRoleCountClick,
}: TemplatesTabProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (selectedCategory !== "ALL" && tpl.category !== selectedCategory) {
        return false;
      }
      if (!needle) return true;
      return (
        tpl.defaultLabel.toLowerCase().includes(needle) ||
        tpl.description.toLowerCase().includes(needle) ||
        tpl.key.toLowerCase().includes(needle)
      );
    });
  }, [templates, selectedCategory, searchTerm]);

  const templatesByCategory = useMemo(() => {
    const groups: Record<string, RoleTemplateView[]> = {};
    for (const tpl of filteredTemplates) {
      if (!groups[tpl.category]) groups[tpl.category] = [];
      groups[tpl.category].push(tpl);
    }
    return groups;
  }, [filteredTemplates]);

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="space-y-3">
        <div
          className="flex flex-wrap gap-2"
          role="toolbar"
          aria-label="Filtrer par catégorie"
        >
          <button
            type="button"
            data-testid="category-filter-all"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              selectedCategory === "ALL"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
            }`}
          >
            Toutes ({templates.length})
          </button>
          {CATEGORY_ORDER.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const count = templates.filter((t) => t.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                data-testid="category-chip"
                data-category={cat}
                data-active={active ? "true" : "false"}
                onClick={() => setSelectedCategory(active ? "ALL" : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  active ? cfg.activeChipClass : cfg.badgeClass
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        <div>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher (libellé, description, clé…)"
            className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Galerie */}
      {filteredTemplates.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Aucun template ne correspond aux filtres.
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.filter(
            (cat) => templatesByCategory[cat]?.length,
          ).map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const group = templatesByCategory[cat] ?? [];
            return (
              <div
                key={cat}
                data-testid="category-section"
                data-category={cat}
              >
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeClass}`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-xs font-normal text-gray-500">
                    {group.length} template{group.length > 1 ? "s" : ""}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.map((tpl) => (
                    <TemplateCard
                      key={tpl.key}
                      template={tpl}
                      roleCount={roleCountByTemplate[tpl.key] ?? 0}
                      onClick={() => onOpenDetails(tpl)}
                      onRoleCountClick={() => onRoleCountClick(tpl.key)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
