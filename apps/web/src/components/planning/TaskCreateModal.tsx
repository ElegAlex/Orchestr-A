"use client";

import { useState, useEffect } from "react";
import {
  CreateTaskDto,
  TaskStatus,
  Priority,
  Project,
  User,
  Service,
} from "@/types";
import { tasksService } from "@/services/tasks.service";
import { projectsService } from "@/services/projects.service";
import { usersService } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ServiceMultiSelect } from "@/components/ServiceMultiSelect";
import { ThirdPartySelector } from "@/components/third-parties/ThirdPartySelector";
import { thirdPartiesService } from "@/services/third-parties.service";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TaskCreateModal = ({
  isOpen,
  onClose,
  onSuccess,
}: TaskCreateModalProps) => {
  const t = useTranslations("planning.taskCreate");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<
    CreateTaskDto & { assigneeIds: string[]; serviceIds: string[] }
  >({
    title: "",
    description: "",
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    projectId: "",
    assigneeIds: [],
    serviceIds: [],
    estimatedHours: undefined,
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    isExternalIntervention: false,
  });

  const canAssignThirdParty = hasPermission("third_parties:assign_to_task");
  const [pendingThirdParties, setPendingThirdParties] = useState<
    { id: string; organizationName: string }[]
  >([]);
  const [tpToAssign, setTpToAssign] = useState<string | null>(null);

  const handleAddPendingTp = async () => {
    if (!tpToAssign) return;
    if (pendingThirdParties.some((p) => p.id === tpToAssign)) {
      toast.error("Ce tiers est déjà dans la liste");
      return;
    }
    try {
      const tp = await thirdPartiesService.getById(tpToAssign);
      setPendingThirdParties((prev) => [
        ...prev,
        { id: tp.id, organizationName: tp.organizationName },
      ]);
      setTpToAssign(null);
    } catch (err) {
      console.error("Error fetching third party:", err);
      toast.error("Erreur lors de l'ajout du tiers");
    }
  };

  const handleRemovePendingTp = (id: string) => {
    setPendingThirdParties((prev) => prev.filter((p) => p.id !== id));
  };

  useEffect(() => {
    if (isOpen) {
      if (user?.id) {
        setFormData((prev) => ({ ...prev, assigneeIds: [user.id] }));
      }
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    try {
      // Fetch projects (requires projects:read)
      let projectsData: Project[] = [];
      if (hasPermission("projects:read")) {
        try {
          if (hasPermission("tasks:readAll")) {
            const response = await projectsService.getAll();
            projectsData = Array.isArray(response.data) ? response.data : [];
          } else if (user?.id) {
            projectsData = await projectsService.getByUser(user.id);
            projectsData = Array.isArray(projectsData) ? projectsData : [];
          }
        } catch {
          projectsData = [];
        }
      }
      setProjects(projectsData);

      // Fetch users for assignment
      if (hasPermission("tasks:update") && hasPermission("users:read")) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch {
          setUsers([]);
        }
      }

      // Fetch services
      try {
        const { services: servicesData, memberCounts: counts } =
          await servicesService.getAllWithMemberCounts();
        setServices(servicesData);
        setMemberCounts(counts);
      } catch {
        setServices([]);
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
    }
  };

  const handleFormProjectChange = async (projectId: string) => {
    if (projectId) {
      try {
        const project = await projectsService.getById(projectId);
        const members =
          (project.members?.map((m) => m.user).filter(Boolean) as User[]) || [];
        setProjectMembers(members);

        // Keep only assignees who are members of the selected project
        const memberIds = members.map((m) => m.id);
        const filteredAssigneeIds = formData.assigneeIds.filter((id) =>
          memberIds.includes(id),
        );

        setFormData({
          ...formData,
          projectId,
          assigneeIds: filteredAssigneeIds,
        });
      } catch (error) {
        console.error("Error fetching project members:", error);
        setProjectMembers([]);
        setFormData({ ...formData, projectId, assigneeIds: [] });
      }
    } else {
      // No project selected (orphan task) → all users are eligible, keep assignees
      setProjectMembers([]);
      setFormData({
        ...formData,
        projectId,
        assigneeIds: formData.assigneeIds,
      });
    }
  };

  const getAvailableAssignees = (): User[] => {
    if (formData.projectId && projectMembers.length > 0) {
      return projectMembers;
    }
    return users;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const taskData: CreateTaskDto = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        projectId: formData.projectId || null,
        assigneeIds:
          formData.assigneeIds.length > 0 ? formData.assigneeIds : undefined,
        serviceIds:
          formData.serviceIds.length > 0 ? formData.serviceIds : undefined,
        estimatedHours: formData.estimatedHours || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        isExternalIntervention: formData.isExternalIntervention,
      };
      const created = await tasksService.create(taskData);
      if (pendingThirdParties.length > 0) {
        const failures: string[] = [];
        await Promise.all(
          pendingThirdParties.map((p) =>
            thirdPartiesService.assignToTask(created.id, p.id).catch(() => {
              failures.push(p.organizationName);
            }),
          ),
        );
        if (failures.length > 0) {
          toast.error(
            `Échec assignation tiers: ${failures.join(", ")}`,
          );
        } else {
          toast.success(
            `Tâche créée + ${pendingThirdParties.length} tiers assigné(s)`,
          );
        }
      } else {
        toast.success(t("success"));
      }
      if (onSuccess) await onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t("error"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      status: TaskStatus.TODO,
      priority: Priority.NORMAL,
      projectId: "",
      assigneeIds: [],
      serviceIds: [],
      estimatedHours: undefined,
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      isExternalIntervention: false,
    });
    setProjectMembers([]);
    setPendingThirdParties([]);
    setTpToAssign(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t("title")}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("titleField")}
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("titlePlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("description")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("project")}
            </label>
            <select
              value={formData.projectId || ""}
              onChange={(e) => handleFormProjectChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{t("noProject")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <UserMultiSelect
            label={t("assignees")}
            users={getAvailableAssignees()}
            selectedIds={formData.assigneeIds}
            onChange={(ids) => setFormData({ ...formData, assigneeIds: ids })}
            placeholder={t("assigneesPlaceholder")}
          />

          {services.length > 0 && (
            <ServiceMultiSelect
              label={t("services") || "Services"}
              services={services}
              selectedIds={formData.serviceIds}
              onChange={(ids) => setFormData({ ...formData, serviceIds: ids })}
              placeholder={
                t("servicesPlaceholder") || "Inviter des services entiers"
              }
              memberCounts={memberCounts}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("status")}
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as TaskStatus,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={TaskStatus.TODO}>
                  {tCommon("taskStatus.TODO")}
                </option>
                <option value={TaskStatus.IN_PROGRESS}>
                  {tCommon("taskStatus.IN_PROGRESS")}
                </option>
                <option value={TaskStatus.IN_REVIEW}>
                  {tCommon("taskStatus.IN_REVIEW")}
                </option>
                <option value={TaskStatus.DONE}>
                  {tCommon("taskStatus.DONE")}
                </option>
                <option value={TaskStatus.BLOCKED}>
                  {tCommon("taskStatus.BLOCKED")}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("priority")}
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as Priority,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={Priority.LOW}>{tCommon("priority.LOW")}</option>
                <option value={Priority.NORMAL}>
                  {tCommon("priority.NORMAL")}
                </option>
                <option value={Priority.HIGH}>
                  {tCommon("priority.HIGH")}
                </option>
                <option value={Priority.CRITICAL}>
                  {tCommon("priority.CRITICAL")}
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tCommon("form.startDate")}
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  const currentEndDate = formData.endDate;
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tCommon("form.endDate")}
              </label>
              <input
                type="date"
                value={formData.endDate}
                min={formData.startDate || undefined}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("startTime")}
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("endTime")}
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("estimationHours")}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={formData.estimatedHours || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimatedHours: e.target.value
                    ? parseFloat(e.target.value)
                    : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("estimationPlaceholder")}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isExternalIntervention"
              checked={formData.isExternalIntervention}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  isExternalIntervention: e.target.checked,
                })
              }
              className="h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <label
              htmlFor="isExternalIntervention"
              className="ml-2 block text-sm font-medium text-gray-700"
            >
              {t("externalIntervention")}
            </label>
          </div>

          {canAssignThirdParty && (
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Intervenants tiers
              </label>
              {pendingThirdParties.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {pendingThirdParties.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between bg-amber-50 px-3 py-2 rounded text-sm border border-amber-200"
                    >
                      <span className="text-gray-800">
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 mr-2">
                          🤝 Tiers
                        </span>
                        {p.organizationName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingTp(p.id)}
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
                  onClick={handleAddPendingTp}
                  disabled={!tpToAssign}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Ajouter
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Les tiers ajoutés seront assignés à la tâche après
                création.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {tCommon("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? t("creating") : t("createButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
