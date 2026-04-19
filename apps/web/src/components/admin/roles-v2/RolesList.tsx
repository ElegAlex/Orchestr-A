"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  rolesV2Service,
  type RoleWithStats,
} from "@/services/roles-v2.service";
import { CATEGORY_CONFIG } from "./category-config";

interface RolesListProps {
  roles: readonly RoleWithStats[];
  onChanged: () => void;
}

/**
 * Liste complète des rôles DB — système (verrouillés) + custom (CRUD).
 *
 * Actions :
 *   - Rôles system (isSystem=true) : affichage read-only, badge "Système".
 *   - Rôles custom : bouton "Éditer" (rename label), bouton "Supprimer"
 *     avec gestion 409 si utilisateurs rattachés.
 */
export function RolesList({ roles, onChanged }: RolesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);

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
      await rolesV2Service.updateRole(role.id, { label: trimmed });
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
      await rolesV2Service.deleteRole(role.id);
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
    <div className="space-y-6">
      {customRoles.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Rôles custom ({customRoles.length})
          </h2>
          <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
            {customRoles.map((role) => (
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
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Rôles système ({systemRoles.length})
        </h2>
        <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {systemRoles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              isEditing={false}
              editLabel=""
              setEditLabel={() => {}}
              onStartEdit={() => {}}
              onCancelEdit={() => {}}
              onSaveEdit={() => {}}
              onDelete={() => {}}
              deleting={false}
            />
          ))}
        </ul>
      </section>
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
  const categoryCfg = CATEGORY_CONFIG[role.category];

  return (
    <li
      data-testid="role-row"
      data-role-id={role.id}
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
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${categoryCfg.badgeClass}`}
          >
            {role.templateKey}
          </span>
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
              onClick={onStartEdit}
              disabled={role.isSystem}
              title={
                role.isSystem
                  ? "Les rôles système ne sont pas modifiables"
                  : "Renommer"
              }
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Éditer
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={role.isSystem || deleting}
              title={
                role.isSystem
                  ? "Les rôles système ne sont pas supprimables"
                  : "Supprimer"
              }
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
