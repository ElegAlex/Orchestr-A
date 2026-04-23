"use client";

import { useState, useEffect } from "react";
import {
  Project,
  ProjectStatus,
  Priority,
  UpdateProjectDto,
  User,
} from "@/types";
import { useTranslations } from "next-intl";
import { EmojiPicker } from "@/components/EmojiPicker";
import { usersService } from "@/services/users.service";
import { ClientSelector } from "@/components/clients/ClientSelector";
import { usePermissions } from "@/hooks/usePermissions";

interface ProjectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UpdateProjectDto) => Promise<void>;
  project: Project;
}

export function ProjectEditModal({
  isOpen,
  onClose,
  onSave,
  project,
}: ProjectEditModalProps) {
  const t = useTranslations("projects");

  const [formData, setFormData] = useState<UpdateProjectDto>({
    name: "",
    description: "",
    icon: null,
    status: ProjectStatus.DRAFT,
    priority: Priority.NORMAL,
    startDate: "",
    endDate: "",
    managerId: "",
    sponsorId: "",
    budgetHours: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const { hasPermission } = usePermissions();
  const canAssignClients = hasPermission("clients:assign_to_project");
  const canReadClients = hasPermission("clients:read");

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        name: project.name,
        description: project.description || "",
        icon: project.icon || null,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate
          ? new Date(project.startDate).toISOString().split("T")[0]
          : "",
        endDate: project.endDate
          ? new Date(project.endDate).toISOString().split("T")[0]
          : "",
        managerId: project.managerId || "",
        sponsorId: project.sponsorId || "",
        budgetHours: project.budgetHours || undefined,
      });
      setClientIds((project.clients || []).map((c) => c.id));
      setError(null);

      // Fetch users for manager/sponsor dropdowns
      usersService
        .getAll()
        .then((response) => {
          const usersData = Array.isArray(response) ? response : response.data;
          setUsers(usersData);
        })
        .catch(() => setUsers([]));
    }
  }, [project, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload: UpdateProjectDto & {
        icon?: string | null;
        managerId?: string | null;
        sponsorId?: string | null;
        clientIds?: string[];
      } = {
        ...formData,
        icon: formData.icon || null,
        managerId: formData.managerId || null,
        sponsorId: formData.sponsorId || null,
      };
      if (canAssignClients) {
        payload.clientIds = clientIds;
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(
        axiosError.response?.data?.message || t("projectEditModal.errorSaving"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {t("projectEditModal.title")}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t("projectEditModal.nameLabel")}
            </label>
            <div className="flex items-center gap-2">
              <EmojiPicker
                value={formData.icon}
                onChange={(emoji) => setFormData({ ...formData, icon: emoji })}
              />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder={t("projectEditModal.namePlaceholder")}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t("projectEditModal.descriptionLabel")}
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder={t("projectEditModal.descriptionPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("projectEditModal.statusLabel")}
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as ProjectStatus,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value={ProjectStatus.DRAFT}>{t("status.DRAFT")}</option>
                <option value={ProjectStatus.ACTIVE}>
                  {t("status.ACTIVE")}
                </option>
                <option value={ProjectStatus.SUSPENDED}>
                  {t("status.SUSPENDED")}
                </option>
                <option value={ProjectStatus.COMPLETED}>
                  {t("status.COMPLETED")}
                </option>
                <option value={ProjectStatus.CANCELLED}>
                  {t("status.CANCELLED")}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("projectEditModal.priorityLabel")}
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as Priority,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value={Priority.LOW}>{t("priority.LOW")}</option>
                <option value={Priority.NORMAL}>{t("priority.NORMAL")}</option>
                <option value={Priority.HIGH}>{t("priority.HIGH")}</option>
                <option value={Priority.CRITICAL}>
                  {t("priority.CRITICAL")}
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("projectEditModal.startDateLabel")}
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  const currentEndDate = formData.endDate;
                  // If endDate is empty or before newStartDate, set it to newStartDate
                  // This ensures the endDate picker opens on startDate's month
                  const newEndDate =
                    !currentEndDate || currentEndDate < newStartDate
                      ? newStartDate
                      : currentEndDate;
                  setFormData({
                    ...formData,
                    startDate: newStartDate,
                    endDate: newEndDate,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("projectEditModal.endDateLabel")}
              </label>
              <input
                type="date"
                value={formData.endDate}
                min={formData.startDate || undefined}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("projectEditModal.managerLabel")}
              </label>
              <select
                value={formData.managerId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, managerId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">
                  {t("projectEditModal.managerPlaceholder")}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role?.label ?? ""})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("projectEditModal.sponsorLabel")}
              </label>
              <select
                value={formData.sponsorId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, sponsorId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">
                  {t("projectEditModal.sponsorPlaceholder")}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role?.label ?? ""})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t("projectEditModal.budgetHoursLabel")}
            </label>
            <input
              type="number"
              min="0"
              value={formData.budgetHours || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  budgetHours: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder={t("projectEditModal.budgetHoursPlaceholder")}
            />
          </div>

          {canReadClients && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Clients (commanditaires)
              </label>
              <ClientSelector
                value={clientIds}
                onChange={setClientIds}
                placeholder="Sélectionner un ou plusieurs clients…"
                disabled={!canAssignClients}
              />
              {!canAssignClients && (
                <p className="text-xs text-gray-500 mt-1">
                  Lecture seule — permission{" "}
                  <code>clients:assign_to_project</code> requise pour modifier.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              {t("projectEditModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <span>
                {saving
                  ? t("projectEditModal.saving")
                  : t("projectEditModal.save")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
