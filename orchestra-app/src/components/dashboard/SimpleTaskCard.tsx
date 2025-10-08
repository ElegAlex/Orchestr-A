/**
 * Simple Task Card - Affichage léger d'une tâche simple
 * Version minimaliste sans time tracking ni RACI
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Circle as CircleIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { SimpleTask } from '../../types/simpleTask';
import { simpleTaskService } from '../../services/simpleTask.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SimpleTaskCardProps {
  task: SimpleTask;
  onUpdate?: () => void;
  compact?: boolean;
}

export const SimpleTaskCard: React.FC<SimpleTaskCardProps> = ({
  task,
  onUpdate,
  compact = false,
}) => {
  const [loading, setLoading] = useState(false);

  // Gestion du changement de statut
  const handleStatusToggle = async () => {
    if (loading) return;

    try {
      setLoading(true);
      let newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE';

      // Cycle: TODO -> IN_PROGRESS -> DONE
      if (task.status === 'TODO') {
        newStatus = 'IN_PROGRESS';
      } else if (task.status === 'IN_PROGRESS') {
        newStatus = 'DONE';
      } else {
        newStatus = 'TODO';
      }

      await simpleTaskService.updateStatus(task.id, newStatus);

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Erreur lors du changement de statut:', err);
    } finally {
      setLoading(false);
    }
  };

  // Couleur de la priorité
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      case 'P3': return 'default';
      default: return 'default';
    }
  };

  // Icône et couleur du statut
  const getStatusIcon = () => {
    switch (task.status) {
      case 'TODO':
        return <CircleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />;
      case 'IN_PROGRESS':
        return <PlayArrowIcon sx={{ fontSize: 20, color: 'info.main' }} />;
      case 'DONE':
        return <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />;
      default:
        return <CircleIcon sx={{ fontSize: 20 }} />;
    }
  };

  const getStatusLabel = () => {
    switch (task.status) {
      case 'TODO': return 'À faire';
      case 'IN_PROGRESS': return 'En cours';
      case 'DONE': return 'Terminé';
      default: return task.status;
    }
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid',
        borderColor: task.status === 'DONE' ? 'success.light' : 'divider',
        opacity: task.status === 'DONE' ? 0.7 : 1,
        '&:hover': {
          boxShadow: 2,
          borderColor: 'primary.main',
        },
      }}
    >
      <CardContent sx={{ py: compact ? 1.5 : 2, px: 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Bouton de statut */}
          <Tooltip title={`${getStatusLabel()} - Cliquer pour changer`}>
            <IconButton
              size="small"
              onClick={handleStatusToggle}
              disabled={loading}
              sx={{
                mt: 0.5,
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              {getStatusIcon()}
            </IconButton>
          </Tooltip>

          {/* Contenu principal */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Titre */}
            <Typography
              variant={compact ? 'body2' : 'body1'}
              fontWeight="500"
              sx={{
                textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                color: task.status === 'DONE' ? 'text.secondary' : 'text.primary',
                wordBreak: 'break-word',
              }}
            >
              {task.title}
            </Typography>

            {/* Description si présente et mode non compact */}
            {!compact && task.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  wordBreak: 'break-word',
                }}
              >
                {task.description}
              </Typography>
            )}

            {/* Métadonnées */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              sx={{ mt: 1, gap: 0.5 }}
            >
              {/* Date */}
              <Chip
                icon={<CalendarIcon sx={{ fontSize: 14 }} />}
                label={format(task.date, 'd MMM yyyy', { locale: fr })}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />

              {/* Créneau horaire */}
              <Chip
                icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                label={`${task.timeSlot.start} - ${task.timeSlot.end}`}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />

              {/* Priorité */}
              <Chip
                label={task.priority}
                size="small"
                color={getPriorityColor(task.priority)}
                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 'bold' }}
              />

              {/* Statut */}
              <Chip
                label={getStatusLabel()}
                size="small"
                variant="outlined"
                color={
                  task.status === 'DONE' ? 'success' :
                  task.status === 'IN_PROGRESS' ? 'info' :
                  'default'
                }
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SimpleTaskCard;
