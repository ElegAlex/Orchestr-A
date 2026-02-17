"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { projectsService } from "@/services/projects.service";
import { usersService } from "@/services/users.service";
import { departmentsService } from "@/services/departments.service";
import {
  Project,
  ProjectStatus,
  Priority,
  CreateProjectDto,
  Role,
  User,
  Department,
} from "@/types";
import toast from "react-hot-toast";

export default function ProjectsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "ALL">(
    "ALL",
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [managers, setManagers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState<
    CreateProjectDto & {
      managerId?: string;
      departmentId?: string;
      estimatedHours?: number;
    }
  >({
    name: "",
    description: "",
    status: ProjectStatus.DRAFT,
    priority: Priority.NORMAL,
    startDate: "",
    endDate: "",
    managerId: user?.id || "",
    departmentId: user?.departmentId || "",
    budgetHours: undefined,
    estimatedHours: undefined,
  });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      let projectsData: Project[] = [];

      // Admin et Responsable voient tous les projets
      if (user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE) {
        const response = await projectsService.getAll();
        projectsData = response.data;
      } else if (user?.id) {
        // Autres rôles voient uniquement leurs projets
        try {
          projectsData = await projectsService.getByUser(user.id);
        } catch (err) {
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            throw err;
          }
        }
      }

      setProjects(projectsData);
      setFilteredProjects(projectsData);
    } catch (err) {
      setProjects([]);
      setFilteredProjects([]);
      toast.error(t("messages.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filtrage des projets
  useEffect(() => {
    let filtered = projects;

    // Filtre par statut
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Filtre par priorité
    if (priorityFilter !== "ALL") {
      filtered = filtered.filter((p) => p.priority === priorityFilter);
    }

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query),
      );
    }

    setFilteredProjects(filtered);
  }, [projects, statusFilter, priorityFilter, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Préparer les données selon le DTO backend
      const projectData: {
        name: string;
        description?: string;
        status?: ProjectStatus;
        priority?: Priority;
        startDate: string;
        endDate: string;
        budgetHours?: number;
      } = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        startDate: formData.startDate,
        endDate: formData.endDate,
      };

      // Ajouter budgetHours s'il existe
      if (formData.estimatedHours) {
        projectData.budgetHours = formData.estimatedHours;
      }

      await projectsService.create(projectData);
      toast.success(t("messages.createSuccess"));
      setShowCreateModal(false);
      resetForm();
      fetchProjects();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.createError"),
      );
    }
  };

  const fetchManagersAndDepartments = async () => {
    try {
      const [usersResponse, departments] = await Promise.all([
        usersService.getAll(),
        departmentsService.getAll(),
      ]);

      // Filtrer les users qui peuvent être managers (ADMIN, RESPONSABLE, MANAGER)
      const usersData = Array.isArray(usersResponse)
        ? usersResponse
        : usersResponse.data;

      const managersList = usersData.filter((u: User) =>
        [Role.ADMIN, Role.RESPONSABLE, Role.MANAGER].includes(u.role),
      );
      setManagers(managersList);
      setDepartments(departments);
    } catch (error) {
      setManagers([]);
      setDepartments([]);
      console.error("Error loading managers and departments:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      status: ProjectStatus.DRAFT,
      priority: Priority.NORMAL,
      startDate: "",
      endDate: "",
      managerId: user?.id || "",
      departmentId: user?.departmentId || "",
      budgetHours: undefined,
      estimatedHours: undefined,
    });
  };

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

  const canCreateProject = () => {
    return (
      user?.role === Role.ADMIN ||
      user?.role === Role.RESPONSABLE ||
      user?.role === Role.MANAGER ||
      user?.role === Role.REFERENT_TECHNIQUE
    );
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
              {filteredProjects.length !== projects.length
                ? t("projectCountFiltered", {
                    filtered: filteredProjects.length,
                    total: projects.length,
                  })
                : t("projectCount", { count: filteredProjects.length })}
            </p>
          </div>
          {canCreateProject() && (
            <button
              onClick={() => {
                setShowCreateModal(true);
                fetchManagersAndDepartments();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <span>+</span>
              <span>{t("createProject")}</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.search")}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.status")}
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ProjectStatus | "ALL")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">{t("filters.all")}</option>
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

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("filters.priority")}
              </label>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as Priority | "ALL")
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
        </div>

        {/* Projects List */}
        <div className="flex flex-col gap-3">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-gray-500">{t("noProjects")}</p>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/${locale}/projects/${project.id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-3 hover:shadow-md hover:border-blue-500 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getPriorityBadgeColor(project.priority)}`}
                  >
                    {getPriorityLabel(project.priority)}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 truncate min-w-0 flex-1">
                    {project.name}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusBadgeColor(project.status)}`}
                  >
                    {getStatusLabel(project.status)}
                  </span>
                  {(project.startDate || project.endDate) && (
                    <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">
                      {project.startDate &&
                        new Date(project.startDate).toLocaleDateString("fr-FR")}
                      {project.startDate && project.endDate && " → "}
                      {project.endDate &&
                        new Date(project.endDate).toLocaleDateString("fr-FR")}
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
                      ⏱️ {t("card.budgetHours", { hours: project.budgetHours })}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {project.description || t("card.noDescription")}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t("modal.create.title")}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("modal.create.nameLabel")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("modal.create.namePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("modal.create.descriptionLabel")}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("modal.create.descriptionPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("modal.create.statusLabel")}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={ProjectStatus.DRAFT}>
                      {t("status.DRAFT")}
                    </option>
                    <option value={ProjectStatus.ACTIVE}>
                      {t("status.ACTIVE")}
                    </option>
                    <option value={ProjectStatus.SUSPENDED}>
                      {t("status.SUSPENDED")}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={Priority.LOW}>{t("priority.LOW")}</option>
                    <option value={Priority.NORMAL}>
                      {t("priority.NORMAL")}
                    </option>
                    <option value={Priority.HIGH}>{t("priority.HIGH")}</option>
                    <option value={Priority.CRITICAL}>
                      {t("priority.CRITICAL")}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("modal.create.startDateLabel")}
                  </label>
                  <input
                    type="date"
                    required
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("modal.create.endDateLabel")}
                  </label>
                  <input
                    type="date"
                    required
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
                    {t("modal.create.managerLabel")}
                  </label>
                  <select
                    required
                    value={formData.managerId}
                    onChange={(e) =>
                      setFormData({ ...formData, managerId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">
                      {t("modal.create.managerPlaceholder")}
                    </option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.lastName} ({manager.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("modal.create.departmentLabel")}
                  </label>
                  <select
                    value={formData.departmentId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        departmentId: e.target.value || undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">
                      {t("modal.create.departmentPlaceholder")}
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("modal.create.budgetHoursLabel")}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t("modal.create.budgetHoursPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {t("modal.create.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t("modal.create.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
