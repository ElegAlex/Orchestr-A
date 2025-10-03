import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
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
    <div hidden={value !== index} {...other}>
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
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Supervision
      </Typography>

      <FormControl fullWidth sx={{ mb: 3, maxWidth: 400 }}>
        <InputLabel>Sélectionner un agent</InputLabel>
        <Select
          value={selectedAgent}
          label="Sélectionner un agent"
          onChange={(e) => setSelectedAgent(e.target.value)}
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

          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab label="Vue Projets/Jalons" />
            <Tab label="Vue Calendrier" disabled />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {loadingTasks ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : projectsData.length === 0 ? (
              <Alert severity="info">
                Aucune tâche active trouvée pour cet agent (uniquement tâches où il est responsable, dans des projets actifs, non terminées, hors backlog).
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
            <Alert severity="info">Vue calendrier/timeline à venir...</Alert>
          </TabPanel>
        </>
      )}
    </Box>
  );
};

export default TeamSupervision;
