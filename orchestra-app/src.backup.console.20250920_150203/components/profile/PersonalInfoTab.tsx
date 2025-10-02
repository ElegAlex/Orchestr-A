import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  IconButton,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import {
  PhotoCamera as PhotoIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { User } from '../../types';
import { profileService, UpdateProfileData } from '../../services/profile.service';
import { AvatarSelector } from './AvatarSelector';

interface PersonalInfoTabProps {
  user: User;
  onUpdate?: () => void;
}

export const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({ user, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const [formData, setFormData] = useState<UpdateProfileData>({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: user.displayName || '',
    department: user.department || ''
  });

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const updateData: UpdateProfileData = {
        ...formData,
        displayName: `${formData.firstName} ${formData.lastName}`
      };

      await profileService.updateProfile(user.id, updateData);

      setSuccess('Profil mis à jour avec succès');
      setEditing(false);

      // Rafraîchir les données parent
      if (onUpdate) {
        setTimeout(onUpdate, 1000);
      }

    } catch (error: any) {
      setError(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      displayName: user.displayName || '',
      department: user.department || ''
    });
    setEditing(false);
    setError(null);
  };

  const handleAvatarChange = async (newAvatarUrl: string) => {
    try {
      setLoading(true);
      await profileService.updateProfile(user.id, { avatarUrl: newAvatarUrl });
      setSuccess('Avatar mis à jour avec succès');

      if (onUpdate) {
        setTimeout(onUpdate, 1000);
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la mise à jour de l\'avatar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon />
        Informations Personnelles
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Section Avatar */}
        <Box sx={{ flex: '0 0 300px' }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom>
                Photo de Profil
              </Typography>

              <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                <Avatar
                  src={user.avatarUrl}
                  sx={{
                    width: 150,
                    height: 150,
                    border: 4,
                    borderColor: 'background.paper',
                    boxShadow: 3,
                    fontSize: 60,
                    fontWeight: 'bold'
                  }}
                >
                  {user.firstName[0]}{user.lastName[0]}
                </Avatar>

                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                  onClick={() => setAvatarDialogOpen(true)}
                >
                  <PhotoIcon />
                </IconButton>
              </Box>

              <Button
                variant="outlined"
                startIcon={<PhotoIcon />}
                onClick={() => setAvatarDialogOpen(true)}
                disabled={loading}
                fullWidth
              >
                Changer d'avatar
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* Section Informations */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Détails du Profil
                </Typography>

                {!editing ? (
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => setEditing(true)}
                    variant="outlined"
                  >
                    Modifier
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      variant="contained"
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={20} /> : 'Sauvegarder'}
                    </Button>
                    <Button
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      variant="outlined"
                      disabled={loading}
                    >
                      Annuler
                    </Button>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Box>
                  <TextField
                    label="Prénom"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    disabled={!editing || loading}
                    fullWidth
                    required
                  />
                </Box>

                <Box>
                  <TextField
                    label="Nom"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    disabled={!editing || loading}
                    fullWidth
                    required
                  />
                </Box>

                <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                  <TextField
                    label="Email"
                    value={user.email}
                    disabled
                    fullWidth
                    helperText="L'email ne peut pas être modifié depuis cette interface"
                  />
                </Box>

                <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                  <TextField
                    label="Département"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    disabled={!editing || loading}
                    fullWidth
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Informations en lecture seule */}
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Informations Système
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Rôle
                    </Typography>
                    <Chip
                      label={user.role}
                      color="primary"
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                </Box>

                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Statut
                    </Typography>
                    <Chip
                      label={user.isActive ? 'Actif' : 'Inactif'}
                      color={user.isActive ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Compte créé le
                  </Typography>
                  <Typography variant="body1">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'Non défini'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Dernière connexion
                  </Typography>
                  <Typography variant="body1">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Dialog Avatar Selector */}
      <AvatarSelector
        open={avatarDialogOpen}
        onClose={() => setAvatarDialogOpen(false)}
        user={user}
        onAvatarSelected={handleAvatarChange}
      />
    </Box>
  );
};