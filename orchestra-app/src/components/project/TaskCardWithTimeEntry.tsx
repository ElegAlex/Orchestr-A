import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Stack,
  IconButton,
  Collapse,
  TextField,
  Button,
  Avatar,
  Tooltip,
  Divider,
  LinearProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccessTime as AccessTimeIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Block as BlockIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  AccountTree as SubtaskIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Task, TaskStatus, TimeEntry } from '../../types';
import { taskService } from '../../services/task.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSubtasks } from '../../hooks/useSubtasks';

interface TaskCardWithTimeEntryProps {
  task: Task;
  onUpdate?: () => void;
  onEdit?: (task: Task) => void;
  compact?: boolean;
}

const TaskCardWithTimeEntry: React.FC<TaskCardWithTimeEntryProps> = ({
  task,
  onUpdate,
  onEdit,
  compact = false,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [timeExpanded, setTimeExpanded] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [newTimeHours, setNewTimeHours] = useState('');
  const [newTimeDescription, setNewTimeDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  // Gestion des sous-tâches
  const { subtasks, updateSubtask, stats } = useSubtasks(task.id);

  useEffect(() => {
    if (timeExpanded) {
      loadTimeEntries();
    }
  }, [timeExpanded, task.id]);

  const loadTimeEntries = async () => {
    try {
      const entries = await taskService.getTimeEntries(task.id);
      // Filtrer et valider les entrées
      const validEntries = (entries || []).filter(entry =>
        entry &&
        typeof entry === 'object' &&
        entry.id &&
        typeof entry.hours === 'number' &&
        !isNaN(entry.hours)
      );
      setTimeEntries(validEntries);
    } catch (err) {
      console.error('Erreur lors du chargement des entrées de temps:', err);
      setError('Impossible de charger les entrées de temps');
      setTimeEntries([]); // Réinitialiser en cas d'erreur
    }
  };

  const handleTimeSubmit = async () => {
    if (!newTimeHours || !user) return;

    try {
      setLoading(true);
      setError(null);

      const hours = parseFloat(newTimeHours);
      if (isNaN(hours) || hours <= 0) {
        setError('Veuillez saisir un nombre d\'heures valide');
        return;
      }

      const timeEntry: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        taskId: task.id,
        userId: user.id,
        hours,
        description: newTimeDescription,
        date: new Date(),
      };

      await taskService.logTime(task.id, timeEntry);

      // Réinitialiser le formulaire
      setNewTimeHours('');
      setNewTimeDescription('');

      // Recharger les entrées de temps
      await loadTimeEntries();

      // Notifier la mise à jour
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement du temps:', err);
      setError('Impossible d\'enregistrer le temps');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (statusChanging) return;

    try {
      setStatusChanging(true);
      await taskService.updateTask(task.id, { status: newStatus });
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Erreur lors du changement de statut:', err);
      setError('Impossible de changer le statut de la tâche');
    } finally {
      setStatusChanging(false);
    }
  };

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return {
          label: 'À faire',
          color: '#2196f3',
          icon: <AssignmentIcon />,
        };
      case 'IN_PROGRESS':
        return {
          label: 'En cours',
          color: '#ff9800',
          icon: <PlayArrowIcon />,
        };
      case 'DONE':
        return {
          label: 'Terminé',
          color: '#4caf50',
          icon: <CheckCircleIcon />,
        };
      case 'BLOCKED':
        return {
          label: 'Bloqué',
          color: '#f44336',
          icon: <BlockIcon />,
        };
      default:
        return {
          label: 'Backlog',
          color: '#9e9e9e',
          icon: <PauseIcon />,
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const totalHours = timeEntries.reduce((sum, entry) => {
    const hours = (typeof entry.hours === 'number' && !isNaN(entry.hours)) ? entry.hours : 0;
    return sum + hours;
  }, 0);
  const isAssignedToCurrentUser = task.responsible?.includes(user?.id || '') || false;
  const hasSubtasks = stats.total > 0;

  // Vérifier si la tâche est en retard
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <Card
      variant="outlined"
      sx={{
        transition: 'all 0.2s ease',
        borderLeft: isOverdue ? '4px solid #d32f2f' : undefined,
        backgroundColor: isOverdue ? 'rgba(211, 47, 47, 0.05)' : undefined,
        '&:hover': {
          borderColor: isOverdue ? '#d32f2f' : statusConfig.color,
          boxShadow: 1,
        },
      }}
    >
      <CardContent sx={{ py: compact ? 1 : 2, px: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1 : 2 } }}>
        {/* Header de la tâche */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} mb={compact ? 0.5 : 1}>
          <Box flex={1}>
            <Typography variant={compact ? "body2" : "subtitle2"} fontWeight="bold" gutterBottom={!compact}>
              {task.title}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" mb={compact ? 0.5 : 1}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  disabled={statusChanging}
                  sx={{
                    fontSize: '0.75rem',
                    height: 32,
                    backgroundColor: `${statusConfig.color}20`,
                    color: statusConfig.color,
                    fontWeight: 'bold',
                    '& .MuiSelect-select': {
                      paddingY: 0.5,
                      paddingX: 1,
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      border: `1px solid ${statusConfig.color}`,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      border: `1px solid ${statusConfig.color}`,
                    },
                  }}
                  renderValue={(value) => (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {getStatusConfig(value as TaskStatus).icon}
                      <span>{getStatusConfig(value as TaskStatus).label}</span>
                    </Stack>
                  )}
                >
                  <MenuItem value="TODO">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <AssignmentIcon sx={{ fontSize: 18, color: '#2196f3' }} />
                      <span>À faire</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="IN_PROGRESS">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PlayArrowIcon sx={{ fontSize: 18, color: '#1976d2' }} />
                      <span>En cours</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="DONE">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#388e3c' }} />
                      <span>Terminé</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>

              {task.priority && (
                <Chip
                  label={task.priority}
                  size="small"
                  variant="outlined"
                />
              )}

              {/* Date d'échéance */}
              {task.dueDate && (() => {
                const dueDate = new Date(task.dueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue = dueDate < today && task.status !== 'DONE';
                const isToday = dueDate.toDateString() === today.toDateString();
                const isTomorrow = dueDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();

                return (
                  <Chip
                    icon={<AccessTimeIcon />}
                    label={
                      isToday ? 'Aujourd\'hui' :
                      isTomorrow ? 'Demain' :
                      format(dueDate, 'dd/MM/yyyy', { locale: fr })
                    }
                    size="small"
                    color={isOverdue ? 'error' : isToday ? 'warning' : 'default'}
                    variant={isOverdue ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: isOverdue || isToday ? 'bold' : 'normal',
                    }}
                  />
                );
              })()}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {/* Bouton d'édition */}
            {onEdit && (
              <Tooltip title="Modifier la tâche">
                <IconButton
                  size="small"
                  onClick={() => onEdit(task)}
                  sx={{
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: 'primary.50',
                    },
                  }}
                >
                  <EditIcon fontSize={compact ? 'inherit' : 'small'} />
                </IconButton>
              </Tooltip>
            )}

            {/* Avatar de l'assigné - plus petit en mode compact */}
            {task.responsible && task.responsible.length > 0 && (
              <Tooltip title="Assigné">
                <Avatar sx={{
                  width: compact ? 24 : 32,
                  height: compact ? 24 : 32,
                  bgcolor: 'primary.main',
                  fontSize: compact ? '0.75rem' : '1rem'
                }}>
                  <PersonIcon fontSize={compact ? 'inherit' : 'small'} />
                </Avatar>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Description (seulement si pas compact) */}
        {!compact && task.description && (
          <Typography variant="body2" color="text.secondary" paragraph>
            {task.description}
          </Typography>
        )}

        {/* Section sous-tâches */}
        {hasSubtasks && (
          <Box sx={{ mb: 1 }}>
            <Box
              sx={{
                bgcolor: compact ? 'transparent' : 'primary.50',
                borderRadius: compact ? 0 : 1,
                p: compact ? 0.5 : 1,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                border: compact ? '1px solid' : 'none',
                borderColor: compact ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: compact ? 'primary.100' : 'primary.100',
                },
              }}
              onClick={() => setSubtasksExpanded(!subtasksExpanded)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={compact ? 0.5 : 1}>
                  <SubtaskIcon fontSize={compact ? 'inherit' : 'small'} sx={{ color: 'primary.main' }} />
                  <Typography variant={compact ? "caption" : "body2"} color="primary.main" fontWeight="bold">
                    Sous-tâches {stats.completed}/{stats.total} ({stats.percentage}%)
                  </Typography>
                </Stack>

                <IconButton
                  size="small"
                  sx={{
                    transform: subtasksExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s',
                    p: compact ? 0.25 : 0.5,
                    color: 'primary.main',
                  }}
                >
                  <ExpandMoreIcon fontSize={compact ? 'inherit' : 'small'} />
                </IconButton>
              </Stack>
            </Box>

            {/* Liste des sous-tâches */}
            <Collapse in={subtasksExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ mt: compact ? 0.5 : 1, ml: compact ? 1 : 2 }}>
                <Stack spacing={compact ? 0.5 : 1}>
                  {subtasks.map((subtask) => (
                    <Stack
                      key={subtask.id}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        py: compact ? 0.25 : 0.5,
                        px: compact ? 0.5 : 1,
                        borderRadius: 1,
                        bgcolor: subtask.status === 'DONE' ? 'success.50' : 'background.paper',
                        border: '1px solid',
                        borderColor: subtask.status === 'DONE' ? 'success.main' : 'divider',
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ p: 0.5 }}
                        onClick={() => updateSubtask(subtask.id, {
                          status: subtask.status === 'DONE' ? 'TODO' : 'DONE'
                        })}
                      >
                        {subtask.status === 'DONE' ? (
                          <CheckBoxIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        ) : (
                          <CheckBoxOutlineBlankIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                        )}
                      </IconButton>
                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1,
                          textDecoration: subtask.status === 'DONE' ? 'line-through' : 'none',
                          color: subtask.status === 'DONE' ? 'text.secondary' : 'text.primary',
                        }}
                      >
                        {subtask.title}
                      </Typography>
                      <Chip
                        label={subtask.status === 'DONE' ? 'Terminée' : 'En cours'}
                        size="small"
                        color={subtask.status === 'DONE' ? 'success' : 'default'}
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Section temps et contributeurs - optimisée pour compact */}
        <Box
          sx={{
            bgcolor: compact ? 'transparent' : 'grey.50',
            borderRadius: compact ? 0 : 1,
            p: compact ? 0.5 : 1.5,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            border: compact ? '1px solid' : 'none',
            borderColor: compact ? 'divider' : 'transparent',
            '&:hover': {
              bgcolor: compact ? 'action.hover' : 'grey.100',
            },
          }}
          onClick={() => setTimeExpanded(!timeExpanded)}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={compact ? 0.5 : 1}>
              <AccessTimeIcon fontSize={compact ? 'inherit' : 'small'} color="action" />
              <Typography variant={compact ? "caption" : "body2"} color="text.secondary">
                {totalHours > 0 ? `${totalHours}h` : 'Temps'}
              </Typography>
              {isAssignedToCurrentUser && (
                <Chip
                  label="Vous"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{
                    height: compact ? 20 : 24,
                    fontSize: compact ? '0.65rem' : '0.75rem',
                    '& .MuiChip-label': {
                      px: compact ? 0.5 : 1
                    }
                  }}
                />
              )}
            </Stack>

            <IconButton
              size="small"
              sx={{
                transform: timeExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s',
                p: compact ? 0.25 : 0.5,
              }}
            >
              <ExpandMoreIcon fontSize={compact ? 'inherit' : 'small'} />
            </IconButton>
          </Stack>
        </Box>

        {/* Section de déclaration de temps déployable */}
        <Collapse in={timeExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: compact ? 1 : 2 }}>
            <Divider sx={{ mb: compact ? 1 : 2 }} />

            {/* Total des temps déclarés */}
            {timeEntries.length > 0 && (
              <Box mb={compact ? 1 : 2}>
                <Typography variant={compact ? "caption" : "subtitle2"} gutterBottom>
                  Total temps déclaré : {totalHours}h
                </Typography>
              </Box>
            )}

            {/* Formulaire de déclaration de temps */}
            {isAssignedToCurrentUser && (
              <Box>
                <Typography variant={compact ? "caption" : "subtitle2"} gutterBottom>
                  Déclarer du temps
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: compact ? 1 : 2, py: compact ? 0.5 : 1 }}>
                    {error}
                  </Alert>
                )}

                <Stack spacing={compact ? 1 : 2}>
                  <TextField
                    label="Heures"
                    type="number"
                    value={newTimeHours}
                    onChange={(e) => setNewTimeHours(e.target.value)}
                    size="small"
                    inputProps={{ min: 0, step: 0.25 }}
                    disabled={loading}
                  />

                  <TextField
                    label="Description (optionnel)"
                    value={newTimeDescription}
                    onChange={(e) => setNewTimeDescription(e.target.value)}
                    size="small"
                    multiline
                    rows={compact ? 1 : 2}
                    disabled={loading}
                  />

                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveIcon />}
                      onClick={handleTimeSubmit}
                      disabled={!newTimeHours || loading}
                    >
                      Valider
                    </Button>

                    {task.status !== 'DONE' && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleStatusChange('DONE')}
                        disabled={loading}
                      >
                        Marquer terminé
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* Message si pas assigné à l'utilisateur */}
            {!isAssignedToCurrentUser && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                Cette tâche n'est pas assignée à votre utilisateur
              </Typography>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default TaskCardWithTimeEntry;