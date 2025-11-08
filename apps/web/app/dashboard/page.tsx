'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { projectsService } from '@/services/projects.service';
import { tasksService } from '@/services/tasks.service';
import { Project, Task } from '@/types';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    tasksInProgress: 0,
    tasksDone: 0,
    tasksBlocked: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch user's projects
        if (user?.id) {
          let projects: Project[] = [];
          let tasks: Task[] = [];

          try {
            projects = await projectsService.getByUser(user.id);
            setMyProjects(projects);
          } catch (error: any) {
            // Si 404, c'est juste qu'il n'y a pas de projets
            if (error.response?.status !== 404) {
              throw error;
            }
          }

          // Fetch user's tasks
          try {
            tasks = await tasksService.getByAssignee(user.id);
            setMyTasks(tasks);
          } catch (error: any) {
            // Si 404, c'est juste qu'il n'y a pas de tâches
            if (error.response?.status !== 404) {
              throw error;
            }
          }

          // Calculate stats
          setStats({
            totalProjects: projects.length,
            activeProjects: projects.filter((p) => p.status === 'ACTIVE')
              .length,
            totalTasks: tasks.length,
            tasksInProgress: tasks.filter((t) => t.status === 'IN_PROGRESS')
              .length,
            tasksDone: tasks.filter((t) => t.status === 'DONE').length,
            tasksBlocked: tasks.filter((t) => t.status === 'BLOCKED').length,
          });
        }
      } catch (error: any) {
        toast.error('Erreur lors du chargement des données');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

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
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour {user?.firstName} !
          </h1>
          <p className="text-gray-600 mt-1">
            Voici un aperçu de votre activité
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Projets actifs
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.activeProjects}
                </p>
              </div>
              <div className="text-4xl">📁</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              sur {stats.totalProjects} projets
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tâches en cours
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.tasksInProgress}
                </p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              sur {stats.totalTasks} tâches
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tâches terminées
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.tasksDone}
                </p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.totalTasks > 0
                ? Math.round((stats.tasksDone / stats.totalTasks) * 100)
                : 0}
              % complétées
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Tâches bloquées
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.tasksBlocked}
                </p>
              </div>
              <div className="text-4xl">🚫</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Nécessitent attention</p>
          </div>
        </div>

        {/* Recent tasks */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Mes tâches récentes
            </h2>
          </div>
          <div className="p-6">
            {myTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune tâche assignée
              </p>
            ) : (
              <div className="space-y-3">
                {myTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {task.description.slice(0, 100)}
                          {task.description.length > 100 && '...'}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex items-center space-x-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          task.status === 'TODO'
                            ? 'bg-gray-200 text-gray-800'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'IN_REVIEW'
                            ? 'bg-yellow-100 text-yellow-800'
                            : task.status === 'DONE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {task.status === 'TODO'
                          ? 'À faire'
                          : task.status === 'IN_PROGRESS'
                          ? 'En cours'
                          : task.status === 'IN_REVIEW'
                          ? 'En revue'
                          : task.status === 'DONE'
                          ? 'Terminé'
                          : 'Bloqué'}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          task.priority === 'CRITICAL'
                            ? 'bg-red-100 text-red-800'
                            : task.priority === 'HIGH'
                            ? 'bg-orange-100 text-orange-800'
                            : task.priority === 'NORMAL'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {task.priority === 'CRITICAL'
                          ? 'Critique'
                          : task.priority === 'HIGH'
                          ? 'Haute'
                          : task.priority === 'NORMAL'
                          ? 'Normale'
                          : 'Basse'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My projects */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Mes projets
            </h2>
          </div>
          <div className="p-6">
            {myProjects.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucun projet assigné
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition cursor-pointer"
                  >
                    <h3 className="font-semibold text-gray-900">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {project.description?.slice(0, 80)}
                      {project.description &&
                        project.description.length > 80 &&
                        '...'}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          project.status === 'DRAFT'
                            ? 'bg-gray-200 text-gray-800'
                            : project.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : project.status === 'SUSPENDED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : project.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {project.status === 'DRAFT'
                          ? 'Brouillon'
                          : project.status === 'ACTIVE'
                          ? 'Actif'
                          : project.status === 'SUSPENDED'
                          ? 'Suspendu'
                          : project.status === 'COMPLETED'
                          ? 'Terminé'
                          : 'Annulé'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
