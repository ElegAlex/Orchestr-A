import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  Stack,
  Divider,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  LinearProgress,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Fab,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  Add,
  Remove,
  Assessment,
  Group,
  Star,
  Warning,
  CheckCircle,
  Cancel,
  Shuffle,
  Save,
  Download,
  ExpandMore,
  Timeline,
  TrendingUp,
  Balance,
  Speed,
  Psychology,
  EmojiObjects,
  Assignment,
  PersonAdd,
  SwapHoriz,
  PlayArrow
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchUsers, fetchUserSkills } from '../../store/slices/resourceSlice';
import { User, UserSkill, SkillCategory } from '../../types';

interface TeamRequirement {
  skill: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  quantity: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  category: SkillCategory;
}

interface TeamMember {
  user: User;
  skills: UserSkill[];
  skillsMap: Record<string, UserSkill>;
  overallScore: number;
  workload: number; // 0-100%
  availability: number; // 0-100%
  collaborationScore: number;
}

interface TeamComposition {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
  requirements: TeamRequirement[];
  coverageScore: number;
  balanceScore: number;
  collaborationScore: number;
  overallScore: number;
  estimatedDuration: number; // semaines
  conflictWarnings: string[];
  recommendations: string[];
}

interface ProjectTemplate {
  name: string;
  description: string;
  requirements: TeamRequirement[];
  teamSize: { min: number; max: number };
  duration: number;
  complexity: 'low' | 'medium' | 'high';
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: "Développement Web",
    description: "Application web moderne avec React et Node.js",
    requirements: [
      { skill: "React", level: "advanced", quantity: 2, importance: "critical", category: "technical" },
      { skill: "Node.js", level: "intermediate", quantity: 1, importance: "high", category: "technical" },
      { skill: "TypeScript", level: "intermediate", quantity: 2, importance: "high", category: "technical" },
      { skill: "UI/UX Design", level: "intermediate", quantity: 1, importance: "medium", category: "technical" },
      { skill: "Gestion de projet", level: "advanced", quantity: 1, importance: "critical", category: "management" }
    ],
    teamSize: { min: 4, max: 8 },
    duration: 16,
    complexity: "medium"
  },
  {
    name: "Projet Data Science",
    description: "Analyse de données et machine learning",
    requirements: [
      { skill: "Python", level: "advanced", quantity: 2, importance: "critical", category: "technical" },
      { skill: "Machine Learning", level: "expert", quantity: 1, importance: "critical", category: "technical" },
      { skill: "SQL", level: "advanced", quantity: 1, importance: "high", category: "technical" },
      { skill: "Statistiques", level: "advanced", quantity: 1, importance: "high", category: "technical" },
      { skill: "Communication", level: "advanced", quantity: 1, importance: "medium", category: "soft" }
    ],
    teamSize: { min: 3, max: 6 },
    duration: 12,
    complexity: "high"
  },
  {
    name: "Migration Infrastructure",
    description: "Migration vers le cloud et modernisation",
    requirements: [
      { skill: "DevOps", level: "expert", quantity: 1, importance: "critical", category: "technical" },
      { skill: "Cloud (AWS/Azure)", level: "advanced", quantity: 2, importance: "critical", category: "technical" },
      { skill: "Docker", level: "intermediate", quantity: 2, importance: "high", category: "technical" },
      { skill: "Sécurité", level: "advanced", quantity: 1, importance: "high", category: "technical" },
      { skill: "Architecture", level: "expert", quantity: 1, importance: "critical", category: "technical" }
    ],
    teamSize: { min: 4, max: 7 },
    duration: 20,
    complexity: "high"
  }
];

