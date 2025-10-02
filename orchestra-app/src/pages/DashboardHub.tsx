import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Alert,
  Button,
  Stack,
  Avatar,
  LinearProgress,
  Paper,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  AccessTime,
  TrendingUp,
  TrendingDown,
  Speed,
  BarChart,
  Event,
  Groups,
  Timer,
  Warning,
  CheckCircle,
  CalendarMonth,
  ArrowForward,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSimulatedUser } from '../hooks/useSimulatedPermissions';
import MyPlanning from '../components/dashboard/MyPlanning';
import { QuickTimeEntryWidget } from '../components/dashboard/QuickTimeEntryWidget';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { simulatedDashboardHubService } from '../services/simulated-dashboard-hub.service';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { TaskModalSimplified } from '../components/tasks/TaskModalSimplified';
import { Task } from '../types';

interface PersonalAlert {
  id: string;
  type: 'task' | 'deadline' | 'meeting' | 'project';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  date: Date;
}

interface PersonalKPI {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  color: 'primary' | 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactElement;
  description?: string;
  action?: () => void;
}

interface TaskWidget {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueDate: Date;
  projectName: string;
  status: string;
  timeSpent?: number;
  estimatedHours?: number;
}

interface UpcomingEvent {
  id: string;
  type: 'meeting' | 'deadline' | 'leave' | 'milestone' | 'review';
  title: string;
  date: Date;
  description?: string;
  color: string;
}

