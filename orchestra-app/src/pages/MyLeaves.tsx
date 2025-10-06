import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Divider,
  Fab,
  FormControlLabel,
  Switch,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  BeachAccess as VacationIcon,
  LocalHospital as SickIcon,
  School as TrainingIcon,
  Business as WorkIcon,
  Event as EventIcon,
  MoneyOff as UnpaidIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format, addDays, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LeaveRequest, LeaveType, LeaveStatus } from '../types';
import { RootState } from '../store';
import { leaveService } from '../services/leave.service';

// Définition des types de congés avec leurs icônes et couleurs
const LEAVE_TYPES: { value: LeaveType; label: string; icon: React.ReactNode; color: any }[] = [
  { value: 'PAID_LEAVE', label: 'Congés payés', icon: <VacationIcon />, color: 'primary' },
  { value: 'RTT', label: 'RTT', icon: <WorkIcon />, color: 'secondary' },
  { value: 'SICK_LEAVE', label: 'Congé maladie', icon: <SickIcon />, color: 'error' },
  { value: 'TRAINING', label: 'Formation', icon: <TrainingIcon />, color: 'info' },
  { value: 'EXCEPTIONAL_LEAVE', label: 'Congé exceptionnel', icon: <EventIcon />, color: 'warning' },
  { value: 'CONVENTIONAL_LEAVE', label: 'Congé conventionnel', icon: <EventIcon />, color: 'info' },
  { value: 'UNPAID_LEAVE', label: 'Congé sans solde', icon: <UnpaidIcon />, color: 'default' },
  { value: 'MATERNITY_LEAVE', label: 'Congé maternité', icon: <VacationIcon />, color: 'success' },
  { value: 'PATERNITY_LEAVE', label: 'Congé paternité', icon: <VacationIcon />, color: 'success' },
];

interface LeaveBalance {
  paidLeave: number;
  rtt: number;
  usedPaidLeave: number;
  usedRtt: number;
  pendingPaidLeave: number;
  pendingRtt: number;
}

