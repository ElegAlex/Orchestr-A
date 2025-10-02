import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CompleteIcon,
  PlayArrow as StartIcon,
  Assignment as TaskIcon,
  Timer as TimerIcon,
  Flag as ObjectiveIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Objective, objectiveService } from '../../services/objective.service';
import { taskService } from '../../services/task.service';
import { Task } from '../../types';

interface ObjectiveDetailModalProps {
  open: boolean;
  onClose: () => void;
  objective: Objective | null;
  onObjectiveUpdated?: () => void;
}

export const ObjectiveDetailModal: React.FC<ObjectiveDetailModalProps> = ({
  open,
  onClose,
  objective,
  onObjectiveUpdated
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && objective) {
      loadObjectiveDetails();
    }
  }, [open, objective]);

  const loadObjectiveDetails = async () => {
    if (!objective) return;

    try {
      setLoading(true);

      // Charger les tâches du projet pour calculer les stats
      const projectTasks = await taskService.getTasksByProject(objective.projectId);
      setTasks(projectTasks);

      // Calculer les statistiques
      const objectiveStats = objectiveService.calculateObjectiveStats(objective, projectTasks);
      setStats(objectiveStats);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const handleStartObjective = async () => {
    if (!objective) return;

    try {
      await objectiveService.startObjective(objective.id);
      onObjectiveUpdated?.();
      onClose();
    } catch (error) {
      
    }
  };

  const handleCompleteObjective = async () => {
    if (!objective || !stats) return;

    try {
      await objectiveService.completeObjective(objective.id, stats.completedTasks);
      onObjectiveUpdated?.();
      onClose();
    } catch (error) {
      
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'on-track': return 'success';
      case 'at-risk': return 'warning';
      case 'delayed': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '✅ Terminé';
      case 'on-track': return '🚀 Sur la bonne voie';
      case 'at-risk': return '⚠️ À surveiller';
      case 'delayed': return '🔴 En retard';
      default: return '📋 Planifié';
    }
  };

  const getTaskStatusIcon = (taskStatus: string) => {
    switch (taskStatus) {
      case 'DONE':
        return <CompleteIcon sx={{ color: 'success.main' }} />;
      case 'IN_PROGRESS':
        return <TrendingUpIcon sx={{ color: 'warning.main' }} />;
      case 'BLOCKED':
        return <WarningIcon sx={{ color: 'error.main' }} />;
      default:
        return <TaskIcon sx={{ color: 'grey.500' }} />;
    }
  };

  const objectiveTasks = tasks.filter(task =>
    objective && objective.taskIds.includes(task.id)
  );

  if (!objective) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <ObjectiveIcon color="primary" />
            <Typography variant="h6">Détails de l'Objectif</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3}>
          {/* En-tête objectif */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" fontWeight="bold">
                {objective.name}
              </Typography>
              {stats && (
                <Chip
                  label={getStatusText(stats.status)}
                  color={getStatusColor(stats.status) as any}
                  size="small"
                />
              )}
            </Box>

            <Typography variant="body1" color="text.secondary" paragraph>
              💭 <strong>Objectif :</strong> {objective.goal}
            </Typography>

            <Box display="flex" gap={2} mb={2}>
              <Typography variant="body2">
                📅 <strong>Début :</strong> {format(objective.startDate, 'dd/MM/yyyy', { locale: fr })}
              </Typography>
              <Typography variant="body2">
                🏁 <strong>Fin :</strong> {format(objective.endDate, 'dd/MM/yyyy', { locale: fr })}
              </Typography>
              {stats && (
                <Typography variant="body2">
                  ⏱️ <strong>{stats.daysRemaining}j restants</strong>
                </Typography>
              )}
            </Box>
          </Box>

          {/* Progression */}
          {stats && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6">
                  📈 Progression
                </Typography>
                <Typography variant="h6" fontWeight="bold">
                  {stats.progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.progress}
                sx={{ height: 12, borderRadius: 2, mb: 2 }}
                color={getStatusColor(stats.status) as any}
              />

              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip
                  icon={<CompleteIcon />}
                  label={`${stats.completedTasks} terminées`}
                  color="success"
                  size="small"
                />
                <Chip
                  icon={<TrendingUpIcon />}
                  label={`${objectiveTasks.filter(t => t.status === 'IN_PROGRESS').length} en cours`}
                  color="warning"
                  size="small"
                />
                <Chip
                  icon={<TaskIcon />}
                  label={`${objectiveTasks.filter(t => t.status === 'TODO').length} à faire`}
                  color="info"
                  size="small"
                />
              </Box>
            </Box>
          )}

          {/* Alertes */}
          {stats?.status === 'at-risk' && (
            <Alert severity="warning">
              ⚠️ <strong>Objectif à risque !</strong> Considérez reporter quelques tâches non-critiques.
            </Alert>
          )}

          {stats?.status === 'delayed' && (
            <Alert severity="error">
              🚨 <strong>Objectif en retard !</strong> Finalisez l'objectif et reportez les tâches restantes.
            </Alert>
          )}

          <Divider />

          {/* Liste des tâches */}
          <Box>
            <Typography variant="h6" gutterBottom>
              📋 Tâches de cet objectif ({objectiveTasks.length})
            </Typography>

            {loading ? (
              <LinearProgress />
            ) : objectiveTasks.length === 0 ? (
              <Alert severity="info">
                Aucune tâche assignée à cet objectif
              </Alert>
            ) : (
              <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                {objectiveTasks.map((task, index) => (
                  <Box key={task.id}>
                    <ListItem>
                      <ListItemIcon>
                        {getTaskStatusIcon(task.status)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            sx={{
                              textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                              opacity: task.status === 'DONE' ? 0.7 : 1
                            }}
                          >
                            {task.title}
                          </Typography>
                        }
                        secondary={task.description ? `${task.description.substring(0, 60)  }...` : undefined}
                      />
                      <Box display="flex" gap={1}>
                        <Chip
                          label={task.priority}
                          size="small"
                          color={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'default'}
                        />
                        <Chip
                          label={task.status}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </ListItem>
                    {index < objectiveTasks.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Fermer
        </Button>

        {objective.status === 'planning' && (
          <Button
            variant="contained"
            startIcon={<StartIcon />}
            onClick={handleStartObjective}
            color="primary"
          >
            Démarrer l'Objectif
          </Button>
        )}

        {objective.status === 'active' && stats?.progress === 100 && (
          <Button
            variant="contained"
            startIcon={<CompleteIcon />}
            onClick={handleCompleteObjective}
            color="success"
          >
            Finaliser l'Objectif
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};