export const DashboardHub: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { user, isSimulating, originalUser } = useSimulatedUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personalKPIs, setPersonalKPIs] = useState<PersonalKPI[]>([]);
  const [myTasks, setMyTasks] = useState<TaskWidget[]>([]);
  const [todayTasks, setTodayTasks] = useState<TaskWidget[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [notifications, setNotifications] = useState<number>(0);
  const [personalAlerts, setPersonalAlerts] = useState<PersonalAlert[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const loadPersonalDashboardData = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Charger toutes les données en parallèle avec le nouveau service
      const [
        kpis,
        tasks,
        events,
        notifs,
        userTasks, // Garder pour les alertes
        // userProjects // Supprimé car non utilisé
      ] = await Promise.all([
        simulatedDashboardHubService.getPersonalKPIs(currentUser?.id || ''),
        simulatedDashboardHubService.getMyTasks(currentUser?.id || ''),
        simulatedDashboardHubService.getUpcomingEvents(currentUser?.id || ''),
        simulatedDashboardHubService.getUnreadNotifications(currentUser?.id || ''),
        taskService.getTasksByAssignee(user?.id || '')
      ]);

      // Calculer les alertes personnelles basées sur les vraies données
      const alerts: PersonalAlert[] = [];
      
      // Tâches en retard
      const overdueTasks = userTasks.filter(task => 
        task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
      );
      if (overdueTasks.length > 0) {
        alerts.push({
          id: 'overdue-tasks',
          type: 'task',
          title: 'Tâches en retard',
          message: `${overdueTasks.length} tâche${overdueTasks.length > 1 ? 's' : ''} dépassent leur échéance`,
          priority: 'high',
          date: new Date()
        });
      }

      // Échéances proches (dans les 2 prochains jours)
      const upcomingTasks = userTasks.filter(task => {
        if (!task.dueDate || task.status === 'DONE') return false;
        const dueDate = new Date(task.dueDate);
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        return dueDate <= twoDaysFromNow && dueDate >= new Date();
      });
      if (upcomingTasks.length > 0) {
        alerts.push({
          id: 'upcoming-deadlines',
          type: 'deadline',
          title: 'Échéances proches',
          message: `${upcomingTasks.length} tâche${upcomingTasks.length > 1 ? 's' : ''} à terminer sous 2 jours`,
          priority: 'medium',
          date: new Date()
        });
      }
      setPersonalAlerts(alerts);

      // Transformer les KPIs en format affichable
      const formattedKPIs: PersonalKPI[] = [
        {
          id: 'tasks-in-progress',
          label: 'Tâches en cours',
          value: kpis.tasksInProgress,
          trend: kpis.tasksCompletedThisWeek,
          trendLabel: `${kpis.tasksCompletedThisWeek} terminée(s) cette semaine`,
          color: 'primary',
          icon: <AssignmentIcon />,
          description: 'Tâches actuellement assignées',
          action: () => navigate('/tasks')
        },
        {
          id: 'productivity',
          label: 'Completion',
          value: kpis.productivityRate,
          unit: '%',
          trend: kpis.productivityTrend,
          trendLabel: kpis.productivityTrend > 0 ? 'En hausse' : kpis.productivityTrend < 0 ? 'En baisse' : 'Stable',
          color: kpis.productivityRate > 80 ? 'success' : kpis.productivityRate > 60 ? 'warning' : 'error',
          icon: <Speed />,
          description: 'Taux de complétion dans les délais'
        },
        {
          id: 'upcoming-deadlines',
          label: 'Échéances proches',
          value: kpis.upcomingDeadlines,
          trend: kpis.overdueTasksCount,
          trendLabel: kpis.overdueTasksCount > 0 ? `${kpis.overdueTasksCount} en retard` : 'Tout à jour',
          color: kpis.overdueTasksCount > 0 ? 'error' : 'info',
          icon: <Event />,
          description: 'Dans les 7 prochains jours'
        },
        {
          id: 'team-collaboration',
          label: 'Projets actifs',
          value: kpis.activeProjects,
          trend: kpis.teamSize,
          trendLabel: `${kpis.teamSize} collaborateurs`,
          color: 'info',
          icon: <Groups />,
          description: 'Projets en cours',
          action: () => navigate('/projects')
        },
        {
          id: 'time-tracking',
          label: 'Temps cette semaine',
          value: kpis.hoursLoggedThisWeek,
          unit: 'h',
          trend: kpis.averageHoursPerDay,
          trendLabel: `Moyenne ${kpis.averageHoursPerDay.toFixed(1)}h/jour`,
          color: kpis.hoursLoggedThisWeek > 40 ? 'warning' : 'success',
          icon: <Timer />,
          description: 'Cliquez pour saisir rapidement',
          action: () => {
            // Scroll vers le widget de saisie rapide
            const element = document.querySelector('.quick-time-entry-widget');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Optionnel: faire clignoter le widget
              element.classList.add('highlight-widget');
              setTimeout(() => element.classList.remove('highlight-widget'), 2000);
            }
          }
        }
      ];

      setPersonalKPIs(formattedKPIs);

      // Filtrer les tâches du jour
      const today = new Date();
      const todaysTasks = tasks.filter((task: TaskWidget) => {
        const taskDate = new Date(task.dueDate);
        return taskDate.toDateString() === today.toDateString();
      });

      setMyTasks(tasks.slice(0, 5)); // Top 5 tâches prioritaires
      setTodayTasks(todaysTasks);
      setUpcomingEvents(events);
      setNotifications(notifs);

    } catch (error) {
      console.error('Erreur lors du chargement du dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, navigate]);

  useEffect(() => {
    loadPersonalDashboardData();
  }, [loadPersonalDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPersonalDashboardData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleTaskClick = useCallback(async (taskId: string) => {
    try {
      const task = await taskService.getTask(taskId);
      if (task) {
        setSelectedTask(task);
        setTaskModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading task:', error);
    }
  }, []);

  const handleCloseTaskModal = useCallback(() => {
    setTaskModalOpen(false);
    setSelectedTask(null);
  }, []);

  const handleSaveTask = useCallback(async (updatedTask: Task) => {
    try {
      await taskService.updateTask(updatedTask.id, updatedTask);
      handleCloseTaskModal();
      // Reload data after closing modal
      await loadPersonalDashboardData();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  }, [loadPersonalDashboardData]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      default: return 'default';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <Groups fontSize="small" />;
      case 'deadline': return <Warning fontSize="small" />;
      case 'leave': return <CalendarMonth fontSize="small" />;
      case 'milestone': return <CheckCircle fontSize="small" />;
      case 'review': return <AssignmentIcon fontSize="small" />;
      default: return <Event fontSize="small" />;
    }
  };

  const formatEventDate = (date: Date) => {
    const eventDate = new Date(date);
    const today = new Date();
    const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    if (diffDays <= 7) return format(eventDate, 'EEEE', { locale: fr });
    return format(eventDate, 'dd MMM', { locale: fr });
  };

  // Composant de carte KPI amélioré
  const KPICard: React.FC<{ kpi: PersonalKPI }> = ({ kpi }) => (
    <Card 
      sx={{ 
        minWidth: 200,
        cursor: kpi.action ? 'pointer' : 'default',
        transition: 'all 0.3s',
        '&:hover': kpi.action ? {
          transform: 'translateY(-4px)',
          boxShadow: 4
        } : {}
      }}
      onClick={kpi.action}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography color="text.secondary" variant="caption" gutterBottom>
              {kpi.label}
            </Typography>
            <Box display="flex" alignItems="baseline" gap={0.5}>
              <Typography variant="h4" fontWeight="bold" color={`${kpi.color}.main`}>
                {kpi.value}
              </Typography>
              {kpi.unit && (
                <Typography variant="h6" color="text.secondary">
                  {kpi.unit}
                </Typography>
              )}
            </Box>
            {kpi.trendLabel && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {kpi.trend !== undefined && kpi.trend !== 0 && (
                  kpi.trend > 0 ? 
                    <TrendingUp fontSize="small" color="success" /> : 
                    <TrendingDown fontSize="small" color="error" />
                )}
                <Typography variant="caption" color="text.secondary">
                  {kpi.trendLabel}
                </Typography>
              </Box>
            )}
            {kpi.description && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {kpi.description}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: `${kpi.color}.light`, color: `${kpi.color}.main`, ml: 1 }}>
            {kpi.icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  // Widget de progression de la journée
  const DayProgressWidget = () => {
    const now = new Date();
    const dayProgress = ((now.getHours() - 8) / 10) * 100;
    const isWorkingHours = now.getHours() >= 8 && now.getHours() < 18;

    return (
      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Ma journée</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              label={`${personalKPIs.find(k => k.id === 'time-tracking')?.value || 0}h/8h`}
              size="small"
              icon={<Timer />}
              color={personalKPIs.find(k => k.id === 'time-tracking')?.color as any || 'default'}
              onClick={() => {
                const element = document.querySelector('.quick-time-entry-widget');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              sx={{ cursor: 'pointer' }}
            />
            <Chip 
              label={format(now, 'HH:mm', { locale: fr })}
              size="small"
              icon={<AccessTime />}
            />
          </Stack>
        </Box>
        
        {isWorkingHours && (
          <Box mb={2}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Progression</Typography>
              <Typography variant="body2">{Math.round(dayProgress)}%</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(100, Math.max(0, dayProgress))}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        <Stack spacing={1}>
          {todayTasks.length > 0 ? (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                Tâches du jour ({todayTasks.length})
              </Typography>
              {todayTasks.map(task => (
                <Box 
                  key={task.id}
                  sx={{ 
                    p: 1, 
                    border: 1, 
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => handleTaskClick(task.id)}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                      {task.title}
                    </Typography>
                    <Chip 
                      label={task.priority} 
                      size="small" 
                      color={getPriorityColor(task.priority) as any}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {task.projectName}
                  </Typography>
                </Box>
              ))}
            </>
          ) : (
            <Alert severity="success" sx={{ py: 0.5 }}>
              Aucune tâche prévue aujourd'hui
            </Alert>
          )}
        </Stack>

      </Paper>
    );
  };

  // Widget des tâches prioritaires
  const PriorityTasksWidget = () => (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Tâches prioritaires</Typography>
        <Button 
          size="small" 
          endIcon={<ArrowForward />}
          onClick={() => navigate('/tasks')}
        >
          Voir tout
        </Button>
      </Box>

      <Stack spacing={1.5}>
        {myTasks.map(task => (
          <Card 
            key={task.id} 
            variant="outlined"
            sx={{ 
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => handleTaskClick(task.id)}
          >
            <CardContent sx={{ py: 1.5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                  <Typography variant="body2" fontWeight="medium">
                    {task.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.projectName}
                  </Typography>
                  {task.estimatedHours && (
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                      <Timer fontSize="small" color="action" />
                      <Typography variant="caption">
                        {task.timeSpent || 0}/{task.estimatedHours}h
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={((task.timeSpent || 0) / task.estimatedHours) * 100}
                        sx={{ flex: 1, height: 4, borderRadius: 2 }}
                      />
                    </Box>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Chip 
                    label={task.priority} 
                    size="small" 
                    color={getPriorityColor(task.priority) as any}
                  />
                  {task.dueDate && isValid(new Date(task.dueDate)) && (
                    <Chip 
                      label={format(new Date(task.dueDate), 'dd/MM')} 
                      size="small"
                      variant="outlined"
                      icon={<Event />}
                    />
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        ))}
        {myTasks.length === 0 && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Aucune tâche assignée pour le moment
          </Alert>
        )}
      </Stack>
    </Paper>
  );

  // Widget du planning
  const UpcomingEventsWidget = () => (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Agenda</Typography>
      </Box>

      <Stack spacing={1}>
        {upcomingEvents.map(event => (
          <Box 
            key={event.id}
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1,
              borderLeft: 3,
              borderColor: event.color,
              bgcolor: 'background.default',
              borderRadius: 1
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: `${event.color}20` }}>
              {getEventIcon(event.type)}
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2">{event.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatEventDate(event.date)}
              </Typography>
            </Box>
          </Box>
        ))}

        {upcomingEvents.length === 0 && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Aucun événement à venir
          </Alert>
        )}
      </Stack>

      <Button 
        fullWidth 
        variant="outlined" 
        sx={{ mt: 2 }}
        onClick={() => navigate('/calendar')}
      >
        Voir le calendrier complet
      </Button>
    </Paper>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography ml={2}>Chargement du tableau de bord...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Bonjour {user?.firstName || user?.displayName} 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton 
            onClick={handleRefresh} 
            disabled={refreshing}
            size="large"
          >
            {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Stack>
      </Box>

      {/* Indicateur de simulation */}
      {isSimulating && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            border: 2,
            borderColor: 'info.main',
            bgcolor: 'info.50',
            '& .MuiAlert-icon': {
              fontSize: '1.5rem'
            }
          }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
            >
              Quitter simulation
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={user?.avatarUrl}
              sx={{ width: 32, height: 32 }}
            >
              {user?.firstName?.charAt(0) || user?.displayName?.charAt(0)}
            </Avatar>
            <Typography variant="body1">
              <strong>🎭 Mode Simulation Actif</strong> - Vous voyez le dashboard de <strong>{user?.displayName || `${user?.firstName} ${user?.lastName}`}</strong>
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Alertes en haut */}
      {personalAlerts.length > 0 && (
        <Stack spacing={1} mb={3}>
          {personalAlerts.map((alert) => (
            <Alert 
              key={alert.id}
              severity={alert.priority === 'high' ? 'error' : alert.priority === 'medium' ? 'warning' : 'info'}
              action={<Button size="small">Voir</Button>}
            >
              <Typography variant="subtitle2">{alert.title}</Typography>
              <Typography variant="body2">{alert.message}</Typography>
            </Alert>
          ))}
        </Stack>
      )}

      {/* 1. Objectif Actuel + KPIs Grid - En premier */}
      <Box display="flex" flexWrap="wrap" gap={2} mb={4}>

        {/* KPIs */}
        {personalKPIs.map(kpi => (
          <Box key={kpi.id} sx={{ flex: '1 1 300px', minWidth: 200 }}>
            <KPICard kpi={kpi} />
          </Box>
        ))}
      </Box>

      {/* 2. Planning Section - Au milieu */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          Mon planning détaillé
        </Typography>
        <Card>
          <CardContent sx={{ p: 0 }}>
            <MyPlanning />
          </CardContent>
        </Card>
      </Box>

      {/* 3. Quick Time Entry Widget - En dernier */}
      <Box mb={3}>
        <QuickTimeEntryWidget onTimeLogged={loadPersonalDashboardData} />
      </Box>

      {/* Task Detail Modal */}
      <TaskModalSimplified
        open={taskModalOpen}
        onClose={handleCloseTaskModal}
        task={selectedTask}
        onSave={handleSaveTask}
      />
    </Box>
  );
};

export default DashboardHub;