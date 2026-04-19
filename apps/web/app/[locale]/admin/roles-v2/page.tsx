"use client";

/**
 * Route admin Spec 3 V1D — nouvelle galerie des rôles RBAC.
 *
 * Remplacera `/admin/roles` en V2 (cette route est temporaire, nommée `-v2`
 * pour cohabiter avec l'ancienne). Sert aussi de cible aux E2E dans
 * `e2e/tests/rbac/admin-roles-gallery.spec.ts`.
 *
 * - Gate ADMIN-only via `users:manage_roles` (route-level, pas HOC — les
 *   E2E attendent un 403 visible ou redirect pour non-admins).
 * - Fetch parallèle `/api/roles/templates` + `/api/roles` au mount.
 * - Filtrage : chips catégorie (9) + recherche libre (label / description /
 *   templateKey).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import toast from "react-hot-toast";
import type { RoleCategoryKey } from "rbac";
import { MainLayout } from "@/components/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";
import {
  rolesV2Service,
  type RoleTemplateView,
  type RoleWithStats,
} from "@/services/roles-v2.service";
import { TemplateCard } from "@/components/admin/roles-v2/TemplateCard";
import { TemplateDetailsModal } from "@/components/admin/roles-v2/TemplateDetailsModal";
import { CreateRoleForm } from "@/components/admin/roles-v2/CreateRoleForm";
import { RolesList } from "@/components/admin/roles-v2/RolesList";
import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
} from "@/components/admin/roles-v2/category-config";

type CategoryFilter = RoleCategoryKey | "ALL";

export default function RolesGalleryV2Page() {
  const router = useRouter();
  const locale = useLocale();
  const { hasPermission, permissionsLoaded } = usePermissions();

  const canManage = hasPermission("users:manage_roles");

  const [templates, setTemplates] = useState<RoleTemplateView[]>([]);
  const [roles, setRoles] = useState<RoleWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [detailsTemplate, setDetailsTemplate] =
    useState<RoleTemplateView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Gate route-level : redirection dashboard si perm manquante (après chargement
  // des perms, éviter flash).
  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!canManage) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [permissionsLoaded, canManage, router, locale]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tpls, rls] = await Promise.all([
        rolesV2Service.getTemplates(),
        rolesV2Service.listRoles(),
      ]);
      setTemplates(tpls);
      setRoles(rls);
    } catch {
      toast.error("Erreur lors du chargement de la galerie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded || !canManage) return;
    void loadData();
  }, [permissionsLoaded, canManage]);

  // Index rôles → nombre par templateKey.
  const roleCountByTemplate = useMemo(() => {
    const out: Partial<Record<string, number>> = {};
    for (const r of roles) {
      out[r.templateKey] = (out[r.templateKey] ?? 0) + 1;
    }
    return out;
  }, [roles]);

  // Templates filtrés (catégorie + recherche).
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

  // Grouper les templates filtrés par catégorie (ordre fixe A→I).
  const templatesByCategory = useMemo(() => {
    const groups: Record<string, RoleTemplateView[]> = {};
    for (const tpl of filteredTemplates) {
      if (!groups[tpl.category]) groups[tpl.category] = [];
      groups[tpl.category].push(tpl);
    }
    return groups;
  }, [filteredTemplates]);

  // ────────────────────────────────────────────────────────────────────
  // Guards
  // ────────────────────────────────────────────────────────────────────

  if (!permissionsLoaded) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="animate-pulse text-gray-400">Chargement…</div>
        </div>
      </MainLayout>
    );
  }

  if (!canManage) {
    // Fallback visible pendant que le router.replace s'effectue — garantit
    // que les tests E2E voient bien un texte "Accès refusé" si la redirection
    // est asynchrone.
    return (
      <MainLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <h1 className="text-xl font-semibold text-red-700 mb-2">
            Accès refusé
          </h1>
          <p className="text-sm text-gray-600">
            Vous n&apos;avez pas la permission d&apos;accéder à la galerie
            des rôles (<code>users:manage_roles</code>).
          </p>
        </div>
      </MainLayout>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Rendu principal
  // ────────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Galerie des rôles
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {templates.length} templates RBAC · {roles.length} rôles en
                base
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              + Nouveau rôle custom
            </button>
          </div>
        </header>

        {/* Filtres */}
        <section className="mb-6 space-y-3">
          {/* Chips catégories — 9 chips, une par catégorie (ordre A→I). */}
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
                  onClick={() =>
                    setSelectedCategory(active ? "ALL" : cat)
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    active ? cfg.activeChipClass : cfg.badgeClass
                  }`}
                >
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Recherche */}
          <div>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher (libellé, description, clé…)"
              className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </section>

        {/* Galerie */}
        <section className="mb-10">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Chargement des templates…
            </div>
          ) : filteredTemplates.length === 0 ? (
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
                  <div key={cat} data-testid="category-section" data-category={cat}>
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
                          onClick={() => setDetailsTemplate(tpl)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Liste des rôles DB */}
        <section>
          {loading ? (
            <div className="py-6 text-center text-sm text-gray-500">
              Chargement des rôles…
            </div>
          ) : (
            <RolesList roles={roles} onChanged={() => void loadData()} />
          )}
        </section>
      </div>

      {/* Modales */}
      <TemplateDetailsModal
        template={detailsTemplate}
        isOpen={detailsTemplate !== null}
        onClose={() => setDetailsTemplate(null)}
      />
      <CreateRoleForm
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadData()}
      />
    </MainLayout>
  );
}
