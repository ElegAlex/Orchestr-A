import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Avatar,
  Stack,
  LinearProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Block as BlockIcon,
  Assignment as AssignmentIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { Task } from '../../types';
import { taskService } from '../../services/task.service';
import { format, isAfter, isBefore, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjectTimelineProps {
  projectId: string;
}

type TimelineFilter = 'all' | 'week' | 'month' | 'quarter';

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineFilter>('month');

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const projectTasks = await taskService.getTasksByProject(projectId);
      // Trier par date de création puis par date d'échéance
      const sortedTasks = projectTasks.sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          return dateA - dateB;
        }
        const dateA = new Date(b.createdAt).getTime();
        const dateB = new Date(a.createdAt).getTime();
        return dateA - dateB;
      });
      setTasks(sortedTasks);
    } catch (error) {
      console.error('Erreur lors du chargement des tâches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTasks = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (filter) {
      case 'week':
        startDate = subDays(now, 7);
        break;
      case 'month':
        startDate = subDays(now, 30);
        break;
      case 'quarter':
        startDate = subDays(now, 90);
        break;
      default:
        return tasks;
    }

    return tasks.filter(task => {
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        return isAfter(dueDate, startDate) || isAfter(addDays(dueDate, 30), now);
      }
      return isAfter(new Date(task.createdAt), startDate);
    });
  };

  const getTaskIcon = (task: Task) => {
    switch (task.status) {
      case 'DONE':
        return <CheckCircleIcon color="success" />;
      case 'IN_PROGRESS':
        return <PlayArrowIcon color="warning" />;
      case 'BLOCKED':
        return <BlockIcon color="error" />;
      default:
        return <ScheduleIcon color="info" />;
    }
  };

  const getTaskColor = (task: Task) => {
    switch (task.status) {
      case 'DONE':
        return 'success';
      case 'IN_PROGRESS':
        return 'warning';
      case 'BLOCKED':
        return 'error';
      default:
        return 'grey';
    }
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    return isAfter(new Date(), new Date(task.dueDate)) && task.status !== 'DONE';
  };

  const getDaysUntilDue = (task: Task) => {
    if (!task.dueDate) return null;
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProjectProgress = () => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(t => t.status === 'DONE').length;
    return (completedTasks / tasks.length) * 100;
  };

  const filteredTasks = getFilteredTasks();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header avec progression */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Progression du projet
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Période</InputLabel>
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value as TimelineFilter)}
                label="Période"
              >
                <MenuItem value="all">Tout</MenuItem>
                <MenuItem value="week">7 jours</MenuItem>
                <MenuItem value="month">30 jours</MenuItem>
                <MenuItem value="quarter">90 jours</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <TrendingUpIcon color="primary" />
            <Box flexGrow={1}>
              <Typography variant="body2" color="text.secondary">
                {Math.round(getProjectProgress())}% des tâches terminées
              </Typography>
              <LinearProgress
                variant="determinate"
                value={getProjectProgress()}
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>

          <Stack direction="row" spacing={2}>
            <Chip 
              label={`${tasks.filter(t => t.status === 'DONE').length} Terminées`}
              color="success"
              size="small"
            />
            <Chip 
              label={`${tasks.filter(t => t.status === 'IN_PROGRESS').length} En cours`}
              color="warning"
              size="small"
            />
            <Chip 
              label={`${tasks.filter(t => isOverdue(t)).length} En retard`}
              color="error"
              size="small"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Timeline */}
      {filteredTasks.length === 0 ? (
        <Alert severity="info">
          Aucune tâche trouvée pour la période sélectionnée.
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <List>
              {filteredTasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      {getTaskIcon(task)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="h6">{task.title}</Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip
                              label={task.status.replace('_', ' ')}
                              size="small"
                              color={getTaskColor(task) as any}
                            />
                            <Chip
                              label={task.priority}
                              size="small"
                              color={task.priority === 'P0' ? 'error' : 
                                     task.priority === 'P1' ? 'warning' : 'default'}
                            />
                          </Stack>
                        </Box>
                      }
                      secondary={
                        <Box>
                          {task.description && (
                            <Typography variant="body2" color="text.secondary" mb={1}>
                              {task.description}
                            </Typography>
                          )}
                          <Box display="flex" alignItems="center" gap={2}>
                            <Typography variant="caption" color="text.secondary">
                              Créée le {format(new Date(task.createdAt), 'dd/MM/yyyy', { locale: fr })}
                            </Typography>
                            {task.dueDate && (
                              <Typography 
                                variant="caption" 
                                color={isOverdue(task) ? 'error.main' : 'text.secondary'}
                              >
                                Échéance: {format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: fr })}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < filteredTasks.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ProjectTimeline;