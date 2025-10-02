import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Box,
  Typography,
  Alert,
  Autocomplete,
  FormControlLabel,
  Switch,
  Divider,
  CircularProgress,
  Avatar,
} from '@mui/material';
import {
  Bolt as BoltIcon,
  Person as PersonIcon,
  ContentCopy as CopyIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { User, Priority } from '../../types';
import { userService } from '../../services/user.service';
import { simpleTaskService, SimpleTaskData } from '../../services/simple-task.service';

interface SimpleTaskModalProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated?: (task: any) => void;
  initialDate?: Date;
  sourceTask?: any; // Pour la duplication
}

interface TaskFormData {
  title: string;
  description: string;
  dueDate: Date | null;
  priority: Priority;
  responsible: string[];
  labels: string[];
  estimatedHours: number;
  enableDuplication: boolean;
  selectedUsers: string[];
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'P0', label: 'P0 - Critique', color: '#f44336' },
  { value: 'P1', label: 'P1 - Haute', color: '#ff9800' },
  { value: 'P2', label: 'P2 - Normale', color: '#2196f3' },
  { value: 'P3', label: 'P3 - Basse', color: '#9e9e9e' },
];

export const SimpleTaskModal: React.FC<SimpleTaskModalProps> = ({
  open,
  onClose,
  onTaskCreated,
  initialDate,
  sourceTask,
}) => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([
    'urgent',
    'admin',
    'formation',
    'réunion',
    'suivi',
    'documentation'
  ]);

  // État du formulaire
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    dueDate: initialDate || null,
    priority: 'P2',
    responsible: currentUser ? [currentUser.id] : [],
    labels: [],
    estimatedHours: 1,
    enableDuplication: false,
    selectedUsers: [],
  });

  // Chargement des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await userService.getActiveUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
      }
    };

    if (open) {
      loadUsers();
    }
  }, [open]);

  // Initialisation avec tâche source (duplication)
  useEffect(() => {
    if (sourceTask) {
      setFormData({
        title: `Copie - ${sourceTask.title}`,
        description: sourceTask.description || '',
        dueDate: sourceTask.dueDate ? new Date(sourceTask.dueDate) : null,
        priority: sourceTask.priority || 'P2',
        responsible: currentUser ? [currentUser.id] : [],
        labels: sourceTask.labels || [],
        estimatedHours: sourceTask.estimatedHours || 1,
        enableDuplication: true,
        selectedUsers: [],
      });
    }
  }, [sourceTask, currentUser]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validation
      if (!formData.title.trim()) {
        throw new Error('Le titre est obligatoire');
      }

      if (!currentUser) {
        throw new Error('Utilisateur non connecté');
      }

      const taskData: SimpleTaskData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        dueDate: formData.dueDate || initialDate || new Date(),
        priority: formData.priority,
        responsible: formData.responsible,
        labels: formData.labels,
        estimatedHours: formData.estimatedHours,
      };

      if (formData.enableDuplication && formData.selectedUsers.length > 0) {
        // Mode duplication : créer une tâche pour chaque utilisateur sélectionné
        const createdTasks = await simpleTaskService.createMultipleSimpleTasks(
          taskData,
          formData.selectedUsers,
          currentUser.id
        );

        onTaskCreated?.(createdTasks);
      } else {
        // Mode création simple
        const createdTask = await simpleTaskService.createSimpleTask(taskData, currentUser.id);
        onTaskCreated?.(createdTask);
      }

      // Reset et fermeture
      resetForm();
      onClose();

    } catch (err) {
      console.error('Erreur lors de la création de la tâche:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      dueDate: initialDate || null,
      priority: 'P2',
      responsible: currentUser ? [currentUser.id] : [],
      labels: [],
      estimatedHours: 1,
      enableDuplication: false,
      selectedUsers: [],
    });
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getPriorityColor = (priority: Priority) => {
    return priorityOptions.find(p => p.value === priority)?.color || '#666';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <BoltIcon color="secondary" />
            <Typography variant="h6">
              {sourceTask ? 'Dupliquer une tâche simple' : 'Créer une tâche simple'}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            {/* Titre */}
            <TextField
              label="Titre de la tâche"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
              error={!formData.title.trim()}
              helperText={!formData.title.trim() ? 'Le titre est obligatoire' : ''}
            />

            {/* Description */}
            <TextField
              label="Description (optionnel)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Décrivez brièvement la tâche..."
            />

            {/* Date d'échéance et Priorité */}
            <Stack direction="row" spacing={2}>
              <Box flex={1}>
                <DateTimePicker
                  label="Date d'échéance"
                  value={formData.dueDate}
                  onChange={(newDate) => setFormData({ ...formData, dueDate: newDate })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'Optionnel - laissez vide si pas de date limite'
                    }
                  }}
                />
              </Box>

              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Priorité</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priorité"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                >
                  {priorityOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <FlagIcon sx={{ color: option.color, fontSize: 16 }} />
                        <Typography>{option.label}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {/* Assignation */}
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(user) => user.displayName || `${user.firstName} ${user.lastName}`}
              value={users.filter(u => formData.responsible.includes(u.id))}
              onChange={(_, selectedUsers) => {
                setFormData({
                  ...formData,
                  responsible: selectedUsers.map(u => u.id)
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Assigné à"
                  placeholder="Sélectionnez les personnes responsables"
                />
              )}
              renderTags={(tagValue, getTagProps) =>
                tagValue.map((user, index) => {
                  const { key, ...chipProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={user.id}
                      label={user.displayName || `${user.firstName} ${user.lastName}`}
                      {...chipProps}
                      avatar={<PersonIcon />}
                      size="small"
                    />
                  );
                })
              }
            />

            {/* Labels */}
            <Autocomplete
              multiple
              freeSolo
              options={availableLabels}
              value={formData.labels}
              onChange={(_, newLabels) => {
                setFormData({ ...formData, labels: newLabels });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Labels (optionnel)"
                  placeholder="Ajoutez des tags pour organiser vos tâches"
                />
              )}
              renderTags={(tagValue, getTagProps) =>
                tagValue.map((label, index) => {
                  const { key, ...chipProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={label}
                      label={label}
                      {...chipProps}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  );
                })
              }
            />

            {/* Estimation */}
            <TextField
              label="Estimation (heures)"
              type="number"
              value={formData.estimatedHours}
              onChange={(e) => setFormData({
                ...formData,
                estimatedHours: Math.max(0.5, parseFloat(e.target.value) || 1)
              })}
              inputProps={{ min: 0.5, step: 0.5 }}
              helperText="Estimation du temps nécessaire en heures"
              sx={{ maxWidth: 200 }}
            />

            {/* Section duplication */}
            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enableDuplication}
                  onChange={(e) => setFormData({
                    ...formData,
                    enableDuplication: e.target.checked,
                    selectedUsers: e.target.checked ? formData.selectedUsers : []
                  })}
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CopyIcon fontSize="small" />
                  <Typography>Dupliquer cette tâche à plusieurs personnes</Typography>
                </Stack>
              }
            />

            {formData.enableDuplication && (
              <Box sx={{ pl: 2, borderLeft: '3px solid', borderColor: 'secondary.main' }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Une tâche identique sera créée pour chaque personne sélectionnée
                </Alert>

                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">
                      Sélectionnez les destinataires ({formData.selectedUsers.length} sélectionnés)
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        const availableUsers = users.filter(u => !formData.responsible.includes(u.id));
                        setFormData({
                          ...formData,
                          selectedUsers: formData.selectedUsers.length === availableUsers.length
                            ? []
                            : availableUsers.map(u => u.id)
                        });
                      }}
                    >
                      {formData.selectedUsers.length === users.filter(u => !formData.responsible.includes(u.id)).length
                        ? 'Désélectionner tout'
                        : 'Sélectionner tout'}
                    </Button>
                  </Box>

                  <Box sx={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1
                  }}>
                    {users.filter(u => !formData.responsible.includes(u.id)).map(user => (
                      <FormControlLabel
                        key={user.id}
                        control={
                          <Switch
                            size="small"
                            checked={formData.selectedUsers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  selectedUsers: [...formData.selectedUsers, user.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  selectedUsers: formData.selectedUsers.filter(id => id !== user.id)
                                });
                              }
                            }}
                          />
                        }
                        label={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              <PersonIcon sx={{ fontSize: 16 }} />
                            </Avatar>
                            <Typography variant="body2">
                              {user.displayName || `${user.firstName} ${user.lastName}`}
                            </Typography>
                          </Stack>
                        }
                        sx={{ width: '100%', m: 0.5 }}
                      />
                    ))}
                  </Box>
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Annuler
          </Button>

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : <BoltIcon />}
            sx={{
              bgcolor: 'secondary.main',
              '&:hover': { bgcolor: 'secondary.dark' },
            }}
          >
            {loading ? 'Création...' :
             formData.enableDuplication && formData.selectedUsers.length > 0 ?
             `Créer ${formData.selectedUsers.length + 1} tâches` :
             'Créer la tâche'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};