"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ROLE_TEMPLATE_KEYS, type RoleTemplateKey } from "rbac";
import {
  rolesService,
  type RoleTemplateView,
  type RoleWithStats,
} from "@/services/roles.service";
import { CATEGORY_CONFIG, CATEGORY_ORDER } from "./category-config";

type TemplateFilter = RoleTemplateKey | "ALL";

interface RolesTabProps {
  roles: readonly RoleWithStats[];
  templates: readonly RoleTemplateView[];
  /** Filtre contrôlé (deeplink depuis onglet Templates — click sur counter). */
  templateFilter: TemplateFilter;
  onTemplateFilterChange: (next: TemplateFilter) => void;
  /** Callback quand le bouton "+ Nouveau rôle" est pressé. */
  onCreateRole: () => void;
  /** Callback à invoquer après mutation (refresh parent). */
  onChanged: () => void;
}

/**
 * Onglet "Rôles" — liste UNIQUEMENT les rôles créés par l'admin (isSystem=false).
 *
 * Les 26 rôles système seedés au déploiement sont exposés dans l'onglet
 * "Templates RBAC" et ne doivent PAS apparaître ici. Chaque rôle affiché est
 * éditable (Renommer) et supprimable (409 si users rattachés).
 *
 * État vide :
 *   - Aucun rôle créé → message d'amorçage ("Utilisez '+ Nouveau rôle'").
 *   - Rôles existants mais filtre restrictif → message "aucun résultat".
 */
