import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Autocomplete,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  CalendarToday as CalendarIcon,
  Flag as FlagIcon,
  Lightbulb as IdeaIcon,
  AutoAwesome as MagicIcon,
  CheckCircle,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { addDays } from 'date-fns';
import { objectiveService } from '../../services/objective.service';
import { taskService } from '../../services/task.service';
import { projectService } from '../../services/project.service';
import { Task, Project } from '../../types';

interface CreateObjectiveModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (objectiveId: string) => void;
  preselectedProject?: string;
  preselectedTasks?: string[];
}

const OBJECTIVE_TEMPLATES = [
  {
    id: 'feature-delivery',
    name: '🚀 Livraison de fonctionnalité',
    goal: 'Développer et livrer une nouvelle fonctionnalité utilisateur',
    duration: 14
  },
  {
    id: 'bug-fixes',
    name: '🔧 Corrections et améliorations',
    goal: 'Corriger les bugs prioritaires et améliorer la qualité',
    duration: 10
  },
  {
    id: 'technical-debt',
    name: '⚙️ Dette technique',
    goal: 'Refactoriser le code et réduire la dette technique',
    duration: 14
  },
  {
    id: 'research',
    name: '🔬 Recherche et prototypage',
    goal: 'Explorer de nouvelles solutions et créer des prototypes',
    duration: 7
  }
];

