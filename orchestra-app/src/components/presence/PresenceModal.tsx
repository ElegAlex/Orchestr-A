/**
 * Modal d'affichage des présences
 * Affiche qui est sur site, en télétravail ou absent pour une date donnée
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  BeachAccess as AbsentIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';
import { presenceService, PresenceStatus, UserPresence } from '../../services/presence.service';

interface PresenceModalProps {
  open: boolean;
  onClose: () => void;
}

export const PresenceModal: React.FC<PresenceModalProps> = ({ open, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presences, setPresences] = useState<PresenceStatus | null>(null);

  // Charger les présences
  const loadPresences = async (date: Date) => {
    setLoading(true);
    setError(null);
    try {
      const data = await presenceService.getPresencesForDate(date);
      setPresences(data);
    } catch (err) {
      console.error('Erreur chargement présences:', err);
      setError('Erreur lors du chargement des présences');
    } finally {
      setLoading(false);
    }
  };

  // Charger au montage et quand la date change
  useEffect(() => {
    if (open) {
      loadPresences(selectedDate);
    }
  }, [open, selectedDate]);

  // Composant pour afficher une liste d'utilisateurs
  const UserList: React.FC<{ users: UserPresence[]; emptyMessage: string }> = ({ users, emptyMessage }) => {
    if (users.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 1 }}>
          {emptyMessage}
        </Alert>
      );
    }

    return (
      <List dense>
        {users.map((userPresence) => {
          const { user, details, validationStatus } = userPresence;
          return (
            <ListItem key={user.id}>
              <ListItemAvatar>
                <Avatar src={user.avatarUrl}>
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={`${user.firstName} ${user.lastName}`}
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {user.serviceId || 'Service non défini'}
                    </Typography>
                    {validationStatus && (
                      <Chip
                        label={
                          validationStatus === 'APPROVED' ? 'Validé' :
                          validationStatus === 'PENDING' ? 'En attente' :
                          'Rejeté'
                        }
                        size="small"
                        color={
                          validationStatus === 'APPROVED' ? 'success' :
                          validationStatus === 'PENDING' ? 'warning' :
                          'error'
                        }
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </Stack>
                }
              />
              {details && (
                <Chip label={details} size="small" variant="outlined" />
              )}
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonIcon />
            <Typography variant="h6">
              Présences du {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {/* Sélecteur de date */}
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CalendarIcon color="primary" />
                <DatePicker
                  label="Sélectionner une date"
                  value={selectedDate}
                  onChange={(newDate) => newDate && setSelectedDate(newDate)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />
              </Stack>
            </Paper>

            {/* Loading */}
            {loading && (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            )}

            {/* Error */}
            {error && (
              <Alert severity="error">{error}</Alert>
            )}

            {/* Résultats */}
            {!loading && !error && presences && (
              <Stack spacing={2}>
                {/* Statistiques */}
                <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                  <Stack direction="row" spacing={3} justifyContent="center">
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {presences.onSite.length + presences.telework.length + presences.absent.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total collaborateurs
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        {presences.onSite.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Sur site
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {presences.telework.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Télétravail
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        {presences.absent.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Absents
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Sur site */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <BusinessIcon color="success" />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Sur site ({presences.onSite.length})
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <UserList
                      users={presences.onSite}
                      emptyMessage="Aucun collaborateur sur site ce jour"
                    />
                  </AccordionDetails>
                </Accordion>

                {/* Télétravail */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <HomeIcon color="info" />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Télétravail ({presences.telework.length})
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <UserList
                      users={presences.telework}
                      emptyMessage="Aucun collaborateur en télétravail ce jour"
                    />
                  </AccordionDetails>
                </Accordion>

                {/* Absents */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <AbsentIcon color="warning" />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Absents ({presences.absent.length})
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <UserList
                      users={presences.absent}
                      emptyMessage="Aucun absent ce jour"
                    />
                  </AccordionDetails>
                </Accordion>
              </Stack>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};
