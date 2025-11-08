'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { tasksService } from '@/services/tasks.service';
import { Task, TaskStatus, Priority } from '@/types';
import toast from 'react-hot-toast';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        const taskData = await tasksService.getById(taskId);
        setTask(taskData);
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
              <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            </div>
            <div className="flex items-center space-x-3">
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
              <p className="text-gray-700 whitespace-pre-wrap">
                {task.description || 'Aucune description'}
              </p>
            </div>

            {/* Progress */}
            {task.progress > 0 && (
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
