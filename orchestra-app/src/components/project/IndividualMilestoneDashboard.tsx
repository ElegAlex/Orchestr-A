import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Task, Milestone, Project } from '../../types';
import { taskService } from '../../services/task.service';
import { milestoneService } from '../../services/milestone.service';
import { projectService } from '../../services/project.service';
import TaskCardWithTimeEntry from './TaskCardWithTimeEntry';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`individual-tabpanel-${index}`}
      aria-labelledby={`individual-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const IndividualMilestoneDashboard: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [currentTab, setCurrentTab] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<{[key: string]: Project}>({});
  const [loading, setLoading] = useState(true);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterInProgress, setFilterInProgress] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Charger toutes les tâches assignées à l'utilisateur
      const userTasks = await taskService.getTasksByAssignee(user.id);

      // Récupérer les IDs des projets uniques
      const projectIds = Array.from(new Set(userTasks.map(task => task.projectId).filter(Boolean)));

      // Charger les projets et jalons en parallèle
      const [projectsData, milestonesData] = await Promise.all([
        Promise.all(projectIds.map(async (id) => {
          const project = await projectService.getProject(id);
          return project ? { [id]: project } : {};
        })),
        Promise.all(projectIds.map(async (projectId) =>
          milestoneService.getMilestonesByProject(projectId)
        )),
      ]);

      // Combiner les données des projets
      const projectsMap = projectsData.reduce((acc, proj) => ({ ...acc, ...proj }), {});

      // Combiner les jalons de tous les projets
      const allMilestones = milestonesData.flat();

      setTasks(userTasks);
      setProjects(projectsMap);
      setMilestones(allMilestones);
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleTaskUpdate = () => {
    loadUserData(); // Recharger les données après mise à jour d'une tâche
  };

  // Filtrer les tâches selon les critères
  const getFilteredTasks = () => {
    let filteredTasks = tasks;

    // Filtrer par projet si sélectionné
    if (selectedProject !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.projectId === selectedProject);
    }

    // Filtrer selon l'onglet actuel
    switch (currentTab) {
      case 0: // Tâches en cours
        filteredTasks = filteredTasks.filter(task =>
          task.status === 'IN_PROGRESS' || task.status === 'TODO'
        );
        break;
      case 1: // Tâches en retard
        filteredTasks = filteredTasks.filter(task => {
          const isOverdue = task.dueDate && isAfter(new Date(), new Date(task.dueDate));
          return isOverdue && task.status !== 'DONE';
        });
        break;
      case 2: // Tâches terminées
        filteredTasks = filteredTasks.filter(task => task.status === 'DONE');
        break;
      case 3: // Vue par jalons
        // Retourner toutes les tâches pour la vue jalons
        break;
    }

    return filteredTasks;
  };

  // Grouper les tâches par jalon pour la vue jalons
  const getTasksByMilestone = () => {
    const filteredTasks = getFilteredTasks();
    const tasksByMilestone: {[key: string]: {milestone: Milestone, tasks: Task[]}} = {};

    filteredTasks.forEach(task => {
      if (task.milestoneId) {
        const milestone = milestones.find(m => m.id === task.milestoneId);
        if (milestone) {
          if (!tasksByMilestone[milestone.id]) {
            tasksByMilestone[milestone.id] = { milestone, tasks: [] };
          }
          tasksByMilestone[milestone.id].tasks.push(task);
        }
      }
    });

    return Object.values(tasksByMilestone);
  };

  const getTaskStats = () => {
    const totalTasks = tasks.length;
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'TODO').length;
    const completedTasks = tasks.filter(t => t.status === 'DONE').length;
    const overdueTasks = tasks.filter(t => {
      const isOverdue = t.dueDate && isAfter(new Date(), new Date(t.dueDate));
      return isOverdue && t.status !== 'DONE';
    }).length;

    return { totalTasks, inProgressTasks, completedTasks, overdueTasks };
  };

  const stats = getTaskStats();
  const filteredTasks = getFilteredTasks();
  const tasksByMilestone = getTasksByMilestone();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Chargement de vos tâches...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header avec statistiques */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <PersonIcon color="primary" />
          <Typography variant="h5" component="h1">
            Mon Dashboard Personnel
          </Typography>
        </Stack>

        <Stack direction="row" spacing={3} flexWrap="wrap">
          <Chip
            icon={<AssignmentIcon />}
            label={`${stats.totalTasks} tâche${stats.totalTasks > 1 ? 's' : ''} au total`}
            variant="outlined"
          />
          <Chip
            icon={<ScheduleIcon />}
            label={`${stats.inProgressTasks} en cours`}
            color="warning"
            variant="outlined"
          />
          <Chip
            icon={<CheckCircleIcon />}
            label={`${stats.completedTasks} terminée${stats.completedTasks > 1 ? 's' : ''}`}
            color="success"
            variant="outlined"
          />
          {stats.overdueTasks > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${stats.overdueTasks} en retard`}
              color="error"
              variant="outlined"
            />
          )}
        </Stack>
      </Paper>

      {/* Filtres */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Projet</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="Projet"
            >
              <MenuItem value="all">Tous les projets</MenuItem>
              {Object.entries(projects).map(([id, project]) => (
                <MenuItem key={id} value={id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Onglets */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="Dashboard personnel"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label={`En cours (${stats.inProgressTasks})`}
            icon={<ScheduleIcon />}
            iconPosition="start"
          />
          <Tab
            label={`En retard (${stats.overdueTasks})`}
            icon={<WarningIcon />}
            iconPosition="start"
          />
          <Tab
            label={`Terminées (${stats.completedTasks})`}
            icon={<CheckCircleIcon />}
            iconPosition="start"
          />
          <Tab
            label="Vue par jalons"
            icon={<TimelineIcon />}
            iconPosition="start"
          />
        </Tabs>

        {/* Contenu des onglets */}
        <TabPanel value={currentTab} index={0}>
          <Typography variant="h6" gutterBottom>
            Tâches en cours ou à faire
          </Typography>
          {filteredTasks.length === 0 ? (
            <Alert severity="info">
              Aucune tâche en cours. Excellent travail ! 🎉
            </Alert>
          ) : (
            <Stack spacing={2}>
              {filteredTasks.map(task => (
                <TaskCardWithTimeEntry
                  key={task.id}
                  task={task}
                  onUpdate={handleTaskUpdate}
                />
              ))}
            </Stack>
          )}
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Typography variant="h6" gutterBottom>
            Tâches en retard
          </Typography>
          {filteredTasks.length === 0 ? (
            <Alert severity="success">
              Aucune tâche en retard ! 👍
            </Alert>
          ) : (
            <Stack spacing={2}>
              {filteredTasks.map(task => (
                <TaskCardWithTimeEntry
                  key={task.id}
                  task={task}
                  onUpdate={handleTaskUpdate}
                />
              ))}
            </Stack>
          )}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <Typography variant="h6" gutterBottom>
            Tâches terminées
          </Typography>
          {filteredTasks.length === 0 ? (
            <Alert severity="info">
              Aucune tâche terminée encore.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {filteredTasks.slice(0, 10).map(task => (
                <TaskCardWithTimeEntry
                  key={task.id}
                  task={task}
                  onUpdate={handleTaskUpdate}
                  compact
                />
              ))}
              {filteredTasks.length > 10 && (
                <Typography variant="caption" color="text.secondary" align="center">
                  ... et {filteredTasks.length - 10} autre{filteredTasks.length - 10 > 1 ? 's' : ''} tâche{filteredTasks.length - 10 > 1 ? 's' : ''} terminée{filteredTasks.length - 10 > 1 ? 's' : ''}
                </Typography>
              )}
            </Stack>
          )}
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Mes tâches par jalons
          </Typography>
          {tasksByMilestone.length === 0 ? (
            <Alert severity="info">
              Aucune tâche associée à des jalons.
            </Alert>
          ) : (
            <Stack spacing={3}>
              {tasksByMilestone.map(({ milestone, tasks: milestoneTasks }) => {
                const completedTasks = milestoneTasks.filter(t => t.status === 'DONE').length;
                const progress = Math.round((completedTasks / milestoneTasks.length) * 100);

                return (
                  <Card key={milestone.id} variant="outlined">
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">
                          {milestone.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {completedTasks}/{milestoneTasks.length} tâches
                        </Typography>
                      </Stack>

                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ mb: 2, height: 8, borderRadius: 4 }}
                      />

                      <Stack spacing={2}>
                        {milestoneTasks.map(task => (
                          <TaskCardWithTimeEntry
                            key={task.id}
                            task={task}
                            onUpdate={handleTaskUpdate}
                            compact
                          />
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default IndividualMilestoneDashboard;