import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Checkbox,
  FormGroup,
  FormControlLabel,
  ListItemText
} from '@mui/material';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Euro as EuroIcon,
  Palette as PaletteIcon,
  Settings as SettingsIcon,
  Group as GroupIcon,
  Assignment as AssignmentIcon,
  SwapHoriz as SwapIcon
} from '@mui/icons-material';
import { Service, CreateServiceRequest } from '../types/service';
import { User, Department, CreateDepartmentRequest } from '../types';
import { serviceService } from '../services/service.service';
import { userService } from '../services/user.service';
import { getRoleDisplayLabel } from '../utils/roleUtils';
import { userServiceAssignmentService } from '../services/user-service-assignment.service';
import { departmentService } from '../services/department.service';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SkillsTab } from '../components/settings/SkillsTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const DEFAULT_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#d32f2f', 
  '#7b1fa2', '#455a64', '#c2185b', '#00796b',
  '#5d4037', '#616161', '#ff5722', '#9c27b0'
];

export const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<User[]>([]);
  const [unassignedUsersDept, setUnassignedUsersDept] = useState<User[]>([]);
  const [serviceStats, setServiceStats] = useState<any>(null);
  const [departmentStats, setDepartmentStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<CreateServiceRequest>({
    name: '',
    description: '',
    color: DEFAULT_COLORS[0],
    manager: '',
    budget: 0
  });

  // Department dialog states
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState<CreateDepartmentRequest>({
    name: '',
    description: '',
    color: DEFAULT_COLORS[0],
    managerId: '',
    budget: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        servicesData, 
        departmentsData, 
        usersData, 
        unassignedData, 
        unassignedDeptData, 
        statsData,
        deptStatsData
      ] = await Promise.all([
        serviceService.getAllServices(),
        departmentService.getAllDepartments(),
        userService.getAllUsersForResources(), // EXCLURE L'ADMIN TECHNIQUE
        userServiceAssignmentService.getUnassignedUsers(),
        departmentService.getUnassignedUsers(),
        userServiceAssignmentService.getServiceAssignmentStats(),
        departmentService.getDepartmentStats()
      ]);
      setServices(servicesData);
      setDepartments(departmentsData);
      setUsers(usersData);
      setUnassignedUsers(unassignedData);
      setUnassignedUsersDept(unassignedDeptData);
      setServiceStats(statsData);
      setDepartmentStats(deptStatsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || '',
        color: service.color,
        manager: service.manager || '',
        budget: service.budget || 0
      });
    } else {
      setEditingService(null);
      setServiceForm({
        name: '',
        description: '',
        color: DEFAULT_COLORS[0],
        manager: '',
        budget: 0
      });
    }
    setServiceDialogOpen(true);
  };

  const handleCloseServiceDialog = () => {
    setServiceDialogOpen(false);
    setEditingService(null);
  };

  const handleSaveService = async () => {
    try {
      if (editingService) {
        await serviceService.updateService({
          id: editingService.id,
          ...serviceForm
        });
      } else {
        await serviceService.createService(serviceForm);
      }
      await loadData();
      handleCloseServiceDialog();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
      try {
        await serviceService.deleteService(serviceId);
        await loadData();
      } catch (error) {
        console.error('Error deleting service:', error);
      }
    }
  };

  const getManagerName = (managerId?: string) => {
    if (!managerId) return 'Aucun manager';
    const manager = users.find(user => user.id === managerId);
    return manager ? `${manager.firstName} ${manager.lastName}` : 'Manager inconnu';
  };

  const handleAssignUserToService = async (userId: string, serviceId: string | null) => {
    try {
      await userServiceAssignmentService.assignUserToService(userId, serviceId);
      await loadData();
    } catch (error) {
      console.error('Error assigning user to service:', error);
    }
  };

  const handleAddServiceToUser = async (userId: string, serviceId: string) => {
    try {
      await userServiceAssignmentService.addServiceToUser(userId, serviceId);
      await loadData();
    } catch (error) {
      console.error('Error adding service to user:', error);
    }
  };

  const handleRemoveServiceFromUser = async (userId: string, serviceId: string) => {
    try {
      await userServiceAssignmentService.removeServiceFromUser(userId, serviceId);
      await loadData();
    } catch (error) {
      console.error('Error removing service from user:', error);
    }
  };

  const getUserServices = (user: User): string[] => {
    return user.serviceIds || [];
  };

  // Fonction pour migrer automatiquement un utilisateur vers la nouvelle structure
  const migrateUserToNewStructure = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (user && user.serviceId && (!user.serviceIds || user.serviceIds.length === 0)) {
        await userServiceAssignmentService.addServiceToUser(userId, user.serviceId);
        await loadData(); // Recharger les données après migration
      }
    } catch (error) {
      console.error('Error migrating user:', error);
    }
  };

  // Department handlers
  const handleOpenDepartmentDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setDepartmentForm({
        name: department.name,
        description: department.description || '',
        color: department.color,
        managerId: department.managerId || '',
        budget: department.budget || 0
      });
    } else {
      setEditingDepartment(null);
      setDepartmentForm({
        name: '',
        description: '',
        color: DEFAULT_COLORS[0],
        managerId: '',
        budget: 0
      });
    }
    setDepartmentDialogOpen(true);
  };

  const handleCloseDepartmentDialog = () => {
    setDepartmentDialogOpen(false);
    setEditingDepartment(null);
  };

  const handleSaveDepartment = async () => {
    try {
      if (editingDepartment) {
        await departmentService.updateDepartment({
          id: editingDepartment.id,
          ...departmentForm
        });
      } else {
        await departmentService.createDepartment(departmentForm);
      }
      await loadData();
      handleCloseDepartmentDialog();
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce département ?')) {
      try {
        await departmentService.deleteDepartment(departmentId);
        await loadData();
      } catch (error) {
        console.error('Error deleting department:', error);
        alert(`Erreur: ${  error instanceof Error ? error.message : 'Une erreur est survenue'}`);
      }
    }
  };

  const handleAssignUserToDepartment = async (userId: string, departmentId: string | null) => {
    try {
      await departmentService.assignUserToDepartment(userId, departmentId);
      await loadData();
    } catch (error) {
      console.error('Error assigning user to department:', error);
    }
  };

  const getDepartmentManagerName = (managerId?: string) => {
    if (!managerId) return 'Aucun responsable';
    const manager = users.find(user => user.id === managerId);
    return manager ? `${manager.firstName} ${manager.lastName}` : 'Responsable inconnu';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Chargement des paramètres..." />;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          <SettingsIcon sx={{ mr: 2, verticalAlign: 'bottom' }} />
          Paramètres
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Configuration et gestion des paramètres système
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label="Départements" 
              icon={<BusinessIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Services" 
              icon={<GroupIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Affectation Départements" 
              icon={<AssignmentIcon />} 
              iconPosition="start"
            />
            <Tab
              label="Affectation Services"
              icon={<AssignmentIcon />}
              iconPosition="start"
            />
            <Tab
              label="Compétences"
              icon={<AssignmentIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h5" gutterBottom>
                  Gestion des Départements
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gérez les départements de votre organisation et désignez des responsables
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDepartmentDialog()}
              >
                Nouveau Département
              </Button>
            </Stack>
          </Box>

          <Stack spacing={2}>
            {departments.map((department) => (
              <Card 
                key={department.id}
                sx={{ 
                  p: 3, 
                  display: 'flex', 
                  alignItems: 'center',
                  '&:hover': { 
                    boxShadow: 4,
                    borderColor: `${department.color  }40`
                  },
                  borderLeft: 4,
                  borderLeftColor: department.color,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                  {/* Department Icon & Name */}
                  <Avatar
                    sx={{ 
                      bgcolor: department.color, 
                      mr: 3, 
                      width: 56, 
                      height: 56,
                      boxShadow: 2
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                  
                  {/* Department Info */}
                  <Box sx={{ flexGrow: 1, mr: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 0.5, fontWeight: 600 }}>
                      {department.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ mb: 2, maxWidth: 300 }}
                    >
                      {department.description || 'Aucune description définie'}
                    </Typography>
                    
                    {/* Status Chip */}
                    <Chip
                      size="small"
                      label={department.isActive ? 'Département Actif' : 'Département Inactif'}
                      color={department.isActive ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>

                  {/* Manager & Budget */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 3, minWidth: 200 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={500}>
                        {getDepartmentManagerName(department.managerId)}
                      </Typography>
                    </Box>
                    
                    {department.budget ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EuroIcon sx={{ fontSize: 18, mr: 1, color: 'success.main' }} />
                        <Typography variant="body2" color="success.main" fontWeight={600}>
                          {department.budget.toLocaleString()} €
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                        Budget non défini
                      </Typography>
                    )}
                  </Box>

                  {/* Team Count if available */}
                  {departmentStats?.departmentBreakdown && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 3 }}>
                      <Typography variant="h4" color="primary.main" fontWeight="bold">
                        {departmentStats.departmentBreakdown.find((d: any) => d.departmentId === department.id)?.userCount || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {departmentStats.departmentBreakdown.find((d: any) => d.departmentId === department.id)?.userCount === 1 ? 'membre' : 'membres'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Tooltip title="Modifier le département">
                    <IconButton 
                      onClick={() => handleOpenDepartmentDialog(department)}
                      sx={{ 
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Supprimer le département">
                    <IconButton 
                      color="error"
                      onClick={() => handleDeleteDepartment(department.id)}
                      sx={{ 
                        '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            ))}

            {departments.length === 0 && (
              <Alert severity="info">
                Aucun département configuré. Créez votre premier département pour commencer à organiser vos équipes.
              </Alert>
            )}
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h5" gutterBottom>
                  Gestion des Services
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gérez les services de votre organisation et affectez-y des responsables
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenServiceDialog()}
              >
                Nouveau Service
              </Button>
            </Stack>
          </Box>

          <Stack spacing={2}>
            {services.map((service) => (
              <Card 
                key={service.id}
                sx={{ 
                  p: 3, 
                  display: 'flex', 
                  alignItems: 'center',
                  '&:hover': { 
                    boxShadow: 4,
                    borderColor: `${service.color  }40`
                  },
                  borderLeft: 4,
                  borderLeftColor: service.color,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                  {/* Service Icon & Name */}
                  <Avatar
                    sx={{ 
                      bgcolor: service.color, 
                      mr: 3, 
                      width: 56, 
                      height: 56,
                      boxShadow: 2
                    }}
                  >
                    <GroupIcon sx={{ fontSize: 28 }} />
                  </Avatar>
                  
                  {/* Service Info */}
                  <Box sx={{ flexGrow: 1, mr: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 0.5, fontWeight: 600 }}>
                      {service.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ mb: 2, maxWidth: 300 }}
                    >
                      {service.description || 'Aucune description définie'}
                    </Typography>
                    
                    {/* Status Chip */}
                    <Chip
                      size="small"
                      label={service.isActive ? 'Service Actif' : 'Service Inactif'}
                      color={service.isActive ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>

                  {/* Manager & Budget */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 3, minWidth: 200 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" fontWeight={500}>
                        {getManagerName(service.manager)}
                      </Typography>
                    </Box>
                    
                    {service.budget ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EuroIcon sx={{ fontSize: 18, mr: 1, color: 'success.main' }} />
                        <Typography variant="body2" color="success.main" fontWeight={600}>
                          {service.budget.toLocaleString()} €
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                        Budget non défini
                      </Typography>
                    )}
                  </Box>

                  {/* Team Count if available */}
                  {serviceStats?.serviceBreakdown && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 3 }}>
                      <Typography variant="h4" color="primary.main" fontWeight="bold">
                        {serviceStats.serviceBreakdown.find((s: any) => s.serviceId === service.id)?.userCount || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {serviceStats.serviceBreakdown.find((s: any) => s.serviceId === service.id)?.userCount === 1 ? 'membre' : 'membres'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Tooltip title="Modifier le service">
                    <IconButton 
                      onClick={() => handleOpenServiceDialog(service)}
                      sx={{ 
                        bgcolor: 'action.hover',
                        '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Supprimer le service">
                    <IconButton 
                      color="error"
                      onClick={() => handleDeleteService(service.id)}
                      sx={{ 
                        '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            ))}

            {services.length === 0 && (
              <Alert severity="info">
                Aucun service configuré. Créez votre premier service pour commencer à organiser vos équipes.
              </Alert>
            )}
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Affectation des Ressources aux Départements
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Assignez vos collaborateurs aux différents départements de l'organisation
            </Typography>

            {/* Statistiques d'affectation départements */}
            {departmentStats && (
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Card sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    borderTop: 3,
                    borderTopColor: 'primary.main',
                    '&:hover': { boxShadow: 4 },
                    transition: 'box-shadow 0.2s'
                  }}>
                    <PersonIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h3" fontWeight="bold" color="primary.main">
                      {users.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Total Utilisateurs
                    </Typography>
                  </Card>
                </Box>
                
                <Box>
                  <Card sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    borderTop: 3,
                    borderTopColor: 'success.main',
                    '&:hover': { boxShadow: 4 },
                    transition: 'box-shadow 0.2s'
                  }}>
                    <BusinessIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                    <Typography variant="h3" fontWeight="bold" color="success.main">
                      {departmentStats.totalUsersAssigned}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Assignés aux Dpts
                    </Typography>
                  </Card>
                </Box>
                
                <Box>
                  <Card sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    borderTop: 3,
                    borderTopColor: 'warning.main',
                    '&:hover': { boxShadow: 4 },
                    transition: 'box-shadow 0.2s'
                  }}>
                    <AssignmentIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                    <Typography variant="h3" fontWeight="bold" color="warning.main">
                      {departmentStats.unassignedUsers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Sans Département
                    </Typography>
                  </Card>
                </Box>
                
                <Box>
                  <Card sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    borderTop: 3,
                    borderTopColor: departmentStats.totalUsersAssigned > 0 && Math.round((departmentStats.totalUsersAssigned / users.length) * 100) >= 80 ? 'success.main' : 'info.main',
                    '&:hover': { boxShadow: 4 },
                    transition: 'box-shadow 0.2s'
                  }}>
                    <BusinessIcon sx={{ 
                      fontSize: 40, 
                      color: departmentStats.totalUsersAssigned > 0 && Math.round((departmentStats.totalUsersAssigned / users.length) * 100) >= 80 ? 'success.main' : 'info.main', 
                      mb: 1 
                    }} />
                    <Typography 
                      variant="h3" 
                      fontWeight="bold" 
                      color={departmentStats.totalUsersAssigned > 0 && Math.round((departmentStats.totalUsersAssigned / users.length) * 100) >= 80 ? 'success.main' : 'info.main'}
                    >
                      {users.length > 0 ? Math.round((departmentStats.totalUsersAssigned / users.length) * 100) : 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Taux d'Organisation
                    </Typography>
                  </Card>
                </Box>
              </Box>
            )}
          </Box>

          {/* Utilisateurs non assignés aux départements */}
          {unassignedUsersDept.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    bgcolor: 'warning.main', 
                    borderRadius: '50%', 
                    mr: 2 
                  }} 
                />
                Utilisateurs sans département ({unassignedUsersDept.length})
              </Typography>
              
              <Stack spacing={2}>
                {unassignedUsersDept.map((user) => (
                  <Card 
                    key={user.id}
                    sx={{ 
                      p: 2.5, 
                      display: 'flex', 
                      alignItems: 'center',
                      borderLeft: 3,
                      borderLeftColor: 'warning.main',
                      '&:hover': { 
                        boxShadow: 3,
                        borderLeftColor: 'warning.dark'
                      },
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                      <Avatar 
                        sx={{ 
                          mr: 3, 
                          width: 48, 
                          height: 48,
                          bgcolor: 'warning.light',
                          color: 'warning.contrastText',
                          fontWeight: 600
                        }}
                      >
                        {user.firstName[0]}{user.lastName[0]}
                      </Avatar>
                      
                      <Box sx={{ flexGrow: 1, mr: 3 }}>
                        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Chip 
                          label={getRoleDisplayLabel(user.role)} 
                          size="small" 
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ minWidth: 250 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Assigner à un département</InputLabel>
                        <Select
                          value=""
                          onChange={(e) => handleAssignUserToDepartment(user.id, e.target.value || null)}
                        >
                          {departments.map((department) => (
                            <MenuItem key={department.id} value={department.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box 
                                  sx={{ 
                                    width: 12, 
                                    height: 12, 
                                    bgcolor: department.color, 
                                    borderRadius: '50%', 
                                    mr: 2 
                                  }} 
                                />
                                {department.name}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {/* Répartition par département */}
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Répartition par Département
          </Typography>
          
          <Stack spacing={3}>
            {departmentStats?.departmentBreakdown.map((departmentGroup: any) => {
              const departmentColor = departments.find((d: any) => d.id === departmentGroup.departmentId)?.color || '#666';
              return (
                <Card 
                  key={departmentGroup.departmentId}
                  sx={{ 
                    borderLeft: 4,
                    borderLeftColor: departmentColor,
                    '&:hover': { 
                      boxShadow: 3,
                      borderLeftColor: `${departmentColor  }CC`
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Department Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          sx={{ 
                            bgcolor: departmentColor,
                            mr: 2,
                            width: 40,
                            height: 40
                          }}
                        >
                          <BusinessIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {departmentGroup.departmentName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Département organisationnel
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="primary.main" fontWeight="bold">
                            {departmentGroup.userCount}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {departmentGroup.userCount === 1 ? 'membre' : 'membres'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {/* Team Members */}
                    {departmentGroup.userCount > 0 ? (
                      <Stack spacing={1.5}>
                        {departmentGroup.users.map((user: User) => (
                          <Box 
                            key={user.id} 
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              p: 1.5,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              border: 1,
                              borderColor: 'divider',
                              '&:hover': { 
                                bgcolor: 'action.hover',
                                borderColor: `${departmentColor  }40`
                              },
                              transition: 'all 0.2s ease-in-out'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar 
                                sx={{ 
                                  width: 32, 
                                  height: 32, 
                                  mr: 2,
                                  bgcolor: `${departmentColor  }20`,
                                  color: departmentColor,
                                  fontSize: 14,
                                  fontWeight: 600
                                }}
                              >
                                {user.firstName[0]}{user.lastName[0]}
                              </Avatar>
                              <Box>
                                <Typography variant="body1" fontWeight={500}>
                                  {user.firstName} {user.lastName}
                                </Typography>
                                <Chip 
                                  label={getRoleDisplayLabel(user.role)} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ 
                                    fontSize: 10, 
                                    height: 20,
                                    textTransform: 'capitalize'
                                  }}
                                />
                              </Box>
                            </Box>
                            
                            <Tooltip title="Retirer du département">
                              <IconButton 
                                size="small"
                                onClick={() => handleAssignUserToDepartment(user.id, null)}
                                sx={{ 
                                  color: 'text.secondary',
                                  '&:hover': { 
                                    color: 'warning.main',
                                    bgcolor: 'rgba(255, 193, 7, 0.2)'
                                  }
                                }}
                              >
                                <SwapIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Alert 
                        severity="info" 
                        sx={{ 
                          borderColor: `${departmentColor  }40`,
                          '& .MuiAlert-icon': { color: departmentColor }
                        }}
                      >
                        Aucun membre assigné à ce département. Utilisez la section ci-dessus pour affecter des utilisateurs.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" gutterBottom color="primary.main" sx={{ fontWeight: 'bold' }}>
              🎯 Affectation Multi-Services
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Interface simple : <strong>UN UTILISATEUR = PLUSIEURS SERVICES POSSIBLES</strong>
            </Typography>
          </Box>

          {/* INTERFACE SIMPLE : LISTE DES UTILISATEURS */}
          <Stack spacing={3}>
            {users.map((user) => {
              // Récupérer les services actuels de l'utilisateur
              const currentServiceIds = user.serviceIds || [];
              
              return (
                <Paper 
                  key={user.id}
                  elevation={2}
                  sx={{ 
                    p: 3,
                    borderLeft: 4,
                    borderLeftColor: currentServiceIds.length > 0 ? 'success.main' : 'warning.main'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                    {/* UTILISATEUR */}
                    <Avatar sx={{ 
                      width: 64, 
                      height: 64,
                      bgcolor: 'primary.main',
                      fontSize: 24,
                      fontWeight: 'bold'
                    }}>
                      {user.firstName[0]}{user.lastName[0]}
                    </Avatar>
                    
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h5" fontWeight="bold">
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {user.email} • {getRoleDisplayLabel(user.role)}
                      </Typography>
                      <Typography variant="body2" color={currentServiceIds.length > 0 ? 'success.main' : 'warning.main'}>
                        {currentServiceIds.length > 0 
                          ? `✅ ${currentServiceIds.length} service(s) assigné(s)`
                          : '❌ Aucun service assigné'
                        }
                      </Typography>
                    </Box>
                  </Box>

                  {/* SERVICES - CHECKBOXES SIMPLES */}
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Services disponibles :
                  </Typography>
                  
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {services.map((service) => {
                      const isAssigned = currentServiceIds.includes(service.id);
                      
                      return (
                        <Box>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isAssigned}
                                onChange={async (e) => {
                                  try {
                                    const userRef = doc(db, 'users', user.id);
                                    let newServiceIds = [...currentServiceIds];
                                    
                                    if (e.target.checked) {
                                      // AJOUTER le service
                                      if (!newServiceIds.includes(service.id)) {
                                        newServiceIds.push(service.id);
                                      }
                                    } else {
                                      // RETIRER le service
                                      newServiceIds = newServiceIds.filter(id => id !== service.id);
                                    }
                                    
                                    // MISE À JOUR FIRESTORE
                                    await updateDoc(userRef, {
                                      serviceIds: newServiceIds,
                                      updatedAt: new Date()
                                    });
                                    
                                    // RECHARGER
                                    await loadData();
                                    
                                    console.log(`✅ ${e.target.checked ? 'Ajouté' : 'Retiré'} service ${service.name} pour ${user.firstName}`);
                                  } catch (error) {
                                    console.error('Erreur modification service:', error);
                                  }
                                }}
                                sx={{
                                  color: service.color,
                                  '&.Mui-checked': {
                                    color: service.color
                                  }
                                }}
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    bgcolor: service.color
                                  }}
                                />
                                <Typography variant="body1" fontWeight={isAssigned ? 'bold' : 'normal'}>
                                  {service.name}
                                </Typography>
                                {isAssigned && (
                                  <Chip 
                                    label="✓" 
                                    size="small" 
                                    sx={{ 
                                      height: 20,
                                      bgcolor: `${service.color  }20`,
                                      color: service.color
                                    }} 
                                  />
                                )}
                              </Box>
                            }
                            sx={{
                              '& .MuiFormControlLabel-label': {
                                fontSize: '1rem',
                                fontWeight: isAssigned ? 'bold' : 'normal',
                                color: isAssigned ? service.color : 'text.primary'
                              }
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>

                  {/* RÉSUMÉ SERVICES ACTUELS */}
                  {currentServiceIds.length > 0 && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                        ✅ Services actuels de {user.firstName} :
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {currentServiceIds.map(serviceId => {
                          const service = services.find(s => s.id === serviceId);
                          return service ? (
                            <Chip
                              key={serviceId}
                              label={service.name}
                              size="small"
                              sx={{
                                bgcolor: service.color,
                                color: 'white',
                                fontWeight: 'bold'
                              }}
                            />
                          ) : null;
                        })}
                      </Box>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <SkillsTab />
        </TabPanel>
      </Paper>

      {/* Service Dialog */}
      <Dialog 
        open={serviceDialogOpen} 
        onClose={handleCloseServiceDialog} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingService ? 'Modifier le service' : 'Créer un nouveau service'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box>
                <TextField
                  label="Nom du service"
                  fullWidth
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                />
              </Box>
              
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Couleur du service
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {DEFAULT_COLORS.map((color) => (
                      <Box
                        key={color}
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: color,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: serviceForm.color === color ? 3 : 1,
                          borderColor: serviceForm.color === color ? 'primary.main' : 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => setServiceForm({ ...serviceForm, color })}
                      >
                        {serviceForm.color === color && (
                          <PaletteIcon sx={{ color: 'white', fontSize: 16 }} />
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>

              <Box>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                />
              </Box>

              <Box>
                <FormControl fullWidth>
                  <InputLabel>Manager du service</InputLabel>
                  <Select
                    value={serviceForm.manager || ''}
                    onChange={(e) => setServiceForm({ ...serviceForm, manager: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Aucun manager</em>
                    </MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <TextField
                  label="Budget (€)"
                  type="number"
                  fullWidth
                  value={serviceForm.budget}
                  onChange={(e) => setServiceForm({ 
                    ...serviceForm, 
                    budget: Number(e.target.value) 
                  })}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseServiceDialog}>
            Annuler
          </Button>
          <Button 
            onClick={handleSaveService} 
            variant="contained"
            disabled={!serviceForm.name.trim()}
          >
            {editingService ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Department Dialog */}
      <Dialog 
        open={departmentDialogOpen} 
        onClose={handleCloseDepartmentDialog} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingDepartment ? 'Modifier le département' : 'Créer un nouveau département'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Box>
                <TextField
                  label="Nom du département"
                  fullWidth
                  required
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                />
              </Box>
              
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Couleur du département
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {DEFAULT_COLORS.map((color) => (
                      <Box
                        key={color}
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: color,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: departmentForm.color === color ? 3 : 1,
                          borderColor: departmentForm.color === color ? 'primary.main' : 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => setDepartmentForm({ ...departmentForm, color })}
                      >
                        {departmentForm.color === color && (
                          <PaletteIcon sx={{ color: 'white', fontSize: 16 }} />
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>

              <Box>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={departmentForm.description}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                />
              </Box>

              <Box>
                <FormControl fullWidth>
                  <InputLabel>Responsable du département</InputLabel>
                  <Select
                    value={departmentForm.managerId || ''}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, managerId: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Aucun responsable</em>
                    </MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <TextField
                  label="Budget (€)"
                  type="number"
                  fullWidth
                  value={departmentForm.budget}
                  onChange={(e) => setDepartmentForm({ 
                    ...departmentForm, 
                    budget: Number(e.target.value) 
                  })}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDepartmentDialog}>
            Annuler
          </Button>
          <Button 
            onClick={handleSaveDepartment} 
            variant="contained"
            disabled={!departmentForm.name.trim()}
          >
            {editingDepartment ? 'Modifier' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};