export function RolesTab({
  roles,
  templates,
  templateFilter,
  onTemplateFilterChange,
  onCreateRole,
  onChanged,
}: RolesTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const templateByKey = useMemo(() => {
    const out: Partial<Record<RoleTemplateKey, RoleTemplateView>> = {};
    for (const t of templates) out[t.key] = t;
    return out;
  }, [templates]);

  // Rôles créés par l'admin uniquement (le seeding prod/dev pose les 26 rôles
  // système en DB ; ils sont déjà visibles dans l'onglet "Templates RBAC").
  const userRoles = useMemo(
    () => roles.filter((r) => !r.isSystem),
    [roles],
  );

  const visibleRoles = useMemo(() => {
    if (templateFilter === "ALL") return userRoles;
    return userRoles.filter((r) => r.templateKey === templateFilter);
  }, [userRoles, templateFilter]);

  /**
   * Grouping par templateKey, uniquement pour les templates qui portent au
   * moins un rôle institutionnel visible. Ordre : categorie (A → I) puis
   * position du template dans ROLE_TEMPLATE_KEYS. Rôles triés par libellé
   * au sein d'un template.
   */
  const templateSections = useMemo(() => {
    const groups = new Map<RoleTemplateKey, RoleWithStats[]>();
    for (const r of visibleRoles) {
      const bucket = groups.get(r.templateKey) ?? [];
      bucket.push(r);
      groups.set(r.templateKey, bucket);
    }
    const sections = Array.from(groups.entries()).map(([key, roles]) => ({
      key,
      template: templateByKey[key] ?? null,
      roles: [...roles].sort((a, b) => a.label.localeCompare(b.label)),
    }));
    sections.sort((a, b) => {
      const catA = a.template
        ? CATEGORY_ORDER.indexOf(a.template.category)
        : Number.MAX_SAFE_INTEGER;
      const catB = b.template
        ? CATEGORY_ORDER.indexOf(b.template.category)
        : Number.MAX_SAFE_INTEGER;
      if (catA !== catB) return catA - catB;
      return (
        ROLE_TEMPLATE_KEYS.indexOf(a.key) - ROLE_TEMPLATE_KEYS.indexOf(b.key)
      );
    });
    return sections;
  }, [visibleRoles, templateByKey]);

  const startEdit = (role: RoleWithStats) => {
    setEditingId(role.id);
    setEditLabel(role.label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const saveEdit = async (role: RoleWithStats) => {
    const trimmed = editLabel.trim();
    if (trimmed.length === 0) {
      toast.error("Le libellé ne peut pas être vide.");
      return;
    }
    try {
      await rolesService.updateRole(role.id, { label: trimmed });
      toast.success("Rôle mis à jour.");
      cancelEdit();
      onChanged();
    } catch (err) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosErr.response?.data?.message ?? "Erreur lors de la mise à jour.",
      );
    }
  };

  const handleDelete = async (role: RoleWithStats) => {
    if (role.userCount > 0) {
      toast.error(
        `Impossible : ${role.userCount} utilisateur(s) rattaché(s). Réassignez avant suppression.`,
      );
      return;
    }
    const confirmed = window.confirm(
      `Supprimer définitivement le rôle "${role.label}" ?`,
    );
    if (!confirmed) return;

    setDeletingId(role.id);
    try {
      await rolesService.deleteRole(role.id);
      toast.success("Rôle supprimé.");
      onChanged();
    } catch (err) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosErr.response?.status === 409) {
        toast.error(
          axiosErr.response?.data?.message ??
            "Utilisateurs rattachés — réassignez avant suppression.",
        );
      } else {
        toast.error(
          axiosErr.response?.data?.message ??
            "Erreur lors de la suppression.",
        );
      }
    } finally {
      setDeletingId(null);
    }
  };

  const emptyStateMessage =
    userRoles.length === 0
      ? "Aucun rôle créé pour le moment. Utilisez le bouton « + Nouveau rôle » pour en créer un."
      : "Aucun rôle ne correspond au filtre sélectionné.";

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <label
            htmlFor="roles-tab-template-filter"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Filtrer par template
          </label>
          <select
            id="roles-tab-template-filter"
            data-testid="roles-template-filter"
            value={templateFilter}
            onChange={(e) =>
              onTemplateFilterChange(e.target.value as TemplateFilter)
            }
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white min-w-[260px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les templates</option>
            {ROLE_TEMPLATE_KEYS.map((k) => {
              const tpl = templateByKey[k];
              return (
                <option key={k} value={k}>
                  {tpl ? `${k} — ${tpl.defaultLabel}` : k}
                </option>
              );
            })}
          </select>
        </div>
        <button
          type="button"
          onClick={onCreateRole}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + Nouveau rôle
        </button>
      </div>

      {/* Sections groupées par template (seulement les templates utilisés) */}
      {templateSections.length === 0 ? (
        <div
          data-testid="roles-empty-state"
          className="py-12 text-center text-sm text-gray-500 bg-white border border-gray-200 border-dashed rounded-lg"
        >
          {emptyStateMessage}
        </div>
      ) : (
        <div className="space-y-6">
          {templateSections.map((section) => {
            const categoryCfg = section.template
              ? CATEGORY_CONFIG[section.template.category]
              : null;
            return (
              <section
                key={section.key}
                data-testid="roles-template-section"
                data-template-key={section.key}
              >
                <header className="mb-2 flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {section.template?.defaultLabel ?? section.key}
                  </h3>
                  {categoryCfg && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryCfg.badgeClass}`}
                    >
                      {categoryCfg.label}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {section.roles.length} rôle{section.roles.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 ml-auto">
                    {section.key}
                  </span>
                </header>
                <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {section.roles.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      isEditing={editingId === role.id}
                      editLabel={editLabel}
                      setEditLabel={setEditLabel}
                      onStartEdit={() => startEdit(role)}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={() => saveEdit(role)}
                      onDelete={() => handleDelete(role)}
                      deleting={deletingId === role.id}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RoleRowProps {
  role: RoleWithStats;
  isEditing: boolean;
  editLabel: string;
  setEditLabel: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function RoleRow({
  role,
  isEditing,
  editLabel,
  setEditLabel,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  deleting,
}: RoleRowProps) {
  return (
    <li
      data-testid="role-row"
      data-role-id={role.id}
      data-template-key={role.templateKey}
      className="px-4 py-3 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {isEditing ? (
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              autoFocus
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <span className="text-sm font-medium text-gray-900 truncate">
              {role.label}
            </span>
          )}
          {role.isDefault && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
              Défaut
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="font-mono">{role.code}</span>
          <span>{role.userCount} utilisateur(s)</span>
          <span>{role.permissionsCount} permissions</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onSaveEdit}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-testid="role-rename"
              onClick={onStartEdit}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Renommer
            </button>
            <button
              type="button"
              data-testid="role-delete"
              onClick={onDelete}
              disabled={deleting}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? "…" : "Supprimer"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
