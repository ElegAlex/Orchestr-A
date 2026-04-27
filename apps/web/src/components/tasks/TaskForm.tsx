"use client";

/**
 * TaskForm — composant unique de formulaire de tâche utilisé par :
 *   - TaskModal (projects/[id]) : create + edit, avec milestones + subtasks
 *   - TaskCreateModal (planning) : create only, avec isExternalIntervention
 *   - tasks/page.tsx (liste globale) : create only, avec isExternalIntervention
 *
 * Les consumers gèrent :
 *   - la récupération des données de référence (projects, users, services, milestones)
 *   - l'appel API (tasksService.create ou tasksService.update) via onSubmit
 *   - la fermeture de la modale (onCancel)
 *
 * TaskForm gère :
 *   - l'état du formulaire (values + pending third parties)
 *   - la validation client
 *   - le chaînage des assignations tiers APRÈS que onSubmit ait retourné la tâche créée
 *   - les subtasks CRUD (mode edit uniquement, quand initialTask.id existe)
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
  Milestone,
  Priority,
  Project,
  Service,
  Subtask,
  Task,
  TaskStatus,
  TaskThirdPartyAssignee,
  User,
} from "@/types";
import { tasksService } from "@/services/tasks.service";
import { projectsService } from "@/services/projects.service";
import { thirdPartiesService } from "@/services/third-parties.service";
import { usePermissions } from "@/hooks/usePermissions";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ServiceMultiSelect } from "@/components/ServiceMultiSelect";
import { ThirdPartySelector } from "@/components/third-parties/ThirdPartySelector";

// ─── Types publics ───────────────────────────────────────────────────────────

export interface PendingThirdParty {
  id: string;
  organizationName: string;
}

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string; // "" si orphelin
  milestoneId: string;
  assigneeIds: string[];
  serviceIds: string[];
  estimatedHours: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isExternalIntervention: boolean;
}

export interface TaskFormSubmitPayload {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string | null;
  milestoneId?: string;
  assigneeIds: string[];
  serviceIds?: string[];
  estimatedHours?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isExternalIntervention?: boolean;
}

export interface TaskFormProps {
  mode: "create" | "edit";
  /** Tâche initiale pour le mode edit. Ignorée en mode create. */
  initialTask?: Task | null;
  /** Valeurs initiales pour le mode create (ex: assigneeIds par défaut). */
  initialValues?: Partial<TaskFormValues>;

  // Données de référence
  projects: Project[];
  users: User[];
  services: Service[];
  milestones?: Milestone[];
  memberCounts?: Record<string, number>;
  /**
   * Indique que la liste des utilisateurs (assignables) est en cours de
   * résolution côté parent. Quand true, la section "assignés" affiche un
   * squelette au lieu d'une liste vide, ce qui évite le blink (BUG-02).
   */
  isUsersLoading?: boolean;

  // Capability switches
  /** Si défini, masque le sélecteur de projet et force le projectId. */
  lockedProjectId?: string | null;
  /** Active le champ milestone (default: false). */
  enableMilestone?: boolean;
  /** Active le checkbox isExternalIntervention (default: false). */
  enableExternalIntervention?: boolean;
  /** Active la section Intervenants tiers (default: false). La permission est vérifiée par le parent. */
  enableThirdParties?: boolean;
  /** Masque certains statuts (celui de la tâche courante reste toujours visible). */
  hiddenStatuses?: TaskStatus[];
  /**
   * Si true, lorsque l'utilisateur sélectionne un projet, TaskForm fetch
   * les membres du projet via projectsService.getById(projectId) et filtre
   * la liste des assignés sélectionnables à ces membres uniquement.
   * Utilisé par les consumers planning et tasks/page (alignement historique).
   * default: false.
   */
  filterAssigneesByProjectMembers?: boolean;

  /**
   * Appelé au submit. Le parent fait l'appel API (create ou update) et
   * retourne la tâche (pour le chaînage des assignations tiers) ou void
   * (mode edit sans création nouvelle).
   */
  onSubmit: (payload: TaskFormSubmitPayload) => Promise<Task | void>;
  onCancel: () => void;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const ALL_STATUSES: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.DONE,
  TaskStatus.BLOCKED,
];

