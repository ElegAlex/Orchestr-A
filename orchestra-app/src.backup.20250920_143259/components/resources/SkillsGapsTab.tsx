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
  Alert,
  LinearProgress,
  Avatar,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Warning,
  Error,
  TrendingDown,
  School,
  PersonAdd,
  Assessment,
  ExpandMore,
  Timeline,
  Group,
  Assignment,
  Lightbulb,
  Schedule,
  MonetizationOn,
  Flag,
  CheckCircle,
  Cancel,
  Info,
  PlayArrow,
  Pause
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchUsers, fetchUserSkills } from '../../store/slices/resourceSlice';
import { User, UserSkill, SkillCategory } from '../../types';

interface SkillGap {
  skillName: string;
  category: SkillCategory;
  currentCoverage: number;
  requiredCoverage: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  peopleWithSkill: User[];
  averageLevel: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  businessImpact: 'high' | 'medium' | 'low';
  recommendations: Recommendation[];
}

interface Recommendation {
  type: 'training' | 'hiring' | 'mentoring' | 'outsourcing';
  title: string;
  description: string;
  estimatedCost: number;
  timeToComplete: number; // en semaines
  priority: 'high' | 'medium' | 'low';
  assignedTo?: string[];
  status: 'proposed' | 'approved' | 'in_progress' | 'completed';
}

interface ProjectRequirement {
  projectName: string;
  requiredSkills: { skill: string; level: string; quantity: number }[];
  timeline: string;
  priority: 'high' | 'medium' | 'low';
  currentCoverage: number;
}

