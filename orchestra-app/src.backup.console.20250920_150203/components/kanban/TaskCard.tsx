import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Flag as FlagIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useDraggable } from '@dnd-kit/core';
import { Task, Priority, TaskType } from '../../types';

// Fonction helper pour formater les dates de façon robuste
const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  } catch {
    return '';
  }
};

const PRIORITY_COLORS = {
  P0: '#f44336',
  P1: '#ff9800', 
  P2: '#2196f3',
  P3: '#9e9e9e',
};

const TYPE_ICONS = {
  EPIC: '🏔️',
  STORY: '📝',
  TASK: '✅',
  BUG: '🐛',
  SPIKE: '🔬',
};

interface TaskCardProps {
  task: Task;
  index: number;
  onTaskClick: () => void;
  onMenuClick: (event: React.MouseEvent<HTMLElement>) => void;
  isSelected: boolean;
  onSelectionChange: (taskId: string, selected: boolean) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  onTaskClick,
  onMenuClick,
  isSelected,
  onSelectionChange,
}) => {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id || `task-${index}-${Date.now()}`, // Fallback si l'ID est vide
    disabled: !task.id || task.id === '' // Désactiver le drag si pas d'ID
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        p: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? 'rotate(5deg)' : 'none',
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={(e) => {
        // Ne pas traiter si c'est un clic sur le menu
        if (!(e.target as HTMLElement).closest('button')) {
          e.stopPropagation();
          onTaskClick();
        }
      }}
      {...listeners}
      {...attributes}
    >
      {/* Type, priorité et menu sur la même ligne */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${TYPE_ICONS[task.type]} ${task.type}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: PRIORITY_COLORS[task.priority],
            }}
          />
        </Box>
        <IconButton 
          size="small" 
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick(e);
          }}
          sx={{ p: 0.5 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Titre - Zone clic uniquement */}
      <Typography 
        variant="subtitle2" 
        sx={{ 
          fontWeight: 'bold',
          mb: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {task.title}
      </Typography>

      {/* Description - Zone clic uniquement */}
      {task.description && (
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: '0.8rem',
          }}
        >
          {task.description}
        </Typography>
      )}

      {/* Labels - Zone clic uniquement */}
      {task.labels && task.labels.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {task.labels.slice(0, 3).map((label, idx) => (
            <Chip
              key={idx}
              label={label}
              size="small"
              variant="filled"
              sx={{ 
                fontSize: '0.6rem',
                height: 16,
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
              }}
            />
          ))}
          {task.labels.length > 3 && task.labels.length - 3 > 0 && (
            <Chip
              label={`+${task.labels.length - 3}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 16 }}
            />
          )}
        </Box>
      )}

      {/* Période de la tâche */}
      {(task.startDate || task.dueDate) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <ScheduleIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {task.startDate && task.dueDate
              ? `Du ${formatDate(task.startDate)} au ${formatDate(task.dueDate)}`
              : task.startDate
                ? `Début: ${formatDate(task.startDate)}`
                : `Échéance: ${formatDate(task.dueDate)}`
            }
          </Typography>
        </Box>
      )}

      {/* Footer avec infos - Zone clic uniquement */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Story Points - Affichage seulement si valeur valide > 0 */}
          {task.storyPoints && 
           typeof task.storyPoints === 'number' && 
           !isNaN(task.storyPoints) && 
           task.storyPoints > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FlagIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption">{task.storyPoints}</Typography>
            </Box>
          )}
          
          {/* Temps estimé - Affichage seulement si valeur valide > 0 */}
          {task.estimatedHours && 
           typeof task.estimatedHours === 'number' && 
           !isNaN(task.estimatedHours) && 
           task.estimatedHours > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption">{task.estimatedHours}h</Typography>
            </Box>
          )}
        </Box>

        {/* Assignés */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Responsables principaux */}
          {task.responsible && task.responsible.length > 0 && task.responsible.slice(0, 2).map((responsibleId, idx) => (
            <Avatar
              key={responsibleId}
              sx={{ 
                width: 24, 
                height: 24,
                fontSize: '0.7rem',
                backgroundColor: 'primary.main',
                border: '2px solid white',
                marginLeft: idx > 0 ? '-8px' : 0,
                zIndex: 2 - idx,
              }}
              title="Responsable"
            >
              <PersonIcon sx={{ fontSize: 14 }} />
            </Avatar>
          ))}
          
          {/* Consultés */}
          {task.consulted && task.consulted.slice(0, 2).map((consultedId, idx) => (
            <Avatar
              key={consultedId}
              sx={{ 
                width: 22, 
                height: 22,
                fontSize: '0.6rem',
                backgroundColor: 'warning.main',
                border: '1px solid white',
                marginLeft: idx === 0 ? -0.5 : -1,
              }}
              title="Consulté"
            >
              <PersonIcon sx={{ fontSize: 12 }} />
            </Avatar>
          ))}
          
          {/* Indicateur s'il y a plus d'assignés - Affichage seulement si > 0 */}
          {(() => {
            const totalAssigned = (task.responsible?.length || 0) + (task.consulted?.length || 0) + (task.accountable?.length || 0) + (task.informed?.length || 0);
            const shown = Math.min(2, (task.responsible?.length || 0)) + Math.min(2, (task.consulted?.length || 0));
            const remaining = totalAssigned - shown;
            return remaining > 0 && !isNaN(remaining) && (
              <Avatar
                sx={{ 
                  width: 20, 
                  height: 20,
                  fontSize: '0.5rem',
                  backgroundColor: 'grey.500',
                  color: 'white',
                  marginLeft: -1,
                }}
                title={`+${remaining} autres assignés RACI`}
              >
                +{remaining}
              </Avatar>
            );
          })()}
        </Box>
      </Box>
    </Paper>
  );
};