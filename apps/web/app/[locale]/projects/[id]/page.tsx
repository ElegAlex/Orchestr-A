"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
import { MilestoneRoadmap } from "@/components/MilestoneRoadmap";
import { MilestoneModal } from "@/components/MilestoneModal";
import { TaskModal } from "@/components/TaskModal";
import { projectsService } from "@/services/projects.service";
import { tasksService, TasksValidationPreview } from "@/services/tasks.service";
import {
  milestonesService,
  MilestonesValidationPreview,
} from "@/services/milestones.service";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import { ProjectEditModal } from "@/components/ProjectEditModal";
import { usersService } from "@/services/users.service";
import { useAuthStore } from "@/stores/auth.store";
import {
  Project,
  ProjectStats,
  Task,
  ProjectStatus,
  Priority,
  TaskStatus,
  Milestone,
  User,
  Role,
  UpdateProjectDto,
} from "@/types";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import { parseCSV } from "@/lib/csv-parser";
import { TaskListView } from "@/components/tasks/TaskListView";
import api from "@/lib/api";

const GanttChart = dynamic(() => import("@/components/GanttChart"), {
  ssr: false,
});

type TabType = "overview" | "tasks" | "team" | "milestones" | "gantt";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("projects");
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberAllocation, setMemberAllocation] = useState(100);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(
    null,
  );
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showImportTasksModal, setShowImportTasksModal] = useState(false);
  const [showImportMilestonesModal, setShowImportMilestonesModal] =
    useState(false);
  const [importingTasks, setImportingTasks] = useState(false);
  const [importingMilestones, setImportingMilestones] = useState(false);
  // Pre-validation states
  const [tasksPreview, setTasksPreview] =
    useState<TasksValidationPreview | null>(null);
  const [milestonesPreview, setMilestonesPreview] =
    useState<MilestonesValidationPreview | null>(null);
  const [showTasksPreview, setShowTasksPreview] = useState(false);
  const [showMilestonesPreview, setShowMilestonesPreview] = useState(false);
  const [pendingTasksImport, setPendingTasksImport] = useState<
    Array<{
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      assigneeEmail?: string;
      milestoneName?: string;
      estimatedHours?: number;
      startDate?: string;
      endDate?: string;
    }>
  >([]);
  const [pendingMilestonesImport, setPendingMilestonesImport] = useState<
    Array<{
      name: string;
      description?: string;
      dueDate: string;
    }>
  >([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskViewMode, setTaskViewMode] = useState<"kanban" | "list">("kanban");

  // Get current user from auth store
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch project details
        const projectData = await projectsService.getById(projectId);
        setProject(projectData);

        // Fetch project stats
        try {
          const statsData = await projectsService.getStats(projectId);
          setStats(statsData);
        } catch (err) {
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            throw err;
          }
        }

        // Fetch project tasks
        try {
          const tasksData = await tasksService.getByProject(projectId);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
        } catch (err) {
          setTasks([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            console.error("Error fetching tasks:", err);
          }
        }

        // Fetch milestones
        try {
          const milestonesData = await milestonesService.getAll();
          const projectMilestones = milestonesData.data.filter(
            (m: Milestone) => m.projectId === projectId,
          );
          setMilestones(projectMilestones);
        } catch (err) {
          setMilestones([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            console.error("Error fetching milestones:", err);
          }
        }
      } catch (err) {
        toast.error(t("messages.loadDetailError"));
        console.error(err);
        router.push(`/${locale}/projects`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, router]);

  const getStatusBadgeColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DRAFT:
        return "bg-gray-200 text-gray-800";
      case ProjectStatus.ACTIVE:
        return "bg-green-100 text-green-800";
      case ProjectStatus.SUSPENDED:
        return "bg-yellow-100 text-yellow-800";
      case ProjectStatus.COMPLETED:
        return "bg-blue-100 text-blue-800";
      case ProjectStatus.CANCELLED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: ProjectStatus) => {
    return t(`status.${status}`, { defaultValue: status });
  };

  const getPriorityBadgeColor = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return "bg-red-100 text-red-800";
      case Priority.HIGH:
        return "bg-orange-100 text-orange-800";
      case Priority.NORMAL:
        return "bg-blue-100 text-blue-800";
      case Priority.LOW:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    return t(`priority.${priority}`, { defaultValue: priority });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTask(null);
    setDragOverColumn(null);
    setIsDragging(false);
    (e.currentTarget as HTMLElement).style.opacity = "1";
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== newStatus) {
      try {
        await tasksService.update(draggedTask.id, { status: newStatus });
        toast.success(t("messages.statusUpdateSuccess"));
        // Refresh tasks
        const tasksData = await tasksService.getByProject(projectId);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch {
        toast.error(t("messages.statusUpdateError"));
      }
    }

    setDraggedTask(null);
    setIsDragging(false);
  };

  const handleTaskClick = (task: Task) => {
    if (!isDragging) {
      router.push(`/${locale}/tasks/${task.id}`);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (!taskSearchQuery) return true;
    const query = taskSearchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    );
  });

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter((t) => t.status === status);
  };

  const handleTaskStatusChange = async (
    taskId: string,
    newStatus: TaskStatus,
  ) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success(t("messages.statusUpdateSuccess"));
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch {
      toast.error(t("messages.statusUpdateError"));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksService.delete(taskId);
      toast.success("Tâche supprimée");
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la suppression",
      );
    }
  };

  const handleTaskDateChange = async (
    taskId: string,
    field: "startDate" | "endDate",
    value: string,
  ) => {
    try {
      await tasksService.update(taskId, {
        [field]: new Date(value).toISOString(),
      });
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleExportTasksCsv = async () => {
    try {
      const response = await api.get(`/tasks/project/${projectId}/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers["content-disposition"];
      const filename = disposition
        ? disposition.split("filename=")[1]?.replace(/"/g, "")
        : "tasks.csv";
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const handleExportMilestonesCsv = async () => {
    try {
      const response = await api.get(
        `/milestones/project/${projectId}/export`,
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const disposition = response.headers["content-disposition"];
      const filename = disposition
        ? disposition.split("filename=")[1]?.replace(/"/g, "")
        : "milestones.csv";
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const handleExportGanttPdf = async () => {
    const container = document.getElementById("gantt-container");
    if (!container) {
      toast.error("Gantt chart not found");
      return;
    }
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(container, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const width = imgWidth * ratio;
      const height = imgHeight * ratio;
      const x = (pdfWidth - width) / 2;
      const y = (pdfHeight - height) / 2;
      pdf.addImage(imgData, "PNG", x, y, width, height);
      const sanitizedName =
        project?.name?.replace(/[^a-zA-Z0-9-_]/g, "_") || "project";
      pdf.save(`gantt-${sanitizedName}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Erreur lors de l'export PDF");
    }
  };

  // Add member functions
  const handleOpenAddMemberModal = async () => {
    try {
      const usersResponse = await usersService.getAll();
      // Handle both array and paginated response
      const users = Array.isArray(usersResponse)
        ? usersResponse
        : (usersResponse as { data?: User[] }).data || [];
      // Filter out users already in the project
      const existingMemberIds = project?.members?.map((m) => m.userId) || [];
      const available = users.filter(
        (u: User) => !existingMemberIds.includes(u.id),
      );
      setAvailableUsers(available);
      setShowAddMemberModal(true);
    } catch {
      toast.error(t("messages.loadUsersError"));
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error(t("messages.selectUserRequired"));
      return;
    }

    try {
      await projectsService.addMember(projectId, {
        userId: selectedUserId,
        role: memberRole,
        allocation: memberAllocation,
      });
      toast.success(t("messages.memberAddSuccess"));
      setShowAddMemberModal(false);
      setSelectedUserId("");
      setMemberRole("");
      setMemberAllocation(100);
      // Refresh project data
      const projectData = await projectsService.getById(projectId);
      setProject(projectData);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.addMemberError"),
      );
    }
  };

  // Milestone handlers
  const handleCreateMilestone = () => {
    setEditingMilestone(null);
    setShowMilestoneModal(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setShowMilestoneModal(true);
  };

  const handleSaveMilestone = async (data: Partial<Milestone>) => {
    try {
      if (editingMilestone) {
        await milestonesService.update(editingMilestone.id, data);
        toast.success(t("messages.milestoneUpdateSuccess"));
      } else {
        // Ensure required fields are present for creation
        if (!data.name || !data.projectId) {
          toast.error(t("messages.requiredFieldsMissing"));
          return;
        }
        await milestonesService.create({
          name: data.name,
          description: data.description,
          dueDate: data.dueDate || new Date().toISOString(),
          projectId: data.projectId,
        });
        toast.success(t("messages.milestoneCreateSuccess"));
      }

      // Refresh milestones
      const milestonesData = await milestonesService.getAll();
      const projectMilestones = milestonesData.data.filter(
        (m: Milestone) => m.projectId === projectId,
      );
      setMilestones(projectMilestones);
      setShowMilestoneModal(false);
      setEditingMilestone(null);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.savingError"),
      );
      throw err;
    }
  };

  const handleCreateTask = async () => {
    setEditingTask(null);
    // Load all users when opening the task modal
    try {
      const usersResponse = await usersService.getAll();
      const users = Array.isArray(usersResponse)
        ? usersResponse
        : (usersResponse as { data?: User[] }).data || [];
      setAllUsers(users);
    } catch (err) {
      console.error("Error loading users:", err);
      setAllUsers([]);
    }
    setShowTaskModal(true);
  };

  const handleSaveTask = async (data: Record<string, unknown>) => {
    try {
      if (editingTask) {
        await tasksService.update(editingTask.id, data);
        toast.success(tTasks("messages.updateSuccess"));
      } else {
        await tasksService.create(
          data as { title: string; [key: string]: unknown },
        );
        toast.success(tTasks("messages.createSuccess"));
      }

      // Refresh tasks
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);

      setShowTaskModal(false);
      setEditingTask(null);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || tTasks("messages.saveError"),
      );
    }
  };

  const handleTaskUpdate = async () => {
    try {
      // Refresh tasks
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      console.error("Error refreshing tasks:", err);
    }
  };

  const handleImportTasksFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingTasks(true);
    try {
      const content = await file.text();
      const rows = parseCSV(content);

      // Filter out comment lines (starting with #)
      const filteredRows = rows.filter((row) => {
        const firstValue = Object.values(row)[0];
        return firstValue && !firstValue.toString().startsWith("#");
      });

      if (filteredRows.length === 0) {
        toast.error(t("messages.csvEmptyOrInvalid"));
        setImportingTasks(false);
        e.target.value = "";
        return;
      }

      const tasksToImport = filteredRows.map((row) => ({
        title: row.title || "",
        description: row.description || undefined,
        status: row.status || undefined,
        priority: row.priority || undefined,
        assigneeEmail: row.assigneeEmail || undefined,
        milestoneName: row.milestoneName || undefined,
        estimatedHours: row.estimatedHours
          ? parseFloat(row.estimatedHours)
          : undefined,
        startDate: row.startDate || undefined,
        endDate: row.endDate || undefined,
      }));

      // Validate first (dry-run)
      const preview = await tasksService.validateImport(
        projectId,
        tasksToImport,
      );
      setTasksPreview(preview);
      setPendingTasksImport(tasksToImport);
      setShowImportTasksModal(false);
      setShowTasksPreview(true);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.validationError"),
      );
      console.error("Validation error:", err);
    } finally {
      setImportingTasks(false);
      e.target.value = "";
    }
  };

  const handleConfirmTasksImport = async () => {
    setImportingTasks(true);
    try {
      const result = await tasksService.importTasks(
        projectId,
        pendingTasksImport,
      );

      if (result.created > 0) {
        toast.success(
          tTasks("messages.importSuccess", { count: result.created }),
        );
      }
      if (result.skipped > 0) {
        toast(tTasks("messages.importSkipped", { count: result.skipped }));
      }
      if (result.errors > 0) {
        toast.error(tTasks("messages.importErrors", { count: result.errors }));
        console.error("Import errors:", result.errorDetails);
      }

      // Refresh tasks
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);

      setShowTasksPreview(false);
      setTasksPreview(null);
      setPendingTasksImport([]);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.importError"),
      );
      console.error("Import error:", err);
    } finally {
      setImportingTasks(false);
    }
  };

  const handleImportMilestonesFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingMilestones(true);
    try {
      const content = await file.text();
      const rows = parseCSV(content);

      // Filter out comment lines (starting with #)
      const filteredRows = rows.filter((row) => {
        const firstValue = Object.values(row)[0];
        return firstValue && !firstValue.toString().startsWith("#");
      });

      if (filteredRows.length === 0) {
        toast.error(t("messages.csvEmptyOrInvalid"));
        setImportingMilestones(false);
        e.target.value = "";
        return;
      }

      const milestonesToImport = filteredRows.map((row) => ({
        name: row.name || "",
        description: row.description || undefined,
        dueDate: row.dueDate || "",
      }));

      // Validate first (dry-run)
      const preview = await milestonesService.validateImport(
        projectId,
        milestonesToImport,
      );
      setMilestonesPreview(preview);
      setPendingMilestonesImport(milestonesToImport);
      setShowImportMilestonesModal(false);
      setShowMilestonesPreview(true);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.validationError"),
      );
      console.error("Validation error:", err);
    } finally {
      setImportingMilestones(false);
      e.target.value = "";
    }
  };

  const handleConfirmMilestonesImport = async () => {
    setImportingMilestones(true);
    try {
      const result = await milestonesService.importMilestones(
        projectId,
        pendingMilestonesImport,
      );

      if (result.created > 0) {
        toast.success(
          t("messages.milestonesImportSuccess", { count: result.created }),
        );
      }
      if (result.skipped > 0) {
        toast(t("messages.milestonesImportSkipped", { count: result.skipped }));
      }
      if (result.errors > 0) {
        toast.error(
          t("messages.milestonesImportErrors", { count: result.errors }),
        );
        console.error("Import errors:", result.errorDetails);
      }

      // Refresh milestones
      const milestonesData = await milestonesService.getAll();
      const projectMilestones = milestonesData.data.filter(
        (m: Milestone) => m.projectId === projectId,
      );
      setMilestones(projectMilestones);

      setShowMilestonesPreview(false);
      setMilestonesPreview(null);
      setPendingMilestonesImport([]);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.importError"),
      );
      console.error("Import error:", err);
    } finally {
      setImportingMilestones(false);
    }
  };

  const downloadTasksTemplate = async () => {
    try {
      const template = await tasksService.getImportTemplate(projectId);
      const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template_taches.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("messages.templateDownloadError"));
    }
  };

  const downloadMilestonesTemplate = async () => {
    try {
      const template = await milestonesService.getImportTemplate(projectId);
      const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template_jalons.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("messages.templateDownloadError"));
    }
  };

  // Permission helpers
  const canEditProject =
    currentUser &&
    [Role.ADMIN, Role.RESPONSABLE, Role.MANAGER].includes(currentUser.role);

  const canDeleteProject =
    currentUser && [Role.ADMIN, Role.RESPONSABLE].includes(currentUser.role);

  // Project update handler
  const handleUpdateProject = async (data: UpdateProjectDto) => {
    await projectsService.update(projectId, data);
    toast.success(t("messages.updateSuccess"));
    // Refresh project data
    const projectData = await projectsService.getById(projectId);
    setProject(projectData);
  };

  // Project hard delete handler (permanent deletion)
  const handleHardDeleteProject = async () => {
    setDeleting(true);
    try {
      await projectsService.hardDelete(projectId);
      toast.success(t("messages.deleteSuccess"));
      router.push(`/${locale}/projects`);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.deleteError"),
      );
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading || !project) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{tCommon("loading")}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push(`/${locale}/projects`)}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center space-x-1"
          >
            <span>←</span>
            <span>{t("detail.backToProjects")}</span>
          </button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {project.name}
              </h1>
              <p className="text-gray-600 mt-2">{project.description}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeColor(
                  project.status,
                )}`}
              >
                {getStatusLabel(project.status)}
              </span>
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${getPriorityBadgeColor(
                  project.priority,
                )}`}
              >
                {getPriorityLabel(project.priority)}
              </span>
              {/* Action buttons based on user role */}
              {canEditProject && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
                  title={t("detail.editProject")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span>{t("detail.edit")}</span>
                </button>
              )}
              {canDeleteProject && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2"
                  title={t("detail.deleteProject")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{t("detail.delete")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("detail.tabs.overview")}
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`${
                activeTab === "tasks"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("detail.tabs.tasks", { count: tasks.length })}
            </button>
            <button
              onClick={() => setActiveTab("milestones")}
              className={`${
                activeTab === "milestones"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("detail.tabs.milestones", { count: milestones.length })}
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`${
                activeTab === "team"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("detail.tabs.team", { count: project.members?.length || 0 })}
            </button>
            <button
              onClick={() => setActiveTab("gantt")}
              className={`${
                activeTab === "gantt"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("detail.tabs.gantt")}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.stats.progress")}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {Math.round(stats.progress)}%
                      </p>
                    </div>
                    <div className="text-4xl">📈</div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${stats.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.stats.tasks")}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.completedTasks}/{stats.totalTasks}
                      </p>
                    </div>
                    <div className="text-4xl">✓</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t("detail.stats.tasksDetails", {
                      inProgress: stats.inProgressTasks,
                      blocked: stats.blockedTasks,
                    })}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.stats.budget")}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.loggedHours}h
                      </p>
                    </div>
                    <div className="text-4xl">⏱️</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t("detail.stats.budgetDetails", {
                      total: stats.totalHours,
                      remaining: stats.remainingHours,
                    })}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.stats.team")}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.membersCount}
                      </p>
                    </div>
                    <div className="text-4xl">👥</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t("detail.stats.teamDetails", {
                      epics: stats.epicsCount,
                      milestones: stats.milestonesCount,
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Project Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("detail.projectInfo.title")}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  {project.startDate && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.projectInfo.startDate")}
                      </p>
                      <p className="text-lg text-gray-900 mt-1">
                        {new Date(project.startDate).toLocaleDateString(
                          "fr-FR",
                        )}
                      </p>
                    </div>
                  )}
                  {project.endDate && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.projectInfo.endDate")}
                      </p>
                      <p className="text-lg text-gray-900 mt-1">
                        {new Date(project.endDate).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  )}
                  {project.budgetHours && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {t("detail.projectInfo.budgetHours")}
                      </p>
                      <p className="text-lg text-gray-900 mt-1">
                        {project.budgetHours}h
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("detail.projectInfo.createdAt")}
                    </p>
                    <p className="text-lg text-gray-900 mt-1">
                      {new Date(project.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t("detail.projectInfo.createdBy")}
                    </p>
                    <p className="text-lg text-gray-900 mt-1">
                      {(
                        project as Project & {
                          createdBy?: { firstName: string; lastName: string };
                        }
                      ).createdBy
                        ? `${(project as Project & { createdBy?: { firstName: string; lastName: string } }).createdBy!.firstName} ${(project as Project & { createdBy?: { firstName: string; lastName: string } }).createdBy!.lastName}`
                        : t("detail.projectInfo.notSpecified")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {t("detail.tasksBoard.title")}
              </h2>
              <div className="flex items-center space-x-2">
                {/* Export CSV */}
                <button
                  onClick={handleExportTasksCsv}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                >
                  Export CSV
                </button>
                {/* Import CSV */}
                <button
                  onClick={() => setShowImportTasksModal(true)}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
                >
                  {t("detail.tasksBoard.importCSV")}
                </button>
                {/* View toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setTaskViewMode("kanban")}
                    className={`px-3 py-1.5 rounded text-sm transition ${
                      taskViewMode === "kanban"
                        ? "bg-white shadow-sm font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Kanban
                  </button>
                  <button
                    onClick={() => setTaskViewMode("list")}
                    className={`px-3 py-1.5 rounded text-sm transition ${
                      taskViewMode === "list"
                        ? "bg-white shadow-sm font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Liste
                  </button>
                </div>
                <button
                  onClick={handleCreateTask}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {t("detail.tasksBoard.newTask")}
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder={t("detail.tasksBoard.searchPlaceholder", {
                  defaultValue: "Rechercher une tâche...",
                })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Kanban or List view */}
            {taskViewMode === "list" ? (
              <TaskListView
                tasks={filteredTasks}
                onStatusChange={handleTaskStatusChange}
                onTaskClick={handleTaskClick}
                onDelete={handleDeleteTask}
                onDateChange={handleTaskDateChange}
              />
            ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex space-x-4 min-w-max">
                {[
                  {
                    status: TaskStatus.TODO,
                    title: tTasks("status.TODO"),
                    color: "bg-gray-100",
                  },
                  {
                    status: TaskStatus.IN_PROGRESS,
                    title: tTasks("status.IN_PROGRESS"),
                    color: "bg-blue-100",
                  },
                  {
                    status: TaskStatus.IN_REVIEW,
                    title: tTasks("status.IN_REVIEW"),
                    color: "bg-yellow-100",
                  },
                  {
                    status: TaskStatus.DONE,
                    title: tTasks("status.DONE"),
                    color: "bg-green-100",
                  },
                  {
                    status: TaskStatus.BLOCKED,
                    title: tTasks("status.BLOCKED"),
                    color: "bg-red-100",
                  },
                ].map((column) => {
                  const columnTasks = getTasksByStatus(column.status);
                  const isDropTarget = dragOverColumn === column.status;

                  return (
                    <div
                      key={column.status}
                      className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200"
                    >
                      {/* Column Header */}
                      <div
                        className={`${column.color} px-4 py-3 rounded-t-lg border-b border-gray-200`}
                      >
                        <h3 className="font-semibold text-gray-900 flex items-center justify-between">
                          <span>{column.title}</span>
                          <span className="bg-white text-gray-700 px-2 py-1 rounded-full text-xs">
                            {columnTasks.length}
                          </span>
                        </h3>
                      </div>

                      {/* Tasks - Drop Zone */}
                      <div
                        className={`p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto transition-colors ${
                          isDropTarget
                            ? "bg-blue-50 border-2 border-dashed border-blue-400"
                            : ""
                        }`}
                        onDragOver={(e) => handleDragOver(e, column.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, column.status)}
                      >
                        {columnTasks.length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-8">
                            {tTasks("kanban.noTasks")}
                          </p>
                        ) : (
                          columnTasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleTaskClick(task)}
                              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer"
                            >
                              <div className="flex items-start space-x-2">
                                {/* Drag Handle */}
                                <div className="flex flex-col space-y-0.5 mt-1 text-gray-400 cursor-move">
                                  <div className="flex space-x-0.5">
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                  </div>
                                  <div className="flex space-x-0.5">
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                  </div>
                                  <div className="flex space-x-0.5">
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                    <div className="w-1 h-1 bg-current rounded-full"></div>
                                  </div>
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-semibold text-gray-900 text-sm flex-1">
                                      {task.title}
                                    </h4>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeColor(
                                        task.priority,
                                      )}`}
                                    >
                                      {getPriorityLabel(task.priority)}
                                    </span>
                                  </div>

                                  {task.description && (
                                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  {/* Affichage des assignés multiples */}
                                  {task.assignees &&
                                  task.assignees.length > 0 ? (
                                    <div className="flex items-center space-x-1 text-xs text-gray-500 mb-2">
                                      <div className="flex -space-x-1">
                                        {task.assignees
                                          .slice(0, 3)
                                          .map((assignment, idx) => (
                                            <div
                                              key={assignment.userId || idx}
                                              className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] border border-white"
                                              title={`${assignment.user?.firstName || ""} ${assignment.user?.lastName || ""}`}
                                            >
                                              {assignment.user
                                                ?.firstName?.[0] || "?"}
                                              {assignment.user?.lastName?.[0] ||
                                                ""}
                                            </div>
                                          ))}
                                        {task.assignees.length > 3 && (
                                          <div className="w-5 h-5 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px] border border-white">
                                            +{task.assignees.length - 3}
                                          </div>
                                        )}
                                      </div>
                                      <span className="ml-1">
                                        {task.assignees.length === 1
                                          ? `${task.assignees[0].user?.firstName} ${task.assignees[0].user?.lastName}`
                                          : tTasks("kanban.assignees", {
                                              count: task.assignees.length,
                                            })}
                                      </span>
                                    </div>
                                  ) : (
                                    task.assignee && (
                                      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                          {task.assignee.firstName[0]}
                                          {task.assignee.lastName[0]}
                                        </div>
                                        <span>
                                          {task.assignee.firstName}{" "}
                                          {task.assignee.lastName}
                                        </span>
                                      </div>
                                    )
                                  )}

                                  {task.estimatedHours && (
                                    <div className="text-xs text-gray-500">
                                      ⏱️{" "}
                                      {tTasks("kanban.estimatedHours", {
                                        hours: task.estimatedHours,
                                      })}
                                    </div>
                                  )}

                                  {task.progress > 0 && (
                                    <div className="mt-3">
                                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                        <span>{tTasks("kanban.progress")}</span>
                                        <span>{task.progress}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                                          style={{ width: `${task.progress}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === "milestones" && (
          <div className="space-y-4">
            <MilestoneRoadmap
              milestones={milestones}
              tasks={tasks}
              onCreateMilestone={handleCreateMilestone}
              onEditMilestone={handleEditMilestone}
              onTaskUpdate={handleTaskUpdate}
              onImportMilestones={() => setShowImportMilestonesModal(true)}
              onExportCsv={handleExportMilestonesCsv}
            />
          </div>
        )}

        {activeTab === "team" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("detail.team.title")}
              </h2>
              <button
                onClick={handleOpenAddMemberModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {t("detail.team.addMember")}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {!project.members || project.members.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <p className="text-gray-500">{t("detail.team.noMembers")}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {project.members.map((member) => (
                    <div key={member.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                            {member.user?.firstName[0]}
                            {member.user?.lastName[0]}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {member.user?.firstName} {member.user?.lastName}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {member.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            {member.allocation && (
                              <p className="text-sm text-gray-600">
                                {t("detail.team.allocation", {
                                  value: member.allocation,
                                })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  t("detail.team.confirmRemove", {
                                    name: `${member.user?.firstName} ${member.user?.lastName}`,
                                  }),
                                )
                              ) {
                                try {
                                  await projectsService.removeMember(
                                    project.id,
                                    member.userId,
                                  );
                                  toast.success(
                                    t("messages.memberRemoveSuccess"),
                                  );
                                  // Reload project data
                                  const updated = await projectsService.getById(
                                    project.id,
                                  );
                                  setProject(updated);
                                } catch {
                                  toast.error(t("messages.memberRemoveError"));
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title={t("detail.team.removeMember")}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gantt Tab */}
        {activeTab === "gantt" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex-1">
                <p className="text-sm text-blue-800">{t("detail.gantt.tip")}</p>
              </div>
              <button
                onClick={handleExportGanttPdf}
                className="ml-4 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm shrink-0"
              >
                Export PDF
              </button>
            </div>
            <div id="gantt-container">
              <GanttChart
                tasks={tasks}
                milestones={milestones}
                projectStartDate={
                  project.startDate ? new Date(project.startDate) : undefined
                }
                projectEndDate={
                  project.endDate ? new Date(project.endDate) : undefined
                }
                fullTasks={tasks}
                onDependencyChange={handleTaskUpdate}
              />
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t("detail.addMemberModal.title")}
              </h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("detail.addMemberModal.userLabel")}
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="" className="text-gray-500">
                      {t("detail.addMemberModal.selectUser")}
                    </option>
                    {availableUsers.map((user) => (
                      <option
                        key={user.id}
                        value={user.id}
                        className="text-gray-900"
                      >
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("detail.addMemberModal.roleLabel")}
                  </label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="" className="text-gray-500">
                      {t("detail.addMemberModal.selectRole")}
                    </option>
                    <option value="Sponsor" className="text-gray-900">
                      {t("teamRoles.sponsor")}
                    </option>
                    <option value="Chef de projet" className="text-gray-900">
                      {t("teamRoles.projectManager")}
                    </option>
                    <option
                      value="Responsable technique"
                      className="text-gray-900"
                    >
                      {t("teamRoles.technicalLead")}
                    </option>
                    <option value="Architecte" className="text-gray-900">
                      {t("teamRoles.architect")}
                    </option>
                    <option value="Tech Lead" className="text-gray-900">
                      {t("teamRoles.techLead")}
                    </option>
                    <option
                      value="Développeur Senior"
                      className="text-gray-900"
                    >
                      {t("teamRoles.seniorDeveloper")}
                    </option>
                    <option value="Développeur" className="text-gray-900">
                      {t("teamRoles.developer")}
                    </option>
                    <option
                      value="Développeur Junior"
                      className="text-gray-900"
                    >
                      {t("teamRoles.juniorDeveloper")}
                    </option>
                    <option value="DevOps" className="text-gray-900">
                      {t("teamRoles.devops")}
                    </option>
                    <option value="QA Lead" className="text-gray-900">
                      {t("teamRoles.qaLead")}
                    </option>
                    <option value="Testeur" className="text-gray-900">
                      {t("teamRoles.tester")}
                    </option>
                    <option value="UX/UI Designer" className="text-gray-900">
                      {t("teamRoles.uxuiDesigner")}
                    </option>
                    <option value="Product Owner" className="text-gray-900">
                      {t("teamRoles.productOwner")}
                    </option>
                    <option value="Scrum Master" className="text-gray-900">
                      {t("teamRoles.scrumMaster")}
                    </option>
                    <option value="Analyste métier" className="text-gray-900">
                      {t("teamRoles.businessAnalyst")}
                    </option>
                    <option value="Membre" className="text-gray-900">
                      {t("teamRoles.member")}
                    </option>
                    <option value="Observateur" className="text-gray-900">
                      {t("teamRoles.observer")}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("detail.addMemberModal.allocationLabel")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={memberAllocation}
                    onChange={(e) =>
                      setMemberAllocation(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setSelectedUserId("");
                      setMemberRole("");
                      setMemberAllocation(100);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {t("detail.addMemberModal.add")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Milestone Modal */}
        <MilestoneModal
          isOpen={showMilestoneModal}
          onClose={() => {
            setShowMilestoneModal(false);
            setEditingMilestone(null);
          }}
          onSave={handleSaveMilestone}
          milestone={editingMilestone}
          projectId={projectId}
        />

        {/* Task Modal */}
        <TaskModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          task={editingTask}
          projectId={projectId}
          milestones={milestones}
          users={allUsers}
        />

        {/* Import Tasks Modal */}
        {showImportTasksModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t("detail.importTasksModal.title")}
              </h2>
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  {t("detail.importTasksModal.description")}
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    {t("detail.importTasksModal.columnsTitle")}
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {t("detail.importTasksModal.columnsDescription")}
                  </p>
                  <p className="text-blue-600 text-xs mt-2">
                    {t("detail.importTasksModal.requiredField")}
                  </p>
                </div>
                <button
                  onClick={downloadTasksTemplate}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t("detail.importTasksModal.downloadTemplate")}
                </button>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportTasksFile}
                    disabled={importingTasks}
                    className="hidden"
                    id="tasks-csv-input"
                  />
                  <label
                    htmlFor="tasks-csv-input"
                    className={`cursor-pointer ${importingTasks ? "opacity-50" : ""}`}
                  >
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-gray-600">
                      {importingTasks
                        ? t("detail.importTasksModal.importing")
                        : t("detail.importTasksModal.selectFile")}
                    </p>
                  </label>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowImportTasksModal(false)}
                  disabled={importingTasks}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {tCommon("close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Milestones Modal */}
        {showImportMilestonesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t("detail.importMilestonesModal.title")}
              </h2>
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  {t("detail.importMilestonesModal.description")}
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    {t("detail.importMilestonesModal.columnsTitle")}
                  </h3>
                  <p className="text-blue-800 text-sm">
                    {t("detail.importMilestonesModal.columnsDescription")}
                  </p>
                  <p className="text-blue-600 text-xs mt-2">
                    {t("detail.importMilestonesModal.requiredFields")}
                  </p>
                </div>
                <button
                  onClick={downloadMilestonesTemplate}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t("detail.importMilestonesModal.downloadTemplate")}
                </button>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportMilestonesFile}
                    disabled={importingMilestones}
                    className="hidden"
                    id="milestones-csv-input"
                  />
                  <label
                    htmlFor="milestones-csv-input"
                    className={`cursor-pointer ${importingMilestones ? "opacity-50" : ""}`}
                  >
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-gray-600">
                      {importingMilestones
                        ? t("detail.importMilestonesModal.importing")
                        : t("detail.importMilestonesModal.selectFile")}
                    </p>
                  </label>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowImportMilestonesModal(false)}
                  disabled={importingMilestones}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {tCommon("close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Preview Modal */}
        {tasksPreview && (
          <ImportPreviewModal
            isOpen={showTasksPreview}
            onClose={() => {
              setShowTasksPreview(false);
              setTasksPreview(null);
              setPendingTasksImport([]);
            }}
            onConfirm={handleConfirmTasksImport}
            title={t("detail.previewModal.tasksTitle")}
            items={{
              valid: tasksPreview.valid.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.task,
                resolvedFields: {
                  ...(item.resolvedAssignee && {
                    Assignee: item.resolvedAssignee,
                  }),
                  ...(item.resolvedMilestone && {
                    Jalon: item.resolvedMilestone,
                  }),
                },
              })),
              duplicates: tasksPreview.duplicates.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.task,
              })),
              errors: tasksPreview.errors.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.task,
              })),
              warnings: tasksPreview.warnings.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.task,
                resolvedFields: {
                  ...(item.resolvedAssignee && {
                    Assignee: item.resolvedAssignee,
                  }),
                  ...(item.resolvedMilestone && {
                    Jalon: item.resolvedMilestone,
                  }),
                },
              })),
            }}
            summary={tasksPreview.summary}
            columns={[
              { key: "title", label: tTasks("modal.create.titleLabel") },
              { key: "status", label: tTasks("modal.create.statusLabel") },
              { key: "priority", label: tTasks("modal.create.priorityLabel") },
              {
                key: "assigneeEmail",
                label: tTasks("modal.create.assigneesLabel"),
              },
            ]}
            isImporting={importingTasks}
          />
        )}

        {/* Milestones Preview Modal */}
        {milestonesPreview && (
          <ImportPreviewModal
            isOpen={showMilestonesPreview}
            onClose={() => {
              setShowMilestonesPreview(false);
              setMilestonesPreview(null);
              setPendingMilestonesImport([]);
            }}
            onConfirm={handleConfirmMilestonesImport}
            title={t("detail.previewModal.milestonesTitle")}
            items={{
              valid: milestonesPreview.valid.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.milestone,
              })),
              duplicates: milestonesPreview.duplicates.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.milestone,
              })),
              errors: milestonesPreview.errors.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.milestone,
              })),
              warnings: milestonesPreview.warnings.map((item) => ({
                lineNumber: item.lineNumber,
                status: item.status,
                messages: item.messages,
                data: item.milestone,
              })),
            }}
            summary={milestonesPreview.summary}
            columns={[
              { key: "name", label: t("milestoneModal.nameLabel") },
              {
                key: "description",
                label: t("milestoneModal.descriptionLabel"),
              },
              { key: "dueDate", label: t("milestoneModal.dueDateLabel") },
            ]}
            isImporting={importingMilestones}
          />
        )}

        {/* Project Edit Modal */}
        {project && (
          <ProjectEditModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSave={handleUpdateProject}
            project={project}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-red-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t("detail.deleteModal.title")}
                </h2>
              </div>

              <p className="text-gray-600 mb-4">
                {t("detail.deleteModal.confirmMessage", {
                  name: project?.name,
                })}
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  {t("detail.deleteModal.warning")}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleHardDeleteProject}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {deleting && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>{t("detail.deleteModal.confirmButton")}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
