import React from 'react';
import { User } from '../types';
import { permissionsService, Permission } from '../services/permissions.service';
import { store } from '../store';

/**
 * Middleware d'autorisation pour vérifier les permissions
 */
export class AuthMiddleware {
  /**
   * Vérifier si l'utilisateur actuel a une permission
   */
  static hasPermission(permission: Permission): boolean {
    const state = store.getState();
    const user = state.auth.user;
    return permissionsService.hasPermission(user, permission);
  }

  /**
   * Vérifier si l'utilisateur actuel a toutes les permissions requises
   */
  static hasAllPermissions(permissions: Permission[]): boolean {
    const state = store.getState();
    const user = state.auth.user;
    return permissionsService.hasAllPermissions(user, permissions);
  }

  /**
   * Vérifier si l'utilisateur actuel peut accéder à une route
   */
  static canAccessRoute(path: string): boolean {
    const state = store.getState();
    const { user, isAuthenticated } = state.auth;

    // Vérifier l'authentification
    if (!isAuthenticated || !user) {
      return false;
    }

    // Routes publiques (authentifié)
    const publicRoutes = ['/dashboard', '/profile', '/settings'];
    if (publicRoutes.includes(path)) {
      return true;
    }

    // Vérifier les permissions selon la route
    const routePermissions = AuthMiddleware.getRoutePermissions(path);
    if (routePermissions.length === 0) {
      return true; // Route sans restriction spéciale
    }

    return permissionsService.hasAnyPermission(user, routePermissions);
  }

  /**
   * Obtenir les permissions requises pour une route
   */
  static getRoutePermissions(path: string): Permission[] {
    const routeMap: Record<string, Permission[]> = {
      // Administration
      '/admin': ['admin.access'],
      '/admin/users': ['user.view', 'user.edit'],
      '/admin/settings': ['admin.settings'],
      '/admin/logs': ['admin.logs'],
      '/admin/backup': ['admin.backup'],
      '/admin/webhooks': ['admin.webhooks'],

      // Projets
      '/projects': ['project.view'],
      '/projects/create': ['project.create'],
      '/projects/*/edit': ['project.edit'],
      '/projects/*/delete': ['project.delete'],
      '/projects/*/team': ['project.manage_team'],

      // Tâches
      '/tasks': ['task.view'],
      '/tasks/create': ['task.create'],
      '/tasks/*/edit': ['task.edit'],
      '/tasks/*/delete': ['task.delete'],
      '/kanban': ['task.view'],

      // Rapports
      '/reports': ['report.view'],
      '/reports/create': ['report.create'],
      '/reports/*/export': ['report.export'],

      // RH
      '/hr-admin': ['hr.view_all_leaves', 'hr.approve_leaves', 'hr.manage_employees'],
      '/hr-admin/leaves': ['hr.view_all_leaves'],
      '/hr-admin/employees': ['hr.manage_employees'],
      '/hr-admin/skills': ['hr.view_skills'],
      '/hr-admin/contracts': ['hr.manage_contracts'],

      // Documents
      '/documents': ['document.view'],
      '/documents/upload': ['document.upload'],

      // Utilisateurs
      '/users': ['user.view'],
      '/users/create': ['user.create'],
      '/users/*/edit': ['user.edit'],

      // Routes spéciales
      '/my-leaves': [], // Tous les utilisateurs
      '/calendar': [], // Tous les utilisateurs  
      '/resources': [], // Tous les utilisateurs
    };

    // Recherche exacte
    if (routeMap[path]) {
      return routeMap[path];
    }

    // Recherche avec wildcards
    for (const [route, permissions] of Object.entries(routeMap)) {
      if (route.includes('*')) {
        const regex = new RegExp(route.replace('*', '[^/]+'));
        if (regex.test(path)) {
          return permissions;
        }
      }
    }

    return [];
  }

