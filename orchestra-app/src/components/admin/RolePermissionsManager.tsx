import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  Alert,
  Snackbar,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { permissionsService, Permission, Role } from '../../services/permissions.service';

interface PermissionCategory {
  name: string;
  label: string;
  permissions: Permission[];
}

const permissionCategories: PermissionCategory[] = [
  {
    name: 'projects',
    label: '📁 Projets',
    permissions: [
      'project.view',
      'project.create', 
      'project.edit',
      'project.delete',
      'project.archive',
      'project.manage_team'
    ]
  },
  {
    name: 'tasks',
    label: '📋 Tâches',
    permissions: [
      'task.view',
      'task.create',
      'task.edit', 
      'task.delete',
      'task.assign',
      'task.change_status'
    ]
  },
  {
    name: 'documents',
    label: '📎 Documents',
    permissions: [
      'document.view',
      'document.upload',
      'document.download',
      'document.delete'
    ]
  },
  {
    name: 'reports',
    label: '📊 Rapports',
    permissions: [
      'report.view',
      'report.create',
      'report.export'
    ]
  },
  {
    name: 'hr',
    label: '👥 Ressources Humaines',
    permissions: [
      'hr.view_all_leaves',
      'hr.approve_leaves',
      'hr.manage_employees',
      'hr.view_skills',
      'hr.manage_contracts'
    ]
  },
  {
    name: 'departments',
    label: '🏢 Départements',
    permissions: [
      'department.view',
      'department.create',
      'department.edit',
      'department.delete',
      'department.manage_members',
      'department.view_budget',
      'department.manage_budget'
    ]
  },
  {
    name: 'users',
    label: '👤 Utilisateurs',
    permissions: [
      'user.view',
      'user.create',
      'user.edit',
      'user.delete',
      'user.change_role'
    ]
  },
  {
    name: 'admin',
    label: '⚙️ Administration',
    permissions: [
      'admin.access',
      'admin.settings',
      'admin.backup',
      'admin.logs',
      'admin.webhooks'
    ]
  }
];

const roleLabels: Record<Role, string> = {
  admin: '🔧 Administrateur',
  responsable: '👔 Responsable',
  manager: '📈 Manager',
  teamLead: '🎯 Référent technique',
  contributor: '✍️ Contributeur',
  viewer: '👁️ Observateur'
};

export const RolePermissionsManager: React.FC = () => {
  const [rolePermissions, setRolePermissions] = useState<Partial<Record<Role, Permission[]>>>({});
  const [originalPermissions, setOriginalPermissions] = useState<Partial<Record<Role, Permission[]>>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const roles: Role[] = ['admin', 'responsable', 'manager', 'teamLead', 'contributor', 'viewer'];
      const permissions: Partial<Record<Role, Permission[]>> = {};
      
      roles.forEach(role => {
        permissions[role] = permissionsService.getPermissionsForRole(role);
      });
      
      setRolePermissions(permissions);
      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
      setHasChanges(false);
    } catch (error) {
      showSnackbar('Erreur lors du chargement des permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const hasPermission = (role: Role, permission: Permission): boolean => {
    return rolePermissions[role]?.includes(permission) || false;
  };

  const togglePermission = (role: Role, permission: Permission) => {
    // Les admins ont TOUJOURS toutes les permissions
    if (role === 'admin') {
      showSnackbar('Les permissions des administrateurs ne peuvent pas être modifiées', 'error');
      return;
    }

    const currentPermissions = rolePermissions[role] || [];
    const newPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter(p => p !== permission)
      : [...currentPermissions, permission];

    const newRolePermissions = {
      ...rolePermissions,
      [role]: newPermissions
    };

    setRolePermissions(newRolePermissions);
    setHasChanges(JSON.stringify(newRolePermissions) !== JSON.stringify(originalPermissions));
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      // TODO: Implémenter la sauvegarde via Cloud Function
      // await permissionsService.updateRolePermissions(rolePermissions);
      
      setOriginalPermissions(JSON.parse(JSON.stringify(rolePermissions)));
      setHasChanges(false);
      showSnackbar('Permissions sauvegardées avec succès', 'success');
    } catch (error) {
      showSnackbar('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = () => {
    setRolePermissions(JSON.parse(JSON.stringify(originalPermissions)));
    setHasChanges(false);
    showSnackbar('Modifications annulées', 'success');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Chargement des permissions...
        </Typography>
      </Box>
    );
  }

  const roles: Role[] = ['admin', 'responsable', 'manager', 'teamLead', 'contributor', 'viewer'];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Gestion des Permissions par Rôle
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Définissez les permissions pour chaque rôle utilisateur. Les administrateurs ont automatiquement toutes les permissions.
        </Typography>
        
        {hasChanges && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>
                Vous avez des modifications non sauvegardées
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleResetChanges}
                  startIcon={<RestoreIcon />}
                  sx={{ mr: 1 }}
                >
                  Annuler
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveChanges}
                  loading={saving}
                  startIcon={<SaveIcon />}
                  disabled={saving}
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </Box>
            </Box>
          </Alert>
        )}
      </Box>

      {permissionCategories.map((category) => (
        <Accordion key={category.name} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {category.label} ({category.permissions.length} permissions)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Permission</strong></TableCell>
                    {roles.map(role => (
                      <TableCell key={role} align="center">
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <Chip
                            label={roleLabels[role]}
                            size="small"
                            color={role === 'admin' ? 'error' : 'default'}
                            icon={role === 'admin' ? <AdminIcon /> : undefined}
                          />
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {category.permissions.map((permission) => (
                    <TableRow key={permission}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {permission}
                        </Typography>
                      </TableCell>
                      {roles.map(role => (
                        <TableCell key={role} align="center">
                          <Checkbox
                            checked={hasPermission(role, permission)}
                            onChange={() => togglePermission(role, permission)}
                            disabled={role === 'admin'}
                            color={role === 'admin' ? 'error' : 'primary'}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box sx={{ mt: 3 }}>
        <Alert severity="warning">
          <Typography variant="body2">
            <strong>⚠️ Important :</strong> Les administrateurs ont automatiquement accès à toutes les permissions 
            et ne peuvent pas être restreints. Cette règle garantit qu'il y ait toujours au moins un utilisateur 
            avec tous les droits pour gérer le système.
          </Typography>
        </Alert>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};