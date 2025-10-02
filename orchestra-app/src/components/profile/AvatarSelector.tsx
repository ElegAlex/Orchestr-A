import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Avatar,
  Grid,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import {
  Upload as UploadIcon,
  PhotoLibrary as GalleryIcon,
  Shuffle as RandomIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { User } from '../../types';
import { profileService } from '../../services/profile.service';
import { avatarService, GeneratedAvatar } from '../../services/avatar.service';

interface AvatarSelectorProps {
  open: boolean;
  onClose: () => void;
  user: User;
  onAvatarSelected: (avatarUrl: string) => void;
}

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
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  open,
  onClose,
  user,
  onAvatarSelected
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAvatars, setGeneratedAvatars] = useState<GeneratedAvatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && tabValue === 1) {
      generateAvatars();
    }
  }, [open, tabValue]);

  const generateAvatars = () => {
    const avatars = avatarService.generateAvatarCollection(
      user.firstName || 'User',
      user.lastName || 'Name',
      12
    );
    setGeneratedAvatars(avatars);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(true);
      setError(null);

      // Valider le fichier
      const validation = profileService.validateAvatarFile(file);
      if (!validation.isValid) {
        setError(validation.error!);
        return;
      }

      // Redimensionner l'image
      const resizedFile = await profileService.resizeImage(file, 400, 400);

      // Upload vers Firebase Storage
      const avatarUrl = await profileService.uploadAvatar(user.id, resizedFile);

      setSelectedAvatar(avatarUrl);
      setError(null);

    } catch (error: any) {
      setError(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploadProgress(false);
      // Reset l'input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGeneratedAvatarSelect = async (avatar: GeneratedAvatar) => {
    try {
      setLoading(true);
      setError(null);

      // Si c'est un SVG, le convertir en PNG avant de l'utiliser
      if (avatar.url.includes('.svg') || avatar.url.includes('format=svg')) {
        const pngFile = await avatarService.convertSvgToPng(avatar.url, 400);
        const uploadedUrl = await profileService.uploadAvatar(user.id, pngFile);
        setSelectedAvatar(uploadedUrl);
      } else {
        // Pour les PNG, utiliser directement l'URL
        setSelectedAvatar(avatar.url);
      }

    } catch (error: any) {
      setError(error.message || 'Erreur lors de la sélection de l\'avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setLoading(true);

      // Supprimer l'avatar actuel
      await profileService.deleteAvatar(user.id, user.avatarUrl);

      setSelectedAvatar('');
      setError(null);
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (selectedAvatar !== null) {
      onAvatarSelected(selectedAvatar);
    }
    onClose();
  };

  const handleClose = () => {
    setSelectedAvatar(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Choisir un Avatar
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Preview de l'avatar sélectionné */}
        {selectedAvatar !== null && (
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Aperçu de votre nouvel avatar :
            </Typography>
            <Avatar
              src={selectedAvatar}
              sx={{ width: 100, height: 100, mx: 'auto', mb: 1 }}
            >
              {user.firstName[0]}{user.lastName[0]}
            </Avatar>
          </Box>
        )}

        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Upload Personnalisé" icon={<UploadIcon />} />
          <Tab label="Avatars Générés" icon={<GalleryIcon />} />
          <Tab label="Actions" icon={<DeleteIcon />} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <UploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />

              <Typography variant="h6" gutterBottom>
                Télécharger votre propre image
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Formats acceptés : JPG, PNG, WebP • Taille max : 5MB
              </Typography>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <Button
                variant="contained"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProgress}
                size="large"
                startIcon={uploadProgress ? <CircularProgress size={20} /> : <UploadIcon />}
              >
                {uploadProgress ? 'Upload en cours...' : 'Choisir une image'}
              </Button>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Avatars générés automatiquement
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={generateAvatars}
              variant="outlined"
              size="small"
            >
              Régénérer
            </Button>
          </Box>

          {generatedAvatars.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Génération des avatars...
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 2 }}>
              {generatedAvatars.map((avatar) => (
                <Box key={avatar.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 4,
                        transform: 'translateY(-2px)'
                      },
                      border: selectedAvatar === avatar.url ? 2 : 0,
                      borderColor: 'primary.main'
                    }}
                    onClick={() => handleGeneratedAvatarSelect(avatar)}
                  >
                    <CardContent sx={{ p: 1, textAlign: 'center' }}>
                      <Avatar
                        src={avatar.url}
                        sx={{ width: 60, height: 60, mx: 'auto', mb: 1 }}
                      >
                        {user.firstName[0]}{user.lastName[0]}
                      </Avatar>
                      <Chip
                        label={avatar.provider === 'dicebear' ? avatar.style : 'Initiales'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Gestion de l'Avatar
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Avatar actuel
              </Typography>
              <Avatar
                src={user.avatarUrl}
                sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}
              >
                {user.firstName[0]}{user.lastName[0]}
              </Avatar>
            </Box>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRemoveAvatar}
              disabled={loading || !user.avatarUrl}
            >
              {loading ? <CircularProgress size={20} /> : 'Supprimer l\'avatar'}
            </Button>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              La suppression de l'avatar restaurera l'avatar par défaut basé sur vos initiales.
            </Typography>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={selectedAvatar === null || loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Confirmer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};