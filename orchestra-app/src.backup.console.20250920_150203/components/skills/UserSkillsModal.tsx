import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Autocomplete,
  Rating,
  Chip,
  Divider,
  Avatar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { User, UserSkill, SkillCategory } from '../../types';
import { resourceService } from '../../services/resource.service';
import { skillManagementService } from '../../services/skill-management.service';

interface UserSkillsModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  userSkills: UserSkill[];
  onSkillsUpdated?: () => void;
}

interface AvailableSkill {
  id: string;
  name: string;
  category: SkillCategory;
}

export const UserSkillsModal: React.FC<UserSkillsModalProps> = ({
  open,
  onClose,
  user,
  userSkills,
  onSkillsUpdated,
}) => {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [newSkillName, setNewSkillName] = useState<AvailableSkill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user && open) {
      setSkills([...userSkills]);
      loadAvailableSkills();
    }
  }, [user, userSkills, open]);

  const loadAvailableSkills = async () => {
    try {
      const allSkills = await skillManagementService.getAllSkills();
      setAvailableSkills(allSkills.map(skill => ({
        id: skill.id,
        name: skill.name,
        category: skill.category
      })));
    } catch (err) {
      
      // Compétences par défaut si le service ne fonctionne pas
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
    if (!newSkillName || !user) return;

    const skillExists = skills.some(s => s.name === newSkillName.name);
    if (skillExists) {
      setError('Cette compétence est déjà ajoutée');
      return;
    }

    const newSkill: UserSkill = {
      id: `${user.id}-${newSkillName.id}`,
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
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      console.log('Saving skills for user:', user.id, 'Skills:', skills);
      // Sauvegarder les compétences via le service
      await resourceService.updateUserSkills(user.id, skills);
      console.log('Skills saved successfully');
      onSkillsUpdated?.();
      onClose();
    } catch (err: any) {
      
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const getLevelLabel = (level: string) => {
    const labels = {
      beginner: '1 étoile - Débutant',
      intermediate: '2 étoiles - Intermédiaire', 
      advanced: '2 étoiles - Intermédiaire',
      expert: '3 étoiles - Expert'
    };
    return labels[level as keyof typeof labels] || level;
  };

  const getLevelStars = (level: string) => {
    const stars = {
      beginner: 1,
      intermediate: 2,
      advanced: 2,
      expert: 3
    };
    return stars[level as keyof typeof stars] || 2;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar src={user?.avatarUrl} sx={{ width: 40, height: 40 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Avatar>
          <Box>
            <Typography variant="h6">
              Compétences de {user?.displayName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {user?.department}
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={loading}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Ajout de nouvelle compétence */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Ajouter une compétence
          </Typography>
          <Box display="flex" gap={1} alignItems="flex-end">
            <Autocomplete
              value={newSkillName}
              onChange={(_, newValue) => setNewSkillName(newValue)}
              options={availableSkills.filter(skill => 
                !skills.some(s => s.name === skill.name)
              )}
              getOptionLabel={(option) => option.name}
              groupBy={(option) => option.category}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Rechercher une compétence"
                  variant="outlined"
                  size="small"
                />
              )}
              sx={{ flex: 1 }}
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleAddSkill}
              disabled={!newSkillName || loading}
              startIcon={<AddIcon />}
              sx={{ minWidth: 100 }}
            >
              Ajouter
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Liste des compétences */}
        <Typography variant="h6" gutterBottom>
          Compétences actuelles ({skills.length})
        </Typography>

        {skills.length === 0 ? (
          <Box 
            sx={{ 
              textAlign: 'center', 
              py: 4,
              color: 'text.secondary'
            }}
          >
            <Typography>
              Aucune compétence ajoutée pour le moment
            </Typography>
          </Box>
        ) : (
          <List>
            {skills.map((skill, index) => (
              <ListItem
                key={`${skill.name}-${index}`}
                sx={{
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'grey.50'
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" fontWeight={500}>
                        {skill.name}
                      </Typography>
                      <Chip
                        label={skill.category}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </Box>
                  }
                  secondary={
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Niveau:
                      </Typography>
                      <Rating
                        value={getLevelStars(skill.level)}
                        max={3}
                        onChange={(_, newValue) => {
                          if (newValue) handleUpdateLevel(index, newValue);
                        }}
                        icon={<StarIcon fontSize="small" />}
                        emptyIcon={<StarBorderIcon fontSize="small" />}
                        disabled={loading}
                      />
                      <Typography variant="caption" color="text.secondary">
                        ({getLevelLabel(skill.level)})
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleDeleteSkill(index)}
                    disabled={loading}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          variant="outlined"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};