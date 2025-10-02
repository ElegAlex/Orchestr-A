import React, { useState, useEffect } from 'react';
import {
  Chip,
  Tooltip,
  Box
} from '@mui/material';
import {
  Flag as ObjectiveIcon,
} from '@mui/icons-material';
import { objectiveService } from '../../services/objective.service';

interface TaskObjectiveIndicatorProps {
  sprintId?: string;
  size?: 'small' | 'medium';
}

export const TaskObjectiveIndicator: React.FC<TaskObjectiveIndicatorProps> = ({
  sprintId,
  size = 'small'
}) => {
  const [objective, setObjective] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sprintId) {
      loadObjective();
    }
  }, [sprintId]);

  const loadObjective = async () => {
    if (!sprintId) return;

    try {
      setLoading(true);
      // Pour le moment, on va récupérer l'objectif via une méthode simple
      // En prod, il faudrait ajouter une méthode getObjective(id) au service
      const projectId = 'default'; // TODO: récupérer le vrai projectId
      const currentObjective = await objectiveService.getCurrentObjective(projectId);

      if (currentObjective && currentObjective.id === sprintId) {
        setObjective(currentObjective);
      }
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  if (!sprintId || loading) {
    return null;
  }

  if (!objective) {
    // Affichage générique si on n'arrive pas à charger l'objectif
    return (
      <Tooltip title="Cette tâche fait partie d'un objectif en cours">
        <Chip
          icon={<ObjectiveIcon />}
          label="Objectif"
          size={size}
          color="primary"
          variant="outlined"
          sx={{
            fontSize: size === 'small' ? '10px' : '12px',
            height: size === 'small' ? 20 : 24
          }}
        />
      </Tooltip>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'active': return 'primary';
      case 'planning': return 'info';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '✅ Terminé';
      case 'active': return '🎯 En cours';
      case 'planning': return '📋 Planifié';
      default: return 'Objectif';
    }
  };

  return (
    <Tooltip
      title={
        <Box>
          <strong>🎯 {objective.name}</strong>
          <br />
          {objective.goal}
          <br />
          <em>Statut: {getStatusText(objective.status)}</em>
        </Box>
      }
    >
      <Chip
        icon={<ObjectiveIcon />}
        label={size === 'small' ? '🎯' : getStatusText(objective.status)}
        size={size}
        color={getStatusColor(objective.status) as any}
        variant="filled"
        sx={{
          fontSize: size === 'small' ? '10px' : '12px',
          height: size === 'small' ? 20 : 24,
          cursor: 'help'
        }}
      />
    </Tooltip>
  );
};

export default TaskObjectiveIndicator;