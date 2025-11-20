'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { tasksService } from '@/services/tasks.service';
import { milestonesService } from '@/services/milestones.service';
import { usersService } from '@/services/users.service';
import { projectsService } from '@/services/projects.service';
import { Task, TaskStatus, Priority, Milestone, User, Project } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    milestoneId: '',
    assigneeId: '',
    projectId: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        const taskData = await tasksService.getById(taskId);
        setTask(taskData);

        // Fetch milestones for the project
        if (taskData.projectId) {
          try {
            const milestonesData = await milestonesService.getAll();
            const projectMilestones = milestonesData.data.filter(
              (m: Milestone) => m.projectId === taskData.projectId
            );
            setMilestones(projectMilestones);
          } catch (error) {
            console.error('Error fetching milestones:', error);
            setMilestones([]);
          }
        }

        // Fetch all users
        try {
          const usersResponse = await usersService.getAll();
          const allUsers = Array.isArray(usersResponse)
            ? usersResponse
            : (usersResponse as any).data || [];
          setUsers(allUsers);
        } catch (error) {
          console.error('Error fetching users:', error);
          setUsers([]);
        }

        // Fetch all projects
        try {
          const projectsData = await projectsService.getAll();
          const allProjects = Array.isArray(projectsData)
            ? projectsData
            : (projectsData as any).data || [];
          setProjects(allProjects);
        } catch (error) {
          console.error('Error fetching projects:', error);
          setProjects([]);
        }

        // Initialize form data
        setFormData({
          title: taskData.title,
          description: taskData.description || '',
          status: taskData.status,
          priority: taskData.priority,
          milestoneId: taskData.milestoneId || '',
          assigneeId: taskData.assigneeId || '',
          projectId: taskData.projectId || '',
          startDate: taskData.startDate
            ? new Date(taskData.startDate).toISOString().split('T')[0]
            : '',
          endDate: taskData.endDate
            ? new Date(taskData.endDate).toISOString().split('T')[0]
            : '',
        });
      } catch (error: any) {
        toast.error('Erreur lors du chargement de la tâche');
        console.error(error);
        router.push('/tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId, router]);

  const handleSave = async () => {
    try {
      // Préparer les données à envoyer (nettoyer les chaînes vides)
      const updateData: any = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
      };

      // Ajouter milestoneId seulement s'il est défini
      if (formData.milestoneId) {
        updateData.milestoneId = formData.milestoneId;
      }

      // Ajouter assigneeId seulement s'il est défini
      if (formData.assigneeId) {
        updateData.assigneeId = formData.assigneeId;
      }

      // Ajouter projectId seulement s'il est défini
      if (formData.projectId) {
        updateData.projectId = formData.projectId;
      }

      // Ajouter startDate seulement si définie
      if (formData.startDate) {
        updateData.startDate = new Date(formData.startDate).toISOString();
      }

      // Ajouter endDate seulement si définie
      if (formData.endDate) {
        updateData.endDate = new Date(formData.endDate).toISOString();
      }

      const updatedTask = await tasksService.update(taskId, updateData);
      setTask(updatedTask);
      setIsEditing(false);
      toast.success('Tâche mise à jour avec succès');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  const handleCancel = () => {
    // Reset form data to current task values
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        milestoneId: task.milestoneId || '',
        assigneeId: task.assigneeId || '',
        projectId: task.projectId || '',
        startDate: task.startDate
          ? new Date(task.startDate).toISOString().split('T')[0]
          : '',
        endDate: task.endDate
          ? new Date(task.endDate).toISOString().split('T')[0]
          : '',
      });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      return;
    }

    try {
      await tasksService.delete(taskId);
      toast.success('Tâche supprimée avec succès');
      router.push('/tasks');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      console.error(error);
    }
  };

  const canEdit = () => {
    if (!user) return false;
    const allowedRoles = ['ADMIN', 'RESPONSABLE', 'MANAGER', 'CONTRIBUTEUR'];
    return allowedRoles.includes(user.role);
  };

  const getStatusBadgeColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return 'bg-gray-200 text-gray-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case TaskStatus.IN_REVIEW:
        return 'bg-yellow-100 text-yellow-800';
      case TaskStatus.DONE:
        return 'bg-green-100 text-green-800';
      case TaskStatus.BLOCKED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return 'À faire';
      case TaskStatus.IN_PROGRESS:
        return 'En cours';
      case TaskStatus.IN_REVIEW:
        return 'En revue';
      case TaskStatus.DONE:
        return 'Terminé';
      case TaskStatus.BLOCKED:
        return 'Bloqué';
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

  if (loading || !task) {
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
        <div>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center space-x-1"
          >
            <span>←</span>
            <span>Retour</span>
          </button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-3xl font-bold text-gray-900 w-full border-b-2 border-blue-500 focus:outline-none"
                />
              ) : (
                <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {!isEditing && (
                <>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeColor(
                      task.status
                    )}`}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-medium ${getPriorityBadgeColor(
                      task.priority
                    )}`}
                  >
                    {getPriorityLabel(task.priority)}
                  </span>
                </>
              )}
              {canEdit() && !isEditing && (
                <>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Modifier
                  </button>
                </>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Sauvegarder
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Description
              </h2>
              {isEditing ? (
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Description de la tâche..."
                />
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {task.description || 'Aucune description'}
                </p>
              )}
            </div>

            {/* Edit Form Fields */}
            {isEditing && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Paramètres
                </h2>
                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={TaskStatus.TODO}>À faire</option>
                      <option value={TaskStatus.IN_PROGRESS}>En cours</option>
                      <option value={TaskStatus.IN_REVIEW}>En revue</option>
                      <option value={TaskStatus.DONE}>Terminé</option>
                      <option value={TaskStatus.BLOCKED}>Bloqué</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priorité
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={Priority.LOW}>Basse</option>
                      <option value={Priority.NORMAL}>Normale</option>
                      <option value={Priority.HIGH}>Haute</option>
                      <option value={Priority.CRITICAL}>Critique</option>
                    </select>
                  </div>

                  {/* Milestone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jalon
                    </label>
                    <select
                      value={formData.milestoneId}
                      onChange={(e) => setFormData({ ...formData, milestoneId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Aucun jalon</option>
                      {milestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.id}>
                          {milestone.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assigné à
                    </label>
                    <select
                      value={formData.assigneeId}
                      onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Non assigné</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Project */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Projet
                    </label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Aucun projet</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Progress */}
            {!isEditing && task.progress > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Progression
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Avancement</span>
                    <span className="text-sm font-medium text-gray-900">
                      {task.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Dependencies */}
            {(task as any).dependencies && (task as any).dependencies.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Dépendances
                </h2>
                <div className="space-y-2">
                  {(task as any).dependencies.map((dep: any) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-900">
                        {dep.dependsOnTask?.title || 'Tâche supprimée'}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                          dep.dependsOnTask?.status || TaskStatus.TODO
                        )}`}
                      >
                        {getStatusLabel(dep.dependsOnTask?.status || TaskStatus.TODO)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Project Info */}
            {task.project && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Projet
                </h2>
                <button
                  onClick={() => router.push(`/projects/${task.project?.id}`)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {task.project.name}
                </button>
              </div>
            )}

            {/* Assignee */}
            {task.assignee && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Assigné à
                </h2>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                    {task.assignee.firstName[0]}
                    {task.assignee.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {task.assignee.firstName} {task.assignee.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{task.assignee.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Milestone */}
            {(task as any).milestone && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Jalon</h2>
                <p className="font-medium text-gray-900">{(task as any).milestone.name}</p>
                {(task as any).milestone.dueDate && (
                  <p className="text-sm text-gray-600 mt-1">
                    Échéance:{' '}
                    {new Date((task as any).milestone.dueDate).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            {/* Epic */}
            {(task as any).epic && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Epic</h2>
                <p className="font-medium text-gray-900">{(task as any).epic.name}</p>
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Détails
              </h2>
              <div className="space-y-3 text-sm">
                {task.estimatedHours && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimation</span>
                    <span className="font-medium text-gray-900">
                      {task.estimatedHours}h
                    </span>
                  </div>
                )}
                {task.startDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date de début</span>
                    <span className="font-medium text-gray-900">
                      {new Date(task.startDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                {task.endDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date de fin</span>
                    <span className="font-medium text-gray-900">
                      {new Date(task.endDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Créée le</span>
                  <span className="font-medium text-gray-900">
                    {new Date(task.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mise à jour</span>
                  <span className="font-medium text-gray-900">
                    {new Date(task.updatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
