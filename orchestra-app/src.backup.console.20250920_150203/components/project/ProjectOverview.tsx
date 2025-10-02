import React from 'react';
import { 
  Box, 
  Typography, 
  Alert
} from '@mui/material';
import { Project } from '../../types';

interface ProjectOverviewProps {
  project: Project;
  onRefresh: () => void;
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project, onRefresh }) => {
  // Version simplifiée temporaire pour déploiement Gantt
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📊 Vue d'ensemble - {project.name}
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Vue d'ensemble temporairement simplifiée. L'onglet Gantt est maintenant disponible ! 🚀
      </Alert>
      <Box sx={{ p: 2 }}>
        <Typography variant="body1">
          Projet : <strong>{project.name}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Status : {project.status}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Progression : {project.progress}%
        </Typography>
      </Box>
    </Box>
  );
};

export default ProjectOverview;