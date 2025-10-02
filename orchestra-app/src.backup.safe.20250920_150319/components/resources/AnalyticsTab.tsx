import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Chip,
  LinearProgress,
  CircularProgress,
  Avatar,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  School,
  Warning,
  Star,
  Assessment,
  Download,
  Refresh,
  Timeline,
  WorkOutline,
  EmojiObjects,
  Language
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchUsers, fetchUserSkills } from '../../store/slices/resourceSlice';
import { User, UserSkill, SkillCategory } from '../../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const SKILL_COLORS = {
  technical: '#2196f3',
  management: '#ff9800',
  soft: '#4caf50',
  language: '#9c27b0',
  methodology: '#795548'
};

interface SkillStats {
  name: string;
  count: number;
  percentage: number;
  avgLevel: number;
  category: SkillCategory;
  riskLevel: 'low' | 'medium' | 'high';
}

interface DepartmentStats {
  department: string;
  totalPeople: number;
  avgSkillsPerPerson: number;
  topSkills: string[];
  skillsDistribution: Record<SkillCategory, number>;
}

export const AnalyticsTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, userSkills, loading } = useAppSelector((state: any) => state.resources);

  const [timeRange, setTimeRange] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchUsers());
    users.forEach((user: User) => {
      dispatch(fetchUserSkills(user.id));
    });
  }, [dispatch, users.length]);

  // Calculer les statistiques globales
  const globalStats = useMemo(() => {
    const totalUsers = users.length;
    const totalSkills = Object.values(userSkills).flat().length;
    const allSkillsFlat = Object.values(userSkills).flat() as UserSkill[];
    const validSkills = allSkillsFlat.filter(s => s && s.name);
    const uniqueSkills = new Set(validSkills.map(s => s.name)).size;

    const avgSkillsPerUser = totalUsers > 0 ? totalSkills / totalUsers : 0;

    // Calculer les niveaux de compétence
    const allSkills = validSkills;
    const levelCounts = allSkills.reduce((acc, skill) => {
      acc[skill.level] = (acc[skill.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const expertCount = levelCounts.expert || 0;
    const beginnerCount = levelCounts.beginner || 0;

    const expertPercentage = totalSkills > 0 ? (expertCount / totalSkills) * 100 : 0;
    const maturityScore = totalSkills > 0 ? ((levelCounts.advanced || 0) + (levelCounts.expert || 0)) / totalSkills * 100 : 0;

    return {
      totalUsers,
      totalSkills,
      uniqueSkills,
      avgSkillsPerUser,
      expertPercentage,
      maturityScore,
      levelCounts
    };
  }, [users, userSkills]);

  // Analyser les compétences par popularité et risque
  const skillsAnalysis: SkillStats[] = useMemo(() => {
    const skillMap = new Map<string, {
      count: number;
      levels: string[];
      category: SkillCategory;
    }>();

    (Object.values(userSkills).flat() as UserSkill[])
      .filter(s => s && s.name)
      .forEach((skill: UserSkill) => {
      const existing = skillMap.get(skill.name) || { count: 0, levels: [], category: skill.category };
      existing.count++;
      existing.levels.push(skill.level);
      skillMap.set(skill.name, existing);
    });

    return Array.from(skillMap.entries()).map(([name, data]) => {
      const levelValues = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
      const avgLevel = data.levels.reduce((sum, level) => sum + levelValues[level as keyof typeof levelValues], 0) / data.levels.length;

      const percentage = (data.count / users.length) * 100;

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (data.count === 1) riskLevel = 'high';
      else if (data.count <= 2) riskLevel = 'medium';

      return {
        name,
        count: data.count,
        percentage,
        avgLevel,
        category: data.category,
        riskLevel
      };
    }).sort((a, b) => b.count - a.count);
  }, [userSkills, users]);

  // Statistiques par département
  const departmentStats: DepartmentStats[] = useMemo(() => {
    const deptMap = new Map<string, {
      people: User[];
      skills: UserSkill[];
    }>();

    users.forEach((user: User) => {
      const dept = user.department || 'Non défini';
      const existing = deptMap.get(dept) || { people: [], skills: [] };
      existing.people.push(user);
      existing.skills.push(...(userSkills[user.id] || []));
      deptMap.set(dept, existing);
    });

    return Array.from(deptMap.entries()).map(([department, data]) => {
      const skillsDistribution = data.skills.reduce((acc, skill) => {
        acc[skill.category] = (acc[skill.category] || 0) + 1;
        return acc;
      }, {} as Record<SkillCategory, number>);

      const skillCounts = data.skills.reduce((acc, skill) => {
        acc[skill.name] = (acc[skill.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topSkills = Object.entries(skillCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([skill]) => skill);

      return {
        department,
        totalPeople: data.people.length,
        avgSkillsPerPerson: data.people.length > 0 ? data.skills.length / data.people.length : 0,
        topSkills,
        skillsDistribution
      };
    }).sort((a, b) => b.totalPeople - a.totalPeople);
  }, [users, userSkills]);

  // Données pour les graphiques
  const skillsCategoryData = useMemo(() => {
    const categories = ['technical', 'management', 'soft', 'language', 'methodology'];
    return categories.map(category => {
      const skills = skillsAnalysis.filter(skill => skill.category === category);
      const totalCount = skills.reduce((sum, skill) => sum + skill.count, 0);
      return {
        name: category,
        value: totalCount,
        count: skills.length,
        color: SKILL_COLORS[category as keyof typeof SKILL_COLORS]
      };
    }).filter(item => item.value > 0);
  }, [skillsAnalysis]);

  const skillsLevelData = useMemo(() => {
    return Object.entries(globalStats.levelCounts).map(([level, count]) => ({
      name: level,
      value: count,
      percentage: globalStats.totalSkills > 0 ? (count / globalStats.totalSkills) * 100 : 0
    }));
  }, [globalStats]);

  const topSkillsData = useMemo(() => {
    return skillsAnalysis.slice(0, 10).map(skill => ({
      name: skill.name.length > 15 ? `${skill.name.substring(0, 15)  }...` : skill.name,
      fullName: skill.name,
      count: skill.count,
      percentage: skill.percentage,
      riskLevel: skill.riskLevel
    }));
  }, [skillsAnalysis]);

  const departmentRadarData = useMemo(() => {
    const categories = ['technical', 'management', 'soft', 'language'];
    return categories.map(category => {
      const dataPoint: any = { category };
      departmentStats.forEach(dept => {
        const value = dept.skillsDistribution[category as SkillCategory] || 0;
        dataPoint[dept.department] = value;
      });
      return dataPoint;
    });
  }, [departmentStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchUsers());
      // Reload skills for all users
      users.forEach((user: User) => {
        dispatch(fetchUserSkills(user.id));
      });
    } finally {
      setRefreshing(false);
    }
  };

  const renderKPICard = (title: string, value: string | number, subtitle: string, icon: React.ReactNode, trend?: 'up' | 'down', trendValue?: string) => (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" component="div" color="primary">
              {value}
            </Typography>
            <Typography variant="h6" gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
            {trend && trendValue && (
              <Box display="flex" alignItems="center" mt={1}>
                {trend === 'up' ? (
                  <TrendingUp color="success" fontSize="small" />
                ) : (
                  <TrendingDown color="error" fontSize="small" />
                )}
                <Typography variant="caption" color={trend === 'up' ? 'success.main' : 'error.main'} ml={0.5}>
                  {trendValue}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: 'primary.main', opacity: 0.7 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header avec contrôles */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Analytics & Métriques RH
        </Typography>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Période</InputLabel>
            <Select
              value={timeRange}
              label="Période"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="all">Toute la période</MenuItem>
              <MenuItem value="6m">6 derniers mois</MenuItem>
              <MenuItem value="1y">Dernière année</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Département</InputLabel>
            <Select
              value={departmentFilter}
              label="Département"
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <MenuItem value="all">Tous</MenuItem>
              {departmentStats.map(dept => (
                <MenuItem key={dept.department} value={dept.department}>
                  {dept.department}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Actualiser les données">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <CircularProgress size={24} /> : <Refresh />}
            </IconButton>
          </Tooltip>

          <Button variant="outlined" startIcon={<Download />}>
            Export PDF
          </Button>
        </Stack>
      </Box>

      {/* KPIs principaux */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={4}>
        <Box flex="1 1 300px" minWidth="250px">
          {renderKPICard(
            "Total Collaborateurs",
            globalStats.totalUsers,
            "Membres actifs de l'équipe",
            <People fontSize="large" />,
            'up',
            '+2% ce mois'
          )}
        </Box>
        <Box flex="1 1 300px" minWidth="250px">
          {renderKPICard(
            "Compétences Uniques",
            globalStats.uniqueSkills,
            "Diversité des expertises",
            <School fontSize="large" />,
            'up',
            '+5 ce mois'
          )}
        </Box>
        <Box flex="1 1 300px" minWidth="250px">
          {renderKPICard(
            "Score de Maturité",
            `${globalStats.maturityScore.toFixed(1)}%`,
            "Niveaux avancés/experts",
            <Star fontSize="large" />,
            'up',
            '+3.2%'
          )}
        </Box>
        <Box flex="1 1 300px" minWidth="250px">
          {renderKPICard(
            "Moyenne / Personne",
            globalStats.avgSkillsPerUser.toFixed(1),
            "Compétences par collaborateur",
            <Assessment fontSize="large" />,
            'up',
            '+0.5'
          )}
        </Box>
      </Box>

      {/* Graphiques principaux */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={4}>
        {/* Distribution par catégorie */}
        <Box flex="1 1 600px" minWidth="500px">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Répartition par Catégorie
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={skillsCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }: any) => `${name} (${(percentage || 0).toFixed(1)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {skillsCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Box>

        {/* Niveaux de compétence */}
        <Box flex="1 1 600px" minWidth="500px">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Distribution des Niveaux
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillsLevelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>

        {/* Top compétences */}
        <Box flex="2 1 800px" minWidth="600px">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top 10 Compétences
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topSkillsData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <RechartsTooltip
                  formatter={(value: number, name, props) => [
                    `${value} personnes (${props.payload.percentage.toFixed(1)}%)`,
                    props.payload.fullName
                  ]}
                />
                <Bar
                  dataKey="count"
                  fill="#8884d8"
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>

        {/* Radar départements */}
        <Box flex="1 1 400px" minWidth="350px">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Profil par Département
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={departmentRadarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" />
                <PolarRadiusAxis />
                {departmentStats.slice(0, 3).map((dept, index) => (
                  <Radar
                    key={dept.department}
                    name={dept.department}
                    dataKey={dept.department}
                    stroke={COLORS[index]}
                    fill={COLORS[index]}
                    fillOpacity={0.2}
                  />
                ))}
                <RechartsTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
        </Box>
      </Box>

      {/* Tableaux détaillés */}
      <Box display="flex" flexWrap="wrap" gap={3}>
        {/* Compétences à risque */}
        <Box flex="1 1 600px" minWidth="500px">
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Warning color="warning" />
              <Typography variant="h6">
                Compétences à Risque
              </Typography>
            </Box>
            <Stack spacing={1}>
              {skillsAnalysis
                .filter(skill => skill.riskLevel !== 'low')
                .slice(0, 10)
                .map(skill => (
                  <Box
                    key={skill.name}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    p={1}
                    sx={{
                      bgcolor: skill.riskLevel === 'high' ? 'error.light' : 'warning.light',
                      borderRadius: 1,
                      opacity: 0.8
                    }}
                  >
                    <Typography variant="body2" fontWeight={500}>
                      {skill.name}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={`${skill.count} pers.`}
                        size="small"
                        color={skill.riskLevel === 'high' ? 'error' : 'warning'}
                      />
                      <Typography variant="caption">
                        {skill.percentage.toFixed(1)}%
                      </Typography>
                    </Stack>
                  </Box>
                ))}
            </Stack>
          </Paper>
        </Box>

        {/* Statistiques par département */}
        <Box flex="1 1 600px" minWidth="500px">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance par Département
            </Typography>
            <Stack spacing={2}>
              {departmentStats.map(dept => (
                <Box key={dept.department}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {dept.department}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dept.totalPeople} personnes
                    </Typography>
                  </Box>

                  <Box mb={1}>
                    <Typography variant="caption" color="text.secondary">
                      Moyenne: {dept.avgSkillsPerPerson.toFixed(1)} compétences/personne
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((dept.avgSkillsPerPerson / 10) * 100, 100)}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>

                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    <Typography variant="caption" color="text.secondary" mr={1}>
                      Top compétences:
                    </Typography>
                    {dept.topSkills.map(skill => (
                      <Chip
                        key={skill}
                        label={skill}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '10px' }}
                      />
                    ))}
                  </Box>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};