import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Chip,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  IconButton,
  Divider,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Flag as FlagIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface TaskTimeEntry {
  id: string;
  taskId: string;
  userId: string;
  date: Date;
  hours: number;
  description?: string;
  createdAt: Date;
}

export interface TaskData {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueDate: Date;
  projectName: string;
  projectId: string;
  estimatedHours?: number;
  loggedHours?: number;
}

interface TaskTimeModalProps {
  open: boolean;
  onClose: () => void;
  task: TaskData | null;
  onSaveTime: (timeEntry: Omit<TaskTimeEntry, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateStatus: (taskId: string, newStatus: TaskData['status']) => Promise<void>;
}

const STATUS_LABELS = {
  'TODO': 'À faire',
  'IN_PROGRESS': 'En cours',
  'DONE': 'Terminé',
  'CANCELLED': 'Annulé'
};

const STATUS_COLORS = {
  'BACKLOG': 'default',
  'TODO': 'default',
  'IN_PROGRESS': 'warning',
  'DONE': 'success',
  'BLOCKED': 'error',
  'CANCELLED': 'error'
} as const;

export const TaskTimeModal: React.FC<TaskTimeModalProps> = ({
  open,
  onClose,
  task,
  onSaveTime,
  onUpdateStatus,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [newStatus, setNewStatus] = useState<TaskData['status']>('IN_PROGRESS');
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (task) {
      setNewStatus(task.status);
      setDescription('');
      setHours('');
    }
  }, [task]);

  const handleSaveTime = async () => {
    if (!task || !hours || parseFloat(hours) <= 0) return;

    setSaving(true);
    try {
      await onSaveTime({
        taskId: task.id,
        userId: user?.id || '',
        date: new Date(selectedDate),
        hours: parseFloat(hours),
        description: description.trim() || undefined,
      });
      
      setHours('');
      setDescription('');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du temps:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!task) return;

    setSaving(true);
    try {
      await onUpdateStatus(task.id, newStatus);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (hours && parseFloat(hours) > 0) {
      await handleSaveTime();
    }
    
    if (newStatus !== task?.status) {
      await handleUpdateStatus();
    }
    
    onClose();
  };

  const quickTimeButtons = [0.5, 1, 2, 4, 8];

  if (!task) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" component="div">
              ⚡ Temps & Statut
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {task.title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Informations tâche
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
            <Chip 
              label={task.projectName} 
              variant="outlined" 
              size="small" 
            />
            <Chip 
              label={task.priority} 
              size="small" 
              color={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'default'} 
            />
            <Chip 
              label={`Échéance: ${format(task.dueDate, 'dd/MM/yyyy', { locale: fr })}`}
              icon={<FlagIcon />}
              size="small"
              variant="outlined"
            />
          </Box>
          
          {task.loggedHours && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Temps déjà saisi: {task.loggedHours}h
              {task.estimatedHours && ` / ${task.estimatedHours}h estimées`}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Saisie du temps */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center">
            <TimeIcon sx={{ mr: 1 }} />
            Saisir le temps passé
          </Typography>
          
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                label="Heures"
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                inputProps={{ min: 0, max: 24, step: 0.5 }}
                size="small"
                helperText="En heures (ex: 1.5)"
              />
            </Box>
          </Box>

          {/* Boutons temps rapide */}
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Temps rapide:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {quickTimeButtons.map((time) => (
                <Button
                  key={time}
                  size="small"
                  variant="outlined"
                  onClick={() => setHours(time.toString())}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  {time}h
                </Button>
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Description (optionnel)"
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Qu'avez-vous fait sur cette tâche ?"
            size="small"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Changement de statut */}
        <Box>
          <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center">
            <PlayIcon sx={{ mr: 1 }} />
            Changer le statut
          </Typography>
          
          <Box display="flex" alignItems="center" gap={2}>
            <Chip
              label={`Actuel: ${STATUS_LABELS[task.status]}`}
              color={STATUS_COLORS[task.status] as any}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">→</Typography>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Nouveau statut</InputLabel>
              <Select
                value={newStatus}
                label="Nouveau statut"
                onChange={(e) => setNewStatus(e.target.value as TaskData['status'])}
              >
                <MenuItem value="TODO">
                  <Box display="flex" alignItems="center">
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: 'grey.400', 
                        mr: 1 
                      }} 
                    />
                    À faire
                  </Box>
                </MenuItem>
                <MenuItem value="IN_PROGRESS">
                  <Box display="flex" alignItems="center">
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: 'warning.main', 
                        mr: 1 
                      }} 
                    />
                    En cours
                  </Box>
                </MenuItem>
                <MenuItem value="DONE">
                  <Box display="flex" alignItems="center">
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: 'success.main', 
                        mr: 1 
                      }} 
                    />
                    Terminé
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSaveAndClose}
          disabled={saving || (!hours && newStatus === task.status)}
          startIcon={saving ? <StopIcon /> : <PlayIcon />}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};