import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Switch,
  Alert,
  Divider,
  Chip,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Home as RemoteIcon,
  Business as OfficeIcon,
  Close as CloseIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
  Restore as ResetIcon
} from '@mui/icons-material';
import {
  UserTeleworkProfile,
  TeleworkMode,
  WeekdayPattern,
  WeekdayKey,
  WEEKDAY_LABELS,
  MODE_LABELS,
  TeleworkDayResolution
} from '../../types/telework.types';
import { teleworkServiceV2 } from '../../services/telework-v2.service';
import { teleworkResolverService } from '../../services/telework-resolver.service';
import { addDays, startOfWeek, endOfWeek } from 'date-fns';

interface TeleworkProfileModalProps {
  isOpen: boolean;
  userId: string;
  currentProfile?: UserTeleworkProfile | null;
  onClose: () => void;
  onSave: (profile: UserTeleworkProfile) => void;
}

export const TeleworkProfileModal: React.FC<TeleworkProfileModalProps> = ({
  isOpen,
  userId,
  currentProfile,
  onClose,
  onSave
}) => {
  const [profile, setProfile] = useState<Partial<UserTeleworkProfile>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    current: TeleworkDayResolution[];
    preview: TeleworkDayResolution[];
    changes: number;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // =============================================
  // INITIALIZATION
  // =============================================

  useEffect(() => {
    if (isOpen && currentProfile) {
      setProfile({ ...currentProfile });
    } else if (isOpen && !currentProfile) {
      // Créer un profil par défaut
      setProfile({
        defaultMode: 'office',
        weeklyPattern: {
          monday: 'default',
          tuesday: 'default',
          wednesday: 'default',
          thursday: 'default',
          friday: 'default',
          saturday: 'default',
          sunday: 'default'
        },
        constraints: {
          maxRemoteDaysPerWeek: 2,
          maxConsecutiveRemoteDays: 2,
          requiresApproval: false
        }
      });
    }
  }, [isOpen, currentProfile]);

  // =============================================
  // HANDLERS
  // =============================================

  const handleDefaultModeChange = (mode: TeleworkMode) => {
    setProfile(prev => ({
      ...prev,
      defaultMode: mode
    }));
  };

  const handleWeekdayPatternChange = (day: WeekdayKey, pattern: WeekdayPattern) => {
    setProfile(prev => ({
      ...prev,
      weeklyPattern: {
        ...prev.weeklyPattern,
        [day]: pattern
      } as UserTeleworkProfile['weeklyPattern']
    }));
  };

  const handleConstraintChange = (field: string, value: number | boolean) => {
    setProfile(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [field]: value
      } as UserTeleworkProfile['constraints']
    }));
  };

  const handlePreview = async () => {
    if (!profile.weeklyPattern) return;

    setLoading(true);
    try {
      const nextWeek = addDays(new Date(), 7);
      const weekStart = startOfWeek(nextWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const previewData = await teleworkResolverService.previewPatternChange(
        userId,
        profile.weeklyPattern,
        weekStart,
        weekEnd
      );

      setPreview(previewData);
      setShowPreview(true);
    } catch (error) {
      console.error('Erreur lors de la prévisualisation:', error);
      setErrors(['Erreur lors de la prévisualisation']);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.defaultMode || !profile.weeklyPattern || !profile.constraints) {
      setErrors(['Tous les champs sont requis']);
      return;
    }

    // Validation
    const validationErrors = validateProfile();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      let savedProfile: UserTeleworkProfile;

      if (currentProfile) {
        // Mise à jour
        await teleworkServiceV2.updateUserProfile(userId, profile, userId);
        savedProfile = { ...currentProfile, ...profile } as UserTeleworkProfile;
      } else {
        // Création
        const displayName = profile.displayName || 'Utilisateur';
        savedProfile = await teleworkServiceV2.createDefaultProfile(userId, displayName, userId);
        await teleworkServiceV2.updateUserProfile(userId, profile, userId);
        savedProfile = { ...savedProfile, ...profile } as UserTeleworkProfile;
      }

      onSave(savedProfile);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setErrors(['Erreur lors de la sauvegarde du profil']);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (currentProfile) {
      setProfile({ ...currentProfile });
    }
    setErrors([]);
    setPreview(null);
    setShowPreview(false);
  };

  // =============================================
  // VALIDATION
  // =============================================

  const validateProfile = (): string[] => {
    const errors: string[] = [];

    if (!profile.constraints) return ['Contraintes manquantes'];

    // Validation des contraintes
    if (profile.constraints.maxRemoteDaysPerWeek < 0 || profile.constraints.maxRemoteDaysPerWeek > 7) {
      errors.push('Le nombre max de jours télétravail/semaine doit être entre 0 et 7');
    }

    if (profile.constraints.maxConsecutiveRemoteDays < 1 || profile.constraints.maxConsecutiveRemoteDays > 7) {
      errors.push('Le nombre max de jours télétravail consécutifs doit être entre 1 et 7');
    }

    // Validation de cohérence pattern
    if (profile.weeklyPattern) {
      const remoteDaysInPattern = Object.values(profile.weeklyPattern).filter(
        day => day === 'remote'
      ).length;

      if (remoteDaysInPattern > (profile.constraints.maxRemoteDaysPerWeek || 0)) {
        errors.push(
          `Votre pattern hebdomadaire contient ${remoteDaysInPattern} jours de télétravail, ` +
          `mais votre limite est de ${profile.constraints.maxRemoteDaysPerWeek}`
        );
      }
    }

    return errors;
  };

  // =============================================
  // CALCULATORS
  // =============================================

  const calculateWeeklyRemoteDays = (): number => {
    if (!profile.weeklyPattern) return 0;

    return Object.values(profile.weeklyPattern).reduce((count, pattern) => {
      if (pattern === 'remote') return count + 1;
      if (pattern === 'default' && profile.defaultMode === 'remote') return count + 1;
      return count;
    }, 0);
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderDefaultModeSection = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Mode par défaut
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Définit votre mode de travail par défaut pour les jours non spécifiés
        </Typography>

        <FormControl>
          <RadioGroup
            value={profile.defaultMode || 'office'}
            onChange={(e) => handleDefaultModeChange(e.target.value as TeleworkMode)}
            row
          >
            <FormControlLabel
              value="office"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OfficeIcon />
                  <span>Bureau par défaut</span>
                </Box>
              }
            />
            <FormControlLabel
              value="remote"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RemoteIcon />
                  <span>Télétravail par défaut</span>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </CardContent>
    </Card>
  );

  const renderWeeklyPatternSection = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Planning type hebdomadaire
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configurez votre planning type pour chaque jour de la semaine
        </Typography>

        <Stack spacing={2}>
          {Object.entries(WEEKDAY_LABELS).map(([key, label]) => {
            const dayKey = key as WeekdayKey;
            const currentPattern = profile.weeklyPattern?.[dayKey] || 'default';

            return (
              <Box key={dayKey}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1" sx={{ minWidth: 100 }}>
                    {label}
                  </Typography>

                  <ToggleButtonGroup
                    value={currentPattern}
                    exclusive
                    onChange={(_, value) => value && handleWeekdayPatternChange(dayKey, value)}
                    size="small"
                  >
                    <ToggleButton value="office">
                      <OfficeIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Bureau
                    </ToggleButton>
                    <ToggleButton value="remote">
                      <RemoteIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Télétravail
                    </ToggleButton>
                    <ToggleButton value="default">
                      Par défaut
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Indicateur de mode effectif */}
                <Typography variant="caption" color="text.secondary" sx={{ ml: 12 }}>
                  {currentPattern === 'default'
                    ? `→ ${MODE_LABELS[profile.defaultMode || 'office']}`
                    : `→ ${MODE_LABELS[currentPattern as TeleworkMode]}`
                  }
                </Typography>
              </Box>
            );
          })}
        </Stack>

        {/* Résumé du pattern */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="body2">
            <strong>Résumé :</strong> {calculateWeeklyRemoteDays()} jours de télétravail par semaine
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  const renderConstraintsSection = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Contraintes et limites
        </Typography>

        <Stack spacing={3}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Max jours télétravail/semaine"
              type="number"
              value={profile.constraints?.maxRemoteDaysPerWeek || 2}
              onChange={(e) => handleConstraintChange('maxRemoteDaysPerWeek', parseInt(e.target.value))}
              inputProps={{ min: 0, max: 7 }}
              sx={{ flex: '1 1 200px', minWidth: 200 }}
              size="small"
            />
            <TextField
              label="Max jours consécutifs"
              type="number"
              value={profile.constraints?.maxConsecutiveRemoteDays || 2}
              onChange={(e) => handleConstraintChange('maxConsecutiveRemoteDays', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 7 }}
              sx={{ flex: '1 1 200px', minWidth: 200 }}
              size="small"
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={profile.constraints?.requiresApproval || false}
                onChange={(e) => handleConstraintChange('requiresApproval', e.target.checked)}
              />
            }
            label="Demandes nécessitent une approbation manager"
          />
        </Stack>
      </CardContent>
    </Card>
  );

  const renderPreviewSection = () => {
    if (!showPreview || !preview) return null;

    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Aperçu des changements (semaine prochaine)
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            {preview.changes} jour(s) de changement(s) détecté(s)
          </Alert>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Planning actuel
              </Typography>
              <Stack spacing={1}>
                {preview.current.map((day, index) => (
                  <Chip
                    key={index}
                    label={`${WEEKDAY_LABELS[Object.keys(WEEKDAY_LABELS)[day.date.getDay()] as WeekdayKey]}: ${MODE_LABELS[day.resolvedMode]}`}
                    size="small"
                    color={day.resolvedMode === 'remote' ? 'primary' : 'default'}
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Nouveau planning
              </Typography>
              <Stack spacing={1}>
                {preview.preview.map((day, index) => (
                  <Chip
                    key={index}
                    label={`${WEEKDAY_LABELS[Object.keys(WEEKDAY_LABELS)[day.date.getDay()] as WeekdayKey]}: ${MODE_LABELS[day.resolvedMode]}`}
                    size="small"
                    color={day.resolvedMode === 'remote' ? 'primary' : 'default'}
                    variant={preview.current[index]?.resolvedMode !== day.resolvedMode ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Configuration télétravail
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Messages d'erreur */}
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Loading indicator */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Sections du formulaire */}
        {renderDefaultModeSection()}
        {renderWeeklyPatternSection()}
        {renderConstraintsSection()}
        {renderPreviewSection()}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={handleReset}
          startIcon={<ResetIcon />}
          disabled={saving}
        >
          Réinitialiser
        </Button>

        <Button
          onClick={handlePreview}
          startIcon={<PreviewIcon />}
          disabled={loading || saving}
          variant="outlined"
        >
          Prévisualiser
        </Button>

        <Box sx={{ flex: 1 }} />

        <Button
          onClick={onClose}
          disabled={saving}
        >
          Annuler
        </Button>

        <Button
          onClick={handleSave}
          startIcon={<SaveIcon />}
          variant="contained"
          disabled={loading || saving}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeleworkProfileModal;