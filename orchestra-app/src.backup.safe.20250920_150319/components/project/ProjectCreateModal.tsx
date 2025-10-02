import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Alert,
  Box,
  IconButton,
  Typography,
  Divider,
  Stack,
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import { projectService } from '../../services/project.service';
import { ProjectStatus, Priority, ProjectCategory } from '../../types';

interface ProjectFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: ProjectStatus;
  priority: Priority;
  category: ProjectCategory;
  sponsor: string;
  projectManager: string;
}

interface ProjectCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<ProjectFormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      budget: 0,
      status: 'draft',
      priority: 'P2',
      category: 'IT',
      sponsor: '',
      projectManager: '',
    },
  });

  const startDate = watch('startDate');

  const handleClose = () => {
    if (!loading) {
      reset();
      setError('');
      onClose();
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    setLoading(true);
    setError('');

    try {
      await projectService.createProject({
        name: data.name,
        description: data.description,
        code: `PRJ-${Date.now()}`,
        startDate: new Date(data.startDate),
        dueDate: new Date(data.endDate),
        budget: data.budget,
        status: data.status,
        priority: data.priority,
        progress: 0,
        teamMembers: [],
        sponsor: data.sponsor,
        projectManager: data.projectManager,
        tags: [],
        category: data.category,
        methodology: 'agile',
      });
      
      reset();
      setError('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du projet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 2,
        }}
      >
        <Typography variant="h6" component="div">
          Nouveau Projet
        </Typography>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ py: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            {/* Première ligne - Nom et catégorie */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="name"
                control={control}
                rules={{
                  required: 'Le nom du projet est requis',
                  minLength: {
                    value: 3,
                    message: 'Le nom doit contenir au moins 3 caractères'
                  },
                  maxLength: {
                    value: 100,
                    message: 'Le nom ne peut pas dépasser 100 caractères'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Nom du projet"
                    autoFocus
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    disabled={loading}
                  />
                )}
              />

              <Controller
                name="category"
                control={control}
                rules={{
                  required: 'La catégorie est requise'
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    select
                    label="Catégorie"
                    error={!!errors.category}
                    helperText={errors.category?.message}
                    disabled={loading}
                  >
                    <MenuItem value="IT">Informatique</MenuItem>
                    <MenuItem value="HR">Ressources Humaines</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Compliance">Conformité</MenuItem>
                    <MenuItem value="Other">Autre</MenuItem>
                  </TextField>
                )}
              />
            </Stack>

            {/* Description */}
            <Controller
              name="description"
              control={control}
              rules={{
                required: 'La description est requise',
                minLength: {
                  value: 10,
                  message: 'La description doit contenir au moins 10 caractères'
                }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Description"
                  multiline
                  rows={4}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  disabled={loading}
                />
              )}
            />

            <Divider>
              <Typography variant="body2" color="text.secondary">
                Planning et Budget
              </Typography>
            </Divider>

            {/* Dates */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="startDate"
                control={control}
                rules={{
                  required: 'La date de début est requise',
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Date de début"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.startDate}
                    helperText={errors.startDate?.message}
                    disabled={loading}
                  />
                )}
              />

              <Controller
                name="endDate"
                control={control}
                rules={{
                  required: 'La date de fin est requise',
                  validate: (value) => {
                    if (new Date(value) <= new Date(startDate)) {
                      return 'La date de fin doit être postérieure à la date de début';
                    }
                    return true;
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Date de fin"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.endDate}
                    helperText={errors.endDate?.message}
                    disabled={loading}
                  />
                )}
              />
            </Stack>

            {/* Budget et Priorité */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="budget"
                control={control}
                rules={{
                  required: 'Le budget est requis',
                  min: {
                    value: 0,
                    message: 'Le budget ne peut pas être négatif'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Budget (€)"
                    type="number"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={!!errors.budget}
                    helperText={errors.budget?.message}
                    disabled={loading}
                  />
                )}
              />

              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    select
                    label="Priorité"
                    error={!!errors.priority}
                    helperText={errors.priority?.message}
                    disabled={loading}
                  >
                    <MenuItem value="P0">P0 - Critique</MenuItem>
                    <MenuItem value="P1">P1 - Élevée</MenuItem>
                    <MenuItem value="P2">P2 - Moyenne</MenuItem>
                    <MenuItem value="P3">P3 - Faible</MenuItem>
                  </TextField>
                )}
              />
            </Stack>

            <Divider>
              <Typography variant="body2" color="text.secondary">
                Responsabilités
              </Typography>
            </Divider>

            {/* Sponsor et Chef de projet */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="sponsor"
                control={control}
                rules={{
                  required: 'Le sponsor est requis'
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Sponsor du projet"
                    error={!!errors.sponsor}
                    helperText={errors.sponsor?.message}
                    disabled={loading}
                  />
                )}
              />

              <Controller
                name="projectManager"
                control={control}
                rules={{
                  required: 'Le chef de projet est requis'
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Chef de projet"
                    error={!!errors.projectManager}
                    helperText={errors.projectManager?.message}
                    disabled={loading}
                  />
                )}
              />
            </Stack>

            {/* Statut */}
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  select
                  label="Statut"
                  error={!!errors.status}
                  helperText={errors.status?.message}
                  disabled={loading}
                >
                  <MenuItem value="draft">Brouillon</MenuItem>
                  <MenuItem value="planning">Planification</MenuItem>
                  <MenuItem value="active">Actif</MenuItem>
                  <MenuItem value="on_hold">En pause</MenuItem>
                  <MenuItem value="completed">Terminé</MenuItem>
                  <MenuItem value="cancelled">Annulé</MenuItem>
                </TextField>
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            variant="outlined"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={loading || !isValid}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {loading ? 'Création...' : 'Créer le projet'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};