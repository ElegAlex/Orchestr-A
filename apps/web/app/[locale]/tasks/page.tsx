"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { tasksService } from "@/services/tasks.service";
import { projectsService } from "@/services/projects.service";
import { Task, TaskStatus, Priority, Project, User, Service } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { usersService } from "@/services/users.service";
import { servicesService } from "@/services/services.service";
import { TaskForm } from "@/components/tasks/TaskForm";
import TaskKanban from "@/components/tasks/TaskKanban";
import { TaskListView } from "@/components/tasks/TaskListView";
import toast from "react-hot-toast";

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [orphanTasks, setOrphanTasks] = useState<Task[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<Priority | "ALL">(
    "ALL",
  );
  const [overdueFilter, setOverdueFilter] = useState(
    searchParams.get("overdue") === "true",
  );
  const initialStatusParam = searchParams.get("status");
  const isValidTaskStatus = (v: string | null): v is TaskStatus =>
    !!v && (Object.values(TaskStatus) as string[]).includes(v);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">(
    isValidTaskStatus(initialStatusParam) ? initialStatusParam : "ALL",
  );
  const assigneeMeFilter = searchParams.get("assignee") === "me";
  const [viewMode, setViewMode] = useState<"kanban" | "list">(
    isValidTaskStatus(initialStatusParam) ? "list" : "kanban",
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

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
        } catch (err) {
          projectsData = [];
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching projects:", err);
        }
      }
      setProjects(projectsData);

      // Fetch tasks
      let tasksData: Task[] = [];
      if (user?.id) {
        try {
          // ?assignee=me force le scope "mes tâches" quel que soit le rôle
          // (utilisé par les CTA du Dashboard)
          if (assigneeMeFilter) {
            tasksData = await tasksService.getByAssignee(user.id);
            tasksData = Array.isArray(tasksData) ? tasksData : [];
          } else if (hasPermission("tasks:readAll")) {
            const response = await tasksService.getAll(1, 1000);
            tasksData = Array.isArray(response.data) ? response.data : [];
          } else {
            tasksData = await tasksService.getByAssignee(user.id);
            tasksData = Array.isArray(tasksData) ? tasksData : [];
          }
        } catch (err) {
          tasksData = [];
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching tasks:", err);
        }
      }
      setTasks(tasksData);

      // Fetch orphan tasks
      if (hasPermission("tasks:create")) {
        try {
          const orphans = await tasksService.getOrphans();
          setOrphanTasks(Array.isArray(orphans) ? orphans : []);
        } catch (err) {
          setOrphanTasks([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching orphan tasks:", err);
        }
      }

      // Fetch users for assignment
      if (hasPermission("tasks:update") && hasPermission("users:read")) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch (err) {
          setUsers([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404)
            console.error("Error fetching users:", err);
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
      toast.error(t("messages.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, assigneeMeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success(t("messages.statusUpdateSuccess"));
      fetchData();
    } catch {
      toast.error(t("messages.statusUpdateError"));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksService.delete(taskId);
      toast.success(
        t("messages.deleteSuccess", { defaultValue: "Tâche supprimée" }),
      );
      fetchData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ||
          t("messages.deleteError", {
            defaultValue: "Erreur lors de la suppression",
          }),
      );
    }
  };

  const handleDateChange = async (
    taskId: string,
    field: "startDate" | "endDate",
    value: string,
  ) => {
    try {
      await tasksService.update(taskId, {
        [field]: new Date(value).toISOString(),
      });
      fetchData();
    } catch {
      toast.error(
        t("messages.updateError", {
          defaultValue: "Erreur lors de la mise à jour",
        }),
      );
    }
  };

  const isTaskOverdue = (task: Task) => {
    return (
      task.endDate &&
      new Date(task.endDate) < new Date() &&
      task.status !== TaskStatus.DONE
    );
  };

  const toggleOverdueFilter = () => {
    const next = !overdueFilter;
    setOverdueFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("overdue", "true");
    } else {
      params.delete("overdue");
    }
    router.replace(`/${locale}/tasks?${params.toString()}`, { scroll: false });
  };

  const getFilteredTasks = () => {
    let filtered: Task[] = [];

    if (selectedProject === "ORPHAN") {
      // Show orphan tasks (tasks without project)
      filtered = orphanTasks;
    } else if (selectedProject === "ALL") {
      // Show all tasks including orphans
      filtered = [
        ...tasks,
        ...orphanTasks.filter((ot) => !tasks.some((t) => t.id === ot.id)),
      ];
    } else {
      filtered = tasks.filter((t) => t.projectId === selectedProject);
    }

    if (selectedPriority !== "ALL") {
      filtered = filtered.filter((t) => t.priority === selectedPriority);
    }

    if (overdueFilter) {
      filtered = filtered.filter(isTaskOverdue);
    }

    if (statusFilter !== "ALL") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    return filtered;
  };

  const clearStatusFilter = () => {
    setStatusFilter("ALL");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    router.replace(
      `/${locale}/tasks${params.toString() ? `?${params.toString()}` : ""}`,
      { scroll: false },
    );
  };

  const canCreateTask = () => {
    return (
      hasPermission("tasks:create") ||
      hasPermission("tasks:create_orphan") ||
      hasPermission("tasks:create_in_project")
    );
  };

  const handleTaskClick = (task: Task) => {
    router.push(`/${locale}/tasks/${task.id}`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{tCommon("actions.loading")}</p>
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
            <p className="text-gray-600 mt-1">
              {t("taskCount", { count: getFilteredTasks().length })}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-3 py-1.5 rounded text-sm transition ${
                  viewMode === "kanban"
                    ? "bg-white shadow-sm font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded text-sm transition ${
                  viewMode === "list"
                    ? "bg-white shadow-sm font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Liste
              </button>
            </div>
            {canCreateTask() && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
              >
                <span>+</span>
                <span>{t("createTask")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.project")}
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">{t("filters.allProjects")}</option>
                <option value="ORPHAN">{t("filters.orphanTasks")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.priority")}
              </label>
              <select
                value={selectedPriority}
                onChange={(e) =>
                  setSelectedPriority(e.target.value as Priority | "ALL")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">{t("filters.allPriorities")}</option>
                <option value={Priority.CRITICAL}>
                  {t("priority.CRITICAL")}
                </option>
                <option value={Priority.HIGH}>{t("priority.HIGH")}</option>
                <option value={Priority.NORMAL}>{t("priority.NORMAL")}</option>
                <option value={Priority.LOW}>{t("priority.LOW")}</option>
              </select>
            </div>
          </div>
          {/* Overdue Filter Toggle */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleOverdueFilter}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition ${
                overdueFilter
                  ? "bg-red-100 text-red-800 ring-1 ring-red-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-2 ${overdueFilter ? "bg-red-500" : "bg-gray-400"}`}
              />
              {t("filters.overdue")}
            </button>
            {statusFilter !== "ALL" && (
              <button
                onClick={clearStatusFilter}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 ring-1 ring-blue-300 hover:bg-blue-200 transition"
                aria-label="clear status filter"
              >
                <span className="w-2 h-2 rounded-full mr-2 bg-blue-500" />
                {t(`status.${statusFilter}`, { defaultValue: statusFilter })}
                <span className="ml-2 text-blue-600">×</span>
              </button>
            )}
          </div>
        </div>

        {/* Kanban Board / List View */}
        {viewMode === "kanban" ? (
          <TaskKanban
            tasks={getFilteredTasks()}
            onTaskClick={(task) => router.push(`/${locale}/tasks/${task.id}`)}
            onAfterStatusChange={fetchData}
            showProjectBadge
            showOverdueBadge
            showStatusArrows
          />
        ) : (
          <TaskListView
            tasks={getFilteredTasks()}
            onStatusChange={handleStatusChange}
            onTaskClick={handleTaskClick}
            onDelete={handleDeleteTask}
            onDateChange={handleDateChange}
            showProject={true}
          />
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {t("modal.create.title")}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
            <TaskForm
              mode="create"
              projects={projects}
              users={users}
              isUsersLoading={loading}
              services={services}
              memberCounts={memberCounts}
              enableExternalIntervention
              enableThirdParties={hasPermission("third_parties:assign_to_task")}
              filterAssigneesByProjectMembers
              onSubmit={async (payload) => {
                try {
                  const created = await tasksService.create(
                    payload as Parameters<typeof tasksService.create>[0],
                  );
                  toast.success(t("messages.createSuccess"));
                  setShowCreateModal(false);
                  await fetchData();
                  return created;
                } catch (err) {
                  const axiosError = err as {
                    response?: { data?: { message?: string } };
                  };
                  toast.error(
                    axiosError.response?.data?.message ||
                      t("messages.createError"),
                  );
                  throw err;
                }
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </MainLayout>
  );
}
