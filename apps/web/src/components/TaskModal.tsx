"use client";

import { useState, useEffect } from "react";
import { Task, TaskStatus, Priority, Milestone, User, Project, Service } from "@/types";
import { UserMultiSelect } from "./UserMultiSelect";
import { ServiceMultiSelect } from "./ServiceMultiSelect";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  task?: Task | null;
  projectId?: string | null; // Rendu optionnel pour les taches orphelines
  projects?: Project[]; // Liste des projets disponibles
  milestones?: Milestone[];
  users?: User[];
  services?: Service[];
  memberCounts?: Record<string, number>;
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  task,
  projectId,
  projects = [],
  milestones = [],
  users = [],
  services = [],
  memberCounts = {},
}: TaskModalProps) {
  const t = useTranslations("tasks");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    projectId: projectId || "",
    milestoneId: "",
    assigneeIds: [] as string[],
    serviceIds: [] as string[],
    estimatedHours: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      // Extraire les IDs des assignés depuis la relation assignees
      const taskAssigneeIds =
        (task.assignees
          ?.map((a) => a.user?.id || a.userId)
          .filter(Boolean) as string[]) || [];
      // Si pas d'assignees multiples mais un assigneeId, l'utiliser
      const assigneeIds =
        taskAssigneeIds.length > 0
          ? taskAssigneeIds
          : task.assigneeId
            ? [task.assigneeId]
            : [];

      setFormData({
        title: task.title || "",
        description: task.description || "",
        status: task.status || TaskStatus.TODO,
        priority: task.priority || Priority.NORMAL,
        projectId: task.projectId || "",
        milestoneId: task.milestoneId || "",
        assigneeIds,
        serviceIds: [],
        estimatedHours: task.estimatedHours?.toString() || "",
        startDate: task.startDate
          ? new Date(task.startDate).toISOString().split("T")[0]
          : "",
        endDate: task.endDate
          ? new Date(task.endDate).toISOString().split("T")[0]
          : "",
        startTime: task.startTime || "",
        endTime: task.endTime || "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        status: TaskStatus.TODO,
        priority: Priority.NORMAL,
        projectId: projectId || "",
        milestoneId: "",
        assigneeIds: [],
        serviceIds: [],
        estimatedHours: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
      });
    }
  }, [task, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error(t("modal.create.titleRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        // projectId peut etre null pour les taches orphelines
        projectId: formData.projectId || null,
      };

      // milestoneId seulement si un projet est selectionne
      if (formData.milestoneId && formData.projectId) {
        taskData.milestoneId = formData.milestoneId;
      }
      // Utiliser assigneeIds pour l'assignation multiple
      if (formData.assigneeIds.length > 0) {
        taskData.assigneeIds = formData.assigneeIds;
      } else {
        taskData.assigneeIds = [];
      }
      if (formData.serviceIds.length > 0) {
        taskData.serviceIds = formData.serviceIds;
      }
      if (formData.estimatedHours)
        taskData.estimatedHours = parseFloat(formData.estimatedHours);
      if (formData.startDate)
        taskData.startDate = new Date(formData.startDate).toISOString();
      if (formData.endDate)
        taskData.endDate = new Date(formData.endDate).toISOString();
      if (formData.startTime) taskData.startTime = formData.startTime;
      if (formData.endTime) taskData.endTime = formData.endTime;

      await onSave(taskData);
      onClose();
    } catch (err) {
      console.error("Error saving task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrer les milestones par projet selectionne
  const filteredMilestones = formData.projectId
    ? milestones.filter((m) => m.projectId === formData.projectId)
    : [];

  // Indique si le selecteur de projet doit etre affiche
  const showProjectSelector = projects.length > 0 && !projectId;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {task ? t("modal.edit.title") : t("modal.create.title")}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("modal.create.titleLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("modal.create.titlePlaceholder")}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("modal.create.descriptionLabel")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("modal.create.descriptionPlaceholder")}
            />
          </div>

          {/* Selecteur de projet (affiche uniquement si pas de projectId fixe) */}
          {showProjectSelector && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.projectLabel")}
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => {
                  const newProjectId = e.target.value;

                  if (newProjectId) {
                    // Filter assignees: keep only those who are in the selected project
                    const selectedProject = projects.find(
                      (p) => p.id === newProjectId,
                    );
                    const projectMemberIds =
                      selectedProject?.members?.map((m) => m.userId) || [];
                    const filteredAssigneeIds = formData.assigneeIds.filter(
                      (id) => projectMemberIds.includes(id),
                    );

                    setFormData({
                      ...formData,
                      projectId: newProjectId,
                      milestoneId: "", // Reset milestone when project changes
                      assigneeIds: filteredAssigneeIds,
                    });
                  } else {
                    // No project → keep all assignees (orphan task)
                    setFormData({
                      ...formData,
                      projectId: newProjectId,
                      milestoneId: "",
                    });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t("modal.create.noProject")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t("modal.create.projectHint")}
              </p>
            </div>
          )}

          {/* Statut et Priorité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.statusLabel")}
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as TaskStatus,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={TaskStatus.TODO}>{t("status.TODO")}</option>
                <option value={TaskStatus.IN_PROGRESS}>
                  {t("status.IN_PROGRESS")}
                </option>
                <option value={TaskStatus.IN_REVIEW}>
                  {t("status.IN_REVIEW")}
                </option>
                <option value={TaskStatus.BLOCKED}>
                  {t("status.BLOCKED")}
                </option>
                <option value={TaskStatus.DONE}>{t("status.DONE")}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.priorityLabel")}
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as Priority,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Jalon et Assigné */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.milestoneLabel")}
              </label>
              <select
                value={formData.milestoneId}
                onChange={(e) =>
                  setFormData({ ...formData, milestoneId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!formData.projectId}
              >
                <option value="">
                  {formData.projectId
                    ? t("modal.create.noMilestone")
                    : t("modal.create.selectProjectFirst")}
                </option>
                {filteredMilestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <UserMultiSelect
                label={t("modal.create.assigneesLabel")}
                users={users}
                selectedIds={formData.assigneeIds}
                onChange={(ids) =>
                  setFormData({ ...formData, assigneeIds: ids })
                }
                placeholder={t("modal.create.assigneesPlaceholder")}
              />
            </div>
          </div>

          {/* Services */}
          {services.length > 0 && (
            <ServiceMultiSelect
              label={t("modal.create.servicesLabel") || "Services"}
              services={services}
              selectedIds={formData.serviceIds}
              onChange={(ids) =>
                setFormData({ ...formData, serviceIds: ids })
              }
              placeholder={t("modal.create.servicesPlaceholder") || "Inviter des services entiers"}
              memberCounts={memberCounts}
            />
          )}

          {/* Estimation et dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.estimatedHoursLabel")}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedHours: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t("modal.create.estimatedHoursPlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.startDateLabel")}
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  const currentEndDate = formData.endDate;
                  // Auto-remplir endDate si vide ou antérieure à la nouvelle startDate
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.endDateLabel")}
              </label>
              <input
                type="date"
                value={formData.endDate}
                min={formData.startDate || undefined}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Horaires optionnels */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.startTimeLabel")}
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.endTimeLabel")}
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              {t("modal.create.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{t("modal.create.saving")}</span>
                </>
              ) : (
                <span>
                  {task ? t("modal.edit.submit") : t("modal.create.submit")}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
