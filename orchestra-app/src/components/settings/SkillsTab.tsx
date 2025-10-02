import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Category as CategoryIcon,
  School as SkillIcon,
} from '@mui/icons-material';
import { SkillCategory } from '../../types';
import { skillManagementService } from '../../services/skill-management.service';

interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

const CATEGORIES = [
  { value: 'technical', label: 'Technique', color: '#1976d2' },
  { value: 'management', label: 'Management', color: '#388e3c' },
  { value: 'domain', label: 'Domaine', color: '#f57c00' },
  { value: 'methodology', label: 'Méthodologie', color: '#7b1fa2' },
];

export const SkillsTab: React.FC = () => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Modal états
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillDefinition | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'technical' as SkillCategory,
    description: ''
  });

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError('');
      const skillsData = await skillManagementService.getAllSkills(false);
      setSkills(skillsData);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des compétences');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSkillDialog = (skill?: SkillDefinition) => {
    if (skill) {
      setEditingSkill(skill);
      setFormData({
        name: skill.name,
        category: skill.category,
        description: skill.description || ''
      });
    } else {
      setEditingSkill(null);
      setFormData({
        name: '',
        category: 'technical',
        description: ''
      });
    }
    setSkillDialogOpen(true);
  };

  const handleSaveSkill = async () => {
    try {
      if (!formData.name.trim()) return;

      await skillManagementService.createSkill({
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim() || undefined,
      });

      await loadSkills();
      setSkillDialogOpen(false);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteSkill = async (skillId: string, skillName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la compétence "${skillName}" ?`)) {
      return;
    }

    try {
      await skillManagementService.deleteSkill(skillId);
      await loadSkills();
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const getCategoryInfo = (category: SkillCategory) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Gestion des Compétences
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez les compétences disponibles dans votre organisation
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenSkillDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Nouvelle Compétence
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Statistiques */}
      <Box display="flex" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        {CATEGORIES.map((category) => {
          const count = skills.filter(s => s.category === category.value).length;
          return (
            <Card key={category.value} sx={{ textAlign: 'center', p: 2, minWidth: 150 }}>
              <CategoryIcon sx={{ fontSize: 32, color: category.color, mb: 1 }} />
              <Typography variant="h4" fontWeight="bold" sx={{ color: category.color }}>
                {count}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {category.label}
              </Typography>
            </Card>
          );
        })}
      </Box>

      {/* Table des compétences */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Compétences configurées ({skills.length})
          </Typography>
          
          {skills.length === 0 ? (
            <Alert severity="info">
              Aucune compétence configurée. Cliquez sur "Nouvelle Compétence" pour commencer.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Utilisations</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {skills.map((skill) => {
                    const categoryInfo = getCategoryInfo(skill.category);
                    return (
                      <TableRow key={skill.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <SkillIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle2">
                              {skill.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={categoryInfo.label}
                            size="small"
                            sx={{
                              bgcolor: categoryInfo.color,
                              color: 'white'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {skill.description || 'Aucune description'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={skill.usageCount || 0}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <Tooltip title="Modifier">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenSkillDialog(skill)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteSkill(skill.id, skill.name)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Dialog Compétence */}
      <Dialog open={skillDialogOpen} onClose={() => setSkillDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSkill ? 'Modifier la compétence' : 'Nouvelle compétence'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ pt: 1 }}>
            <TextField
              label="Nom de la compétence"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            
            <FormControl fullWidth required>
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={formData.category}
                label="Catégorie"
                onChange={(e) => setFormData({ ...formData, category: e.target.value as SkillCategory })}
              >
                {CATEGORIES.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          bgcolor: category.color,
                          borderRadius: '50%'
                        }}
                      />
                      {category.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Description (optionnel)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSkillDialogOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSaveSkill}
            variant="contained"
            disabled={!formData.name.trim()}
          >
            {editingSkill ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};