"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  leaveTypesService,
  LeaveTypeConfig,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
} from "@/services/leave-types.service";
import toast from "react-hot-toast";

interface LeaveTypesManagerProps {
  onTypeChange?: () => void;
}

export const LeaveTypesManager = ({ onTypeChange }: LeaveTypesManagerProps) => {
  const t = useTranslations("hr.leaves.leaveTypesManager");
  const tc = useTranslations("common");
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingType, setEditingType] = useState<LeaveTypeConfig | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [formData, setFormData] = useState<CreateLeaveTypeDto>({
    code: "",
    name: "",
    description: "",
    color: "#10B981",
    icon: "🌴",
    isPaid: true,
    requiresApproval: true,
    maxDaysPerYear: undefined,
    sortOrder: 0,
  });

  const fetchLeaveTypes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await leaveTypesService.getAll(showInactive);
      setLeaveTypes(data);
    } catch (error) {
      console.error(error);
      toast.error(tc("errors.serverError"));
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      color: "#10B981",
      icon: "🌴",
      isPaid: true,
      requiresApproval: true,
      maxDaysPerYear: undefined,
      sortOrder: leaveTypes.length,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leaveTypesService.create(formData);
      toast.success(t("typeCreated"));
      setShowCreateModal(false);
      resetForm();
      fetchLeaveTypes();
      onTypeChange?.();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || tc("errors.validationError"),
      );
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType) return;

    const updateData: UpdateLeaveTypeDto = {
      name: formData.name,
      description: formData.description,
      color: formData.color,
      icon: formData.icon,
      sortOrder: formData.sortOrder,
    };

    // Les types non-système peuvent modifier plus de champs
    if (!editingType.isSystem) {
      updateData.isPaid = formData.isPaid;
      updateData.requiresApproval = formData.requiresApproval;
      updateData.maxDaysPerYear = formData.maxDaysPerYear;
    }

    try {
      await leaveTypesService.update(editingType.id, updateData);
      toast.success(t("typeUpdated"));
      setShowEditModal(false);
      setEditingType(null);
      resetForm();
      fetchLeaveTypes();
      onTypeChange?.();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || tc("errors.validationError"),
      );
    }
  };

  const handleDelete = async (type: LeaveTypeConfig) => {
    if (type.isSystem) {
      toast.error(t("typeSystemCannotDelete"));
      return;
    }

    const confirmMsg = type._count?.leaves
      ? `Ce type est utilisé par ${type._count.leaves} congé(s). Il sera désactivé au lieu d'être supprimé. Continuer ?`
      : "Êtes-vous sûr de vouloir supprimer ce type de congé ?";

    if (!confirm(confirmMsg)) return;

    try {
      const result = await leaveTypesService.delete(type.id);
      toast.success(result.message);
      fetchLeaveTypes();
      onTypeChange?.();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || tc("errors.validationError"),
      );
    }
  };

  const handleToggleActive = async (type: LeaveTypeConfig) => {
    try {
      await leaveTypesService.update(type.id, { isActive: !type.isActive });
      toast.success(type.isActive ? t("typeDeleted") : t("typeReactivated"));
      fetchLeaveTypes();
      onTypeChange?.();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || tc("errors.serverError"));
    }
  };

  const openEditModal = (type: LeaveTypeConfig) => {
    setEditingType(type);
    setFormData({
      code: type.code,
      name: type.name,
      description: type.description || "",
      color: type.color,
      icon: type.icon,
      isPaid: type.isPaid,
      requiresApproval: type.requiresApproval,
      maxDaysPerYear: type.maxDaysPerYear || undefined,
      sortOrder: type.sortOrder,
    });
    setShowEditModal(true);
  };

  const iconOptions = [
    "🌴",
    "⏰",
    "🏥",
    "📋",
    "📝",
    "📚",
    "🎓",
    "👶",
    "💒",
    "🏠",
    "✈️",
    "🎉",
  ];
  const colorOptions = [
    "#10B981",
    "#3B82F6",
    "#EF4444",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#6B7280",
    "#84CC16",
    "#14B8A6",
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Types de congés
          </h2>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-600">Afficher les inactifs</span>
          </label>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + Nouveau type
        </button>
      </div>

      {/* Liste des types */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Options
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Limite/an
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Utilisations
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaveTypes.map((type) => (
              <tr
                key={type.id}
                className={`${!type.isActive ? "bg-gray-50 opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: type.color + "20" }}
                    >
                      {type.icon}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {type.name}
                      </div>
                      {type.description && (
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {type.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {type.code}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2 text-xs">
                    {type.isPaid ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        Rémunéré
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        Non rémunéré
                      </span>
                    )}
                    {type.requiresApproval ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Validation
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                        Auto
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {type.maxDaysPerYear
                    ? `${type.maxDaysPerYear} jours`
                    : t("unlimited")}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {type._count?.leaves || 0} congé(s)
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {type.isSystem && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        Système
                      </span>
                    )}
                    {type.isActive ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        Actif
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        Inactif
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => openEditModal(type)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      title={tc("actions.edit")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    {!type.isSystem && (
                      <>
                        <button
                          onClick={() => handleToggleActive(type)}
                          className={`p-1.5 rounded transition ${
                            type.isActive
                              ? "text-gray-500 hover:text-yellow-600 hover:bg-yellow-50"
                              : "text-gray-500 hover:text-green-600 hover:bg-green-50"
                          }`}
                          title={type.isActive ? t("deactivate") : t("reactivate")}
                        >
                          {type.isActive ? (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(type)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title={tc("actions.delete")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Création */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Nouveau type de congé</h3>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z_]/g, ""),
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t("codePlaceholder")}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Majuscules et underscores uniquement
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t("namePlaceholder")}
                    required
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder={t("descriptionPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icône
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`w-8 h-8 rounded flex items-center justify-center text-lg transition ${
                          formData.icon === icon
                            ? "bg-blue-100 ring-2 ring-blue-500"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-6 h-6 rounded-full transition ${
                          formData.color === color
                            ? "ring-2 ring-offset-2 ring-blue-500"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limite annuelle
                  </label>
                  <input
                    type="number"
                    value={formData.maxDaysPerYear || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxDaysPerYear: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={t("unlimited")}
                    min={0}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPaid}
                      onChange={(e) =>
                        setFormData({ ...formData, isPaid: e.target.checked })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Rémunéré</span>
                  </label>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresApproval}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requiresApproval: e.target.checked,
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      Validation requise
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edition */}
      {showEditModal && editingType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                Modifier le type de congé
              </h3>
              {editingType.isSystem && (
                <p className="text-sm text-yellow-600 mt-1">
                  Type système : seuls le nom, la description, l&apos;icône et
                  la couleur peuvent être modifiés.
                </p>
              )}
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icône
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`w-8 h-8 rounded flex items-center justify-center text-lg transition ${
                          formData.icon === icon
                            ? "bg-blue-100 ring-2 ring-blue-500"
                            : "bg-gray-100 hover:bg-gray-200"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-6 h-6 rounded-full transition ${
                          formData.color === color
                            ? "ring-2 ring-offset-2 ring-blue-500"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!editingType.isSystem && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Limite annuelle
                    </label>
                    <input
                      type="number"
                      value={formData.maxDaysPerYear || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxDaysPerYear: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={t("unlimited")}
                      min={0}
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPaid}
                        onChange={(e) =>
                          setFormData({ ...formData, isPaid: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Rémunéré</span>
                    </label>
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.requiresApproval}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            requiresApproval: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">
                        Validation requise
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingType(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
