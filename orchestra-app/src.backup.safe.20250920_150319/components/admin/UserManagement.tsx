import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Avatar,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOffIcon,
  Block as BlockIcon,
  CheckCircle as ActiveIcon,
  Refresh as RefreshIcon,
  VpnKey as PasswordIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { userService } from '../../services/user.service';
import { departmentService } from '../../services/department.service';
import { ServiceService } from '../../services/service.service';
import { User, UserRole, Department } from '../../types';
import { Service } from '../../types/service';
import { getRoleDisplayLabel, getRoleColor } from '../../utils/roleUtils';
import { auth } from '../../config/firebase';
import { PasswordResetModal } from './PasswordResetModal';

interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  department?: string;
  password?: string;
}

interface BatchUserData {
  firstName: string;
  lastName: string;
  role: UserRole;
  department: string;
  service: string;
}

interface BatchCreateData {
  users: BatchUserData[];
  commonPassword: string;
}

const serviceService = new ServiceService();

export const UserManagement: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.auth.user);

  // Vérifier si l'utilisateur actuel peut modifier les rôles (seuls admin et responsable)
  const canManageUserRoles = () => {
    return currentUser?.role === 'admin' || currentUser?.role === 'responsable';
  };
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Factory function pour s'assurer d'avoir toujours des données propres
  const createEmptyFormData = (): CreateUserData => ({
    firstName: '',
    lastName: '',
    email: '',
    role: 'contributor',
    department: '',
    password: '',
  });

  const [formData, setFormData] = useState<CreateUserData>(createEmptyFormData());
  
  // États pour la création en lot
  const [batchData, setBatchData] = useState<BatchCreateData>({
    users: [{ firstName: '', lastName: '', role: 'contributor', department: '', service: '' }],
    commonPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showBatchPassword, setShowBatchPassword] = useState(false);

  const roles: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'responsable', label: 'Responsable' },
    { value: 'manager', label: 'Manager' },
    { value: 'teamLead', label: 'Référent technique' },
    { value: 'contributor', label: 'Contributeur' },
    { value: 'viewer', label: 'Observateur' },
  ];

  // Les départements et services sont maintenant chargés dynamiquement

  useEffect(() => {
    loadUsers();
    loadDepartmentsAndServices();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersList = await userService.getAllUsers();
      setUsers(usersList);
    } catch (error) {
      
      showSnackbar('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const loadDepartmentsAndServices = async () => {
    try {
      const [deptList, serviceList] = await Promise.all([
        departmentService.getAllDepartments(),
        serviceService.getAllServices()
      ]);
      setDepartments(deptList);
      setServices(serviceList);
    } catch (error) {
      
      showSnackbar('Erreur lors du chargement des départements/services', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handlePasswordReset = (user: User) => {
    setPasswordResetUser(user);
    setPasswordResetOpen(true);
  };

  const handlePasswordResetSuccess = (message: string) => {
    showSnackbar(message, 'success');
    setPasswordResetOpen(false);
    setPasswordResetUser(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const resetModalState = () => {
    setEditingUser(null);
    setShowPassword(false);
    setFormData(createEmptyFormData());
  };

  const openCreateDialog = () => {
    resetModalState();
    setDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role,
      department: user.department || '',
      password: '',
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetModalState();
  };

  const generateAlternativeEmail = (firstName: string, lastName: string, suffix: string = ''): string => {
    const baseLogin = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`.replace(/[^a-z_]/g, '');
    return `${baseLogin}${suffix}@orchestr-a.internal`;
  };

  const generateRandomSuffix = (): string => {
    return Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  };

  const handleGenerateAlternativeLogin = () => {
    if (formData.firstName && formData.lastName) {
      const suffix = generateRandomSuffix();
      const newEmail = generateAlternativeEmail(formData.firstName, formData.lastName, suffix);
      handleInputChange('email', newEmail);
      showSnackbar(`Nouveau login généré : ${newEmail.split('@')[0]}`, 'success');
    }
  };

  const handleInputChange = (field: keyof CreateUserData, value: string) => {
    const updatedFormData = { ...formData, [field]: value };
    
    // Auto-génération de l'email UNIQUEMENT si on crée un utilisateur ET qu'on modifie nom/prénom
    if (!editingUser && (field === 'firstName' || field === 'lastName')) {
      const firstName = field === 'firstName' ? value.trim() : formData.firstName.trim();
      const lastName = field === 'lastName' ? value.trim() : formData.lastName.trim();
      
      if (firstName && lastName) {
        updatedFormData.email = generateAlternativeEmail(firstName, lastName);
      } else {
        // Si l'un des champs est vide, on vide l'email
        updatedFormData.email = '';
      }
    }
    
    setFormData(updatedFormData);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        showSnackbar('Veuillez remplir tous les champs obligatoires', 'error');
        return;
      }

      if (!editingUser && !formData.password) {
        showSnackbar('Veuillez définir un mot de passe', 'error');
        return;
      }

      if (editingUser) {
        // MODIFICATION D'UTILISATEUR EXISTANT
        // On modifie SEULEMENT Firestore, pas Firebase Auth
        
        const newLogin = formData.email.split('@')[0];
        
        // Mise à jour des données dans Firestore
        const userData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          displayName: `${formData.firstName} ${formData.lastName}`,
          role: formData.role,
          department: formData.department,
          email: formData.email,
          login: newLogin
        };
        
        await userService.updateUser(editingUser.id, userData);
        showSnackbar('Utilisateur mis à jour avec succès');
      } else {
        // Création avec login interne utilisant l'email du formulaire
        // Extraire le login de l'email (avant le @)
        const login = formData.email.split('@')[0];
        
        // Utiliser AdminUserCreationService pour créer l'utilisateur
        const { adminUserCreationService } = await import('../../services/admin-user-creation.service');
        
        await adminUserCreationService.createUserWithLogin({
          login,
          password: formData.password!,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          department: formData.department,
          displayName: `${formData.firstName} ${formData.lastName}`
        }, currentUser!.id);

        showSnackbar(`Utilisateur créé avec succès\nEmail: ${formData.email}\nMot de passe: ${formData.password}`, 'success');
      }

      // Fermer la modal et recharger la liste
      handleCloseDialog();
      await loadUsers();
    } catch (error: any) {
      
      
      // Gestion spécifique des erreurs de login
      if (error.message && error.message.includes('login est déjà utilisé')) {
        const login = formData.email.split('@')[0];
        showSnackbar(`❌ Le login "${login}" est déjà utilisé.\n💡 Changez le prénom/nom ou modifiez l'email manuellement.`, 'error');
      } else {
        showSnackbar(error.message || 'Erreur lors de la sauvegarde', 'error');
      }
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await userService.updateUser(user.id, { isActive: !user.isActive });
      showSnackbar(`Utilisateur ${user.isActive ? 'désactivé' : 'activé'} avec succès`);
      loadUsers();
    } catch (error) {
      
      showSnackbar('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.displayName} ?`)) {
      try {
        await userService.deleteUser(user.id);
        showSnackbar('Utilisateur supprimé avec succès');
        loadUsers();
      } catch (error) {
        
        showSnackbar('Erreur lors de la suppression', 'error');
      }
    }
  };

  // Utilisation des utilitaires centralisés pour les rôles (roleUtils.ts)
  
  // Fonctions pour la création en lot
  const addBatchUser = () => {
    setBatchData(prev => ({
      ...prev,
      users: [...prev.users, { firstName: '', lastName: '', role: 'contributor', department: '', service: '' }]
    }));
  };
  
  const removeBatchUser = (index: number) => {
    if (batchData.users.length > 1) {
      setBatchData(prev => ({
        ...prev,
        users: prev.users.filter((_, i) => i !== index)
      }));
    }
  };
  
  const updateBatchUser = (index: number, field: keyof BatchUserData, value: string) => {
    setBatchData(prev => ({
      ...prev,
      users: prev.users.map((user, i) => 
        i === index ? { ...user, [field]: value } : user
      )
    }));
  };
  
  const handleBatchSubmit = async () => {
    try {
      if (!batchData.commonPassword) {
        showSnackbar('Veuillez définir un mot de passe commun', 'error');
        return;
      }
      
      const validUsers = batchData.users.filter(user => user.firstName && user.lastName);
      if (validUsers.length === 0) {
        showSnackbar('Veuillez remplir au moins un utilisateur complet', 'error');
        return;
      }
      
      let createdCount = 0;
      let errorCount = 0;
      
      for (const user of validUsers) {
        try {
          const login = `${user.firstName.toLowerCase()}_${user.lastName.toLowerCase()}`.replace(/[^a-z_]/g, '');
          
          const { adminUserCreationService } = await import('../../services/admin-user-creation.service');
          
          await adminUserCreationService.createUserWithLogin({
            login,
            password: batchData.commonPassword,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            department: user.department,
            service: user.service,
            displayName: `${user.firstName} ${user.lastName}`
          }, currentUser!.id);
          
          createdCount++;
        } catch (error: any) {
          
          
          // Si c'est une erreur de synchronisation, on considère comme succès
          if (error.message && error.message.includes('synchronisé')) {
            createdCount++;
          } else {
            errorCount++;
            // Afficher le détail de l'erreur pour cet utilisateur
            // On n'affiche pas le message ici car il sera affiché dans le récapitulatif
          }
        }
      }
      
      setBatchDialogOpen(false);
      setBatchData({
        users: [{ firstName: '', lastName: '', role: 'contributor', department: '', service: '' }],
        commonPassword: ''
      });
      
      if (createdCount > 0) {
        showSnackbar(`${createdCount} utilisateur(s) créé(s) avec succès${errorCount > 0 ? ` (${errorCount} erreur(s))` : ''}`, 'success');
        await loadUsers();
      } else {
        showSnackbar('Aucun utilisateur créé', 'error');
      }
      
    } catch (error: any) {
      
      showSnackbar(error.message || 'Erreur lors de la création en lot', 'error');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
        <Typography ml={2}>Chargement des utilisateurs...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          👥 Gestion des Utilisateurs
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            color="primary"
          >
            Nouvel Utilisateur
          </Button>
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={() => setBatchDialogOpen(true)}
            color="primary"
          >
            Création en lot
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Utilisateur</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Rôle</TableCell>
              <TableCell>Département</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar src={user.avatarUrl}>
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {user.displayName || `${user.firstName} ${user.lastName}`}
                      </Typography>
                      {user.login && (
                        <Typography variant="caption" color="text.secondary">
                          Login: {user.login}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip 
                    label={getRoleDisplayLabel(user.role)} 
                    color={getRoleColor(user.role)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{user.department || '-'}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.loginType === 'internal' ? 'Interne' : 'Email'}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    icon={user.isActive ? <ActiveIcon /> : <BlockIcon />}
                    label={user.isActive ? 'Actif' : 'Inactif'}
                    color={user.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <Tooltip title="Modifier">
                      <IconButton 
                        size="small" 
                        onClick={() => openEditDialog(user)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.isActive ? 'Désactiver' : 'Activer'}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleToggleActive(user)}
                        color={user.isActive ? 'warning' : 'success'}
                      >
                        {user.isActive ? <BlockIcon /> : <ActiveIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Réinitialiser mot de passe">
                      <IconButton
                        size="small"
                        onClick={() => handlePasswordReset(user)}
                        color="secondary"
                      >
                        <PasswordIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteUser(user)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {users.length === 0 && (
        <Box textAlign="center" p={4}>
          <Typography color="text.secondary">
            Aucun utilisateur trouvé. Créez le premier utilisateur !
          </Typography>
        </Box>
      )}

      {/* Dialog de création/édition */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            
            {/* Interface avec champs auto-générés mais modifiables */}
            <Box display="flex" gap={2}>
              <TextField
                label="Prénom *"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                fullWidth
              />
              <TextField
                label="Nom *"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                fullWidth
              />
            </Box>

            <TextField
              label="Email de connexion *"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              helperText={!editingUser ? "Auto-généré mais modifiable" : "Email de connexion"}
              fullWidth
              placeholder="nom_prenom@orchestr-a.internal"
              InputProps={{
                endAdornment: !editingUser && formData.firstName && formData.lastName ? (
                  <InputAdornment position="end">
                    <Tooltip title="Générer un autre login">
                      <IconButton
                        onClick={handleGenerateAlternativeLogin}
                        edge="end"
                        size="small"
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ) : null,
              }}
            />

            <Box display="flex" gap={2}>
              <FormControl fullWidth>
                <InputLabel>Rôle *</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  label="Rôle *"
                  disabled={!canManageUserRoles()}
                  title={!canManageUserRoles() ? "Seuls les administrateurs et responsables peuvent modifier les rôles" : ""}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Département</InputLabel>
                <Select
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  label="Département"
                >
                  <MenuItem value="">
                    <em>Aucun</em>
                  </MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {!editingUser && (
              <TextField
                label="Mot de passe *"
                type={showPassword ? "text" : "password"}
                value={formData.password || ''}
                onChange={(e) => handleInputChange('password', e.target.value)}
                helperText="Mot de passe pour la connexion"
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon /> : <ViewIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            startIcon={editingUser ? <EditIcon /> : <PersonAddIcon />}
          >
            {editingUser ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de création en lot */}
      <Dialog 
        open={batchDialogOpen} 
        onClose={() => setBatchDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Création d'utilisateurs en lot
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} pt={1}>
            
            {/* Mot de passe commun */}
            <TextField
              label="Mot de passe commun *"
              type={showBatchPassword ? 'text' : 'password'}
              value={batchData.commonPassword}
              onChange={(e) => setBatchData(prev => ({ ...prev, commonPassword: e.target.value }))}
              fullWidth
              helperText="Ce mot de passe sera appliqué à tous les utilisateurs créés"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowBatchPassword(!showBatchPassword)}
                      edge="end"
                    >
                      {showBatchPassword ? <VisibilityOffIcon /> : <ViewIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            {/* Liste des utilisateurs */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Utilisateurs à créer ({batchData.users.length})
              </Typography>
              
              {batchData.users.map((user, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2 }} variant="outlined">
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle2">
                      Utilisateur #{index + 1}
                    </Typography>
                    {batchData.users.length > 1 && (
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => removeBatchUser(index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                  
                  <Box display="flex" flexDirection="column" gap={2}>
                    {/* Nom et prénom */}
                    <Box display="flex" gap={2}>
                      <TextField
                        label="Prénom *"
                        value={user.firstName}
                        onChange={(e) => updateBatchUser(index, 'firstName', e.target.value)}
                        fullWidth
                      />
                      <TextField
                        label="Nom *"
                        value={user.lastName}
                        onChange={(e) => updateBatchUser(index, 'lastName', e.target.value)}
                        fullWidth
                      />
                    </Box>
                    
                    {/* Rôle, département, service */}
                    <Box display="flex" gap={2}>
                      <FormControl fullWidth>
                        <InputLabel>Rôle</InputLabel>
                        <Select
                          value={user.role}
                          onChange={(e) => updateBatchUser(index, 'role', e.target.value as UserRole)}
                          label="Rôle"
                          disabled={!canManageUserRoles()}
                          title={!canManageUserRoles() ? "Seuls les administrateurs et responsables peuvent modifier les rôles" : ""}
                        >
                          {roles.map((role) => (
                            <MenuItem key={role.value} value={role.value}>
                              {role.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <FormControl fullWidth>
                        <InputLabel>Département</InputLabel>
                        <Select
                          value={user.department}
                          onChange={(e) => updateBatchUser(index, 'department', e.target.value)}
                          label="Département"
                        >
                          <MenuItem value="">
                            <em>Aucun</em>
                          </MenuItem>
                          {departments.map((dept) => (
                            <MenuItem key={dept.id} value={dept.name}>
                              {dept.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <FormControl fullWidth>
                        <InputLabel>Service</InputLabel>
                        <Select
                          value={user.service}
                          onChange={(e) => updateBatchUser(index, 'service', e.target.value)}
                          label="Service"
                        >
                          <MenuItem value="">
                            <em>Aucun</em>
                          </MenuItem>
                          {services.map((service) => (
                            <MenuItem key={service.id} value={service.name}>
                              {service.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    
                    {/* Aperçu de l'email qui sera généré */}
                    {user.firstName && user.lastName && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Email généré: {`${user.firstName.toLowerCase()}_${user.lastName.toLowerCase()}`.replace(/[^a-z_]/g, '')}@orchestr-a.internal
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              ))}
              
              {/* Bouton pour ajouter un utilisateur */}
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addBatchUser}
                fullWidth
                sx={{ mt: 1 }}
              >
                Ajouter un utilisateur
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleBatchSubmit} 
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={!batchData.commonPassword || batchData.users.every(u => !u.firstName || !u.lastName)}
          >
            Créer {batchData.users.filter(u => u.firstName && u.lastName).length} utilisateur(s)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {/* Modal de réinitialisation du mot de passe */}
      <PasswordResetModal
        open={passwordResetOpen}
        onClose={() => {
          setPasswordResetOpen(false);
          setPasswordResetUser(null);
        }}
        user={passwordResetUser}
        onSuccess={handlePasswordResetSuccess}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;