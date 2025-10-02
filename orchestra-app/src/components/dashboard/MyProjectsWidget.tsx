import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Stack,
  Chip,
  Button,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  FolderOpen as ProjectIcon,
  ArrowForward as ArrowForwardIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ProjectWithMetrics } from '../../services/dashboard-hub-v2.service';

interface MyProjectsWidgetProps {
  projects: ProjectWithMetrics[];
  loading?: boolean;
}

const PROJECTS_PER_PAGE = 5;

export const MyProjectsWidget: React.FC<MyProjectsWidgetProps> = ({
  projects,
  loading = false,
}) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);

  // Pagination
  const totalPages = Math.ceil(projects.length / PROJECTS_PER_PAGE);
  const startIndex = currentPage * PROJECTS_PER_PAGE;
  const endIndex = startIndex + PROJECTS_PER_PAGE;
  const currentProjects = projects.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getProjectStatusColor = (project: ProjectWithMetrics) => {
    // 🔴 En retard si tâches en retard
    if (project.myTasksOverdue > 0) return 'error';

    // 🟡 At risk si plus de 70% de progression mais encore des tâches
    if (project.progress > 70 && project.myTasksInProgress > 0) return 'warning';

    // 🟢 On track
    return 'success';
  };

  const getProjectStatusIcon = (project: ProjectWithMetrics) => {
    const color = getProjectStatusColor(project);

    if (color === 'error') {
      return <WarningIcon sx={{ fontSize: 20, color: 'error.main' }} />;
    }
    if (color === 'warning') {
      return <WarningIcon sx={{ fontSize: 20, color: 'warning.main' }} />;
    }
    return <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />;
  };

  const getProjectStatusLabel = (project: ProjectWithMetrics) => {
    const color = getProjectStatusColor(project);

    if (color === 'error') return 'En retard';
    if (color === 'warning') return 'À risque';
    return 'Dans les temps';
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Mes Projets Actifs
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* En-tête */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="600">
            📊 Mes Projets
          </Typography>
          <Chip
            label={`${projects.length} projet${projects.length > 1 ? 's' : ''}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        {/* Liste des projets */}
        {projects.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Vous n'êtes membre d'aucun projet actif pour le moment.
          </Alert>
        ) : (
          <>
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              {currentProjects.map((project) => (
                <Card
                  key={project.id}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => navigate(`/projects/${project.id}?tab=roadmap`)}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    {/* En-tête projet */}
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      {getProjectStatusIcon(project)}
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight="600">
                          {project.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {project.code}
                        </Typography>
                      </Box>
                      <Chip
                        label={getProjectStatusLabel(project)}
                        size="small"
                        color={getProjectStatusColor(project)}
                        variant="outlined"
                      />
                    </Stack>

                    {/* Barre de progression */}
                    <Box mb={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Progression globale
                        </Typography>
                        <Typography variant="caption" fontWeight="600">
                          {project.progress}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={project.progress}
                        sx={{ height: 6, borderRadius: 3 }}
                        color={getProjectStatusColor(project)}
                      />
                    </Box>

                    {/* Métriques mes tâches */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {project.myTasksOverdue > 0 && (
                        <Chip
                          label={`${project.myTasksOverdue} en retard`}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                      {project.myTasksInProgress > 0 && (
                        <Chip
                          label={`${project.myTasksInProgress} en cours`}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                      {project.myTasksTodo > 0 && (
                        <Chip
                          label={`${project.myTasksTodo} à faire`}
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                      {project.myTasksCount === 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Aucune tâche assignée
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {/* Pagination */}
            {totalPages > 1 && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
                <IconButton
                  size="small"
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                >
                  <ChevronLeftIcon />
                </IconButton>

                <Typography variant="caption" color="text.secondary">
                  Page {currentPage + 1} / {totalPages}
                </Typography>

                <IconButton
                  size="small"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Stack>
            )}
          </>
        )}

        {/* Lien vers tous les projets */}
        {projects.length > 0 && (
          <Button
            fullWidth
            variant="text"
            size="small"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/projects')}
            sx={{ mt: 2 }}
          >
            Voir tous mes projets
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MyProjectsWidget;
