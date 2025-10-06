import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { User, Project, Milestone } from '../../types';
import { projectService } from '../../services/project.service';
import { milestoneService } from '../../services/milestone.service';

// Lazy load du composant PortfolioGantt (le même que dans Reports)
const PortfolioGantt = lazy(() => import('../reports/PortfolioGantt'));

interface PortfolioTabProps {
  user: User;
}

export const PortfolioTab: React.FC<PortfolioTabProps> = ({ user }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPortfolioData();
  }, [user.id]);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger TOUS les projets (pas de filtrage par utilisateur)
      const allProjects = await projectService.getAllProjects();

      setProjects(allProjects);

      // Charger tous les jalons pour tous les projets
      const allMilestones: Milestone[] = [];
      for (const project of allProjects) {
        try {
          const projectMilestones = await milestoneService.getMilestonesByProject(project.id);
          allMilestones.push(...projectMilestones);
        } catch (err) {
          console.error(`Erreur chargement jalons projet ${project.id}:`, err);
        }
      }
      setMilestones(allMilestones);

    } catch (err) {
      console.error('Erreur lors du chargement du portfolio:', err);
      setError('Impossible de charger le portfolio');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (projects.length === 0) {
    return (
      <Alert severity="info">
        Aucun projet disponible actuellement.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Portfolio
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Visualisation de l'ensemble des projets ({projects.length}) sous forme de diagramme de Gantt.
      </Typography>

      <Suspense
        fallback={
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        }
      >
        <PortfolioGantt projects={projects} milestones={milestones} />
      </Suspense>
    </Box>
  );
};
