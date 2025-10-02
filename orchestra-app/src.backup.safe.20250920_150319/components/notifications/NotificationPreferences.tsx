import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Box,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  NotificationPreferences,
} from '../../services/realtime-notification.service';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../NotificationProvider';

interface NotificationPreferencesDialogProps {
  open: boolean;
  onClose: () => void;
}

const NotificationPreferencesDialog: React.FC<NotificationPreferencesDialogProps> = ({
  open,
  onClose,
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: user?.id || '',
    channels: {
      inApp: true,
      email: false,
      sms: false,
      push: true,
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
    weekendMode: false,
    frequency: 'immediate',
    grouping: true,
    preview: true,
    sound: true,
    vibrate: true,
    email: false,
    push: true,
    inApp: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      loadPreferences();
    }
  }, [open, user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    
    try {
      // Simuler le chargement des préférences
      console.log('Loading preferences for user:', user.id);
    } catch (error) {
      
      showError('Erreur lors du chargement des préférences');
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Simuler la sauvegarde
      console.log('Saving preferences:', preferences);
      showSuccess('Préférences sauvegardées avec succès');
      onClose();
    } catch (error) {
      
      showError('Erreur lors de la sauvegarde');
    }
    setLoading(false);
  };

  const handleChannelChange = (channel: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: enabled,
      },
    }));
  };

  const handleQuietHoursChange = (field: keyof NotificationPreferences['quietHours'], value: any) => {
    setPreferences(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [field]: value,
      },
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">
          Préférences de notifications
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ overflow: 'auto' }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Configurez vos préférences de notification selon vos besoins.
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Canaux de notification
          </Typography>
          <FormGroup>
            {Object.entries(preferences.channels).map(([channel, enabled]) => (
              <FormControlLabel
                key={channel}
                control={
                  <Switch
                    checked={enabled}
                    onChange={(e) => handleChannelChange(channel, e.target.checked)}
                  />
                }
                label={channel === 'inApp' ? 'Application' : channel.charAt(0).toUpperCase() + channel.slice(1)}
              />
            ))}
          </FormGroup>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Heures de silence
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.quietHours.enabled}
                onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
              />
            }
            label="Activer les heures de silence"
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.weekendMode}
                onChange={(e) => setPreferences(prev => ({ ...prev, weekendMode: e.target.checked }))}
              />
            }
            label="Mode week-end"
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.grouping}
                onChange={(e) => setPreferences(prev => ({ ...prev, grouping: e.target.checked }))}
              />
            }
            label="Grouper les notifications"
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationPreferencesDialog;