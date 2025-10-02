import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
  Assignment as TaskIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { Objective, objectiveService } from '../../services/objective.service';
import { taskService } from '../../services/task.service';
import { Task } from '../../types';
import { ObjectiveDetailModal } from '../calendar/ObjectiveDetailModal';

interface CurrentObjectiveWidgetProps {
  projectId?: string;
  onCreateObjective?: () => void;
}

export const CurrentObjectiveWidget: React.FC<CurrentObjectiveWidgetProps> = ({
  projectId,
  onCreateObjective
}) => {
  const [currentObjective, setCurrentObjective] = useState<Objective | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    loadCurrentObjective();
  }, [projectId]);

  const loadCurrentObjective = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Charger l'objectif actuel
      const objective = await objectiveService.getCurrentObjective(projectId);
      setCurrentObjective(objective);

      if (objective) {
        // Charger les tâches du projet pour calculer les stats
        const projectTasks = await taskService.getTasksByProject(projectId);
        setTasks(projectTasks);

        // Calculer les statistiques
        const objectiveStats = objectiveService.calculateObjectiveStats(objective, projectTasks);
        setStats(objectiveStats);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'objectif:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartObjective = async () => {
    if (!currentObjective) return;

    try {
      await objectiveService.startObjective(currentObjective.id);
      await loadCurrentObjective();
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'objectif:', error);
    }
  };

  const handleCompleteObjective = async () => {
    if (!currentObjective || !stats) return;

    try {
      await objectiveService.completeObjective(currentObjective.id, stats.completedTasks);
      await loadCurrentObjective();
    } catch (error) {
      console.error('Erreur lors de la finalisation de l\'objectif:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'on-track':
        return 'success';
      case 'at-risk':
        return 'warning';
      case 'delayed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CompleteIcon color="success" />;
      case 'on-track':
        return <TrendingUpIcon color="success" />;
      case 'at-risk':
        return <WarningIcon color="warning" />;
      case 'delayed':
        return <WarningIcon color="error" />;
      default:
        return <TimerIcon />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅ Terminé';
      case 'on-track':
        return '🚀 Sur la bonne voie';
      case 'at-risk':
        return '⚠️ À surveiller';
      case 'delayed':
        return '🔴 En retard';
      default:
        return '📋 Planifié';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🎯 Mon Objectif Actuel
          </Typography>
          <Box display="flex" justifyContent="center" p={3}>
            <LinearProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!currentObjective) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              🎯 Mon Objectif Actuel
            </Typography>
            <Tooltip title="Créer un nouvel objectif">
              <IconButton
                color="primary"
                onClick={onCreateObjective}
                size="small"
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Alert severity="info">
            <Typography variant="body2">
              📝 Aucun objectif en cours.
              <br />
              <strong>Créez votre premier objectif</strong> pour organiser votre travail sur 2 semaines !
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={onCreateObjective}
              sx={{ mt: 2 }}
            >
              Créer un Objectif
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" gutterBottom>
            🎯 Mon Objectif Actuel
          </Typography>
          {stats && (
            <Chip
              icon={getStatusIcon(stats.status)}
              label={getStatusText(stats.status)}
              color={getStatusColor(stats.status) as any}
              size="small"
            />
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h5" fontWeight="bold" sx={{ flexGrow: 1 }}>
            {currentObjective.name}
          </Typography>
          <Tooltip title="Voir tous les détails">
            <IconButton
              onClick={() => setDetailModalOpen(true)}
              size="small"
              color="primary"
            >
              <ViewIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          💭 {currentObjective.goal}
        </Typography>

        {/* Liste des tâches de l'objectif */}
        {stats && stats.totalTasks > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              📋 Tâches de cet objectif :
            </Typography>
            <Box sx={{ maxHeight: 150, overflow: 'auto', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              {tasks
                .filter(task => currentObjective.taskIds.includes(task.id))
                .map(task => (
                  <Box key={task.id} display="flex" alignItems="center" gap={1} py={0.5}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: task.status === 'DONE' ? 'success.main' :
                                task.status === 'IN_PROGRESS' ? 'warning.main' : 'grey.400'
                      }}
                    />
                    <Typography variant="body2" sx={{
                      flexGrow: 1,
                      textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                      opacity: task.status === 'DONE' ? 0.7 : 1
                    }}>
                      {task.title}
                    </Typography>
                    <Chip
                      label={task.priority}
                      size="small"
                      color={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'default'}
                      sx={{ minWidth: 35, height: 20, fontSize: '10px' }}
                    />
                  </Box>
                ))}
            </Box>
          </Box>
        )}

        {stats && (
          <>
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Progression
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {stats.completedTasks}/{stats.totalTasks} tâches • {stats.progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.progress}
                sx={{ height: 8, borderRadius: 1 }}
                color={getStatusColor(stats.status) as any}
              />
            </Box>

            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip
                icon={<TimerIcon />}
                label={`${stats.daysRemaining}j restants`}
                size="small"
                color={stats.daysRemaining <= 2 ? 'error' : stats.daysRemaining <= 5 ? 'warning' : 'default'}
              />
              <Chip
                icon={<TaskIcon />}
                label={`${stats.completedTasks}/${stats.totalTasks} tâches`}
                size="small"
                color={stats.progress === 100 ? 'success' : 'default'}
              />
              <Chip
                label={`${tasks.filter(t => currentObjective.taskIds.includes(t.id) && t.status === 'IN_PROGRESS').length} en cours`}
                size="small"
                color="warning"
                variant="outlined"
              />
            </Box>

            {stats.status === 'at-risk' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                ⚠️ <strong>Objectif à risque !</strong>
                <br />
                💡 <em>Conseil :</em> Reportez quelques tâches non-critiques au prochain objectif.
              </Alert>
            )}

            {stats.status === 'delayed' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                🚨 <strong>Objectif en retard !</strong>
                <br />
                💡 <em>Action :</em> Finalisez l'objectif et créez-en un nouveau avec les tâches restantes.
              </Alert>
            )}
          </>
        )}

        <Box display="flex" gap={1} mt={2}>
          {currentObjective.status === 'planning' && (
            <Button
              variant="contained"
              startIcon={<StartIcon />}
              onClick={handleStartObjective}
              size="small"
              color="primary"
            >
              Démarrer
            </Button>
          )}

          {currentObjective.status === 'active' && stats?.progress === 100 && (
            <Button
              variant="contained"
              startIcon={<CompleteIcon />}
              onClick={handleCompleteObjective}
              size="small"
              color="success"
            >
              Finaliser l'Objectif
            </Button>
          )}

          {onCreateObjective && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onCreateObjective}
              size="small"
            >
              Nouvel Objectif
            </Button>
          )}
        </Box>
      </CardContent>

      {/* Modal détaillée */}
      <ObjectiveDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        objective={currentObjective}
        onObjectiveUpdated={loadCurrentObjective}
      />
    </Card>
  );
};

export default CurrentObjectiveWidget;