export const TeamBuilderTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, userSkills, loading } = useAppSelector((state: any) => state.resources);

  const [activeStep, setActiveStep] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [requirements, setRequirements] = useState<TeamRequirement[]>([]);
  const [teamCompositions, setTeamCompositions] = useState<TeamComposition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [maxTeamSize, setMaxTeamSize] = useState(6);
  const [prioritizeBalance, setPrioritizeBalance] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    dispatch(fetchUsers());
    users.forEach((user: User) => {
      dispatch(fetchUserSkills(user.id));
    });
  }, [dispatch, users.length]);

  // Préparer les données des membres disponibles
  const availableMembers: TeamMember[] = useMemo(() => {
    return users.map((user: User) => {
      const skills = userSkills[user.id] || [];
      const skillsMap = skills.reduce((acc: Record<string, UserSkill>, skill: any) => {
        acc[skill.name] = skill;
        return acc;
      }, {} as Record<string, UserSkill>);

      // Calculer un score global basé sur l'expérience et les niveaux
      const overallScore = skills.reduce((sum: number, skill: any) => {
        const levelValues = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
        const levelValue = levelValues[skill.level as keyof typeof levelValues] || 1;
        return sum + levelValue * skill.yearsExperience;
      }, 0) / Math.max(skills.length, 1);

      return {
        user,
        skills,
        skillsMap,
        overallScore,
        workload: Math.random() * 80, // Simulation - à remplacer par vraies données
        availability: Math.random() * 40 + 60, // 60-100%
        collaborationScore: Math.random() * 30 + 70 // 70-100%
      };
    });
  }, [users, userSkills]);

  // Algorithme d'optimisation d'équipe
  const generateOptimalTeams = (requirements: TeamRequirement[], maxSize: number): TeamComposition[] => {
    const compositions: TeamComposition[] = [];

    // Générer plusieurs compositions avec différentes stratégies
    const strategies = [
      'coverage_first', // Prioriser la couverture des compétences
      'balance_first',  // Prioriser l'équilibre des niveaux
      'experience_first', // Prioriser l'expérience
      'availability_first' // Prioriser la disponibilité
    ];

    strategies.forEach((strategy, index) => {
      const composition = buildTeamWithStrategy(requirements, maxSize, strategy);
      if (composition) {
        composition.id = `team_${index + 1}`;
        composition.name = `Équipe ${index + 1} (${strategy.replace('_', ' ')})`;
        compositions.push(composition);
      }
    });

    return compositions.sort((a, b) => b.overallScore - a.overallScore);
  };

  const buildTeamWithStrategy = (
    requirements: TeamRequirement[],
    maxSize: number,
    strategy: string
  ): TeamComposition | null => {
    const selectedMembers: TeamMember[] = [];
    const availablePool = [...availableMembers];

    // Scores pour chaque exigence
    const requirementScores = requirements.map(req => ({
      requirement: req,
      currentCoverage: 0,
      assignedMembers: [] as TeamMember[]
    }));

    while (selectedMembers.length < maxSize && availablePool.length > 0) {
      let bestCandidate: TeamMember | null = null;
      let bestScore = -1;

      availablePool.forEach(member => {
        const score = calculateMemberScore(member, requirements, selectedMembers, strategy);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = member;
        }
      });

      if (bestCandidate) {
        selectedMembers.push(bestCandidate);
        availablePool.splice(availablePool.indexOf(bestCandidate), 1);

        // Mettre à jour la couverture des exigences
        requirements.forEach((req, reqIndex) => {
          const memberSkill = bestCandidate!.skillsMap[req.skill];
          if (memberSkill) {
            const levelValue = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[memberSkill.level];
            const requiredLevel = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[req.level];
            if (levelValue >= requiredLevel) {
              requirementScores[reqIndex].currentCoverage++;
              requirementScores[reqIndex].assignedMembers.push(bestCandidate!);
            }
          }
        });
      } else {
        break;
      }
    }

    if (selectedMembers.length === 0) return null;

    // Calculer les scores de l'équipe
    const coverageScore = calculateCoverageScore(selectedMembers, requirements);
    const balanceScore = calculateBalanceScore(selectedMembers);
    const collaborationScore = calculateCollaborationScore(selectedMembers);
    const overallScore = (coverageScore * 0.4 + balanceScore * 0.3 + collaborationScore * 0.3);

    // Générer des avertissements et recommandations
    const conflictWarnings = generateConflictWarnings(selectedMembers, requirements);
    const recommendations = generateRecommendations(selectedMembers, requirements);

    return {
      id: '',
      name: '',
      description: `Équipe optimisée avec stratégie ${strategy}`,
      members: selectedMembers,
      requirements,
      coverageScore,
      balanceScore,
      collaborationScore,
      overallScore,
      estimatedDuration: 12, // Estimation basique
      conflictWarnings,
      recommendations
    };
  };

  const calculateMemberScore = (
    member: TeamMember,
    requirements: TeamRequirement[],
    currentTeam: TeamMember[],
    strategy: string
  ): number => {
    let score = 0;

    switch (strategy) {
      case 'coverage_first':
        // Prioriser les membres qui couvrent les besoins non satisfaits
        requirements.forEach(req => {
          const memberSkill = member.skillsMap[req.skill];
          if (memberSkill) {
            const levelValue = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[memberSkill.level];
            const requiredLevel = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[req.level];
            const importance = { critical: 4, high: 3, medium: 2, low: 1 }[req.importance];

            if (levelValue >= requiredLevel) {
              // Vérifier si cette compétence est déjà couverte
              const alreadyCovered = currentTeam.some(m =>
                m.skillsMap[req.skill] &&
                { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[m.skillsMap[req.skill].level] >= requiredLevel
              );
              score += alreadyCovered ? importance * 0.5 : importance * 2;
            }
          }
        });
        break;

      case 'experience_first':
        score = member.overallScore * 10;
        break;

      case 'availability_first':
        score = member.availability;
        break;

      case 'balance_first':
        score = member.collaborationScore + (100 - member.workload) * 0.5;
        break;
    }

    // Bonus pour la diversité des compétences
    score += member.skills.length * 0.5;

    // Malus pour la surcharge de travail
    score -= member.workload * 0.2;

    return score;
  };

  const calculateCoverageScore = (members: TeamMember[], requirements: TeamRequirement[]): number => {
    let totalCoverage = 0;

    requirements.forEach(req => {
      const requiredLevel = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[req.level];
      const coveringMembers = members.filter(member => {
        const memberSkill = member.skillsMap[req.skill];
        if (!memberSkill) return false;
        const levelValue = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[memberSkill.level];
        return levelValue >= requiredLevel;
      });

      const coverage = Math.min(coveringMembers.length / req.quantity, 1);
      const importance = { critical: 1, high: 0.8, medium: 0.6, low: 0.4 }[req.importance];
      totalCoverage += coverage * importance;
    });

    return (totalCoverage / requirements.length) * 100;
  };

  const calculateBalanceScore = (members: TeamMember[]): number => {
    const avgWorkload = members.reduce((sum, m) => sum + m.workload, 0) / members.length;
    const workloadVariance = members.reduce((sum, m) => sum + Math.pow(m.workload - avgWorkload, 2), 0) / members.length;

    const avgExperience = members.reduce((sum, m) => sum + m.overallScore, 0) / members.length;
    const experienceVariance = members.reduce((sum, m) => sum + Math.pow(m.overallScore - avgExperience, 2), 0) / members.length;

    // Scores élevés pour une faible variance (équilibre)
    const workloadScore = Math.max(0, 100 - workloadVariance);
    const experienceScore = Math.max(0, 100 - experienceVariance * 10);

    return (workloadScore + experienceScore) / 2;
  };

  const calculateCollaborationScore = (members: TeamMember[]): number => {
    return members.reduce((sum, m) => sum + m.collaborationScore, 0) / members.length;
  };

  const generateConflictWarnings = (members: TeamMember[], requirements: TeamRequirement[]): string[] => {
    const warnings: string[] = [];

    // Vérifier la surcharge
    const overloadedMembers = members.filter(m => m.workload > 80);
    if (overloadedMembers.length > 0) {
      warnings.push(`${overloadedMembers.length} membre(s) en surcharge (>80%)`);
    }

    // Vérifier les compétences critiques manquantes
    const missingCritical = requirements.filter(req => {
      if (req.importance !== 'critical') return false;
      const coveringMembers = members.filter(member => {
        const memberSkill = member.skillsMap[req.skill];
        if (!memberSkill) return false;
        const levelValue = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[memberSkill.level];
        const requiredLevel = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[req.level];
        return levelValue >= requiredLevel;
      });
      return coveringMembers.length < req.quantity;
    });

    missingCritical.forEach(req => {
      warnings.push(`Compétence critique "${req.skill}" insuffisamment couverte`);
    });

    return warnings;
  };

  const generateRecommendations = (members: TeamMember[], requirements: TeamRequirement[]): string[] => {
    const recommendations: string[] = [];

    // Analyser l'équilibre des compétences
    const skillCategories = ['technical', 'management', 'soft', 'language'];
    skillCategories.forEach(category => {
      const categorySkills = members.flatMap(m => m.skills.filter(s => s.category === category));
      if (categorySkills.length === 0) {
        recommendations.push(`Ajouter des compétences en ${category}`);
      }
    });

    // Recommander du mentorat
    const juniorMembers = members.filter(m => m.overallScore < 2);
    const seniorMembers = members.filter(m => m.overallScore > 3);
    if (juniorMembers.length > 0 && seniorMembers.length > 0) {
      recommendations.push(`Mettre en place du mentorat (${seniorMembers.length} seniors, ${juniorMembers.length} juniors)`);
    }

    return recommendations;
  };

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectName(template.name);
    setProjectDescription(template.description);
    setRequirements([...template.requirements]);
    setMaxTeamSize(template.teamSize.max);
  };

  const handleAddRequirement = () => {
    setRequirements([...requirements, {
      skill: '',
      level: 'intermediate',
      quantity: 1,
      importance: 'medium',
      category: 'technical'
    }]);
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const handleUpdateRequirement = (index: number, field: keyof TeamRequirement, value: any) => {
    const updated = [...requirements];
    (updated[index] as any)[field] = value;
    setRequirements(updated);
  };

  const handleGenerateTeams = () => {
    if (requirements.length === 0) return;
    const compositions = generateOptimalTeams(requirements, maxTeamSize);
    setTeamCompositions(compositions);
    setActiveStep(2);
  };

  const renderRequirementForm = () => (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Définir les Besoins de l'Équipe
      </Typography>

      {/* Templates de projet */}
      <Box mb={3}>
        <Typography variant="subtitle2" gutterBottom>
          Modèles de projets
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={2}>
          {PROJECT_TEMPLATES.map((template, index) => (
            <Box flex="1 1 300px" minWidth="280px" key={index}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: selectedTemplate === template ? '2px solid' : '1px solid',
                  borderColor: selectedTemplate === template ? 'primary.main' : 'grey.300'
                }}
                onClick={() => handleTemplateSelect(template)}
              >
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {template.description}
                  </Typography>
                  <Stack direction="row" spacing={1} mb={1}>
                    <Chip label={`${template.teamSize.min}-${template.teamSize.max} pers.`} size="small" />
                    <Chip label={`${template.duration} sem.`} size="small" />
                    <Chip label={template.complexity} size="small" color="secondary" />
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Informations du projet */}
      <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
        <Box flex="1 1 600px" minWidth="500px">
          <TextField
            fullWidth
            label="Nom du projet"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </Box>
        <Box flex="1 1 600px" minWidth="500px">
          <FormControl fullWidth>
            <InputLabel>Taille max de l'équipe</InputLabel>
            <Select
              value={maxTeamSize}
              label="Taille max de l'équipe"
              onChange={(e) => setMaxTeamSize(e.target.value as number)}
            >
              {[3, 4, 5, 6, 7, 8, 10, 12].map(size => (
                <MenuItem key={size} value={size}>{size} personnes</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box width="100%">
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Description du projet"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
          />
        </Box>
      </Box>

      {/* Exigences de compétences */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle2">
            Compétences requises ({requirements.length})
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAddRequirement}
            size="small"
          >
            Ajouter
          </Button>
        </Box>

        <Stack spacing={2}>
          {requirements.map((req, index) => (
            <Paper key={index} sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
                <Box flex="1 1 250px" minWidth="200px">
                  <Autocomplete
                    value={req.skill}
                    onChange={(_, value) => handleUpdateRequirement(index, 'skill', value || '')}
                    options={availableMembers.flatMap(m => m.skills.map(s => s.name))}
                    renderInput={(params) => (
                      <TextField {...params} label="Compétence" size="small" />
                    )}
                    freeSolo
                  />
                </Box>
                <Box flex="1 1 150px" minWidth="120px">
                  <FormControl fullWidth size="small">
                    <InputLabel>Niveau</InputLabel>
                    <Select
                      value={req.level}
                      label="Niveau"
                      onChange={(e) => handleUpdateRequirement(index, 'level', e.target.value)}
                    >
                      <MenuItem value="beginner">Débutant</MenuItem>
                      <MenuItem value="intermediate">Intermédiaire</MenuItem>
                      <MenuItem value="advanced">Avancé</MenuItem>
                      <MenuItem value="expert">Expert</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box flex="1 1 100px" minWidth="80px">
                  <TextField
                    type="number"
                    label="Qté"
                    value={req.quantity}
                    onChange={(e) => handleUpdateRequirement(index, 'quantity', parseInt(e.target.value))}
                    size="small"
                    inputProps={{ min: 1, max: 5 }}
                  />
                </Box>
                <Box flex="1 1 150px" minWidth="120px">
                  <FormControl fullWidth size="small">
                    <InputLabel>Importance</InputLabel>
                    <Select
                      value={req.importance}
                      label="Importance"
                      onChange={(e) => handleUpdateRequirement(index, 'importance', e.target.value)}
                    >
                      <MenuItem value="critical">Critique</MenuItem>
                      <MenuItem value="high">Élevée</MenuItem>
                      <MenuItem value="medium">Moyenne</MenuItem>
                      <MenuItem value="low">Faible</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box flex="1 1 150px" minWidth="120px">
                  <FormControl fullWidth size="small">
                    <InputLabel>Catégorie</InputLabel>
                    <Select
                      value={req.category}
                      label="Catégorie"
                      onChange={(e) => handleUpdateRequirement(index, 'category', e.target.value)}
                    >
                      <MenuItem value="technical">Technique</MenuItem>
                      <MenuItem value="management">Management</MenuItem>
                      <MenuItem value="soft">Soft Skills</MenuItem>
                      <MenuItem value="language">Langues</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box flex="1 1 200px" minWidth="150px">
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={req.importance}
                      size="small"
                      color={req.importance === 'critical' ? 'error' : 'default'}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveRequirement(index)}
                    >
                      <Remove />
                    </IconButton>
                  </Stack>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Button
          variant="outlined"
          onClick={() => setActiveStep(0)}
        >
          Retour
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerateTeams}
          disabled={requirements.length === 0}
          startIcon={<Shuffle />}
        >
          Générer les équipes
        </Button>
      </Box>
    </Paper>
  );

  const renderTeamComposition = (composition: TeamComposition, index: number) => (
    <Card key={composition.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6">
              {composition.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {composition.members.length} membres • Score global: {composition.overallScore.toFixed(0)}%
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              label={`Couverture ${composition.coverageScore.toFixed(0)}%`}
              color={composition.coverageScore > 80 ? 'success' : composition.coverageScore > 60 ? 'warning' : 'error'}
              size="small"
            />
            <Chip
              label={`Équilibre ${composition.balanceScore.toFixed(0)}%`}
              color={composition.balanceScore > 70 ? 'success' : 'warning'}
              size="small"
            />
          </Stack>
        </Box>

        {/* Membres de l'équipe */}
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            Membres de l'équipe
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {composition.members.map(member => (
              <Box key={member.user.id}>
                <Tooltip title={`${member.user.displayName} - Disponibilité: ${member.availability.toFixed(0)}%`}>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <Avatar
                      src={member.user.avatarUrl}
                      sx={{
                        width: 48,
                        height: 48,
                        border: member.workload > 80 ? '2px solid #f44336' : '2px solid #4caf50'
                      }}
                    >
                      {member.user.firstName?.[0]}{member.user.lastName?.[0]}
                    </Avatar>
                    <Typography variant="caption" textAlign="center" sx={{ mt: 0.5 }}>
                      {member.user.displayName.split(' ')[0]}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={member.availability}
                      sx={{ width: 48, height: 4, borderRadius: 2 }}
                      color={member.availability > 70 ? 'success' : 'warning'}
                    />
                  </Box>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Avertissements */}
        {composition.conflictWarnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Avertissements:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {composition.conflictWarnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Recommandations */}
        {composition.recommendations.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">
                Recommandations ({composition.recommendations.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {composition.recommendations.map((rec, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <EmojiObjects color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={rec} />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<Save />}>
          Sauvegarder
        </Button>
        <Button size="small" startIcon={<Assignment />}>
          Créer projet
        </Button>
        <Button size="small" startIcon={<SwapHoriz />}>
          Optimiser
        </Button>
        <Button size="small" startIcon={<Download />}>
          Export
        </Button>
      </CardActions>
    </Card>
  );

  const steps = [
    'Configuration',
    'Définir les besoins',
    'Compositions générées'
  ];

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          Team Builder - Composition Optimale d'Équipes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Outil intelligent d'affectation des talents pour vos projets
        </Typography>
      </Box>

      {/* Stepper */}
      <Paper sx={{ mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ p: 3 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Contenu selon l'étape */}
      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Bienvenue dans Team Builder
          </Typography>
          <Typography variant="body1" paragraph>
            Cet outil vous aide à composer les équipes optimales pour vos projets en analysant
            les compétences, la disponibilité et la compatibilité des membres.
          </Typography>

          <Box display="flex" flexWrap="wrap" gap={3} mb={3}>
            <Box flex="1 1 400px" minWidth="350px">
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Assessment color="primary" sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Analyse Intelligente
                  </Typography>
                  <Typography variant="body2">
                    Algorithmes d'optimisation pour la meilleure composition
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box flex="1 1 400px" minWidth="350px">
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Balance color="primary" sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Équilibre Optimal
                  </Typography>
                  <Typography variant="body2">
                    Équilibrage des compétences et des charges de travail
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box flex="1 1 400px" minWidth="350px">
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Timeline color="primary" sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Suivi Continu
                  </Typography>
                  <Typography variant="body2">
                    Monitoring des performances et ajustements
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          <Box textAlign="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => setActiveStep(1)}
              startIcon={<PlayArrow />}
            >
              Commencer un nouveau projet
            </Button>
          </Box>
        </Paper>
      )}

      {activeStep === 1 && renderRequirementForm()}

      {activeStep === 2 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Compositions d'équipes générées ({teamCompositions.length})
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
              >
                Modifier besoins
              </Button>
              <Button
                variant="outlined"
                startIcon={<Shuffle />}
                onClick={handleGenerateTeams}
              >
                Régénérer
              </Button>
            </Stack>
          </Box>

          {teamCompositions.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Warning color="warning" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Aucune composition générée
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vérifiez vos exigences et réessayez
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {teamCompositions.map(renderTeamComposition)}
            </Stack>
          )}
        </Box>
      )}

      {/* FAB pour actions rapides */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setActiveStep(1)}
      >
        <Add />
      </Fab>
    </Box>
  );
};