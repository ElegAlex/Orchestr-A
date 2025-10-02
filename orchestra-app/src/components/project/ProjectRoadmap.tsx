import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Stack,
  IconButton,
  Paper,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Flag as MilestoneIcon,
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PlayArrow as InProgressIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Milestone, Task, MilestoneStatus } from '../../types';
import { milestoneService } from '../../services/milestone.service';
import { taskService } from '../../services/task.service';
import TaskCardWithTimeEntry from './TaskCardWithTimeEntry';
import { calculateMilestoneStatus, getMilestoneStatusColor, getMilestoneStatusLabel } from '../../utils/milestone.utils';
import { TaskModalSimplified as TaskModal } from '../tasks/TaskModalSimplified';

// Utilitaires pour les statuts (déplacés vers utils/milestone.utils.ts)

const getStatusLabel = getMilestoneStatusLabel; // Alias pour compatibilité

const getMilestoneStatusIcon = (status: MilestoneStatus) => {
  if (status === 'completed') return <CompletedIcon sx={{ fontSize: 18, color: 'success.main' }} />;
  if (status === 'in_progress') return <InProgressIcon sx={{ fontSize: 18, color: 'warning.main' }} />;
  return <PendingIcon sx={{ fontSize: 18, color: 'info.main' }} />;
};

interface ProjectRoadmapProps {
  projectId: string;
  onCreateMilestone?: () => void;
  onEditMilestone?: (milestone: Milestone) => void;
  refreshTrigger?: number;
}