export const SkillsGapsTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, userSkills, loading } = useAppSelector((state: any) => state.resources);

  const [riskThreshold, setRiskThreshold] = useState(3); // Nombre minimum de personnes
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [timeHorizon, setTimeHorizon] = useState('6m'); // 3m, 6m, 1y
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');

  useEffect(() => {
    dispatch(fetchUsers());
    users.forEach((user: User) => {
      dispatch(fetchUserSkills(user.id));
    });
  }, [dispatch, users.length]);

  // Analyser les gaps de compétences
  const skillsGaps: SkillGap[] = useMemo(() => {
    const skillMap = new Map<string, {
      users: User[];
      skills: UserSkill[];
      category: SkillCategory;
    }>();

    // Construire la carte des compétences
    users.forEach((user: User) => {
      const skills = userSkills[user.id] || [];
      skills.forEach((skill: UserSkill) => {
        const existing = skillMap.get(skill.name) || {
          users: [],
          skills: [],
          category: skill.category
        };
        existing.users.push(user);
        existing.skills.push(skill);
        skillMap.set(skill.name, existing);
      });
    });

    // Analyser chaque compétence pour détecter les gaps
    const gaps: SkillGap[] = [];

    skillMap.forEach((data, skillName) => {
      const currentCoverage = data.users.length;
      const requiredCoverage = Math.max(3, Math.ceil(users.length * 0.2)); // Au moins 20% de l'équipe

      if (currentCoverage < requiredCoverage) {
        const levelValues = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
        const averageLevel = data.skills.reduce((sum: number, skill: any) =>
          sum + levelValues[skill.level as keyof typeof levelValues], 0
        ) / data.skills.length;

        let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (currentCoverage === 0) riskLevel = 'critical';
        else if (currentCoverage === 1) riskLevel = 'high';
        else if (currentCoverage <= 2) riskLevel = 'medium';

        // Générer des recommandations
        const recommendations = generateRecommendations(skillName, data.category, currentCoverage, requiredCoverage, riskLevel);

        gaps.push({
          skillName,
          category: data.category,
          currentCoverage,
          requiredCoverage,
          riskLevel,
          peopleWithSkill: data.users,
          averageLevel,
          trend: 'stable', // TODO: Calculer la tendance basée sur l'historique
          businessImpact: getBusinessImpact(skillName, data.category),
          recommendations
        });
      }
    });

    return gaps.sort((a, b) => {
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
    });
  }, [users, userSkills, riskThreshold]);

  // Générer des recommandations automatiques
  const generateRecommendations = (
    skillName: string,
    category: SkillCategory,
    current: number,
    required: number,
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
  ): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    const gap = required - current;

    // Formation interne
    if (current > 0) {
      recommendations.push({
        type: 'training',
        title: `Formation ${skillName} en interne`,
        description: `Organiser une formation pour développer ${gap} personnes supplémentaires en ${skillName}`,
        estimatedCost: gap * 1500, // 1500€ par personne
        timeToComplete: category === 'technical' ? 8 : 4,
        priority: riskLevel === 'critical' ? 'high' : 'medium',
        status: 'proposed'
      });

      recommendations.push({
        type: 'mentoring',
        title: `Programme de mentorat ${skillName}`,
        description: `Mettre en place un mentorat avec les experts existants`,
        estimatedCost: gap * 500,
        timeToComplete: 12,
        priority: 'medium',
        status: 'proposed'
      });
    }

    // Recrutement
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push({
        type: 'hiring',
        title: `Recruter un expert ${skillName}`,
        description: `Embaucher ${Math.ceil(gap / 2)} personne(s) avec expertise en ${skillName}`,
        estimatedCost: Math.ceil(gap / 2) * 60000, // 60k€ par recrutement
        timeToComplete: 16,
        priority: 'high',
        status: 'proposed'
      });
    }

    // Externalisation pour les compétences non-critiques
    if (category !== 'management' && riskLevel !== 'critical') {
      recommendations.push({
        type: 'outsourcing',
        title: `Externaliser ${skillName}`,
        description: `Faire appel à des prestataires externes pour cette compétence`,
        estimatedCost: gap * 800 * 12, // 800€/mois par personne équivalente
        timeToComplete: 2,
        priority: 'low',
        status: 'proposed'
      });
    }

    return recommendations;
  };

  const getBusinessImpact = (skillName: string, category: SkillCategory): 'high' | 'medium' | 'low' => {
    if (category === 'management' || category === 'technical') return 'high';
    if (category === 'soft') return 'medium';
    return 'low';
  };

  // Projets futurs et besoins prévus
  const projectRequirements: ProjectRequirement[] = useMemo(() => [
    {
      projectName: "Modernisation SI",
      requiredSkills: [
        { skill: "React", level: "advanced", quantity: 3 },
        { skill: "Node.js", level: "intermediate", quantity: 2 },
        { skill: "DevOps", level: "expert", quantity: 1 }
      ],
      timeline: "Q2 2024",
      priority: 'high',
      currentCoverage: 60
    },
    {
      projectName: "Projet Data Lake",
      requiredSkills: [
        { skill: "Python", level: "advanced", quantity: 2 },
        { skill: "Machine Learning", level: "intermediate", quantity: 1 },
        { skill: "SQL", level: "advanced", quantity: 2 }
      ],
      timeline: "Q3 2024",
      priority: 'medium',
      currentCoverage: 40
    }
  ], []);

  const filteredGaps = useMemo(() => {
    let filtered = skillsGaps;

    if (showOnlyCritical) {
      filtered = filtered.filter(gap => gap.riskLevel === 'critical' || gap.riskLevel === 'high');
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(gap => gap.category === selectedCategory);
    }

    return filtered;
  }, [skillsGaps, showOnlyCritical, selectedCategory]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'success';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'training': return <School />;
      case 'hiring': return <PersonAdd />;
      case 'mentoring': return <Group />;
      case 'outsourcing': return <Assignment />;
      default: return <Lightbulb />;
    }
  };

  const renderGapCard = (gap: SkillGap) => (
    <Card key={gap.skillName} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              {gap.skillName}
              <Chip
                label={gap.category}
                size="small"
                variant="outlined"
              />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Impact business: {gap.businessImpact}
            </Typography>
          </Box>
          <Chip
            label={gap.riskLevel.toUpperCase()}
            color={getRiskColor(gap.riskLevel) as any}
            variant="filled"
          />
        </Box>

        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">
              Couverture actuelle: {gap.currentCoverage} / {gap.requiredCoverage} personnes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {((gap.currentCoverage / gap.requiredCoverage) * 100).toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(gap.currentCoverage / gap.requiredCoverage) * 100}
            color={getRiskColor(gap.riskLevel) as any}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            Personnes avec cette compétence:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {gap.peopleWithSkill.length > 0 ? (
              gap.peopleWithSkill.map(user => (
                <Tooltip key={user.id} title={`${user.displayName} - ${user.department}`}>
                  <Avatar
                    src={user.avatarUrl}
                    sx={{ width: 32, height: 32 }}
                  >
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </Avatar>
                </Tooltip>
              ))
            ) : (
              <Typography variant="body2" color="error">
                Aucune personne avec cette compétence
              </Typography>
            )}
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Recommandations ({gap.recommendations.length})
        </Typography>
        <Stack spacing={1}>
          {gap.recommendations.slice(0, 2).map((rec, index) => (
            <Box
              key={index}
              display="flex"
              alignItems="center"
              gap={1}
              p={1}
              sx={{
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: rec.priority === 'high' ? '1px solid' : 'none',
                borderColor: 'warning.main'
              }}
            >
              {getRecommendationIcon(rec.type)}
              <Box flex={1}>
                <Typography variant="body2" fontWeight={500}>
                  {rec.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {rec.estimatedCost.toLocaleString()}€ • {rec.timeToComplete} semaines
                </Typography>
              </Box>
              <Chip
                label={rec.priority}
                size="small"
                color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'default'}
              />
            </Box>
          ))}
        </Stack>
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<PlayArrow />}>
          Lancer action
        </Button>
        <Button size="small" startIcon={<Assessment />}>
          Analyser
        </Button>
        <Button size="small">
          Voir détails
        </Button>
      </CardActions>
    </Card>
  );

  const totalCriticalGaps = skillsGaps.filter(gap => gap.riskLevel === 'critical').length;
  const totalHighGaps = skillsGaps.filter(gap => gap.riskLevel === 'high').length;
  const averageCoverage = skillsGaps.length > 0 ?
    skillsGaps.reduce((sum, gap) => sum + (gap.currentCoverage / gap.requiredCoverage), 0) / skillsGaps.length * 100 : 100;

  return (
    <Box>
      {/* Header et statistiques */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          Analyse des Lacunes de Compétences
        </Typography>

        <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
          <Box flex="1 1 250px" minWidth="200px">
            <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #f44336' }}>
              <Typography variant="h4" color="error">{totalCriticalGaps}</Typography>
              <Typography variant="caption">Gaps critiques</Typography>
            </Paper>
          </Box>
          <Box flex="1 1 250px" minWidth="200px">
            <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #ff9800' }}>
              <Typography variant="h4" color="warning.main">{totalHighGaps}</Typography>
              <Typography variant="caption">Gaps élevés</Typography>
            </Paper>
          </Box>
          <Box flex="1 1 250px" minWidth="200px">
            <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #2196f3' }}>
              <Typography variant="h4" color="primary">{filteredGaps.length}</Typography>
              <Typography variant="caption">Total gaps</Typography>
            </Paper>
          </Box>
          <Box flex="1 1 250px" minWidth="200px">
            <Paper sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #4caf50' }}>
              <Typography variant="h4" color="success.main">{averageCoverage.toFixed(0)}%</Typography>
              <Typography variant="caption">Couverture moyenne</Typography>
            </Paper>
          </Box>
        </Box>

        {totalCriticalGaps > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>{totalCriticalGaps} compétences critiques</strong> nécessitent une action immédiate.
            Risque d'impact sur les projets en cours.
          </Alert>
        )}
      </Box>

      {/* Contrôles et filtres */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
          <Box flex="1 1 300px" minWidth="250px">
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyCritical}
                  onChange={(e) => setShowOnlyCritical(e.target.checked)}
                />
              }
              label="Gaps critiques seulement"
            />
          </Box>

          <Box flex="1 1 300px" minWidth="250px">
            <FormControl fullWidth size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={selectedCategory}
                label="Catégorie"
                onChange={(e) => setSelectedCategory(e.target.value as SkillCategory)}
              >
                <MenuItem value="all">Toutes</MenuItem>
                <MenuItem value="technical">Technique</MenuItem>
                <MenuItem value="management">Management</MenuItem>
                <MenuItem value="soft">Soft Skills</MenuItem>
                <MenuItem value="language">Langues</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box flex="1 1 300px" minWidth="250px">
            <FormControl fullWidth size="small">
              <InputLabel>Horizon</InputLabel>
              <Select
                value={timeHorizon}
                label="Horizon"
                onChange={(e) => setTimeHorizon(e.target.value)}
              >
                <MenuItem value="3m">3 mois</MenuItem>
                <MenuItem value="6m">6 mois</MenuItem>
                <MenuItem value="1y">1 an</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box flex="1 1 300px" minWidth="250px">
            <Typography variant="body2" gutterBottom>
              Seuil de risque: {riskThreshold} personnes min.
            </Typography>
            <Slider
              value={riskThreshold}
              onChange={(_, value) => setRiskThreshold(value as number)}
              min={1}
              max={5}
              marks
              size="small"
            />
          </Box>
        </Box>
      </Paper>

      <Box display="flex" flexWrap="wrap" gap={3}>
        {/* Liste des gaps */}
        <Box flex="2 1 800px" minWidth="600px">
          <Typography variant="h6" gutterBottom>
            Lacunes Identifiées ({filteredGaps.length})
          </Typography>

          {filteredGaps.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircle color="success" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Aucune lacune critique détectée
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Toutes les compétences essentielles sont correctement couvertes.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {filteredGaps.map(renderGapCard)}
            </Stack>
          )}
        </Box>

        {/* Panel latéral */}
        <Box flex="1 1 400px" minWidth="350px">
          {/* Besoins projets futurs */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Besoins Projets Futurs
            </Typography>
            <Stack spacing={2}>
              {projectRequirements.map((project, index) => (
                <Box key={index}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">{project.projectName}</Typography>
                    <Chip
                      label={project.priority}
                      size="small"
                      color={project.priority === 'high' ? 'error' : 'default'}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    {project.timeline}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={project.currentCoverage}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption">
                    Couverture: {project.currentCoverage}%
                  </Typography>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Stack>
          </Paper>

          {/* Actions rapides */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Actions Rapides
            </Typography>
            <Stack spacing={1}>
              <Button
                variant="outlined"
                startIcon={<School />}
                fullWidth
                size="small"
              >
                Planifier formations
              </Button>
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                fullWidth
                size="small"
              >
                Lancer recrutements
              </Button>
              <Button
                variant="outlined"
                startIcon={<Assessment />}
                fullWidth
                size="small"
              >
                Rapport détaillé
              </Button>
              <Button
                variant="outlined"
                startIcon={<Timeline />}
                fullWidth
                size="small"
              >
                Roadmap compétences
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};