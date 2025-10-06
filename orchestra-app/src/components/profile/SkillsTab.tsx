import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Autocomplete,
  TextField,
  Rating,
  Chip,
  Divider,
  Alert,
  Paper,
  Stack,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Code as CodeIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Language as LanguageIcon,
  Engineering as EngineeringIcon,
} from '@mui/icons-material';
import { User, UserSkill, SkillCategory } from '../../types';
import { resourceService } from '../../services/resource.service';
import { skillManagementService } from '../../services/skill-management.service';

interface SkillsTabProps {
  user: User;
  onUpdate?: () => void;
}

interface AvailableSkill {
  id: string;
  name: string;
  category: SkillCategory;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({ user, onUpdate }) => {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [newSkillName, setNewSkillName] = useState<AvailableSkill | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadUserSkills();
      loadAvailableSkills();
    }
  }, [user]);

  const loadUserSkills = async () => {
    try {
      setLoading(true);
      const userSkills = await resourceService.getUserSkills(user.id);
      setSkills(userSkills);
    } catch (err) {
      console.error('Erreur lors du chargement des compétences:', err);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSkills = async () => {
    try {
      const allSkills = await skillManagementService.getAllSkills();
      setAvailableSkills(allSkills.map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category
      })));
    } catch (err) {
      console.error('Erreur lors du chargement des compétences disponibles:', err);
      // Compétences par défaut
      setAvailableSkills([
        { id: 'react', name: 'React', category: 'technical' },
        { id: 'typescript', name: 'TypeScript', category: 'technical' },
        { id: 'python', name: 'Python', category: 'technical' },
        { id: 'javascript', name: 'JavaScript', category: 'technical' },
        { id: 'nodejs', name: 'Node.js', category: 'technical' },
        { id: 'firebase', name: 'Firebase', category: 'technical' },
        { id: 'project-management', name: 'Gestion de projet', category: 'management' },
        { id: 'agile', name: 'Méthodologie Agile', category: 'methodology' },
        { id: 'scrum', name: 'Scrum', category: 'methodology' },
        { id: 'communication', name: 'Communication', category: 'soft' },
        { id: 'leadership', name: 'Leadership', category: 'soft' },
        { id: 'anglais', name: 'Anglais', category: 'language' },
      ]);
    }
  };

  const handleAddSkill = () => {
    if (!newSkillName) return;

    const skillExists = skills.some(s => s.name === newSkillName.name);
    if (skillExists) {
      setError('Cette compétence est déjà ajoutée');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newSkill: UserSkill = {
      id: `${user.id}-${newSkillName.id}-${Date.now()}`,
      name: newSkillName.name,
      category: newSkillName.category,
      level: 'intermediate',
      yearsExperience: 1,
      selfAssessed: true,
      managerValidated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setSkills([...skills, newSkill]);
    setNewSkillName(null);
    setError('');
  };

  const handleUpdateLevel = (skillIndex: number, level: number) => {
    const levelMap: Record<number, 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
      1: 'beginner',
      2: 'intermediate',
      3: 'expert'
    };

    const updatedSkills = [...skills];
    updatedSkills[skillIndex] = {
      ...updatedSkills[skillIndex],
      level: levelMap[level]
    };
    setSkills(updatedSkills);
  };

  const handleDeleteSkill = (skillIndex: number) => {
    const updatedSkills = skills.filter((_, index) => index !== skillIndex);
    setSkills(updatedSkills);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await resourceService.updateUserSkills(user.id, skills);
      setSuccess('Compétences enregistrées avec succès !');
      if (onUpdate) onUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Erreur lors de l\'enregistrement:', err);
      setError(err.message || 'Erreur lors de l\'enregistrement des compétences');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category: SkillCategory) => {
    switch (category) {
      case 'technical':
        return <CodeIcon fontSize="small" />;
      case 'management':
        return <BusinessIcon fontSize="small" />;
      case 'soft':
        return <PeopleIcon fontSize="small" />;
      case 'language':
        return <LanguageIcon fontSize="small" />;
      case 'methodology':
        return <EngineeringIcon fontSize="small" />;
      default:
        return <CodeIcon fontSize="small" />;
    }
  };

  const getCategoryLabel = (category: SkillCategory): string => {
    const labels: Record<SkillCategory, string> = {
      technical: 'Technique',
      management: 'Management',
      soft: 'Compétence douce',
      language: 'Langue',
      methodology: 'Méthodologie',
      domain: 'Domaine'
    };
    return labels[category] || category;
  };

  const getLevelLabel = (level: string): string => {
    const labels: Record<string, string> = {
      beginner: 'Débutant',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé',
      expert: 'Expert'
    };
    return labels[level] || level;
  };

  // Grouper les compétences par catégorie
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<SkillCategory, UserSkill[]>);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Mes Compétences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Déclarez et gérez vos compétences professionnelles. Utilisez le système d'étoiles pour indiquer votre niveau.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Ajouter une nouvelle compétence */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Ajouter une compétence
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Autocomplete
            value={newSkillName}
            onChange={(event, newValue) => setNewSkillName(newValue)}
            options={availableSkills.filter(
              skill => !skills.some(s => s.name === skill.name)
            )}
            getOptionLabel={(option) => option.name}
            groupBy={(option) => getCategoryLabel(option.category)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Rechercher une compétence"
                placeholder="Tapez pour rechercher..."
                size="small"
              />
            )}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSkill}
            disabled={!newSkillName}
          >
            Ajouter
          </Button>
        </Stack>
      </Paper>

      {/* Liste des compétences par catégorie */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
          <Box key={category}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  {getCategoryIcon(category as SkillCategory)}
                  <Typography variant="subtitle1" fontWeight="bold">
                    {getCategoryLabel(category as SkillCategory)}
                  </Typography>
                  <Chip label={categorySkills.length} size="small" />
                </Stack>

                <List dense>
                  {categorySkills.map((skill, index) => {
                    const globalIndex = skills.findIndex(s => s.id === skill.id);
                    const levelValue = skill.level === 'beginner' ? 1 : skill.level === 'intermediate' ? 2 : 3;

                    return (
                      <React.Fragment key={skill.id}>
                        <ListItem
                          sx={{
                            bgcolor: 'grey.50',
                            borderRadius: 1,
                            mb: 1,
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                        >
                          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {skill.name}
                            </Typography>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleDeleteSkill(globalIndex)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            <Rating
                              value={levelValue}
                              max={3}
                              onChange={(event, newValue) => {
                                if (newValue) handleUpdateLevel(globalIndex, newValue);
                              }}
                              icon={<StarIcon fontSize="small" />}
                              emptyIcon={<StarBorderIcon fontSize="small" />}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {getLevelLabel(skill.level)}
                            </Typography>
                            {skill.managerValidated && (
                              <Chip label="Validé" size="small" color="success" sx={{ ml: 'auto' }} />
                            )}
                          </Box>
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
                </List>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {skills.length === 0 && (
        <Alert severity="info">
          Vous n'avez encore aucune compétence déclarée. Utilisez le formulaire ci-dessus pour en ajouter.
        </Alert>
      )}

      {/* Bouton d'enregistrement */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || skills.length === 0}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </Box>
    </Box>
  );
};