export const CreateObjectiveModal: React.FC<CreateObjectiveModalProps> = ({
  open,
  onClose,
  onCreated,
  preselectedProject,
  preselectedTasks = []
}) => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedProject, setSelectedProject] = useState(preselectedProject || '');
  const [endDate, setEndDate] = useState<Date | null>(addDays(new Date(), 14));
  const [selectedTasks, setSelectedTasks] = useState<string[]>(preselectedTasks);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTaskSelector, setShowTaskSelector] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectTasks();
    }
  }, [selectedProject]);

  const loadData = async () => {
    try {
      const projectsData = await projectService.getAllProjects();
      setProjects(projectsData);

      if (preselectedProject) {
        setSelectedProject(preselectedProject);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    }
  };

  const loadProjectTasks = async () => {
    if (!selectedProject) return;

    try {
      const projectTasks = await taskService.getTasksByProject(selectedProject);
      // Filtrer les tâches non-assignées à un objectif et pas encore terminées
      const availableProjectTasks = projectTasks.filter(task =>
        !task.sprintId && task.status !== 'DONE'
      );
      setAvailableTasks(availableProjectTasks);
    } catch (error) {
      console.error('Erreur lors du chargement des tâches:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = OBJECTIVE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setName(template.name);
      setGoal(template.goal);
      setEndDate(addDays(new Date(), template.duration));
    }
  };

  const handleSmartSuggestion = () => {
    if (!selectedProject || availableTasks.length === 0) return;

    // Sélectionner automatiquement les 8-12 tâches les plus prioritaires
    const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    const sortedTasks = [...availableTasks]
      .sort((a, b) => {
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
        return aPriority - bPriority;
      })
      .slice(0, Math.min(10, availableTasks.length));

    setSelectedTasks(sortedTasks.map(t => t.id));

    // Générer un nom intelligent
    const highPriorityCount = sortedTasks.filter(t => ['P0', 'P1'].includes(t.priority)).length;
    if (highPriorityCount > 0) {
      setName(`🎯 Sprint priorité - ${highPriorityCount} tâches critiques`);
      setGoal(`Livrer les ${highPriorityCount} tâches critiques et ${sortedTasks.length - highPriorityCount} tâches importantes`);
    } else {
      setName(`🚀 Sprint développement - ${sortedTasks.length} tâches`);
      setGoal(`Développer ${sortedTasks.length} fonctionnalités et améliorations`);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !selectedProject || !endDate) return;

    try {
      setLoading(true);

      const objectiveId = await objectiveService.createObjective({
        name: name.trim(),
        goal: goal.trim() || `Objectif : ${name.trim()}`,
        projectId: selectedProject,
        endDate,
        taskIds: selectedTasks
      });

      // Mettre à jour les tâches avec le sprintId
      if (selectedTasks.length > 0) {
        await Promise.all(
          selectedTasks.map(taskId =>
            taskService.updateTask(taskId, { sprintId: objectiveId })
          )
        );
      }

      onCreated?.(objectiveId);
      handleClose();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setGoal('');
    setSelectedProject(preselectedProject || '');
    setEndDate(addDays(new Date(), 14));
    setSelectedTasks(preselectedTasks);
    setSelectedTemplate(null);
    setShowTaskSelector(false);
    onClose();
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const canSubmit = name.trim() && selectedProject && endDate;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <IdeaIcon color="primary" />
            <Typography variant="h6">Créer un Nouvel Objectif</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Organisez votre travail sur 1-2 semaines avec un objectif clair
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Templates rapides */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                🚀 Démarrage rapide
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {OBJECTIVE_TEMPLATES.map(template => (
                  <Chip
                    key={template.id}
                    label={template.name}
                    variant={selectedTemplate === template.id ? 'filled' : 'outlined'}
                    onClick={() => handleTemplateSelect(template.id)}
                    color={selectedTemplate === template.id ? 'primary' : 'default'}
                  />
                ))}
              </Box>
            </Box>

            {/* Projet */}
            <FormControl fullWidth>
              <InputLabel>Projet</InputLabel>
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                label="Projet"
              >
                {projects.map(project => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Nom et objectif */}
            <TextField
              label="Nom de l'objectif"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              placeholder="Ex: Livrer la fonctionnalité de notifications"
              InputProps={{
                startAdornment: <FlagIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />

            <TextField
              label="Description de l'objectif"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Décrivez ce que vous voulez accomplir..."
            />

            {/* Date de fin */}
            <DatePicker
              label="Date de fin"
              value={endDate}
              onChange={setEndDate}
              minDate={new Date()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  InputProps: {
                    startAdornment: <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }
                }
              }}
            />

            {/* Sélection des tâches */}
            {selectedProject && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2">
                    🎯 Tâches à inclure ({selectedTasks.length})
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      startIcon={<MagicIcon />}
                      onClick={handleSmartSuggestion}
                      disabled={availableTasks.length === 0}
                    >
                      Suggestion auto
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setShowTaskSelector(!showTaskSelector)}
                    >
                      {showTaskSelector ? 'Masquer' : 'Choisir'}
                    </Button>
                  </Box>
                </Box>

                {selectedTasks.length > 0 && (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      ✅ <strong>{selectedTasks.length} tâches sélectionnées</strong> pour cet objectif
                      <br />Durée estimée: ~{Math.ceil(selectedTasks.length / 3)} semaines
                    </Alert>

                    {/* Preview des tâches sélectionnées */}
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'success.light', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        🎯 Tâches qui seront dans cet objectif :
                      </Typography>
                      {availableTasks
                        .filter(task => selectedTasks.includes(task.id))
                        .map(task => (
                          <Box key={task.id} display="flex" alignItems="center" gap={1} mb={0.5}>
                            <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} />
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                              {task.title}
                            </Typography>
                            <Chip
                              label={task.priority}
                              size="small"
                              color={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'default'}
                            />
                          </Box>
                        ))
                      }
                    </Box>
                  </Box>
                )}

                {showTaskSelector && (
                  <Box sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    {availableTasks.length === 0 ? (
                      <Box p={2} textAlign="center">
                        <Typography variant="body2" color="text.secondary">
                          Aucune tâche disponible dans ce projet
                        </Typography>
                      </Box>
                    ) : (
                      <List dense>
                        {availableTasks.map(task => (
                          <ListItem key={task.id} component="div" onClick={() => toggleTaskSelection(task.id)} sx={{ cursor: 'pointer' }}>
                            <ListItemIcon>
                              <Checkbox
                                checked={selectedTasks.includes(task.id)}
                                edge="start"
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={task.title}
                              secondary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip label={task.priority} size="small" color={task.priority === 'P0' ? 'error' : task.priority === 'P1' ? 'warning' : 'default'} />
                                  <Chip label={task.status} size="small" variant="outlined" />
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!canSubmit || loading}
            startIcon={<IdeaIcon />}
          >
            {loading ? 'Création...' : 'Créer l\'Objectif'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};