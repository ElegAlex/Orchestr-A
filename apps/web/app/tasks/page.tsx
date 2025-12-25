'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { tasksService } from '@/services/tasks.service';
import { projectsService } from '@/services/projects.service';
import {
  Task,
  TaskStatus,
  Priority,
  CreateTaskDto,
  Project,
  Role,
  User,
} from '@/types';
import { usersService } from '@/services/users.service';
import { UserMultiSelect } from '@/components/UserMultiSelect';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [orphanTasks, setOrphanTasks] = useState<Task[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'ALL'>(
    'ALL'
  );
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [formData, setFormData] = useState<CreateTaskDto & { assigneeIds: string[] }>({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    projectId: '',
    assigneeIds: [],
    estimatedHours: undefined,
    startDate: '',
    endDate: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch projects
      let projectsData: Project[] = [];
      if (user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE) {
        const response = await projectsService.getAll();
        projectsData = Array.isArray(response.data) ? response.data : [];
      } else if (user?.id) {
        try {
          projectsData = await projectsService.getByUser(user.id);
          projectsData = Array.isArray(projectsData) ? projectsData : [];
        } catch (error: any) {
          projectsData = [];
          if (error.response?.status !== 404) console.error('Error fetching projects:', error);
        }
      }
      setProjects(projectsData);

      // Fetch tasks
      let tasksData: Task[] = [];
      if (user?.id) {
        try {
          tasksData = await tasksService.getByAssignee(user.id);
          tasksData = Array.isArray(tasksData) ? tasksData : [];
        } catch (error: any) {
          tasksData = [];
          if (error.response?.status !== 404) console.error('Error fetching tasks:', error);
        }
      }
      setTasks(tasksData);

      // Fetch orphan tasks (only for admin/responsable/manager)
      if (user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE || user?.role === Role.MANAGER) {
        try {
          const orphans = await tasksService.getOrphans();
          setOrphanTasks(Array.isArray(orphans) ? orphans : []);
        } catch (error: any) {
          setOrphanTasks([]);
          if (error.response?.status !== 404) console.error('Error fetching orphan tasks:', error);
        }
      }

      // Fetch users for assignment
      if (user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE || user?.role === Role.MANAGER) {
        try {
          const usersData = await usersService.getAll();
          setUsers(Array.isArray(usersData) ? usersData : []);
        } catch (error: any) {
          setUsers([]);
          if (error.response?.status !== 404) console.error('Error fetching users:', error);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
      console.error(error);
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
      // Clean up empty strings before sending
      const taskData: CreateTaskDto = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        projectId: formData.projectId || null,
        assigneeIds: formData.assigneeIds.length > 0 ? formData.assigneeIds : undefined,
        estimatedHours: formData.estimatedHours || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      };
      await tasksService.create(taskData);
      toast.success('Tâche créée avec succès');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Erreur lors de la création'
      );
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await tasksService.update(taskId, { status: newStatus });
      toast.success('Statut mis à jour');
      fetchData();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  // Fetch project members when a project is selected in the form
  const handleFormProjectChange = async (projectId: string) => {
    setFormData({ ...formData, projectId, assigneeIds: [] }); // Reset assignees when project changes

    if (projectId) {
      try {
        const project = await projectsService.getById(projectId);
        const members = project.members?.map(m => m.user).filter(Boolean) as User[] || [];
        setProjectMembers(members);
      } catch (error) {
        console.error('Error fetching project members:', error);
        setProjectMembers([]);
      }
    } else {
      setProjectMembers([]);
    }
  };

  // Get available users for assignment (project members if project selected, all users otherwise)
  const getAvailableAssignees = (): User[] => {
    if (formData.projectId && projectMembers.length > 0) {
      return projectMembers;
    }
    return users;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: TaskStatus.TODO,
      priority: Priority.NORMAL,
      projectId: '',
      assigneeIds: [],
      estimatedHours: undefined,
      startDate: '',
      endDate: '',
    });
    setProjectMembers([]);
  };

  const getFilteredTasks = () => {
    let filtered: Task[] = [];

    if (selectedProject === 'ORPHAN') {
      // Show orphan tasks (tasks without project)
      filtered = orphanTasks;
    } else if (selectedProject === 'ALL') {
      // Show all tasks including orphans
      filtered = [...tasks, ...orphanTasks.filter(ot => !tasks.some(t => t.id === ot.id))];
    } else {
      filtered = tasks.filter((t) => t.projectId === selectedProject);
    }

    if (selectedPriority !== 'ALL') {
      filtered = filtered.filter((t) => t.priority === selectedPriority);
    }

    return filtered;
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return getFilteredTasks().filter((t) => t.status === status);
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

  const canCreateTask = () => {
    return (
      user?.role === Role.ADMIN ||
      user?.role === Role.RESPONSABLE ||
      user?.role === Role.MANAGER
    );
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    // Add subtle opacity to dragged element
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
        fetchData();
      } catch (error: any) {
        toast.error('Erreur lors de la mise à jour du statut');
      }
    }

    setDraggedTask(null);
    setIsDragging(false);
  };

  const handleTaskClick = (task: Task) => {
    // Only navigate if not dragging
    if (!isDragging) {
      router.push(`/tasks/${task.id}`);
    }
  };

  const columns: { status: TaskStatus; title: string; color: string }[] = [
    { status: TaskStatus.TODO, title: 'À faire', color: 'bg-gray-100' },
    {
      status: TaskStatus.IN_PROGRESS,
      title: 'En cours',
      color: 'bg-blue-100',
    },
    { status: TaskStatus.IN_REVIEW, title: 'En revue', color: 'bg-yellow-100' },
    { status: TaskStatus.DONE, title: 'Terminé', color: 'bg-green-100' },
    { status: TaskStatus.BLOCKED, title: 'Bloqué', color: 'bg-red-100' },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900">Tâches</h1>
            <p className="text-gray-600 mt-1">
              {getFilteredTasks().length} tâche(s)
            </p>
          </div>
          {canCreateTask() && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <span>+</span>
              <span>Créer une tâche</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <option value="ORPHAN">Taches sans projet</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorité
              </label>
              <select
                value={selectedPriority}
                onChange={(e) =>
                  setSelectedPriority(e.target.value as Priority | 'ALL')
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

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex space-x-4 min-w-max">
            {columns.map((column) => {
              const columnTasks = getTasksByStatus(column.status);
              const isDropTarget = dragOverColumn === column.status;

              return (
                <div
                  key={column.status}
                  className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  {/* Column Header */}
                  <div
                    className={`${column.color} px-4 py-3 rounded-t-lg border-b border-gray-200`}
                  >
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
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-move active:cursor-grabbing select-none"
                          style={{
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Drag Handle */}
                          <div className="flex items-start space-x-2">
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

                              {task.project ? (
                                <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                                  <span>📁</span>
                                  <span className="truncate">
                                    {task.project.name}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2 text-xs text-orange-500 mb-2">
                                  <span>📋</span>
                                  <span>Tache independante</span>
                                </div>
                              )}

                              {/* Affichage des assignés multiples */}
                              {(task.assignees && task.assignees.length > 0) ? (
                                <div className="flex items-center space-x-1 text-xs text-gray-500 mb-2">
                                  <div className="flex -space-x-1">
                                    {task.assignees.slice(0, 3).map((assignment, idx) => (
                                      <div
                                        key={assignment.userId || idx}
                                        className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] border border-white"
                                        title={`${assignment.user?.firstName || ''} ${assignment.user?.lastName || ''}`}
                                      >
                                        {assignment.user?.firstName?.[0] || '?'}
                                        {assignment.user?.lastName?.[0] || ''}
                                      </div>
                                    ))}
                                    {task.assignees.length > 3 && (
                                      <div className="w-5 h-5 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px] border border-white">
                                        +{task.assignees.length - 3}
                                      </div>
                                    )}
                                  </div>
                                  <span className="ml-1">
                                    {task.assignees.length === 1
                                      ? `${task.assignees[0].user?.firstName} ${task.assignees[0].user?.lastName}`
                                      : `${task.assignees.length} assignés`}
                                  </span>
                                </div>
                              ) : task.assignee && (
                                <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                    {task.assignee.firstName[0]}
                                    {task.assignee.lastName[0]}
                                  </div>
                                  <span>
                                    {task.assignee.firstName}{' '}
                                    {task.assignee.lastName}
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

                              {/* Status Change Buttons */}
                              <div className="mt-3 flex space-x-1">
                                {column.status !== TaskStatus.TODO && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const prevIndex = columns.findIndex(
                                        (c) => c.status === column.status
                                      );
                                      if (prevIndex > 0) {
                                        handleStatusChange(
                                          task.id,
                                          columns[prevIndex - 1].status
                                        );
                                      }
                                    }}
                                    className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition"
                                  >
                                    ←
                                  </button>
                                )}
                                {column.status !== TaskStatus.DONE &&
                                  column.status !== TaskStatus.BLOCKED && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextIndex = columns.findIndex(
                                          (c) => c.status === column.status
                                        );
                                        if (nextIndex < columns.length - 2) {
                                          handleStatusChange(
                                            task.id,
                                            columns[nextIndex + 1].status
                                          );
                                        }
                                      }}
                                      className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition"
                                    >
                                      →
                                    </button>
                                  )}
                              </div>
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Créer une tâche
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Développer la page d'accueil"
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
                  placeholder="Description détaillée de la tâche..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projet
                </label>
                <select
                  value={formData.projectId || ''}
                  onChange={(e) => handleFormProjectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Aucun projet (tache independante)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour une tache hors projet (reunion, transverse...)
                </p>
              </div>

              {/* Assignee multi-selector */}
              <UserMultiSelect
                label="Assignés"
                users={getAvailableAssignees()}
                selectedIds={formData.assigneeIds}
                onChange={(ids) => setFormData({ ...formData, assigneeIds: ids })}
                placeholder="Selectionner les assignés"
                hint={
                  formData.projectId && projectMembers.length > 0
                    ? 'Membres du projet'
                    : formData.projectId && projectMembers.length === 0
                    ? 'Aucun membre dans ce projet - tous les utilisateurs sont affichés'
                    : undefined
                }
              />

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
                        status: e.target.value as TaskStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={TaskStatus.TODO}>À faire</option>
                    <option value={TaskStatus.IN_PROGRESS}>En cours</option>
                    <option value={TaskStatus.IN_REVIEW}>En revue</option>
                    <option value={TaskStatus.DONE}>Terminé</option>
                    <option value={TaskStatus.BLOCKED}>Bloqué</option>
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
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      const currentEndDate = formData.endDate;
                      const newEndDate = (!currentEndDate || currentEndDate < newStartDate)
                        ? newStartDate
                        : currentEndDate;
                      setFormData({ ...formData, startDate: newStartDate, endDate: newEndDate });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimation (heures)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimatedHours || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimatedHours: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 8"
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
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </MainLayout>
  );
}
