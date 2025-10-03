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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
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

  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'DONE': return 'success';
      case 'IN_PROGRESS': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'DONE': return 'Terminée';
      case 'IN_PROGRESS': return 'En cours';
      case 'TODO': return 'À faire';
      case 'BACKLOG': return 'Backlog';
      case 'BLOCKED': return 'Bloquée';
      default: return status;
    }
  };

  const isTaskOverdue = (task: Task): boolean => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  };

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

  const renderTaskRow = (task: Task) => (
    <TableRow key={task.id} sx={{ backgroundColor: isTaskOverdue(task) ? '#fff3e0' : 'inherit' }}>
      <TableCell>
        <Box display="flex" alignItems="center" gap={1}>
          {isTaskOverdue(task) && <WarningIcon color="error" fontSize="small" />}
          {task.title}
        </Box>
      </TableCell>
      <TableCell>
        <Chip label={getStatusLabel(task.status)} color={getStatusColor(task.status)} size="small" />
      </TableCell>
      <TableCell>
        <Chip label={task.priority} color={getPriorityColor(task.priority)} size="small" />
      </TableCell>
      <TableCell>
        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '-'}
      </TableCell>
      <TableCell>{task.estimatedHours ? `${task.estimatedHours}h` : '-'}</TableCell>
    </TableRow>
  );

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

  const selectedMember = teamMembers.find(m => m.id === selectedAgent);

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
              projectsData.map((projectData) => (
                <Accordion key={projectData.project.id} defaultExpanded sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ width: '100%', pr: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{projectData.project.name}</Typography>
                        <Chip
                          icon={<ScheduleIcon />}
                          label={`Échéance: ${new Date(projectData.project.dueDate).toLocaleDateString('fr-FR')}`}
                          size="small"
                          color={new Date(projectData.project.dueDate) < new Date() ? 'error' : 'default'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {projectData.project.code}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {projectData.milestones.map((milestone, idx) => (
                      <Box key={milestone.milestoneId || idx} sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                          📍 {milestone.milestoneName}
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Tâche</TableCell>
                                <TableCell>Statut</TableCell>
                                <TableCell>Priorité</TableCell>
                                <TableCell>Échéance</TableCell>
                                <TableCell>Estimation</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {milestone.tasks.map(renderTaskRow)}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))
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
            ) : (
              <Box>
                {/* Timeline par projet/jalon */}
                {projectsData.map((projectData) => (
                  <Box key={projectData.project.id} sx={{ mb: 4 }}>
                    <Typography variant="h6" gutterBottom>
                      {projectData.project.name}
                    </Typography>
                    {projectData.milestones.map((milestone) => (
                      <Box key={milestone.milestoneId || 'no-milestone'} sx={{ mb: 3, ml: 2 }}>
                        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                          📍 {milestone.milestoneName}
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          {milestone.tasks
                            .sort((a, b) => {
                              const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                              const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                              return dateA - dateB;
                            })
                            .map((task) => {
                              const taskDuration = task.startDate && task.dueDate
                                ? Math.ceil((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24))
                                : 0;

                              return (
                                <Box
                                  key={task.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    mb: 1.5,
                                    p: 1.5,
                                    borderLeft: `4px solid ${
                                      isTaskOverdue(task) ? '#f44336' :
                                      task.status === 'IN_PROGRESS' ? '#ff9800' :
                                      task.status === 'TODO' ? '#2196f3' : '#4caf50'
                                    }`,
                                    backgroundColor: isTaskOverdue(task) ? '#fff3e0' : '#f5f5f5',
                                    borderRadius: 1,
                                  }}
                                >
                                  <Box sx={{ minWidth: 120 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      {task.startDate ? new Date(task.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '-'}
                                    </Typography>
                                    {task.dueDate && (
                                      <>
                                        <Typography variant="caption" color="text.secondary"> → </Typography>
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                          {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </Typography>
                                      </>
                                    )}
                                  </Box>

                                  <Box sx={{ flex: 1 }}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      {isTaskOverdue(task) && <WarningIcon color="error" fontSize="small" />}
                                      <Typography variant="body2" fontWeight="medium">
                                        {task.title}
                                      </Typography>
                                    </Box>
                                    <Box display="flex" gap={1} mt={0.5}>
                                      <Chip label={getStatusLabel(task.status)} size="small" color={getStatusColor(task.status)} />
                                      <Chip label={task.priority} size="small" color={getPriorityColor(task.priority)} />
                                      {taskDuration > 0 && (
                                        <Chip label={`${taskDuration}j`} size="small" variant="outlined" />
                                      )}
                                      {task.estimatedHours && (
                                        <Chip label={`${task.estimatedHours}h`} size="small" variant="outlined" />
                                      )}
                                    </Box>
                                  </Box>
                                </Box>
                              );
                            })}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            )}
          </TabPanel>
        </>
      )}
    </Box>
  );
};

export default TeamSupervision;