  /**
   * Décorateur pour protéger une fonction par permission
   */
  static requirePermission(permission: Permission) {
    return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function(...args: any[]) {
        if (!AuthMiddleware.hasPermission(permission)) {
          throw new Error(`Permission requise: ${permission}`);
        }
        return originalMethod.apply(this, args);
      };
    };
  }

  /**
   * Décorateur pour protéger une fonction par rôle
   */
  static requireRole(role: string) {
    return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function(...args: any[]) {
        const state = store.getState();
        const user = state.auth.user;

        if (!user || user.role !== role) {
          throw new Error(`Rôle requis: ${role}`);
        }
        return originalMethod.apply(this, args);
      };
    };
  }

  /**
   * Guard pour les opérations sur les projets
   */
  static canAccessProject(projectId: string, user: User | null, isTeamMember: boolean = false): boolean {
    return permissionsService.canAccessProject(user, projectId, isTeamMember);
  }

  /**
   * Guard pour les opérations d'édition de projets
   */
  static canEditProject(projectId: string, user: User | null, isManager: boolean = false): boolean {
    return permissionsService.canEditProject(user, projectId, isManager);
  }

  /**
   * Guard pour les opérations sur les tâches
   */
  static canAccessTask(taskId: string, user: User | null, projectAccess: boolean = false): boolean {
    if (!user) return false;

    // Admin peut tout faire
    if (user.role === 'admin') return true;

    // Si accès au projet, peut voir les tâches
    if (projectAccess) return true;

    // Permission de base
    return permissionsService.hasPermission(user, 'task.view');
  }

  /**
   * Guard pour l'assignation de tâches
   */
  static canAssignTask(user: User | null, taskOwnerId?: string): boolean {
    if (!user) return false;

    // Admin peut tout assigner
    if (user.role === 'admin') return true;

    // Peut s'assigner des tâches à soi-même
    if (taskOwnerId === user.id) return true;

    // Permission d'assignation
    return permissionsService.hasPermission(user, 'task.assign');
  }

  /**
   * Guard pour les documents
   */
  static canAccessDocument(documentId: string, user: User | null, projectAccess: boolean = false): boolean {
    if (!user) return false;

    // Admin peut tout voir
    if (user.role === 'admin') return true;

    // Si accès au projet, peut voir les documents
    if (projectAccess) return true;

    // Permission de base
    return permissionsService.hasPermission(user, 'document.view');
  }

  /**
   * Guard pour les congés
   */
  static canManageLeave(leaveUserId: string, user: User | null): boolean {
    if (!user) return false;

    // Admin peut tout gérer
    if (user.role === 'admin') return true;

    // Peut gérer ses propres congés
    if (leaveUserId === user.id) return true;

    // Permission d'approbation
    return permissionsService.hasPermission(user, 'hr.approve_leaves');
  }

  /**
   * Validation des données selon les permissions
   */
  static validateDataAccess<T>(data: T, user: User | null, validator: (data: T, user: User) => boolean): T | null {
    if (!user || !validator(data, user)) {
      return null;
    }
    return data;
  }

  /**
   * Filtrer une liste selon les permissions d'accès
   */
  static filterByPermission<T>(
    items: T[], 
    user: User | null, 
    validator: (item: T, user: User) => boolean
  ): T[] {
    if (!user) return [];
    return items.filter(item => validator(item, user));
  }

  /**
   * Vérifier si l'utilisateur peut effectuer une action sur une ressource
   */
  static canPerformAction(
    action: string,
    resourceType: string,
    user: User | null,
    resourceId?: string,
    additionalContext?: any
  ): boolean {
    if (!user) return false;

    // Admin peut tout faire
    if (user.role === 'admin') return true;

    // Mapping action -> permission
    const permissionMap: Record<string, Record<string, Permission>> = {
      view: {
        project: 'project.view',
        task: 'task.view',
        document: 'document.view',
        report: 'report.view',
        user: 'user.view'
      },
      create: {
        project: 'project.create',
        task: 'task.create',
        report: 'report.create',
        user: 'user.create'
      },
      edit: {
        project: 'project.edit',
        task: 'task.edit',
        user: 'user.edit'
      },
      delete: {
        project: 'project.delete',
        task: 'task.delete',
        document: 'document.delete',
        user: 'user.delete'
      }
    };

    const permission = permissionMap[action]?.[resourceType];
    if (!permission) return false;

    return permissionsService.hasPermission(user, permission);
  }
}

/**
 * Helper pour les composants React
 */
export const withPermission = (permission: Permission) => {
  return <P extends object>(Component: React.ComponentType<P>) => {
    return (props: P) => {
      const hasPermission = AuthMiddleware.hasPermission(permission);
      
      if (!hasPermission) {
        return null; // Ou un composant d'erreur
      }

      return React.createElement(Component, props);
    };
  };
};

/**
 * Helper pour les hooks conditionnels
 */
export const useConditionalPermission = (permission: Permission, fallback: any = null) => {
  const hasPermission = AuthMiddleware.hasPermission(permission);
  return hasPermission ? true : fallback;
};