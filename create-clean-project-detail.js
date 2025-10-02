const fs = require('fs');

// Template for a clean ProjectDetail.tsx with milestone view integrated
const cleanContent = `import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import MilestoneView from '../components/project/MilestoneView';

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
      id={\`simple-tabpanel-\${index}\`}
      aria-labelledby={\`simple-tab-\${index}\`}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const wasOnTasksTab = useRef(false);

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
    // Clean up function pour s'assurer que le composant se démonte correctement
    return () => {
      setProject(null);
    };
  }, [projectId]);

  useEffect(() => {
    // Récupérer l'onglet depuis l'URL si présent
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      const tabIndex = parseInt(tab, 10);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 8) {
        setTabValue(tabIndex);
      }
    }
  }, [location.search]);

  const loadProject = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      const projectData = await projectService.getProject(projectId);
      if (projectData) {
        setProject(projectData);
      } else {
        setError('Projet non trouvé');
      }
    } catch (err) {
      console.error('Erreur lors du chargement du projet:', err);
      setError('Impossible de charger le projet');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // Mettre à jour l'URL avec l'onglet sélectionné
    const params = new URLSearchParams(location.search);
    params.set('tab', newValue.toString());
    navigate({\`\${location.pathname}?\${params.toString()}\`}, { replace: true });
  };

  const handleBack = () => {
    navigate('/projects');
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    if (project) {
      navigate(\`/projects/\${project.id}/edit\`);
    }
    handleMenuClose();
  };

  const handleArchive = async () => {
    if (project) {
      try {
        await projectService.archiveProject(project.id);
        navigate('/projects');
      } catch (error) {
        console.error('Erreur lors de l\'archivage:', error);
      }
    }
    handleMenuClose();
  };

  const handleCreateEpic = () => {
    setSelectedEpic(null);
    setEpicModalOpen(true);
  };

  const handleEditEpic = (epic: Epic) => {
    setSelectedEpic(epic);
    setEpicModalOpen(true);
  };

  const handleEpicSave = (epic: Epic) => {
    console.log('🔄 handleEpicSave appelé avec:', epic);
    setEpicModalOpen(false);
    setSelectedEpic(null);
    setRoadmapKey(prev => {
      console.log('🔄 Changement de roadmapKey pour Epic:', prev, '=>', prev + 1);
      return prev + 1;
    });
  };

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Chargement du projet...
        </Typography>
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || 'Projet non trouvé'}
        </Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Retour aux projets
        </Button>
      </Box>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'active': return 'primary';
      case 'completed': return 'success';
      case 'suspended': return 'warning';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={handleBack}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
                <Link color="inherit" href="/projects" underline="hover">
                  Projets
                </Link>
                <Typography color="text.primary">{project.name}</Typography>
              </Breadcrumbs>
            </Box>
          </Stack>

          <IconButton onClick={handleMenuClick}>
            <MoreVertIcon />
          </IconButton>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Typography variant="h4" component="h1">
            {project.name}
          </Typography>
          <Chip
            label={project.status}
            color={getStatusColor(project.status)}
            size="small"
          />
          <Chip
            label={project.priority}
            color={getPriorityColor(project.priority)}
            variant="outlined"
            size="small"
          />
        </Stack>

        <Typography variant="body1" color="text.secondary">
          {project.description}
        </Typography>
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
            icon={<TimelineIcon />}
            iconPosition="start"
            label="Vue par Jalons"
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
            <MilestoneView
              projectId={project.id}
              onCreateMilestone={handleCreateMilestone}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <ProjectTeam project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
            <ProjectRoadmap
              projectId={project.id}
              onCreateEpic={handleCreateEpic}
              onCreateMilestone={handleCreateMilestone}
              onEditEpic={handleEditEpic}
              onEditMilestone={handleEditMilestone}
              refreshTrigger={roadmapKey}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={5}>
            <ProjectGantt project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={6}>
            <ProjectRaci project={project} onRefresh={loadProject} />
          </TabPanel>
          <TabPanel value={tabValue} index={7}>
            <ProjectDocuments projectId={project.id} />
          </TabPanel>
          <TabPanel value={tabValue} index={8}>
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
      </Menu>

      {/* Modals */}
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

export default ProjectDetail;`;

// Écrire le nouveau fichier
fs.writeFileSync('src/pages/ProjectDetail.tsx', cleanContent);

console.log('✅ ProjectDetail.tsx recréé avec une intégration propre !');
console.log('📋 Fonctionnalités ajoutées:');
console.log('  - Import MilestoneView');
console.log('  - Tab "Vue par Jalons" (index 2)');
console.log('  - TabPanel avec MilestoneView correctement indexé');
console.log('  - Tous les autres onglets réindexés proprement');