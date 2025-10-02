import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette as ThemeIcon,
  Language as LanguageIcon,
  Schedule as TimezoneIcon,
  Notifications as NotificationsIcon,
  Dashboard as DashboardIcon,
  Save as SaveIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  BrightnessAuto as AutoIcon
} from '@mui/icons-material';
import { User, UserPreferences } from '../../types';
import { profileService } from '../../services/profile.service';

interface PreferencesTabProps {
  user: User;
  onUpdate?: () => void;
}

export const PreferencesTab: React.FC<PreferencesTabProps> = ({ user, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentPreferences: UserPreferences = user.preferences || {
    theme: 'auto' as const,
    language: 'fr',
    timezone: 'Europe/Paris',
    emailNotifications: true,
    pushNotifications: false,
    dashboardLayout: ['stats', 'tasks', 'projects', 'calendar'],
    maxProjectsParallel: 3,
    notificationFrequency: 'realtime' as const
  };

  const [preferences, setPreferences] = useState<UserPreferences>(currentPreferences);

  const themes = [
    { value: 'light', label: 'Clair', icon: <LightIcon /> },
    { value: 'dark', label: 'Sombre', icon: <DarkIcon /> },
    { value: 'auto', label: 'Automatique', icon: <AutoIcon /> }
  ];

  const languages = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'es', label: 'Español', flag: '🇪🇸' }
  ];

  const timezones = [
    { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
    { value: 'Europe/London', label: 'Londres (UTC+0/+1)' },
    { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' }
  ];

  const dashboardWidgets = [
    { id: 'stats', label: 'Statistiques', icon: '📊' },
    { id: 'tasks', label: 'Mes Tâches', icon: '✅' },
    { id: 'projects', label: 'Mes Projets', icon: '📁' },
    { id: 'calendar', label: 'Calendrier', icon: '📅' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'activity', label: 'Activité Récente', icon: '⚡' }
  ];

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      await profileService.updatePreferences(user.id, preferences);

      setSuccess('Préférences mises à jour avec succès');

      // Rafraîchir les données parent
      if (onUpdate) {
        setTimeout(onUpdate, 1000);
      }

      // Appliquer le thème immédiatement (à implémenter dans l'application)
      if (preferences.theme !== currentPreferences.theme) {
        // Logique d'application du thème
        document.documentElement.setAttribute('data-theme', preferences.theme || 'auto');
      }

    } catch (error: any) {
      setError(error.message || 'Erreur lors de la mise à jour des préférences');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(currentPreferences);

  const handleDashboardLayoutChange = (widgetId: string, enabled: boolean) => {
    const currentLayout = preferences.dashboardLayout || [];

    if (enabled && !currentLayout.includes(widgetId)) {
      setPreferences({
        ...preferences,
        dashboardLayout: [...currentLayout, widgetId]
      });
    } else if (!enabled && currentLayout.includes(widgetId)) {
      setPreferences({
        ...preferences,
        dashboardLayout: currentLayout.filter(id => id !== widgetId)
      });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Préférences
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Apparence */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ThemeIcon />
                Apparence
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Thème</InputLabel>
                <Select
                  value={preferences.theme || 'auto'}
                  onChange={(e) => setPreferences({ ...preferences, theme: e.target.value as any })}
                  disabled={loading}
                >
                  {themes.map((theme) => (
                    <MenuItem key={theme.value} value={theme.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {theme.icon}
                        {theme.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="body2" color="text.secondary">
                Le thème automatique s'adapte aux préférences de votre système
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Localisation */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LanguageIcon />
                Localisation
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Langue</InputLabel>
                <Select
                  value={preferences.language || 'fr'}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                  disabled={loading}
                >
                  {languages.map((lang) => (
                    <MenuItem key={lang.value} value={lang.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{lang.flag}</span>
                        {lang.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Fuseau horaire</InputLabel>
                <Select
                  value={preferences.timezone || 'Europe/Paris'}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                  disabled={loading}
                >
                  {timezones.map((tz) => (
                    <MenuItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Box>

        {/* Notifications */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsIcon />
                Notifications
              </Typography>

              <List>
                <ListItem>
                  <ListItemIcon>
                    📧
                  </ListItemIcon>
                  <ListItemText
                    primary="Notifications par email"
                    secondary="Recevez les notifications importantes par email"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={preferences.emailNotifications !== false}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        emailNotifications: e.target.checked
                      })}
                      disabled={loading}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    🔔
                  </ListItemIcon>
                  <ListItemText
                    primary="Notifications push"
                    secondary="Notifications dans votre navigateur"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={preferences.pushNotifications === true}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        pushNotifications: e.target.checked
                      })}
                      disabled={loading}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>

        {/* Layout du Dashboard */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DashboardIcon />
                Dashboard
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choisissez les widgets à afficher sur votre dashboard
              </Typography>

              <List>
                {dashboardWidgets.map((widget) => {
                  const isEnabled = (preferences.dashboardLayout || []).includes(widget.id);

                  return (
                    <ListItem key={widget.id}>
                      <ListItemIcon>
                        <span style={{ fontSize: '1.2rem' }}>{widget.icon}</span>
                      </ListItemIcon>
                      <ListItemText
                        primary={widget.label}
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={isEnabled}
                          onChange={(e) => handleDashboardLayoutChange(widget.id, e.target.checked)}
                          disabled={loading}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>

              <Typography variant="caption" color="text.secondary">
                Widgets actifs : {preferences.dashboardLayout?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Résumé des changements */}
      {hasChanges && (
        <Card sx={{ mt: 3, bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              🔄 Modifications en attente
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {preferences.theme !== currentPreferences.theme && (
                <Chip label="Thème" size="small" color="primary" />
              )}
              {preferences.language !== currentPreferences.language && (
                <Chip label="Langue" size="small" color="primary" />
              )}
              {preferences.timezone !== currentPreferences.timezone && (
                <Chip label="Fuseau horaire" size="small" color="primary" />
              )}
              {preferences.emailNotifications !== currentPreferences.emailNotifications && (
                <Chip label="Email" size="small" color="primary" />
              )}
              {preferences.pushNotifications !== currentPreferences.pushNotifications && (
                <Chip label="Notifications" size="small" color="primary" />
              )}
              {JSON.stringify(preferences.dashboardLayout) !== JSON.stringify(currentPreferences.dashboardLayout) && (
                <Chip label="Dashboard" size="small" color="primary" />
              )}
            </Box>

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
              size="large"
            >
              {loading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};