import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Box,
  Stack,
  LinearProgress,
  Tooltip,
  Divider,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Flag as FlagIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Milestone, Task, MilestoneStatus } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import TaskCardWithTimeEntry from './TaskCardWithTimeEntry';
import { calculateMilestoneStatus } from '../../utils/milestone.utils';

interface MilestoneCardProps {
  milestone: Milestone;
  tasks: Task[];
  onUpdate?: () => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  tasks,
  onUpdate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [computedStatus, setComputedStatus] = useState<MilestoneStatus>('upcoming');
  const [completionRate, setCompletionRate] = useState(0);

  // Calcul automatique du statut et de la progression basé sur les tâches
  useEffect(() => {
    // Utiliser la fonction utilitaire centralisée
    const status = calculateMilestoneStatus(tasks);
    setComputedStatus(status);

    // Calcul du taux de complétion
    if (tasks.length === 0) {
      setCompletionRate(0);
    } else {
      const completedTasks = tasks.filter(task => task.status === 'DONE');
      const rate = Math.round((completedTasks.length / tasks.length) * 100);
      setCompletionRate(rate);
    }
  }, [tasks]);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const getStatusConfig = (status: MilestoneStatus) => {
    switch (status) {
      case 'upcoming':
        return {
          label: 'À venir',
          color: '#9e9e9e' as const,
          icon: <PendingIcon />,
        };
      case 'in_progress':
        return {
          label: 'En cours',
          color: '#ff9800' as const,
          icon: <PlayArrowIcon />,
        };
      case 'completed':
        return {
          label: 'Terminé',
          color: '#4caf50' as const,
          icon: <CheckCircleIcon />,
        };
      default:
        return {
          label: 'Inconnu',
          color: '#9e9e9e' as const,
          icon: <PendingIcon />,
        };
    }
  };

  const statusConfig = getStatusConfig(computedStatus);

  // Récupérer les assignés uniques des tâches
  const uniqueAssignees = Array.from(
    new Set(tasks.flatMap(task => task.responsible || []))
  );

  return (
    <Card
      sx={{
        border: `2px solid ${statusConfig.color}`,
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        }
      }}
    >
      <CardContent>
        {/* Header du jalon */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box flex={1}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <FlagIcon sx={{ color: statusConfig.color }} />
              <Typography variant="h6" component="h3">
                {milestone.name}
              </Typography>
              <Chip
                icon={statusConfig.icon}
                label={statusConfig.label}
                size="small"
                sx={{
                  backgroundColor: `${statusConfig.color}20`,
                  color: statusConfig.color,
                  fontWeight: 'bold',
                }}
              />
            </Stack>

            {milestone.description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {milestone.description}
              </Typography>
            )}
          </Box>

          <IconButton
            onClick={handleExpandClick}
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s',
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Box>

        {/* Informations du jalon */}
        <Stack direction="row" spacing={2} alignItems="center" mb={2} flexWrap="wrap">
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <ScheduleIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {milestone.startDate && format(new Date(milestone.startDate), 'dd MMM yyyy', { locale: fr })}
              {milestone.startDate && milestone.dueDate && ' → '}
              {milestone.dueDate && format(new Date(milestone.dueDate), 'dd MMM yyyy', { locale: fr })}
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
          </Typography>

          {uniqueAssignees.length > 0 && (
            <Tooltip title="Contributeurs">
              <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                {uniqueAssignees.map((assigneeId, index) => (
                  <Avatar key={assigneeId} sx={{ bgcolor: 'primary.main' }}>
                    {assigneeId.charAt(0).toUpperCase()}
                  </Avatar>
                ))}
              </AvatarGroup>
            </Tooltip>
          )}
        </Stack>

        {/* Barre de progression */}
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Progression
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {completionRate}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={completionRate}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: `${statusConfig.color}20`,
              '& .MuiLinearProgress-bar': {
                backgroundColor: statusConfig.color,
              },
            }}
          />
        </Box>
      </CardContent>

      {/* Section des tâches déployable */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent sx={{ pt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Tâches associées ({tasks.length})
          </Typography>

          {tasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Aucune tâche associée à ce jalon
            </Typography>
          ) : (
            <Stack spacing={2}>
              {tasks.map((task) => (
                <TaskCardWithTimeEntry
                  key={task.id}
                  task={task}
                  onUpdate={onUpdate}
                  compact
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Collapse>

      <CardActions sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Cliquez pour {expanded ? 'masquer' : 'afficher'} les tâches
        </Typography>
      </CardActions>
    </Card>
  );
};

export default MilestoneCard;