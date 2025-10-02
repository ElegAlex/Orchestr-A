import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import { useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';

const TASK_STATUSES = {
  'BACKLOG': 'Backlog',
  'TODO': 'À faire',
  'IN_PROGRESS': 'En cours',
  'DONE': 'Terminé',
  'BLOCKED': 'Bloqué',
};

const STATUS_COLORS = {
  'BACKLOG': '#9e9e9e',
  'TODO': '#2196f3',
  'IN_PROGRESS': '#ff9800',
  'DONE': '#4caf50',
  'BLOCKED': '#f44336',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMenuClick: (event: React.MouseEvent<HTMLElement>, task: Task) => void;
  selectedTaskIds: Set<string>;
  onSelectionChange: (taskId: string, selected: boolean) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
  onTaskClick,
  onMenuClick,
  selectedTaskIds,
  onSelectionChange,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        minWidth: 320,
        maxWidth: 320,
        minHeight: 400,
        p: 2,
        backgroundColor: isOver ? 'action.hover' : 'background.paper',
        border: isOver ? '2px dashed' : '1px solid',
        borderColor: isOver ? STATUS_COLORS[status] : 'divider',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {/* En-tête de colonne */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS[status],
            }}
          />
          {TASK_STATUSES[status]}
        </Typography>
        <Chip
          label={tasks.length}
          size="small"
          sx={{
            backgroundColor: STATUS_COLORS[status],
            color: 'white',
            fontWeight: 'bold',
          }}
        />
      </Box>

      {/* Zone de drop et liste des tâches */}
      <Box
        sx={{
          minHeight: 350,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            index={index}
            onTaskClick={() => onTaskClick(task)}
            onMenuClick={(e) => onMenuClick(e, task)}
            isSelected={selectedTaskIds.has(task.id)}
            onSelectionChange={onSelectionChange}
          />
        ))}

        {/* Zone de drop vide si pas de tâches */}
        {tasks.length === 0 && (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
              fontStyle: 'italic',
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'action.hover',
            }}
          >
            Glissez une tâche ici
          </Box>
        )}
      </Box>
    </Paper>
  );
};