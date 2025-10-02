import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Task, TaskStatus, User, Milestone } from '../../types';
import { taskService } from '../../services/task.service';
import { userService } from '../../services/user.service';
import { milestoneService } from '../../services/milestone.service';
import { TaskFilters, TaskFilterState } from '../tasks/TaskFilters';
import { KanbanColumn } from '../kanban/KanbanColumn';
import { TaskCard } from '../kanban/TaskCard';
import { TaskModalSimplified as TaskModal } from '../tasks/TaskModalSimplified';

console.log('📦 ProjectTasks.tsx file loaded at', new Date().toISOString());

const TASK_STATUSES: { [key in TaskStatus]: { label: string; color: string } } = {
  BACKLOG: { label: 'Backlog', color: '#9e9e9e' },
  TODO: { label: 'À faire', color: '#2196f3' },
  IN_PROGRESS: { label: 'En cours', color: '#ff9800' },
  DONE: { label: 'Terminé', color: '#4caf50' },
  BLOCKED: { label: 'Bloqué', color: '#f44336' },
};

interface ProjectTasksProps {
  projectId: string;
}

const ProjectTasks: React.FC<ProjectTasksProps> = ({ projectId }) => {
  console.log('🚀 ProjectTasks component loaded');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  const [kanbanTasks, setKanbanTasks] = useState<{ [key in TaskStatus]: Task[] }>({
    BACKLOG: [],
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
    BLOCKED: [],
  });
  
  // États pour TaskModal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // États du menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [contextTask, setContextTask] = useState<Task | null>(null);
  
  // États drag and drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // États pour filtres et sélection
  const [currentFilters, setCurrentFilters] = useState<Partial<TaskFilterState>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await taskService.getTasksByProject(projectId);

      // Vérification des tâches récupérées
      tasks.forEach((task, index) => {
        if (!task.id || task.id === '') {
          console.error(`❌ Task at index ${index} has no ID:`, task);
        }
      });

      setAllTasks(tasks);

      // Appliquer les filtres actuels aux nouvelles tâches
      applyFilters(tasks, currentFilters);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [projectId, currentFilters]);

  const loadUsers = useCallback(async () => {
    try {
      const users = await userService.getAllUsers();
      setUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  const loadMilestones = useCallback(async () => {
    try {
      const projectMilestones = await milestoneService.getMilestonesByProject(projectId);
      setMilestones(projectMilestones);
    } catch (error) {
      console.error('Error loading milestones:', error);
    }
  }, [projectId]);

  // Chargement initial
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadTasks(),
          loadUsers(),
          loadMilestones()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [loadTasks, loadUsers, loadMilestones]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    const task = Object.values(kanbanTasks).flat().find(t => t.id === id);
    setActiveId(id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Vérification de l'ID de la tâche
    if (!taskId || taskId === '') {
      console.error('❌ Task ID is empty or invalid:', taskId);
      return;
    }

    let newStatus: TaskStatus | null = null;
    
    if (Object.keys(TASK_STATUSES).includes(overId)) {
      newStatus = overId as TaskStatus;
    } else {
      const targetTask = Object.values(kanbanTasks).flat().find(t => t.id === overId);
      if (targetTask) {
        newStatus = targetTask.status;
      }
    }

    if (!newStatus) return;

    const sourceTask = Object.values(kanbanTasks).flat().find(t => t.id === taskId);
    if (!sourceTask || sourceTask.status === newStatus) return;

    const originalStatus = sourceTask.status;

    // Mise à jour optimiste
    setKanbanTasks(prev => {
      const updated = { ...prev };
      updated[originalStatus] = prev[originalStatus].filter(t => t.id !== taskId);
      updated[newStatus as TaskStatus] = [...prev[newStatus as TaskStatus], { ...sourceTask, status: newStatus as TaskStatus }];
      return updated;
    });

    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      
      // Mise à jour directe de la complétion du jalon si la tâche en fait partie
      const updatedTask = allTasks.find(t => t.id === taskId);
      if (updatedTask?.milestoneId) {
        const { milestoneService } = await import('../../services/milestone.service');
        await milestoneService.updateMilestoneCompletion(updatedTask.milestoneId);
      }
      
      setAllTasks(prevAllTasks => 
        prevAllTasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus as TaskStatus } : task
        )
      );
    } catch (error) {
      console.error('Error updating task status:', error);
      
      setKanbanTasks(prev => {
        const updated = { ...prev };
        updated[newStatus as TaskStatus] = prev[newStatus as TaskStatus].filter(t => t.id !== taskId);
        updated[originalStatus] = [...prev[originalStatus], sourceTask];
        return updated;
      });
    }
  };

  const handleViewModeChange = (mode: 'kanban' | 'list') => {
    setViewMode(mode);
  };

  const handleFiltersChange = (filters: Partial<TaskFilterState>) => {
    setCurrentFilters(filters);
    applyFilters(allTasks, filters);
  };

  const applyFilters = (tasks: Task[], filters: Partial<TaskFilterState>) => {
    let filteredTasks = [...tasks];

    // Filtrer par terme de recherche
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm) ||
        task.description.toLowerCase().includes(searchTerm) ||
        (task.code && task.code.toLowerCase().includes(searchTerm))
      );
    }

    // Filtrer par statuts
    if (filters.status && filters.status.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        filters.status!.includes(task.status)
      );
    }

    // Filtrer par priorités
    if (filters.priority && filters.priority.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        filters.priority!.includes(task.priority)
      );
    }

    // Filtrer par types
    if (filters.type && filters.type.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        filters.type!.includes(task.type)
      );
    }

    // Filtrer par assignés
    if (filters.assigneeIds && filters.assigneeIds.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.responsible && task.responsible.some(id =>
          filters.assigneeIds!.includes(id)
        )
      );
    }

    // Filtrer par jalons
    if (filters.milestoneIds && filters.milestoneIds.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.milestoneId && filters.milestoneIds!.includes(task.milestoneId)
      );
    }

    // Filtrer par labels
    if (filters.labels && filters.labels.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.labels.some(label => filters.labels!.includes(label))
      );
    }

    // Filtrer par tâches bloquées
    if (filters.isBlocked) {
      filteredTasks = filteredTasks.filter(task => task.isBlocked);
    }

    // Filtrer par dette technique
    if (filters.technicalDebt) {
      filteredTasks = filteredTasks.filter(task => task.technicalDebt);
    }

    // Filtrer par pièces jointes
    if (filters.hasAttachments) {
      filteredTasks = filteredTasks.filter(task =>
        task.attachments && task.attachments.length > 0
      );
    }

    // Filtrer par commentaires
    if (filters.hasComments) {
      filteredTasks = filteredTasks.filter(task =>
        task.comments && task.comments.length > 0
      );
    }

    // Regrouper les tâches filtrées par statut
    const grouped = filteredTasks.reduce((acc, task) => {
      if (acc[task.status]) {
        acc[task.status].push(task);
      }
      return acc;
    }, {
      BACKLOG: [] as Task[],
      TODO: [] as Task[],
      IN_PROGRESS: [] as Task[],
      DONE: [] as Task[],
      BLOCKED: [] as Task[],
    });

    setKanbanTasks(grouped);
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setTaskModalOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, task: Task) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setContextTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setContextTask(null);
  };

  const handleEditTask = () => {
    if (contextTask) {
      setSelectedTask(contextTask);
      setTaskModalOpen(true);
    }
    handleMenuClose();
  };

  const handleDeleteTask = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDeleteTask = async () => {
    if (contextTask) {
      try {
        await taskService.deleteTask(contextTask.id);
        await loadTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
    setDeleteDialogOpen(false);
    setContextTask(null);
  };

  const handleTaskSave = async (task: Task) => {
    try {
      // Mettre à jour la liste locale avec la tâche mise à jour
      setAllTasks(prevTasks => {
        const isNewTask = !prevTasks.find(t => t.id === task.id);
        if (isNewTask) {
          return [...prevTasks, task];
        } else {
          return prevTasks.map(t => t.id === task.id ? task : t);
        }
      });

      // Mettre à jour aussi les tâches du kanban
      setKanbanTasks(prevKanban => {
        const updated = { ...prevKanban };
        
        // Supprimer la tâche de toutes les colonnes
        Object.keys(updated).forEach(status => {
          updated[status as TaskStatus] = updated[status as TaskStatus].filter(t => t.id !== task.id);
        });
        
        // Ajouter la tâche dans la bonne colonne
        updated[task.status].push(task);
        
        return updated;
      });

      setTaskModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error handling task save:', error);
      // En cas d'erreur, recharger les données
      await loadTasks();
    }
  };

  const handleTaskDeleteFromModal = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      await loadTasks();
      setTaskModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error; // Re-throw pour que TaskModal puisse afficher l'erreur
    }
  };

  const handleTaskSelection = (taskId: string, selected: boolean) => {
    const newSelection = new Set(selectedTaskIds);
    if (selected) {
      newSelection.add(taskId);
    } else {
      newSelection.delete(taskId);
    }
    setSelectedTaskIds(newSelection);
  };

  // Statistiques du projet
  const getTaskStats = () => {
    const stats = {
      total: allTasks.length,
      completed: allTasks.filter(t => t.status === 'DONE').length,
      inProgress: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
      blocked: allTasks.filter(t => t.status === 'BLOCKED').length,
      todo: allTasks.filter(t => t.status === 'TODO').length,
    };
    
    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    
    return { ...stats, completionRate };
  };

  const stats = getTaskStats();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header avec stats */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Tâches du projet ({stats.total})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {stats.completionRate}% terminé • {stats.inProgress} en cours • {stats.blocked} bloquée(s)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant={viewMode === 'kanban' ? 'contained' : 'outlined'}
            onClick={() => handleViewModeChange('kanban')}
          >
            Kanban
          </Button>
          <Button
            size="small"
            variant={viewMode === 'list' ? 'contained' : 'outlined'}
            onClick={() => handleViewModeChange('list')}
          >
            Liste
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTask}
          >
            Nouvelle Tâche
          </Button>
        </Box>
      </Box>

      {/* Filtres */}
      <Box sx={{ mb: 2 }}>
        <TaskFilters
          users={users}
          milestones={milestones}
          onFiltersChange={handleFiltersChange}
        />
      </Box>

      {/* Contenu */}
      {viewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, flexGrow: 1 }}>
            {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={kanbanTasks[status]}
                onTaskClick={handleTaskClick}
                onMenuClick={handleMenuClick}
                selectedTaskIds={selectedTaskIds}
                onSelectionChange={handleTaskSelection}
              />
            ))}
          </Box>
          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                index={0}
                onTaskClick={() => {}}
                onMenuClick={(e) => {}}
                isSelected={false}
                onSelectionChange={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1, maxHeight: '60vh', overflow: 'auto' }}>
          {Object.values(kanbanTasks).flat().map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              onTaskClick={() => handleTaskClick(task)}
              onMenuClick={(e) => handleMenuClick(e, task)}
              isSelected={selectedTaskIds.has(task.id)}
              onSelectionChange={handleTaskSelection}
            />
          ))}
          {Object.values(kanbanTasks).flat().length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="h6" gutterBottom>
                Aucune tâche dans ce projet
              </Typography>
              <Typography variant="body2">
                Créez la première tâche pour commencer !
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Modal de tâche */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleTaskSave}
        onDelete={handleTaskDeleteFromModal}
        task={selectedTask}
        projectId={projectId}
      />

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditTask}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Modifier
        </MenuItem>
        <MenuItem onClick={handleDeleteTask} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer la tâche "{contextTask?.title}" ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={confirmDeleteTask} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectTasks;