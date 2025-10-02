import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Grid,
  Stack,
  IconButton,
  Paper,
  Alert,
} from '@mui/material';
// Temporary fix: Comment out Timeline components that are causing issues
// import {
//   Timeline,
//   TimelineItem,
//   TimelineOppositeContent,
//   TimelineSeparator,
//   TimelineDot,
//   TimelineConnector,
//   TimelineContent,
// } from '@mui/lab';
import {
  Timeline as TimelineIcon,
  Flag as MilestoneIcon,
  Assignment as EpicIcon,
  CheckCircle as CompletedIcon,
  RadioButtonUnchecked as PendingIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Epic, Milestone, EpicStatus, MilestoneStatus } from '../../types';
import { epicService } from '../../services/epic.service';
import { milestoneService } from '../../services/milestone.service';

// Utilitaires pour les statuts (définis en dehors du composant)
const getEpicStatusColor = (status: EpicStatus): "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  switch (status) {
    case 'upcoming': return 'info';
    case 'in_progress': return 'primary';
    case 'completed': return 'success';
    default: return 'info';
  }
};

const getMilestoneStatusColor = (status: MilestoneStatus): "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  switch (status) {
    case 'upcoming': return 'info';
    case 'in_progress': return 'primary';
    case 'completed': return 'success';
    default: return 'info';
  }
};

// Fonction pour obtenir la couleur hexadécimale pour le Gantt
const getStatusHexColor = (status: EpicStatus | MilestoneStatus): string => {
  switch (status) {
    case 'upcoming': return '#2196F3';     // Bleu
    case 'in_progress': return '#FF9800';  // Orange
    case 'completed': return '#4CAF50';    // Vert
    default: return '#2196F3';
  }
};

const getStatusLabel = (status: EpicStatus | MilestoneStatus) => {
  const labels: Record<string, string> = {
    'upcoming': 'À venir',
    'in_progress': 'En cours',
    'completed': 'Terminé',
  };
  return labels[status] || status;
};

// Fonction utilitaire pour les icônes de jalons
const getMilestoneStatusIcon = (status: MilestoneStatus) => {
  if (status === 'completed') return <CompletedIcon sx={{ fontSize: 18, color: 'success.main' }} />;
  if (status === 'in_progress') return <ScheduleIcon sx={{ fontSize: 18, color: 'primary.main' }} />;
  return <PendingIcon sx={{ fontSize: 18, color: 'info.main' }} />;
};

interface ProjectRoadmapProps {
  projectId: string;
  onCreateEpic?: () => void;
  onCreateMilestone?: () => void;
  onEditEpic?: (epic: Epic) => void;
  onEditMilestone?: (milestone: Milestone) => void;
  refreshTrigger?: number;
}

