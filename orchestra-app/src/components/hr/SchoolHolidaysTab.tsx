import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  Tooltip,
  FormHelperText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  AutoMode as AutoIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SchoolHoliday, SchoolHolidayZone, SchoolHolidayPeriod } from '../../types';
import { schoolHolidaysService } from '../../services/schoolHolidays.service';

const PERIOD_LABELS: { [key in SchoolHolidayPeriod]: string } = {
  TOUSSAINT: '🍂 Toussaint',
  NOEL: '🎄 Noël',
  HIVER: '❄️ Hiver',
  PRINTEMPS: '🌸 Printemps',
  ETE: '☀️ Été',
};

const ZONE_COLORS: { [key in SchoolHolidayZone]: string } = {
  A: '#FF6B6B',
  B: '#4ECDC4',
  C: '#45B7D1',
  ALL: '#95E1D3',
};

export const SchoolHolidaysTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<SchoolHoliday | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<SchoolHoliday | null>(null);
  const [formData, setFormData] = useState<Partial<SchoolHoliday>>({
    name: '',
    period: 'TOUSSAINT',
    zone: 'ALL',
    year: selectedYear,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSchoolHolidays();
  }, [selectedYear]);

  const loadSchoolHolidays = async () => {
    try {
      setLoading(true);
      setError(null);
      const holidays = await schoolHolidaysService.getSchoolHolidaysByYear(selectedYear);
      setSchoolHolidays(holidays);
    } catch (err) {
      console.error('Erreur lors du chargement des congés scolaires:', err);
      setError('Erreur lors du chargement des congés scolaires');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeYear = async () => {
    try {
      setLoading(true);
      setError(null);
      await schoolHolidaysService.initializeYearSchoolHolidays(selectedYear);
      setSuccess(`Année scolaire ${selectedYear}-${selectedYear + 1} initialisée avec succès`);
      await loadSchoolHolidays();
    } catch (err) {
      console.error('Erreur lors de l\'initialisation:', err);
      setError('Erreur lors de l\'initialisation de l\'année scolaire');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (holiday?: SchoolHoliday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        name: holiday.name,
        period: holiday.period,
        zone: holiday.zone,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        year: holiday.year,
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        name: '',
        period: 'TOUSSAINT',
        zone: 'ALL',
        year: selectedYear,
        startDate: new Date(),
        endDate: new Date(),
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHoliday(null);
    setFormData({});
  };

  const handleSaveHoliday = async () => {
    try {
      setError(null);

      // Validation
      if (!formData.name || !formData.startDate || !formData.endDate) {
        setError('Tous les champs sont obligatoires');
        return;
      }

      if (formData.startDate >= formData.endDate) {
        setError('La date de fin doit être après la date de début');
        return;
      }

      if (editingHoliday) {
        // Modification
        await schoolHolidaysService.updateSchoolHoliday(editingHoliday.id, formData);
        setSuccess('Période modifiée avec succès');
      } else {
        // Création
        await schoolHolidaysService.addSchoolHoliday(formData as Omit<SchoolHoliday, 'id' | 'createdAt' | 'updatedAt'>);
        setSuccess('Période ajoutée avec succès');
      }

      handleCloseDialog();
      await loadSchoolHolidays();
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Erreur lors de la sauvegarde de la période');
    }
  };

  const handleDeleteHoliday = async () => {
    if (!holidayToDelete) return;

    try {
      setError(null);
      await schoolHolidaysService.deleteSchoolHoliday(holidayToDelete.id);
      setSuccess('Période supprimée avec succès');
      setDeleteDialogOpen(false);
      setHolidayToDelete(null);
      await loadSchoolHolidays();
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression de la période');
    }
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          🎓 Gestion des congés scolaires français
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Année scolaire</InputLabel>
            <Select
              value={selectedYear}
              label="Année scolaire"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {getYearOptions().map(year => (
                <MenuItem key={year} value={year}>
                  {year}-{year + 1}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Initialiser automatiquement l'année avec les dates officielles">
            <Button
              variant="outlined"
              startIcon={<AutoIcon />}
              onClick={handleInitializeYear}
              disabled={loading}
            >
              Auto-initialiser
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Ajouter une période
          </Button>
          <IconButton onClick={loadSchoolHolidays} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Stack>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Les congés scolaires sont organisés par zones géographiques (A, B, C) selon le découpage officiel du Ministère de l'Éducation Nationale.
          Ces périodes seront affichées dans le calendrier pour faciliter la planification.
        </Typography>
      </Alert>

      {/* Table des congés */}
      {loading && schoolHolidays.length === 0 ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : schoolHolidays.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              Aucun congé scolaire défini pour l'année {selectedYear}-{selectedYear + 1}.
              <br />
              Cliquez sur "Auto-initialiser" pour charger les dates officielles.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Période</strong></TableCell>
                <TableCell><strong>Nom</strong></TableCell>
                <TableCell><strong>Zone</strong></TableCell>
                <TableCell><strong>Début</strong></TableCell>
                <TableCell><strong>Fin</strong></TableCell>
                <TableCell><strong>Durée</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schoolHolidays.map((holiday) => {
                const duration = Math.ceil((holiday.endDate.getTime() - holiday.startDate.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <TableRow key={holiday.id} hover>
                    <TableCell>
                      <Chip
                        label={PERIOD_LABELS[holiday.period]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={`Zone ${holiday.zone}`}
                        size="small"
                        sx={{
                          backgroundColor: ZONE_COLORS[holiday.zone],
                          color: 'white',
                          fontWeight: 'bold',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {format(holiday.startDate, 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      {format(holiday.endDate, 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell>{duration} jours</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifier">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(holiday)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setHolidayToDelete(holiday);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog d'ajout/modification */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingHoliday ? 'Modifier une période' : 'Ajouter une période'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Nom de la période"
              fullWidth
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Vacances d'hiver 2025 - Zone A"
            />

            <FormControl fullWidth>
              <InputLabel>Type de période</InputLabel>
              <Select
                value={formData.period || 'TOUSSAINT'}
                label="Type de période"
                onChange={(e) => setFormData({ ...formData, period: e.target.value as SchoolHolidayPeriod })}
              >
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Zone</InputLabel>
              <Select
                value={formData.zone || 'ALL'}
                label="Zone"
                onChange={(e) => setFormData({ ...formData, zone: e.target.value as SchoolHolidayZone })}
              >
                <MenuItem value="ALL">Toutes les zones</MenuItem>
                <MenuItem value="A">Zone A</MenuItem>
                <MenuItem value="B">Zone B</MenuItem>
                <MenuItem value="C">Zone C</MenuItem>
              </Select>
              <FormHelperText>
                Sélectionnez "Toutes les zones" pour les vacances communes (Toussaint, Noël, Été)
              </FormHelperText>
            </FormControl>

            <TextField
              label="Date de début"
              type="date"
              fullWidth
              value={formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Date de fin"
              type="date"
              fullWidth
              value={formData.endDate ? format(formData.endDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Année scolaire"
              type="number"
              fullWidth
              value={formData.year || selectedYear}
              onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
              helperText="Année de début (ex: 2024 pour 2024-2025)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button onClick={handleSaveHoliday} variant="contained">
            {editingHoliday ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer la période "{holidayToDelete?.name}" ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleDeleteHoliday} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
