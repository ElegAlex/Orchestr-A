"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { MainLayout } from "@/components/MainLayout";
import { PlanningView } from "@/components/planning/PlanningView";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/usePermissions";
import { projectsService } from "@/services/projects.service";
import { tasksService } from "@/services/tasks.service";
import {
  personalTodosService,
  PersonalTodo,
} from "@/services/personal-todos.service";
import { Project, Task, TaskStatus, ProjectStatus, Priority } from "@/types";
import { ProjectIcon } from "@/components/ProjectIcon";
import { PresenceDialog } from "@/components/PresenceDialog";
import { MyTasksSection } from "@/components/dashboard/MyTasksSection";
import { TimeEntryModal } from "@/components/time-tracking/TimeEntryModal";
import toast from "react-hot-toast";

const MAX_TODOS = 20;

export default function DashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [doneUndeclaredTasks, setDoneUndeclaredTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    tasksInProgress: 0,
    tasksDone: 0,
    tasksOverdue: 0,
  });

  const isTaskOverdue = (task: Task) =>
    !!task.endDate &&
    new Date(task.endDate) < new Date() &&
    task.status !== "DONE";

  // Personal To-Do state
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [newTodoText, setNewTodoText] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState("");

  // V5 — modal "Saisir du temps" partagée déclenchée depuis les cartes de tâches.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{
    taskId?: string;
    projectId?: string | null;
  }>({});

  // Helper functions for project badges
  const getStatusBadgeColor = (status: ProjectStatus) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityBadgeColor = (priority: Priority) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-red-100 text-red-800";
      case "HIGH":
        return "bg-orange-100 text-orange-800";
      case "NORMAL":
        return "bg-blue-100 text-blue-800";
      case "LOW":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Fonction pour changer le statut d'une tâche
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success(t("tasks.success.statusUpdated"));

      // Refresh les tâches
      if (user?.id) {
        const tasks = await tasksService.getByAssignee(user.id);

        const filteredTasks = Array.isArray(tasks)
          ? tasks
              .filter((task) => task.status !== "DONE")
              .sort((a, b) => {
                if (!a.endDate) return 1;
                if (!b.endDate) return -1;
                return (
                  new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
                );
              })
          : [];

        setMyTasks(filteredTasks);

        // Update stats
        setStats((prev) => ({
          ...prev,
          tasksInProgress: tasks.filter((t: Task) => t.status === "IN_PROGRESS")
            .length,
          tasksDone: tasks.filter((t: Task) => t.status === "DONE").length,
          tasksOverdue: tasks.filter(isTaskOverdue).length,
        }));
      }
    } catch (err) {
      toast.error(t("tasks.errors.statusUpdate"));
      console.error(err);
    }
  };

  // V5 callbacks pour MyTasksSection / TimeEntryModal
  const handleOpenTimeEntryModal = (
    taskId: string,
    projectId: string | null,
  ) => {
    setModalPrefill({ taskId, projectId });
    setModalOpen(true);
  };

  const handleQuickEntrySuccess = (taskId: string, hours: number) => {
    // Optimistic update — pas de refetch global.
    setMyTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              totalLoggedHours: (task.totalLoggedHours ?? 0) + hours,
            }
          : task,
      ),
    );
    // Si la tâche vivait dans la liste "non déclarées", elle en sort : toute
    // TimeEntry user casse le filtre `NOT: { timeEntries: { some: { userId } } }`.
    setDoneUndeclaredTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const handleDismissalSuccess = (taskId: string) => {
    setDoneUndeclaredTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  // Fonction pour fetch les todos
  const fetchTodos = async () => {
    try {
      setLoadingTodos(true);
      const data = await personalTodosService.getAll();
      setTodos(data);
    } catch (err) {
      console.error("Error fetching todos:", err);
    } finally {
      setLoadingTodos(false);
    }
  };

  // Fonctions pour gérer les todos
  const handleAddTodo = async () => {
    if (!newTodoText.trim() || todos.length >= MAX_TODOS) return;
    try {
      setAddingTodo(true);
      const newTodo = await personalTodosService.create({
        text: newTodoText.trim(),
      });
      setTodos([newTodo, ...todos]);
      setNewTodoText("");
      toast.success(t("todos.success.added"));
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t("todos.errors.add"));
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo: PersonalTodo) => {
    try {
      const updated = await personalTodosService.update(todo.id, {
        completed: !todo.completed,
      });
      setTodos(todos.map((t) => (t.id === todo.id ? updated : t)));
    } catch {
      toast.error(t("todos.errors.update"));
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await personalTodosService.delete(id);
      setTodos(todos.filter((t) => t.id !== id));
      toast.success(t("todos.success.deleted"));
    } catch {
      toast.error(t("todos.errors.delete"));
    }
  };

  const handleStartEditTodo = (todo: PersonalTodo) => {
    setEditingTodoId(todo.id);
    setEditTodoText(todo.text);
  };

  const handleSaveEditTodo = async (id: string) => {
    if (!editTodoText.trim()) {
      setEditingTodoId(null);
      return;
    }
    try {
      const updated = await personalTodosService.update(id, {
        text: editTodoText.trim(),
      });
      setTodos(todos.map((t) => (t.id === id ? updated : t)));
      setEditingTodoId(null);
      toast.success(t("todos.success.updated"));
    } catch {
      toast.error(t("todos.errors.update"));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch user's projects (requires projects:read)
        if (user?.id) {
          let projects: Project[] = [];
          let tasks: Task[] = [];

          if (hasPermission("projects:read")) {
            try {
              projects = await projectsService.getByUser(user.id);
              setMyProjects(Array.isArray(projects) ? projects : []);
            } catch (err) {
              setMyProjects([]);
              const axiosError = err as { response?: { status?: number } };
              if (axiosError.response?.status !== 404) {
                console.error("Error fetching projects:", err);
              }
            }
          } else {
            setMyProjects([]);
          }

          // Fetch user's tasks
          try {
            tasks = await tasksService.getByAssignee(user.id);

            const filteredTasks = Array.isArray(tasks)
              ? tasks
                  .filter((task) => task.status !== "DONE")
                  .sort((a, b) => {
                    if (!a.endDate) return 1;
                    if (!b.endDate) return -1;
                    return (
                      new Date(a.endDate).getTime() -
                      new Date(b.endDate).getTime()
                    );
                  })
              : [];

            setMyTasks(filteredTasks);
          } catch (err) {
            // Si 404 ou autre erreur, on met un tableau vide
            setMyTasks([]);
            const axiosError = err as { response?: { status?: number } };
            if (axiosError.response?.status !== 404) {
              console.error("Error fetching tasks:", err);
            }
          }

          // Fetch DONE tasks awaiting declaration (D8 — gated by time_tracking:create).
          // Isolated try/catch so a 403/404 never tanks the whole dashboard.
          if (hasPermission("time_tracking:create")) {
            try {
              const undeclared = await tasksService.getMyDoneUndeclared();
              setDoneUndeclaredTasks(
                Array.isArray(undeclared) ? undeclared : [],
              );
            } catch (err) {
              setDoneUndeclaredTasks([]);
              const axiosError = err as { response?: { status?: number } };
              if (
                axiosError.response?.status !== 404 &&
                axiosError.response?.status !== 403
              ) {
                console.error("Error fetching undeclared tasks:", err);
              }
            }
          } else {
            setDoneUndeclaredTasks([]);
          }

          // Calculate stats
          setStats({
            totalProjects: projects.length,
            activeProjects: projects.filter((p) => p.status === "ACTIVE")
              .length,
            totalTasks: tasks.length,
            tasksInProgress: tasks.filter((t) => t.status === "IN_PROGRESS")
              .length,
            tasksDone: tasks.filter((t) => t.status === "DONE").length,
            tasksOverdue: tasks.filter(isTaskOverdue).length,
          });
        }
      } catch (err) {
        toast.error(t("errors.loadData"));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchTodos();
  }, [user]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-[var(--muted-foreground)]">
              {t("loading")}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t("welcome", { name: user?.firstName || "" })}
            </h1>
            <p className="text-[var(--muted-foreground)] mt-1">
              {t("activityOverview")}
            </p>
          </div>
          <PresenceDialog />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KPI Cards */}
          <Link
            href={`/${locale}/projects?status=ACTIVE&member=me`}
            className="block bg-[var(--card)] p-6 rounded-lg shadow-sm border border-[var(--border)] hover:shadow-md hover:border-[var(--primary)] transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--muted-foreground)]">
                  {t("stats.activeProjects")}
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] mt-2">
                  {stats.activeProjects}
                </p>
              </div>
              <div className="text-4xl">📁</div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {t("stats.onProjects", { total: stats.totalProjects })}
            </p>
          </Link>

          <Link
            href={`/${locale}/tasks?status=IN_PROGRESS&assignee=me`}
            className="block bg-[var(--card)] p-6 rounded-lg shadow-sm border border-[var(--border)] hover:shadow-md hover:border-[var(--primary)] transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--muted-foreground)]">
                  {t("stats.tasksInProgress")}
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] mt-2">
                  {stats.tasksInProgress}
                </p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {t("stats.onTasks", { total: stats.totalTasks })}
            </p>
          </Link>

          <Link
            href={`/${locale}/tasks?status=DONE&assignee=me`}
            className="block bg-[var(--card)] p-6 rounded-lg shadow-sm border border-[var(--border)] hover:shadow-md hover:border-[var(--primary)] transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--muted-foreground)]">
                  {t("stats.tasksCompleted")}
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] mt-2">
                  {stats.tasksDone}
                </p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {t("stats.percentCompleted", {
                percent:
                  stats.totalTasks > 0
                    ? Math.round((stats.tasksDone / stats.totalTasks) * 100)
                    : 0,
              })}
            </p>
          </Link>

          <Link
            href={`/${locale}/tasks?overdue=true&assignee=me`}
            className="block bg-[var(--card)] p-6 rounded-lg shadow-sm border border-[var(--border)] hover:shadow-md hover:border-[var(--primary)] transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--muted-foreground)]">
                  {t("stats.tasksOverdue")}
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] mt-2">
                  {stats.tasksOverdue}
                </p>
              </div>
              <div className="text-4xl">⏰</div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {t("stats.overdueDeadline")}
            </p>
          </Link>
        </div>

        {/* Personal Planning - Composant réutilisable */}
        {user && (
          <PlanningView
            filterUserId={user.id}
            title={t("planning.title")}
            showFilters={false}
            showGroupHeaders={false}
          />
        )}

        {/* Personal To-Do List */}
        <div className="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              📝 {t("todos.title")}
            </h2>
          </div>
          <div className="p-6">
            {/* Input Add */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                placeholder={t("todos.placeholder")}
                disabled={addingTodo || todos.length >= MAX_TODOS}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleAddTodo}
                disabled={
                  addingTodo || !newTodoText.trim() || todos.length >= MAX_TODOS
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
              >
                {addingTodo ? t("todos.addingButton") : t("todos.addButton")}
              </button>
            </div>

            {todos.length >= MAX_TODOS && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                {t("todos.limitReached", { max: MAX_TODOS })}
              </div>
            )}

            {loadingTodos ? (
              <p className="text-[var(--muted-foreground)] text-center py-8">
                {t("loading")}
              </p>
            ) : todos.length === 0 ? (
              <p className="text-[var(--muted-foreground)] text-center py-8">
                {t("todos.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {todos
                  .filter((t) => !t.completed)
                  .map((todo) => (
                    <div
                      key={todo.id}
                      className="p-4 bg-[var(--muted)] rounded-lg hover:bg-[var(--accent)] transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => handleToggleTodo(todo)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          {editingTodoId === todo.id ? (
                            <input
                              type="text"
                              value={editTodoText}
                              onChange={(e) => setEditTodoText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSaveEditTodo(todo.id);
                                if (e.key === "Escape") setEditingTodoId(null);
                              }}
                              onBlur={() => handleSaveEditTodo(todo.id)}
                              className="flex-1 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="flex-1 text-[var(--foreground)] cursor-pointer"
                              onDoubleClick={() => handleStartEditTodo(todo)}
                              title={t("todos.editHint")}
                            >
                              {todo.text}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTodo(todo.id)}
                          className="ml-4 text-red-600 hover:text-red-800 transition"
                          title={t("todos.deleteHint")}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                {todos.filter((t) => t.completed).length > 0 && (
                  <>
                    <div className="pt-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                      {t("todos.completedSection", {
                        count: todos.filter((t) => t.completed).length,
                      })}
                    </div>
                    {todos
                      .filter((t) => t.completed)
                      .map((todo) => (
                        <div
                          key={todo.id}
                          className="p-4 bg-[var(--muted)] rounded-lg hover:bg-[var(--accent)] transition opacity-60"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleToggleTodo(todo)}
                                className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                              />
                              <span className="flex-1 text-[var(--muted-foreground)] line-through">
                                {todo.text}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteTodo(todo.id)}
                              className="ml-4 text-red-600 hover:text-red-800 transition"
                              title={t("todos.deleteHint")}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* "Mes tâches" segment (V5) — à venir + non déclarées. */}
        <MyTasksSection
          upcomingTasks={myTasks.slice(0, 5)}
          doneUndeclaredTasks={doneUndeclaredTasks}
          onOpenModal={handleOpenTimeEntryModal}
          onQuickEntrySuccess={handleQuickEntrySuccess}
          onDismissalSuccess={handleDismissalSuccess}
          onStatusChange={handleStatusChange}
        />

        {/* My projects */}
        <div className="bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {t("projects.title")}
            </h2>
          </div>
          <div className="p-6">
            {myProjects.length === 0 ? (
              <p className="text-[var(--muted-foreground)] text-center py-8">
                {t("projects.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {myProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() =>
                      router.push(`/${locale}/projects/${project.id}`)
                    }
                    className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-3 hover:shadow-md hover:border-blue-500 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getPriorityBadgeColor(project.priority)}`}
                      >
                        {tCommon(`priority.${project.priority}`)}
                      </span>
                      <ProjectIcon icon={project.icon} size={20} />
                      <h3 className="text-base font-semibold text-gray-900 truncate min-w-0 flex-1">
                        {project.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusBadgeColor(project.status)}`}
                      >
                        {tCommon(`projectStatus.${project.status}`)}
                      </span>
                      {(project.startDate || project.endDate) && (
                        <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">
                          {project.startDate &&
                            new Date(project.startDate).toLocaleDateString(
                              "fr-FR",
                            )}
                          {project.startDate && project.endDate && " → "}
                          {project.endDate &&
                            new Date(project.endDate).toLocaleDateString(
                              "fr-FR",
                            )}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0 hidden sm:flex w-24">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (project.progress ?? 0) === 100
                                ? "bg-green-500"
                                : (project.progress ?? 0) >= 50
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                            }`}
                            style={{ width: `${project.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium w-8 text-right">
                          {project.progress ?? 0}%
                        </span>
                      </div>
                      {project.budgetHours && (
                        <span className="text-xs text-gray-500 shrink-0 hidden md:inline">
                          ⏱️ {project.budgetHours}h
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {project.description ||
                        tCommon("common.noDescription", {
                          defaultValue: "Aucune description",
                        })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* V5 — modal partagée "Saisir du temps" (D3). */}
      <TimeEntryModal
        open={modalOpen}
        mode="create"
        prefill={modalPrefill}
        onClose={() => setModalOpen(false)}
        onSuccess={(entry) => {
          // Quand l'entrée concerne une tâche de la liste upcoming,
          // on incrémente localement son cumul (pas de refetch global).
          if (entry.taskId) {
            setMyTasks((prev) =>
              prev.map((task) =>
                task.id === entry.taskId
                  ? {
                      ...task,
                      totalLoggedHours:
                        (task.totalLoggedHours ?? 0) + entry.hours,
                    }
                  : task,
              ),
            );
          }
        }}
      />
    </MainLayout>
  );
}