interface MilestoneWithTasks {
  milestone: Milestone;
  tasks: Task[];
  computedStatus: MilestoneStatus;
  isExpanded: boolean;
}

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({
  projectId,
  onCreateMilestone,
  onEditMilestone,
  refreshTrigger,
}) => {
  const [milestonesWithTasks, setMilestonesWithTasks] = useState<MilestoneWithTasks[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour la modal de création de tâche
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Fonction pour basculer l'expansion d'un jalon
  const toggleMilestoneExpansion = (milestoneId: string) => {
    setMilestonesWithTasks(prev =>
      prev.map(item =>
        item.milestone.id === milestoneId
          ? { ...item, isExpanded: !item.isExpanded }
          : item
      )
    );
  };

  // Handlers pour la modal de tâche
  const handleCreateTask = () => {
    setSelectedTask(null);
    setTaskModalOpen(true);
  };

  const handleTaskModalClose = () => {
    setTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskSaved = () => {
    loadRoadmapData(); // Recharger les données après création/modification
    handleTaskModalClose();
  };

  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  // Fonction de chargement des données
  const loadRoadmapData = React.useCallback(async () => {
    try {
      setLoading(true);

      const [milestonesData, tasksData] = await Promise.all([
        milestoneService.getProjectMilestones(projectId),
        taskService.getTasksByProject(projectId),
      ]);

      // Associer les tâches aux jalons et calculer les statuts
      const milestonesWithTasksData: MilestoneWithTasks[] = milestonesData.map(milestone => {
        const milestoneTasks = tasksData.filter(task => task.milestoneId === milestone.id);
        const computedStatus = calculateMilestoneStatus(milestoneTasks);

        return {
          milestone,
          tasks: milestoneTasks,
          computedStatus,
          isExpanded: true, // Par défaut OUVERT pour voir les tâches
        };
      });

      // Trier les jalons par date d'ouverture (startDate)
      milestonesWithTasksData.sort((a, b) => {
        const dateA = a.milestone.startDate ? new Date(a.milestone.startDate).getTime() : 0;
        const dateB = b.milestone.startDate ? new Date(b.milestone.startDate).getTime() : 0;
        return dateA - dateB;
      });

      setMilestonesWithTasks(milestonesWithTasksData);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Chargement initial des données et refresh sur trigger
  useEffect(() => {
    loadRoadmapData();
  }, [projectId, refreshTrigger, loadRoadmapData]);

  if (loading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Chargement de la roadmap...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header avec métriques */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h5" gutterBottom>
              🗺️ Roadmap par Jalons
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vue organisée par jalons avec tâches déployables et déclaration de temps intégrée
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<MilestoneIcon />}
              onClick={onCreateMilestone}
              size="small"
            >
              Nouveau Jalon
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateTask}
              size="small"
            >
              Nouvelle Tâche
            </Button>
          </Stack>
        </Stack>

        {/* Métriques rapides */}
        <Stack direction="row" spacing={3}>
          <Box>
            <Typography variant="h6" color="primary">
              {milestonesWithTasks.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Jalons
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" color="success.main">
              {milestonesWithTasks.filter(m => m.computedStatus === 'completed').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Terminés
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" color="warning.main">
              {milestonesWithTasks.filter(m => m.computedStatus === 'in_progress').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              En cours
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" color="info.main">
              {milestonesWithTasks.reduce((sum, m) => sum + m.tasks.length, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tâches total
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Vue par jalons */}
      {milestonesWithTasks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <MilestoneIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucun jalon défini
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Créez votre premier jalon pour organiser les tâches de ce projet
          </Typography>
          <Button variant="contained" startIcon={<MilestoneIcon />} onClick={onCreateMilestone}>
            Créer un Jalon
          </Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {milestonesWithTasks.map((milestoneData) => (
            <MilestoneCard
              key={milestoneData.milestone.id}
              milestoneData={milestoneData}
              onToggleExpansion={toggleMilestoneExpansion}
              onEditMilestone={onEditMilestone}
              onTaskUpdate={loadRoadmapData} // Refresh quand une tâche change
              onTaskEdit={handleTaskEdit}
            />
          ))}
        </Stack>
      )}

      {/* Modal de création/édition de tâche */}
      <TaskModal
        open={taskModalOpen}
        task={selectedTask}
        projectId={projectId}
        onClose={handleTaskModalClose}
        onSave={handleTaskSaved}
      />
    </Box>
  );
};

// Composant pour une carte de jalon avec tâches déployables
interface MilestoneCardProps {
  milestoneData: MilestoneWithTasks;
  onToggleExpansion: (milestoneId: string) => void;
  onEditMilestone?: (milestone: Milestone) => void;
  onTaskUpdate?: () => void;
  onTaskEdit?: (task: Task) => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestoneData,
  onToggleExpansion,
  onEditMilestone,
  onTaskUpdate,
  onTaskEdit,
}) => {
  const { milestone, tasks, computedStatus, isExpanded } = milestoneData;

  const completedTasks = tasks.filter(task => task.status === 'DONE').length;
  const progressPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <Card
      elevation={2}
      sx={{
        border: `2px solid`,
        borderColor: `${getMilestoneStatusColor(computedStatus)}.main`,
        borderLeft: `6px solid`,
        borderLeftColor: `${getMilestoneStatusColor(computedStatus)}.main`,
        '&:hover': {
          elevation: 4,
          transform: 'translateY(-1px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
    >
      {/* En-tête du jalon */}
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              {getMilestoneStatusIcon(computedStatus)}
              <Typography variant="h6" fontWeight="600">
                {milestone.name}
              </Typography>
              {milestone.isKeyDate && (
                <Chip
                  label="🔒 Date clé"
                  size="small"
                  color="error"
                  variant="outlined"
                />
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Chip
                label={milestone.code}
                size="small"
                color={getMilestoneStatusColor(computedStatus)}
                variant="outlined"
              />
              <Chip
                label={getStatusLabel(computedStatus)}
                size="small"
                color={getMilestoneStatusColor(computedStatus)}
              />
              <Chip
                label={milestone.type}
                size="small"
                variant="outlined"
              />
              {milestone.startDate && (
                <Typography variant="caption" color="text.secondary">
                  📅 {format(new Date(milestone.startDate), 'dd MMM yyyy', { locale: fr })}
                  {milestone.dueDate && ` → ${format(new Date(milestone.dueDate), 'dd MMM yyyy', { locale: fr })}`}
                </Typography>
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" mb={2}>
              {milestone.description}
            </Typography>

            {/* Progression */}
            <Box mb={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight="500">
                  Progression: {completedTasks}/{tasks.length} tâches
                </Typography>
                <Typography variant="body2" fontWeight="600" color={`${getMilestoneStatusColor(computedStatus)}.main`}>
                  {progressPercentage}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progressPercentage}
                sx={{ height: 8, borderRadius: 4 }}
                color={getMilestoneStatusColor(computedStatus)}
              />
            </Box>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            {onEditMilestone && (
              <IconButton size="small" onClick={() => onEditMilestone(milestone)}>
                <EditIcon />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => onToggleExpansion(milestone.id)}
              sx={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Stack>
        </Stack>

        {/* Badge du nombre de tâches */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            variant="text"
            size="small"
            onClick={() => onToggleExpansion(milestone.id)}
            startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none' }}
          >
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''} {isExpanded ? 'masquer' : 'afficher'}
          </Button>

          {tasks.length > 0 && (
            <Stack direction="row" spacing={1}>
              <Chip
                label={`${tasks.filter(t => t.status === 'TODO').length} À faire`}
                size="small"
                variant="outlined"
                color="info"
              />
              <Chip
                label={`${tasks.filter(t => t.status === 'IN_PROGRESS').length} En cours`}
                size="small"
                variant="outlined"
                color="warning"
              />
              <Chip
                label={`${completedTasks} Terminées`}
                size="small"
                variant="outlined"
                color="success"
              />
            </Stack>
          )}
        </Stack>
      </CardContent>

      {/* Section des tâches déployables */}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent sx={{ pt: 2 }}>
          {tasks.length === 0 ? (
            <Box textAlign="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                Aucune tâche associée à ce jalon
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Créez ou assignez des tâches à ce jalon pour les voir apparaître ici
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {tasks.map((task) => (
                <TaskCardWithTimeEntry
                  key={task.id}
                  task={task}
                  onUpdate={onTaskUpdate}
                  onEdit={onTaskEdit}
                  compact={true}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default ProjectRoadmap;