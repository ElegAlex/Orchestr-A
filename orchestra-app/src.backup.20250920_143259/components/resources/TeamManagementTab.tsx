import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchUsers,
  fetchUserSkills,
  fetchAllUsersSkills,
  setSelectedUser,
  clearError
} from '../../store/slices/resourceSlice';
import { User } from '../../types';
import { UserSkillsModal } from '../skills/UserSkillsModal';

export const TeamManagementTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    users,
    selectedUser,
    userSkills,
    loading,
    error,
  } = useAppSelector((state: any) => state.resources);

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchUsers()).then((result: any) => {
      if (result.type.endsWith('/fulfilled') && Array.isArray(result.payload)) {
        // Charger les compétences de tous les utilisateurs après avoir chargé les utilisateurs
        const userIds = (result.payload as User[]).map((user: User) => user.id);
        dispatch(fetchAllUsersSkills(userIds));
      }
    });
  }, [dispatch]);

  const filteredUsers = useMemo(() => {
    return users.filter((user: User) => {
      const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.department?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = !departmentFilter || user.department === departmentFilter;
      const matchesRole = !roleFilter || user.role === roleFilter;

      return matchesSearch && matchesDepartment && matchesRole;
    });
  }, [users, searchTerm, departmentFilter, roleFilter]);

  const handleViewDetails = (userId: string) => {
    dispatch(fetchUserSkills(userId));
    const user = users.find((u: User) => u.id === userId);
    dispatch(setSelectedUser(user || null));
    setOpenUserDialog(true);
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const result = await dispatch(fetchUsers());
      if (result.type.endsWith('/fulfilled') && Array.isArray(result.payload)) {
        // Recharger également toutes les compétences
        const userIds = (result.payload as User[]).map((user: User) => user.id);
        await dispatch(fetchAllUsersSkills(userIds));
      }
    } finally {
      setRefreshing(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Administrateur',
      responsable: 'Responsable',
      manager: 'Chef de projet',
      teamLead: 'Référent technique',
      contributor: 'Contributeur',
      viewer: 'Observateur'
    };
    return roleLabels[role] || role;
  };

  const getRoleColor = (role: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default' => {
    const roleColors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      admin: 'error',
      manager: 'primary',
      contributor: 'success',
      viewer: 'default'
    };
    return roleColors[role] || 'default';
  };

  return (
    <Box>
      {/* Header Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Gestion de l'équipe
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Actualiser les données">
            <IconButton
              onClick={handleRefreshAll}
              disabled={refreshing}
              color="primary"
            >
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {/* TODO: Ajouter un nouveau membre */}}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Nouveau membre
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Filtres */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Rechercher par nom, email ou département..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Département</InputLabel>
            <Select
              value={departmentFilter}
              label="Département"
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="IT">IT</MenuItem>
              <MenuItem value="RH">RH</MenuItem>
              <MenuItem value="Finance">Finance</MenuItem>
              <MenuItem value="Juridique">Juridique</MenuItem>
              <MenuItem value="Direction">Direction</MenuItem>
              <MenuItem value="Communication">Communication</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Rôle</InputLabel>
            <Select
              value={roleFilter}
              label="Rôle"
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="admin">Administrateur</MenuItem>
              <MenuItem value="manager">Chef de projet</MenuItem>
              <MenuItem value="contributor">Contributeur</MenuItem>
              <MenuItem value="viewer">Observateur</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ ml: 'auto' }}>
            <Typography variant="body2" color="text.secondary">
              {filteredUsers.length} membre{filteredUsers.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell>Membre</TableCell>
                <TableCell>Département</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Compétences</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user: User) => {
                const skills = userSkills[user.id] || [];
                return (
                  <TableRow
                    key={user.id}
                    sx={{
                      '&:hover': { backgroundColor: 'grey.50' },
                      cursor: 'pointer'
                    }}
                    onClick={() => handleViewDetails(user.id)}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar
                          src={user.avatarUrl}
                          sx={{ width: 40, height: 40 }}
                        >
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={500}>
                            {user.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.firstName} {user.lastName}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <BusinessIcon fontSize="small" color="disabled" />
                        <Typography variant="body2">
                          {user.department || 'Non défini'}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={getRoleLabel(user.role)}
                        color={getRoleColor(user.role)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <EmailIcon fontSize="small" color="disabled" />
                        <Typography variant="body2">
                          {user.email}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5} alignItems="center">
                        {skills.slice(0, 3).map((skill: any) => (
                          <Chip
                            key={skill.id}
                            label={skill.name}
                            size="small"
                            variant="outlined"
                            color={skill.level === 'expert' ? 'primary' : 'default'}
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                        {skills.length > 3 && (
                          <Chip
                            label={`+${skills.length - 3}`}
                            size="small"
                            variant="outlined"
                            color="default"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(user.id);
                          }}
                          sx={{
                            ml: 1,
                            color: 'primary.main',
                            '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                          }}
                          title="Gérer les compétences"
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>

                        {skills.length === 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Cliquez + pour ajouter des compétences
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      Aucun membre trouvé avec ces critères
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Modal de gestion des compétences */}
      <UserSkillsModal
        open={openUserDialog}
        onClose={() => setOpenUserDialog(false)}
        user={selectedUser}
        userSkills={selectedUser ? (userSkills[selectedUser.id] || []) : []}
        onSkillsUpdated={() => {
          console.log('onSkillsUpdated called for user:', selectedUser?.id);
          if (selectedUser) {
            console.log('Calling fetchUserSkills for:', selectedUser.id);
            // Recharger les compétences de l'utilisateur pour mettre à jour l'affichage
            dispatch(fetchUserSkills(selectedUser.id)).then((result: any) => {
              console.log('fetchUserSkills result:', result);
              if (result.type.endsWith('/rejected')) {
                console.error('fetchUserSkills FAILED with error:', result.error);
              }
            });
          }
        }}
      />
    </Box>
  );
};