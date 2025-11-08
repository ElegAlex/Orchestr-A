'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { projectsService } from '@/services/projects.service';
import { tasksService } from '@/services/tasks.service';
import {
  Project,
  ProjectStats,
  Task,
  ProjectStatus,
  Priority,
  TaskStatus,
} from '@/types';
import toast from 'react-hot-toast';

type TabType = 'overview' | 'tasks' | 'team';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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
          setTasks(tasksData);
        } catch (error: any) {
          if (error.response?.status !== 404) {
            throw error;
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
              onClick={() => setActiveTab('team')}
              className={`${
                activeTab === 'team'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Équipe ({project.members?.length || 0})
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Tâches du projet
              </h2>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                + Créer une tâche
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {tasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-500">Aucune tâche</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-6 hover:bg-gray-50 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {task.description.slice(0, 150)}
                              {task.description.length > 150 && '...'}
                            </p>
                          )}
                          {task.assignee && (
                            <p className="text-sm text-gray-500 mt-2">
                              Assigné à: {task.assignee.firstName}{' '}
                              {task.assignee.lastName}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex flex-col items-end space-y-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getTaskStatusBadgeColor(
                              task.status
                            )}`}
                          >
                            {getTaskStatusLabel(task.status)}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityBadgeColor(
                              task.priority
                            )}`}
                          >
                            {getPriorityLabel(task.priority)}
                          </span>
                          {task.estimatedHours && (
                            <span className="text-xs text-gray-500">
                              ⏱️ {task.estimatedHours}h
                            </span>
                          )}
                        </div>
                      </div>
                      {task.progress > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Progression</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
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
                        <div className="text-right">
                          {member.allocation && (
                            <p className="text-sm text-gray-600">
                              Allocation: {member.allocation}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
