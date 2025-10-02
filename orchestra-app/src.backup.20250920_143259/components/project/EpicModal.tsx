import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Autocomplete,
  Alert,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Epic, EpicStatus, Priority, User } from '../../types';
import { epicService } from '../../services/epic.service';
import { userService } from '../../services/user.service';

interface EpicModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (epic: Epic) => void;
  projectId: string;
  epic?: Epic | null; // null pour création, Epic pour édition
}

const EpicModal: React.FC<EpicModalProps> = ({
  open,
  onClose,
  onSave,
  projectId,
  epic,
}) => {
  const [formData, setFormData] = useState<Partial<Epic>>({
    projectId,
    title: '',
    description: '',
    businessValue: '',
    status: 'upcoming' as EpicStatus,
    priority: 'P2' as Priority,
    acceptanceCriteria: [],
    tags: [],
    estimatedStoryPoints: 0,
    color: '#2196f3',
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCriteria, setNewCriteria] = useState('');
  const [newTag, setNewTag] = useState('');

  // Chargement des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await userService.getAllUsers();
        setUsers(usersData.filter(u => u.isActive));
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    
    if (open) {
      loadUsers();
    }
  }, [open]);

  // Fonction utilitaire pour convertir les dates Firebase
  const convertFirebaseDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate(); // Timestamp Firebase
    if (typeof date === 'string') return new Date(date);
    return undefined;
  };

  // Initialisation du formulaire pour l'édition
  useEffect(() => {
    if (epic) {
      setFormData({
        ...epic,
        startDate: convertFirebaseDate(epic.startDate),
        dueDate: convertFirebaseDate(epic.dueDate),
      });
    } else {
      setFormData({
        projectId,
        title: '',
        description: '',
        businessValue: '',
        status: 'upcoming' as EpicStatus,
        priority: 'P2' as Priority,
        acceptanceCriteria: [],
        tags: [],
        estimatedStoryPoints: 0,
        color: '#2196f3',
      });
    }
    setErrors({});
  }, [epic, projectId, open]);

  const handleChange = (field: keyof Epic, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur si elle existe
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addAcceptanceCriteria = () => {
    if (newCriteria.trim()) {
      setFormData(prev => ({
        ...prev,
        acceptanceCriteria: [...(prev.acceptanceCriteria || []), newCriteria.trim()]
      }));
      setNewCriteria('');
    }
  };

  const removeAcceptanceCriteria = (index: number) => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: (prev.acceptanceCriteria || []).filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !(formData.tags || []).includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(tag => tag !== tagToRemove)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Le titre est obligatoire';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'La description est obligatoire';
    }

    if (!formData.businessValue?.trim()) {
      newErrors.businessValue = 'La valeur métier est obligatoire';
    }

    if (!formData.ownerId) {
      newErrors.ownerId = 'Le responsable est obligatoire';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      if (epic) {
        // Mise à jour
        await epicService.updateEpic(epic.id, formData);
        onSave({ ...epic, ...formData } as Epic);
      } else {
        // Création
        const epicId = await epicService.createEpic({
          ...formData,
          taskIds: [],
          progress: 0,
          taskCount: 0,
          completedTaskCount: 0,
          createdBy: 'current-user', // TODO: récupérer l'utilisateur connecté
        } as Omit<Epic, 'id' | 'createdAt' | 'updatedAt'>);
        
        const newEpic = await epicService.getEpicById(epicId);
        if (newEpic) {
          onSave(newEpic);
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving epic:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: 'upcoming', label: '⏳ À venir', color: 'info' },
    { value: 'in_progress', label: '🚀 En cours', color: 'primary' },
    { value: 'completed', label: '✅ Terminé', color: 'success' },
  ];

  const priorityOptions = [
    { value: 'P0', label: '🔴 Critique', color: 'error' },
    { value: 'P1', label: '🟠 Haute', color: 'warning' },
    { value: 'P2', label: '🟡 Moyenne', color: 'info' },
    { value: 'P3', label: '⚪ Basse', color: 'default' },
  ];

  const colorOptions = [
    { value: '#2196f3', label: 'Bleu' },
    { value: '#4caf50', label: 'Vert' },
    { value: '#ff9800', label: 'Orange' },
    { value: '#f44336', label: 'Rouge' },
    { value: '#9c27b0', label: 'Violet' },
    { value: '#795548', label: 'Brun' },
  ];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { minHeight: '80vh' } }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <BusinessIcon color="primary" />
            <Typography variant="h6">
              {epic ? 'Modifier l\'Epic' : 'Nouvel Epic'}
            </Typography>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {/* Informations de base */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Typography variant="h6" gutterBottom>
              📋 Informations de base
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              fullWidth
              label="Titre de l'Epic"
              value={formData.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              error={!!errors.title}
              helperText={errors.title || 'Nom court et descriptif de l\'epic'}
              required
            />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              fullWidth
              label="Code"
              value={formData.code || ''}
              onChange={(e) => handleChange('code', e.target.value)}
              placeholder="EP-001"
              helperText="Code unique (généré automatiquement si vide)"
            />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              error={!!errors.description}
              helperText={errors.description || 'Description détaillée de l\'epic'}
              required
            />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Valeur Métier"
              value={formData.businessValue || ''}
              onChange={(e) => handleChange('businessValue', e.target.value)}
              error={!!errors.businessValue}
              helperText={errors.businessValue || 'Pourquoi cet epic est-il important ? Quelle valeur apporte-t-il ?'}
              required
            />
          </Box>

          {/* Statut et priorité */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              🎯 Statut et Priorité
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <FormControl fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select
                value={formData.status || 'draft'}
                onChange={(e) => handleChange('status', e.target.value)}
                label="Statut"
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <FormControl fullWidth>
              <InputLabel>Priorité</InputLabel>
              <Select
                value={formData.priority || 'P2'}
                onChange={(e) => handleChange('priority', e.target.value)}
                label="Priorité"
              >
                {priorityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Responsables */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              👥 Responsables
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Autocomplete
              options={users}
              getOptionLabel={(user) => `${user.displayName} (${user.email})`}
              value={users.find(u => u.id === formData.ownerId) || null}
              onChange={(_, user) => handleChange('ownerId', user?.id || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Responsable Métier *"
                  error={!!errors.ownerId}
                  helperText={errors.ownerId || 'Product Owner ou responsable métier'}
                />
              )}
            />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Autocomplete
              options={users}
              getOptionLabel={(user) => `${user.displayName} (${user.email})`}
              value={users.find(u => u.id === formData.technicalLeadId) || null}
              onChange={(_, user) => handleChange('technicalLeadId', user?.id || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Lead Technique"
                  helperText="Responsable technique de l'epic"
                />
              )}
            />
          </Box>

          {/* Planning */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              📅 Planning
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              label="Date de début"
              type="date"
              value={formData.startDate ? formData.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('startDate', e.target.value ? new Date(e.target.value) : null)}
              fullWidth
              helperText="Date prévue de début des travaux"
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              label="Date cible"
              type="date"
              value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('dueDate', e.target.value ? new Date(e.target.value) : null)}
              fullWidth
              helperText="Date cible de livraison"
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              fullWidth
              type="number"
              label="Story Points Estimés"
              value={formData.estimatedStoryPoints || 0}
              onChange={(e) => handleChange('estimatedStoryPoints', parseInt(e.target.value) || 0)}
              helperText="Estimation de la complexité"
            />
          </Box>

          {/* Visualisation */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              🎨 Visualisation
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <FormControl fullWidth>
              <InputLabel>Couleur</InputLabel>
              <Select
                value={formData.color || '#2196f3'}
                onChange={(e) => handleChange('color', e.target.value)}
                label="Couleur"
              >
                {colorOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box 
                        sx={{ 
                          width: 20, 
                          height: 20, 
                          backgroundColor: option.value,
                          borderRadius: '50%'
                        }} 
                      />
                      <Typography>{option.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <TextField
              fullWidth
              label="Icône"
              value={formData.icon || ''}
              onChange={(e) => handleChange('icon', e.target.value)}
              placeholder="🚀"
              helperText="Emoji ou nom d'icône"
            />
          </Box>

          {/* Critères d'acceptation */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  ✅ Critères d'Acceptation ({(formData.acceptanceCriteria || []).length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      label="Nouveau critère"
                      value={newCriteria}
                      onChange={(e) => setNewCriteria(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAcceptanceCriteria()}
                      placeholder="En tant que... Je veux... Afin de..."
                    />
                    <Button
                      variant="outlined"
                      onClick={addAcceptanceCriteria}
                      disabled={!newCriteria.trim()}
                    >
                      <AddIcon />
                    </Button>
                  </Stack>

                  {(formData.acceptanceCriteria || []).map((criteria, index) => (
                    <Stack key={index} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {index + 1}. {criteria}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => removeAcceptanceCriteria(index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  ))}

                  {(formData.acceptanceCriteria || []).length === 0 && (
                    <Alert severity="info">
                      Ajoutez des critères d'acceptation pour définir clairement ce qui constitue la réussite de cet epic.
                    </Alert>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>

          {/* Tags */}
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  🏷️ Tags ({(formData.tags || []).length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      label="Nouveau tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      placeholder="frontend, api, mobile..."
                    />
                    <Button
                      variant="outlined"
                      onClick={addTag}
                      disabled={!newTag.trim()}
                    >
                      <AddIcon />
                    </Button>
                  </Stack>

                  <Box>
                    {(formData.tags || []).map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={() => removeTag(tag)}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Enregistrement...' : epic ? 'Modifier' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EpicModal;