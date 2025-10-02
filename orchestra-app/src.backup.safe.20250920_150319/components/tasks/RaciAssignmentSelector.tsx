import React, { useState } from 'react';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Chip,
  Grid,
  Paper,
  Avatar,
  Stack,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import {
  AccountBox as ResponsibleIcon,
  Verified as AccountableIcon,
  Forum as ConsultedIcon,
  Notifications as InformedIcon,
  AccountBox,
} from '@mui/icons-material';
import { User } from '../../types';

interface RaciAssignments {
  responsible: string[];
  accountable: string[];
  consulted: string[];
  informed: string[];
}

interface RaciAssignmentSelectorProps {
  users: User[];
  assignments: RaciAssignments;
  onChange: (assignments: RaciAssignments) => void;
  disabled?: boolean;
}

const RaciAssignmentSelector: React.FC<RaciAssignmentSelectorProps> = ({
  users,
  assignments,
  onChange,
  disabled = false
}) => {
  const updateAssignment = (role: keyof RaciAssignments, userIds: string[]) => {
    onChange({
      ...assignments,
      [role]: userIds
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'responsible': return <ResponsibleIcon fontSize="small" color="primary" />;
      case 'accountable': return <AccountableIcon fontSize="small" color="error" />;
      case 'consulted': return <ConsultedIcon fontSize="small" color="warning" />;
      case 'informed': return <InformedIcon fontSize="small" color="info" />;
      default: return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'responsible': return 'primary';
      case 'accountable': return 'error';
      case 'consulted': return 'warning';
      case 'informed': return 'info';
      default: return 'default';
    }
  };

  const getUsersForIds = (userIds: string[]): User[] => {
    return userIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
  };

  const renderUserChips = (userIds: string[], role: string) => {
    const roleUsers = getUsersForIds(userIds);
    
    if (roleUsers.length === 0) {
      return (
        <Chip
          label="Non assigné"
          size="small"
          variant="outlined"
          color="default"
        />
      );
    }

    return (
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {roleUsers.map(user => (
          <Chip
            key={user.id}
            avatar={
              <Avatar sx={{ width: 20, height: 20, fontSize: '0.7rem' }}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </Avatar>
            }
            label={user.displayName}
            size="small"
            color={getRoleColor(role) as any}
            variant="outlined"
          />
        ))}
      </Stack>
    );
  };

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountBox sx={{ color: 'primary.main' }} />
        Assignation RACI Détaillée
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Assignez des rôles RACI spécifiques pour cette tâche
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="caption">
          <strong>R</strong> - Responsable (Exécute) • 
          <strong>A</strong> - Autorité (Approuve) • 
          <strong>C</strong> - Consulté (Conseille) • 
          <strong>I</strong> - Informé (Au courant)
        </Typography>
      </Alert>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {/* Responsable (R) */}
        <Box>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getRoleIcon('responsible')}
              <Typography variant="subtitle2" color="primary">
                Responsable (R)
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Exécute la tâche
            </Typography>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(option) => option.displayName}
              value={getUsersForIds(assignments.responsible)}
              onChange={(_, value) => updateAssignment('responsible', value.map(u => u.id))}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Sélectionner les responsables"
                />
              )}
              renderTags={() => null}
            />
            <Box sx={{ mt: 1 }}>
              {renderUserChips(assignments.responsible, 'responsible')}
            </Box>
          </Box>
        </Box>

        {/* Autorité (A) */}
        <Box>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getRoleIcon('accountable')}
              <Typography variant="subtitle2" color="error.main">
                Autorité (A)
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Approuve et rend compte
            </Typography>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(option) => option.displayName}
              value={getUsersForIds(assignments.accountable)}
              onChange={(_, value) => updateAssignment('accountable', value.map(u => u.id))}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Sélectionner les autorités"
                />
              )}
              renderTags={() => null}
            />
            <Box sx={{ mt: 1 }}>
              {renderUserChips(assignments.accountable, 'accountable')}
            </Box>
          </Box>
        </Box>

        {/* Consulté (C) */}
        <Box>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getRoleIcon('consulted')}
              <Typography variant="subtitle2" color="warning.main">
                Consulté (C)
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Donne son avis
            </Typography>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(option) => option.displayName}
              value={getUsersForIds(assignments.consulted)}
              onChange={(_, value) => updateAssignment('consulted', value.map(u => u.id))}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Sélectionner les consultés"
                />
              )}
              renderTags={() => null}
            />
            <Box sx={{ mt: 1 }}>
              {renderUserChips(assignments.consulted, 'consulted')}
            </Box>
          </Box>
        </Box>

        {/* Informé (I) */}
        <Box>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getRoleIcon('informed')}
              <Typography variant="subtitle2" color="info.main">
                Informé (I)
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Tenu au courant
            </Typography>
            <Autocomplete
              multiple
              options={users}
              getOptionLabel={(option) => option.displayName}
              value={getUsersForIds(assignments.informed)}
              onChange={(_, value) => updateAssignment('informed', value.map(u => u.id))}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Sélectionner les informés"
                />
              )}
              renderTags={() => null}
            />
            <Box sx={{ mt: 1 }}>
              {renderUserChips(assignments.informed, 'informed')}
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default RaciAssignmentSelector;