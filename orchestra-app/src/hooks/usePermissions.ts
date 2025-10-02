import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { permissionsService, Permission } from '../services/permissions.service';
import { User } from '../types';

/**
 * Hook pour vérifier les permissions de l'utilisateur connecté
 */
export const usePermissions = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  /**
   * Vérifier si l'utilisateur a une permission spécifique
   */
  const hasPermission = (permission: Permission): boolean => {
    // Cas spécial : admin a TOUTES les permissions
    if (user?.role === 'admin') {
      return true;
    }
    return permissionsService.hasPermission(user, permission);
  };

  /**
   * Vérifier si l'utilisateur a toutes les permissions requises
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    // Cas spécial : admin a TOUTES les permissions
    if (user?.role === 'admin') {
      return true;
    }
    return permissionsService.hasAllPermissions(user, permissions);
  };

  /**
   * Vérifier si l'utilisateur a au moins une des permissions requises
   */
  const hasAnyPermission = (permissions: Permission[]): boolean => {
    // Cas spécial : admin a TOUTES les permissions
    if (user?.role === 'admin') {
      return true;
    }
    return permissionsService.hasAnyPermission(user, permissions);
  };

  /**
   * Vérifier si l'utilisateur peut accéder à un projet
   */
  const canAccessProject = (projectId: string, isTeamMember: boolean = false): boolean => {
    return permissionsService.canAccessProject(user, projectId, isTeamMember);
  };

  /**
   * Vérifier si l'utilisateur peut modifier un projet
   */
  const canEditProject = (projectId: string, isManager: boolean = false): boolean => {
    return permissionsService.canEditProject(user, projectId, isManager);
  };

  /**
   * Vérifier si l'utilisateur peut assigner des tâches
   */
  const canAssignTasks = (): boolean => {
    return permissionsService.canAssignTasks(user);
  };

  /**
   * Vérifier si l'utilisateur peut approuver des congés
   */
  const canApproveLeaves = (): boolean => {
    return permissionsService.canApproveLeaves(user);
  };

  /**
   * Vérifier si l'utilisateur a accès à l'administration
   * CORRECTION : Vérifier directement le rôle pour admin et responsable
   */
  const hasAdminAccess = (): boolean => {
    // Vérification directe des rôles autorisés
    const roleCheck = user?.role === 'admin' || user?.role === 'responsable';
    
    // Fallback: vérifier via le service traditionnel
    const traditionalCheck = permissionsService.hasAdminAccess(user);
    
    // Si l'utilisateur a le rôle admin ou responsable, il a accès
    return roleCheck || traditionalCheck;
  };

  /**
   * Obtenir les routes accessibles pour l'utilisateur
   */
  const getAccessibleRoutes = (): string[] => {
    return permissionsService.getAccessibleRoutes(user);
  };

  /**
   * Obtenir les permissions de l'utilisateur actuel
   */
  const getUserPermissions = (): Permission[] => {
    if (!user) return [];
    
    // Cas spécial pour admin : toujours toutes les permissions
    if (user.role === 'admin') {
      return permissionsService.getPermissionsForRole('admin');
    }
    
    // Si l'utilisateur a des permissions personnalisées valides, les utiliser
    if (user.permissions && user.permissions.length > 0 && !user.permissions.includes('all')) {
      return user.permissions as Permission[];
    }
    
    // Sinon, utiliser les permissions du rôle
    return permissionsService.getPermissionsForRole(user.role);
  };

  /**
   * Vérifier si l'utilisateur a un rôle spécifique
   */
  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  /**
   * Vérifier si l'utilisateur a un des rôles requis
   */
  const hasAnyRole = (roles: string[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  /**
   * Obtenir le rôle de l'utilisateur avec métadonnées
   */
  const getUserRole = () => {
    const roles = permissionsService.getAvailableRoles();
    return roles.find(role => role.value === user?.role);
  };

  return {
    // Utilisateur
    user,
    getUserRole,
    
    // Permissions
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    getUserPermissions,
    
    // Rôles
    hasRole,
    hasAnyRole,
    
    // Fonctions métier
    canAccessProject,
    canEditProject,
    canAssignTasks,
    canApproveLeaves,
    hasAdminAccess,
    
    // Navigation
    getAccessibleRoutes
  };
};

/**
 * Hook pour vérifier les permissions avec un autre utilisateur
 */
export const usePermissionsFor = (targetUser: User | null) => {
  /**
   * Vérifier si un utilisateur a une permission spécifique
   */
  const hasPermission = (permission: Permission): boolean => {
    return permissionsService.hasPermission(targetUser, permission);
  };

  /**
   * Vérifier si un utilisateur a toutes les permissions requises
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissionsService.hasAllPermissions(targetUser, permissions);
  };

  /**
   * Obtenir les permissions d'un utilisateur
   */
  const getUserPermissions = (): Permission[] => {
    if (!targetUser) return [];
    
    if (targetUser.permissions && targetUser.permissions.length > 0) {
      return targetUser.permissions as Permission[];
    }
    
    return permissionsService.getPermissionsForRole(targetUser.role);
  };

  return {
    user: targetUser,
    hasPermission,
    hasAllPermissions,
    getUserPermissions
  };
};