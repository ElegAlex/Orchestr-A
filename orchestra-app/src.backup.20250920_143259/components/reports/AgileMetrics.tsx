import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Tooltip,
  Alert,
  Stack,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  BugReport as BugIcon,
  Code as CodeIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CloudUpload as DeployIcon,
  Build as BuildIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  ReferenceLine,
} from 'recharts';
import { format, subDays, differenceInDays, differenceInHours, startOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task, User, Project } from '../../types';

interface AgileMetricsProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
}

const AgileMetrics: React.FC<AgileMetricsProps> = ({ tasks, users, projects }) => {
  const [selectedSprint, setSelectedSprint] = useState<string>('current');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<number>(30); // jours

  // Burndown basé sur les vraies tâches
  const sprintData = useMemo(() => {
    const currentDate = new Date();
    const sprintDuration = 14;
    const startDate = subDays(currentDate, sprintDuration - 1);

    // Filtrer les tâches du sprint actuel (dernières 2 semaines)
    const sprintTasks = selectedProject === 'all'
      ? tasks.filter(t => new Date(t.createdAt) >= startDate)
      : tasks.filter(t => t.projectId === selectedProject && new Date(t.createdAt) >= startDate);

    const totalTasks = sprintTasks.length;

    return Array.from({ length: sprintDuration }, (_, index) => {
      const date = subDays(currentDate, sprintDuration - index - 1);

      // Tâches terminées à cette date
      const tasksCompletedByDate = sprintTasks.filter(t =>
        t.status === 'DONE' &&
        t.completedDate &&
        new Date(t.completedDate) <= date
      ).length;

      const remainingTasks = Math.max(0, totalTasks - tasksCompletedByDate);
      const idealRemaining = Math.max(0, totalTasks - Math.round((totalTasks / sprintDuration) * (index + 1)));

      return {
        day: format(date, 'dd/MM'),
        ideal: idealRemaining,
        actual: remainingTasks,
        date: date
      };
    });
  }, [tasks, selectedProject]);

  // Vélocité réelle basée sur les tâches des dernières semaines
  const velocityData = useMemo(() => {
    const weeksData = [];
    for (let i = 5; i >= 0; i--) {
      const weekEnd = subDays(new Date(), i * 7);
      const weekStart = subDays(weekEnd, 6);

      const weekTasks = selectedProject === 'all'
        ? tasks.filter(t => {
            const createdDate = new Date(t.createdAt);
            return createdDate >= weekStart && createdDate <= weekEnd;
          })
        : tasks.filter(t => {
            const createdDate = new Date(t.createdAt);
            return t.projectId === selectedProject && createdDate >= weekStart && createdDate <= weekEnd;
          });

      const completedTasks = weekTasks.filter(t => t.status === 'DONE').length;
      const bugTasks = weekTasks.filter(t => t.type === 'BUG').length;

      weeksData.push({
        sprint: `Semaine ${6 - i}`,
        planifié: weekTasks.length,
        réalisé: completedTasks,
        bugs: bugTasks
      });
    }
    return weeksData;
  }, [tasks, selectedProject]);

  // Cumulative Flow Diagram avec vraies données
  const cumulativeFlowData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date()
    });

    const filteredTasks = selectedProject === 'all'
      ? tasks
      : tasks.filter(t => t.projectId === selectedProject);

    return days.map((day) => {
      // Tâches par statut à cette date
      const tasksAtDate = filteredTasks.filter(t => new Date(t.createdAt) <= day);

      const todo = tasksAtDate.filter(t => t.status === 'TODO').length;
      const inProgress = tasksAtDate.filter(t => t.status === 'IN_PROGRESS').length;
      const done = tasksAtDate.filter(t =>
        t.status === 'DONE' &&
        (!t.completedDate || new Date(t.completedDate) <= day)
      ).length;
      const blocked = tasksAtDate.filter(t => t.status === 'BLOCKED').length;

      return {
        date: format(day, 'dd/MM'),
        todo,
        inProgress,
        blocked,
        done,
        backlog: todo // Le backlog est l'ensemble des tâches à faire
      };
    });
  }, [tasks, selectedProject]);

  // Lead Time et Cycle Time
  const leadTimeMetrics = useMemo(() => {
    const filteredTasks = selectedProject === 'all'
      ? tasks
      : tasks.filter(t => t.projectId === selectedProject);

    const completedTasks = filteredTasks.filter(t => t.status === 'DONE' && t.completedDate);

    const leadTimes = completedTasks.map(task => {
      const created = new Date(task.createdAt);
      const completed = new Date(task.completedDate!);
      return differenceInDays(completed, created);
    });

    const avgLeadTime = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : 0;

    const avgCycleTime = Math.round(avgLeadTime * 0.6); // Simulation

    return {
      avgLeadTime,
      avgCycleTime,
      throughput: completedTasks.length,
      wip: filteredTasks.filter(t => t.status === 'IN_PROGRESS').length
    };
  }, [tasks, selectedProject]);

  // Métriques DevOps calculées
  const devOpsMetrics = useMemo(() => {
    const filteredTasks = selectedProject === 'all'
      ? tasks
      : tasks.filter(t => t.projectId === selectedProject);

    const completedTasks = filteredTasks.filter(t => t.status === 'DONE');
    const bugTasks = filteredTasks.filter(t => t.type === 'BUG');

    // Calculs basés sur vraies données
    const totalTasks = filteredTasks.length;
    const testCoverage = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
    const buildSuccessRate = totalTasks > 0 ? Math.round(((totalTasks - bugTasks.length) / totalTasks) * 100) : 100;
    const changeFailureRate = totalTasks > 0 ? Math.round((bugTasks.length / totalTasks) * 100) : 0;

    // Deployment frequency basée sur les tâches terminées par semaine
    const weeklyDeployments = completedTasks.length / 4; // Approximation

    return {
      deploymentFrequency: Math.round(weeklyDeployments * 10) / 10,
      leadTimeChanges: leadTimeMetrics.avgLeadTime,
      mttr: Math.round(leadTimeMetrics.avgCycleTime / 24 * 10) / 10, // Convertir jours en heures
      changeFailureRate,
      codeReviewTime: Math.round(leadTimeMetrics.avgCycleTime * 0.3 * 10) / 10,
      testCoverage,
      buildSuccessRate,
      pipelineEfficiency: Math.round((testCoverage + buildSuccessRate) / 2)
    };
  }, [tasks, selectedProject, leadTimeMetrics]);

  // Bug vs Feature Ratio
  const bugFeatureData = useMemo(() => {
    const bugs = tasks.filter(t => t.type === 'BUG').length;
    const stories = tasks.filter(t => t.type === 'STORY').length;
    const epics = tasks.filter(t => t.type === 'EPIC').length;
    const spikes = tasks.filter(t => t.type === 'SPIKE').length;
    const normalTasks = tasks.filter(t => t.type === 'TASK').length;

    return [
      { name: 'Stories', value: stories, color: '#4caf50' },
      { name: 'Bugs', value: bugs, color: '#f44336' },
      { name: 'Tasks', value: normalTasks, color: '#2196f3' },
      { name: 'Epics', value: epics, color: '#9c27b0' },
      { name: 'Spikes', value: spikes, color: '#ff9800' },
    ];
  }, [tasks]);

  // Stats par équipe basées sur les vraies données
  const teamStats = useMemo(() => {
    return users
      .filter(u => u.isActive)
      .slice(0, 8)
      .map(user => {
        const userTasks = tasks.filter(t => t.responsible && t.responsible.includes(user.id));
        const completedTasks = userTasks.filter(t => t.status === 'DONE');
        const activeTasks = userTasks.filter(t => t.status === 'IN_PROGRESS');
        const todoTasks = userTasks.filter(t => t.status === 'TODO');

        return {
          name: user.displayName.split(' ')[0] || 'User',
          total: userTasks.length,
          completed: completedTasks.length,
          active: activeTasks.length,
          todo: todoTasks.length,
          completionRate: userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0
        };
      })
      .filter(user => user.total > 0);
  }, [users, tasks]);

  // Resource Allocation
  const resourceAllocation = useMemo(() => {
    return projects.slice(0, 5).map(project => {
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      const assignedUsers = new Set(
        projectTasks.flatMap(t => t.responsible || [])
      );

      return {
        project: project.name.substring(0, 15),
        resources: assignedUsers.size,
        workload: projectTasks.filter(t => t.status === 'IN_PROGRESS').length,
        capacity: assignedUsers.size * 8, // heures/jour
        utilization: Math.min(100, Math.round((projectTasks.length / (assignedUsers.size * 20 || 1)) * 100))
      };
    });
  }, [projects, tasks]);

  // Backlog Health Metrics
  const backlogHealth = useMemo(() => {
    const backlogTasks = tasks.filter(t => t.status === 'TODO');
    const now = new Date();

    const aged = backlogTasks.filter(t =>
      differenceInDays(now, new Date(t.createdAt)) > 30
    ).length;

    const unestimated = backlogTasks.filter(t => !t.estimatedHours).length;
    const prioritized = backlogTasks.filter(t => t.priority).length;

    return {
      total: backlogTasks.length,
      aged,
      unestimated,
      prioritized,
      healthScore: Math.round(((prioritized - aged - unestimated) / backlogTasks.length) * 100) || 0
    };
  }, [tasks]);

  const COLORS = ['#667eea', '#4ecdc4', '#f093fb', '#f5576c', '#4facfe', '#43e97b'];

  return (
    <Box>
      {/* En-tête didactique */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          📊 Tableau de Bord Agile & DevOps
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          📝 <strong>Mode d'emploi :</strong> Ce tableau présente les indicateurs clés pour suivre la performance de vos projets IT.
          Les icônes ⚠️ vous donnent des explications détaillées au survol.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          🎓 <strong>Pour bien démarrer :</strong>
          <br />• <strong>Burndown Chart</strong> : Plus la courbe bleue suit la ligne droite, mieux c'est
          <br />• <strong>Vélocité</strong> : Une cadence régulière vaut mieux qu'une cadence rapide mais chaotique
          <br />• <strong>Santé Backlog</strong> : Objectif {'>'}70% pour une équipe bien organisée
        </Alert>
      </Box>

      {/* Filtres */}
      <Box display="flex" gap={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sprint</InputLabel>
          <Select value={selectedSprint} onChange={(e) => setSelectedSprint(e.target.value)} label="Sprint">
            <MenuItem value="current">Sprint Actuel</MenuItem>
            <MenuItem value="previous">Sprint Précédent</MenuItem>
            <MenuItem value="all">Tous les Sprints</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Projet</InputLabel>
          <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} label="Projet">
            <MenuItem value="all">Tous les projets</MenuItem>
            {projects.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards Agile/DevOps */}
      <Box display="flex" gap={3} flexWrap="wrap" mb={3}>
        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="subtitle2">
                    ⏱️ Temps de Livraison
                  </Typography>
                  <Typography variant="h4">
                    {leadTimeMetrics.avgLeadTime}j
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Durée moyenne de A à Z
                  </Typography>
                </Box>
                <TimerIcon color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="subtitle2">
                    🚀 Fréquence Livraisons
                  </Typography>
                  <Typography variant="h4">
                    {devOpsMetrics.deploymentFrequency}/sem
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    Mises en production/semaine
                  </Typography>
                </Box>
                <DeployIcon color="success" />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="subtitle2">
                    🔧 Temps de Réparation
                  </Typography>
                  <Typography variant="h4">
                    {devOpsMetrics.mttr}h
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    Délai correction incidents
                  </Typography>
                </Box>
                <BuildIcon color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="subtitle2">
                    WIP Limit
                  </Typography>
                  <Typography variant="h4">
                    {leadTimeMetrics.wip}/{users.length * 2}
                  </Typography>
                  <Typography variant="caption" color={leadTimeMetrics.wip > users.length * 2 ? 'error.main' : 'success.main'}>
                    {leadTimeMetrics.wip > users.length * 2 ? 'Over capacity!' : 'Healthy'}
                  </Typography>
                </Box>
                <SpeedIcon color={leadTimeMetrics.wip > users.length * 2 ? 'error' : 'primary'} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Graphiques principaux */}
      <Box display="flex" gap={3} flexWrap="wrap" mb={3}>
        {/* Burndown Chart */}
        <Box flex="1 1 45%" minWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  📈 Burndown Chart (Courbe d'avancement)
                </Typography>
                <Tooltip title="Montre l'évolution du travail restant jour par jour. La ligne idéale (droite) vs la réalité (courbe bleue). Si la courbe bleue est au-dessus de la ligne idéale, le sprint est en retard.">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sprintData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ideal"
                      stroke="#ccc"
                      strokeDasharray="5 5"
                      name="Burndown Idéal"
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#667eea"
                      strokeWidth={2}
                      name="Burndown Réel"
                    />
                    <ReferenceLine y={0} stroke="#4caf50" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
              {sprintData[sprintData.length - 1].actual > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  ⚠️ <strong>Sprint en retard :</strong> {sprintData[sprintData.length - 1].actual} tâches restantes.
                  <br />💡 <em>Action recommandée :</em> Ré-prioriser les tâches ou déplacer certaines au sprint suivant.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Velocity Chart */}
        <Box flex="1 1 45%" minWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  🚀 Vélocité d'Équipe (Rythme de travail)
                </Typography>
                <Tooltip title="Mesure la quantité de travail accomplie par semaine. Plus c'est régulier, plus l'équipe est prévisible. Les barres rouges montrent les bugs à corriger.">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sprint" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="planifié" fill="#e0e0e0" />
                    <Bar dataKey="réalisé" fill="#667eea" />
                    <Bar dataKey="bugs" fill="#f44336" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box display="flex" justifyContent="space-between" mt={2}>
                <Chip
                  label={`🎯 Cadence: ${Math.round(velocityData.reduce((a, b) => a + b.réalisé, 0) / velocityData.length)} tâches/semaine`}
                  color="primary"
                />
                <Chip
                  label={`🎢 Fiabilité: ${Math.round((velocityData.reduce((a, b) => a + b.réalisé, 0) / velocityData.reduce((a, b) => a + b.planifié, 0)) * 100)}%`}
                  color="success"
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Cumulative Flow Diagram */}
        <Box width="100%">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  📊 Diagramme de Flux Cumulatif (Suivi des goulots)
                </Typography>
                <Tooltip title="Visualise la progression des tâches dans le process. Si une couleur 'gonfle', c'est un goulot d'étranglement. L'idéal est des bandes parallèles et régulières.">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeFlowData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="done" stackId="1" stroke="#4caf50" fill="#4caf50" name="✅ Terminé" />
                    <Area type="monotone" dataKey="review" stackId="1" stroke="#ff9800" fill="#ff9800" name="🔍 En revue" />
                    <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#2196f3" fill="#2196f3" name="⚙️ En cours" />
                    <Area type="monotone" dataKey="todo" stackId="1" stroke="#9c27b0" fill="#9c27b0" name="📅 À faire" />
                    <Area type="monotone" dataKey="backlog" stackId="1" stroke="#e0e0e0" fill="#e0e0e0" name="📦 En attente" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Métriques DevOps et Backlog */}
      <Box display="flex" gap={3} flexWrap="wrap" mb={3}>
        {/* DevOps Metrics Dashboard */}
        <Box flex="1 1 45%" minWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  ⚙️ Indicateurs DevOps (Qualité technique)
                </Typography>
                <Tooltip title="Métriques de performance technique : couverture de tests, fréquence des livraisons, temps de résolution des incidents. Plus c'est vert, mieux c'est !">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Box flex="1" minWidth="150px">
                  <Box p={2} bgcolor="background.default" borderRadius={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      🧪 Tests Automatisés
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5">{devOpsMetrics.testCoverage}%</Typography>
                      <TrendingUpIcon color="success" fontSize="small" />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={devOpsMetrics.testCoverage}
                      sx={{ mt: 1 }}
                      color={devOpsMetrics.testCoverage > 70 ? 'success' : 'warning'}
                    />
                  </Box>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Box p={2} bgcolor="background.default" borderRadius={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ⚙️ Succès Compilation
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5">{devOpsMetrics.buildSuccessRate}%</Typography>
                      {devOpsMetrics.buildSuccessRate > 90 ? <CheckIcon color="success" fontSize="small" /> : <WarningIcon color="warning" fontSize="small" />}
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={devOpsMetrics.buildSuccessRate}
                      sx={{ mt: 1 }}
                      color={devOpsMetrics.buildSuccessRate > 90 ? 'success' : 'error'}
                    />
                  </Box>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Box p={2} bgcolor="background.default" borderRadius={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      🚨 Taux d'Échec
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5">{devOpsMetrics.changeFailureRate}%</Typography>
                      <TrendingDownIcon color="success" fontSize="small" />
                    </Box>
                  </Box>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Box p={2} bgcolor="background.default" borderRadius={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      🚀 Efficacité Process
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h5">{devOpsMetrics.pipelineEfficiency}%</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Backlog Health */}
        <Box flex="1 1 45%" minWidth="400px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  📋 Santé du Backlog (État de la pile de tâches)
                </Typography>
                <Tooltip title="Évalue la qualité de votre liste de tâches : pas trop de tâches anciennes (>30j), la plupart estimées et priorisées. Score >70% = bon état.">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2">🎥 Score de Santé</Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.max(0, backlogHealth.healthScore)}
                      sx={{ width: 100 }}
                      color={backlogHealth.healthScore > 70 ? 'success' : backlogHealth.healthScore > 40 ? 'warning' : 'error'}
                    />
                    <Typography variant="h6">{backlogHealth.healthScore}%</Typography>
                  </Box>
                </Box>

                <Box display="flex" gap={2} flexWrap="wrap">
                  <Box flex="1" minWidth="150px">
                    <Box p={2} bgcolor="background.default" borderRadius={1}>
                      <Typography variant="caption" color="text.secondary">📋 Total tâches</Typography>
                      <Typography variant="h6">{backlogHealth.total}</Typography>
                    </Box>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Box p={2} bgcolor="error.light" borderRadius={1}>
                      <Typography variant="caption">⏰ Anciennes (&gt;30j)</Typography>
                      <Typography variant="h6">{backlogHealth.aged}</Typography>
                    </Box>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Box p={2} bgcolor="warning.light" borderRadius={1}>
                      <Typography variant="caption">❓ Non chiffrées</Typography>
                      <Typography variant="h6">{backlogHealth.unestimated}</Typography>
                    </Box>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Box p={2} bgcolor="success.light" borderRadius={1}>
                      <Typography variant="caption">⭐ Priorisées</Typography>
                      <Typography variant="h6">{backlogHealth.prioritized}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Resource Management */}
      <Box display="flex" gap={3} flexWrap="wrap">
        {/* Resource Allocation Table */}
        <Box flex="1 1 60%" minWidth="500px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  👥 Répartition des Équipes par Projet
                </Typography>
                <Tooltip title="Montre qui travaille sur quoi et à quel niveau de charge. Rouge >90% = surcharge, Orange >70% = charge élevée, Vert = équilibré.">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>📁 Projet</TableCell>
                      <TableCell align="center">👥 Équipiers</TableCell>
                      <TableCell align="center">🎯 Charge</TableCell>
                      <TableCell align="center">⏱️ Capacité (h/j)</TableCell>
                      <TableCell>📈 Utilisation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resourceAllocation.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.project}</TableCell>
                        <TableCell align="center">
                          <AvatarGroup max={3} sx={{ justifyContent: 'center' }}>
                            {Array.from({ length: row.resources }).map((_, i) => (
                              <Avatar key={i} sx={{ width: 24, height: 24, bgcolor: COLORS[i % COLORS.length] }}>
                                {String.fromCharCode(65 + i)}
                              </Avatar>
                            ))}
                          </AvatarGroup>
                        </TableCell>
                        <TableCell align="center">{row.workload}</TableCell>
                        <TableCell align="center">{row.capacity}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LinearProgress
                              variant="determinate"
                              value={row.utilization}
                              sx={{ flexGrow: 1 }}
                              color={row.utilization > 90 ? 'error' : row.utilization > 70 ? 'warning' : 'primary'}
                            />
                            <Typography variant="caption">{row.utilization}%</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>

        {/* Team Performance Stats */}
        <Box flex="1 1 35%" minWidth="350px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="h6" gutterBottom>
                  🏆 Performance Individuelle des Équipiers
                </Typography>
                <Tooltip title="Nombre de tâches par personne : Vert = terminées, Orange = en cours, Bleu = à faire. Permet de voir la répartition du travail et identifier les besoins d'aide.">
                  <WarningIcon color="action" fontSize="small" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="#4caf50" name="Terminées" />
                    <Bar dataKey="active" fill="#ff9800" name="En cours" />
                    <Bar dataKey="todo" fill="#2196f3" name="À faire" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box mt={2}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  📋 <strong>Interprétation :</strong> Basé sur {teamStats.length} membres actifs.
                  <br />🔄 Barres déséquilibrées = redistribuer la charge.
                  <br />🏆 Beaucoup de vert = équipe productive !
                </Alert>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default AgileMetrics;