import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Security as SecurityIcon,
  People as PeopleIcon,
  Build as RepairIcon,
  AdminPanelSettings as RoleIcon,
  Folder as ProjectIcon
} from '@mui/icons-material';
import { UserManagement } from '../components/admin/UserManagement';
import { DataRepairTool } from '../components/admin/DataRepairTool';
import { RolePermissionsManager } from '../components/admin/RolePermissionsManager';
import { UserSimulationControl } from '../components/admin/UserSimulationControl';
import FixTaskIds from '../components/admin/FixTaskIds';
import CleanOrphanReferences from '../components/admin/CleanOrphanReferences';
import TeleworkMigrationTool from '../components/admin/TeleworkMigrationTool';
import RecalculateAllProjects from '../components/admin/RecalculateAllProjects';
import { usePermissions } from '../hooks/usePermissions';
import { User } from '../types';
import { permissionsService } from '../services/permissions.service';
import { userService } from '../services/user.service';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

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
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  };
}

const Admin: React.FC = () => {
  const { hasAdminAccess, hasPermission } = usePermissions();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allUsers = await userService.getAllUsers();
      setUsers(allUsers);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(`Erreur lors du chargement des utilisateurs: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUserUpdate = async (user: User) => {
    try {
      await userService.updateUser(user.id, user);
      await loadUsers(); // Recharger la liste
    } catch (err) {
      throw new Error('Erreur lors de la mise à jour de l\'utilisateur');
    }
  };

  const handleUserCreate = async (userData: Partial<User>) => {
    try {
      // Le nouveau composant UserManagement utilise directement AdminUserCreationService
      // Cette méthode ne devrait plus être appelée pour les nouveaux utilisateurs avec login/password
      // Mais on la garde pour la rétrocompatibilité avec d'autres composants
      
      const newUser = {
        ...userData,
        id: `user_${Date.now()}`, // Générer un ID temporaire
        displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        isActive: userData.isActive ?? true
      } as User;
      
      await userService.createUser(newUser);
      await loadUsers(); // Recharger la liste
    } catch (err) {
      throw new Error('Erreur lors de la création de l\'utilisateur');
    }
  };

  const handleUserDelete = async (userId: string) => {
    try {
      await userService.deleteUser(userId);
      await loadUsers(); // Recharger la liste
    } catch (err) {
      throw new Error('Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Vérification des permissions : Admin technique OU Responsable métier
  const canAccessAdminPage = hasAdminAccess() || currentUser?.role === 'responsable';

  useEffect(() => {
    if (canAccessAdminPage) {
      loadUsers();
    }
  }, [canAccessAdminPage]); // Dependances mises à jour

  // DEBUG: Afficher les informations de l'utilisateur
  
  if (!canAccessAdminPage) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Accès refusé. Cette page est réservée aux administrateurs.
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            DEBUG Info:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
            Email: {currentUser?.email || 'Non défini'}<br/>
            Rôle: {currentUser?.role || 'Non défini'}<br/>
            Actif: {currentUser?.isActive ? 'Oui' : 'Non'}<br/>
            hasAdminAccess(): {hasAdminAccess() ? 'true' : 'false'}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Chargement de l'administration...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" display="flex" alignItems="center" gap={1}>
          <SecurityIcon fontSize="inherit" />
          Administration
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Gestion des utilisateurs, rôles et réparation des données
        </Typography>
      </Box>

      {/* Contrôle de simulation utilisateur */}
      <UserSimulationControl />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Onglets */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="Admin tabs">
            <Tab 
              icon={<PeopleIcon />} 
              label="Utilisateurs & Permissions" 
              {...a11yProps(0)} 
              disabled={!hasPermission('user.view')}
            />
            <Tab 
              icon={<RoleIcon />} 
              label="Gestion des Rôles" 
              {...a11yProps(1)} 
              disabled={currentUser?.role !== 'admin'}
            />
            <Tab
              icon={<RepairIcon />}
              label="Réparation Données"
              {...a11yProps(2)}
              disabled={!hasPermission('admin.settings')}
            />
            <Tab
              icon={<RepairIcon />}
              label="Migration Télétravail"
              {...a11yProps(3)}
              disabled={!hasPermission('admin.settings')}
            />
            <Tab
              icon={<ProjectIcon />}
              label="Recalcul Projets"
              {...a11yProps(4)}
              disabled={!hasPermission('admin.settings')}
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {hasPermission('user.view') ? (
            <UserManagement />
          ) : (
            <Alert severity="warning">
              Vous n'avez pas les permissions pour gérer les utilisateurs.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {currentUser?.role === 'admin' ? (
            <RolePermissionsManager />
          ) : (
            <Alert severity="warning">
              Seuls les administrateurs peuvent modifier les permissions des rôles.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {hasPermission('admin.settings') ? (
            <Box>
              <Typography variant="h5" gutterBottom>
                Réparation des Données
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Diagnostiquer et réparer automatiquement les données corrompues dans la base.
              </Typography>
              <FixTaskIds />
              <CleanOrphanReferences />
              <DataRepairTool />
            </Box>
          ) : (
            <Alert severity="warning">
              Vous n'avez pas les permissions pour accéder aux outils de réparation.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {hasPermission('admin.settings') ? (
            <Box>
              <Typography variant="h5" gutterBottom>
                Migration du système télétravail
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Migrer les données de l'ancien système télétravail vers le nouveau système v2.
              </Typography>
              <TeleworkMigrationTool />
            </Box>
          ) : (
            <Alert severity="warning">
              Vous n'avez pas les permissions pour accéder à l'outil de migration.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          {hasPermission('admin.settings') ? (
            <RecalculateAllProjects />
          ) : (
            <Alert severity="warning">
              Vous n'avez pas les permissions pour recalculer les projets.
            </Alert>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Admin;