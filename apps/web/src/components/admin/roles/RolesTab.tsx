"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ROLE_TEMPLATE_KEYS, type RoleTemplateKey } from "rbac";
import {
  rolesService,
  type RoleTemplateView,
  type RoleWithStats,
} from "@/services/roles.service";
import { CATEGORY_CONFIG } from "./category-config";

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
 * Onglet "Rôles" — CRUD sur les entrées DB de la table `roles`.
 *
 * Règles d'édition :
 *   - Rôles `isSystem=true` : affichés en lecture seule, AUCUNE action
 *     disponible (pas de bouton Renommer, pas de bouton Supprimer).
 *   - Rôles `isSystem=false` : boutons "Renommer" (label + description) et
 *     "Supprimer" (409 si users rattachés). `templateKey` immuable après
 *     création, n'est donc jamais modifiable depuis cet onglet.
 *
 * Filtres :
 *   - Dropdown "Filtrer par template" (26 entrées + Tous).
 *   - Checkbox "Afficher aussi les rôles système" (default off).
 *
 * Grouping : les rôles visibles sont groupés par `templateKey` avec un titre
 * de section = `defaultLabel` du template + badge catégorie.
 */
export function RolesTab({
  roles,
  templates,
  templateFilter,
  onTemplateFilterChange,
  onCreateRole,
  onChanged,
}: RolesTabProps) {
  const [showSystem, setShowSystem] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Index templateKey → RoleTemplateView (pour les titres de section).
  const templateByKey = useMemo(() => {
    const out: Partial<Record<RoleTemplateKey, RoleTemplateView>> = {};
    for (const t of templates) out[t.key] = t;
    return out;
  }, [templates]);

  // Filtrage : template + system toggle.
  const visibleRoles = useMemo(() => {
    return roles.filter((r) => {
      if (r.isSystem && !showSystem) return false;
      if (templateFilter !== "ALL" && r.templateKey !== templateFilter) {
        return false;
      }
      return true;
    });
  }, [roles, templateFilter, showSystem]);

  // Grouping par templateKey (clés préservées dans l'ordre ROLE_TEMPLATE_KEYS).
  const rolesByTemplate = useMemo(() => {
    const out: Partial<Record<RoleTemplateKey, RoleWithStats[]>> = {};
    for (const r of visibleRoles) {
      const k = r.templateKey;
      if (!out[k]) out[k] = [];
      out[k]!.push(r);
    }
    // Tri interne par label pour stabilité.
    for (const k of Object.keys(out) as RoleTemplateKey[]) {
      out[k]!.sort((a, b) => a.label.localeCompare(b.label));
    }
    return out;
  }, [visibleRoles]);

  const orderedTemplateKeys = useMemo(
    () =>
      ROLE_TEMPLATE_KEYS.filter(
        (k) => rolesByTemplate[k] && rolesByTemplate[k]!.length > 0,
      ),
    [rolesByTemplate],
  );

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

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
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
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input
              type="checkbox"
              data-testid="roles-show-system"
              checked={showSystem}
              onChange={(e) => setShowSystem(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Afficher aussi les rôles système
          </label>
        </div>
        <button
          type="button"
          onClick={onCreateRole}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + Nouveau rôle
        </button>
      </div>

      {/* Listing groupé par templateKey */}
      {orderedTemplateKeys.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 bg-white border border-gray-200 rounded-lg">
          Aucun rôle ne correspond aux filtres.
        </div>
      ) : (
        <div className="space-y-6">
          {orderedTemplateKeys.map((tplKey) => {
            const tpl = templateByKey[tplKey];
            const group = rolesByTemplate[tplKey] ?? [];
            const categoryCfg = tpl ? CATEGORY_CONFIG[tpl.category] : null;
            return (
              <section
                key={tplKey}
                data-testid="roles-group"
                data-template-key={tplKey}
              >
                <h2 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2 flex-wrap">
                  <span>{tpl?.defaultLabel ?? tplKey}</span>
                  {categoryCfg && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryCfg.badgeClass}`}
                    >
                      {categoryCfg.label}
                    </span>
                  )}
                  <span className="text-xs font-normal text-gray-500">
                    {group.length} rôle{group.length > 1 ? "s" : ""}
                  </span>
                </h2>
                <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {group.map((role) => (
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
      data-is-system={role.isSystem ? "true" : "false"}
      className="px-4 py-3 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
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
          {role.isSystem && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
              Système
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

      {/* Actions — aucune pour rôles système (règle PO : read-only strict). */}
      {!role.isSystem && (
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
      )}
    </li>
  );
}
