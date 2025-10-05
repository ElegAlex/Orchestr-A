import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { Task, TaskStatus, User } from '../types';
import { taskService } from '../services/task.service';
import { userService } from '../services/user.service';
import { TaskFilters, TaskFilterState } from '../components/tasks/TaskFilters';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import { TaskCard } from '../components/kanban/TaskCard';
import { TaskModalSimplified as TaskModal } from '../components/tasks/TaskModalSimplified';

const TASK_STATUSES: { [key in TaskStatus]: { label: string; color: string } } = {
  BACKLOG: { label: 'Backlog', color: '#9e9e9e' },
  TODO: { label: 'À faire', color: '#2196f3' },
  IN_PROGRESS: { label: 'En cours', color: '#ff9800' },
  DONE: { label: 'Terminé', color: '#4caf50' },
  BLOCKED: { label: 'Bloqué', color: '#f44336' },
};

export const Tasks: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('project');
  
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
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
      const tasks = projectId 
        ? await taskService.getTasksByProject(projectId)
        : await taskService.getTasks();
      
      setAllTasks(tasks);
      
      const grouped = tasks.reduce((acc, task) => {
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
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [projectId]);

  const loadUsers = useCallback(async () => {
    try {
      const users = await userService.getAllUsers();
      setUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadTasks(),
          loadUsers()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [loadTasks, loadUsers]);

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
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('view', mode);
    setSearchParams(newSearchParams);
  };

  const handleFiltersChange = (filters: Partial<TaskFilterState>) => {
    setCurrentFilters(filters);
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
    setAnchorEl(null); // Fermer le menu sans réinitialiser contextTask
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
    await loadTasks();
    setTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskDeleteFromModal = async (taskId: string) => {
    try {
      console.log('📋 Tasks.tsx - Tentative de suppression de la tâche:', taskId);
      
      if (!taskId || taskId.trim() === '') {
        console.error('❌ ID de tâche invalide:', taskId);
        alert('Erreur: ID de tâche invalide');
        return;
      }
      
      await taskService.deleteTask(taskId);
      await loadTasks();
      setTaskModalOpen(false);
      setSelectedTask(null);
      console.log('✅ Tâche supprimée avec succès');
    } catch (error: any) {
      console.error('❌ Erreur lors de la suppression de la tâche:', error);
      alert(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`);
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

  if (loading) {
    return (
      <Backdrop open={loading} sx={{ zIndex: 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Tâches</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={viewMode === 'kanban' ? 'contained' : 'outlined'}
            onClick={() => handleViewModeChange('kanban')}
          >
            Vue Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'contained' : 'outlined'}
            onClick={() => handleViewModeChange('list')}
          >
            Vue Liste
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTask}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Nouvelle Tâche
          </Button>
        </Box>
      </Box>

      {/* Filtres */}
      <Box sx={{ mb: 3 }}>
        <TaskFilters
          users={users}
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
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
                Aucune tâche trouvée
              </Typography>
              <Typography variant="body2">
                Ajustez les filtres ou créez une nouvelle tâche
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
        projectId={projectId || undefined}
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
      <Dialog open={deleteDialogOpen} onClose={() => {
        setDeleteDialogOpen(false);
        setContextTask(null);
      }}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer la tâche "{contextTask?.title}" ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialogOpen(false);
            setContextTask(null);
          }}>Annuler</Button>
          <Button onClick={confirmDeleteTask} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};