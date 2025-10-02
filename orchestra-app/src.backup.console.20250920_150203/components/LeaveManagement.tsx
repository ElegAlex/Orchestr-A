import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Alert,
  Grid,
  Stack,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  School as SchoolIcon,
  LocalHospital as LocalHospitalIcon,
  Event as EventIcon
} from '@mui/icons-material';
// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
// import { fr } from 'date-fns/locale';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  fetchUserLeaves,
  createLeave,
  fetchUsers
} from '../store/slices/resourceSlice';
import { Leave, User } from '../types';

interface LeaveManagementProps {
  userId?: string;
  showAllUsers?: boolean;
  showActions?: boolean;
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ 
  userId, 
  showAllUsers = false, 
  showActions = true 
}) => {
  const dispatch = useAppDispatch();
  const { 
    leaves, 
    leavesLoading, 
    users, 
    selectedUser 
  } = useAppSelector((state: any) => state.resources);
  
  // Récupérer l'utilisateur connecté depuis le state auth
  const currentUser = useAppSelector((state: any) => state.auth.user);

  const [openDialog, setOpenDialog] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    userId: userId || selectedUser?.id || '',
    type: 'vacation' as Leave['type'],
    startDate: new Date(),
    endDate: new Date(),
    reason: ''
  });

  // Calculer les jours ouvrés entre deux dates
  const calculateWorkingDays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclure dimanche (0) et samedi (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  useEffect(() => {
    if (users.length === 0) {
      dispatch(fetchUsers());
    }
    if (userId) {
      dispatch(fetchUserLeaves({ userId }));
    } else if (showAllUsers) {
      // Charger les congés de tous les utilisateurs
      users.forEach((user: User) => {
        dispatch(fetchUserLeaves({ userId: user.id }));
      });
    }
  }, [dispatch, userId, showAllUsers, users]);
  const getLeaveTypeIcon = (type: Leave['type']) => {
    switch (type) {
      case 'vacation':
        return <EventIcon />;
      case 'sick':
        return <LocalHospitalIcon />;
      case 'training':
        return <SchoolIcon />;
      case 'other':
        return <BusinessIcon />;
      default:
        return <CalendarIcon />;
    }
  };

  const getLeaveTypeLabel = (type: Leave['type']) => {
    switch (type) {
      case 'vacation':
        return 'Congés payés';
      case 'sick':
        return 'Arrêt maladie';
      case 'training':
        return 'Formation';
      case 'other':
        return 'Autre';
      default:
        return type;
    }
  };

  const handleCreateLeave = async () => {
    const workingDaysCount = calculateWorkingDays(leaveForm.startDate, leaveForm.endDate);
    
    await dispatch(createLeave({
      userId: leaveForm.userId,
      type: leaveForm.type,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      workingDaysCount,
      reason: leaveForm.reason,
      status: 'approved' // Sera forcé à 'approved' par le service
    }));

    setOpenDialog(false);
    setLeaveForm({
      userId: userId || selectedUser?.id || '',
      type: 'vacation',
      startDate: new Date(),
      endDate: new Date(),
      reason: ''
    });
  };
  const filteredLeaves = showAllUsers ? leaves : leaves.filter((leave: Leave) => 
    userId ? leave.userId === userId : leave.userId === selectedUser?.id
  );

  // Tous les congés sont approuvés automatiquement
  const approvedLeaves = filteredLeaves; // Tous les congés
  const allLeaves = filteredLeaves;

  const getUserName = (userId: string) => {
    const user = users.find((u: User) => u.id === userId);
    return user ? user.displayName : 'Utilisateur inconnu';
  };

  const getLeaveStats = () => {
    const currentYear = new Date().getFullYear();
    const yearLeaves = filteredLeaves.filter((leave: Leave) => 
      new Date(leave.startDate).getFullYear() === currentYear &&
      leave.status === 'approved'
    );
    
    const totalDays = yearLeaves.reduce((sum: number, leave: Leave) => 
      sum + leave.workingDaysCount, 0
    );
    
    const vacationDays = yearLeaves
      .filter((leave: Leave) => leave.type === 'vacation')
      .reduce((sum: number, leave: Leave) => sum + leave.workingDaysCount, 0);
    
    const sickDays = yearLeaves
      .filter((leave: Leave) => leave.type === 'sick')
      .reduce((sum: number, leave: Leave) => sum + leave.workingDaysCount, 0);

    return { totalDays, vacationDays, sickDays };
  };

  const stats = getLeaveStats();

  const renderLeaveRow = (leave: Leave) => (
    <TableRow key={leave.id}>
      {showAllUsers && (
        <TableCell>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonIcon fontSize="small" />
            {getUserName(leave.userId)}
          </Box>
        </TableCell>
      )}
      <TableCell>
        <Box display="flex" alignItems="center" gap={1}>
          {getLeaveTypeIcon(leave.type)}
          {getLeaveTypeLabel(leave.type)}
        </Box>
      </TableCell>
      <TableCell>{new Date(leave.startDate).toLocaleDateString('fr-FR')}</TableCell>
      <TableCell>{new Date(leave.endDate).toLocaleDateString('fr-FR')}</TableCell>
      <TableCell align="center">{leave.workingDaysCount}</TableCell>
      <TableCell>
        <Chip
          label="Validé"
          color="success"
          size="small"
        />
      </TableCell>
      <TableCell>{leave.reason || '-'}</TableCell>
      {showActions && (
        <TableCell>
          <Stack direction="row" spacing={1}>
            {leave.userId === currentUser?.id && (
              <Tooltip title="Modifier">
                <IconButton size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Supprimer">
              <IconButton size="small" color="error">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <Box>
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h2">
            {showAllUsers ? 'Congés de l\'équipe' : 'Mes congés'}
          </Typography>
          {showActions && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
              size="small"
            >
              Déclarer un congé
            </Button>
          )}
        </Box>

        {/* Statistiques */}
        <Box sx={{ display: "flex", flexWrap: "wrap" }}>
          <Box>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Total {new Date().getFullYear()}
                </Typography>
                <Typography variant="h4" color="primary">
                  {stats.totalDays}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  jours pris
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Congés payés
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.vacationDays}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  / 25 jours
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(stats.vacationDays / 25) * 100}
                  color="success"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Arrêts maladie
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.sickDays}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  jours cette année
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Liste des congés */}
        <Card>
          <Tabs 
            value={0}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Tous les congés" />
          </Tabs>

          <CardContent>
            {leavesLoading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <LinearProgress sx={{ width: '100%' }} />
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {showAllUsers && <TableCell>Utilisateur</TableCell>}
                      <TableCell>Type</TableCell>
                      <TableCell>Début</TableCell>
                      <TableCell>Fin</TableCell>
                      <TableCell align="center">Jours</TableCell>
                      <TableCell>Statut</TableCell>
                      <TableCell>Motif</TableCell>
                      {showActions && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allLeaves.map(renderLeaveRow)}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {allLeaves.length === 0 && !leavesLoading && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Aucun congé déclaré pour le moment.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Dialog de création */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Déclarer un congé
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              {showAllUsers && (
                <Box>
                  <FormControl fullWidth>
                    <InputLabel>Utilisateur</InputLabel>
                    <Select
                      value={leaveForm.userId}
                      label="Utilisateur"
                      onChange={(e) => setLeaveForm({ ...leaveForm, userId: e.target.value })}
                    >
                      {users.map((user: User) => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.displayName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Type de congé</InputLabel>
                  <Select
                    value={leaveForm.type}
                    label="Type de congé"
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as Leave['type'] })}
                  >
                    <MenuItem value="vacation">Congés payés</MenuItem>
                    <MenuItem value="sick">Arrêt maladie</MenuItem>
                    <MenuItem value="training">Formation</MenuItem>
                    <MenuItem value="other">Autre</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  value={leaveForm.startDate.toISOString().split('T')[0]}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: new Date(e.target.value) })}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  required
                />
              </Box>
              <Box>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin"
                  value={leaveForm.endDate.toISOString().split('T')[0]}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: new Date(e.target.value) })}
                  inputProps={{
                    min: leaveForm.startDate.toISOString().split('T')[0]
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  required
                />
              </Box>
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Nombre de jours ouvrés : <strong>
                      {calculateWorkingDays(leaveForm.startDate, leaveForm.endDate)}
                    </strong>
                  </Typography>
                </Alert>
              </Box>
              <Box>
                <TextField
                  fullWidth
                  label="Motif (optionnel)"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  multiline
                  rows={3}
                  placeholder="Précisez le motif de votre demande..."
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateLeave}
              variant="contained"
              disabled={!leaveForm.userId || !leaveForm.startDate || !leaveForm.endDate}
            >
              Déclarer le congé
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
};

export default LeaveManagement;