function makeDefaultValues(
  initialTask: Task | null | undefined,
  lockedProjectId: string | null | undefined,
  initialValues?: Partial<TaskFormValues>,
): TaskFormValues {
  if (initialTask) {
    const taskAssigneeIds =
      (initialTask.assignees
        ?.map((a) => a.user?.id || a.userId)
        .filter(Boolean) as string[]) || [];
    const assigneeIds =
      taskAssigneeIds.length > 0
        ? taskAssigneeIds
        : initialTask.assigneeId
          ? [initialTask.assigneeId]
          : [];

    return {
      title: initialTask.title || "",
      description: initialTask.description || "",
      status: initialTask.status || TaskStatus.TODO,
      priority: initialTask.priority || Priority.NORMAL,
      projectId: initialTask.projectId || "",
      milestoneId: initialTask.milestoneId || "",
      assigneeIds,
      serviceIds: [],
      estimatedHours: initialTask.estimatedHours?.toString() || "",
      startDate: initialTask.startDate
        ? new Date(initialTask.startDate).toISOString().split("T")[0]
        : "",
      endDate: initialTask.endDate
        ? new Date(initialTask.endDate).toISOString().split("T")[0]
        : "",
      startTime: initialTask.startTime || "",
      endTime: initialTask.endTime || "",
      isExternalIntervention: initialTask.isExternalIntervention || false,
    };
  }

  return {
    title: "",
    description: "",
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    projectId: lockedProjectId ?? "",
    milestoneId: "",
    assigneeIds: [],
    serviceIds: [],
    estimatedHours: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    isExternalIntervention: false,
    ...initialValues,
  };
}

