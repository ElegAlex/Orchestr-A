import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Restore as RestoreIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Project, ProjectStatus, Priority, ProjectCategory } from '../../types';
import { projectService } from '../../services/project.service';
// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
// import { fr } from 'date-fns/locale';

interface ProjectSettingsProps {
  project: Project;
  onUpdate: () => void;
}

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ project, onUpdate }) => {
  const [formData, setFormData] = useState(project);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleInputChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Nettoyer les valeurs undefined pour Firebase
      const cleanedData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined)
      );
      
      const updatedProject = {
        ...cleanedData,
        updatedAt: new Date()
      };
      
      await projectService.updateProject(project.id, updatedProject);
      onUpdate();
    } catch (error) {
      
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleArchive = async () => {
    try {
      await projectService.updateProject(project.id, {
        ...project,
        status: 'cancelled',
        updatedAt: new Date()
      });
      onUpdate();
    } catch (error) {
      
    }
  };

  const handleDelete = async () => {
    try {
      await projectService.deleteProject(project.id);
      // Redirection sera gérée par le parent
    } catch (error) {
      
    }
    setDeleteDialogOpen(false);
  };

  return (
    <Box>
      <Stack spacing={3}>
        {/* Informations générales */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Informations générales
            </Typography>
            
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Nom du projet"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Code du projet"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Statut"
                  >
                    <MenuItem value="draft">Brouillon</MenuItem>
                    <MenuItem value="planning">Planification</MenuItem>
                    <MenuItem value="active">Actif</MenuItem>
                    <MenuItem value="on_hold">En pause</MenuItem>
                    <MenuItem value="completed">Terminé</MenuItem>
                    <MenuItem value="cancelled">Annulé</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Priorité</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    label="Priorité"
                  >
                    <MenuItem value="P0">P0 - Critique</MenuItem>
                    <MenuItem value="P1">P1 - High</MenuItem>
                    <MenuItem value="P2">P2 - Medium</MenuItem>
                    <MenuItem value="P3">P3 - Low</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Catégorie</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    label="Catégorie"
                  >
                    <MenuItem value="IT">IT</MenuItem>
                    <MenuItem value="HR">HR</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Compliance">Compliance</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Planification */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Planification
            </Typography>
            
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  value={new Date(formData.startDate).toISOString().split('T')[0]}
                  onChange={(e) => handleInputChange('startDate', new Date(e.target.value))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin"
                  value={formData.dueDate ? new Date(formData.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleInputChange('dueDate', new Date(e.target.value))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Méthodologie</InputLabel>
                  <Select
                    value={formData.methodology}
                    onChange={(e) => handleInputChange('methodology', e.target.value)}
                    label="Méthodologie"
                  >
                    <MenuItem value="waterfall">Waterfall</MenuItem>
                    <MenuItem value="agile">Agile</MenuItem>
                    <MenuItem value="hybrid">Hybrid</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Progression (%)"
                  value={formData.progress}
                  onChange={(e) => handleInputChange('progress', Number(e.target.value))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Budget
            </Typography>
            
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Budget total (€)"
                  value={formData.budget || ''}
                  onChange={(e) => handleInputChange('budget', Number(e.target.value))}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Budget dépensé (€)"
                  value={formData.spentBudget || ''}
                  onChange={(e) => handleInputChange('spentBudget', Number(e.target.value))}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Responsabilités */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Responsabilités
            </Typography>
            
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Sponsor"
                  value={formData.sponsor}
                  onChange={(e) => handleInputChange('sponsor', e.target.value)}
                />
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  fullWidth
                  label="Chef de projet"
                  value={formData.projectManager}
                  onChange={(e) => handleInputChange('projectManager', e.target.value)}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tags
            </Typography>
            
            <Box mb={2}>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nouveau tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                </Box>
                <Box>
                  <Button
                    variant="outlined"
                    onClick={handleAddTag}
                    startIcon={<AddIcon />}
                    disabled={!newTag.trim()}
                  >
                    Ajouter
                  </Button>
                </Box>
              </Box>
            </Box>
            
            <Box display="flex" flexWrap="wrap" gap={1}>
              {formData.tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  deleteIcon={<CloseIcon />}
                />
              ))}
            </Box>
            
            {formData.tags.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun tag défini
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Actions
            </Typography>
            
            <Stack spacing={2}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={onUpdate}
                >
                  Annuler les modifications
                </Button>
              </Box>
              
              <Divider />
              
              <Box display="flex" gap={2}>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<ArchiveIcon />}
                  onClick={handleArchive}
                  disabled={formData.status === 'cancelled'}
                >
                  Archiver le projet
                </Button>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Supprimer le projet
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Informations système */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Informations système
            </Typography>
            
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="caption" color="text.secondary">
                  Créé le
                </Typography>
                <Typography variant="body2">
                  {new Date(project.createdAt).toLocaleDateString('fr-FR')}
                </Typography>
              </Box>
              
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="caption" color="text.secondary">
                  Dernière modification
                </Typography>
                <Typography variant="body2">
                  {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Stack>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Cette action est irréversible !
          </Alert>
          <Typography>
            Êtes-vous sûr de vouloir supprimer définitivement le projet "{project.name}" ?
            Toutes les données associées (tâches, documents, etc.) seront perdues.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Supprimer définitivement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectSettings;