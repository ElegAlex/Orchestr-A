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
import { servicesService } from "@/services/services.service";
import {
  Project,
  ProjectStats,
  ProjectThirdPartyMember,
  Task,
  ProjectStatus,
  Priority,
  TaskStatus,
  Milestone,
  User,
  Service,
  UpdateProjectDto,
} from "@/types";
import { thirdPartiesService } from "@/services/third-parties.service";
import { ThirdPartySelector } from "@/components/third-parties/ThirdPartySelector";
import { clientsService } from "@/services/clients.service";
import { ClientSelector } from "@/components/clients/ClientSelector";
import { ProjectClient } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";
import { parseCSV } from "@/lib/csv-parser";
import TaskKanban from "@/components/tasks/TaskKanban";
import { TaskListView } from "@/components/tasks/TaskListView";
import api from "@/lib/api";
import { ProjectIcon } from "@/components/ProjectIcon";
import { UserAvatar } from "@/components/UserAvatar";

const GanttChart = dynamic(() => import("@/components/GanttChart"), {
  ssr: false,
});

type TabType =
  | "overview"
  | "tasks"
  | "team"
  | "milestones"
  | "gantt"
  | "thirdParties"
  | "clients";

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
  const [thirdPartyMembers, setThirdPartyMembers] = useState<
    ProjectThirdPartyMember[]
  >([]);
  const [showAttachTpModal, setShowAttachTpModal] = useState(false);
  const [tpToAttach, setTpToAttach] = useState<string | null>(null);
  const [tpAllocation, setTpAllocation] = useState<number | "">("");
  const [projectClients, setProjectClients] = useState<ProjectClient[]>([]);
  const [clientsToAttach, setClientsToAttach] = useState<string[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberAllocation, setMemberAllocation] = useState(100);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(
    null,
  );
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [serviceMemberCounts, setServiceMemberCounts] = useState<
    Record<string, number>
  >({});
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
  const [hiddenStatuses, setHiddenStatuses] = useState<TaskStatus[]>([]);
  const [showStatusConfig, setShowStatusConfig] = useState(false);
  const [tempHiddenStatuses, setTempHiddenStatuses] = useState<TaskStatus[]>(
    [],
  );

  const { hasPermission } = usePermissions();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch project details
        const projectData = await projectsService.getById(projectId);
        setProject(projectData);
        setHiddenStatuses(projectData.hiddenStatuses || []);

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

  const filteredTasks = tasks.filter((task) => {
    if (!taskSearchQuery) return true;
    const query = taskSearchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    );
  });

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

  const handleSaveHiddenStatuses = async () => {
    try {
      const updated = await projectsService.update(projectId, {
        hiddenStatuses: tempHiddenStatuses,
      });
      setHiddenStatuses(updated.hiddenStatuses || tempHiddenStatuses);
      setProject(updated);
      setShowStatusConfig(false);
      toast.success("Configuration des statuts mise à jour");
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
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // Temporarily remove overflow clipping to capture the full Gantt
      const overflowEls = container.querySelectorAll<HTMLElement>(
        ".overflow-x-auto, .overflow-y-auto, .overflow-auto, .overflow-hidden",
      );
      const savedOverflows: { el: HTMLElement; value: string }[] = [];
      overflowEls.forEach((el) => {
        savedOverflows.push({ el, value: el.style.overflow });
        el.style.overflow = "visible";
      });
      // Also expand the container itself
      const savedContainerOverflow = container.style.overflow;
      container.style.overflow = "visible";

      const dataUrl = await toPng(container, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      // Restore overflow
      container.style.overflow = savedContainerOverflow;
      savedOverflows.forEach(({ el, value }) => {
        el.style.overflow = value;
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Portrait A4 with 10mm margins
      const margin = 10;
      const pdf = new jsPDF("portrait", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth() - margin * 2;
      const pageH = pdf.internal.pageSize.getHeight() - margin * 2;

      // Scale image to fit the full page width, preserving aspect ratio
      const imgAspect = img.height / img.width;
      const fitWidth = pageW;
      const fitHeight = fitWidth * imgAspect;

      if (fitHeight <= pageH) {
        // Fits on one page
        pdf.addImage(dataUrl, "PNG", margin, margin, fitWidth, fitHeight);
      } else {
        // Multi-page: slice the image across pages
        const scaleFactor = fitWidth / img.width;
        const sliceHeightPx = pageH / scaleFactor;
        const totalPages = Math.ceil(img.height / sliceHeightPx);

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();
          const srcY = page * sliceHeightPx;
          const srcH = Math.min(sliceHeightPx, img.height - srcY);
          const destH = srcH * scaleFactor;

          // Draw slice using a temporary canvas
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = img.width;
          sliceCanvas.height = srcH;
          const ctx = sliceCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, img.width, srcH);
            const sliceData = sliceCanvas.toDataURL("image/png");
            pdf.addImage(sliceData, "PNG", margin, margin, fitWidth, destH);
          }
        }
      }

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
    // Load services
    try {
      const { services, memberCounts } =
        await servicesService.getAllWithMemberCounts();
      setAllServices(services);
      setServiceMemberCounts(memberCounts);
    } catch {
      setAllServices([]);
    }
    setShowTaskModal(true);
  };

  const handleSaveTask = async (
    data: Record<string, unknown>,
  ): Promise<Task | void> => {
    try {
      let created: Task | undefined;
      if (editingTask) {
        await tasksService.update(editingTask.id, data);
        toast.success(tTasks("messages.updateSuccess"));
      } else {
        created = await tasksService.create(
          data as { title: string; [key: string]: unknown },
        );
        toast.success(tTasks("messages.createSuccess"));
      }

      // Refresh tasks
      const tasksData = await tasksService.getByProject(projectId);
      setTasks(Array.isArray(tasksData) ? tasksData : []);

      setShowTaskModal(false);
      setEditingTask(null);
      return created;
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || tTasks("messages.saveError"),
      );
      throw err;
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
  const canEditProject = hasPermission("projects:update");

  const canDeleteProject = hasPermission("projects:delete");

  const canAssignThirdParty = hasPermission("third_parties:assign_to_project");
  const canReadThirdParties = hasPermission("third_parties:read");
  const canReadClients = hasPermission("clients:read");
  const canAssignClients = hasPermission("clients:assign_to_project");

  // Third parties fetch + handlers
  const fetchThirdPartyMembers = async () => {
    if (!canReadThirdParties) return;
    try {
      const data = await thirdPartiesService.listProjectMembers(projectId);
      setThirdPartyMembers(data);
    } catch (err) {
      console.error("Error loading third party members:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "thirdParties") {
      fetchThirdPartyMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, projectId]);

  const fetchProjectClients = async () => {
    if (!canReadClients) return;
    try {
      const data = await clientsService.listProjectClients(projectId);
      setProjectClients(data);
    } catch (err) {
      console.error("Error loading project clients:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "clients") {
      fetchProjectClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, projectId]);

  const handleAttachClients = async () => {
    if (clientsToAttach.length === 0) {
      toast.error("Sélectionnez au moins un client");
      return;
    }
    try {
      const alreadyAttached = new Set(projectClients.map((pc) => pc.clientId));
      const toAdd = clientsToAttach.filter((id) => !alreadyAttached.has(id));
      await Promise.all(
        toAdd.map((clientId) =>
          clientsService.attachToProject(projectId, clientId),
        ),
      );
      toast.success("Client(s) rattaché(s) au projet");
      setClientsToAttach([]);
      await fetchProjectClients();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur lors du rattachement";
      toast.error(typeof message === "string" ? message : "Erreur");
    }
  };

  const handleDetachClient = async (clientId: string) => {
    if (!confirm("Détacher ce client du projet ?")) return;
    try {
      await clientsService.detachFromProject(projectId, clientId);
      toast.success("Client détaché");
      await fetchProjectClients();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur";
      toast.error(typeof message === "string" ? message : "Erreur");
    }
  };

  const handleAttachThirdParty = async () => {
    if (!tpToAttach) {
      toast.error("Sélectionnez un tiers");
      return;
    }
    try {
      await thirdPartiesService.attachToProject(
        projectId,
        tpToAttach,
        typeof tpAllocation === "number" ? tpAllocation : undefined,
      );
      toast.success("Tiers rattaché au projet");
      setShowAttachTpModal(false);
      setTpToAttach(null);
      setTpAllocation("");
      await fetchThirdPartyMembers();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur lors du rattachement";
      toast.error(typeof message === "string" ? message : "Erreur");
    }
  };

  const handleDetachThirdParty = async (thirdPartyId: string) => {
    if (
      !confirm(
        "Détacher ce tiers du projet ? Les déclarations de temps existantes seront conservées.",
      )
    )
      return;
    try {
      await thirdPartiesService.detachFromProject(projectId, thirdPartyId);
      toast.success("Tiers détaché");
      await fetchThirdPartyMembers();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur";
      toast.error(typeof message === "string" ? message : "Erreur");
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900 inline-flex items-center gap-2">
                <ProjectIcon icon={project.icon} size={24} />
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
            {canReadThirdParties && (
              <button
                onClick={() => setActiveTab("thirdParties")}
                className={`${
                  activeTab === "thirdParties"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
              >
                Tiers ({thirdPartyMembers.length})
              </button>
            )}
            {canReadClients && (
              <button
                onClick={() => setActiveTab("clients")}
                className={`${
                  activeTab === "clients"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
              >
                Clients ({projectClients.length})
              </button>
            )}
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
                      {stats.thirdPartyLoggedHours > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          + {stats.thirdPartyLoggedHours}h tiers
                        </p>
                      )}
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
                {/* Configure statuses */}
                <button
                  onClick={() => {
                    setTempHiddenStatuses(hiddenStatuses);
                    setShowStatusConfig(true);
                  }}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                >
                  ⚙️ Statuts
                </button>
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
                onTaskClick={(task) =>
                  router.push(`/${locale}/tasks/${task.id}`)
                }
                onDelete={handleDeleteTask}
                onDateChange={handleTaskDateChange}
              />
            ) : (
              <TaskKanban
                tasks={filteredTasks}
                onTaskClick={(task) =>
                  router.push(`/${locale}/tasks/${task.id}`)
                }
                onAfterStatusChange={async () => {
                  const tasksData = await tasksService.getByProject(projectId);
                  setTasks(Array.isArray(tasksData) ? tasksData : []);
                }}
                hiddenStatuses={hiddenStatuses}
              />
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
                          {member.user ? (
                            <UserAvatar user={member.user} size="lg" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                              ?
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {member.user?.firstName} {member.user?.lastName}
                              </h3>
                              {member.userId === project.managerId && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  Chef de projet
                                </span>
                              )}
                              {member.userId === project.sponsorId && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                  Sponsor
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              defaultValue={member.role || ""}
                              placeholder="Rôle..."
                              onBlur={async (e) => {
                                const newRole = e.target.value.trim();
                                if (newRole !== (member.role || "")) {
                                  try {
                                    await projectsService.updateMember(
                                      project.id,
                                      member.userId,
                                      { role: newRole },
                                    );
                                    const updated =
                                      await projectsService.getById(project.id);
                                    setProject(updated);
                                  } catch {
                                    /* silent */
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                              }}
                              className="text-sm text-gray-600 bg-transparent border-none outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded focus:px-1 w-full"
                            />
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right flex items-center gap-1">
                            <input
                              type="number"
                              defaultValue={member.allocation || ""}
                              min={0}
                              max={100}
                              placeholder="—"
                              onBlur={async (e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== member.allocation) {
                                  try {
                                    await projectsService.updateMember(
                                      project.id,
                                      member.userId,
                                      { allocation: val },
                                    );
                                    const updated =
                                      await projectsService.getById(project.id);
                                    setProject(updated);
                                  } catch {
                                    /* silent */
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  (e.target as HTMLInputElement).blur();
                              }}
                              className="text-sm text-gray-600 bg-transparent border-none outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded focus:px-1 w-12 text-right"
                            />
                            <span className="text-sm text-gray-400">%</span>
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

        {activeTab === "thirdParties" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Tiers rattachés au projet
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Les tiers rattachés peuvent se voir déclarer du temps sur
                  l&apos;ensemble des tâches du projet.
                </p>
              </div>
              {canAssignThirdParty && (
                <button
                  type="button"
                  onClick={() => setShowAttachTpModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  + Rattacher un tiers
                </button>
              )}
            </div>

            {thirdPartyMembers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Aucun tiers rattaché à ce projet.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Organisation
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Allocation
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Rattaché le
                    </th>
                    {canAssignThirdParty && (
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {thirdPartyMembers.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {m.thirdParty?.organizationName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {m.thirdParty?.type ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {m.allocation != null ? `${m.allocation}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(m.createdAt).toLocaleDateString(locale)}
                      </td>
                      {canAssignThirdParty && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleDetachThirdParty(m.thirdPartyId)
                            }
                            className="text-sm text-red-600 hover:underline"
                          >
                            Détacher
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "clients" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Clients rattachés au projet
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Les clients rattachés sont associés à ce projet.
                </p>
              </div>
            </div>

            {canAssignClients && (
              <div className="mb-4 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rattacher un client
                  </label>
                  <ClientSelector
                    value={clientsToAttach}
                    onChange={setClientsToAttach}
                    placeholder="Sélectionner des clients…"
                    allowedIds={undefined}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAttachClients}
                  disabled={clientsToAttach.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  Rattacher
                </button>
              </div>
            )}

            {projectClients.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Aucun client rattaché à ce projet.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Nom
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Rattaché le
                    </th>
                    {canAssignClients && (
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projectClients.map((pc) => (
                    <tr key={pc.clientId}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {pc.client?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(pc.createdAt).toLocaleDateString(locale)}
                      </td>
                      {canAssignClients && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDetachClient(pc.clientId)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Détacher
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {showAttachTpModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Rattacher un tiers au projet
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiers *
                  </label>
                  <ThirdPartySelector
                    value={tpToAttach}
                    onChange={setTpToAttach}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allocation (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tpAllocation}
                    onChange={(e) =>
                      setTpAllocation(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="optionnel"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachTpModal(false);
                    setTpToAttach(null);
                    setTpAllocation("");
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {tCommon("actions.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleAttachThirdParty}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Rattacher
                </button>
              </div>
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
          services={allServices}
          memberCounts={serviceMemberCounts}
          hiddenStatuses={hiddenStatuses}
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

        {/* Status Config Modal */}
        {showStatusConfig && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Configurer les statuts visibles
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Les colonnes masquées n&apos;apparaîtront pas dans le Kanban.
              </p>
              <div className="space-y-3">
                {(
                  [
                    {
                      status: TaskStatus.TODO,
                      label: tTasks("status.TODO"),
                      required: true,
                    },
                    {
                      status: TaskStatus.IN_PROGRESS,
                      label: tTasks("status.IN_PROGRESS"),
                      required: false,
                    },
                    {
                      status: TaskStatus.IN_REVIEW,
                      label: tTasks("status.IN_REVIEW"),
                      required: false,
                    },
                    {
                      status: TaskStatus.DONE,
                      label: tTasks("status.DONE"),
                      required: true,
                    },
                    {
                      status: TaskStatus.BLOCKED,
                      label: tTasks("status.BLOCKED"),
                      required: false,
                    },
                  ] as {
                    status: TaskStatus;
                    label: string;
                    required: boolean;
                  }[]
                ).map(({ status, label, required }) => {
                  const isVisible = !tempHiddenStatuses.includes(status);
                  return (
                    <label
                      key={status}
                      className={`flex items-center space-x-3 p-2 rounded-lg border ${
                        required
                          ? "border-gray-200 bg-gray-50"
                          : "border-gray-200 cursor-pointer hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={required}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempHiddenStatuses((prev) =>
                              prev.filter((s) => s !== status),
                            );
                          } else {
                            setTempHiddenStatuses((prev) => [...prev, status]);
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span
                        className={`text-sm ${required ? "text-gray-500" : "text-gray-800"}`}
                      >
                        {label}
                        {required && (
                          <span className="ml-1 text-xs text-gray-400">
                            (obligatoire)
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowStatusConfig(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleSaveHiddenStatuses}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
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
