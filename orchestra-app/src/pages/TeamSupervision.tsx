import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { teamSupervisionService, ProjectWithMilestones } from '../services/team-supervision.service';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { User, Task } from '../types';
import TaskCardWithTimeEntry from '../components/project/TaskCardWithTimeEntry';
import { TaskModalSimplified as TaskModal } from '../components/tasks/TaskModalSimplified';
import { Gantt, Task as GanttTask, ViewMode } from '@rsagiev/gantt-task-react-19';
import '@rsagiev/gantt-task-react-19/dist/index.css';
import { addDays } from 'date-fns';

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
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const TeamSupervision: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [projectsData, setProjectsData] = useState<ProjectWithMilestones[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadTeamMembers();
  }, [user]);

  useEffect(() => {
    if (selectedAgent) {
      loadAgentTasks();
    }
  }, [selectedAgent]);

  const loadTeamMembers = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const members = await teamSupervisionService.getTeamMembers(user.id, user.role, user.department);
      setTeamMembers(members);
    } catch (err) {
      console.error('Erreur chargement membres équipe:', err);
      setError('Erreur lors du chargement des membres de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentTasks = async () => {
    if (!selectedAgent) return;

    try {
      setLoadingTasks(true);
      const data = await teamSupervisionService.getAgentTasksByProject(selectedAgent);
      setProjectsData(data);
    } catch (err) {
      console.error('Erreur chargement tâches agent:', err);
      setError('Erreur lors du chargement des tâches de l\'agent');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const handleTaskModalClose = () => {
    setTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskSave = () => {
    handleTaskModalClose();
    loadAgentTasks();
  };

  // Helper pour vérifier si une tâche est en retard
  const isTaskOverdue = (task: Task): boolean => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  };

  // Membre sélectionné
  const selectedMember = useMemo(() => {
    return teamMembers.find(m => m.id === selectedAgent) || null;
  }, [selectedAgent, teamMembers]);

  // Calcul des métriques
  const metrics = useMemo(() => {
    const allTasks: Task[] = [];
    projectsData.forEach(p => {
      p.milestones.forEach(m => {
        allTasks.push(...m.tasks);
      });
    });

    const totalTasks = allTasks.length;
    const overdueTasks = allTasks.filter(t => isTaskOverdue(t)).length;
    const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const todoTasks = allTasks.filter(t => t.status === 'TODO').length;
    const totalEstimatedHours = allTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    return {
      totalTasks,
      overdueTasks,
      inProgressTasks,
      todoTasks,
      totalEstimatedHours,
    };
  }, [projectsData]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3} role="main" aria-label="Page de supervision d'équipe">
      <Typography variant="h4" gutterBottom component="h1">
        Supervision
      </Typography>

      <FormControl fullWidth sx={{ mb: 3, maxWidth: 400 }}>
        <InputLabel id="agent-select-label">Sélectionner un agent</InputLabel>
        <Select
          labelId="agent-select-label"
          id="agent-select"
          value={selectedAgent}
          label="Sélectionner un agent"
          onChange={(e) => setSelectedAgent(e.target.value)}
          aria-describedby="agent-select-help"
        >
          {teamMembers.map((member) => (
            <MenuItem key={member.id} value={member.id}>
              {member.displayName || member.email}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedAgent && (
        <>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {selectedMember?.displayName || selectedMember?.email}
          </Typography>

          {/* Métriques de synthèse */}
          {!loadingTasks && projectsData.length > 0 && (
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }} gap={2} sx={{ mb: 3 }}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AssignmentIcon color="primary" />
                    <Box>
                      <Typography variant="h4">{metrics.totalTasks}</Typography>
                      <Typography variant="body2" color="text.secondary">Tâches actives</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <WarningIcon color="error" />
                    <Box>
                      <Typography variant="h4" color="error.main">{metrics.overdueTasks}</Typography>
                      <Typography variant="body2" color="text.secondary">En retard</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TrendingUpIcon color="warning" />
                    <Box>
                      <Typography variant="h4" color="warning.main">{metrics.inProgressTasks}</Typography>
                      <Typography variant="body2" color="text.secondary">En cours</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircleIcon color="success" />
                    <Box>
                      <Typography variant="h4">{metrics.totalEstimatedHours}h</Typography>
                      <Typography variant="body2" color="text.secondary">Charge estimée</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            aria-label="Vues de supervision"
          >
            <Tab label="Vue Projets/Jalons" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Vue Timeline" id="tab-1" aria-controls="tabpanel-1" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {loadingTasks ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : projectsData.length === 0 ? (
              <Alert severity="info">
                Aucune tâche en cours pour {selectedMember?.displayName || 'cet agent'}.
              </Alert>
            ) : (
              <Box>
                {projectsData.map((projectData, projectIdx) => (
                  <Box key={projectData.project.id} sx={{ mb: 4 }}>
                    {/* Header projet très visible */}
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        p: 2.5,
                        borderRadius: '12px 12px 0 0',
                        boxShadow: 3,
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                            {projectData.project.name}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {projectData.project.code} • {projectData.milestones.reduce((sum, m) => sum + m.tasks.length, 0)} tâche(s) active(s)
                          </Typography>
                        </Box>
                        <Chip
                          icon={<ScheduleIcon sx={{ color: 'white !important' }} />}
                          label={`Échéance: ${new Date(projectData.project.dueDate).toLocaleDateString('fr-FR')}`}
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            fontWeight: 'bold',
                            backdropFilter: 'blur(10px)',
                            '& .MuiChip-icon': {
                              color: 'white',
                            },
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Contenu projet */}
                    <Accordion
                      defaultExpanded
                      sx={{
                        '&:before': {
                          display: 'none',
                        },
                        boxShadow: 3,
                        borderRadius: '0 0 12px 12px',
                        overflow: 'hidden',
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          bgcolor: 'grey.100',
                          minHeight: 48,
                          '&:hover': {
                            bgcolor: 'grey.200',
                          },
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight="medium">
                          Jalons et tâches ({projectData.milestones.length} jalon{projectData.milestones.length > 1 ? 's' : ''})
                        </Typography>
                      </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: 'grey.50', p: 3 }}>
                      {projectData.milestones.map((milestone, idx) => (
                        <Box
                          key={milestone.milestoneId || idx}
                          sx={{
                            mb: idx < projectData.milestones.length - 1 ? 4 : 0,
                            pb: idx < projectData.milestones.length - 1 ? 3 : 0,
                            borderBottom: idx < projectData.milestones.length - 1 ? '2px solid' : 'none',
                            borderColor: 'divider',
                          }}
                        >
                          <Box sx={{
                            mb: 2,
                            p: 1.5,
                            bgcolor: 'white',
                            borderRadius: 1,
                            borderLeft: '4px solid',
                            borderColor: 'primary.main',
                          }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              📍 {milestone.milestoneName}
                              <Chip
                                label={`${milestone.tasks.length} tâche${milestone.tasks.length > 1 ? 's' : ''}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {milestone.tasks.map(task => (
                              <TaskCardWithTimeEntry
                                key={task.id}
                                task={task}
                                onUpdate={loadAgentTasks}
                                onEdit={handleTaskEdit}
                                compact
                              />
                            ))}
                          </Box>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                  </Box>
                ))}
              </Box>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {loadingTasks ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : projectsData.length === 0 ? (
              <Alert severity="info">
                Aucune tâche en cours pour {selectedMember?.displayName || 'cet agent'}.
              </Alert>
            ) : (() => {
              // Convertir toutes les tâches en format Gantt
              const allTasks = projectsData.flatMap(projectData =>
                projectData.milestones.flatMap(m => m.tasks)
              );

              const ganttTasks: GanttTask[] = allTasks
                .filter(task => task.dueDate) // Uniquement les tâches avec date
                .map(task => {
                  const startDate = task.startDate ? new Date(task.startDate) : new Date();
                  const endDate = task.dueDate ? new Date(task.dueDate) : addDays(startDate, 1);

                  // Trouver le projet et jalon
                  const projectData = projectsData.find(p =>
                    p.milestones.some(m => m.tasks.some(t => t.id === task.id))
                  );
                  const milestone = projectData?.milestones.find(m =>
                    m.tasks.some(t => t.id === task.id)
                  );

                  const statusColors: { [key: string]: string } = {
                    TODO: '#2196F3',
                    IN_PROGRESS: '#1976D2',
                    DONE: '#388E3C',
                    BLOCKED: '#D32F2F',
                    BACKLOG: '#9E9E9E',
                  };

                  return {
                    id: task.id,
                    name: task.title,
                    start: startDate,
                    end: endDate,
                    progress: task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0,
                    type: 'task' as const,
                    styles: {
                      backgroundColor: statusColors[task.status] || '#2196F3',
                      backgroundSelectedColor: statusColors[task.status] || '#2196F3',
                      progressColor: '#388E3C',
                      progressSelectedColor: '#388E3C',
                    },
                    project: projectData?.project.name || '',
                  };
                })
                .sort((a, b) => a.start.getTime() - b.start.getTime());

              if (ganttTasks.length === 0) {
                return (
                  <Alert severity="warning">
                    Aucune tâche avec date d'échéance pour {selectedMember?.displayName || 'cet agent'}.
                  </Alert>
                );
              }

              // Calculer la largeur de colonne en fonction de l'espace disponible
              const containerWidth = typeof window !== 'undefined' ? window.innerWidth - 400 : 1200;
              const adaptiveColumnWidth = Math.max(200, Math.floor(containerWidth / 6));

              return (
                <Box sx={{ width: '100%' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Timeline Gantt - {selectedMember?.displayName}
                  </Typography>
                  <Gantt
                    tasks={ganttTasks}
                    viewMode={ViewMode.Month}
                    locale="fr-FR"
                    columnWidth={adaptiveColumnWidth}
                    listCellWidth="20%"
                    rowHeight={50}
                    ganttHeight={0}
                    barCornerRadius={3}
                    handleWidth={8}
                    fontFamily="Roboto, Arial, sans-serif"
                  />
                </Box>
              );
            })()}
          </TabPanel>
        </>
      )}

      {/* Modal de tâche */}
      {selectedTask && (
        <TaskModal
          open={taskModalOpen}
          task={selectedTask}
          projectId={selectedTask.projectId}
          onClose={handleTaskModalClose}
          onSave={handleTaskSave}
        />
      )}
    </Box>
  );
};

export default TeamSupervision;
