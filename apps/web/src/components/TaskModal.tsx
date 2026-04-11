"use client";

import { useState, useEffect } from "react";
import {
  Task,
  TaskStatus,
  Priority,
  Milestone,
  User,
  Project,
  Service,
  Subtask,
  TaskThirdPartyAssignee,
} from "@/types";
import { tasksService } from "@/services/tasks.service";
import { thirdPartiesService } from "@/services/third-parties.service";
import { usePermissions } from "@/hooks/usePermissions";
import { UserMultiSelect } from "./UserMultiSelect";
import { ServiceMultiSelect } from "./ServiceMultiSelect";
import { ThirdPartySelector } from "./third-parties/ThirdPartySelector";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Save handler. For create mode, returns the newly created Task so the
   * modal can chain follow-up operations (e.g. third-party assignments).
   * For update mode, return value is ignored.
   */
  onSave: (data: Record<string, unknown>) => Promise<Task | void>;
  task?: Task | null;
  projectId?: string | null; // Rendu optionnel pour les taches orphelines
  projects?: Project[]; // Liste des projets disponibles
  milestones?: Milestone[];
  users?: User[];
  services?: Service[];
  memberCounts?: Record<string, number>;
  hiddenStatuses?: TaskStatus[];
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
  hiddenStatuses = [],
}: TaskModalProps) {
  const t = useTranslations("tasks");

  const allStatuses = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
    TaskStatus.DONE,
    TaskStatus.BLOCKED,
  ];
  // Always show current task status even if hidden
  const visibleStatuses = allStatuses.filter(
    (s) => !hiddenStatuses.includes(s) || s === task?.status,
  );

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

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hasPermission } = usePermissions();
  const canAssignThirdParty = hasPermission("third_parties:assign_to_task");
  const [thirdPartyAssignees, setThirdPartyAssignees] = useState<
    TaskThirdPartyAssignee[]
  >([]);
  const [tpToAssign, setTpToAssign] = useState<string | null>(null);
  const [isAssigningTp, setIsAssigningTp] = useState(false);
  // Pending tiers for create mode (no taskId yet, buffered locally until save)
  const [pendingThirdParties, setPendingThirdParties] = useState<
    { id: string; organizationName: string }[]
  >([]);

  useEffect(() => {
    if (task?.id && isOpen) {
      thirdPartiesService
        .listTaskAssignees(task.id)
        .then(setThirdPartyAssignees)
        .catch(() => setThirdPartyAssignees([]));
      setPendingThirdParties([]);
    } else if (isOpen) {
      // Create mode: start with empty buffer and no loaded assignees
      setThirdPartyAssignees([]);
      setPendingThirdParties([]);
    }
  }, [task?.id, isOpen]);

  const handleAddThirdPartyToBuffer = async () => {
    if (!tpToAssign) return;
    setIsAssigningTp(true);
    try {
      if (task?.id) {
        // Edit mode: immediate API call
        await thirdPartiesService.assignToTask(task.id, tpToAssign);
        const updated = await thirdPartiesService.listTaskAssignees(task.id);
        setThirdPartyAssignees(updated);
        toast.success("Tiers assigné à la tâche");
      } else {
        // Create mode: buffer locally, will be POSTed after task creation
        if (pendingThirdParties.some((p) => p.id === tpToAssign)) {
          toast.error("Ce tiers est déjà dans la liste");
          return;
        }
        // Fetch organizationName for display
        const tp = await thirdPartiesService.getById(tpToAssign);
        setPendingThirdParties((prev) => [
          ...prev,
          { id: tp.id, organizationName: tp.organizationName },
        ]);
      }
      setTpToAssign(null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur lors de l'assignation";
      toast.error(typeof message === "string" ? message : "Erreur");
    } finally {
      setIsAssigningTp(false);
    }
  };

  const handleUnassignThirdParty = async (thirdPartyId: string) => {
    if (task?.id) {
      // Edit mode: immediate API call
      try {
        await thirdPartiesService.unassignFromTask(task.id, thirdPartyId);
        setThirdPartyAssignees((prev) =>
          prev.filter((a) => a.thirdPartyId !== thirdPartyId),
        );
        toast.success("Tiers retiré de la tâche");
      } catch (err) {
        console.error("Error unassigning tp:", err);
        toast.error("Erreur lors du retrait");
      }
    } else {
      // Create mode: remove from local buffer
      setPendingThirdParties((prev) =>
        prev.filter((p) => p.id !== thirdPartyId),
      );
    }
  };

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

      if (task?.subtasks) {
        setSubtasks(task.subtasks);
      } else if (task?.id) {
        tasksService.getSubtasks(task.id).then(setSubtasks).catch(() => setSubtasks([]));
      } else {
        setSubtasks([]);
      }
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
      setSubtasks([]);
      setNewSubtaskTitle("");
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

      const result = await onSave(taskData);
      // Create mode: chain third-party assignments now that we have the task id
      if (!task?.id && result && "id" in result && pendingThirdParties.length > 0) {
        const newTaskId = (result as Task).id;
        const failures: string[] = [];
        await Promise.all(
          pendingThirdParties.map((p) =>
            thirdPartiesService.assignToTask(newTaskId, p.id).catch(() => {
              failures.push(p.organizationName);
            }),
          ),
        );
        if (failures.length > 0) {
          toast.error(
            `Échec assignation: ${failures.join(", ")}. Modifiez la tâche pour réessayer.`,
          );
        } else {
          toast.success(
            `${pendingThirdParties.length} tiers assigné(s) à la tâche`,
          );
        }
      }
      onClose();
    } catch (err) {
      console.error("Error saving task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !task?.id) return;
    try {
      const created = await tasksService.createSubtask(task.id, { title: newSubtaskTitle.trim() });
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle("");
    } catch {
      // silently fail
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!task?.id) return;
    try {
      const updated = await tasksService.updateSubtask(task.id, subtask.id, {
        isCompleted: !subtask.isCompleted,
      });
      setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      // silently fail
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task?.id) return;
    try {
      await tasksService.deleteSubtask(task.id, subtaskId);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch {
      // silently fail
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

          {/* Subtasks Checklist */}
          {task?.id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sous-tâches ({subtasks.filter((s) => s.isCompleted).length}/{subtasks.length})
              </label>
              <div className="space-y-1 mb-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.isCompleted}
                      onChange={() => handleToggleSubtask(subtask)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      defaultValue={subtask.title}
                      onBlur={(e) => {
                        const newTitle = e.target.value.trim();
                        if (newTitle && newTitle !== subtask.title && task?.id) {
                          tasksService.updateSubtask(task.id, subtask.id, { title: newTitle })
                            .then((updated) => setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s))))
                            .catch(() => { e.target.value = subtask.title; });
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={`flex-1 text-sm bg-transparent border-none outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded focus:px-1 dark:focus:bg-gray-600 ${subtask.isCompleted ? "line-through text-gray-400" : "text-gray-900 dark:text-gray-100"}`}
                    />
                    {subtask.description && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        {subtask.description}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubtask())}
                  placeholder="Ajouter une sous-tâche..."
                  className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          )}

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
                {visibleStatuses.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
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
              onChange={(ids) => setFormData({ ...formData, serviceIds: ids })}
              placeholder={
                t("modal.create.servicesPlaceholder") ||
                "Inviter des services entiers"
              }
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

          {/* Intervenants tiers */}
          {canAssignThirdParty && (
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Intervenants tiers
              </label>
              {(thirdPartyAssignees.length > 0 ||
                pendingThirdParties.length > 0) && (
                <ul className="mb-3 space-y-1">
                  {thirdPartyAssignees.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
                    >
                      <span className="text-gray-800">
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 mr-2">
                          Tiers
                        </span>
                        {a.thirdParty?.organizationName ?? a.thirdPartyId}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleUnassignThirdParty(a.thirdPartyId)
                        }
                        className="text-xs text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                  {pendingThirdParties.map((p) => (
                    <li
                      key={`pending-${p.id}`}
                      className="flex items-center justify-between bg-amber-50 px-3 py-2 rounded text-sm border border-amber-200"
                    >
                      <span className="text-gray-800">
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 mr-2">
                          Tiers (en attente)
                        </span>
                        {p.organizationName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnassignThirdParty(p.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <ThirdPartySelector
                    value={tpToAssign}
                    onChange={setTpToAssign}
                    placeholder="Ajouter un tiers à la tâche…"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddThirdPartyToBuffer}
                  disabled={!tpToAssign || isAssigningTp}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isAssigningTp ? "Ajout…" : "Ajouter"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {task?.id
                  ? "Les tiers pourront se voir déclarer du temps sur cette tâche."
                  : "Les tiers ajoutés ici seront assignés à la tâche une fois créée."}
              </p>
            </div>
          )}

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
