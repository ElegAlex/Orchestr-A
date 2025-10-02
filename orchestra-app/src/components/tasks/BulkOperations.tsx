import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Fade,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Assignment as AssignIcon,
  Label as LabelIcon,
  Schedule as ScheduleIcon,
  Block as BlockIcon,
  Check as CompleteIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { Task, TaskStatus, Priority } from '../../types';
import { taskService } from '../../services/task.service';

interface BulkOperationsProps {
  selectedTasks: Task[];
  onClearSelection: () => void;
  onTasksUpdated: () => void;
}

type BulkOperation = 
  | 'status'
  | 'priority'
  | 'assignee'
  | 'labels'
  | 'dueDate'
  | 'delete'
  | 'block';

const BULK_OPERATIONS = [
  { value: 'status', label: 'Changer le statut', icon: <EditIcon fontSize="small" />, color: 'primary' },
  { value: 'priority', label: 'Changer la priorité', icon: <ScheduleIcon fontSize="small" />, color: 'warning' },
  { value: 'assignee', label: 'Assigner', icon: <AssignIcon fontSize="small" />, color: 'info' },
  { value: 'labels', label: 'Ajouter des labels', icon: <LabelIcon fontSize="small" />, color: 'success' },
  { value: 'dueDate', label: 'Définir échéance', icon: <ScheduleIcon fontSize="small" />, color: 'secondary' },
  { value: 'block', label: 'Bloquer', icon: <BlockIcon fontSize="small" />, color: 'error' },
  { value: 'delete', label: 'Supprimer', icon: <DeleteIcon fontSize="small" />, color: 'error' },
] as const;

const STATUS_OPTIONS = [
  { value: 'TODO', label: '📋 À faire' },
  { value: 'IN_PROGRESS', label: '🔄 En cours' },
  { value: 'IN_REVIEW', label: '👀 En revue' },
  { value: 'DONE', label: '✅ Terminé' },
  { value: 'BLOCKED', label: '🚫 Bloqué' },
];

const PRIORITY_OPTIONS = [
  { value: 'P1', label: '🔴 P1 - Critique' },
  { value: 'P2', label: '🟠 P2 - Élevée' },
  { value: 'P3', label: '🟡 P3 - Moyenne' },
  { value: 'P4', label: '🟢 P4 - Faible' },
];

