import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  ViewModule as BoxViewIcon,
  ViewList as ListViewIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchUsers, fetchUserSkills } from '../../store/slices/resourceSlice';
import { User, UserSkill, SkillCategory } from '../../types';

interface SkillMatrixData {
  userId: string;
  user: User;
  skills: UserSkill[];
  skillsMap: Record<string, UserSkill>;
}

const SKILL_LEVEL_COLORS = {
  beginner: '#ffeb3b',
  intermediate: '#ff9800',
  advanced: '#4caf50',
  expert: '#2196f3'
};

const SKILL_LEVEL_LABELS = {
  beginner: '🟡',
  intermediate: '🟠',
  advanced: '🟢',
  expert: '🔵'
};

export const SkillsMatrixTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, userSkills, loading } = useAppSelector((state: any) => state.resources);

  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);

  useEffect(() => {
    dispatch(fetchUsers());
    // Charger toutes les compétences pour tous les utilisateurs
    users.forEach((user: User) => {
      dispatch(fetchUserSkills(user.id));
    });
  }, [dispatch, users.length]);

  // Construire la matrice de données
  const matrixData: SkillMatrixData[] = useMemo(() => {
    return users.map((user: User) => {
      const skills = userSkills[user.id] || [];
      const skillsMap = skills.reduce((acc: Record<string, UserSkill>, skill: any) => {
        acc[skill.name] = skill;
        return acc;
      }, {} as Record<string, UserSkill>);

      return {
        userId: user.id,
        user,
        skills,
        skillsMap
      };
    });
  }, [users, userSkills]);

  // Obtenir toutes les compétences uniques
  const allSkills = useMemo(() => {
    const skillsSet = new Set<string>();
    matrixData.forEach(data => {
      data.skills.forEach(skill => {
        skillsSet.add(skill.name);
      });
    });
    return Array.from(skillsSet).sort();
  }, [matrixData]);

  // Filtrer les données
  const filteredMatrixData = useMemo(() => {
    return matrixData.filter(data => {
      const matchesSearch =
        data.user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.user.department?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = !departmentFilter || data.user.department === departmentFilter;

      const matchesCategory = !categoryFilter ||
        data.skills.some(skill => skill.category === categoryFilter);

      return matchesSearch && matchesDepartment && matchesCategory;
    });
  }, [matrixData, searchTerm, departmentFilter, categoryFilter]);

  const filteredSkills = useMemo(() => {
    let skills = allSkills;

    if (skillFilter) {
      skills = skills.filter(skill =>
        skill.toLowerCase().includes(skillFilter.toLowerCase())
      );
    }

    if (categoryFilter) {
      skills = skills.filter(skill => {
        return matrixData.some(data =>
          data.skillsMap[skill]?.category === categoryFilter
        );
      });
    }

    if (showOnlyGaps) {
      // Afficher seulement les compétences avec peu de personnes (gaps)
      skills = skills.filter(skill => {
        const peopleWithSkill = matrixData.filter(data => data.skillsMap[skill]).length;
        return peopleWithSkill <= 2; // Considérer comme gap si ≤ 2 personnes
      });
    }

    return skills;
  }, [allSkills, skillFilter, categoryFilter, showOnlyGaps, matrixData]);

  // Statistiques globales
  const stats = useMemo(() => {
    const totalPeople = matrixData.length;
    const totalSkills = allSkills.length;
    const averageSkillsPerPerson = totalPeople > 0 ?
      matrixData.reduce((sum, data) => sum + data.skills.length, 0) / totalPeople : 0;

    const skillGaps = allSkills.filter(skill => {
      const peopleWithSkill = matrixData.filter(data => data.skillsMap[skill]).length;
      return peopleWithSkill <= 1;
    }).length;

    const expertSkills = allSkills.filter(skill => {
      return matrixData.some(data => data.skillsMap[skill]?.level === 'expert');
    }).length;

    return {
      totalPeople,
      totalSkills,
      averageSkillsPerPerson,
      skillGaps,
      expertSkills
    };
  }, [matrixData, allSkills]);

  const getSkillCoverage = (skillName: string) => {
    const peopleWithSkill = matrixData.filter(data => data.skillsMap[skillName]).length;
    return {
      count: peopleWithSkill,
      percentage: matrixData.length > 0 ? (peopleWithSkill / matrixData.length) * 100 : 0
    };
  };

  const renderSkillCell = (data: SkillMatrixData, skillName: string) => {
    const skill = data.skillsMap[skillName];

    if (!skill) {
      return (
        <TableCell
          key={`${data.userId}-${skillName}`}
          align="center"
          sx={{
            width: 60,
            minWidth: 60,
            borderLeft: '1px solid #e0e0e0',
            backgroundColor: '#fafafa'
          }}
        >
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              margin: '0 auto',
              backgroundColor: '#e0e0e0',
              opacity: 0.3
            }}
          />
        </TableCell>
      );
    }

    const coverage = getSkillCoverage(skillName);
    const isRare = coverage.count <= 2;

    return (
      <TableCell
        key={`${data.userId}-${skillName}`}
        align="center"
        sx={{
          width: 60,
          minWidth: 60,
          borderLeft: '1px solid #e0e0e0',
          backgroundColor: isRare ? '#fff3e0' : 'inherit'
        }}
      >
        <Tooltip title={`${skill.name} - ${skill.level} (${skill.yearsExperience} ans)`}>
          <Box>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                margin: '0 auto',
                backgroundColor: SKILL_LEVEL_COLORS[skill.level],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: isRare ? '2px solid #f57c00' : 'none',
                '&:hover': {
                  transform: 'scale(1.2)',
                  transition: 'transform 0.2s'
                }
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '10px' }}>
                {SKILL_LEVEL_LABELS[skill.level]}
              </Typography>
            </Box>
            {isRare && (
              <WarningIcon
                sx={{
                  fontSize: 12,
                  color: '#f57c00',
                  position: 'relative',
                  top: -2
                }}
              />
            )}
          </Box>
        </Tooltip>
      </TableCell>
    );
  };

  const renderMatrixView = () => (
    <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                width: 100,
                minWidth: 100,
                maxWidth: 100,
                backgroundColor: '#f5f5f5',
                position: 'sticky',
                left: 0,
                zIndex: 1000
              }}
            >
              <Typography variant="subtitle2" fontWeight="bold">
                Équipe
              </Typography>
            </TableCell>
            {filteredSkills.map((skill) => {
              const coverage = getSkillCoverage(skill);
              return (
                <TableCell
                  key={skill}
                  align="center"
                  sx={{
                    minWidth: 60,
                    maxWidth: 60,
                    backgroundColor: '#f5f5f5',
                    borderLeft: '1px solid #e0e0e0'
                  }}
                >
                  <Tooltip title={`${skill}\n${coverage.count} personnes (${coverage.percentage.toFixed(1)}%)`}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          writingMode: 'vertical-rl',
                          textOrientation: 'mixed',
                          fontSize: '11px',
                          fontWeight: coverage.count <= 2 ? 'bold' : 'normal',
                          color: coverage.count <= 2 ? '#f57c00' : 'inherit'
                        }}
                      >
                        {skill}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          label={coverage.count}
                          size="small"
                          color={coverage.count <= 1 ? 'error' : coverage.count <= 2 ? 'warning' : 'default'}
                          sx={{ fontSize: '10px', height: 16 }}
                        />
                      </Box>
                    </Box>
                  </Tooltip>
                </TableCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredMatrixData.map((data) => (
            <TableRow key={data.userId} hover>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  backgroundColor: 'white',
                  zIndex: 999,
                  borderRight: '2px solid #e0e0e0',
                  width: 100,
                  minWidth: 100,
                  maxWidth: 100
                }}
              >
                <Box display="flex" alignItems="center" gap={0.25}>
                  <Avatar src={data.user.avatarUrl} sx={{ width: 20, height: 20, fontSize: '0.7rem' }}>
                    {data.user.firstName?.[0]}{data.user.lastName?.[0]}
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="caption" fontWeight={500} noWrap sx={{ fontSize: '0.7rem', lineHeight: 1.2 }}>
                      {data.user.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontSize: '0.6rem', lineHeight: 1 }}>
                      {data.user.department}
                    </Typography>
                  </Box>
                  <Chip
                    label={data.skills.length}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.55rem', height: '16px', minWidth: '20px', '& .MuiChip-label': { px: 0.5 } }}
                  />
                </Box>
              </TableCell>
              {filteredSkills.map((skill) => renderSkillCell(data, skill))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderCardsView = () => (
    <Box display="flex" flexWrap="wrap" gap={2}>
      {filteredMatrixData.map((data) => (
        <Box flex="1 1 350px" minWidth="300px" key={data.userId}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar src={data.user.avatarUrl}>
                  {data.user.firstName?.[0]}{data.user.lastName?.[0]}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6">
                    {data.user.displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.user.department}
                  </Typography>
                </Box>
                <Chip label={`${data.skills.length} compétences`} size="small" />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Compétences par catégorie
                </Typography>
                {['technical', 'management', 'soft', 'language'].map(category => {
                  const categorySkills = data.skills.filter(skill => skill.category === category);
                  if (categorySkills.length === 0) return null;

                  return (
                    <Box key={category} mb={1}>
                      <Typography variant="caption" color="text.secondary">
                        {category.toUpperCase()} ({categorySkills.length})
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                        {categorySkills.slice(0, 4).map(skill => (
                          <Chip
                            key={skill.id}
                            label={skill.name}
                            size="small"
                            sx={{
                              backgroundColor: SKILL_LEVEL_COLORS[skill.level],
                              fontSize: '10px'
                            }}
                          />
                        ))}
                        {categorySkills.length > 4 && (
                          <Chip
                            label={`+${categorySkills.length - 4}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '10px' }}
                          />
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box>
      {/* Header avec statistiques */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          Matrice des Compétences
        </Typography>

        <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
          <Box flex="1 1 200px" minWidth="150px">
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{stats.totalPeople}</Typography>
              <Typography variant="caption">Personnes</Typography>
            </Paper>
          </Box>
          <Box flex="1 1 200px" minWidth="150px">
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">{stats.totalSkills}</Typography>
              <Typography variant="caption">Compétences</Typography>
            </Paper>
          </Box>
          <Box flex="1 1 200px" minWidth="150px">
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">{stats.skillGaps}</Typography>
              <Typography variant="caption">Gaps critiques</Typography>
            </Paper>
          </Box>
          <Box flex="1 1 200px" minWidth="150px">
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">{stats.averageSkillsPerPerson.toFixed(1)}</Typography>
              <Typography variant="caption">Moy. par personne</Typography>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Contrôles et filtres */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="center">
          {/* Recherche */}
          <TextField
            placeholder="Rechercher une personne..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* Filtres */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Département</InputLabel>
            <Select
              value={departmentFilter}
              label="Département"
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="IT">IT</MenuItem>
              <MenuItem value="RH">RH</MenuItem>
              <MenuItem value="Finance">Finance</MenuItem>
              <MenuItem value="Direction">Direction</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Catégorie</InputLabel>
            <Select
              value={categoryFilter}
              label="Catégorie"
              onChange={(e) => setCategoryFilter(e.target.value as SkillCategory)}
            >
              <MenuItem value="">Toutes</MenuItem>
              <MenuItem value="technical">Technique</MenuItem>
              <MenuItem value="management">Management</MenuItem>
              <MenuItem value="soft">Soft Skills</MenuItem>
              <MenuItem value="language">Langues</MenuItem>
            </Select>
          </FormControl>

          <TextField
            placeholder="Filtrer compétences..."
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          />

          <Button
            variant={showOnlyGaps ? "contained" : "outlined"}
            onClick={() => setShowOnlyGaps(!showOnlyGaps)}
            startIcon={<WarningIcon />}
            color="warning"
            size="small"
          >
            Gaps seulement
          </Button>

          {/* Mode d'affichage */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="matrix">
              <BoxViewIcon />
            </ToggleButton>
            <ToggleButton value="cards">
              <ListViewIcon />
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            size="small"
            onClick={() => {/* TODO: Export Excel */}}
          >
            Export
          </Button>
        </Stack>
      </Paper>

      {/* Légende */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Légende des niveaux
        </Typography>
        <Stack direction="row" spacing={3}>
          {Object.entries(SKILL_LEVEL_LABELS).map(([level, emoji]) => (
            <Box key={level} display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: SKILL_LEVEL_COLORS[level as keyof typeof SKILL_LEVEL_COLORS]
                }}
              />
              <Typography variant="caption">
                {level} {emoji}
              </Typography>
            </Box>
          ))}
          <Divider orientation="vertical" flexItem />
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon sx={{ fontSize: 16, color: '#f57c00' }} />
            <Typography variant="caption">Compétence rare (≤2 personnes)</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Contenu principal */}
      {viewMode === 'matrix' ? renderMatrixView() : renderCardsView()}
    </Box>
  );
};