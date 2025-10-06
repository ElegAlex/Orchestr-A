import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Alert,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { TasksByUrgency } from '../../services/dashboard-hub-v2.service';
import TaskCardWithTimeEntry from '../project/TaskCardWithTimeEntry';
import { Task } from '../../types';

interface MyTasksWidgetProps {
  tasksByUrgency: TasksByUrgency;
  loading?: boolean;
  onTaskUpdate?: () => void;
}

const TASKS_PER_PAGE = 5;

interface CategoryState {
  expanded: boolean;
  currentPage: number;
}

export const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({
  tasksByUrgency,
  loading = false,
  onTaskUpdate,
}) => {
  const navigate = useNavigate();

  // États de pagination et expansion par catégorie
  const [overdueState, setOverdueState] = useState<CategoryState>({ expanded: true, currentPage: 0 });
  const [dueSoonState, setDueSoonState] = useState<CategoryState>({ expanded: true, currentPage: 0 });
  const [inProgressState, setInProgressState] = useState<CategoryState>({ expanded: true, currentPage: 0 });
  const [todoState, setTodoState] = useState<CategoryState>({ expanded: false, currentPage: 0 });
  const [blockedState, setBlockedState] = useState<CategoryState>({ expanded: true, currentPage: 0 });

  // Fonction utilitaire pour gérer la pagination
  const getPaginatedTasks = (tasks: Task[], currentPage: number) => {
    const startIndex = currentPage * TASKS_PER_PAGE;
    const endIndex = startIndex + TASKS_PER_PAGE;
    return {
      tasks: tasks.slice(startIndex, endIndex),
      totalPages: Math.ceil(tasks.length / TASKS_PER_PAGE),
      hasMore: tasks.length > endIndex,
    };
  };

  // Composant pour une catégorie de tâches
  const TaskCategory: React.FC<{
    title: string;
    tasks: Task[];
    color: 'error' | 'warning' | 'info' | 'default';
    icon: React.ReactElement;
    state: CategoryState;
    setState: React.Dispatch<React.SetStateAction<CategoryState>>;
  }> = ({ title, tasks, color, icon, state, setState }) => {
    const { tasks: paginatedTasks, totalPages, hasMore } = getPaginatedTasks(tasks, state.currentPage);

    if (tasks.length === 0) return null;

    return (
      <Box>
        {/* En-tête catégorie */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            py: 1,
            px: 1.5,
            bgcolor: `${color}.50`,
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: `${color}.100`,
            },
          }}
          onClick={() => setState({ ...state, expanded: !state.expanded })}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            {icon}
            <Typography variant="subtitle2" fontWeight="600">
              {title}
            </Typography>
            <Chip
              label={tasks.length}
              size="small"
              color={color}
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          </Stack>
          <IconButton size="small">
            {state.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        {/* Liste des tâches */}
        <Collapse in={state.expanded} timeout="auto">
          <Stack spacing={1} sx={{ mt: 1, mb: 2 }}>
            {paginatedTasks.map((task) => (
              <TaskCardWithTimeEntry
                key={task.id}
                task={task}
                onUpdate={onTaskUpdate}
                compact={true}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  px: 2,
                  py: 1,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                }}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (state.currentPage > 0) {
                      setState({ ...state, currentPage: state.currentPage - 1 });
                    }
                  }}
                  disabled={state.currentPage === 0}
                >
                  <ChevronLeftIcon />
                </IconButton>

                <Typography variant="caption" color="text.secondary">
                  {state.currentPage * TASKS_PER_PAGE + 1} - {Math.min((state.currentPage + 1) * TASKS_PER_PAGE, tasks.length)} sur {tasks.length}
                </Typography>

                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (state.currentPage < totalPages - 1) {
                      setState({ ...state, currentPage: state.currentPage + 1 });
                    }
                  }}
                  disabled={state.currentPage >= totalPages - 1}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Stack>
            )}
          </Stack>
        </Collapse>
      </Box>
    );
  };

  // Calcul du total de tâches
  const totalTasks =
    tasksByUrgency.overdue.length +
    tasksByUrgency.dueSoon.length +
    tasksByUrgency.inProgress.length +
    tasksByUrgency.todo.length +
    tasksByUrgency.blocked.length;

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🚨 Mes Tâches
          </Typography>
          <Alert severity="info">Chargement...</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* En-tête */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="600">
            🚨 Mes Tâches
          </Typography>
          <Chip
            label={`${totalTasks} tâche${totalTasks > 1 ? 's' : ''}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        <Typography variant="caption" color="text.secondary" mb={2}>
          Tâches où vous êtes Responsable (R du RACI)
        </Typography>

        {/* Liste des tâches par catégorie */}
        {totalTasks === 0 ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Aucune tâche en cours ou à faire. Bravo ! 🎉
          </Alert>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {/* En retard */}
            <TaskCategory
              title="EN RETARD"
              tasks={tasksByUrgency.overdue}
              color="error"
              icon={<WarningIcon sx={{ fontSize: 18, color: 'error.main' }} />}
              state={overdueState}
              setState={setOverdueState}
            />

            {/* Échéance proche */}
            <TaskCategory
              title="ÉCHÉANCE PROCHE"
              tasks={tasksByUrgency.dueSoon}
              color="warning"
              icon={<ScheduleIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
              state={dueSoonState}
              setState={setDueSoonState}
            />

            {/* Bloquées */}
            <TaskCategory
              title="BLOQUÉES"
              tasks={tasksByUrgency.blocked}
              color="error"
              icon={<WarningIcon sx={{ fontSize: 18, color: 'error.main' }} />}
              state={blockedState}
              setState={setBlockedState}
            />

            {/* En cours */}
            <TaskCategory
              title="EN COURS"
              tasks={tasksByUrgency.inProgress}
              color="info"
              icon={<AssignmentIcon sx={{ fontSize: 18, color: 'info.main' }} />}
              state={inProgressState}
              setState={setInProgressState}
            />

            {/* À faire */}
            <TaskCategory
              title="À FAIRE"
              tasks={tasksByUrgency.todo}
              color="default"
              icon={<AssignmentIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
              state={todoState}
              setState={setTodoState}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MyTasksWidget;
