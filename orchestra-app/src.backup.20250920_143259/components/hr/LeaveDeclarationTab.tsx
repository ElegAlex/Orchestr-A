import React, { useState, useEffect } from 'react';
import {
  Box,
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
  Stack,
  Divider,
  Fab,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarIcon,
  BeachAccess as VacationIcon,
  LocalHospital as SickIcon,
  School as TrainingIcon,
  Business as WorkIcon,
} from '@mui/icons-material';
import { format, differenceInDays, addDays, isWeekend, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LeaveRequest, LeaveType, WorkContract } from '../../types';
import { leaveService } from '../../services/leave.service';

// Définition des types de congés avec leurs icônes et couleurs
const LEAVE_TYPES: { value: LeaveType; label: string; icon: React.ReactNode; color: any }[] = [
  { value: 'PAID_LEAVE', label: 'Congés payés', icon: <VacationIcon />, color: 'primary' },
  { value: 'RTT', label: 'RTT', icon: <WorkIcon />, color: 'secondary' },
  { value: 'SICK_LEAVE', label: 'Congé maladie', icon: <SickIcon />, color: 'error' },
  { value: 'TRAINING', label: 'Formation', icon: <TrainingIcon />, color: 'info' },
  { value: 'EXCEPTIONAL_LEAVE', label: 'Congé exceptionnel', icon: <VacationIcon />, color: 'warning' },
  { value: 'UNPAID_LEAVE', label: 'Congé sans solde', icon: <VacationIcon />, color: 'default' },
];

interface LeaveDeclarationTabProps {
  userId: string;
  contract: Partial<WorkContract>;
}

interface LeaveBalance {
  paidLeave: number;
  rtt: number;
  usedPaidLeave: number;
  usedRtt: number;
}

export const LeaveDeclarationTab: React.FC<LeaveDeclarationTabProps> = ({
  userId,
  contract,
}) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<LeaveBalance>({
    paidLeave: contract.paidLeaveDays || 25,
    rtt: contract.rttDays || 0,
    usedPaidLeave: 0,
    usedRtt: 0,
  });
  
  // Dialog pour nouvelle déclaration
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLeave, setNewLeave] = useState<Partial<LeaveRequest>>({
    type: 'PAID_LEAVE',
    startDate: new Date(),
    endDate: new Date(),
    halfDayStart: false,
    halfDayEnd: false,
    reason: '',
  });

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

  // Charger les vraies demandes de congés depuis Firestore
  useEffect(() => {
    const loadLeaveRequests = async () => {
      try {
        setLoading(true);
        const requests = await leaveService.getUserLeaves(userId);
        setLeaveRequests(requests);
      } catch (error) {
        console.error('Error loading leave requests:', error);
        // Fallback to empty array if error
        setLeaveRequests([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadLeaveRequests();
    
    // Calculer les soldes utilisés basés sur les vraies demandes
    const loadLeaveBalances = async () => {
      try {
        const balances = await leaveService.getLeaveBalance(userId);
        setBalance({
          paidLeave: balances.paidLeave,
          rtt: balances.rtt,
          usedPaidLeave: balances.used.paidLeave,
          usedRtt: balances.used.rtt,
        });
      } catch (error) {
        console.error('Error loading leave balances:', error);
      }
    };
    
    loadLeaveBalances();
  }, [userId]);

  const handleSubmitLeave = async () => {
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.type) return;

    const workingDays = calculateWorkingDays(
      newLeave.startDate,
      newLeave.endDate,
      newLeave.halfDayStart,
      newLeave.halfDayEnd
    );

    try {
      setLoading(true);
      
      const leaveRequest = await leaveService.createLeaveRequest({
        userId,
        type: newLeave.type,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        halfDayStart: newLeave.halfDayStart || false,
        halfDayEnd: newLeave.halfDayEnd || false,
        reason: newLeave.reason || '',
        status: 'PENDING',
      });

      // Recharger la liste et les soldes
      const requests = await leaveService.getUserLeaves(userId);
      setLeaveRequests(requests);
      
      const balances = await leaveService.getLeaveBalance(userId);
      setBalance({
        paidLeave: balances.paidLeave,
        rtt: balances.rtt,
        usedPaidLeave: balances.used.paidLeave,
        usedRtt: balances.used.rtt,
      });
      
      setDialogOpen(false);
      setNewLeave({
        type: 'PAID_LEAVE',
        startDate: new Date(),
        endDate: new Date(),
        halfDayStart: false,
        halfDayEnd: false,
        reason: '',
      });
    } catch (error) {
      console.error('Error creating leave request:', error);
      alert('Erreur lors de la création de la demande de congé');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approuvé';
      case 'REJECTED': return 'Refusé';
      case 'PENDING': return 'En attente';
      default: return status;
    }
  };

  const getTypeInfo = (type: LeaveType) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        🏖️ Mes congés
      </Typography>

      {/* Soldes de congés */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="primary">
                {balance.paidLeave - balance.usedPaidLeave}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Congés payés restants
              </Typography>
              <Typography variant="body2" color="text.secondary">
                sur {balance.paidLeave} jours
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="secondary">
                {balance.rtt - balance.usedRtt}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                RTT restants
              </Typography>
              <Typography variant="body2" color="text.secondary">
                sur {balance.rtt} jours
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Liste des congés déclarés */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📋 Mes déclarations
        </Typography>
        
        {leaveRequests.length === 0 ? (
          <Alert severity="info">
            Aucun congé déclaré pour le moment.
          </Alert>
        ) : (
          <List>
            {leaveRequests.map((leave, index) => {
              const typeInfo = getTypeInfo(leave.type);
              return (
                <React.Fragment key={leave.id}>
                  <ListItem>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                      {typeInfo.icon}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {typeInfo.label}
                          </Typography>
                          <Chip
                            label={getStatusLabel(leave.status)}
                            color={getStatusColor(leave.status)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Du {format(leave.startDate, 'dd/MM/yyyy', { locale: fr })} 
                            au {format(leave.endDate, 'dd/MM/yyyy', { locale: fr })}
                            ({leave.totalDays} jour{leave.totalDays > 1 ? 's' : ''})
                          </Typography>
                          {leave.reason && (
                            <Typography variant="caption" color="text.secondary">
                              Motif: {leave.reason}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {leave.status === 'PENDING' && (
                        <IconButton edge="end" size="small">
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < leaveRequests.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>

      {/* Bouton pour déclarer un nouveau congé */}
      <Fab
        color="primary"
        aria-label="Déclarer un congé"
        onClick={() => setDialogOpen(true)}
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        <AddIcon />
      </Fab>

      {/* Dialog pour nouvelle déclaration */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          ➕ Déclarer un congé
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

            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newLeave.halfDayStart || false}
                    onChange={(e) => setNewLeave({
                      ...newLeave,
                      halfDayStart: e.target.checked,
                    })}
                  />
                }
                label="Demi-journée début"
              />
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newLeave.halfDayEnd || false}
                    onChange={(e) => setNewLeave({
                      ...newLeave,
                      halfDayEnd: e.target.checked,
                    })}
                  />
                }
                label="Demi-journée fin"
              />
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Motif (optionnel)"
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
          <Button onClick={() => setDialogOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmitLeave}
            variant="contained"
            disabled={!newLeave.startDate || !newLeave.endDate}
          >
            Déclarer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};