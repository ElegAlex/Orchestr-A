import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  MenuItem,
  Grid,
  IconButton,
  Alert,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { projectService } from '../services/project.service';
import { ProjectStatus, Priority, ProjectCategory } from '../types';

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

export const ProjectCreate: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  const {
    control,
    handleSubmit,
    watch,
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
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du projet');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/projects')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          Nouveau Projet
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    >
                      <MenuItem value="IT">Informatique</MenuItem>
                      <MenuItem value="HR">Ressources Humaines</MenuItem>
                      <MenuItem value="Finance">Finance</MenuItem>
                      <MenuItem value="Compliance">Conformité</MenuItem>
                      <MenuItem value="Other">Autre</MenuItem>
                    </TextField>
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    >
                      <MenuItem value="P0">P0 - Critique</MenuItem>
                      <MenuItem value="P1">P1 - Élevée</MenuItem>
                      <MenuItem value="P2">P2 - Moyenne</MenuItem>
                      <MenuItem value="P3">P3 - Faible</MenuItem>
                    </TextField>
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
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
                    />
                  )}
                />
              </Box>

              {error && (
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                  <Alert severity="error">{error}</Alert>
                </Box>
              )}

              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/projects')}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<Save />}
                    disabled={loading || !isValid}
                  >
                    {loading ? 'Création...' : 'Créer le projet'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};