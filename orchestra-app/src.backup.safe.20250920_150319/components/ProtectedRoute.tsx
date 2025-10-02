import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Box, Typography, Button } from '@mui/material';
import { LockOutlined } from '@mui/icons-material';
import { permissionsService, Permission } from '../services/permissions.service';
import { AuthMiddleware } from '../middleware/auth.middleware';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRoles?: string[];
  requiredPermissions?: Permission[];
  requireAll?: boolean; // true = toutes les permissions, false = au moins une (défaut: true)
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  requireAll = true
}) => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  // Si non authentifié, rediriger vers login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Vérifier les rôles requis
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(user.role);
    if (!hasRequiredRole) {
      return <AccessDenied requiredRoles={requiredRoles} userRole={user.role} />;
    }
  }

  // Vérifier les permissions requises
  if (requiredPermissions.length > 0) {
    const hasPermissions = requireAll 
      ? permissionsService.hasAllPermissions(user, requiredPermissions)
      : permissionsService.hasAnyPermission(user, requiredPermissions);
    
    if (!hasPermissions) {
      return (
        <AccessDenied 
          requiredPermissions={requiredPermissions} 
          userPermissions={permissionsService.getPermissionsForRole(user.role)}
          requireAll={requireAll}
        />
      );
    }
  }

  // Vérifier automatiquement les permissions de route
  if (!AuthMiddleware.canAccessRoute(location.pathname)) {
    const routePermissions = AuthMiddleware.getRoutePermissions(location.pathname);
    return (
      <AccessDenied 
        routePath={location.pathname}
        requiredPermissions={routePermissions}
        userPermissions={permissionsService.getPermissionsForRole(user.role)}
      />
    );
  }

  return children;
};

interface AccessDeniedProps {
  requiredRoles?: string[];
  userRole?: string;
  requiredPermissions?: Permission[];
  userPermissions?: Permission[];
  requireAll?: boolean;
  routePath?: string;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredRoles = [],
  userRole,
  requiredPermissions = [],
  userPermissions = [],
  requireAll = true,
  routePath
}) => {
  const getErrorMessage = () => {
    if (requiredRoles.length > 0) {
      return `Cette page nécessite un des rôles suivants: ${requiredRoles.join(', ')}. Votre rôle actuel: ${userRole}`;
    }
    
    if (requiredPermissions.length > 0) {
      const missing = requiredPermissions.filter(p => !userPermissions.includes(p));
      const mode = requireAll ? 'toutes' : 'au moins une';
      return `Cette page nécessite ${mode} des permissions suivantes: ${requiredPermissions.join(', ')}. ${
        missing.length > 0 ? `Permissions manquantes: ${missing.join(', ')}` : ''
      }`;
    }

    if (routePath) {
      const routePerms = AuthMiddleware.getRoutePermissions(routePath);
      if (routePerms.length > 0) {
        return `Accès à la route "${routePath}" nécessite une des permissions: ${routePerms.join(', ')}`;
      }
    }

    return 'Vous n\'avez pas les permissions nécessaires pour accéder à cette page.';
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={3}
      sx={{ p: 3 }}
    >
      <LockOutlined sx={{ fontSize: 64, color: 'error.main' }} />
      <Typography variant="h4" gutterBottom color="error">
        Accès refusé
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={600}>
        {getErrorMessage()}
      </Typography>
      
      {userPermissions.length > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, minWidth: 400 }}>
          <Typography variant="h6" gutterBottom>
            Vos permissions actuelles:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {userPermissions.map((permission) => (
              <Box 
                key={permission}
                sx={{ 
                  px: 1, 
                  py: 0.5, 
                  bgcolor: 'primary.light', 
                  color: 'primary.contrastText',
                  borderRadius: 1,
                  fontSize: '0.75rem'
                }}
              >
                {permission}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Button variant="contained" href="/dashboard-hub" sx={{ mt: 2 }}>
        Retour au tableau de bord
      </Button>
    </Box>
  );
};