'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { PlanningView } from '@/components/planning/PlanningView';
import { useAuthStore } from '@/stores/auth.store';
import { projectsService } from '@/services/projects.service';
import { tasksService } from '@/services/tasks.service';
import { personalTodosService, PersonalTodo } from '@/services/personal-todos.service';
import { Project, Task, TaskStatus } from '@/types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MAX_TODOS = 20;

export default function DashboardPage() {
  const router = useRouter();
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

  // Personal To-Do state
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTodoText, setEditTodoText] = useState('');

  // Fonction pour formater les dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non définie';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: fr });
    } catch {
      return 'Date invalide';
    }
  };

  // Fonction pour changer le statut d'une tâche
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success('Statut mis à jour');

      // Refresh les tâches
      if (user?.id) {
        const tasks = await tasksService.getByAssignee(user.id);
        const now = new Date();
        const in7Days = new Date();
        in7Days.setDate(now.getDate() + 7);

        const filteredTasks = Array.isArray(tasks) ? tasks.filter(task => {
          if (task.status === 'DONE') return false;
          if (!task.endDate) return true;
          const endDate = new Date(task.endDate);
          return endDate >= now && endDate <= in7Days;
        }) : [];

        setMyTasks(filteredTasks);

        // Update stats
        setStats(prev => ({
          ...prev,
          tasksInProgress: tasks.filter((t: Task) => t.status === 'IN_PROGRESS').length,
          tasksDone: tasks.filter((t: Task) => t.status === 'DONE').length,
          tasksBlocked: tasks.filter((t: Task) => t.status === 'BLOCKED').length,
        }));
      }
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du statut');
      console.error(error);
    }
  };

  // Fonction pour fetch les todos
  const fetchTodos = async () => {
    try {
      setLoadingTodos(true);
      const data = await personalTodosService.getAll();
      setTodos(data);
    } catch (error: any) {
      console.error('Error fetching todos:', error);
    } finally {
      setLoadingTodos(false);
    }
  };

  // Fonctions pour gérer les todos
  const handleAddTodo = async () => {
    if (!newTodoText.trim() || todos.length >= MAX_TODOS) return;
    try {
      setAddingTodo(true);
      const newTodo = await personalTodosService.create({ text: newTodoText.trim() });
      setTodos([newTodo, ...todos]);
      setNewTodoText('');
      toast.success('To-do ajoutée');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout');
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo: PersonalTodo) => {
    try {
      const updated = await personalTodosService.update(todo.id, { completed: !todo.completed });
      setTodos(todos.map(t => (t.id === todo.id ? updated : t)));
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await personalTodosService.delete(id);
      setTodos(todos.filter(t => t.id !== id));
      toast.success('To-do supprimée');
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleStartEditTodo = (todo: PersonalTodo) => {
    setEditingTodoId(todo.id);
    setEditTodoText(todo.text);
  };

  const handleSaveEditTodo = async (id: string) => {
    if (!editTodoText.trim()) {
      setEditingTodoId(null);
      return;
    }
    try {
      const updated = await personalTodosService.update(id, { text: editTodoText.trim() });
      setTodos(todos.map(t => (t.id === id ? updated : t)));
      setEditingTodoId(null);
      toast.success('To-do modifiée');
    } catch (error: any) {
      toast.error('Erreur lors de la modification');
    }
  };

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
            setMyProjects(Array.isArray(projects) ? projects : []);
          } catch (error: any) {
            // Si 404 ou autre erreur, on met un tableau vide
            setMyProjects([]);
            if (error.response?.status !== 404) {
              console.error('Error fetching projects:', error);
            }
          }

          // Fetch user's tasks
          try {
            tasks = await tasksService.getByAssignee(user.id);

            // Filtrer : tâches non terminées avec échéance dans les 7 prochains jours
            const now = new Date();
            const in7Days = new Date();
            in7Days.setDate(now.getDate() + 7);

            const filteredTasks = Array.isArray(tasks) ? tasks.filter(task => {
              // Exclure les tâches terminées
              if (task.status === 'DONE') return false;

              // Si pas de date de fin, on inclut la tâche
              if (!task.endDate) return true;

              // Vérifier que l'échéance est dans les 7 prochains jours
              const endDate = new Date(task.endDate);
              return endDate >= now && endDate <= in7Days;
            }) : [];

            setMyTasks(filteredTasks);
          } catch (error: any) {
            // Si 404 ou autre erreur, on met un tableau vide
            setMyTasks([]);
            if (error.response?.status !== 404) {
              console.error('Error fetching tasks:', error);
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
    fetchTodos();
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
          {/* KPI Cards */}
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

        {/* Personal Planning - Composant réutilisable */}
        {user && (
          <PlanningView
            filterUserId={user.id}
            title="Mon planning"
            showFilters={false}
            showGroupHeaders={false}
            showLegend={false}
          />
        )}

        {/* Personal To-Do List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              📝 Ma To-Do
            </h2>
          </div>
          <div className="p-6">
            {/* Input Add */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="Ajouter une to-do..."
                disabled={addingTodo || todos.length >= MAX_TODOS}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleAddTodo}
                disabled={addingTodo || !newTodoText.trim() || todos.length >= MAX_TODOS}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
              >
                {addingTodo ? '...' : '+ Ajouter'}
              </button>
            </div>

            {todos.length >= MAX_TODOS && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                ⚠️ Limite de {MAX_TODOS} to-dos atteinte
              </div>
            )}

            {loadingTodos ? (
              <p className="text-gray-500 text-center py-8">
                Chargement...
              </p>
            ) : todos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune to-do pour le moment
              </p>
            ) : (
              <div className="space-y-3">
                {todos.filter(t => !t.completed).map((todo) => (
                  <div
                    key={todo.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleToggleTodo(todo)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        {editingTodoId === todo.id ? (
                          <input
                            type="text"
                            value={editTodoText}
                            onChange={(e) => setEditTodoText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditTodo(todo.id);
                              if (e.key === 'Escape') setEditingTodoId(null);
                            }}
                            onBlur={() => handleSaveEditTodo(todo.id)}
                            className="flex-1 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="flex-1 text-gray-900 cursor-pointer"
                            onDoubleClick={() => handleStartEditTodo(todo)}
                            title="Double-cliquer pour éditer"
                          >
                            {todo.text}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="ml-4 text-red-600 hover:text-red-800 transition"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {todos.filter(t => t.completed).length > 0 && (
                  <>
                    <div className="pt-2 text-xs font-semibold text-gray-500 uppercase">
                      Complétées ({todos.filter(t => t.completed).length})
                    </div>
                    {todos.filter(t => t.completed).map((todo) => (
                      <div
                        key={todo.id}
                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition opacity-60"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => handleToggleTodo(todo)}
                              className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                            />
                            <span className="flex-1 text-gray-600 line-through">
                              {todo.text}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="ml-4 text-red-600 hover:text-red-800 transition"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming tasks */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Mes tâches à venir
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
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                    onClick={() => router.push(`/tasks/${task.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 hover:text-blue-600 transition">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {task.description.slice(0, 100)}
                            {task.description.length > 100 && '...'}
                          </p>
                        )}

                        {/* Dates */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">Début:</span>
                            <span>{formatDate(task.startDate)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">Fin:</span>
                            <span>{formatDate(task.endDate)}</span>
                          </div>
                          {task.estimatedHours && (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium">Estimé:</span>
                              <span>{task.estimatedHours}h</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col items-end gap-2">
                        <select
                          value={task.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task.id, e.target.value as TaskStatus);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border-0 cursor-pointer transition ${
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
                          <option value="TODO">À faire</option>
                          <option value="IN_PROGRESS">En cours</option>
                          <option value="IN_REVIEW">En revue</option>
                          <option value="DONE">Terminé</option>
                          <option value="BLOCKED">Bloqué</option>
                        </select>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
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
                    onClick={() => router.push(`/projects/${project.id}`)}
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
