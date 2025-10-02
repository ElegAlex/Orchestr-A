import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Folder as FolderIcon,
  NavigateNext as NavigateNextIcon,
  AccountTree as RaciIcon,
  Map as RoadmapIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { Project, Epic, Milestone } from '../types';
import { projectService } from '../services/project.service';
import ProjectOverview from '../components/project/ProjectOverview';
import ProjectTasks from '../components/project/ProjectTasks';
import ProjectTeam from '../components/project/ProjectTeam';
import ProjectRaci from '../components/project/ProjectRaci';
import ProjectDocuments from '../components/project/ProjectDocuments';
import ProjectSettings from '../components/project/ProjectSettings';
import ProjectRoadmap from '../components/project/ProjectRoadmap';
import ProjectGantt from '../components/project/ProjectGantt';
import EpicModal from '../components/project/EpicModal';
import MilestoneModal from '../components/project/MilestoneModal';

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
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const ProjectDetail: React.FC = () => {
  console.log('🔥 ProjectDetail: Composant chargé');
  const { projectId } = useParams<{ projectId: string }>();
  console.log('🔥 ProjectDetail: projectId reçu:', projectId);
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // États pour les modals Epic et Milestone
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [roadmapKey, setRoadmapKey] = useState(0);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProject = async () => {
    if (!projectId) return;
    
    // Cas spécial pour la création d'un nouveau projet - rediriger vers ProjectCreate
    if (projectId === 'new') {
      console.log('🔀 ProjectDetail: Redirection vers /projects/create');
      navigate('/projects/create');
      return;
    }
    
    try {
      console.log('ProjectDetail: Début du chargement du projet', projectId);
      setLoading(true);
      const data = await projectService.getProject(projectId);
      console.log('ProjectDetail: Données reçues:', data);
      if (data) {
        setProject(data);
        console.log('ProjectDetail: Projet défini avec succès');
      } else {
        console.log('ProjectDetail: Aucune donnée reçue');
        setError('Projet non trouvé');
      }
    } catch (err) {
      console.error('ProjectDetail: Erreur lors du chargement du projet:', err);
      setError('Erreur lors du chargement du projet');
    } finally {
      console.log('ProjectDetail: Fin du chargement, setLoading(false)');
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    navigate(`/projects/${projectId}/edit`);
    handleMenuClose();
  };

  const handleArchive = async () => {
    if (!project || !projectId) return;
    
    try {
      await projectService.updateProject(projectId, {
        ...project,
        status: 'cancelled'
      });
      navigate('/projects');
    } catch (err) {
      console.error('Erreur lors de l\'archivage:', err);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!projectId) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      try {
        await projectService.deleteProject(projectId);
        navigate('/projects');
      } catch (err) {
        console.error('Erreur lors de la suppression:', err);
      }
    }
    handleMenuClose();
  };

  // Handlers pour les modals Epic
  const handleCreateEpic = () => {
    setSelectedEpic(null);
    setEpicModalOpen(true);
  };

  const handleEditEpic = (epic: Epic) => {
    setSelectedEpic(epic);
    setEpicModalOpen(true);
  };

  const handleEpicSave = (epic: Epic) => {
    // Rafraîchir les données du roadmap
    setEpicModalOpen(false);
    setSelectedEpic(null);
    // Force le rechargement du composant roadmap en changeant sa clé
    setRoadmapKey(prev => prev + 1);
  };

  // Handlers pour les modals Milestone
  const handleCreateMilestone = () => {
    setSelectedMilestone(null);
    setMilestoneModalOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setMilestoneModalOpen(true);
  };

  const handleMilestoneSave = (milestone: Milestone) => {
    console.log('🔄 handleMilestoneSave appelé avec:', milestone);
    // Rafraîchir les données du roadmap
    setMilestoneModalOpen(false);
    setSelectedMilestone(null);
    // Force le rechargement du composant roadmap en changeant sa clé
    setRoadmapKey(prev => {
      console.log('🔄 Changement de roadmapKey:', prev, '=>', prev + 1);
      return prev + 1;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'error';
      case 'P1': return 'warning';
      case 'P2': return 'info';
      case 'P3': return 'default';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Projet non trouvé'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/projects')}
        >
          Retour aux projets
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs 
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 2 }}
      >
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/dashboard')}
          sx={{ cursor: 'pointer' }}
        >
          Mon espace
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/projects')}
          sx={{ cursor: 'pointer' }}
        >
          Projets
        </Link>
        <Typography color="text.primary">{project.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <IconButton
                size="small"
                onClick={() => navigate('/projects')}
                sx={{ mr: 1 }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h4" component="h1">
                {project.name}
              </Typography>
              <Chip
                label={project.code}
                size="small"
                variant="outlined"
              />
              <Chip
                label={project.status.replace('_', ' ').toUpperCase()}
                size="small"
                color={getStatusColor(project.status)}
              />
              <Chip
                label={project.priority}
                size="small"
                color={getPriorityColor(project.priority)}
              />
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ ml: 6 }}>
              {project.description}
            </Typography>
          </Box>

          <Box display="flex" gap={1}>
            <Tooltip title="Partager">
              <IconButton>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Éditer">
              <IconButton onClick={handleEdit}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleMenuClick}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Project Stats */}
        <Stack direction="row" spacing={4} sx={{ mt: 3, ml: 6 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Progression
            </Typography>
            <Typography variant="h6">
              {project.progress}%
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Date de début
            </Typography>
            <Typography variant="h6">
              {new Date(project.startDate).toLocaleDateString('fr-FR')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Date de fin
            </Typography>
            <Typography variant="h6">
              {(project.dueDate || project.dueDate) ? new Date(project.dueDate || project.dueDate).toLocaleDateString('fr-FR') : 'Non définie'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Budget
            </Typography>
            <Typography variant="h6">
              {project.budget ? `${project.budget.toLocaleString('fr-FR')} €` : 'N/A'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Équipe
            </Typography>
            <Typography variant="h6">
              {project.teamMembers?.length || 0} membres
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<DashboardIcon />} 
            iconPosition="start" 
            label="Vue d'ensemble" 
          />
          <Tab 
            icon={<AssignmentIcon />} 
            iconPosition="start" 
            label="Tâches" 
          />
          <Tab 
            icon={<PeopleIcon />} 
            iconPosition="start" 
            label="Équipe" 
          />
          <Tab 
            icon={<RoadmapIcon />} 
            iconPosition="start" 
            label="Roadmap" 
          />
          <Tab 
            icon={<TimelineIcon />} 
            iconPosition="start" 
            label="Gantt" 
          />
          <Tab 
            icon={<RaciIcon />} 
            iconPosition="start" 
            label="RACI" 
          />
          <Tab 
            icon={<FolderIcon />} 
            iconPosition="start" 
            label="Documents" 
          />
          <Tab 
            icon={<SettingsIcon />} 
            iconPosition="start" 
            label="Paramètres" 
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <ProjectOverview project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <ProjectTasks projectId={project.id} />
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <ProjectTeam project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <ProjectRoadmap
              projectId={project.id}
              onCreateEpic={handleCreateEpic}
              onCreateMilestone={handleCreateMilestone}
              onEditEpic={handleEditEpic}
              onEditMilestone={handleEditMilestone}
              refreshTrigger={roadmapKey}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
            <ProjectGantt project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={5}>
            <ProjectRaci project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={6}>
            <ProjectDocuments projectId={project.id} />
          </TabPanel>
          <TabPanel value={tabValue} index={7}>
            <ProjectSettings project={project} onUpdate={loadProject} />
          </TabPanel>
        </Box>
      </Paper>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} />
          Éditer
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <ArchiveIcon sx={{ mr: 1 }} />
          Archiver
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Supprimer
        </MenuItem>
      </Menu>

      {/* Modals pour Epic et Milestone */}
      <EpicModal
        open={epicModalOpen}
        onClose={() => setEpicModalOpen(false)}
        onSave={handleEpicSave}
        projectId={project.id}
        epic={selectedEpic}
      />
      
      <MilestoneModal
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        onSave={handleMilestoneSave}
        projectId={project.id}
        milestone={selectedMilestone}
      />

    </Box>
  );
};

export default ProjectDetail;