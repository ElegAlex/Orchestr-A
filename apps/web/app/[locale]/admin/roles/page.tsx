"use client";

/**
 * Route admin RBAC — 2 onglets séparés :
 *
 *   1. "Templates RBAC" : galerie des 26 templates constants du code, strictement
 *      read-only. Aucune édition, aucun bouton "Éditer". Click sur une card →
 *      modale détail permissions. Click sur le compteur de rôles rattachés →
 *      bascule sur l'onglet "Rôles" avec filtre appliqué (deeplink cross-tab).
 *
 *   2. "Rôles" : liste des entrées DB (table `roles`) groupées par `templateKey`.
 *      CRUD uniquement pour les rôles `isSystem=false` — les rôles système sont
 *      affichés en lecture seule, AUCUNE action.
 *
 * Onglet par défaut : "Rôles" — load-bearing pour l'UX (l'action principale
 * de l'admin est de gérer les rôles, pas de consulter les templates). Ne
 * pas inverser sans arbitrage.
 *
 * Sémantique du filtre par template (onglet Rôles) :
 *   - Click deeplink depuis un compteur de l'onglet Templates → filtre posé
 *     sur ce templateKey puis bascule onglet.
 *   - Click direct sur l'onglet Rôles (via la nav tabs) depuis Templates →
 *     reset du filtre à "ALL" (intention "je veux voir la liste des rôles").
 *   - Reste des interactions (click sur le même onglet actif) → filtre
 *     inchangé.
 *
 * Gate : `users:manage_roles` (redirect dashboard sinon).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import toast from "react-hot-toast";
import type { RoleTemplateKey } from "rbac";
import { MainLayout } from "@/components/MainLayout";
import { usePermissions } from "@/hooks/usePermissions";
import {
  rolesService,
  type RoleTemplateView,
  type RoleWithStats,
} from "@/services/roles.service";
import { TemplateDetailsModal } from "@/components/admin/roles/TemplateDetailsModal";
import { CreateRoleForm } from "@/components/admin/roles/CreateRoleForm";
import { TemplatesTab } from "@/components/admin/roles/TemplatesTab";
import { RolesTab } from "@/components/admin/roles/RolesTab";

type ActiveTab = "templates" | "roles";
type TemplateFilter = RoleTemplateKey | "ALL";

export default function RolesAdminPage() {
  const router = useRouter();
  const locale = useLocale();
  const { hasPermission, permissionsLoaded } = usePermissions();

  const canManage = hasPermission("users:manage_roles");

  const [templates, setTemplates] = useState<RoleTemplateView[]>([]);
  const [roles, setRoles] = useState<RoleWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Onglet actif — "roles" par défaut (action principale de l'admin).
  const [activeTab, setActiveTab] = useState<ActiveTab>("roles");
  const [rolesTemplateFilter, setRolesTemplateFilter] =
    useState<TemplateFilter>("ALL");

  const [detailsTemplate, setDetailsTemplate] =
    useState<RoleTemplateView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Gate route-level : redirection dashboard si perm manquante (après chargement
  // des perms pour éviter flash).
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
        rolesService.getTemplates(),
        rolesService.listRoles(),
      ]);
      setTemplates(tpls);
      setRoles(rls);
    } catch {
      toast.error("Erreur lors du chargement des rôles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded || !canManage) return;
    void loadData();
  }, [permissionsLoaded, canManage]);

  // Compteurs affichés sur les cards Templates : uniquement les rôles créés
  // par l'admin (isSystem=false). Les 26 rôles système seedés ne sont pas
  // comptés, car l'onglet "Rôles" vers lequel pointe le deeplink ne les
  // affiche plus (ils appartiennent à l'onglet "Templates RBAC").
  const roleCountByTemplate = useMemo(() => {
    const out: Partial<Record<RoleTemplateKey, number>> = {};
    for (const r of roles) {
      if (r.isSystem) continue;
      out[r.templateKey] = (out[r.templateKey] ?? 0) + 1;
    }
    return out;
  }, [roles]);

  // Cross-nav depuis Templates → Rôles : on mémorise le filtre et bascule
  // d'onglet. Le filtre est conservé quand l'admin revient manuellement sur
  // l'onglet Rôles plus tard ; un reset manuel est possible via le dropdown.
  const handleTemplateRoleCountClick = (templateKey: RoleTemplateKey) => {
    setRolesTemplateFilter(templateKey);
    setActiveTab("roles");
  };

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
    return (
      <MainLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <h1 className="text-xl font-semibold text-red-700 mb-2">
            Accès refusé
          </h1>
          <p className="text-sm text-gray-600">
            Vous n&apos;avez pas la permission d&apos;accéder à
            l&apos;administration des rôles (<code>users:manage_roles</code>).
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
        <header className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Administration des rôles
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {templates.length} templates RBAC · {roles.length} rôle
            {roles.length > 1 ? "s" : ""} en base
          </p>
        </header>

        {/* Onglets */}
        <nav
          className="mb-6 border-b border-gray-200"
          role="tablist"
          aria-label="Administration des rôles"
        >
          <div className="flex gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "roles"}
              data-testid="tab-roles"
              onClick={() => {
                if (activeTab !== "roles") {
                  setRolesTemplateFilter("ALL");
                }
                setActiveTab("roles");
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === "roles"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Rôles
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "templates"}
              data-testid="tab-templates"
              onClick={() => setActiveTab("templates")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                activeTab === "templates"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Templates RBAC
            </button>
          </div>
        </nav>

        {/* Contenu de l'onglet */}
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Chargement…
          </div>
        ) : activeTab === "roles" ? (
          <section role="tabpanel" data-testid="panel-roles">
            <RolesTab
              roles={roles}
              templates={templates}
              templateFilter={rolesTemplateFilter}
              onTemplateFilterChange={setRolesTemplateFilter}
              onCreateRole={() => setCreateOpen(true)}
              onChanged={() => void loadData()}
            />
          </section>
        ) : (
          <section role="tabpanel" data-testid="panel-templates">
            <TemplatesTab
              templates={templates}
              roleCountByTemplate={roleCountByTemplate}
              onOpenDetails={(tpl) => setDetailsTemplate(tpl)}
              onRoleCountClick={handleTemplateRoleCountClick}
            />
          </section>
        )}
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
