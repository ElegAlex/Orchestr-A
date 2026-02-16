"use client";

import { useState, useEffect } from "react";
import { Project, ProjectStatus, Priority, UpdateProjectDto } from "@/types";
import { useTranslations } from "next-intl";

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
    status: ProjectStatus.DRAFT,
    priority: Priority.NORMAL,
    startDate: "",
    endDate: "",
    budgetHours: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        name: project.name,
        description: project.description || "",
        status: project.status,
        priority: project.priority,
        startDate: project.startDate
          ? new Date(project.startDate).toISOString().split("T")[0]
          : "",
        endDate: project.endDate
          ? new Date(project.endDate).toISOString().split("T")[0]
          : "",
        budgetHours: project.budgetHours || undefined,
      });
      setError(null);
    }
  }, [project, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(
        axiosError.response?.data?.message ||
          t("projectEditModal.errorSaving"),
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
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder={t("projectEditModal.namePlaceholder")}
            />
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
                <option value={ProjectStatus.ACTIVE}>{t("status.ACTIVE")}</option>
                <option value={ProjectStatus.SUSPENDED}>{t("status.SUSPENDED")}</option>
                <option value={ProjectStatus.COMPLETED}>{t("status.COMPLETED")}</option>
                <option value={ProjectStatus.CANCELLED}>{t("status.CANCELLED")}</option>
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
                <option value={Priority.CRITICAL}>{t("priority.CRITICAL")}</option>
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
              <span>{saving ? t("projectEditModal.saving") : t("projectEditModal.save")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
