import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Snackbar,
  Stack,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Timer as TimerIcon,
  Add as AddIcon,
  Save as SaveIcon,
  AccessTime as TimeIcon,
  TrendingUp,
  PlayArrow,
  Speed,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { taskService } from '../../services/task.service';
import { projectService } from '../../services/project.service';
import { Task, TimeEntry } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuickTimeEntryWidgetProps {
  onTimeLogged?: () => void;
}

export const QuickTimeEntryWidget: React.FC<QuickTimeEntryWidgetProps> = ({ 
  onTimeLogged 
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{[key: string]: string}>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [weekTotal, setWeekTotal] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  
  const quickTimeOptions = [0.5, 1, 1.5, 2, 4];
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadMyActiveTasks();
    loadTodayStats();
  }, [user?.id]);

  const loadMyActiveTasks = async () => {
    if (!user?.id) return;
    
    try {
      // Utiliser la nouvelle méthode qui gère le système RACI
      const allMyTasks = await taskService.getMyResponsibleTasks(user.id);
      const activeTasks = allMyTasks.filter(task => 
        task.status === 'IN_PROGRESS' || task.status === 'TODO'
      ).slice(0, 10); // Limiter à 10 tâches les plus récentes
      setMyTasks(activeTasks);
      
      // Charger les noms des projets
      const projectMap: {[key: string]: string} = {};
      const projectIds = Array.from(new Set(activeTasks
        .map(task => task.projectId)
        .filter((id): id is string => id !== undefined)
      ));

      for (const projectId of projectIds) {
        try {
          const project = await projectService.getProject(projectId);
          if (project) {
            projectMap[projectId] = project.name;
          }
        } catch (error) {
          projectMap[projectId] = 'Projet inconnu';
        }
      }
      setProjects(projectMap);
      
      // Auto-sélectionner la première tâche en cours
      const inProgressTask = activeTasks.find(t => t.status === 'IN_PROGRESS');
      if (inProgressTask) {
        setSelectedTaskId(inProgressTask.id);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des tâches:', error);
    }
  };

  const loadTodayStats = async () => {
    if (!user?.id) return;
    
    try {
      // Calculer le total du jour et de la semaine
      const allTasks = await taskService.getMyResponsibleTasks(user.id);
      let todayHours = 0;
      let weekHours = 0;
      
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lundi
      
      for (const task of allTasks) {
        const timeEntries = await taskService.getTimeEntries(task.id);
        const userEntries = timeEntries.filter(entry => entry.userId === user.id);
        
        for (const entry of userEntries) {
          const entryDate = new Date(entry.date);
          
          // Aujourd'hui
          if (entryDate.toDateString() === today.toDateString()) {
            todayHours += entry.hours;
          }
          
          // Cette semaine
          if (entryDate >= startOfWeek && entryDate <= today) {
            weekHours += entry.hours;
          }
        }
      }
      
      setTodayTotal(todayHours);
      setWeekTotal(weekHours);
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
    }
  };

  const handleQuickTimeEntry = async (quickHours: number) => {
    if (!selectedTaskId) {
      setSuccessMessage('Veuillez sélectionner une tâche');
      return;
    }
    
    await saveTimeEntry(quickHours.toString(), `Saisie rapide ${quickHours}h`);
  };

  const handleManualSave = async () => {
    if (!selectedTaskId || !hours || parseFloat(hours) <= 0) {
      setSuccessMessage('Veuillez remplir tous les champs');
      return;
    }
    
    await saveTimeEntry(hours, description);
  };

  const saveTimeEntry = async (hoursValue: string, desc: string) => {
    setSaving(true);
    
    try {
      const timeEntry: Omit<TimeEntry, 'id' | 'taskId' | 'createdAt' | 'updatedAt'> = {
        userId: user?.id || '',
        hours: parseFloat(hoursValue),
        date: new Date(selectedDate),
        description: desc.trim() || undefined,
        type: 'development'
      };
      
      await taskService.logTime(selectedTaskId, timeEntry);
      
      // Reset form
      if (expanded) {
        setHours('');
        setDescription('');
      }
      
      // Refresh stats
      await loadTodayStats();
      
      // Notify parent
      if (onTimeLogged) {
        onTimeLogged();
      }
      
      setSuccessMessage(`✅ ${hoursValue}h enregistrées avec succès !`);
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setSuccessMessage('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getSelectedTask = () => {
    return myTasks.find(task => task.id === selectedTaskId);
  };

  return (
    <>
      <Card sx={{ mb: 3 }} className="quick-time-entry-widget">
        <CardContent sx={{ pb: 2 }}>
          {/* Header avec stats */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TimerIcon color="primary" />
              Saisie du Temps
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box textAlign="center">
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                  {todayTotal.toFixed(1)}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Aujourd'hui
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                  {weekTotal.toFixed(1)}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cette semaine
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Sélection de tâche */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Sélectionner une tâche</InputLabel>
            <Select
              value={selectedTaskId}
              label="Sélectionner une tâche"
              onChange={(e) => setSelectedTaskId(e.target.value)}
            >
              {myTasks.map((task) => (
                <MenuItem key={task.id} value={task.id}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                    <Box>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {task.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {task.projectId ? (projects[task.projectId] || 'Projet inconnu') : 'Tâche simple'}
                      </Typography>
                    </Box>
                    <Chip 
                      label={task.status === 'IN_PROGRESS' ? 'En cours' : 'À faire'}
                      size="small"
                      color={task.status === 'IN_PROGRESS' ? 'warning' : 'default'}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sélecteur de date rapide */}
          <Box mb={2}>
            <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Speed fontSize="small" />
              Date & Temps rapide
            </Typography>
            <Stack spacing={1}>
              {/* Raccourcis de date */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant={selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  sx={{ minWidth: 'auto', px: 1.5, fontSize: '0.75rem' }}
                >
                  Aujourd'hui
                </Button>
                <Button
                  variant={selectedDate === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setSelectedDate(format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'))}
                  sx={{ minWidth: 'auto', px: 1.5, fontSize: '0.75rem' }}
                >
                  Hier
                </Button>
              </Stack>
              
              {/* Boutons temps rapide */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {quickTimeOptions.map((hours) => (
                  <Button
                    key={hours}
                    variant="outlined"
                    size="small"
                    disabled={!selectedTaskId || saving}
                    onClick={() => handleQuickTimeEntry(hours)}
                    sx={{ minWidth: 'auto', px: 2 }}
                  >
                    +{hours}h
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Box>

          {/* Zone étendue pour saisie détaillée */}
          <Box>
            <Button
              size="small"
              variant="text"
              onClick={() => setExpanded(!expanded)}
              startIcon={expanded ? <TimerIcon /> : <AddIcon />}
              sx={{ mb: expanded ? 2 : 0 }}
            >
              {expanded ? 'Saisie simplifiée' : 'Saisie détaillée'}
            </Button>

            {expanded && (
              <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                <Stack spacing={2} mb={2}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <TextField
                      size="small"
                      label="Date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 140 }}
                      disabled={saving}
                    />
                    <TextField
                      size="small"
                      label="Heures"
                      type="number"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      inputProps={{ min: 0.1, max: 24, step: 0.5 }}
                      sx={{ width: 100 }}
                      disabled={saving}
                    />
                    <TextField
                      size="small"
                      label="Description (optionnelle)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Qu'avez-vous fait ?"
                      sx={{ flex: 1 }}
                      disabled={saving}
                    />
                  </Stack>
                  <Box display="flex" justifyContent="flex-end">
                    <Button
                      variant="contained"
                      onClick={handleManualSave}
                      disabled={!selectedTaskId || !hours || parseFloat(hours) <= 0 || saving}
                      startIcon={saving ? <LinearProgress /> : <SaveIcon />}
                      size="small"
                    >
                      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            )}
          </Box>

          {/* Informations sur la tâche sélectionnée */}
          {selectedTaskId && getSelectedTask() && (
            <Alert 
              severity="info" 
              sx={{ mt: 2 }}
              icon={<PlayArrow />}
            >
              <Typography variant="body2">
                <strong>{getSelectedTask()?.title}</strong>
                {getSelectedTask()?.loggedHours && (
                  <span style={{ marginLeft: 8 }}>
                    • {getSelectedTask()?.loggedHours?.toFixed(1)}h déjà saisies
                    {getSelectedTask()?.estimatedHours && 
                      ` / ${getSelectedTask()?.estimatedHours?.toFixed(1)}h estimées`
                    }
                  </span>
                )}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Snackbar pour les messages */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </>
  );
};