export const BulkOperations: React.FC<BulkOperationsProps> = ({
  selectedTasks,
  onClearSelection,
  onTasksUpdated,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<BulkOperation | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form states for different operations
  const [newStatus, setNewStatus] = useState<TaskStatus>('TODO');
  const [newPriority, setNewPriority] = useState<Priority>('P3');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newLabels, setNewLabels] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [blockReason, setBlockReason] = useState('');

  if (selectedTasks.length === 0) {
    return null;
  }

  const handleOperationClick = (operation: BulkOperation) => {
    setSelectedOperation(operation);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedOperation(null);
    // Reset form states
    setNewStatus('TODO');
    setNewPriority('P3');
    setNewAssigneeId('');
    setNewLabels('');
    setNewDueDate('');
    setBlockReason('');
  };

  const handleBulkOperation = async () => {
    if (!selectedOperation) return;

    setLoading(true);
    try {
      const taskIds = selectedTasks.map(task => task.id);

      switch (selectedOperation) {
        case 'status':
          await taskService.bulkUpdateStatus(taskIds, newStatus);
          break;
        
        case 'priority':
          await taskService.bulkUpdatePriority(taskIds, newPriority);
          break;
        
        case 'assignee':
          if (newAssigneeId) {
            await taskService.bulkAssign(taskIds, newAssigneeId);
          }
          break;
        
        case 'labels':
          if (newLabels.trim()) {
            const labelsArray = newLabels.split(',').map(label => label.trim()).filter(Boolean);
            await taskService.bulkAddLabels(taskIds, labelsArray);
          }
          break;
        
        case 'dueDate':
          if (newDueDate) {
            await taskService.bulkSetDueDate(taskIds, new Date(newDueDate));
          }
          break;
        
        case 'block':
          if (blockReason.trim()) {
            await taskService.bulkBlock(taskIds, blockReason);
          }
          break;
        
        case 'delete':
          await taskService.bulkDelete(taskIds);
          break;
      }

      // Notify parent component to refresh tasks
      onTasksUpdated();
      onClearSelection();
      handleCloseDialog();
    } catch (error) {
      console.error('Erreur lors de l\'opération en lot:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderDialogContent = () => {
    switch (selectedOperation) {
      case 'status':
        return (
          <FormControl fullWidth>
            <InputLabel>Nouveau statut</InputLabel>
            <Select
              value={newStatus}
              label="Nouveau statut"
              onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'priority':
        return (
          <FormControl fullWidth>
            <InputLabel>Nouvelle priorité</InputLabel>
            <Select
              value={newPriority}
              label="Nouvelle priorité"
              onChange={(e) => setNewPriority(e.target.value as Priority)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'assignee':
        return (
          <TextField
            fullWidth
            label="ID de l'utilisateur"
            value={newAssigneeId}
            onChange={(e) => setNewAssigneeId(e.target.value)}
            placeholder="user-id"
            helperText="TODO: Intégrer avec le système d'utilisateurs"
          />
        );
      
      case 'labels':
        return (
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Labels à ajouter"
            value={newLabels}
            onChange={(e) => setNewLabels(e.target.value)}
            placeholder="frontend, urgent, bug"
            helperText="Séparez les labels par des virgules"
          />
        );
      
      case 'dueDate':
        return (
          <TextField
            fullWidth
            type="date"
            label="Date d'échéance"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      
      case 'block':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Raison du blocage"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Expliquez pourquoi ces tâches sont bloquées..."
            required
          />
        );
      
      case 'delete':
        return (
          <Alert severity="warning">
            <Typography variant="body2">
              ⚠️ Cette action est irréversible. Êtes-vous sûr de vouloir supprimer {selectedTasks.length} tâche(s) ?
            </Typography>
            <Box sx={{ mt: 1 }}>
              {selectedTasks.slice(0, 3).map(task => (
                <Typography key={task.id} variant="caption" display="block">
                  • {task.code} - {task.title}
                </Typography>
              ))}
              {selectedTasks.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  ... et {selectedTasks.length - 3} autre(s)
                </Typography>
              )}
            </Box>
          </Alert>
        );
      
      default:
        return null;
    }
  };

  const canExecuteOperation = () => {
    switch (selectedOperation) {
      case 'assignee':
        return newAssigneeId.trim() !== '';
      case 'labels':
        return newLabels.trim() !== '';
      case 'dueDate':
        return newDueDate !== '';
      case 'block':
        return blockReason.trim() !== '';
      case 'delete':
      case 'status':
      case 'priority':
        return true;
      default:
        return false;
    }
  };

  return (
    <>
      <Fade in={selectedTasks.length > 0}>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            p: 2,
            zIndex: 1300,
            minWidth: 400,
            boxShadow: 3,
            border: '1px solid',
            borderColor: 'primary.main',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`${selectedTasks.length} tâche(s) sélectionnée(s)`}
                color="primary"
                variant="outlined"
              />
              <Button
                size="small"
                startIcon={<CloseIcon />}
                onClick={onClearSelection}
              >
                Annuler
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Actions en lot:
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {BULK_OPERATIONS.map((operation) => (
              <Button
                key={operation.value}
                size="small"
                variant="outlined"
                startIcon={operation.icon}
                onClick={() => handleOperationClick(operation.value)}
                color={operation.color as any}
                sx={{ fontSize: '0.75rem' }}
              >
                {operation.label}
              </Button>
            ))}
          </Box>
        </Paper>
      </Fade>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedOperation && BULK_OPERATIONS.find(op => op.value === selectedOperation)?.label}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {selectedTasks.length} tâche(s) sélectionnée(s)
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
          {renderDialogContent()}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleBulkOperation}
            disabled={loading || !canExecuteOperation()}
            color={selectedOperation === 'delete' ? 'error' : 'primary'}
          >
            {loading ? 'En cours...' : 'Appliquer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};