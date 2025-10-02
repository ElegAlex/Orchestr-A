import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  LinearProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Psychology as SkillIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { simpleUserService, SimpleUser } from '../services/simple-user.service';
import { SkillEditor } from '../components/skills/SkillEditor';
import { User, Skill } from '../types';

const SimpleResources: React.FC = () => {
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [skillEditorOpen, setSkillEditorOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SimpleUser | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const userData = await simpleUserService.getAllUsers();
      setUsers(userData);
      setFilteredUsers(userData);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let filtered = users;

    // Filtrage par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrage par département
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(user => user.department === departmentFilter);
    }

    // Filtrage par rôle
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, departmentFilter, roleFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };


  const handleOpenSkillEditor = (user: SimpleUser) => {
    setSelectedUser(user);
    setSkillEditorOpen(true);
  };

  const handleCloseSkillEditor = () => {
    setSkillEditorOpen(false);
    setSelectedUser(null);
  };

  const handleSaveSkills = async (skills: Skill[]) => {
    if (!selectedUser) return;

    try {
      // Sauvegarder les compétences de l'utilisateur dans Firebase
      await simpleUserService.updateUser(selectedUser.id, {
        skills
      });

      // Mettre à jour localement avec les objets Skill complets
      const updatedUser = { ...selectedUser, skills };
      setUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));
      console.log('✅ Compétences sauvegardées pour', selectedUser.displayName, ':', skills);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des compétences:', error);
    }
  };

  const getSkillLevel = (user: SimpleUser, skillName: string): 1 | 2 | 3 => {
    const skill = user.skills.find(s => s.name === skillName);
    return skill ? skill.level : 1;
  };

  const renderSkillsWithStars = (user: SimpleUser) => {
    if (!user.skills || user.skills.length === 0) return null;

    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Compétences principales
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          {user.skills.slice(0, 3).map((skill, index) => (
            <Chip
              key={skill.id || index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{skill.name}</span>
                  <Box sx={{ display: 'flex' }}>
                    {Array.from({ length: 3 }, (_, i) => (
                      <StarIcon
                        key={i}
                        sx={{
                          fontSize: 12,
                          color: i < skill.level ? 'gold' : 'grey.400'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              }
              size="small"
              variant="outlined"
              sx={{ mb: 0.5 }}
            />
          ))}
          {user.skills.length > 3 && (
            <Chip
              label={`+${user.skills.length - 3}`}
              size="small"
              variant="outlined"
              sx={{ mb: 0.5 }}
            />
          )}
        </Stack>
      </Box>
    );
  };

  // Obtenir les départements uniques
  const departments = Array.from(new Set(users.map(user => user.department))).filter(Boolean);
  const roles = Array.from(new Set(users.map(user => user.role))).filter(Boolean);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Gestion des Ressources
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Actualiser
          </Button>
        </Stack>
      </Box>

      {/* Message si aucune donnée */}
      {users.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Aucun utilisateur trouvé. Cliquez sur "Créer données de démo" pour commencer !
          </Typography>
        </Alert>
      )}

      {/* Filtres */}
      {users.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Box>
                <TextField
                  fullWidth
                  placeholder="Rechercher par nom, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Département</InputLabel>
                  <Select
                    value={departmentFilter}
                    label="Département"
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <MenuItem value="all">Tous les départements</MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept} value={dept}>
                        {dept}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Rôle</InputLabel>
                  <Select
                    value={roleFilter}
                    label="Rôle"
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <MenuItem value="all">Tous les rôles</MenuItem>
                    {roles.map((role) => (
                      <MenuItem key={role} value={role}>
                        {simpleUserService.getRoleLabel(role)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Statistiques rapides */}
      {users.length > 0 && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {filteredUsers.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ressources actives
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {filteredUsers.filter(u => (u.workload || 0) <= 70).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Disponibles
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {filteredUsers.filter(u => (u.workload || 0) > 70 && (u.workload || 0) <= 90).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Occupés
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {filteredUsers.filter(u => (u.workload || 0) > 90).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Surchargés
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Liste des utilisateurs */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {filteredUsers.map((user) => (
          <Box>
            <Card 
              sx={{ 
                height: '100%',
                border: (user.workload || 0) > 90 ? 2 : 1,
                borderColor: (user.workload || 0) > 90 ? 'error.main' : 'divider'
              }}
            >
              <CardContent>
                {/* En-tête utilisateur */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3">
                      {user.displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                </Box>

                {/* Rôle et département */}
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={simpleUserService.getRoleLabel(user.role)}
                    size="small"
                    color={simpleUserService.getRoleColor(user.role)}
                  />
                  <Chip
                    label={user.department}
                    size="small"
                    variant="outlined"
                  />
                </Stack>

                {/* Charge de travail */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Charge de travail
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {user.workload || 0}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={user.workload || 0}
                    color={simpleUserService.getWorkloadColor(user.workload || 0)}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {simpleUserService.getAvailabilityStatus(user.workload || 0)}
                  </Typography>
                </Box>

                {/* Compétences avec étoiles */}
                {renderSkillsWithStars(user)}

                {/* Boutons d'action */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Dernière màj: {new Date().toLocaleDateString()}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<SkillIcon />}
                    onClick={() => handleOpenSkillEditor(user)}
                    variant="outlined"
                  >
                    Compétences
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Message si aucun résultat */}
      {filteredUsers.length === 0 && users.length > 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            Aucun utilisateur ne correspond aux critères de recherche.
          </Typography>
        </Alert>
      )}

      {/* Éditeur de compétences */}
      {selectedUser && (
        <SkillEditor
          open={skillEditorOpen}
          onClose={handleCloseSkillEditor}
          onSave={handleSaveSkills}
          user={selectedUser as any} // Conversion temporaire
          initialSkills={selectedUser.skills || []}
        />
      )}
    </Box>
  );
};

export default SimpleResources;