import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { Milestone, Task } from '../../types';
import { milestoneService } from '../../services/milestone.service';
import { taskService } from '../../services/task.service';
import MilestoneCard from './MilestoneCard';

interface MilestoneViewProps {
  projectId: string;
  onCreateMilestone?: () => void;
}

const MilestoneView: React.FC<MilestoneViewProps> = ({
  projectId,
  onCreateMilestone,
}) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMilestonesAndTasks();
  }, [projectId]);

  const loadMilestonesAndTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les jalons et tâches en parallèle
      const [milestonesData, tasksData] = await Promise.all([
        milestoneService.getMilestonesByProject(projectId),
        taskService.getTasksByProject(projectId),
      ]);

      // Trier les jalons par date d'ouverture (startDate)
      const sortedMilestones = milestonesData.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateA - dateB;
      });

      setMilestones(sortedMilestones);
      setTasks(tasksData);
    } catch (err) {
      console.error('Erreur lors du chargement des jalons:', err);
      setError('Impossible de charger les jalons du projet');
    } finally {
      setLoading(false);
    }
  };

  const handleMilestoneUpdate = () => {
    // Recharger les données après modification d'un jalon
    loadMilestonesAndTasks();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Chargement des jalons...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ margin: 2 }}>
        {error}
      </Alert>
    );
  }

  if (milestones.length === 0) {
    return (
      <Box sx={{ padding: 3, textAlign: 'center' }}>
        <TimelineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Aucun jalon défini
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Commencez par créer des jalons pour organiser votre projet par étapes clés.
        </Typography>
        {onCreateMilestone && (
          <Fab
            color="primary"
            onClick={onCreateMilestone}
            sx={{ mt: 2 }}
          >
            <AddIcon />
          </Fab>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 2 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Vue par Jalons
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {milestones.length} jalon{milestones.length > 1 ? 's' : ''} •
          Classé{milestones.length > 1 ? 's' : ''} par date d'ouverture
        </Typography>
      </Paper>

      {/* Liste des jalons */}
      <Stack spacing={3}>
        {milestones.map((milestone) => {
          // Filtrer les tâches liées à ce jalon
          const milestoneTasks = tasks.filter(task =>
            task.milestoneId === milestone.id ||
            milestone.taskIds?.includes(task.id)
          );

          return (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              tasks={milestoneTasks}
              onUpdate={handleMilestoneUpdate}
            />
          );
        })}
      </Stack>

      {/* Bouton flottant pour créer un jalon */}
      {onCreateMilestone && (
        <Tooltip title="Créer un nouveau jalon">
          <Fab
            color="primary"
            onClick={onCreateMilestone}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
            }}
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      )}
    </Box>
  );
};

export default MilestoneView;