'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { projectsService } from '@/services/projects.service';
import { usersService } from '@/services/users.service';
import { departmentsService } from '@/services/departments.service';
import {
  Project,
  ProjectStatus,
  Priority,
  CreateProjectDto,
  Role,
  User,
  Department,
} from '@/types';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>(
    'ALL'
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [managers, setManagers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState<CreateProjectDto & { managerId?: string; departmentId?: string; estimatedHours?: number }>({
    name: '',
    description: '',
    status: ProjectStatus.DRAFT,
    priority: Priority.NORMAL,
    startDate: '',
    endDate: '',
    managerId: user?.id || '',
    departmentId: user?.departmentId || '',
    budgetHours: undefined,
    estimatedHours: undefined,
  });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      let projectsData: Project[] = [];

      // Admin et Responsable voient tous les projets
      if (
        user?.role === Role.ADMIN ||
        user?.role === Role.RESPONSABLE
      ) {
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
      toast.error('Erreur lors du chargement des projets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  // Filtrage des projets
  useEffect(() => {
    let filtered = projects;

    // Filtre par statut
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Filtre par priorité
    if (priorityFilter !== 'ALL') {
      filtered = filtered.filter((p) => p.priority === priorityFilter);
    }

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
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
      toast.success('Projet créé avec succès');
      setShowCreateModal(false);
      resetForm();
      fetchProjects();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || 'Erreur lors de la création'
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
        [Role.ADMIN, Role.RESPONSABLE, Role.MANAGER].includes(u.role)
      );
      setManagers(managersList);
      setDepartments(departments);
    } catch (error) {
      setManagers([]);
      setDepartments([]);
      console.error('Error loading managers and departments:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: ProjectStatus.DRAFT,
      priority: Priority.NORMAL,
      startDate: '',
      endDate: '',
      managerId: user?.id || '',
      departmentId: user?.departmentId || '',
      budgetHours: undefined,
      estimatedHours: undefined,
    });
  };

  const getStatusBadgeColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DRAFT:
        return 'bg-gray-200 text-gray-800';
      case ProjectStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case ProjectStatus.SUSPENDED:
        return 'bg-yellow-100 text-yellow-800';
      case ProjectStatus.COMPLETED:
        return 'bg-blue-100 text-blue-800';
      case ProjectStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DRAFT:
        return 'Brouillon';
      case ProjectStatus.ACTIVE:
        return 'Actif';
      case ProjectStatus.SUSPENDED:
        return 'Suspendu';
      case ProjectStatus.COMPLETED:
        return 'Terminé';
      case ProjectStatus.CANCELLED:
        return 'Annulé';
      default:
        return status;
    }
  };

  const getPriorityBadgeColor = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return 'bg-red-100 text-red-800';
      case Priority.HIGH:
        return 'bg-orange-100 text-orange-800';
      case Priority.NORMAL:
        return 'bg-blue-100 text-blue-800';
      case Priority.LOW:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return 'Critique';
      case Priority.HIGH:
        return 'Haute';
      case Priority.NORMAL:
        return 'Normale';
      case Priority.LOW:
        return 'Basse';
      default:
        return priority;
    }
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
            <p className="mt-4 text-gray-600">Chargement...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Projets</h1>
            <p className="text-gray-600 mt-1">
              {filteredProjects.length} projet(s)
              {filteredProjects.length !== projects.length &&
                ` sur ${projects.length}`}
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
              <span>Créer un projet</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rechercher
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom ou description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ProjectStatus | 'ALL')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Tous</option>
                <option value={ProjectStatus.DRAFT}>Brouillon</option>
                <option value={ProjectStatus.ACTIVE}>Actif</option>
                <option value={ProjectStatus.SUSPENDED}>Suspendu</option>
                <option value={ProjectStatus.COMPLETED}>Terminé</option>
                <option value={ProjectStatus.CANCELLED}>Annulé</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorité
              </label>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as Priority | 'ALL')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Toutes</option>
                <option value={Priority.CRITICAL}>Critique</option>
                <option value={Priority.HIGH}>Haute</option>
                <option value={Priority.NORMAL}>Normale</option>
                <option value={Priority.LOW}>Basse</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-gray-500">Aucun projet trouvé</p>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-500 transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    {project.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityBadgeColor(
                      project.priority
                    )}`}
                  >
                    {getPriorityLabel(project.priority)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {project.description || 'Aucune description'}
                </p>

                <div className="flex items-center justify-between">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                      project.status
                    )}`}
                  >
                    {getStatusLabel(project.status)}
                  </span>

                  {project.budgetHours && (
                    <span className="text-sm text-gray-500">
                      ⏱️ {project.budgetHours}h
                    </span>
                  )}
                </div>

                {(project.startDate || project.endDate) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      {project.startDate && (
                        <span>
                          Début:{' '}
                          {new Date(project.startDate).toLocaleDateString(
                            'fr-FR'
                          )}
                        </span>
                      )}
                      {project.endDate && (
                        <span>
                          Fin:{' '}
                          {new Date(project.endDate).toLocaleDateString(
                            'fr-FR'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}
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
              Créer un projet
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du projet *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Refonte du site web"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Description détaillée du projet..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
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
                    <option value={ProjectStatus.DRAFT}>Brouillon</option>
                    <option value={ProjectStatus.ACTIVE}>Actif</option>
                    <option value={ProjectStatus.SUSPENDED}>Suspendu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorité
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
                    <option value={Priority.LOW}>Basse</option>
                    <option value={Priority.NORMAL}>Normale</option>
                    <option value={Priority.HIGH}>Haute</option>
                    <option value={Priority.CRITICAL}>Critique</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
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
                    Responsable du projet *
                  </label>
                  <select
                    required
                    value={formData.managerId}
                    onChange={(e) =>
                      setFormData({ ...formData, managerId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Sélectionner --</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.lastName} ({manager.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Département
                  </label>
                  <select
                    value={formData.departmentId || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        departmentId: e.target.value || undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Aucun --</option>
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
                    Budget en heures
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.budgetHours || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budgetHours: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 50000"
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
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Créer le projet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
