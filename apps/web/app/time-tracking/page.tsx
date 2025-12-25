'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { timeTrackingService } from '@/services/time-tracking.service';
import { projectsService } from '@/services/projects.service';
import { tasksService } from '@/services/tasks.service';
import {
  TimeEntry,
  ActivityType,
  CreateTimeEntryDto,
  Project,
  Task,
} from '@/types';
import toast from 'react-hot-toast';

export default function TimeTrackingPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');

  const [formData, setFormData] = useState<CreateTimeEntryDto>({
    projectId: '',
    taskId: '',
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    description: '',
    activityType: ActivityType.DEVELOPMENT,
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch time entries
      const entriesData = await timeTrackingService.getMyEntries();
      setEntries(entriesData);

      // Fetch projects
      if (user?.id) {
        try {
          const projectsData = await projectsService.getByUser(user.id);
          setProjects(Array.isArray(projectsData) ? projectsData : []);
        } catch (err) {
          setProjects([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) console.error('Error fetching projects:', err);
        }
      }

      // Fetch tasks
      if (user?.id) {
        try {
          const tasksData = await tasksService.getByAssignee(user.id);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
        } catch (err) {
          setTasks([]);
          const axiosError = err as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) console.error('Error fetching tasks:', err);
        }
      }
    } catch (err) {
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status !== 404) {
        toast.error('Erreur lors du chargement des données');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await timeTrackingService.create(formData);
      toast.success('Temps enregistré avec succès');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de l'enregistrement"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) return;

    try {
      await timeTrackingService.delete(id);
      toast.success('Entrée supprimée');
      fetchData();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: '',
      taskId: '',
      date: new Date().toISOString().split('T')[0],
      hours: 0,
      description: '',
      activityType: ActivityType.DEVELOPMENT,
    });
  };

  const getFilteredEntries = () => {
    let filtered = entries;

    if (selectedProject !== 'ALL') {
      filtered = filtered.filter((e) => e.projectId === selectedProject);
    }

    if (startDate) {
      filtered = filtered.filter((e) => {
        const entryDate = e.date.split('T')[0];
        return entryDate >= startDate;
      });
    }

    if (endDate) {
      filtered = filtered.filter((e) => {
        const entryDate = e.date.split('T')[0];
        return entryDate <= endDate;
      });
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case ActivityType.DEVELOPMENT:
        return 'Développement';
      case ActivityType.MEETING:
        return 'Réunion';
      case ActivityType.SUPPORT:
        return 'Support';
      case ActivityType.TRAINING:
        return 'Formation';
      case ActivityType.OTHER:
        return 'Autre';
      default:
        return type;
    }
  };

  const getActivityTypeBadgeColor = (type: ActivityType) => {
    switch (type) {
      case ActivityType.DEVELOPMENT:
        return 'bg-blue-100 text-blue-800';
      case ActivityType.MEETING:
        return 'bg-purple-100 text-purple-800';
      case ActivityType.SUPPORT:
        return 'bg-orange-100 text-orange-800';
      case ActivityType.TRAINING:
        return 'bg-green-100 text-green-800';
      case ActivityType.OTHER:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTotalHours = () => {
    return getFilteredEntries().reduce((sum, entry) => sum + entry.hours, 0);
  };

  const getAvailableTasksForProject = () => {
    if (!formData.projectId) return [];
    return tasks.filter((t) => t.projectId === formData.projectId);
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
            <h1 className="text-2xl font-bold text-gray-900">Temps passé</h1>
            <p className="text-gray-600 mt-1">
              {getFilteredEntries().length} entrée(s) - {getTotalHours()}h au
              total
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Saisir du temps</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filtres</h3>
            {(selectedProject !== 'ALL' || startDate || endDate) && (
              <button
                onClick={() => {
                  setSelectedProject('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 transition"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projet
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Tous les projets</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Toutes les dates"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Toutes les dates"
              />
            </div>
          </div>
        </div>

        {/* Entries List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {getFilteredEntries().length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏱️</div>
              <p className="text-gray-500">Aucune entrée de temps</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Saisir votre première entrée
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {getFilteredEntries().map((entry) => (
                <div
                  key={entry.id}
                  className="p-6 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-bold text-gray-900">
                          {entry.hours}h
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getActivityTypeBadgeColor(
                            entry.activityType
                          )}`}
                        >
                          {getActivityTypeLabel(entry.activityType)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(entry.date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {entry.project && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <span>📁</span>
                          <span>{entry.project.name}</span>
                        </div>
                      )}

                      {entry.task && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <span>✓</span>
                          <span>{entry.task.title}</span>
                        </div>
                      )}

                      {entry.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {entry.description}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        Créé le{' '}
                        {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Saisir du temps
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée (heures) *
                </label>
                <input
                  type="number"
                  required
                  min="0.25"
                  step="0.25"
                  value={formData.hours || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hours: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 2.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d&apos;activité *
                </label>
                <select
                  required
                  value={formData.activityType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      activityType: e.target.value as ActivityType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={ActivityType.DEVELOPMENT}>
                    Développement
                  </option>
                  <option value={ActivityType.MEETING}>Réunion</option>
                  <option value={ActivityType.SUPPORT}>Support</option>
                  <option value={ActivityType.TRAINING}>Formation</option>
                  <option value={ActivityType.OTHER}>Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projet (optionnel)
                </label>
                <select
                  value={formData.projectId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      projectId: e.target.value,
                      taskId: '', // Reset task when project changes
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Aucun projet</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.projectId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tâche (optionnel)
                  </label>
                  <select
                    value={formData.taskId}
                    onChange={(e) =>
                      setFormData({ ...formData, taskId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Aucune tâche</option>
                    {getAvailableTasksForProject().map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Décrivez votre activité..."
                />
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
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
