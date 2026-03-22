"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { Role } from "@/types";
import {
  roleManagementService,
  PermissionsGroupedByModule,
} from "@/services/role-management.service";
import type { RoleConfigWithPermissions, Permission } from "@/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

// Labels lisibles par feature (module)
const FEATURE_LABELS: Record<string, string> = {
  projects: "Projets",
  tasks: "Tâches",
  events: "Événements",
  epics: "Épics",
  milestones: "Jalons",
  leaves: "Congés",
  telework: "Télétravail",
  skills: "Compétences",
  time_tracking: "Suivi du temps",
  users: "Utilisateurs",
  departments: "Départements",
  services: "Services",
  documents: "Documents",
  comments: "Commentaires",
  settings: "Paramètres",
  analytics: "Analytique",
  reports: "Rapports",
  holidays: "Jours fériés",
};

// Ordre d'affichage des features
const FEATURE_ORDER = [
  "projects",
  "tasks",
  "epics",
  "milestones",
  "events",
  "reports",
  "analytics",
  "users",
  "departments",
  "services",
  "skills",
  "leaves",
  "telework",
  "time_tracking",
  "documents",
  "comments",
  "holidays",
  "settings",
];

// Labels lisibles par action
const ACTION_LABELS: Record<string, string> = {
  read: "Lire",
  view: "Voir",
  create: "Créer",
  update: "Modifier",
  edit: "Éditer",
  delete: "Supprimer",
  approve: "Approuver",
  manage: "Gérer",
  import: "Importer",
  export: "Exporter",
  manage_members: "Gérer membres",
  manage_roles: "Gérer rôles",
  manage_matrix: "Gérer matrice",
  manage_delegations: "Gérer délégations",
  manage_others: "Gérer autres",
  create_in_project: "Créer dans projet",
  create_orphan: "Créer orpheline",
  read_reports: "Voir rapports",
  read_team: "Voir équipe",
  declare_for_others: "Déclarer pour autrui",
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function getFeatureLabel(module: string): string {
  return FEATURE_LABELS[module] ?? module;
}

interface PermissionGroupProps {
  module: string;
  permissions: Permission[];
  selectedPermissions: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (module: string) => void;
}

function PermissionGroup({
  module,
  permissions,
  selectedPermissions,
  onToggle,
  onToggleAll,
}: PermissionGroupProps) {
  const allSelected = permissions.every((p) => selectedPermissions.has(p.id));
  const someSelected = permissions.some((p) => selectedPermissions.has(p.id));

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-800">
          {getFeatureLabel(module)}
        </h4>
        <button
          type="button"
          onClick={() => onToggleAll(module)}
          className={`text-xs px-2 py-1 rounded font-medium transition ${
            allSelected
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
              : someSelected
                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {allSelected ? "Tout désactiver" : "Tout activer"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {permissions.map((perm) => {
          const isActive = selectedPermissions.has(perm.id);
          return (
            <label
              key={perm.id}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs cursor-pointer border transition select-none ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => onToggle(perm.id)}
                className="sr-only"
              />
              {getActionLabel(perm.action)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function RolesPage() {
  const t = useTranslations("admin.roles");
  const tCommon = useTranslations("common");
  const currentUser = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleConfigWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<PermissionsGroupedByModule>(
    {},
  );

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] =
    useState<RoleConfigWithPermissions | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  // Selected permissions
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );

  // Check permissions - ADMIN only
  const isAdmin = currentUser?.role === Role.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    fetchRoles();
    fetchPermissions();
  }, [isAdmin]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await roleManagementService.getAllRoles();
      setRoles(data);
    } catch (err) {
      toast.error(t("messages.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const data = await roleManagementService.getAllPermissions();
      setPermissions(data);
    } catch (err) {
      console.error(t("messages.loadPermissionsError"), err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newRole = await roleManagementService.createRole({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
      });
      toast.success(t("messages.createSuccess"));
      setShowCreateModal(false);
      setFormData({ code: "", name: "", description: "" });
      fetchRoles();
      openEditModal(newRole);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.createError"),
      );
    }
  };

  const openEditModal = (role: RoleConfigWithPermissions) => {
    setEditingRole(role);
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || "",
    });

    const permIds = new Set<string>(
      role.permissions.map((rp) => rp.permission.id),
    );
    setSelectedPermissions(permIds);
    setShowEditModal(true);
  };

  const handleEditInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      const updateData = editingRole.isSystem
        ? {
            name: formData.name,
            description: formData.description || undefined,
          }
        : {
            code: formData.code,
            name: formData.name,
            description: formData.description || undefined,
          };

      await roleManagementService.updateRole(editingRole.id, updateData);
      toast.success(t("messages.updateSuccess"));
      fetchRoles();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.updateError"),
      );
    }
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;

    try {
      await roleManagementService.replaceRolePermissions(
        editingRole.id,
        Array.from(selectedPermissions),
      );
      toast.success(t("messages.saveSuccess"));
      fetchRoles();
      const updatedRole = await roleManagementService.getRole(editingRole.id);
      setEditingRole(updatedRole);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.saveError"),
      );
    }
  };

  const handleDelete = async (role: RoleConfigWithPermissions) => {
    if (role.isSystem) {
      toast.error(t("cannotDeleteSystem"));
      return;
    }

    if (!confirm(t("confirmDelete"))) {
      return;
    }

    try {
      await roleManagementService.deleteRole(role.id);
      toast.success(t("messages.deleteSuccess"));
      fetchRoles();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.deleteError"),
      );
    }
  };

  const handleInitialize = async () => {
    try {
      const result = await roleManagementService.seedPermissionsAndRoles();
      toast.success(
        `${result.permissionsCreated} permissions et ${result.rolesCreated} rôles initialisés`,
      );
      fetchRoles();
      fetchPermissions();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.initError"),
      );
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const toggleAllPermissionsForModule = (module: string) => {
    const modulePermissions = permissions[module] || [];
    const modulePermIds = modulePermissions.map((p) => p.id);

    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      const allSelected = modulePermIds.every((id) => newSet.has(id));

      if (allSelected) {
        modulePermIds.forEach((id) => newSet.delete(id));
      } else {
        modulePermIds.forEach((id) => newSet.add(id));
      }

      return newSet;
    });
  };

  // Order modules: known first (in order), then unknowns alphabetically
  const sortedModules = [
    ...FEATURE_ORDER.filter((m) => permissions[m]),
    ...Object.keys(permissions)
      .filter((m) => !FEATURE_ORDER.includes(m))
      .sort(),
  ];

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Accès restreint
            </h2>
            <p className="text-gray-600">
              Cette page est réservée aux administrateurs
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t("loading")}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">{t("description")}</p>
          </div>
          <div className="flex items-center space-x-3">
            {roles.length === 0 && (
              <button
                onClick={handleInitialize}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                {t("initializePermissions")}
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + {t("create")}
            </button>
          </div>
        </div>

        {/* Roles table */}
        {roles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500">{t("noRoles")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("table.name")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("table.code")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("table.permissions")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("table.system")}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {role.name}
                      </div>
                      {role.description && (
                        <div className="text-sm text-gray-500">
                          {role.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {role.code}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {role.permissions.length} permission(s)
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {role.isSystem && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                          {t("systemBadge")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => openEditModal(role)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t("edit")}
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={role.isSystem}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            role.isSystem
                              ? t("cannotDeleteSystem")
                              : t("delete")
                          }
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t("create")}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="EX: CUSTOM_ROLE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Code unique (en MAJUSCULES, sans espaces)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Gestionnaire"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description du rôle..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ code: "", name: "", description: "" });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {tCommon("actions.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {tCommon("actions.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRole.name}
              </h2>
              {editingRole.isSystem && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  {t("systemBadge")}
                </span>
              )}
            </div>

            {/* Info Form */}
            <form onSubmit={handleEditInfo} className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    disabled={editingRole.isSystem}
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Mettre à jour les infos
                </button>
              </div>
            </form>

            {/* Permissions grouped by feature */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t("permissionMatrix")}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Chaque permission est indépendante. Activez uniquement
                    celles dont ce rôle a besoin.
                  </p>
                </div>
                <button
                  onClick={handleSavePermissions}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  {t("savePermissions")}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedModules.map((module) => (
                  <PermissionGroup
                    key={module}
                    module={module}
                    permissions={permissions[module] ?? []}
                    selectedPermissions={selectedPermissions}
                    onToggle={togglePermission}
                    onToggleAll={toggleAllPermissionsForModule}
                  />
                ))}
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">
                    {selectedPermissions.size}
                  </span>{" "}
                  permission(s) sélectionnée(s) sur{" "}
                  <span className="font-medium">
                    {Object.values(permissions).reduce(
                      (acc, perms) => acc + perms.length,
                      0,
                    )}
                  </span>{" "}
                  disponible(s)
                </p>
              </div>
            </div>

            {/* Close button */}
            <div className="flex justify-between mt-6 pt-4 border-t">
              <button
                onClick={handleSavePermissions}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                {t("savePermissions")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRole(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
