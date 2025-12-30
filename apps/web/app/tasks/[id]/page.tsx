'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { tasksService } from '@/services/tasks.service';
import { milestonesService } from '@/services/milestones.service';
import { usersService } from '@/services/users.service';
import { projectsService } from '@/services/projects.service';
import { Task, TaskStatus, Priority, Milestone, User, Project, TaskDependency } from '@/types';
import { UserMultiSelect } from '@/components/UserMultiSelect';
import { TaskDependencySelector } from '@/components/TaskDependencySelector';
import { DependencyValidationBanner } from '@/components/DependencyValidationBanner';
import { detectDateConflicts, getStatusColorClass, getStatusLabel as getDependencyStatusLabel } from '@/utils/dependencyValidation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';

interface TaskMilestone {
  name: string;
  dueDate?: string;
}

interface TaskEpic {
  name: string;
}

interface TaskWithRelations extends Omit<Task, 'epic' | 'milestone'> {
  milestone?: TaskMilestone;
  epic?: TaskEpic;
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<string[]>([]);
  const [savingDependencies, setSavingDependencies] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    milestoneId: '',
    assigneeIds: [] as string[],
    projectId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
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

          // Fetch project tasks for dependency selection
          try {
            const projectTasksData = await tasksService.getByProject(taskData.projectId);
            const tasksArray = Array.isArray(projectTasksData)
              ? projectTasksData
              : (projectTasksData as { data?: Task[] }).data || [];
            setProjectTasks(tasksArray);
          } catch (error) {
            console.error('Error fetching project tasks:', error);
            setProjectTasks([]);
          }
        }

        // Initialize selected dependency IDs
        const depIds = taskData.dependencies?.map((d: TaskDependency) => d.dependsOnTaskId) || [];
        setSelectedDependencyIds(depIds);

        // Fetch all users
        try {
          const usersResponse = await usersService.getAll();
          const allUsers = Array.isArray(usersResponse)
            ? usersResponse
            : (usersResponse as { data?: User[] }).data || [];
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
            : (projectsData as { data?: Project[] }).data || [];
          setProjects(allProjects);
        } catch (error) {
          console.error('Error fetching projects:', error);
          setProjects([]);
        }

        // Initialize form data
        // Extraire les IDs des assignés depuis la relation assignees
        type TaskAssignee = { user?: { id: string }; userId?: string };
        const taskAssigneeIds = taskData.assignees?.map((a: TaskAssignee) => a.user?.id || a.userId).filter(Boolean) as string[] || [];
        // Si pas d'assignees multiples mais un assigneeId, l'utiliser
        const assigneeIds = taskAssigneeIds.length > 0 ? taskAssigneeIds : (taskData.assigneeId ? [taskData.assigneeId] : []);

        setFormData({
          title: taskData.title,
          description: taskData.description || '',
          status: taskData.status,
          priority: taskData.priority,
          milestoneId: taskData.milestoneId || '',
          assigneeIds,
          projectId: taskData.projectId || '',
          startDate: taskData.startDate
            ? new Date(taskData.startDate).toISOString().split('T')[0]
            : '',
          endDate: taskData.endDate
            ? new Date(taskData.endDate).toISOString().split('T')[0]
            : '',
          startTime: taskData.startTime || '',
          endTime: taskData.endTime || '',
        });
      } catch (err) {
        toast.error('Erreur lors du chargement de la tâche');
        console.error(err);
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
      const updateData: Partial<Task> & { assigneeIds?: string[] } = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
      };

      // Ajouter milestoneId seulement s'il est défini
      if (formData.milestoneId) {
        updateData.milestoneId = formData.milestoneId;
      }

      // Ajouter assigneeIds pour l'assignation multiple
      updateData.assigneeIds = formData.assigneeIds;

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

      // Ajouter startTime seulement si défini
      if (formData.startTime) {
        updateData.startTime = formData.startTime;
      }

      // Ajouter endTime seulement si défini
      if (formData.endTime) {
        updateData.endTime = formData.endTime;
      }

      const updatedTask = await tasksService.update(taskId, updateData);
      setTask(updatedTask);
      setIsEditing(false);
      toast.success('Tâche mise à jour avec succès');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error(err);
    }
  };

  const handleCancel = () => {
    // Reset form data to current task values
    if (task) {
      // Extraire les IDs des assignés
      const taskAssigneeIds = task.assignees?.map((a) => a.user?.id || a.userId).filter(Boolean) as string[] || [];
      const assigneeIds = taskAssigneeIds.length > 0 ? taskAssigneeIds : (task.assigneeId ? [task.assigneeId] : []);

      setFormData({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        milestoneId: task.milestoneId || '',
        assigneeIds,
        projectId: task.projectId || '',
        startDate: task.startDate
          ? new Date(task.startDate).toISOString().split('T')[0]
          : '',
        endDate: task.endDate
          ? new Date(task.endDate).toISOString().split('T')[0]
          : '',
        startTime: task.startTime || '',
        endTime: task.endTime || '',
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
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Erreur lors de la suppression');
      console.error(err);
    }
  };

  const handleDependencyChange = async (newDependencyIds: string[]) => {
    if (!task) return;

    const currentIds = task.dependencies?.map(d => d.dependsOnTaskId) || [];
    const toAdd = newDependencyIds.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !newDependencyIds.includes(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      setSelectedDependencyIds(newDependencyIds);
      return;
    }

    setSavingDependencies(true);
    try {
      // Remove dependencies
      for (const depId of toRemove) {
        const dependency = task.dependencies?.find(d => d.dependsOnTaskId === depId);
        if (dependency?.id) {
          await tasksService.removeDependency(taskId, dependency.id);
        }
      }

      // Add new dependencies
      for (const depId of toAdd) {
        await tasksService.addDependency(taskId, depId);
      }

      // Refresh task data
      const updatedTask = await tasksService.getById(taskId);
      setTask(updatedTask);
      const updatedDepIds = updatedTask.dependencies?.map((d: TaskDependency) => d.dependsOnTaskId) || [];
      setSelectedDependencyIds(updatedDepIds);
      toast.success('Dependances mises a jour');
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Erreur lors de la mise a jour des dependances');
      console.error(err);
      // Reset to original
      setSelectedDependencyIds(currentIds);
    } finally {
      setSavingDependencies(false);
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

                  {/* Assignees */}
                  <UserMultiSelect
                    label="Assignés"
                    users={users}
                    selectedIds={formData.assigneeIds}
                    onChange={(ids) => setFormData({ ...formData, assigneeIds: ids })}
                    placeholder="Selectionner les assignés"
                  />

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

                  {/* Start Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure de début
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure de fin
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
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
            {task.projectId && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Dependances
                </h2>

                {/* Date conflict warnings */}
                {!isEditing && task.dependencies && task.dependencies.length > 0 && (
                  <DependencyValidationBanner
                    conflicts={detectDateConflicts(
                      { startDate: task.startDate },
                      task.dependencies
                    )}
                  />
                )}

                {isEditing ? (
                  <TaskDependencySelector
                    currentTaskId={taskId}
                    currentTaskStartDate={formData.startDate}
                    selectedDependencyIds={selectedDependencyIds}
                    availableTasks={projectTasks}
                    onChange={handleDependencyChange}
                    disabled={savingDependencies}
                    label=""
                    placeholder="Selectionner les taches dont depend cette tache"
                  />
                ) : (
                  <div className="space-y-2">
                    {(!task.dependencies || task.dependencies.length === 0) ? (
                      <p className="text-sm text-gray-500 italic">Aucune dependance</p>
                    ) : (
                      task.dependencies.map((dep) => {
                        const hasConflict = dep.dependsOnTask?.endDate && task.startDate
                          ? new Date(task.startDate) <= new Date(dep.dependsOnTask.endDate)
                          : false;
                        return (
                          <div
                            key={dep.id || dep.dependsOnTaskId}
                            onClick={() => dep.dependsOnTask && router.push(`/tasks/${dep.dependsOnTask.id}`)}
                            className={`
                              flex items-center justify-between p-3 rounded-lg cursor-pointer
                              ${hasConflict ? 'bg-amber-50 hover:bg-amber-100' : 'bg-gray-50 hover:bg-gray-100'}
                            `}
                          >
                            <div className="flex items-center gap-2">
                              {hasConflict && (
                                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              <span className="text-sm text-gray-900">
                                {dep.dependsOnTask?.title || 'Tache supprimee'}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getStatusColorClass(
                                dep.dependsOnTask?.status || TaskStatus.TODO
                              )}`}
                            >
                              {getDependencyStatusLabel(dep.dependsOnTask?.status || TaskStatus.TODO)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
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

            {/* Assignees - Multiple */}
            {((task.assignees && task.assignees.length > 0) || task.assignee) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {(task.assignees && task.assignees.length > 1) ? 'Assignés' : 'Assigné à'}
                </h2>
                <div className="space-y-3">
                  {task.assignees && task.assignees.length > 0 ? (
                    task.assignees.map((assignment) => (
                      <div key={assignment.userId} className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                          {assignment.user?.firstName?.[0] || '?'}
                          {assignment.user?.lastName?.[0] || ''}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {assignment.user?.firstName} {assignment.user?.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{assignment.user?.email}</p>
                        </div>
                      </div>
                    ))
                  ) : task.assignee && (
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
                  )}
                </div>
              </div>
            )}

            {/* Milestone */}
            {task.milestone && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Jalon</h2>
                <p className="font-medium text-gray-900">{task.milestone.name}</p>
                {task.milestone.dueDate && (
                  <p className="text-sm text-gray-600 mt-1">
                    Échéance:{' '}
                    {new Date(task.milestone.dueDate).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            {/* Epic */}
            {task.epic && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Epic</h2>
                <p className="font-medium text-gray-900">{task.epic.name}</p>
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
                {(task.startTime || task.endTime) && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Horaires</span>
                    <span className="font-medium text-gray-900">
                      {task.startTime || '--:--'} - {task.endTime || '--:--'}
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
