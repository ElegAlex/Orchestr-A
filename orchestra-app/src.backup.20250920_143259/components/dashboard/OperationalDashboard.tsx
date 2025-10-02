import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  LinearProgress,
  IconButton,
  Tooltip,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Assignment as TaskIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Group as TeamIcon,
  Timeline as TimelineIcon,
  Notifications as NotificationIcon,
  MoreVert as MoreVertIcon,
  Launch as LaunchIcon,
  PriorityHigh as PriorityIcon,
  Psychology as SkillIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { format, isAfter, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

import { 
  dashboardService, 
  DashboardStats, 
  RecentProject, 
  TaskSummary, 
  TeamMemberWorkload,
  ActivityFeedItem 
} from '../../services/dashboard.service';
import { analyticsService } from '../../services/analytics.service';
import { skillsService } from '../../services/skills.service';
import { SkillDashboardData, SkillMetrics } from '../../types';
import KPICard from '../charts/KPICard';
import AnalyticsChart from '../charts/AnalyticsChart';
import { useAppSelector } from '../../hooks/redux';

// =======================================================================================
// TYPES & INTERFACES
// =======================================================================================

interface OperationalDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// =======================================================================================
// COMPOSANT PRINCIPAL
// =======================================================================================

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 180000 // 3 minutes
}) => {
  const { user } = useAppSelector(state => state.auth);
  
  // État
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    activeTasks: 0,
    teamMembers: 0,
    completionRate: 0
  });
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [teamWorkload, setTeamWorkload] = useState<TeamMemberWorkload[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [chartData, setChartData] = useState<any>({});
  const [skillsData, setSkillsData] = useState<SkillDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // =======================================================================================
  // CHARGEMENT DES DONNÉES
  // =======================================================================================

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      if (!user?.id) return;

      // Charger les données en parallèle
      const [
        statsData,
        projectsData,
        tasksData,
        workloadData,
        activityData,
        skillsData
      ] = await Promise.all([
        dashboardService.getDashboardStats(user.id),
        dashboardService.getRecentProjects(user.id),
        dashboardService.getUpcomingTasks(user.id),
        dashboardService.getTeamWorkload(),
        dashboardService.getActivityFeed(20),
        skillsService.getSkillsMetrics({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 jours
          endDate: new Date(),
          label: 'Derniers 30 jours'
        })
      ]);

      setStats(statsData);
      setProjects(projectsData);
      setTasks(tasksData);
      setTeamWorkload(workloadData);
      setActivityFeed(activityData);
      setSkillsData(skillsData);

      // Charger les données de graphiques
      const chartPromises = [
        dashboardService.getChartWidgetData({ 
          dataSource: 'task_completion', 
          chartType: 'line',
          dateRange: 'week'
        }),
        dashboardService.getChartWidgetData({ 
          dataSource: 'project_progress', 
          chartType: 'bar'
        })
      ];

      const [taskCompletion, projectProgress] = await Promise.all(chartPromises);

      setChartData({
        taskCompletion,
        projectProgress
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading operational dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chargement initial et auto-refresh
  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // =======================================================================================
  // UTILITAIRES
  // =======================================================================================

  const getTaskPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      case 'P3': return 'default';
      default: return 'default';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'review': return 'warning';
      case 'on_hold': return 'error';
      case 'completed': return 'info';
      default: return 'default';
    }
  };

  const isTaskOverdue = (dueDate: Date) => {
    return isAfter(new Date(), dueDate);
  };

  const getDaysUntilDeadline = (deadline: Date) => {
    return differenceInDays(deadline, new Date());
  };

  const getWorkloadColor = (workload: number) => {
    if (workload >= 90) return 'error';
    if (workload >= 70) return 'warning';
    if (workload >= 50) return 'success';
    return 'info';
  };

  const getSkillLevelColor = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1: return 'primary';
      case 2: return 'warning';
      case 3: return 'success';
      default: return 'default';
    }
  };

  const getShortageColor = (level?: 'low' | 'medium' | 'high' | 'critical') => {
    switch (level) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  // =======================================================================================
  // COMPOSANTS DE RENDU
  // =======================================================================================

  /**
   * Rendu de l'en-tête
   */
  const renderHeader = () => (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard Opérationnel
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Suivi quotidien des projets, tâches et équipe
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Dernière mise à jour: {format(lastUpdated, 'dd/MM/yyyy à HH:mm', { locale: fr })}
        </Typography>
      </Box>
      
      <Tooltip title="Actualiser">
        <IconButton onClick={loadDashboardData} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  /**
   * Rendu des statistiques rapides
   */
  const renderQuickStats = () => (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <TaskIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{stats.activeTasks}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Tâches Actives
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
      
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <TimelineIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{stats.activeProjects}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Projets Actifs
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
      
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <TeamIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{stats.teamMembers}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Membres Équipe
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
      
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center">
              <CheckCircleIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{stats.completionRate}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  Taux Completion
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );

  /**
   * Rendu des tâches prioritaires
   */
  const renderPriorityTasks = () => (
    <Card>
      <CardHeader
        title="Tâches Prioritaires"
        subheader="Tâches nécessitant une attention immédiate"
        action={
          <Button size="small" endIcon={<LaunchIcon />}>
            Voir tout
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tâche</TableCell>
                <TableCell>Projet</TableCell>
                <TableCell>Priorité</TableCell>
                <TableCell>Échéance</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.slice(0, 5).map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {task.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {task.projectName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={task.priority} 
                      size="small" 
                      color={getTaskPriorityColor(task.priority) as any}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {isTaskOverdue(task.dueDate) && (
                        <WarningIcon color="error" fontSize="small" />
                      )}
                      <Typography 
                        variant="caption" 
                        color={isTaskOverdue(task.dueDate) ? 'error' : 'text.primary'}
                      >
                        {format(task.dueDate, 'dd/MM')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={task.status.replace('_', ' ')} 
                      size="small" 
                      variant="filled"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  /**
   * Rendu des projets actifs
   */
  const renderActiveProjects = () => (
    <Card>
      <CardHeader
        title="Projets Actifs"
        subheader="Vue d'ensemble des projets en cours"
        action={
          <Button size="small" endIcon={<LaunchIcon />}>
            Voir tout
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {projects.map((project) => {
          const daysLeft = getDaysUntilDeadline(project.deadline);
          const isUrgent = daysLeft <= 7;
          
          return (
            <Box key={project.id} mb={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {project.name}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  {isUrgent && <PriorityIcon color="warning" fontSize="small" />}
                  <Chip 
                    label={project.status} 
                    size="small" 
                    color={getProjectStatusColor(project.status) as any}
                  />
                </Box>
              </Box>
              
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                {project.description}
              </Typography>
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="caption">
                  Échéance: {format(project.deadline, 'dd/MM/yyyy')} 
                  {isUrgent && ` (${daysLeft} jours restants)`}
                </Typography>
                <Typography variant="caption">
                  {project.progress}% complété
                </Typography>
              </Box>
              
              <LinearProgress 
                variant="determinate" 
                value={project.progress} 
                color={project.progress >= 75 ? 'success' : project.progress >= 50 ? 'warning' : 'error'}
                sx={{ height: 8, borderRadius: 1 }}
              />
              
              {project !== projects[projects.length - 1] && <Divider sx={{ mt: 2 }} />}
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );

  /**
   * Rendu de la charge de travail de l'équipe
   */
  const renderTeamWorkload = () => (
    <Card>
      <CardHeader
        title="Charge de Travail Équipe"
        subheader="Répartition de la charge par membre"
      />
      <CardContent sx={{ pt: 0 }}>
        <List dense>
          {teamWorkload.slice(0, 6).map((member) => (
            <ListItem key={member.userId} sx={{ px: 0 }}>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: getWorkloadColor(member.workload) + '.main' }}>
                  {member.displayName.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.displayName}
                secondary={`${member.role} • ${member.activeProjects} projets actifs`}
              />
              <ListItemSecondaryAction>
                <Box textAlign="right">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {member.workload}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={member.workload}
                    color={getWorkloadColor(member.workload) as any}
                    sx={{ width: 60, height: 4, mt: 0.5 }}
                  />
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  /**
   * Rendu du feed d'activité
   */
  const renderActivityFeed = () => (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <NotificationIcon />
            Activité Récente
          </Box>
        }
        subheader="Dernières actions et événements"
      />
      <CardContent sx={{ pt: 0 }}>
        <List dense>
          {activityFeed.slice(0, 8).map((activity) => (
            <ListItem key={activity.id} sx={{ px: 0 }}>
              <ListItemAvatar>
                <Avatar 
                  sx={{ 
                    bgcolor: activity.severity === 'error' ? 'error.main' : 
                             activity.severity === 'warning' ? 'warning.main' :
                             activity.severity === 'success' ? 'success.main' : 'info.main',
                    width: 32,
                    height: 32
                  }}
                >
                  {activity.type === 'task_completed' ? <CheckCircleIcon fontSize="small" /> :
                   activity.type === 'alert_triggered' ? <WarningIcon fontSize="small" /> :
                   <NotificationIcon fontSize="small" />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={activity.title}
                secondary={
                  <Box>
                    <Typography variant="caption" component="div">
                      {activity.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(activity.timestamp, 'dd/MM à HH:mm')}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  /**
   * Rendu des graphiques
   */
  const renderCharts = () => (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <AnalyticsChart
          
          data={chartData.taskCompletion || []}
          title="Évolution des Tâches"
          
          height={300}
          
          
        />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <AnalyticsChart
          
          data={chartData.projectProgress || []}
          title="Progression Projets"
          
          height={300}
          
        />
      </Box>
    </Box>
  );

  // =======================================================================================
  // RENDU PRINCIPAL
  // =======================================================================================

  if (loading && projects.length === 0) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="h6" align="center" sx={{ mt: 2 }}>
          Chargement du dashboard...
        </Typography>
      </Box>
    );
  }

  /**
   * Rendu des métriques de compétences
   */
  const renderSkillsMetrics = () => {
    if (!skillsData || skillsData.skillMetrics.length === 0) {
      return (
        <Card>
          <CardHeader 
            title={
              <Box display="flex" alignItems="center" gap={1}>
                <SkillIcon />
                <Typography variant="h6">Compétences - Taux d'utilisation</Typography>
              </Box>
            }
          />
          <CardContent>
            <Alert severity="info">
              Aucune donnée de compétences disponible. Configurez les compétences de votre équipe pour voir les métriques.
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader 
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SkillIcon />
              <Typography variant="h6">Compétences - Taux d'utilisation</Typography>
              <Chip 
                label={`${Math.round(skillsData.overallSkillUtilization)}% global`}
                size="small"
                color={skillsData.overallSkillUtilization > 80 ? 'error' : skillsData.overallSkillUtilization > 60 ? 'warning' : 'success'}
              />
            </Box>
          }
          action={
            <Tooltip title="Actualiser les métriques">
              <IconButton onClick={loadDashboardData}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <CardContent>
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {skillsData.skillMetrics.slice(0, 10).map((skill) => (
              <Box key={skill.skillId} sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight="medium">
                      {skill.skillName}
                    </Typography>
                    <Chip 
                      label={skill.category} 
                      size="small" 
                      variant="outlined"
                    />
                    {skill.isInShortage && (
                      <Chip 
                        label={`Pénurie ${skill.shortageLevel}`}
                        size="small"
                        color={getShortageColor(skill.shortageLevel) as any}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(skill.utilizationRate)}%
                  </Typography>
                </Box>
                
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(skill.utilizationRate, 100)}
                  color={skill.utilizationRate > 90 ? 'error' : skill.utilizationRate > 70 ? 'warning' : 'success'}
                  sx={{ height: 6, borderRadius: 3, mb: 1 }}
                />
                
                <Box display="flex" justifyContent="between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {skill.availablePeople}/{skill.totalPeople} personnes disponibles
                  </Typography>
                  <Box display="flex" gap={0.5}>
                    {[1, 2, 3].map(level => {
                      const count = level === 1 ? skill.level1Count : level === 2 ? skill.level2Count : skill.level3Count;
                      return count > 0 ? (
                        <Chip
                          key={level}
                          label={
                            <Box display="flex" alignItems="center" gap={0.3}>
                              <span>{count}</span>
                              <StarIcon sx={{ fontSize: 12 }} />
                              <span>{level}</span>
                            </Box>
                          }
                          size="small"
                          color={getSkillLevelColor(level as 1 | 2 | 3) as any}
                          variant="outlined"
                        />
                      ) : null;
                    })}
                  </Box>
                </Box>
                
                {skill.demandCount > 0 && (
                  <Typography variant="caption" color="primary.main">
                    {skill.demandCount} tâche(s) nécessite(nt) cette compétence
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  /**
   * Rendu des compétences les plus demandées
   */
  const renderTopSkillsInDemand = () => {
    if (!skillsData || skillsData.topInDemandSkills.length === 0) {
      return (
        <Card>
          <CardHeader 
            title={
              <Box display="flex" alignItems="center" gap={1}>
                <TrendingUpIcon />
                <Typography variant="h6">Compétences les plus demandées</Typography>
              </Box>
            }
          />
          <CardContent>
            <Alert severity="info">
              Aucune demande de compétences détectée dans les tâches actuelles.
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader 
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <TrendingUpIcon />
              <Typography variant="h6">Compétences les plus demandées</Typography>
            </Box>
          }
        />
        <CardContent>
          <List dense>
            {skillsData.topInDemandSkills.slice(0, 8).map((skill, index) => (
              <ListItem key={skill.skillId}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    <Typography variant="caption" fontWeight="bold">
                      {index + 1}
                    </Typography>
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {skill.skillName}
                      </Typography>
                      <Chip label={skill.category} size="small" variant="outlined" />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption">
                        {skill.demandCount} tâche(s) • {skill.availablePeople} personne(s) disponible(s)
                      </Typography>
                      {skill.isInShortage && (
                        <Chip 
                          label={`⚠️ Pénurie ${skill.shortageLevel}`}
                          size="small"
                          color={getShortageColor(skill.shortageLevel) as any}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Typography variant="body2" color={skill.utilizationRate > 80 ? 'error.main' : 'text.secondary'}>
                    {Math.round(skill.utilizationRate)}%
                  </Typography>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box p={3}>
      {renderHeader()}
      {renderQuickStats()}
      
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          {renderPriorityTasks()}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          {renderActivityFeed()}
        </Box>
      </Box>
      
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          {renderActiveProjects()}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          {renderTeamWorkload()}
        </Box>
      </Box>

      {/* Section Compétences */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          {renderSkillsMetrics()}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          {renderTopSkillsInDemand()}
        </Box>
      </Box>
      
      {renderCharts()}
    </Box>
  );
};

export default OperationalDashboard;