interface RoadmapTimelineItem {
  id: string;
  type: 'epic' | 'milestone';
  data: Epic | Milestone;
  date: Date;
  position: number; // Position sur la timeline
}

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({
  projectId,
  onCreateEpic,
  onCreateMilestone,
  onEditEpic,
  onEditMilestone,
  refreshTrigger,
}) => {
  console.log('🗺️ ProjectRoadmap component loaded for project:', projectId);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  // Fonction de chargement des données (exposée pour le refresh)
  const loadRoadmapData = async () => {
    try {
      console.log('🗺️ ProjectRoadmap: Chargement des données pour projectId:', projectId);
      setLoading(true);
      const [epicsData, milestonesData] = await Promise.all([
        epicService.getProjectEpics(projectId),
        milestoneService.getProjectMilestones(projectId),
      ]);

      console.log('🗺️ ProjectRoadmap: Données chargées - epics:', epicsData.length, 'milestones:', milestonesData.length);
      setEpics(epicsData);
      setMilestones(milestonesData);
    } catch (error) {
      console.error('Error loading roadmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chargement initial des données et refresh sur trigger
  useEffect(() => {
    loadRoadmapData();
  }, [projectId, refreshTrigger]);


  // Construction de la timeline
  const timelineItems = useMemo(() => {
    const items: RoadmapTimelineItem[] = [];
    
    // Ajouter les epics avec leurs dates
    epics.forEach(epic => {
      if (epic.dueDate || epic.startDate) {
        items.push({
          id: epic.id,
          type: 'epic',
          data: epic,
          date: epic.dueDate || epic.startDate!,
          position: 0,
        });
      }
    });
    
    // Ajouter les milestones
    milestones.forEach(milestone => {
      items.push({
        id: milestone.id,
        type: 'milestone',
        data: milestone,
        date: milestone.dueDate || milestone.startDate || new Date(),
        position: 0,
      });
    });
    
    // Trier par date
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculer les positions (éviter les chevauchements)
    items.forEach((item, index) => {
      item.position = index;
    });
    
    return items;
  }, [epics, milestones]);


  const getMilestoneIcon = (milestone: Milestone) => {
    if (milestone.status === 'completed') return <CompletedIcon color="success" />;
    if (milestone.status === 'in_progress') return <ScheduleIcon color="primary" />;
    return <PendingIcon color="info" />;
  };


  // Métriques du projet
  const projectMetrics = useMemo(() => {
    const totalEpics = epics.length;
    const completedEpics = epics.filter(e => e.status === 'completed').length;
    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const inProgressMilestones = milestones.filter(m => m.status === 'in_progress').length;
    
    const overallProgress = totalEpics > 0 
      ? Math.round(epics.reduce((sum, e) => sum + (e.progress || 0), 0) / totalEpics)
      : 0;

    return {
      totalEpics,
      completedEpics,
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      overallProgress,
    };
  }, [epics, milestones]);

  if (loading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Chargement de la roadmap...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header avec métriques */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h5" gutterBottom>
              🗺️ Roadmap du Projet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Visualisation des épiques et jalons du projet avec leurs dépendances
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<EpicIcon />}
              onClick={onCreateEpic}
              size="small"
            >
              Nouvel Epic
            </Button>
            <Button
              variant="outlined"
              startIcon={<MilestoneIcon />}
              onClick={onCreateMilestone}
              size="small"
            >
              Nouveau Jalon
            </Button>
          </Stack>
        </Stack>

        {/* Métriques */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="primary">
                  {projectMetrics.totalEpics}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Epics Total
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {projectMetrics.completedEpics} terminés
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="warning.main">
                  {projectMetrics.totalMilestones}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Jalons Total
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {projectMetrics.completedMilestones} atteints
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="success.main">
                  {projectMetrics.overallProgress}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Progression
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={projectMetrics.overallProgress} 
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="primary.main">
                  {projectMetrics.inProgressMilestones}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Jalons En Cours
                </Typography>
                {projectMetrics.inProgressMilestones > 0 && (
                  <Chip 
                    label="Actifs" 
                    color="primary" 
                    size="small" 
                    sx={{ mt: 1 }}
                  />
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>

        {projectMetrics.inProgressMilestones > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            🚀 {projectMetrics.inProgressMilestones} jalon(s) en cours de réalisation
          </Alert>
        )}
      </Paper>

      {/* Timeline View */}
      {timelineItems.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <TimelineIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucun élément sur la roadmap
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Créez votre premier epic ou jalon pour commencer à planifier votre projet
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained" startIcon={<EpicIcon />} onClick={onCreateEpic}>
              Créer un Epic
            </Button>
            <Button variant="outlined" startIcon={<MilestoneIcon />} onClick={onCreateMilestone}>
              Créer un Jalon
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {timelineItems.map((item, index) => (
            <Card 
              key={item.id}
              elevation={1}
              sx={{ 
                minHeight: '120px', // Hauteur fixe pour uniformité
                maxHeight: '120px',
                border: '1px solid',
                borderColor: item.type === 'epic' 
                  ? `${getEpicStatusColor((item.data as Epic).status)}.main`
                  : `${getMilestoneStatusColor((item.data as Milestone).status)}.main`,
                borderLeft: '4px solid',
                borderLeftColor: item.type === 'epic' 
                  ? `${getEpicStatusColor((item.data as Epic).status)}.main`
                  : `${getMilestoneStatusColor((item.data as Milestone).status)}.main`,
                '&:hover': {
                  elevation: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {item.type === 'epic' ? (
                  <CompactEpicCard 
                    epic={item.data as Epic} 
                    date={item.date}
                    onEdit={onEditEpic}
                  />
                ) : (
                  <CompactMilestoneCard 
                    milestone={item.data as Milestone} 
                    date={item.date}
                    onEdit={onEditMilestone}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
};

// Composant compact pour afficher un Epic
const CompactEpicCard: React.FC<{ epic: Epic; date: Date; onEdit?: (epic: Epic) => void }> = ({ epic, date, onEdit }) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <EpicIcon sx={{ fontSize: 18, color: `${getEpicStatusColor(epic.status)}.main` }} />
          <Typography variant="body2" fontWeight="600" noWrap>
            {epic.title}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Chip
            label={epic.code}
            size="small"
            color={getEpicStatusColor(epic.status)}
            variant="outlined"
            sx={{ height: '20px', fontSize: '0.7rem' }}
          />
          <Chip
            label={getStatusLabel(epic.status)}
            size="small"
            color={getEpicStatusColor(epic.status)}
            sx={{ height: '20px', fontSize: '0.7rem' }}
          />
          <Typography variant="caption" color="text.secondary">
            {format(date, 'd MMM yyyy', { locale: fr })}
          </Typography>
        </Stack>
      </Box>
      
      {onEdit && (
        <IconButton size="small" onClick={() => onEdit(epic)} sx={{ ml: 1 }}>
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Stack>

    <Box sx={{ flex: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Progression: {epic.progress}% • Tâches: {epic.completedTaskCount}/{epic.taskCount}
        </Typography>
      </Stack>
      <LinearProgress 
        variant="determinate" 
        value={epic.progress} 
        sx={{ height: 6, borderRadius: 3 }}
        color={getEpicStatusColor(epic.status)}
      />
    </Box>
  </Box>
);

// Composant pour afficher un Epic (version originale conservée)
const EpicCard: React.FC<{ epic: Epic; onEdit?: (epic: Epic) => void }> = ({ epic, onEdit }) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Chip
            label={epic.code}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={getStatusLabel(epic.status)}
            size="small"
            color={getEpicStatusColor(epic.status)}
          />
        </Stack>
        <Typography variant="h6" gutterBottom>
          🏔️ {epic.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {epic.description}
        </Typography>
      </Box>
      
      {onEdit && (
        <IconButton size="small" onClick={() => onEdit(epic)}>
          <EditIcon />
        </IconButton>
      )}
    </Stack>

    <Box mb={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption" color="text.secondary">
          Progression
        </Typography>
        <Typography variant="caption" fontWeight="bold">
          {epic.progress}%
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={epic.progress} />
    </Box>

    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Typography variant="caption" color="text.secondary">
          Tâches
        </Typography>
        <Typography variant="body2">
          {epic.completedTaskCount} / {epic.taskCount}
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Typography variant="caption" color="text.secondary">
          Priorité
        </Typography>
        <Chip
          label={epic.priority}
          size="small"
          color={epic.priority === 'P0' ? 'error' : epic.priority === 'P1' ? 'warning' : 'info'}
        />
      </Box>
    </Box>
  </Box>
);

// Composant compact pour afficher un Milestone
const CompactMilestoneCard: React.FC<{ milestone: Milestone; date: Date; onEdit?: (milestone: Milestone) => void }> = ({ 
  milestone,
  date, 
  onEdit 
}) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          {getMilestoneStatusIcon(milestone.status)}
          <Typography variant="body2" fontWeight="600" noWrap>
            {milestone.name}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={milestone.code}
            size="small"
            color={getMilestoneStatusColor(milestone.status)}
            variant="outlined"
            sx={{ height: '20px', fontSize: '0.7rem' }}
          />
          <Chip
            label={getStatusLabel(milestone.status)}
            size="small"
            color={getMilestoneStatusColor(milestone.status)}
            sx={{ height: '20px', fontSize: '0.7rem' }}
          />
          {milestone.isKeyDate && (
            <Chip
              label="🔒"
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: '20px', fontSize: '0.7rem', minWidth: '32px' }}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            {format(date, 'd MMM yyyy', { locale: fr })}
          </Typography>
        </Stack>
      </Box>
      
      {onEdit && (
        <IconButton size="small" onClick={() => onEdit(milestone)} sx={{ ml: 1 }}>
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Stack>

    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {milestone.type} {milestone.description && `• ${milestone.description.substring(0, 60)}${milestone.description.length > 60 ? '...' : ''}`}
      </Typography>
    </Box>
  </Box>
);

// Composant pour afficher un Milestone (version originale conservée)
const MilestoneCard: React.FC<{ milestone: Milestone; onEdit?: (milestone: Milestone) => void }> = ({ 
  milestone, 
  onEdit 
}) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Chip
            label={milestone.code}
            size="small"
            color="warning"
            variant="outlined"
          />
          <Chip
            label={getStatusLabel(milestone.status)}
            size="small"
            color={getMilestoneStatusColor(milestone.status)}
          />
          {milestone.isKeyDate && (
            <Chip
              label="🔒 Date clé"
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Stack>
        <Typography variant="h6" gutterBottom>
          🎯 {milestone.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {milestone.description}
        </Typography>
      </Box>
      
      {onEdit && (
        <IconButton size="small" onClick={() => onEdit(milestone)}>
          <EditIcon />
        </IconButton>
      )}
    </Stack>

    {/* Section de complétion supprimée - calcul automatique était trompeur */}

    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Typography variant="caption" color="text.secondary">
          Type
        </Typography>
        <Typography variant="body2">
          {milestone.type}
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Typography variant="caption" color="text.secondary">
          Impact
        </Typography>
        <Chip
          label={milestone.impact}
          size="small"
          color={milestone.impact === 'critical' ? 'error' : milestone.impact === 'high' ? 'warning' : 'info'}
        />
      </Box>
    </Box>

    {milestone.deliverables && milestone.deliverables.length > 0 && (
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          Livrables ({milestone.deliverables.length})
        </Typography>
        <Stack direction="row" spacing={1} mt={1}>
          {milestone.deliverables.slice(0, 3).map((deliverable) => (
            <Chip
              key={deliverable.id}
              label={deliverable.name}
              size="small"
              color={deliverable.status === 'approved' ? 'success' : 'info'}
              variant="outlined"
            />
          ))}
          {milestone.deliverables.length > 3 && (
            <Chip
              label={`+${milestone.deliverables.length - 3}`}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      </Box>
    )}
  </Box>
);

export default ProjectRoadmap;