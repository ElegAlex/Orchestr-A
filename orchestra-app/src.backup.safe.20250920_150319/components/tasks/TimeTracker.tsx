import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  LinearProgress,
  Tooltip,
  Alert,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccessTime as TimeIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { Task, TimeEntry } from '../../types';
import { taskService } from '../../services/task.service';

interface TimeTrackerProps {
  task: Task;
  onTaskUpdate: (updatedTask: Task) => void;
}

interface TimerState {
  isRunning: boolean;
  startTime: Date | null;
  elapsedSeconds: number;
}

const TIME_ENTRY_TYPES = [
  { value: 'development', label: '🔧 Développement', color: '#2196f3' },
  { value: 'testing', label: '🧪 Tests', color: '#9c27b0' },
  { value: 'review', label: '👀 Revue', color: '#ff9800' },
  { value: 'documentation', label: '📚 Documentation', color: '#4caf50' },
  { value: 'meeting', label: '🤝 Réunion', color: '#795548' },
  { value: 'other', label: '➕ Autre', color: '#607d8b' },
];

export const TimeTracker: React.FC<TimeTrackerProps> = ({ task, onTaskUpdate }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [timer, setTimer] = useState<TimerState>({
    isRunning: false,
    startTime: null,
    elapsedSeconds: 0,
  });
  
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [addTimeDialogOpen, setAddTimeDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  
  const [newTimeEntry, setNewTimeEntry] = useState({
    hours: 0,
    description: '',
    type: 'development' as const,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadTimeEntries();
  }, [task.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timer.isRunning && timer.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - timer.startTime!.getTime()) / 1000);
        setTimer(prev => ({ ...prev, elapsedSeconds: elapsed }));
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timer.isRunning, timer.startTime]);

  const loadTimeEntries = async () => {
    try {
      const entries = await taskService.getTimeEntries(task.id);
      setTimeEntries(entries);
    } catch (error) {
      
    }
  };

  const startTimer = () => {
    setTimer({
      isRunning: true,
      startTime: new Date(),
      elapsedSeconds: 0,
    });
  };

  const pauseTimer = () => {
    setTimer(prev => ({ ...prev, isRunning: false }));
  };

  const stopTimer = () => {
    if (timer.elapsedSeconds > 0) {
      // Ouvrir le dialog pour enregistrer le temps
      setNewTimeEntry(prev => ({
        ...prev,
        hours: parseFloat((timer.elapsedSeconds / 3600).toFixed(2)),
        date: new Date().toISOString().split('T')[0],
      }));
      setAddTimeDialogOpen(true);
    }
    
    setTimer({
      isRunning: false,
      startTime: null,
      elapsedSeconds: 0,
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  };

  const getTypeInfo = (type: string) => {
    return TIME_ENTRY_TYPES.find(t => t.value === type) || TIME_ENTRY_TYPES[5];
  };

  const handleSaveTimeEntry = async () => {
    if (newTimeEntry.hours <= 0) {
      return;
    }

    setLoading(true);
    try {
      await taskService.logTime(task.id, {
        userId: user?.id || '',
        hours: newTimeEntry.hours,
        date: new Date(newTimeEntry.date),
        description: newTimeEntry.description,
        type: newTimeEntry.type,
      });

      // Recharger les entrées de temps
      await loadTimeEntries();
      
      // Mettre à jour la tâche avec le nouveau temps loggé
      const updatedTask = await taskService.getTask(task.id);
      if (updatedTask) {
        onTaskUpdate(updatedTask);
      }

      setAddTimeDialogOpen(false);
      setNewTimeEntry({
        hours: 0,
        description: '',
        type: 'development',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = () => {
    if (!task.estimatedHours) return 'primary';
    const progress = (task.loggedHours || 0) / task.estimatedHours;
    if (progress < 0.7) return 'success';
    if (progress < 0.9) return 'warning';
    return 'error';
  };

  const getProgressValue = () => {
    if (!task.estimatedHours) return 0;
    return Math.min(((task.loggedHours || 0) / task.estimatedHours) * 100, 100);
  };

  const totalLoggedTime = timeEntries.reduce((total, entry) => total + entry.hours, 0);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimeIcon />
            Suivi du temps
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddTimeDialogOpen(true)}
          >
            Ajouter du temps
          </Button>
        </Box>

        {/* Minuteur */}
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'background.paper' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TimerIcon color={timer.isRunning ? 'primary' : 'disabled'} />
                <Typography variant="h4" sx={{ fontFamily: 'monospace', color: timer.isRunning ? 'primary.main' : 'text.secondary' }}>
                  {formatTime(timer.elapsedSeconds)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!timer.isRunning ? (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PlayIcon />}
                    onClick={startTimer}
                  >
                    Démarrer
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<PauseIcon />}
                      onClick={pauseTimer}
                    >
                      Pause
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={stopTimer}
                    >
                      Arrêter
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {(task.loggedHours || 0).toFixed(1)}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Temps loggé
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6">
                {task.estimatedHours ? task.estimatedHours.toFixed(1) : '—'}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Estimation
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color={task.remainingHours && task.remainingHours < 0 ? 'error' : 'text.primary'}>
                {task.remainingHours ? task.remainingHours.toFixed(1) : '—'}h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Restant
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Barre de progression */}
        {task.estimatedHours && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                Progression
              </Typography>
              <Typography variant="body2">
                {getProgressValue().toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getProgressValue()}
              color={getProgressColor()}
              sx={{ height: 8, borderRadius: 4 }}
            />
            {getProgressValue() > 90 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                ⚠️ Attention : vous approchez ou dépassez l'estimation initiale
              </Alert>
            )}
          </Box>
        )}

        {/* Liste des entrées de temps */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Entrées de temps ({timeEntries.length})
          </Typography>
          {timeEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              Aucune entrée de temps enregistrée
            </Typography>
          ) : (
            <List dense>
              {timeEntries.slice(0, 5).map((entry) => {
                const typeInfo = getTypeInfo(entry.type || 'development');
                return (
                  <ListItem key={entry.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={typeInfo.label}
                            size="small"
                            sx={{ bgcolor: typeInfo.color, color: 'white' }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {entry.hours.toFixed(1)}h
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(entry.date)}
                          </Typography>
                        </Box>
                      }
                      secondary={entry.description}
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => setEditingEntry(entry)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </CardContent>

      {/* Dialog d'ajout de temps */}
      <Dialog open={addTimeDialogOpen} onClose={() => setAddTimeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter du temps</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                type="number"
                label="Heures"
                value={newTimeEntry.hours}
                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0.1, max: 24, step: 0.1 }}
              />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                value={newTimeEntry.date}
                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <FormControl fullWidth>
                <InputLabel>Type d'activité</InputLabel>
                <Select
                  value={newTimeEntry.type}
                  label="Type d'activité"
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, type: e.target.value as any })}
                >
                  {TIME_ENTRY_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description (optionnelle)"
                value={newTimeEntry.description}
                onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                placeholder="Décrivez brièvement le travail effectué..."
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTimeDialogOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTimeEntry}
            disabled={loading || newTimeEntry.hours <= 0}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};