/**
 * Dashboard Hub V2 - Vue Opérationnelle Personnelle
 *
 * Architecture :
 * 1. Planning Hebdomadaire (60% - Composant principal en haut)
 * 2. Mes Projets (20% - Widget latéral gauche)
 * 3. Mes Tâches Critiques (20% - Widget latéral droit)
 *
 * Données :
 * - Projets : Uniquement ceux où l'utilisateur est membre d'équipe
 * - Tâches : Uniquement celles où l'utilisateur est Responsible (R du RACI) et non terminées
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FolderOpen as ProjectIcon,
  Assignment as TaskIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSimulatedUser } from '../hooks/useSimulatedPermissions';
import MyPlanning from '../components/dashboard/MyPlanning';
import MyProjectsWidget from '../components/dashboard/MyProjectsWidget';
import MyTasksWidget from '../components/dashboard/MyTasksWidget';
import PersonalTodoWidget from '../components/dashboard/PersonalTodoWidget';
import { dashboardHubV2Service, DashboardHubData } from '../services/dashboard-hub-v2.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const DashboardHubV2: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { user, isSimulating } = useSimulatedUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardHubData | null>(null);

  // Chargement des données du dashboard
  const loadDashboardData = useCallback(async () => {
    if (!user?.id) {
      setError('Utilisateur non connecté');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await dashboardHubV2Service.getDashboardData(user.id);
      setDashboardData(data);
    } catch (err) {
      console.error('Erreur lors du chargement du dashboard:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Chargement initial
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Rafraîchissement manuel
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Callback pour mise à jour des tâches
  const handleTaskUpdate = useCallback(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading && !dashboardData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography ml={2}>Chargement de votre dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadDashboardData}>
            Réessayer
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          Aucune donnée disponible
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🎯 Mon Hub Personnel
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Métriques rapides */}
          <Chip
            icon={<ProjectIcon />}
            label={`${dashboardData.metrics.totalProjects} projet${dashboardData.metrics.totalProjects > 1 ? 's' : ''}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<TaskIcon />}
            label={`${dashboardData.metrics.totalTasks} tâche${dashboardData.metrics.totalTasks > 1 ? 's' : ''}`}
            color="info"
            variant="outlined"
          />
          {dashboardData.metrics.tasksOverdue > 0 && (
            <Chip
              label={`${dashboardData.metrics.tasksOverdue} en retard`}
              color="error"
              size="small"
            />
          )}
          <IconButton
            onClick={handleRefresh}
            disabled={refreshing}
            size="large"
            color="primary"
          >
            {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Stack>
      </Box>

      {/* Indicateur de simulation */}
      {isSimulating && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            border: 2,
            borderColor: 'info.main',
            bgcolor: 'info.50',
          }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
            >
              Quitter simulation
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={user?.avatarUrl}
              sx={{ width: 32, height: 32 }}
            >
              {user?.firstName?.charAt(0) || user?.displayName?.charAt(0)}
            </Avatar>
            <Typography variant="body1">
              <strong>🎭 Mode Simulation</strong> - Dashboard de{' '}
              <strong>{user?.displayName || `${user?.firstName} ${user?.lastName}`}</strong>
            </Typography>
          </Box>
        </Alert>
      )}

      {/* 1. PLANNING HEBDOMADAIRE (60% - Composant principal) */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <MyPlanning />
        </CardContent>
      </Card>

      {/* Ma To-Do */}
      <Box sx={{ mb: 3 }}>
        <PersonalTodoWidget />
      </Box>

      {/* 2 & 3. WIDGETS LATÉRAUX : Mes Projets + Mes Tâches */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Mes Projets (50% sur desktop) */}
        <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: 300 }}>
          <MyProjectsWidget
            projects={dashboardData.myProjects}
            loading={loading}
          />
        </Box>

        {/* Mes Tâches Critiques (50% sur desktop) */}
        <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: 300 }}>
          <MyTasksWidget
            tasksByUrgency={dashboardData.myTasksByUrgency}
            loading={loading}
            onTaskUpdate={handleTaskUpdate}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardHubV2;