function toSubmitPayload(
  values: TaskFormValues,
  mode: "create" | "edit",
  enableMilestone: boolean,
  enableExternalIntervention: boolean,
): TaskFormSubmitPayload {
  // In edit mode we keep the raw description string (including empty) so the
  // user can clear an existing description. In create mode empty = absent.
  const description =
    mode === "edit" ? values.description : values.description || undefined;

  const payload: TaskFormSubmitPayload = {
    title: values.title,
    description,
    status: values.status,
    priority: values.priority,
    projectId: values.projectId || null,
    assigneeIds: values.assigneeIds,
  };

  if (enableMilestone && values.milestoneId && values.projectId) {
    payload.milestoneId = values.milestoneId;
  }
  if (values.serviceIds.length > 0) {
    payload.serviceIds = values.serviceIds;
  }
  if (values.estimatedHours) {
    const parsed = parseFloat(values.estimatedHours);
    if (!Number.isNaN(parsed)) payload.estimatedHours = parsed;
  }
  if (values.startDate) {
    payload.startDate = new Date(values.startDate).toISOString();
  }
  if (values.endDate) {
    payload.endDate = new Date(values.endDate).toISOString();
  }
  if (values.startTime) payload.startTime = values.startTime;
  if (values.endTime) payload.endTime = values.endTime;
  if (enableExternalIntervention) {
    payload.isExternalIntervention = values.isExternalIntervention;
  }

  return payload;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function TaskForm({
  mode,
  initialTask,
  initialValues,
  projects,
  users,
  services,
  milestones = [],
  memberCounts = {},
  isUsersLoading = false,
  lockedProjectId,
  enableMilestone = false,
  enableExternalIntervention = false,
  enableThirdParties = false,
  hiddenStatuses = [],
  filterAssigneesByProjectMembers = false,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const t = useTranslations("tasks");

  const [values, setValues] = useState<TaskFormValues>(() =>
    makeDefaultValues(initialTask, lockedProjectId, initialValues),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subtasks (mode edit uniquement, avec initialTask.id persisté)
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Third parties
  const [thirdPartyAssignees, setThirdPartyAssignees] = useState<
    TaskThirdPartyAssignee[]
  >([]);
  const [pendingThirdParties, setPendingThirdParties] = useState<
    PendingThirdParty[]
  >([]);
  const [tpToAssign, setTpToAssign] = useState<string | null>(null);
  const [isAssigningTp, setIsAssigningTp] = useState(false);

  // Project members (filtered assignee list). Only populated when
  // filterAssigneesByProjectMembers is true AND a project is selected.
  const [projectMembers, setProjectMembers] = useState<User[]>([]);

  // RBAC bypass: users with tasks:assign_any_user see ALL users even when
  // the consumer asks to filter by project members (managers, admins...).
  const { hasPermission } = usePermissions();
  const canAssignAnyUser = hasPermission("tasks:assign_any_user");
  const effectiveFilterByMembers =
    filterAssigneesByProjectMembers && !canAssignAnyUser;

  const visibleStatuses = ALL_STATUSES.filter(
    (s) => !hiddenStatuses.includes(s) || s === initialTask?.status,
  );

  const showProjectSelector = lockedProjectId == null && projects.length > 0;

  const filteredMilestones =
    enableMilestone && values.projectId
      ? milestones.filter((m) => m.projectId === values.projectId)
      : [];

  // Reset state when initialTask changes (useful when parent toggles between create/edit)
  useEffect(() => {
    setValues(makeDefaultValues(initialTask, lockedProjectId, initialValues));
    // Subtasks: load only in edit mode when we have a persisted id
    if (mode === "edit" && initialTask?.id) {
      if (initialTask.subtasks) {
        setSubtasks(initialTask.subtasks);
      } else {
        tasksService
          .getSubtasks(initialTask.id)
          .then(setSubtasks)
          .catch(() => setSubtasks([]));
      }
    } else {
      setSubtasks([]);
    }
    setNewSubtaskTitle("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask, lockedProjectId, mode]);

  // Load third-party assignees in edit mode; always reset pending buffer on init
  useEffect(() => {
    if (enableThirdParties && mode === "edit" && initialTask?.id) {
      thirdPartiesService
        .listTaskAssignees(initialTask.id)
        .then(setThirdPartyAssignees)
        .catch(() => setThirdPartyAssignees([]));
    } else {
      setThirdPartyAssignees([]);
    }
    setPendingThirdParties([]);
    setTpToAssign(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask?.id, mode, enableThirdParties]);

  // ─── Subtask handlers (edit mode only) ────────────────────────────────────

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !initialTask?.id) return;
    try {
      const created = await tasksService.createSubtask(initialTask.id, {
        title: newSubtaskTitle.trim(),
      });
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle("");
    } catch {
      // silent fail
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!initialTask?.id) return;
    try {
      const updated = await tasksService.updateSubtask(
        initialTask.id,
        subtask.id,
        { isCompleted: !subtask.isCompleted },
      );
      setSubtasks((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } catch {
      // silent fail
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!initialTask?.id) return;
    try {
      await tasksService.deleteSubtask(initialTask.id, subtaskId);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch {
      // silent fail
    }
  };

  // ─── Third-party handlers ────────────────────────────────────────────────

  const handleAddThirdParty = async () => {
    if (!tpToAssign) return;
    setIsAssigningTp(true);
    try {
      if (mode === "edit" && initialTask?.id) {
        // Immediate API call
        await thirdPartiesService.assignToTask(initialTask.id, tpToAssign);
        const updated = await thirdPartiesService.listTaskAssignees(
          initialTask.id,
        );
        setThirdPartyAssignees(updated);
        toast.success("Tiers assigné à la tâche");
      } else {
        // Buffer locally; POSTed after task creation
        if (pendingThirdParties.some((p) => p.id === tpToAssign)) {
          toast.error("Ce tiers est déjà dans la liste");
          return;
        }
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

  const handleRemoveThirdParty = async (thirdPartyId: string) => {
    if (mode === "edit" && initialTask?.id) {
      try {
        await thirdPartiesService.unassignFromTask(
          initialTask.id,
          thirdPartyId,
        );
        setThirdPartyAssignees((prev) =>
          prev.filter((a) => a.thirdPartyId !== thirdPartyId),
        );
        toast.success("Tiers retiré de la tâche");
      } catch {
        toast.error("Erreur lors du retrait");
      }
    } else {
      setPendingThirdParties((prev) =>
        prev.filter((p) => p.id !== thirdPartyId),
      );
    }
  };

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!values.title.trim()) {
      toast.error(t("modal.create.titleRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = toSubmitPayload(
        values,
        mode,
        enableMilestone,
        enableExternalIntervention,
      );
      const result = await onSubmit(payload);

      // Create mode: chain pending third-party assignments
      if (
        mode === "create" &&
        result &&
        typeof result === "object" &&
        "id" in result &&
        pendingThirdParties.length > 0
      ) {
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
            `Échec assignation tiers: ${failures.join(", ")}. Modifiez la tâche pour réessayer.`,
          );
        } else {
          toast.success(
            `${pendingThirdParties.length} tiers assigné(s) à la tâche`,
          );
        }
      }
    } catch (err) {
      // Parent is responsible for error toasting; we just log.
      console.error("TaskForm submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Project change handler (filters assignees to project members) ───────

  const handleProjectChange = async (newProjectId: string) => {
    if (!newProjectId) {
      setProjectMembers([]);
      setValues({
        ...values,
        projectId: "",
        milestoneId: "",
      });
      return;
    }

    if (effectiveFilterByMembers) {
      // Rich mode: fetch the project to get its .members relation and
      // narrow both the assignee dropdown and the current selection.
      try {
        const project = await projectsService.getById(newProjectId);
        const members =
          (project.members?.map((m) => m.user).filter(Boolean) as User[]) || [];
        setProjectMembers(members);
        const memberIds = members.map((m) => m.id);
        setValues({
          ...values,
          projectId: newProjectId,
          milestoneId: "",
          assigneeIds: values.assigneeIds.filter((id) =>
            memberIds.includes(id),
          ),
        });
      } catch {
        setProjectMembers([]);
        setValues({
          ...values,
          projectId: newProjectId,
          milestoneId: "",
          assigneeIds: [],
        });
      }
      return;
    }

    // Light mode (default): filter assignees using whatever member data
    // the projects prop already carries. If no member data, keep current.
    const selectedProject = projects.find((p) => p.id === newProjectId);
    const projectMemberIds =
      selectedProject?.members?.map((m) => m.userId) || [];
    const filteredAssigneeIds =
      projectMemberIds.length > 0
        ? values.assigneeIds.filter((id) => projectMemberIds.includes(id))
        : values.assigneeIds;
    setValues({
      ...values,
      projectId: newProjectId,
      milestoneId: "",
      assigneeIds: filteredAssigneeIds,
    });
  };

  // List of users shown in the UserMultiSelect. When filter is active AND a
  // project is selected AND we fetched its members, narrow the list.
  const availableAssignees: User[] =
    effectiveFilterByMembers && values.projectId && projectMembers.length > 0
      ? projectMembers
      : users;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {t("modal.create.titleLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
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
          value={values.description}
          onChange={(e) =>
            setValues({ ...values, description: e.target.value })
          }
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t("modal.create.descriptionPlaceholder")}
        />
      </div>

      {/* Subtasks (edit mode only, persisted task) */}
      {mode === "edit" && initialTask?.id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sous-tâches ({subtasks.filter((s) => s.isCompleted).length}/
            {subtasks.length})
          </label>
          <div className="space-y-1 mb-2">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-gray-50"
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
                    if (
                      newTitle &&
                      newTitle !== subtask.title &&
                      initialTask?.id
                    ) {
                      tasksService
                        .updateSubtask(initialTask.id, subtask.id, {
                          title: newTitle,
                        })
                        .then((updated) =>
                          setSubtasks((prev) =>
                            prev.map((s) =>
                              s.id === updated.id ? updated : s,
                            ),
                          ),
                        )
                        .catch(() => {
                          e.target.value = subtask.title;
                        });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      (e.target as HTMLInputElement).blur();
                  }}
                  className={`flex-1 text-sm bg-transparent border-none outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded focus:px-1 ${
                    subtask.isCompleted
                      ? "line-through text-gray-400"
                      : "text-gray-900"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteSubtask(subtask.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
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
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), handleAddSubtask())
              }
              placeholder="Ajouter une sous-tâche..."
              className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Project selector */}
      {showProjectSelector && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            {t("modal.create.projectLabel")}
          </label>
          <select
            value={values.projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
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

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            {t("modal.create.statusLabel")}
          </label>
          <select
            value={values.status}
            onChange={(e) =>
              setValues({ ...values, status: e.target.value as TaskStatus })
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
            value={values.priority}
            onChange={(e) =>
              setValues({ ...values, priority: e.target.value as Priority })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={Priority.LOW}>{t("priority.LOW")}</option>
            <option value={Priority.NORMAL}>{t("priority.NORMAL")}</option>
            <option value={Priority.HIGH}>{t("priority.HIGH")}</option>
            <option value={Priority.CRITICAL}>{t("priority.CRITICAL")}</option>
          </select>
        </div>
      </div>

      {/* Milestone + Assignees */}
      <div className="grid grid-cols-2 gap-4">
        {enableMilestone && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("modal.create.milestoneLabel")}
            </label>
            <select
              value={values.milestoneId}
              onChange={(e) =>
                setValues({ ...values, milestoneId: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!values.projectId}
            >
              <option value="">
                {values.projectId
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
        )}

        <div className={enableMilestone ? "" : "col-span-2"}>
          {isUsersLoading ? (
            <div data-testid="assignees-skeleton" aria-busy="true">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("modal.create.assigneesLabel")}
              </label>
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          ) : (
            <UserMultiSelect
              label={t("modal.create.assigneesLabel")}
              users={availableAssignees}
              selectedIds={values.assigneeIds}
              onChange={(ids) =>
                setValues((current) => ({ ...current, assigneeIds: ids }))
              }
              placeholder={t("modal.create.assigneesPlaceholder")}
            />
          )}
          {effectiveFilterByMembers && values.projectId && (
            <p className="text-xs text-gray-500 mt-1">
              {projectMembers.length > 0
                ? `${projectMembers.length} membre(s) du projet disponibles`
                : "Aucun membre sur ce projet — ajoutez-en via l'onglet Équipe"}
            </p>
          )}
        </div>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <ServiceMultiSelect
          label={t("modal.create.servicesLabel") || "Services"}
          services={services}
          selectedIds={values.serviceIds}
          onChange={(ids) => setValues({ ...values, serviceIds: ids })}
          placeholder={
            t("modal.create.servicesPlaceholder") ||
            "Inviter des services entiers"
          }
          memberCounts={memberCounts}
        />
      )}

      {/* Estimation + dates */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            {t("modal.create.estimatedHoursLabel")}
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={values.estimatedHours}
            onChange={(e) =>
              setValues({ ...values, estimatedHours: e.target.value })
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
            value={values.startDate}
            onChange={(e) => {
              const newStartDate = e.target.value;
              const currentEndDate = values.endDate;
              const newEndDate =
                !currentEndDate || currentEndDate < newStartDate
                  ? newStartDate
                  : currentEndDate;
              setValues({
                ...values,
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
            value={values.endDate}
            min={values.startDate || undefined}
            onChange={(e) => setValues({ ...values, endDate: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            {t("modal.create.startTimeLabel")}
          </label>
          <input
            type="time"
            value={values.startTime}
            onChange={(e) =>
              setValues({ ...values, startTime: e.target.value })
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
            value={values.endTime}
            onChange={(e) => setValues({ ...values, endTime: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* External intervention */}
      {enableExternalIntervention && (
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isExternalIntervention"
            checked={values.isExternalIntervention}
            onChange={(e) =>
              setValues({
                ...values,
                isExternalIntervention: e.target.checked,
              })
            }
            className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
          />
          <label
            htmlFor="isExternalIntervention"
            className="ml-2 block text-sm font-medium text-gray-700"
          >
            {t("modal.create.externalInterventionLabel")}
          </label>
        </div>
      )}

      {/* Third parties section */}
      {enableThirdParties && (
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
                      🤝 Tiers
                    </span>
                    {a.thirdParty?.organizationName ?? a.thirdPartyId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveThirdParty(a.thirdPartyId)}
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
                      🤝 Tiers (en attente)
                    </span>
                    {p.organizationName}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveThirdParty(p.id)}
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
              onClick={handleAddThirdParty}
              disabled={!tpToAssign || isAssigningTp}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isAssigningTp ? "Ajout…" : "Ajouter"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {mode === "edit" && initialTask?.id
              ? "Les tiers pourront se voir déclarer du temps sur cette tâche."
              : "Les tiers ajoutés ici seront assignés à la tâche une fois créée."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
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
              {mode === "edit"
                ? t("modal.edit.submit")
                : t("modal.create.submit")}
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
