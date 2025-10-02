import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Paper,
  Rating,
  Avatar
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { RequiredSkill, SkillCategory } from '../../types';
import { skillManagementService } from '../../services/skill-management.service';

// Compétences maintenant chargées dynamiquement depuis le service

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  technical: 'Technique',
  management: 'Management',
  domain: 'Métier/Domaine',
  methodology: 'Méthodologique',
  soft: 'Soft Skills',
  language: 'Langues'
};

interface SkillSelectorProps {
  value: RequiredSkill[];
  onChange: (skills: RequiredSkill[]) => void;
  label?: string;
  placeholder?: string;
  availablePeople?: { id: string; name: string; skills: { name: string; level: 1 | 2 | 3 }[] }[];
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  value = [],
  onChange,
  label = "Compétences requises",
  placeholder = "Sélectionner des compétences...",
  availablePeople = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('technical');
  const [newSkillName, setNewSkillName] = useState('');
  const [availableSkills, setAvailableSkills] = useState<Record<SkillCategory, string[]>>({
    technical: [],
    management: [],
    domain: [],
    methodology: [],
    soft: [],
    language: []
  });
  const [loading, setLoading] = useState(true);

  // Charger les compétences depuis le service
  useEffect(() => {
    const loadSkills = async () => {
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
        console.error('Erreur lors du chargement des compétences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSkills();
  }, []);

  // Combiner toutes les compétences disponibles
  const allSkills = Object.values(availableSkills).flat();

  const handleAddSkill = async (skillName: string) => {
    if (!skillName || value.some(s => s.skillName === skillName)) return;

    try {
      // Enregistrer la compétence dans le service global si elle n'existe pas déjà
      await skillManagementService.createSkill({
        name: skillName,
        category: selectedCategory,
        description: `Compétence ${selectedCategory}`
      });

      const newSkill: RequiredSkill = {
        skillId: `skill-${Date.now()}`,
        skillName,
        minimumLevel: 1,
        isRequired: true
      };

      onChange([...value, newSkill]);
      setNewSkillName('');

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
      console.log('✅ Compétence ajoutée et sauvegardée:', skillName);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la compétence:', error);
    }
  };

  const handleUpdateSkillLevel = (skillId: string, level: 1 | 2 | 3) => {
    onChange(
      value.map(skill =>
        skill.skillId === skillId
          ? { ...skill, minimumLevel: level }
          : skill
      )
    );
  };

  const handleToggleRequired = (skillId: string) => {
    onChange(
      value.map(skill =>
        skill.skillId === skillId
          ? { ...skill, isRequired: !skill.isRequired }
          : skill
      )
    );
  };

  const handleRemoveSkill = (skillId: string) => {
    onChange(value.filter(skill => skill.skillId !== skillId));
  };

  const getLevelLabel = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1: return 'Débutant';
      case 2: return 'Intermédiaire'; 
      case 3: return 'Expert';
      default: return 'Non défini';
    }
  };

  const getAvailablePeopleForSkill = (skillName: string, minLevel: 1 | 2 | 3) => {
    return availablePeople.filter(person =>
      person.skills.some(skill =>
        skill.name === skillName && skill.level >= minLevel
      )
    );
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>

      {/* Sélecteur de compétence */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel size="small">Catégorie</InputLabel>
            <Select
              size="small"
              value={selectedCategory}
              label="Catégorie"
              onChange={(e) => setSelectedCategory(e.target.value as SkillCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            size="small"
            sx={{ flexGrow: 1 }}
            freeSolo
            loading={loading}
            options={availableSkills[selectedCategory]}
            value={newSkillName}
            onChange={(_, value) => {
              if (value) {
                handleAddSkill(value);
              }
            }}
            onInputChange={(_, value) => setNewSkillName(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={loading ? "Chargement..." : placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSkillName) {
                    e.preventDefault();
                    handleAddSkill(newSkillName);
                  }
                }}
              />
            )}
          />
        </Stack>
      </Box>

      {/* Liste des compétences sélectionnées */}
      <Stack spacing={2}>
        {value.map((skill) => {
          const availablePeople = getAvailablePeopleForSkill(skill.skillName, skill.minimumLevel);
          
          return (
            <Paper
              key={skill.skillId}
              variant="outlined"
              sx={{ p: 2 }}
            >
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {skill.skillName}
                    </Typography>
                    
                    <Chip
                      label={skill.isRequired ? "Requis" : "Optionnel"}
                      size="small"
                      color={skill.isRequired ? "error" : "default"}
                      onClick={() => handleToggleRequired(skill.skillId)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>

                  <Chip
                    label="Supprimer"
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleRemoveSkill(skill.skillId)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Niveau minimum :
                  </Typography>
                  <Rating
                    value={skill.minimumLevel}
                    onChange={(_, value) =>
                      handleUpdateSkillLevel(skill.skillId, (value as 1 | 2 | 3) || 1)
                    }
                    max={3}
                    icon={<StarIcon fontSize="small" />}
                    emptyIcon={<StarBorderIcon fontSize="small" />}
                  />
                  <Typography variant="body2" color="text.secondary">
                    ({getLevelLabel(skill.minimumLevel)})
                  </Typography>
                </Box>

                {/* Personnes disponibles */}
                {availablePeople.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="success.main" gutterBottom>
                      {availablePeople.length} personne(s) disponible(s) :
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {availablePeople.slice(0, 3).map((person) => {
                        const userSkill = person.skills.find(s => s.name === skill.skillName);
                        return (
                          <Box
                            key={person.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              p: 0.5,
                              bgcolor: 'success.50',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'success.200'
                            }}
                          >
                            <Avatar sx={{ width: 20, height: 20 }}>
                              <PersonIcon sx={{ fontSize: 12 }} />
                            </Avatar>
                            <Typography variant="caption">
                              {person.name}
                            </Typography>
                            {userSkill && (
                              <Box sx={{ display: 'flex' }}>
                                {Array.from({ length: 3 }, (_, i) => (
                                  <StarIcon
                                    key={i}
                                    sx={{
                                      fontSize: 10,
                                      color: i < userSkill.level ? 'gold' : 'grey.400'
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                      {availablePeople.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{availablePeople.length - 3} autres
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}

                {availablePeople.length === 0 && (
                  <Typography variant="body2" color="warning.main">
                    ⚠️ Aucune personne disponible avec ce niveau de compétence
                  </Typography>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {value.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
          Aucune compétence requise pour cette tâche.
        </Typography>
      )}
    </Box>
  );
};