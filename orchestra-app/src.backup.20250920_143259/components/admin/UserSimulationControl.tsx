import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Chip,
  Typography,
  Avatar,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Stop as StopIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { userSimulationService } from '../../services/user-simulation.service';
import { User } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';

interface UserSimulationControlProps {
  onSimulationChange?: (isActive: boolean, simulatedUser: User | null) => void;
}

export const UserSimulationControl: React.FC<UserSimulationControlProps> = ({
  onSimulationChange
}) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasAdminAccess } = usePermissions();
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [simulationContext, setSimulationContext] = useState(userSimulationService.getSimulationContext());

  // Écouter les changements de simulation
  useEffect(() => {
    const unsubscribe = userSimulationService.subscribe((context) => {
      setSimulationContext(context);
      onSimulationChange?.(context.isActive, context.simulatedUser);
    });

    return unsubscribe;
  }, [onSimulationChange]);

  // Charger les utilisateurs au montage
  useEffect(() => {
    if (hasAdminAccess() && user?.id) {
      loadAvailableUsers();
    }
  }, [hasAdminAccess, user]);

  const loadAvailableUsers = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const users = await userSimulationService.getSimulatableUsers(user.id);
      setAvailableUsers(users);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setError('Impossible de charger la liste des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    if (!user?.id || !selectedUserId) return;

    try {
      setIsLoading(true);
      setError('');

      await userSimulationService.startSimulation(user.id, selectedUserId);
      setSelectedUserId('');
    } catch (error) {
      console.error('Erreur lors du démarrage de la simulation:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors du démarrage de la simulation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSimulation = () => {
    userSimulationService.stopSimulation();
  };

  const getUserDisplayName = (user: User): string => {
    return user.displayName || `${user.firstName} ${user.lastName}` || user.email;
  };

  const getRoleColor = (role: string): string => {
    const colors: Record<string, string> = {
      admin: '#f44336',
      responsable: '#ff9800',
      manager: '#2196f3',
      chef_projet: '#4caf50',
      contributeur: '#9c27b0',
      invité: '#607d8b'
    };
    return colors[role] || '#757575';
  };

  // Ne pas afficher si l'utilisateur n'est pas admin
  if (!hasAdminAccess()) {
    return null;
  }

  return (
    <Box sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <VisibilityIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h3">
          Simulation Utilisateur
        </Typography>
        <Tooltip title="Permet de voir l'application comme un autre utilisateur">
          <IconButton size="small">
            <WarningIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* État de la simulation */}
      {simulationContext.isActive && simulationContext.simulatedUser && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleStopSimulation}
              startIcon={<StopIcon />}
            >
              Arrêter
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              src={simulationContext.simulatedUser.avatarUrl}
              sx={{ width: 24, height: 24, mr: 1 }}
            >
              {getUserDisplayName(simulationContext.simulatedUser).charAt(0)}
            </Avatar>
            <Typography variant="body2">
              <strong>Simulation active :</strong> {getUserDisplayName(simulationContext.simulatedUser)}
            </Typography>
            <Chip
              label={simulationContext.simulatedUser.role}
              size="small"
              sx={{
                ml: 1,
                backgroundColor: getRoleColor(simulationContext.simulatedUser.role),
                color: 'white',
                fontSize: '0.7rem'
              }}
            />
          </Box>
        </Alert>
      )}

      {/* Sélecteur d'utilisateur */}
      {!simulationContext.isActive && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Sélectionner un utilisateur</InputLabel>
            <Select
              value={selectedUserId}
              label="Sélectionner un utilisateur"
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={isLoading}
            >
              {availableUsers.map((targetUser) => (
                <MenuItem key={targetUser.id} value={targetUser.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar src={targetUser.avatarUrl} sx={{ width: 24, height: 24 }}>
                        {getUserDisplayName(targetUser).charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={getUserDisplayName(targetUser)}
                      secondary={targetUser.email}
                    />
                    <Chip
                      label={targetUser.role}
                      size="small"
                      sx={{
                        backgroundColor: getRoleColor(targetUser.role),
                        color: 'white',
                        fontSize: '0.7rem'
                      }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleStartSimulation}
            disabled={!selectedUserId || isLoading}
            sx={{ minWidth: 140 }}
          >
            {isLoading ? 'Démarrage...' : 'Simuler'}
          </Button>
        </Box>
      )}

      {/* Messages d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* Instructions */}
      {!simulationContext.isActive && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          💡 <strong>Conseil :</strong> La simulation vous permet de voir exactement ce que voit un utilisateur
          dans son dashboard, avec ses permissions et ses données. Parfait pour le debug et le support.
        </Typography>
      )}
    </Box>
  );
};