export const MyLeaves: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<LeaveBalance>({
    paidLeave: 25,
    rtt: 10,
    usedPaidLeave: 0,
    usedRtt: 0,
    pendingPaidLeave: 0,
    pendingRtt: 0,
  });
  
  // Dialog pour nouvelle déclaration
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [newLeave, setNewLeave] = useState<Partial<LeaveRequest>>({
    type: 'PAID_LEAVE',
    startDate: new Date(),
    endDate: new Date(),
    halfDayStart: false,
    halfDayEnd: false,
    reason: '',
  });

  // Calcule si c'est une journée isolée
  const isSingleDay = newLeave.startDate && newLeave.endDate &&
    newLeave.startDate.toDateString() === newLeave.endDate.toDateString();

  // Calculer le nombre de jours ouvrés
  const calculateWorkingDays = (start: Date, end: Date, halfDayStart = false, halfDayEnd = false): number => {
    let days = 0;
    let current = new Date(start);
    
    while (current <= end) {
      if (!isWeekend(current)) {
        days += 1;
      }
      current = addDays(current, 1);
    }
    
    // Ajuster pour les demi-journées
    if (halfDayStart) days -= 0.5;
    if (halfDayEnd) days -= 0.5;
    
    return Math.max(0, days);
  };

  // Fonction pour charger les données des congés
  const loadLeaveData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Charger les vraies demandes de congés depuis le service
      const userLeaveRequests = await leaveService.getUserLeaves(user.id);
      setLeaveRequests(userLeaveRequests);

      // Charger le vrai solde depuis le service (avec refresh forcé pour récupérer les vraies données du contrat)
      const realBalance = await leaveService.getLeaveBalance(user.id, true);

      // Calculer les soldes basés sur les vraies données (tous APPROVED en mode déclaratif)
      const usedPaid = userLeaveRequests
        .filter(req => req.type === 'PAID_LEAVE')
        .reduce((sum, req) => sum + req.totalDays, 0);

      const usedRtt = userLeaveRequests
        .filter(req => req.type === 'RTT')
        .reduce((sum, req) => sum + req.totalDays, 0);

      setBalance({
        paidLeave: realBalance.paidLeave,
        rtt: realBalance.rtt,
        usedPaidLeave: realBalance.used.paidLeave,
        usedRtt: realBalance.used.rtt,
        pendingPaidLeave: 0, // Plus de notion de "en attente" en mode déclaratif
        pendingRtt: 0,
      });
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setLoading(false);
    }
  };

  // Charger les données au montage du composant
  useEffect(() => {
    loadLeaveData();
  }, [user]);

  const handleSubmitLeave = async () => {
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.type || !user) return;

    const leaveRequestData = {
      userId: user.id,
      type: newLeave.type,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      halfDayStart: newLeave.halfDayStart || false,
      halfDayEnd: newLeave.halfDayEnd || false,
      reason: newLeave.reason || '',
      status: 'APPROVED' as LeaveStatus, // Déclaratif, directement approuvé
    };

    try {
      if (editingLeave) {
        // Modifier la demande existante
        await leaveService.cancelLeaveRequest(editingLeave.id, user.id);
        await leaveService.createLeaveRequest(leaveRequestData);
      } else {
        // Créer une nouvelle demande
        await leaveService.createLeaveRequest(leaveRequestData);
      }

      // Recharger les données
      await loadLeaveData();
      handleCloseDialog();
    } catch (error) {
      alert(`Erreur: ${error instanceof Error ? error.message : 'Impossible de sauvegarder la demande'}`);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLeave(null);
    setNewLeave({
      type: 'PAID_LEAVE',
      startDate: new Date(),
      endDate: new Date(),
      halfDayStart: false,
      halfDayEnd: false,
      reason: '',
    });
  };

  const handleEditLeave = (leave: LeaveRequest) => {
    // Tous les congés peuvent être modifiés
    setEditingLeave(leave);
    setNewLeave({
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      halfDayStart: leave.halfDayStart,
      halfDayEnd: leave.halfDayEnd,
      reason: leave.reason,
    });
    setDialogOpen(true);
  };

  const handleDeleteLeave = async (leaveId: string) => {
    if (!user) return;

    try {
      // Annuler la demande de congés (met le statut à CANCELLED)
      await leaveService.cancelLeaveRequest(leaveId, user.id);

      // Recharger toutes les données pour mettre à jour les soldes
      await loadLeaveData();
    } catch (error) {
      alert('Erreur lors de la suppression de la demande de congé');
    }
  };

  const getStatusColor = (status: LeaveStatus) => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: LeaveStatus) => {
    switch (status) {
      case 'APPROVED': return 'Approuvé';
      case 'REJECTED': return 'Refusé';
      case 'PENDING': return 'En attente';
      case 'CANCELLED': return 'Annulé';
      default: return status;
    }
  };

  const getTypeInfo = (type: LeaveType) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];
  };

  if (!user) return null;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          🏖️ Mes Congés
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={loadLeaveData}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          sx={{ ml: 2 }}
        >
          Actualiser
        </Button>
      </Box>

      {/* Soldes de congés */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 4 }}>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {balance.paidLeave - balance.usedPaidLeave}
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                Congés payés
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Disponibles sur {balance.paidLeave} jours
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="secondary">
                {balance.rtt - balance.usedRtt}
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                RTT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Disponibles sur {balance.rtt} jours
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="text.secondary">
                {balance.usedPaidLeave + balance.usedRtt}
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                Jours déclarés
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Cette année
              </Typography>
            </CardContent>
          </Card>
        </Box>

      </Box>

      {/* Liste des demandes */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            📋 Mes congés déclarés
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Déclarer un congé
          </Button>
        </Box>
        
        {leaveRequests.length === 0 ? (
          <Alert severity="info">
            Aucun congé déclaré pour le moment. Cliquez sur "Déclarer un congé" pour commencer.
          </Alert>
        ) : (
          <List>
            {leaveRequests.map((leave, index) => {
              const typeInfo = getTypeInfo(leave.type);

              return (
                <React.Fragment key={leave.id}>
                  <ListItem sx={{ px: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, color: `${typeInfo.color}.main` }}>
                      {typeInfo.icon}
                    </Box>
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight="medium">
                          {typeInfo.label}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.primary">
                            {leave.startDate.toDateString() === leave.endDate.toDateString() ? (
                              // Journée isolée
                              <>
                                Le {format(leave.startDate, 'dd/MM/yyyy', { locale: fr })}
                                {leave.halfDayStart && ' 🌆 (après-midi)'}
                                {leave.halfDayEnd && ' 🌅 (matin)'}
                                {!leave.halfDayStart && !leave.halfDayEnd && ' 🌞 (journée complète)'}
                                {' '}({leave.totalDays} jour{leave.totalDays !== 1 ? 's' : ''})
                              </>
                            ) : (
                              // Plusieurs jours
                              <>
                                Du {format(leave.startDate, 'dd/MM/yyyy', { locale: fr })}
                                {leave.halfDayStart && ' 🌆 (après-midi)'}
                                {' '}au {format(leave.endDate, 'dd/MM/yyyy', { locale: fr })}
                                {leave.halfDayEnd && ' 🌅 (matin)'}
                                {' '}({leave.totalDays} jour{leave.totalDays !== 1 ? 's' : ''})
                              </>
                            )}
                          </Typography>
                          {leave.reason && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              💬 {leave.reason}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            Déclaré le {format(leave.createdAt, 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleEditLeave(leave)}
                          title="Modifier"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => handleDeleteLeave(leave.id)}
                          title="Supprimer"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < leaveRequests.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Paper>

      {/* Dialog pour nouvelle demande / modification */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingLeave ? '✏️ Modifier mon congé' : '➕ Déclarer un congé'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <FormControl fullWidth>
                <InputLabel>Type de congé</InputLabel>
                <Select
                  value={newLeave.type || 'PAID_LEAVE'}
                  onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value as LeaveType })}
                  label="Type de congé"
                >
                  {LEAVE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {type.icon}
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                type="date"
                label="Date de début"
                value={newLeave.startDate ? format(newLeave.startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setNewLeave({
                  ...newLeave,
                  startDate: e.target.value ? new Date(e.target.value) : new Date(),
                })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                type="date"
                label="Date de fin"
                value={newLeave.endDate ? format(newLeave.endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setNewLeave({
                  ...newLeave,
                  endDate: e.target.value ? new Date(e.target.value) : new Date(),
                })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            {/* Gestion des demi-journées */}
            {isSingleDay ? (
              // Pour une journée isolée : choix Matin / Après-midi / Journée complète
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Durée</InputLabel>
                  <Select
                    value={
                      !newLeave.halfDayStart && !newLeave.halfDayEnd
                        ? 'full'
                        : newLeave.halfDayStart
                          ? 'afternoon'
                          : 'morning'
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewLeave({
                        ...newLeave,
                        halfDayStart: value === 'afternoon',
                        halfDayEnd: value === 'morning',
                      });
                    }}
                    label="Durée"
                  >
                    <MenuItem value="full">🌞 Journée complète</MenuItem>
                    <MenuItem value="morning">🌅 Matin uniquement</MenuItem>
                    <MenuItem value="afternoon">🌆 Après-midi uniquement</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            ) : (
              // Pour plusieurs jours : options distinctes pour premier et dernier jour
              <>
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                  <FormControl fullWidth>
                    <InputLabel>Premier jour</InputLabel>
                    <Select
                      value={newLeave.halfDayStart ? 'afternoon' : 'full'}
                      onChange={(e) => setNewLeave({
                        ...newLeave,
                        halfDayStart: e.target.value === 'afternoon',
                      })}
                      label="Premier jour"
                    >
                      <MenuItem value="full">🌞 Journée complète</MenuItem>
                      <MenuItem value="afternoon">🌆 Après-midi uniquement</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                  <FormControl fullWidth>
                    <InputLabel>Dernier jour</InputLabel>
                    <Select
                      value={newLeave.halfDayEnd ? 'morning' : 'full'}
                      onChange={(e) => setNewLeave({
                        ...newLeave,
                        halfDayEnd: e.target.value === 'morning',
                      })}
                      label="Dernier jour"
                    >
                      <MenuItem value="full">🌞 Journée complète</MenuItem>
                      <MenuItem value="morning">🌅 Matin uniquement</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}

            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Motif"
                value={newLeave.reason || ''}
                onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                helperText="Précisez le motif de votre demande"
              />
            </Box>

            {newLeave.startDate && newLeave.endDate && (
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Durée calculée:</strong> {' '}
                    {calculateWorkingDays(
                      newLeave.startDate,
                      newLeave.endDate,
                      newLeave.halfDayStart,
                      newLeave.halfDayEnd
                    )} jour(s) ouvré(s)
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmitLeave}
            variant="contained"
            disabled={!newLeave.startDate || !newLeave.endDate}
          >
            {editingLeave ? 'Modifier' : 'Déclarer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};