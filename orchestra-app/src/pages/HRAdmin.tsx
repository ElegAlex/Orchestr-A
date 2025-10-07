import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  Avatar,
  LinearProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  User,
  WorkContract,
  LeaveRequest,
  Holiday,
  UserCapacity,
  HRMetrics,
  DatePeriod,
  CapacityAlert,
  ContractType,
  LeaveType,
  WeekDay,
} from '../types';
import { holidayService } from '../services/holiday.service';
import { leaveService } from '../services/leave.service';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { capacityService } from '../services/capacity.service';
import { userService } from '../services/user.service';
import { UserConfigDialog } from '../components/hr/UserConfigDialog';
import { TeamManagementTab } from '../components/resources/TeamManagementTab';
import { SkillsMatrixTab } from '../components/resources/SkillsMatrixTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const HRAdmin: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // États pour les données
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedUserContracts, setSelectedUserContracts] = useState<{ [userId: string]: WorkContract }>({});
  const [userLeaves, setUserLeaves] = useState<{ [userId: string]: LeaveRequest[] }>({});
  const [userCapacities, setUserCapacities] = useState<UserCapacity[]>([]);
  
  // États pour les dialogs de paramétrage
  const [userConfigOpen, setUserConfigOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<{
    projects: number;
    tasks: number;
    leaves: number;
    contracts: number;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // États pour les paramètres globaux
  const [globalSettings, setGlobalSettings] = useState({
    weeklyHours: 35,
    workingDaysPerWeek: 5,
    hoursPerDay: 7,
    adminEmail: 'rh@orchestr-a.fr',
    leaveValidationDelay: 7,
    reminderDays: 2,
    defaultPaidLeaveDays: 25,
    defaultRttDays: 8,
    defaultExceptionalLeaveDays: 3
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedContract, setSelectedContract] = useState<WorkContract | null>(null);
  
  // États pour les formulaires
  const [contractForm, setContractForm] = useState<Partial<WorkContract>>({});
  
  // Période sélectionnée
  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      label: format(now, 'MMMM yyyy', { locale: fr }),
    };
  });

  useEffect(() => {
    loadAllData();
  }, [selectedPeriod]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      const currentYear = new Date().getFullYear();
      
      const [
        usersData,
        currentYearHolidays,
        nextYearHolidays
      ] = await Promise.all([
        userService.getAllUsersForResources(), // EXCLURE L'ADMIN TECHNIQUE
        holidayService.getHolidaysByYear(currentYear),
        holidayService.getHolidaysByYear(currentYear + 1),
      ]);
      
      const holidaysData = [...currentYearHolidays, ...nextYearHolidays];

      setUsers(usersData);
      setHolidays(holidaysData);

      // Charger les contrats pour tous les utilisateurs en parallèle
      const contractsData: { [userId: string]: WorkContract } = {};
      console.log('🔄 Chargement des contrats pour', usersData.length, 'utilisateurs...');
      
      const contractPromises = usersData.map(async (user) => {
        try {
          const contract = await capacityService.getUserContract(user.id);
          if (contract) {
            contractsData[user.id] = contract;
            console.log('✅ Contrat chargé pour', user.displayName, ':', contract.id);
          } else {
            console.log('⚪ Pas de contrat pour', user.displayName);
          }
        } catch (error) {
          console.warn(`❌ Erreur contrat pour ${user.displayName}:`, error);
        }
      });
      
      await Promise.all(contractPromises);
      setSelectedUserContracts(contractsData);
      console.log('📋 Contrats chargés:', Object.keys(contractsData).length, 'sur', usersData.length);

      // Charger les congés pour tous les utilisateurs
      const leavesData: { [userId: string]: LeaveRequest[] } = {};
      console.log('🔄 Chargement des congés pour', usersData.length, 'utilisateurs...');

      const leavesPromises = usersData.map(async (user) => {
        try {
          const leaves = await leaveService.getUserLeaves(user.id);
          // Filtrer pour ne garder que les congés approuvés (en cours ou futurs)
          const currentLeaves = leaves.filter(leave =>
            leave.status === 'APPROVED' && new Date(leave.endDate) >= new Date()
          );
          if (currentLeaves.length > 0) {
            leavesData[user.id] = currentLeaves;
            console.log('✅ Congés chargés pour', user.displayName, ':', currentLeaves.length);
          }
        } catch (error) {
          console.warn(`❌ Erreur congés pour ${user.displayName}:`, error);
        }
      });

      await Promise.all(leavesPromises);
      setUserLeaves(leavesData);
      console.log('🏖️ Congés chargés:', Object.keys(leavesData).length, 'utilisateurs avec congés');

    } catch (error) {
      console.error('Erreur lors du chargement des données RH:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // NOTE: En mode déclaratif, plus besoin d'approuver/rejeter les congés
  // Les congés sont automatiquement approuvés lors de leur déclaration
  const handleLeaveAction = async (leaveId: string, action: 'APPROVED' | 'REJECTED', reason?: string) => {
    // Cette fonction n'est plus utilisée en mode déclaratif
    console.log('Mode déclaratif: les congés sont automatiquement approuvés');
  };

  // Vérifier si l'utilisateur connecté peut gérer un utilisateur donné
  const canManageUser = (targetUser: User): boolean => {
    if (!user) return false;

    // Admin et responsable peuvent gérer tout le monde
    if (user.role === 'admin' || user.role === 'responsable') {
      return true;
    }

    // Manager peut gérer les utilisateurs de ses services
    if (user.role === 'manager') {
      const managerServiceIds = user.serviceIds || [];
      const targetUserServiceIds = targetUser.serviceIds || [];

      // Vérifier si au moins un service en commun
      return managerServiceIds.some(serviceId =>
        targetUserServiceIds.includes(serviceId)
      );
    }

    return false;
  };

  // Annuler un congé
  const handleCancelLeave = async (leaveId: string, userId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler ce congé ?')) {
      return;
    }

    try {
      await leaveService.cancelLeaveRequest(leaveId, userId);
      // Recharger les congés
      await loadAllData();
    } catch (error) {
      console.error('Erreur lors de l\'annulation du congé:', error);
      alert('Erreur lors de l\'annulation du congé');
    }
  };

  // Gestion des jours fériés
  const handleHolidayToggle = async (holidayId: string, isWorkingDay: boolean) => {
    try {
      await holidayService.overrideAsWorkingDay(holidayId, isWorkingDay);
      await loadAllData();
    } catch (error) {
      console.error('Erreur lors de la modification du jour férié:', error);
    }
  };

  const handleInitializeHolidays = async (year: number) => {
    try {
      setLoading(true);
      await holidayService.initializeYearHolidays(year);
      await loadAllData();
      
      // Notification de succès
      alert(`Jours fériés de l'année ${year} initialisés avec succès !`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des jours fériés:', error);
      alert(`Erreur lors de l'initialisation des jours fériés pour ${year}. Vérifiez la console pour plus de détails.`);
    } finally {
      setLoading(false);
    }
  };

  // Gestion de la configuration utilisateur
  const handleUserConfigSave = async (contractData: Partial<WorkContract>) => {
    try {
      console.log('🔧 Sauvegarde contrat:', { selectedUser, selectedContract, contractData });
      
      if (selectedContract && selectedContract.id && !selectedContract.id.startsWith('virtual-')) {
        // Mise à jour d'un contrat existant
        console.log('📝 Mise à jour contrat existant:', selectedContract.id);
        await capacityService.updateContract(selectedContract.id, contractData);
      } else if (selectedUser) {
        // Création d'un nouveau contrat
        console.log('➕ Création nouveau contrat pour:', selectedUser.id);
        await capacityService.createContract(selectedUser.id, contractData);
      }
      console.log('✅ Sauvegarde réussie, rechargement des données...');
      await loadAllData();
      console.log('✅ Données rechargées');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert(`Erreur lors de la sauvegarde du contrat: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  // Gestion de la suppression d'utilisateur
  const handleDeleteClick = async (user: User, event: React.MouseEvent) => {
    event.stopPropagation(); // Empêcher l'ouverture du dialog de config
    setUserToDelete(user);
    setDeleteLoading(true);
    
    try {
      const deps = await userService.getUserDependencies(user.id);
      setDeleteDependencies(deps);
    } catch (error) {
      console.error('Erreur lors de la récupération des dépendances:', error);
      setDeleteDependencies(null);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    setDeleteLoading(true);
    try {
      // Utiliser la suppression douce (soft delete) pour garder l'historique
      await userService.softDeleteUser(userToDelete.id);
      await loadAllData();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeleteDependencies(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de l\'utilisateur');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Gestion des paramètres globaux
  const handleSaveGlobalSettings = async (section: 'workTime' | 'notifications' | 'leaves') => {
    setSettingsLoading(true);
    try {
      // TODO: Implémenter la sauvegarde en base de données
      // Pour l'instant, on simule la sauvegarde
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`Paramètres de section "${section}" sauvegardés avec succès !`);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
      alert('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleResetGlobalSettings = (section: 'workTime' | 'notifications' | 'leaves') => {
    const defaultSettings = {
      weeklyHours: 35,
      workingDaysPerWeek: 5,
      hoursPerDay: 7,
      adminEmail: 'rh@orchestr-a.fr',
      leaveValidationDelay: 7,
      reminderDays: 2,
      defaultPaidLeaveDays: 25,
      defaultRttDays: 8,
      defaultExceptionalLeaveDays: 3
    };
    
    if (section === 'workTime') {
      setGlobalSettings({
        ...globalSettings,
        weeklyHours: defaultSettings.weeklyHours,
        workingDaysPerWeek: defaultSettings.workingDaysPerWeek,
        hoursPerDay: defaultSettings.hoursPerDay
      });
    } else if (section === 'notifications') {
      setGlobalSettings({
        ...globalSettings,
        adminEmail: defaultSettings.adminEmail,
        leaveValidationDelay: defaultSettings.leaveValidationDelay,
        reminderDays: defaultSettings.reminderDays
      });
    } else if (section === 'leaves') {
      setGlobalSettings({
        ...globalSettings,
        defaultPaidLeaveDays: defaultSettings.defaultPaidLeaveDays,
        defaultRttDays: defaultSettings.defaultRttDays,
        defaultExceptionalLeaveDays: defaultSettings.defaultExceptionalLeaveDays
      });
    }
  };

  // Utilitaires d'affichage
  const getContractTypeColor = (type: ContractType) => {
    switch (type) {
      case 'CDI': return 'success';
      case 'CDD': return 'warning';
      case 'FREELANCE': return 'info';
      case 'INTERN': return 'secondary';
      case 'PART_TIME': return 'primary';
      default: return 'default';
    }
  };

  const getLeaveTypeColor = (type: LeaveType) => {
    switch (type) {
      case 'PAID_LEAVE': return 'primary';
      case 'RTT': return 'secondary';
      case 'SICK_LEAVE': return 'warning';
      case 'MATERNITY_LEAVE': return 'info';
      case 'EXCEPTIONAL_LEAVE': return 'error';
      default: return 'default';
    }
  };

  const getCapacityColor = (capacity: UserCapacity) => {
    if (capacity.overallocationDays && capacity.overallocationDays > 0) return 'error';
    if (capacity.remainingDays < capacity.theoreticalDays * 0.1) return 'warning';
    if (capacity.remainingDays > capacity.theoreticalDays * 0.5) return 'info';
    return 'success';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" component="h1">
              👥 Administration RH
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadAllData}
              >
                Actualiser
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
              >
                Exporter
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Métriques simples */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Box>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {users.filter(u => u.isActive).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ressources actives
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main">
                {Object.keys(selectedUserContracts).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Contrats configurés
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="info.main">
                {holidays.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Jours fériés définis
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="warning.main">
                {selectedPeriod.startDate.getFullYear()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Année en cours
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Onglets principaux */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab label="Ressources" />
            <Tab label="Jours fériés" />
            <Tab label="Paramètres globaux" />
            <Tab label="Compétences" />
            <Tab label="Skills Matrix" />
          </Tabs>
        </Box>

        {/* Onglet Ressources */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              👥 Configuration des Ressources
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Paramétrez les contrats, horaires et congés pour chaque ressource de votre organisation.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {users.map((user) => {
              const contract = selectedUserContracts[user.id];
              return (
                <Box sx={{ width: '100%' }}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      height: '100%',
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 2 }
                    }}
                    onClick={() => {
                      setSelectedUser(user);
                      setSelectedContract(contract);
                      setUserConfigOpen(true);
                    }}
                  >
                    <CardContent>
                      <Box display="flex" gap={3} alignItems="flex-start">
                      {/* En-tête utilisateur */}
                      <Box display="flex" alignItems="center" gap={2} sx={{ minWidth: 250 }}>
                        <Avatar src={user.avatarUrl} sx={{ width: 48, height: 48 }}>
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" noWrap>
                            {user.displayName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {user.department || 'Département non défini'}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            {user.isActive ? (
                              <Chip label="Actif" size="small" color="success" />
                            ) : (
                              <Chip label="Inactif" size="small" color="default" />
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Informations contrat */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">
                          📋 Contrat
                        </Typography>
                        {contract ? (
                          <Stack spacing={1}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Type</Typography>
                              <Chip 
                                label={contract.type} 
                                size="small" 
                                color={getContractTypeColor(contract.type)}
                              />
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Temps de travail</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {contract.workingTimePercentage}%
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Heures/semaine</Typography>
                              <Typography variant="body2">
                                {contract.weeklyHours}h
                              </Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Jours travaillés</Typography>
                              <Typography variant="body2">
                                {contract.workingDays.length} jours
                              </Typography>
                            </Box>
                          </Stack>
                        ) : (
                          <Alert severity="warning">
                            <Typography variant="body2">
                              Contrat non configuré
                            </Typography>
                          </Alert>
                        )}
                      </Box>

                      {/* Informations congés */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">
                          🏖️ Congés
                        </Typography>

                        {/* Paramètres du contrat */}
                        {contract ? (
                          <Stack spacing={1} sx={{ mb: 1.5 }}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">CP annuels</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {contract.paidLeaveDays} jours
                              </Typography>
                            </Box>
                            {contract.rttDays && (
                              <Box display="flex" justifyContent="space-between">
                                <Typography variant="body2">RTT annuels</Typography>
                                <Typography variant="body2">
                                  {contract.rttDays} jours
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Non configuré
                          </Typography>
                        )}

                        {/* Congés en cours */}
                        {userLeaves[user.id] && userLeaves[user.id].length > 0 ? (
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                              Congés en cours/à venir :
                            </Typography>
                            <Stack spacing={0.5}>
                              {userLeaves[user.id].slice(0, 3).map((leave) => (
                                <Box
                                  key={leave.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 0.5,
                                    bgcolor: 'success.light',
                                    borderRadius: 1,
                                  }}
                                >
                                  <Stack spacing={0.2} sx={{ flex: 1 }}>
                                    <Typography variant="caption" fontWeight="bold">
                                      {format(new Date(leave.startDate), 'dd/MM', { locale: fr })} - {format(new Date(leave.endDate), 'dd/MM', { locale: fr })}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {leave.totalDays} jour{leave.totalDays > 1 ? 's' : ''}
                                    </Typography>
                                  </Stack>
                                  {canManageUser(user) && (
                                    <Tooltip title="Annuler ce congé">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleCancelLeave(leave.id, user.id)}
                                        sx={{ ml: 0.5 }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              ))}
                              {userLeaves[user.id].length > 3 && (
                                <Typography variant="caption" color="text.secondary">
                                  +{userLeaves[user.id].length - 3} autre{userLeaves[user.id].length - 3 > 1 ? 's' : ''}
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Aucun congé en cours
                          </Typography>
                        )}
                      </Box>

                      {/* Télétravail */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">
                          🏠 Télétravail
                        </Typography>
                        {contract ? (
                          contract.isRemoteAllowed ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip label="Autorisé" size="small" color="info" />
                              {contract.maxRemoteDaysPerWeek && (
                                <Typography variant="caption">
                                  Max {contract.maxRemoteDaysPerWeek}j/sem
                                </Typography>
                              )}
                            </Stack>
                          ) : (
                            <Chip label="Non autorisé" size="small" color="default" />
                          )
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Non configuré
                          </Typography>
                        )}
                      </Box>

                      {/* Actions */}
                      <Box display="flex" flexDirection="column" gap={1} alignItems="flex-end">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon />}
                        >
                          Configurer
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => handleDeleteClick(user, e)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>

          {users.length === 0 && (
            <Alert severity="info">
              Aucune ressource trouvée. Les utilisateurs apparaîtront ici une fois créés dans le système.
            </Alert>
          )}
        </TabPanel>

        {/* Onglet Jours fériés */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            🇫🇷 Gestion des jours fériés
          </Typography>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {/* Section Année en cours */}
            <Box>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      Année {new Date().getFullYear()}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleInitializeHolidays(new Date().getFullYear())}
                    >
                      Initialiser {new Date().getFullYear()}
                    </Button>
                  </Box>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nom</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell align="center">Statut</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {holidays
                          .filter(holiday => holiday.date.getFullYear() === new Date().getFullYear())
                          .map((holiday) => (
                          <TableRow key={holiday.id}>
                            <TableCell>{holiday.name}</TableCell>
                            <TableCell>
                              {format(holiday.date, 'dd MMM', { locale: fr })}
                            </TableCell>
                            <TableCell align="center">
                              {holiday.isWorkingDay ? (
                                <Chip label="Ouvré" size="small" color="warning" />
                              ) : (
                                <Chip label="Férié" size="small" color="error" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleHolidayToggle(holiday.id, !holiday.isWorkingDay)}
                              >
                                {holiday.isWorkingDay ? 'Rendre férié' : 'Rendre ouvré'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {holidays.filter(h => h.date.getFullYear() === new Date().getFullYear()).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              <Alert severity="info">
                                Aucun jour férié configuré pour {new Date().getFullYear()}. 
                                Cliquez sur "Initialiser {new Date().getFullYear()}" pour charger les jours fériés.
                              </Alert>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>

            {/* Section Année suivante */}
            <Box>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      Année {new Date().getFullYear() + 1}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleInitializeHolidays(new Date().getFullYear() + 1)}
                    >
                      Initialiser {new Date().getFullYear() + 1}
                    </Button>
                  </Box>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nom</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell align="center">Statut</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {holidays
                          .filter(holiday => holiday.date.getFullYear() === new Date().getFullYear() + 1)
                          .map((holiday) => (
                          <TableRow key={holiday.id}>
                            <TableCell>{holiday.name}</TableCell>
                            <TableCell>
                              {format(holiday.date, 'dd MMM', { locale: fr })}
                            </TableCell>
                            <TableCell align="center">
                              {holiday.isWorkingDay ? (
                                <Chip label="Ouvré" size="small" color="warning" />
                              ) : (
                                <Chip label="Férié" size="small" color="error" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleHolidayToggle(holiday.id, !holiday.isWorkingDay)}
                              >
                                {holiday.isWorkingDay ? 'Rendre férié' : 'Rendre ouvré'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {holidays.filter(h => h.date.getFullYear() === new Date().getFullYear() + 1).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              <Alert severity="info">
                                Aucun jour férié configuré pour {new Date().getFullYear() + 1}. 
                                Cliquez sur "Initialiser {new Date().getFullYear() + 1}" pour charger les jours fériés.
                              </Alert>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </TabPanel>


        {/* Onglet Paramètres globaux */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            ⚙️ Paramètres globaux RH
          </Typography>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>

            {/* Section Temps de travail */}
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    ⏰ Configuration des horaires
                  </Typography>
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Heures par semaine (temps plein)"
                      type="number"
                      value={globalSettings.weeklyHours}
                      onChange={(e) => setGlobalSettings({...globalSettings, weeklyHours: Number(e.target.value)})}
                      inputProps={{ min: 32, max: 40 }}
                      helperText="Durée hebdomadaire légale"
                    />
                    
                    <TextField
                      fullWidth
                      label="Jours travaillés par semaine"
                      type="number"
                      value={globalSettings.workingDaysPerWeek}
                      onChange={(e) => setGlobalSettings({...globalSettings, workingDaysPerWeek: Number(e.target.value)})}
                      inputProps={{ min: 4, max: 6 }}
                      helperText="Nombre de jours ouvrés"
                    />
                    
                    <TextField
                      fullWidth
                      label="Heures par jour"
                      type="number"
                      value={globalSettings.hoursPerDay}
                      onChange={(e) => setGlobalSettings({...globalSettings, hoursPerDay: Number(e.target.value)})}
                      inputProps={{ min: 6, max: 8 }}
                      helperText="Durée journalière standard"
                    />
                  </Stack>
                  
                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={() => handleSaveGlobalSettings('workTime')}
                      disabled={settingsLoading}
                    >
                      {settingsLoading ? 'Sauvegarde...' : 'Enregistrer le temps de travail'}
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={() => handleResetGlobalSettings('workTime')}
                    >
                      Réinitialiser
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Section Congés par défaut */}
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🏖️ Congés et RTT par défaut
                  </Typography>
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Jours de congés payés par an"
                      type="number"
                      value={globalSettings.defaultPaidLeaveDays}
                      onChange={(e) => setGlobalSettings({...globalSettings, defaultPaidLeaveDays: Number(e.target.value)})}
                      inputProps={{ min: 20, max: 35 }}
                      helperText="Congés payés annuels par défaut"
                    />
                    
                    <TextField
                      fullWidth
                      label="Jours RTT par an"
                      type="number"
                      value={globalSettings.defaultRttDays}
                      onChange={(e) => setGlobalSettings({...globalSettings, defaultRttDays: Number(e.target.value)})}
                      inputProps={{ min: 0, max: 15 }}
                      helperText="RTT annuels par défaut"
                    />
                    
                    <TextField
                      fullWidth
                      label="Jours de congés exceptionnels"
                      type="number"
                      value={globalSettings.defaultExceptionalLeaveDays}
                      onChange={(e) => setGlobalSettings({...globalSettings, defaultExceptionalLeaveDays: Number(e.target.value)})}
                      inputProps={{ min: 0, max: 10 }}
                      helperText="Jours pour événements familiaux"
                    />
                  </Stack>
                  
                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={() => handleSaveGlobalSettings('leaves')}
                      disabled={settingsLoading}
                    >
                      {settingsLoading ? 'Sauvegarde...' : 'Enregistrer les congés'}
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={() => handleResetGlobalSettings('leaves')}
                    >
                      Réinitialiser
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Section Notifications */}
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🔔 Paramètres de notification
                  </Typography>
                  
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Email admin RH"
                      type="email"
                      value={globalSettings.adminEmail}
                      onChange={(e) => setGlobalSettings({...globalSettings, adminEmail: e.target.value})}
                      helperText="Destinataire des notifications RH"
                    />
                    
                    <TextField
                      fullWidth
                      label="Délai de validation congés (jours)"
                      type="number"
                      value={globalSettings.leaveValidationDelay}
                      onChange={(e) => setGlobalSettings({...globalSettings, leaveValidationDelay: Number(e.target.value)})}
                      inputProps={{ min: 1, max: 30 }}
                      helperText="Délai max pour valider une demande"
                    />
                    
                    <TextField
                      fullWidth
                      label="Rappel avant échéance (jours)"
                      type="number"
                      value={globalSettings.reminderDays}
                      onChange={(e) => setGlobalSettings({...globalSettings, reminderDays: Number(e.target.value)})}
                      inputProps={{ min: 1, max: 7 }}
                      helperText="Notification avant expiration"
                    />
                  </Stack>
                  
                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={() => handleSaveGlobalSettings('notifications')}
                      disabled={settingsLoading}
                    >
                      {settingsLoading ? 'Sauvegarde...' : 'Enregistrer les notifications'}
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={() => handleResetGlobalSettings('notifications')}
                    >
                      Tester notification
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </TabPanel>

        {/* Onglet Contrats */}
        <TabPanel value={tabValue} index={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              Contrats de travail
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setContractDialogOpen(true)}
            >
              Nouveau contrat
            </Button>
          </Box>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {users.slice(0, 12).map((user) => (
              <Box>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Avatar src={user.avatarUrl}>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="bold">
                          {user.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.department}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Contrat par défaut - à remplacer par les vraies données */}
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Type</Typography>
                        <Chip label="CDI" size="small" color="success" />
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Temps</Typography>
                        <Typography variant="body2">100%</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Heures/sem</Typography>
                        <Typography variant="body2">35h</Typography>
                      </Box>
                    </Stack>

                    <Box display="flex" justifyContent="flex-end" mt={2}>
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </TabPanel>

        {/* Onglet Compétences */}
        <TabPanel value={tabValue} index={3}>
          <TeamManagementTab />
        </TabPanel>

        {/* Onglet Skills Matrix */}
        <TabPanel value={tabValue} index={4}>
          <SkillsMatrixTab />
        </TabPanel>

        {/* Onglet Capacités (désactivé pour l'instant) */}
        <TabPanel value={tabValue} index={5}>
          <Typography variant="h6" gutterBottom>
            Analyse de capacité - {selectedPeriod.label}
          </Typography>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {userCapacities.map((capacity) => {
              const user = users.find(u => u.id === capacity.userId);
              const utilizationRate = capacity.theoreticalDays > 0 
                ? (capacity.plannedDays / capacity.theoreticalDays) * 100 
                : 0;

              return (
                <Box>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <Avatar src={user?.avatarUrl}>
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {user?.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(utilizationRate)}% d'utilisation
                          </Typography>
                        </Box>
                      </Box>

                      <LinearProgress
                        variant="determinate"
                        value={Math.min(utilizationRate, 100)}
                        color={getCapacityColor(capacity)}
                        sx={{ mb: 2 }}
                      />

                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Théorique
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {capacity.theoreticalDays.toFixed(1)}j
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Disponible
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {capacity.availableDays.toFixed(1)}j
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Planifié
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {capacity.plannedDays.toFixed(1)}j
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Restant
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {capacity.remainingDays.toFixed(1)}j
                          </Typography>
                        </Box>
                      </Box>

                      {capacity.alerts.length > 0 && (
                        <Alert severity={
                          capacity.alerts[0].severity === 'CRITICAL' ? 'error' :
                          capacity.alerts[0].severity === 'HIGH' ? 'warning' : 'info'
                        }>
                          {capacity.alerts[0].message}
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>
        </TabPanel>

      </Card>

      {/* Dialog de configuration utilisateur */}
      <UserConfigDialog
        open={userConfigOpen}
        onClose={() => {
          setUserConfigOpen(false);
          setSelectedUser(null);
          setSelectedContract(null);
        }}
        user={selectedUser}
        contract={selectedContract}
        onSave={handleUserConfigSave}
      />

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          ⚠️ Confirmer la suppression
        </DialogTitle>
        <DialogContent>
          {userToDelete && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Vous êtes sur le point de désactiver le compte de <strong>{userToDelete.displayName}</strong>.
                Cette action est réversible mais l'utilisateur ne pourra plus se connecter.
              </Alert>

              {deleteDependencies && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Impact de la suppression :
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {deleteDependencies.projects > 0 && (
                      <Box>
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>{deleteDependencies.projects}</strong> projet(s) impacté(s)
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                    {deleteDependencies.tasks > 0 && (
                      <Box>
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>{deleteDependencies.tasks}</strong> tâche(s) assignée(s)
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                    {deleteDependencies.leaves > 0 && (
                      <Box>
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>{deleteDependencies.leaves}</strong> demande(s) de congés
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                    {deleteDependencies.contracts > 0 && (
                      <Box>
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>{deleteDependencies.contracts}</strong> contrat(s)
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary">
                Les données historiques seront conservées pour la traçabilité.
                Les tâches assignées devront être réassignées manuellement.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Suppression...' : 'Confirmer la suppression'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export { HRAdmin };
export default HRAdmin;