import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Close as CloseIcon,
  Home as RemoteIcon,
} from '@mui/icons-material';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeleworkOverride, UserTeleworkProfile } from '../../types/telework.types';
import { teleworkServiceV2 } from '../../services/telework-v2.service';

interface TeleworkBulkDeclarationModalProps {
  open: boolean;
  userId: string;
  userDisplayName: string;
  currentUserProfile?: UserTeleworkProfile | null;
  onClose: () => void;
  onSave: () => void;
}

export const TeleworkBulkDeclarationModal: React.FC<TeleworkBulkDeclarationModalProps> = ({
  open,
  userId,
  userDisplayName,
  currentUserProfile,
  onClose,
  onSave,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [allOverrides, setAllOverrides] = useState<TeleworkOverride[]>([]); // Tous les overrides chargés
  const [existingOverrides, setExistingOverrides] = useState<TeleworkOverride[]>([]); // Overrides du mois courant
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger tous les overrides au premier chargement (6 mois)
  useEffect(() => {
    if (open) {
      loadAllOverrides();
    }
  }, [open, userId]);

  // Mettre à jour les overrides du mois courant quand on change de mois ou que allOverrides change
  useEffect(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const monthOverrides = allOverrides.filter(o => {
      const date = o.date.toDate();
      return date >= start && date <= end;
    });
    setExistingOverrides(monthOverrides);
  }, [currentMonth, allOverrides]);

  const loadAllOverrides = async () => {
    setLoading(true);
    setError(null);
    try {
      // Charger 6 mois de données (3 mois avant, 3 mois après)
      const start = addMonths(startOfMonth(new Date()), -3);
      const end = addMonths(endOfMonth(new Date()), 3);
      const overrides = await teleworkServiceV2.getUserOverrides(userId, start, end);
      // Filtrer uniquement les overrides en mode 'remote'
      const remoteOverrides = overrides.filter(o => o.mode === 'remote');
      setAllOverrides(remoteOverrides);

      // Initialiser selectedDates avec les dates existantes
      const existingDates = remoteOverrides.map(o => o.date.toDate());
      setSelectedDates(existingDates);
    } catch (err) {
      console.error('Erreur chargement overrides:', err);
      setError('Erreur lors du chargement des jours déclarés');
    } finally {
      setLoading(false);
    }
  };

  // Reset sur fermeture
  useEffect(() => {
    if (!open) {
      setSelectedDates([]);
      setAllOverrides([]);
      setExistingOverrides([]);
      setCurrentMonth(new Date());
      setError(null);
    }
  }, [open]);

  // Navigation mois
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Gestion sélection de date
  const handleDateClick = (date: Date) => {
    // Vérifier si déjà sélectionné
    const isSelected = selectedDates.some(d => isSameDay(d, date));

    if (isSelected) {
      // Désélectionner (que ce soit un override existant ou une nouvelle sélection)
      const newSelected = selectedDates.filter(d => !isSameDay(d, date));
      setSelectedDates(newSelected);
    } else {
      // Sélectionner
      setSelectedDates([...selectedDates, date]);
    }
  };

  // Vérifier l'état d'une date
  const getDateStatus = (date: Date): 'existing' | 'selected' | 'none' => {
    const isInAllOverrides = allOverrides.some(o => isSameDay(o.date.toDate(), date));
    const isInSelected = selectedDates.some(d => isSameDay(d, date));

    if (isInAllOverrides && isInSelected) {
      // Override existant toujours sélectionné → vert
      return 'existing';
    }
    if (isInAllOverrides && !isInSelected) {
      // Override existant mais désélectionné → blanc (sera supprimé)
      return 'none';
    }
    if (!isInAllOverrides && isInSelected) {
      // Nouvelle sélection → bleu
      return 'selected';
    }
    // Ni override ni sélectionné → blanc
    return 'none';
  };

  // Générer les jours du calendrier
  const generateCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: fr });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: fr });
    return eachDayOfInterval({ start, end });
  };

  // Sauvegarder
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Dates à ajouter (nouvelles sélections)
      const datesToAdd = selectedDates.filter(date =>
        !allOverrides.some(o => isSameDay(o.date.toDate(), date))
      );

      // Dates à supprimer (overrides existants désélectionnés)
      const datesToRemove = allOverrides.filter(override => {
        const overrideDate = override.date.toDate();
        // Si l'override existe mais n'est pas dans selectedDates, le supprimer
        return !selectedDates.some(d => isSameDay(d, overrideDate));
      });

      // Créer les nouveaux overrides
      if (datesToAdd.length > 0) {
        await teleworkServiceV2.createBulkOverrides(
          userId,
          datesToAdd,
          'remote',
          userId,
          'Déclaration en masse'
        );
      }

      // Supprimer les overrides désélectionnés
      for (const override of datesToRemove) {
        await teleworkServiceV2.deleteOverride(override.id);
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  // Compter les modifications
  const newDeclarations = selectedDates.filter(date =>
    !allOverrides.some(o => isSameDay(o.date.toDate(), date))
  ).length;

  const removals = allOverrides.filter(override => {
    const overrideDate = override.date.toDate();
    return !selectedDates.some(d => isSameDay(d, overrideDate));
  }).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <RemoteIcon color="primary" />
            <Typography variant="h6">
              Déclaration télétravail
            </Typography>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {userDisplayName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Navigation mois */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <IconButton onClick={handlePrevMonth} disabled={loading}>
              <PrevIcon />
            </IconButton>
            <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </Typography>
            <IconButton onClick={handleNextMonth} disabled={loading}>
              <NextIcon />
            </IconButton>
          </Stack>

          {/* Calendrier */}
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* En-têtes jours */}
              <Box
                display="grid"
                gridTemplateColumns="repeat(7, 1fr)"
                gap={0.5}
                mb={0.5}
              >
                {weekDays.map((day) => (
                  <Box
                    key={day}
                    textAlign="center"
                    sx={{ fontWeight: 'bold', fontSize: '0.75rem', color: 'text.secondary' }}
                  >
                    {day}
                  </Box>
                ))}
              </Box>

              {/* Grille des jours */}
              <Box
                display="grid"
                gridTemplateColumns="repeat(7, 1fr)"
                gap={0.5}
              >
                {calendarDays.map((date) => {
                  const status = getDateStatus(date);
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isWeekendDay = isWeekend(date);

                  return (
                    <Box
                      key={date.toISOString()}
                      onClick={() => isCurrentMonth && !isWeekendDay && handleDateClick(date)}
                      sx={{
                        aspectRatio: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        cursor: isCurrentMonth && !isWeekendDay ? 'pointer' : 'default',
                        fontSize: '0.875rem',
                        fontWeight: status !== 'none' ? 'bold' : 'normal',
                        color: !isCurrentMonth
                          ? 'text.disabled'
                          : isWeekendDay
                          ? 'text.disabled'
                          : status === 'existing'
                          ? 'white'
                          : status === 'selected'
                          ? 'white'
                          : 'text.primary',
                        bgcolor: !isCurrentMonth
                          ? 'transparent'
                          : isWeekendDay
                          ? 'grey.100'
                          : status === 'existing'
                          ? 'success.main'
                          : status === 'selected'
                          ? 'primary.main'
                          : 'transparent',
                        border: '1px solid',
                        borderColor: isWeekendDay ? 'grey.300' : 'grey.200',
                        '&:hover': isCurrentMonth && !isWeekendDay
                          ? {
                              bgcolor: status === 'none' ? 'primary.light' : undefined,
                              transform: 'scale(1.05)',
                              transition: 'all 0.2s',
                            }
                          : {},
                      }}
                    >
                      {format(date, 'd')}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Légende */}
          <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
            <Chip
              size="small"
              label="Déjà déclaré"
              sx={{ bgcolor: 'success.main', color: 'white' }}
            />
            <Chip
              size="small"
              label="Nouvelle sélection"
              sx={{ bgcolor: 'primary.main', color: 'white' }}
            />
            <Chip
              size="small"
              label="Week-end"
              sx={{ bgcolor: 'grey.100' }}
            />
          </Stack>

          {/* Résumé */}
          <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Modifications à enregistrer :</strong>
              </Typography>
              {newDeclarations > 0 && (
                <Typography variant="body2" color="primary.main">
                  • {newDeclarations} nouveau{newDeclarations > 1 ? 'x' : ''} jour{newDeclarations > 1 ? 's' : ''} de télétravail
                </Typography>
              )}
              {removals > 0 && (
                <Typography variant="body2" color="error.main">
                  • {removals} jour{removals > 1 ? 's' : ''} annulé{removals > 1 ? 's' : ''}
                </Typography>
              )}
              {newDeclarations === 0 && removals === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Aucune modification
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || (newDeclarations === 0 && removals === 0)}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
