'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { projectsService } from '@/services/projects.service';
import { tasksService } from '@/services/tasks.service';
import { milestonesService } from '@/services/milestones.service';
import { usersService } from '@/services/users.service';
import {
  Project,
  ProjectStats,
  Task,
  ProjectStatus,
  Priority,
  TaskStatus,
  Milestone,
  User,
  ProjectMember,
} from '@/types';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const GanttChart = dynamic(() => import('@/components/GanttChart'), { ssr: false });

type TabType = 'overview' | 'tasks' | 'team' | 'milestones' | 'gantt';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberAllocation, setMemberAllocation] = useState(100);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
        } catch (error: any) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }

        // Fetch project tasks
        try {
          const tasksData = await tasksService.getByProject(projectId);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
        } catch (error: any) {
          setTasks([]);
          if (error.response?.status !== 404) {
            console.error('Error fetching tasks:', error);
          }
        }

        // Fetch milestones
        try {
          const milestonesData = await milestonesService.getAll();
          const projectMilestones = milestonesData.data.filter(
            (m: Milestone) => m.projectId === projectId
          );
          setMilestones(projectMilestones);
        } catch (error: any) {
          setMilestones([]);
          if (error.response?.status !== 404) {
            console.error('Error fetching milestones:', error);
          }
        }
      } catch (error: any) {
        toast.error('Erreur lors du chargement du projet');
        console.error(error);
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, router]);

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

  const getTaskStatusBadgeColor = (status: TaskStatus) => {
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

  const getTaskStatusLabel = (status: TaskStatus) => {
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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTask(null);
    setDragOverColumn(null);
    setIsDragging(false);
    (e.currentTarget as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
        toast.success('Statut mis à jour');
        // Refresh tasks
        const tasksData = await tasksService.getByProject(projectId);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (error: any) {
        toast.error('Erreur lors de la mise à jour du statut');
      }
    }

    setDraggedTask(null);
    setIsDragging(false);
  };

  const handleTaskClick = (task: Task) => {
    if (!isDragging) {
      router.push(`/tasks/${task.id}`);
    }
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status);
  };

  // Add member functions
  const handleOpenAddMemberModal = async () => {
    try {
      const usersResponse = await usersService.getAll();
      // Handle both array and paginated response
      const users = Array.isArray(usersResponse)
        ? usersResponse
        : (usersResponse as any).data || [];
      // Filter out users already in the project
      const existingMemberIds = project?.members?.map(m => m.userId) || [];
      const available = users.filter((u: any) => !existingMemberIds.includes(u.id));
      setAvailableUsers(available);
      setShowAddMemberModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    try {
      await projectsService.addMember(projectId, {
        userId: selectedUserId,
        role: memberRole,
        allocation: memberAllocation,
      });
      toast.success('Membre ajouté avec succès');
      setShowAddMemberModal(false);
      setSelectedUserId('');
      setMemberRole('');
      setMemberAllocation(100);
      // Refresh project data
      const projectData = await projectsService.getById(projectId);
      setProject(projectData);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout du membre');
    }
  };

  if (loading || !project) {
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
            onClick={() => router.push('/projects')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center space-x-1"
          >
            <span>←</span>
            <span>Retour aux projets</span>
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
                  project.status
                )}`}
              >
                {getStatusLabel(project.status)}
              </span>
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${getPriorityBadgeColor(
                  project.priority
                )}`}
              >
                {getPriorityLabel(project.priority)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Vue d'ensemble
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`${
                activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Tâches ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`${
                activeTab === 'milestones'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Jalons ({milestones.length})
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`${
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Équipe ({project.members?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('gantt')}
              className={`${
                activeTab === 'gantt'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              📊 Gantt
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Progression
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
                        Tâches
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.completedTasks}/{stats.totalTasks}
                      </p>
                    </div>
                    <div className="text-4xl">✓</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.inProgressTasks} en cours, {stats.blockedTasks}{' '}
                    bloquées
                  </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Budget
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.loggedHours}h
                      </p>
                    </div>
                    <div className="text-4xl">⏱️</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    sur {stats.totalHours}h ({stats.remainingHours}h restantes)
                  </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Équipe
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stats.membersCount}
                      </p>
                    </div>
                    <div className="text-4xl">👥</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.epicsCount} épopées, {stats.milestonesCount} jalons
                  </p>
                </div>
              </div>
            )}

            {/* Project Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Informations du projet
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  {project.startDate && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Date de début
                      </p>
                      <p className="text-lg text-gray-900 mt-1">
                        {new Date(project.startDate).toLocaleDateString(
                          'fr-FR'
                        )}
                      </p>
                    </div>
                  )}
                  {project.endDate && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Date de fin
                      </p>
                      <p className="text-lg text-gray-900 mt-1">
                        {new Date(project.endDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {project.budgetHours && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Budget heures
                      </p>
                      <p className="text-lg text-gray-900 mt-1">
                        {project.budgetHours}h
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Créé le
                    </p>
                    <p className="text-lg text-gray-900 mt-1">
                      {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Kanban Board */}
            <div className="overflow-x-auto pb-4">
              <div className="flex space-x-4 min-w-max">
                {[
                  { status: TaskStatus.TODO, title: 'À faire', color: 'bg-gray-100' },
                  { status: TaskStatus.IN_PROGRESS, title: 'En cours', color: 'bg-blue-100' },
                  { status: TaskStatus.IN_REVIEW, title: 'En revue', color: 'bg-yellow-100' },
                  { status: TaskStatus.DONE, title: 'Terminé', color: 'bg-green-100' },
                  { status: TaskStatus.BLOCKED, title: 'Bloqué', color: 'bg-red-100' },
                ].map((column) => {
                  const columnTasks = getTasksByStatus(column.status);
                  const isDropTarget = dragOverColumn === column.status;

                  return (
                    <div
                      key={column.status}
                      className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200"
                    >
                      {/* Column Header */}
                      <div className={`${column.color} px-4 py-3 rounded-t-lg border-b border-gray-200`}>
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
                          isDropTarget ? 'bg-blue-50 border-2 border-dashed border-blue-400' : ''
                        }`}
                        onDragOver={(e) => handleDragOver(e, column.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, column.status)}
                      >
                        {columnTasks.length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-8">
                            Aucune tâche
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
                                        task.priority
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

                                  {task.assignee && (
                                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                        {task.assignee.firstName[0]}
                                        {task.assignee.lastName[0]}
                                      </div>
                                      <span>
                                        {task.assignee.firstName} {task.assignee.lastName}
                                      </span>
                                    </div>
                                  )}

                                  {task.estimatedHours && (
                                    <div className="text-xs text-gray-500">
                                      ⏱️ {task.estimatedHours}h estimées
                                    </div>
                                  )}

                                  {task.progress > 0 && (
                                    <div className="mt-3">
                                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                        <span>Progression</span>
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
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Jalons du projet
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {milestones.length === 0 ? (
                <div className="col-span-full bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <p className="text-gray-500">Aucun jalon</p>
                </div>
              ) : (
                milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex-1">
                        {milestone.name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          milestone.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : milestone.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {milestone.status === 'COMPLETED'
                          ? 'Terminé'
                          : milestone.status === 'IN_PROGRESS'
                          ? 'En cours'
                          : 'En attente'}
                      </span>
                    </div>

                    {milestone.description && (
                      <p className="text-sm text-gray-600 mb-4">
                        {milestone.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Échéance:</span>
                        <span className="font-medium text-gray-900">
                          {milestone.dueDate
                            ? new Date(milestone.dueDate).toLocaleDateString('fr-FR')
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Membres de l'équipe
              </h2>
              <button
                onClick={handleOpenAddMemberModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Ajouter un membre
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {!project.members || project.members.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <p className="text-gray-500">Aucun membre</p>
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
                                Allocation: {member.allocation}%
                              </p>
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              if (confirm(`Voulez-vous vraiment retirer ${member.user?.firstName} ${member.user?.lastName} de l'équipe ?`)) {
                                try {
                                  await projectsService.removeMember(project.id, member.userId);
                                  toast.success('Membre retiré avec succès');
                                  // Reload project data
                                  const updated = await projectsService.getById(project.id);
                                  setProject(updated);
                                } catch (error: any) {
                                  toast.error('Erreur lors du retrait du membre');
                                  console.error(error);
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Retirer du projet"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
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
        {activeTab === 'gantt' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <GanttChart
              tasks={tasks}
              milestones={milestones}
              projectStartDate={project.startDate ? new Date(project.startDate) : undefined}
              projectEndDate={project.endDate ? new Date(project.endDate) : undefined}
            />
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Ajouter un membre
              </h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Utilisateur *
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="" className="text-gray-500">Sélectionnez un utilisateur</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id} className="text-gray-900">
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Rôle dans le projet
                  </label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="" className="text-gray-500">Sélectionnez un rôle</option>
                    <option value="Sponsor" className="text-gray-900">Sponsor</option>
                    <option value="Chef de projet" className="text-gray-900">Chef de projet</option>
                    <option value="Responsable technique" className="text-gray-900">Responsable technique</option>
                    <option value="Architecte" className="text-gray-900">Architecte</option>
                    <option value="Tech Lead" className="text-gray-900">Tech Lead</option>
                    <option value="Développeur Senior" className="text-gray-900">Développeur Senior</option>
                    <option value="Développeur" className="text-gray-900">Développeur</option>
                    <option value="Développeur Junior" className="text-gray-900">Développeur Junior</option>
                    <option value="DevOps" className="text-gray-900">DevOps</option>
                    <option value="QA Lead" className="text-gray-900">QA Lead</option>
                    <option value="Testeur" className="text-gray-900">Testeur</option>
                    <option value="UX/UI Designer" className="text-gray-900">UX/UI Designer</option>
                    <option value="Product Owner" className="text-gray-900">Product Owner</option>
                    <option value="Scrum Master" className="text-gray-900">Scrum Master</option>
                    <option value="Analyste métier" className="text-gray-900">Analyste métier</option>
                    <option value="Membre" className="text-gray-900">Membre</option>
                    <option value="Observateur" className="text-gray-900">Observateur</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Allocation (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={memberAllocation}
                    onChange={(e) => setMemberAllocation(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setSelectedUserId('');
                      setMemberRole('');
                      setMemberAllocation(100);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
