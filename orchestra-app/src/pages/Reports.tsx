import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  GetApp as GetAppIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  AccountTree as AccountTreeIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Project, Task, User, Milestone } from '../types';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { userService } from '../services/user.service';
import { milestoneService } from '../services/milestone.service';
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

// Lazy load des composants
const PortfolioGantt = lazy(() => import('../components/reports/PortfolioGantt'));

interface ReportData {
  projects: Project[];
  tasks: Task[];
  users: User[];
  milestones: Milestone[];
}

interface MetricCard {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactElement;
}

const Reports: React.FC = () => {
  const [data, setData] = useState<ReportData>({ projects: [], tasks: [], users: [], milestones: [] });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const [projects, tasks, users] = await Promise.all([
        projectService.getAllProjects(),
        taskService.getTasks(),
        userService.getAllUsers()
      ]);

      // Recalculer le progress de chaque projet à la volée en excluant les sous-tâches
      const projectsWithRecalculatedProgress = await Promise.all(
        projects.map(async (project) => {
          try {
            const tasksQuery = query(
              collection(db, 'tasks'),
              where('projectId', '==', project.id)
            );
            const tasksSnapshot = await getDocs(tasksQuery);

            if (tasksSnapshot.empty) {
              return { ...project, progress: 0 };
            }

            let totalTasks = 0;
            let completedTasks = 0;
            let totalStoryPoints = 0;
            let completedStoryPoints = 0;

            tasksSnapshot.docs.forEach(doc => {
              const task = doc.data() as Task;

              // Exclure les sous-tâches
              if (task.parentTaskId) {
                return;
              }

              totalTasks++;
              const storyPoints = task.storyPoints || 1;
              totalStoryPoints += storyPoints;

              if (task.status === 'DONE') {
                completedTasks++;
                completedStoryPoints += storyPoints;
              }
            });

            // Calculer le progrès
            let calculatedProgress = 0;
            if (totalStoryPoints > 0) {
              calculatedProgress = Math.round((completedStoryPoints / totalStoryPoints) * 100);
            } else if (totalTasks > 0) {
              calculatedProgress = Math.round((completedTasks / totalTasks) * 100);
            }

            return { ...project, progress: calculatedProgress };
          } catch (error) {
            console.error(`Error calculating progress for project ${project.id}:`, error);
            return project;
          }
        })
      );

      // Charger les jalons pour tous les projets
      const milestonePromises = projectsWithRecalculatedProgress.map(p => milestoneService.getProjectMilestones(p.id));
      const milestonesArrays = await Promise.all(milestonePromises);
      const allMilestones = milestonesArrays.flat();

      console.log('Projects loaded:', projectsWithRecalculatedProgress.length);
      console.log('Milestones loaded:', allMilestones.length);
      console.log('Milestones details:', allMilestones);

      setData({ projects: projectsWithRecalculatedProgress, tasks, users, milestones: allMilestones });
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'week':
        startDate = startOfWeek(now, { locale: fr });
        break;
      case 'month':
        startDate = subDays(now, 30);
        break;
      case 'quarter':
        startDate = subDays(now, 90);
        break;
      case 'year':
        startDate = subDays(now, 365);
        break;
      default:
        startDate = subDays(now, 30);
    }

    let filteredProjects = data.projects.filter(p => new Date(p.createdAt) >= startDate);
    let filteredTasks = data.tasks.filter(t => new Date(t.createdAt) >= startDate);

    if (selectedProject !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.id === selectedProject);
      filteredTasks = filteredTasks.filter(t => t.projectId === selectedProject);
    }

    return { projects: filteredProjects, tasks: filteredTasks, users: data.users };
  };

  const getMetrics = (): MetricCard[] => {
    const filtered = getFilteredData();
    
    const totalProjects = filtered.projects.length;
    const activeProjects = filtered.projects.filter(p => p.status === 'active').length;
    const completedProjects = filtered.projects.filter(p => p.status === 'completed').length;

    // Exclure les sous-tâches du calcul (seules les tâches parentes comptent)
    const parentTasks = filtered.tasks.filter(t => !t.parentTaskId);
    const totalTasks = parentTasks.length;
    const completedTasks = parentTasks.filter(t => t.status === 'DONE').length;
    const overdueTasks = filtered.tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
    ).length;
    const activeUsers = filtered.users.filter(u => u.isActive).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return [
      {
        title: 'Projets Actifs',
        value: activeProjects,
        change: totalProjects > 0 ? `${totalProjects} total` : '',
        trend: activeProjects > completedProjects ? 'up' : 'stable',
        color: 'primary',
        icon: <AssessmentIcon />
      },
      {
        title: 'Taux de Completion',
        value: `${Math.round(completionRate)}%`,
        change: `${completedTasks}/${totalTasks} tâches`,
        trend: completionRate >= 75 ? 'up' : completionRate >= 50 ? 'stable' : 'down',
        color: completionRate >= 75 ? 'success' : completionRate >= 50 ? 'warning' : 'error',
        icon: <TrendingUpIcon />
      },
      {
        title: 'Tâches en Retard',
        value: overdueTasks,
        change: overdueTasks > 0 ? 'Attention requise' : 'Tout va bien',
        trend: overdueTasks > 0 ? 'down' : 'up',
        color: overdueTasks > 0 ? 'error' : 'success',
        icon: <WarningIcon />
      },
      {
        title: 'Équipe Active',
        value: activeUsers,
        change: `${data.users.length} total`,
        trend: 'stable',
        color: 'info',
        icon: <PeopleIcon />
      }
    ];
  };

  const getProjectProgressData = () => {
    return getFilteredData().projects.map(project => ({
      name: project.name.length > 15 ? `${project.name.substring(0, 15)  }...` : project.name,
      progress: project.progress,
      status: project.status,
      tasks: data.tasks.filter(t => t.projectId === project.id).length
    }));
  };

  const getTaskStatusData = () => {
    const filtered = getFilteredData();

    // Exclure les sous-tâches du calcul (seules les tâches parentes comptent)
    const parentTasks = filtered.tasks.filter(t => !t.parentTaskId);

    const statusCounts = {
      'À faire': parentTasks.filter(t => t.status === 'TODO').length,
      'En cours': parentTasks.filter(t => t.status === 'IN_PROGRESS').length,
      'Terminé': parentTasks.filter(t => t.status === 'DONE').length,
      'Bloqué': parentTasks.filter(t => t.status === 'BLOCKED').length,
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: name === 'Terminé' ? '#4caf50' : 
             name === 'En cours' ? '#ff9800' : 
             name === 'Bloqué' ? '#f44336' : '#2196f3'
    }));
  };

  const exportReport = () => {
    const reportData = {
      metrics: getMetrics(),
      projects: getFilteredData().projects,
      tasks: getFilteredData().tasks,
      generatedAt: new Date().toISOString(),
      dateRange,
      selectedProject
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orchestr-a-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const COLORS = ['#667eea', '#764ba2', '#4ecdc4', '#45b7d1', '#f093fb', '#f5576c'];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  const metrics = getMetrics();
  const projectProgressData = getProjectProgressData();
  const taskStatusData = getTaskStatusData();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Rapports & Analytics
        </Typography>
        
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Période</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              label="Période"
            >
              <MenuItem value="week">Cette semaine</MenuItem>
              <MenuItem value="month">Ce mois</MenuItem>
              <MenuItem value="quarter">Ce trimestre</MenuItem>
              <MenuItem value="year">Cette année</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Projet</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="Projet"
            >
              <MenuItem value="all">Tous les projets</MenuItem>
              {data.projects.map(project => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Actualiser les données">
            <IconButton onClick={loadReportData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<GetAppIcon />}
            onClick={exportReport}
          >
            Exporter
          </Button>
        </Stack>
      </Box>

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab
            icon={<BarChartIcon />}
            label="Analytics"
            id="tab-0"
            aria-controls="tabpanel-0"
          />
          <Tab
            icon={<AccountTreeIcon />}
            label="Gantt Portfolio"
            id="tab-1"
            aria-controls="tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Tab Panel 0: Analytics */}
      {tabValue === 0 && (
        <Box>
          {/* Métriques principales */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 4 }}>
        {metrics.map((metric, index) => (
          <Box sx={{ flexGrow: 1, minWidth: 200 }} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: `${metric.color}.light`,
                      color: `${metric.color}.contrastText`,
                    }}
                  >
                    {metric.icon}
                  </Box>
                  <Box flexGrow={1}>
                    <Typography variant="h4" color={metric.color}>
                      {metric.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metric.title}
                    </Typography>
                    {metric.change && (
                      <Typography variant="caption" color="text.secondary">
                        {metric.change}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Graphiques principaux */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 4 }}>
        {/* Progression des projets */}
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progression des Projets
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectProgressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <RechartsTooltip />
                    <Bar dataKey="progress" fill="#667eea" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Répartition des tâches */}
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statut des Tâches
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Tableau détaillé des projets */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Détail des Projets
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Projet</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Progression</TableCell>
                  <TableCell align="center">Tâches</TableCell>
                  <TableCell>Chef de projet</TableCell>
                  <TableCell align="right">Heures Consommées</TableCell>
                  <TableCell align="right">Heures Budgétées</TableCell>
                  <TableCell>Échéance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getFilteredData().projects.map((project) => {
                  // Exclure les sous-tâches du calcul (seules les tâches parentes comptent)
                  const projectTasks = data.tasks.filter(t => t.projectId === project.id && !t.parentTaskId);
                  const completedTasks = projectTasks.filter(t => t.status === 'DONE');
                  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed';

                  // Calculer les heures consommées : somme des loggedHours de toutes les tâches du projet
                  const allProjectTasks = data.tasks.filter(t => t.projectId === project.id);
                  const totalLoggedHours = allProjectTasks.reduce((sum, task) => sum + (task.loggedHours || 0), 0);

                  return (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {project.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {project.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={project.status.replace('_', ' ').toUpperCase()}
                          color={
                            project.status === 'completed' ? 'success' :
                            project.status === 'active' ? 'primary' :
                            project.status === 'on_hold' ? 'warning' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LinearProgress
                            variant="determinate"
                            value={project.progress}
                            sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption">
                            {project.progress}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {completedTasks.length}/{projectTasks.length}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {project.projectManager}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={
                            project.budget && totalLoggedHours > project.budget
                              ? 'error'
                              : 'text.primary'
                          }
                        >
                          {totalLoggedHours}h
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {project.budget || 0}h
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={isOverdue ? 'error' : 'text.primary'}
                        >
                          {project.dueDate ? format(new Date(project.dueDate), 'dd/MM/yyyy', { locale: fr }) : 'Non définie'}
                          {isOverdue && (
                            <Chip
                              size="small"
                              label="Retard"
                              color="error"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

          {/* Alertes et recommandations */}
          {data.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length > 0 && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Attention requise
              </Typography>
              <Typography variant="body2">
                {data.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length} tâche(s) en retard nécessitent votre attention.
                Consultez la page Tâches pour plus de détails.
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {/* Tab Panel 1: Gantt Portfolio */}
      {tabValue === 1 && (
        <Box sx={{ height: 'calc(100vh - 300px)', minHeight: 600 }}>
          <Suspense fallback={
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress size={60} />
            </Box>
          }>
            <PortfolioGantt
              projects={data.projects}
              milestones={data.milestones}
            />
          </Suspense>
        </Box>
      )}

    </Box>
  );
};

export { Reports };
export default Reports;