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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Stack,
  IconButton,
  Card,
  CardContent,
  Rating,
  Alert,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { Skill, SkillCategory, User } from '../../types';
import { skillManagementService } from '../../services/skill-management.service';

interface SkillEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (skills: Skill[]) => void;
  user?: User;
  initialSkills?: Skill[];
}

// Compétences maintenant chargées dynamiquement depuis le service

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  technical: 'Technique',
  management: 'Management',
  domain: 'Métier/Domaine',
  methodology: 'Méthodologique',
  soft: 'Soft Skills',
  language: 'Langues'
};

export const SkillEditor: React.FC<SkillEditorProps> = ({
  open,
  onClose,
  onSave,
  user,
  initialSkills = []
}) => {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<SkillCategory>('technical');
  const [newSkillLevel, setNewSkillLevel] = useState<1 | 2 | 3>(1);
  const [availableSkills, setAvailableSkills] = useState<Record<SkillCategory, string[]>>({
    technical: [],
    management: [],
    domain: [],
    methodology: [],
    soft: [],
    language: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSkills(initialSkills);
  }, [initialSkills, open]);

  // Charger les compétences depuis le service
  useEffect(() => {
    const loadSkills = async () => {
      if (!open) return;
      
      try {
        setLoading(true);
        await skillManagementService.initializeDefaultSkills();
        const allSkills = await skillManagementService.getAllSkills();
        
        const skillsByCategory: Record<SkillCategory, string[]> = {
          technical: [],
          management: [],
          domain: [],
          methodology: [],
          soft: [],
          language: []
        };
        
        allSkills.forEach(skill => {
          skillsByCategory[skill.category].push(skill.name);
        });
        
        setAvailableSkills(skillsByCategory);
      } catch (error) {
        
      } finally {
        setLoading(false);
      }
    };

    loadSkills();
  }, [open]);

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;

    try {
      // Enregistrer la compétence dans le service global
      await skillManagementService.createSkill({
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: `Compétence ${newSkillCategory}`
      });

      const newSkill: Skill = {
        id: Date.now().toString(),
        name: newSkillName.trim(),
        level: newSkillLevel,
        category: newSkillCategory,
        lastUsed: new Date()
      };

      setSkills([...skills, newSkill]);
      setNewSkillName('');
      setNewSkillLevel(1);

      // Recharger les compétences pour mettre à jour la liste
      const updatedSkills = await skillManagementService.getAllSkills();
      const skillsByCategory: Record<SkillCategory, string[]> = {
        technical: [],
        management: [],
        domain: [],
        methodology: [],
        soft: [],
        language: []
      };
      
      updatedSkills.forEach(skill => {
        skillsByCategory[skill.category].push(skill.name);
      });
      
      setAvailableSkills(skillsByCategory);
    } catch (error) {
      
    }
  };

  const handleAddPredefinedSkill = async (skillName: string, category: SkillCategory) => {
    const existingSkill = skills.find(s => s.name === skillName);
    if (existingSkill) return;

    try {
      // Enregistrer la compétence dans le service global
      await skillManagementService.createSkill({
        name: skillName,
        category,
        description: `Compétence ${category}`
      });

      const newSkill: Skill = {
        id: Date.now().toString(),
        name: skillName,
        level: 1,
        category,
        lastUsed: new Date()
      };

      setSkills([...skills, newSkill]);
    } catch (error) {
      
    }
  };

  const handleUpdateSkillLevel = (skillId: string, level: 1 | 2 | 3) => {
    setSkills(skills.map(skill => 
      skill.id === skillId 
        ? { ...skill, level, lastUsed: new Date() }
        : skill
    ));
  };

  const handleRemoveSkill = (skillId: string) => {
    setSkills(skills.filter(skill => skill.id !== skillId));
  };

  const handleSave = () => {
    onSave(skills);
    onClose();
  };

  const getSkillsByCategory = (category: SkillCategory) => {
    return skills.filter(skill => skill.category === category);
  };

  const getLevelLabel = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1: return 'Débutant';
      case 2: return 'Intermédiaire';
      case 3: return 'Expert';
      default: return 'Non défini';
    }
  };

  const getLevelColor = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1: return 'primary';
      case 2: return 'warning';
      case 3: return 'success';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EditIcon />
          <Typography variant="h6">
            Gestion des compétences - {user?.displayName || 'Utilisateur'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Attribuez des compétences avec un niveau de 1 à 3 étoiles. 
            Ces compétences seront utilisées pour l'assignation des tâches et le tableau de bord opérationnel.
          </Alert>

          {/* Formulaire d'ajout */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ajouter une compétence
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Autocomplete
                  freeSolo
                  loading={loading}
                  options={availableSkills[newSkillCategory]}
                  value={newSkillName}
                  onChange={(_, value) => setNewSkillName(value || '')}
                  onInputChange={(_, value) => setNewSkillName(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Nom de la compétence"
                      sx={{ minWidth: 200 }}
                      placeholder={loading ? "Chargement..." : "Sélectionner ou saisir une compétence"}
                    />
                  )}
                  sx={{ flexGrow: 1 }}
                />

                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel>Catégorie</InputLabel>
                  <Select
                    value={newSkillCategory}
                    label="Catégorie"
                    onChange={(e) => setNewSkillCategory(e.target.value as SkillCategory)}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ minWidth: 100 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Niveau
                  </Typography>
                  <Rating
                    value={newSkillLevel}
                    onChange={(_, value) => setNewSkillLevel((value as 1 | 2 | 3) || 1)}
                    max={3}
                    icon={<StarIcon fontSize="inherit" />}
                    emptyIcon={<StarBorderIcon fontSize="inherit" />}
                  />
                </Box>

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddSkill}
                  disabled={!newSkillName.trim()}
                >
                  Ajouter
                </Button>
              </Stack>

              {/* Suggestions de compétences */}
              {!loading && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Compétences disponibles pour {CATEGORY_LABELS[newSkillCategory]} :
                  </Typography>
                  {availableSkills[newSkillCategory].length > 0 ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {availableSkills[newSkillCategory]
                        .filter(skillName => !skills.some(s => s.name === skillName))
                        .map(skillName => (
                          <Chip
                            key={skillName}
                            label={skillName}
                            variant="outlined"
                            size="small"
                            onClick={() => handleAddPredefinedSkill(skillName, newSkillCategory)}
                            sx={{ cursor: 'pointer', mb: 0.5 }}
                          />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Aucune compétence disponible pour cette catégorie. Saisissez-en une nouvelle ci-dessus.
                    </Typography>
                  )}
                  
                  {/* Debug info - à enlever plus tard */}
                  <Typography variant="caption" color="info.main" sx={{ mt: 1, display: 'block' }}>
                    📊 {availableSkills[newSkillCategory].length} compétence(s) chargée(s) pour {newSkillCategory}
                  </Typography>
                </Box>
              )}
              
              {loading && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    ⏳ Chargement des compétences disponibles...
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Liste des compétences par catégorie */}
          {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
            const categorySkills = getSkillsByCategory(category as SkillCategory);
            if (categorySkills.length === 0) return null;

            return (
              <Card key={category} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    {label} ({categorySkills.length})
                  </Typography>
                  
                  <Stack spacing={2}>
                    {categorySkills.map((skill) => (
                      <Box
                        key={skill.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          backgroundColor: 'background.paper'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ mr: 2, minWidth: 150 }}>
                            {skill.name}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                            <Rating
                              value={skill.level}
                              onChange={(_, value) => 
                                handleUpdateSkillLevel(skill.id, (value as 1 | 2 | 3) || 1)
                              }
                              max={3}
                              icon={<StarIcon fontSize="inherit" />}
                              emptyIcon={<StarBorderIcon fontSize="inherit" />}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              {getLevelLabel(skill.level)}
                            </Typography>
                          </Box>
                          
                          <Chip
                            label={`${skill.level} ⭐`}
                            size="small"
                            color={getLevelColor(skill.level) as any}
                          />
                        </Box>

                        <IconButton
                          onClick={() => handleRemoveSkill(skill.id)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          {skills.length === 0 && (
            <Alert severity="warning">
              Aucune compétence définie. Commencez par ajouter des compétences à cette ressource.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Annuler
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          startIcon={<EditIcon />}
        >
          Enregistrer les compétences ({skills.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};