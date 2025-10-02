import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stack,
  IconButton,
  Menu,
  LinearProgress,
  Alert,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { Project, User, TeamMember } from '../../types';
import { getRoleDisplayLabel } from '../../utils/roleUtils';
import { userService } from '../../services/user.service';
import { projectService } from '../../services/project.service';
import { resourceService } from '../../services/resource.service';
import { Timestamp } from 'firebase/firestore';

interface ProjectTeamProps {
  project: Project;
  onRefresh: () => void;
}

const ProjectTeam: React.FC<ProjectTeamProps> = ({ project, onRefresh }) => {
  const [teamMembers, setTeamMembers] = useState<(User & { role: string; allocation: number; originalUserId?: string; isDeleted?: boolean })[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  // Plus besoin de rôle pour les membres d'équipe
  const [memberAllocation, setMemberAllocation] = useState<number>(100);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    loadTeamData();
  }, [project]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      
      // Charger les membres actuels de l'équipe
      if (project.teamMembers && project.teamMembers.length > 0) {
        const members = await Promise.all(
          project.teamMembers.map(async (member) => {
            try {
              const user = await userService.getUser(member.userId);
              // Récupérer les compétences via le service dédié (comme dans Resources)
              const userSkills = await resourceService.getUserSkills(member.userId);
              return {
                ...user,
                skills: userSkills, // Remplacer par les compétences du service dédié
                role: member.role,
                allocation: member.allocationPercentage,
                originalUserId: member.userId // Référence pour la suppression
              };
            } catch (error) {
              
              // Créer un membre "fantôme" pour les comptes supprimés
              return {
                id: member.userId, // L'id du membre fantôme = userId du TeamMember
                displayName: 'Utilisateur supprimé',
                firstName: 'Utilisateur',
                lastName: 'supprimé',
                email: 'utilisateur.supprime@example.com',
                role: member.role,
                allocation: member.allocationPercentage,
                avatarUrl: '',
                department: '',
                isDeleted: true, // Flag pour identifier les membres legacy
                originalUserId: member.userId // Garder référence pour la suppression
              };
            }
          })
        );
        setTeamMembers(members as any[]);
      }

      // Charger tous les utilisateurs disponibles
      const users = await userService.getAllUsers();
      const currentMemberIds = project.teamMembers?.map(m => m.userId) || [];
      setAvailableUsers(users.filter(user => !currentMemberIds.includes(user.id)));
      
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser) return;

    try {
      const newMember: TeamMember = {
        userId: selectedUser,
        role: 'member',
        allocationPercentage: memberAllocation,
        startDate: new Date(),
      };

      const updatedProject = {
        ...project,
        teamMembers: [...(project.teamMembers || []), newMember],
        updatedAt: Timestamp.now(),
      };

      // Nettoyer les valeurs undefined pour Firebase
      const cleanProject = Object.fromEntries(
        Object.entries(updatedProject).filter(([_, value]) => value !== undefined)
      );

      await projectService.updateProject(project.id, cleanProject);
      onRefresh();
      
      setAddMemberOpen(false);
      setSelectedUser('');
      setMemberAllocation(100);
    } catch (error) {
      
    }
  };

  const handleEditMember = async () => {
    if (!selectedMember) return;

    try {
      const updatedTeamMembers = project.teamMembers?.map(member =>
        member.userId === selectedMember.userId
          ? { ...member, allocationPercentage: memberAllocation }
          : member
      );

      const updatedProject = {
        ...project,
        teamMembers: updatedTeamMembers,
        updatedAt: Timestamp.now(),
      };

      // Nettoyer les valeurs undefined pour Firebase
      const cleanProject = Object.fromEntries(
        Object.entries(updatedProject).filter(([_, value]) => value !== undefined)
      );

      await projectService.updateProject(project.id, cleanProject);
      onRefresh();
      
      setEditMemberOpen(false);
      setSelectedMember(null);
    } catch (error) {
      
    }
  };

  const handleRemoveMember = async (memberDisplayId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir retirer ce membre de l\'équipe ?')) {
      try {

        // Trouver le member dans teamMembers pour récupérer son originalUserId
        const memberToRemove = teamMembers.find(m => m.id === memberDisplayId);

        const userIdToRemove = memberToRemove?.originalUserId || memberDisplayId;

        const updatedTeamMembers = project.teamMembers?.filter(
          member => member.userId !== userIdToRemove
        );

        const updatedProject = {
          ...project,
          teamMembers: updatedTeamMembers,
          updatedAt: Timestamp.now(),
        };

        // Nettoyer les valeurs undefined pour Firebase
        const cleanProject = Object.fromEntries(
          Object.entries(updatedProject).filter(([_, value]) => value !== undefined)
        );

        await projectService.updateProject(project.id, cleanProject);
        onRefresh();
      } catch (error) {
        
      }
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, memberId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedMemberId(memberId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMemberId(null);
  };

  const openEditDialog = () => {
    const member = project.teamMembers?.find(m => m.userId === selectedMemberId);
    if (member) {
      setSelectedMember(member);
      setMemberAllocation(member.allocationPercentage);
      setEditMemberOpen(true);
    }
    handleMenuClose();
  };

  // Fonctions de rôles supprimées - plus besoin avec le système RACI par tâche

  const handleCleanupTeam = async () => {
    if (!window.confirm('Nettoyer les données d\'équipe ? Cela supprimera tous les membres avec des comptes utilisateurs supprimés ou invalides.')) {
      return;
    }

    try {
      setLoading(true);

      // Garder seulement les membres avec des comptes utilisateurs valides
      const validMembers = [];

      if (project.teamMembers && project.teamMembers.length > 0) {
        for (const member of project.teamMembers) {
          try {
            await userService.getUser(member.userId);
            validMembers.push(member);
          } catch (error) {
            console.log(`Suppression du membre invalide: ${member.userId}`);
          }
        }
      }

      const updatedProject = {
        ...project,
        teamMembers: validMembers,
        updatedAt: Timestamp.now(),
      };

      const cleanProject = Object.fromEntries(
        Object.entries(updatedProject).filter(([_, value]) => value !== undefined)
      );

      await projectService.updateProject(project.id, cleanProject);
      onRefresh();

      const removedCount = (project.teamMembers?.length || 0) - validMembers.length;
      if (removedCount > 0) {
        alert(`Nettoyage terminé. ${removedCount} membre(s) invalide(s) supprimé(s).`);
      } else {
        alert('Aucun membre invalide trouvé.');
      }

    } catch (error) {
      
      alert('Erreur lors du nettoyage de l\'équipe.');
    } finally {
      setLoading(false);
    }
  };

  const getAllocationColor = (allocation: number) => {
    if (allocation >= 100) return 'error';
    if (allocation >= 80) return 'warning';
    if (allocation >= 50) return 'info';
    return 'success';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Équipe du projet ({teamMembers.length} membre{teamMembers.length !== 1 ? 's' : ''})
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleCleanupTeam}
            size="small"
          >
            Nettoyer données
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setAddMemberOpen(true)}
            disabled={availableUsers.length === 0}
          >
            Ajouter un membre
          </Button>
        </Stack>
      </Box>

      {/* Liste des membres - Format ligne */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {teamMembers.map((member, index) => (
          <Card
            key={`member-${index}-${member.id}`}
            sx={{
              width: '100%',
              '&:hover': {
                boxShadow: (theme) => theme.shadows[4],
                transform: 'translateX(2px)',
                transition: 'all 0.2s ease-in-out'
              }
            }}
          >
            <CardContent sx={{ py: 2 }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                minHeight: 64 // Hauteur fixe pour homogénéité
              }}>
                {/* Avatar et infos principales */}
                <Box sx={{
                  flex: '0 0 280px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  height: 64 // Hauteur fixe
                }}>
                  <Avatar
                    src={member.avatarUrl}
                    sx={{
                      width: 48,
                      height: 48,
                      backgroundColor: member.isDeleted ? 'error.main' : 'primary.main',
                      flexShrink: 0
                    }}
                  >
                    {member.firstName?.[0]}{member.lastName?.[0]}
                  </Avatar>
                  <Box sx={{
                    minWidth: 0,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    height: '100%'
                  }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.2,
                        mb: 0.25
                      }}
                      color={member.isDeleted ? 'error.main' : 'inherit'}
                      noWrap
                    >
                      {member.displayName}
                      {member.isDeleted && ' (Supprimé)'}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ lineHeight: 1.1 }}
                    >
                      {member.email}
                    </Typography>
                    {member.department && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ lineHeight: 1.1, mt: 0.25 }}
                      >
                        {member.department}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Allocation */}
                <Box sx={{
                  flex: '0 0 200px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  height: 64 // Hauteur fixe
                }}>
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      Allocation
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {member.allocation}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(member.allocation, 100)}
                    color={getAllocationColor(member.allocation)}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                {/* Compétences */}
                <Box sx={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  height: 64 // Hauteur fixe
                }}>
                  {member.skills && member.skills.length > 0 ? (
                    <Box sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      alignItems: 'center'
                    }}>
                      {member.skills.slice(0, 4).map((skill, index) => (
                        <Chip
                          key={index}
                          label={skill.name}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                      ))}
                      {member.skills.length > 4 && (
                        <Chip
                          label={`+${member.skills.length - 4}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                      )}
                    </Box>
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontStyle: 'italic' }}
                    >
                      Aucune compétence renseignée
                    </Typography>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{
                  flex: '0 0 auto',
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  height: 64 // Hauteur fixe
                }}>
                  <Chip
                    label={`${member.allocation}%`}
                    size="small"
                    color={getAllocationColor(member.allocation)}
                    sx={{ minWidth: 'auto' }}
                  />
                  <Tooltip title="Envoyer un email">
                    <IconButton size="small" href={`mailto:${member.email}`}>
                      <EmailIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuClick(e, member.id)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {teamMembers.length === 0 && (
        <Alert severity="info">
          Aucun membre dans l'équipe. Ajoutez des membres pour commencer !
        </Alert>
      )}

      {/* Dialog d'ajout de membre */}
      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un membre à l'équipe</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Utilisateur</InputLabel>
              <Select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                label="Utilisateur"
              >
                {availableUsers.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar src={user.avatarUrl} sx={{ width: 32, height: 32 }}>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">{user.displayName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.department} • {getRoleDisplayLabel(user.role)}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Plus de sélection de rôle - les assignations RACI se font maintenant par tâche */}

            <TextField
              fullWidth
              type="number"
              label="Allocation (%)"
              value={memberAllocation}
              onChange={(e) => setMemberAllocation(Number(e.target.value))}
              inputProps={{ min: 1, max: 150 }}
              helperText="Pourcentage de temps alloué au projet"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleAddMember} 
            variant="contained"
            disabled={!selectedUser}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'édition de membre */}
      <Dialog open={editMemberOpen} onClose={() => setEditMemberOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier le membre</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Plus de sélection de rôle - les assignations RACI se font maintenant par tâche */}

            <TextField
              fullWidth
              type="number"
              label="Allocation (%)"
              value={memberAllocation}
              onChange={(e) => setMemberAllocation(Number(e.target.value))}
              inputProps={{ min: 1, max: 150 }}
              helperText="Pourcentage de temps alloué au projet"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditMemberOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleEditMember} 
            variant="contained"
          >
            Modifier
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu contextuël */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={openEditDialog}>
          <EditIcon sx={{ mr: 1 }} />
          Modifier
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedMemberId) {
              handleRemoveMember(selectedMemberId);
            }
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Retirer de l'équipe
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ProjectTeam;