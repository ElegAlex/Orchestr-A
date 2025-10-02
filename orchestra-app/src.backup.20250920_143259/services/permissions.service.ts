import { User } from '../types';

export type Permission = 
  // Projets
  | 'project.view'
  | 'project.create'
  | 'project.edit'
  | 'project.delete'
  | 'project.archive'
  | 'project.manage_team'
  
  // Tâches
  | 'task.view'
  | 'task.create'
  | 'task.edit'
  | 'task.delete'
  | 'task.assign'
  | 'task.change_status'
  
  // Documents
  | 'document.view'
  | 'document.upload'
  | 'document.download'
  | 'document.delete'
  
  // Rapports
  | 'report.view'
  | 'report.create'
  | 'report.export'
  
  // Ressources humaines
  | 'hr.view_all_leaves'
  | 'hr.approve_leaves'
  | 'hr.manage_employees'
  | 'hr.view_skills'
  | 'hr.manage_contracts'
  
  // Départements
  | 'department.view'
  | 'department.create'
  | 'department.edit'
  | 'department.delete'
  | 'department.manage_members'
  | 'department.view_budget'
  | 'department.manage_budget'
  
  // Utilisateurs
  | 'user.view'
  | 'user.create'
  | 'user.edit'
  | 'user.delete'
  | 'user.change_role'
  
  // Administration
  | 'admin.access'
  | 'admin.settings'
  | 'admin.backup'
  | 'admin.logs'
  | 'admin.webhooks';

export type Role = 'admin' | 'responsable' | 'manager' | 'teamLead' | 'contributor' | 'viewer';

// Matrice des permissions par rôle
const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    // Admin technique - TOUTES les permissions 
    'project.view', 'project.create', 'project.edit', 'project.delete', 'project.archive', 'project.manage_team',
    'task.view', 'task.create', 'task.edit', 'task.delete', 'task.assign', 'task.change_status',
    'document.view', 'document.upload', 'document.download', 'document.delete',
    'report.view', 'report.create', 'report.export',
    'hr.view_all_leaves', 'hr.approve_leaves', 'hr.manage_employees', 'hr.view_skills', 'hr.manage_contracts',
    'department.view', 'department.create', 'department.edit', 'department.delete', 'department.manage_members', 'department.view_budget', 'department.manage_budget',
    'user.view', 'user.create', 'user.edit', 'user.delete', 'user.change_role',
    'admin.access', 'admin.settings', 'admin.backup', 'admin.logs', 'admin.webhooks'
  ],

  responsable: [
    // Responsable métier - TOUTES les permissions métier (SAUF admin technique)
    'project.view', 'project.create', 'project.edit', 'project.delete', 'project.archive', 'project.manage_team',
    'task.view', 'task.create', 'task.edit', 'task.delete', 'task.assign', 'task.change_status',
    'document.view', 'document.upload', 'document.download', 'document.delete',
    'report.view', 'report.create', 'report.export',
    'hr.view_all_leaves', 'hr.approve_leaves', 'hr.manage_employees', 'hr.view_skills', 'hr.manage_contracts',
    'department.view', 'department.create', 'department.edit', 'department.delete', 'department.manage_members', 'department.view_budget', 'department.manage_budget',
    'user.view', 'user.create', 'user.edit', 'user.delete', 'user.change_role',
    'admin.access' // Ajout de l'accès à l'interface d'administration pour le responsable
    // PAS d'accès aux autres permissions admin.* (settings, backup, logs, webhooks - technique uniquement)
  ],
  
  manager: [
    'project.view', 'project.create', 'project.edit', 'project.archive', 'project.manage_team',
    'task.view', 'task.create', 'task.edit', 'task.delete', 'task.assign', 'task.change_status',
    'document.view', 'document.upload', 'document.download', 'document.delete',
    'report.view', 'report.create', 'report.export',
    'hr.view_all_leaves', 'hr.approve_leaves', 'hr.view_skills',
    'department.view', 'department.manage_members', 'department.view_budget',
    'user.view', 'user.edit'
  ],
  
  teamLead: [
    'project.view', 'project.edit', 'project.manage_team',
    'task.view', 'task.create', 'task.edit', 'task.assign', 'task.change_status',
    'document.view', 'document.upload', 'document.download',
    'report.view', 'report.create',
    'hr.view_skills',
    'department.view', 'department.manage_members',
    'user.view'
  ],
  
  contributor: [
    'project.view',
    'task.view', 'task.create', 'task.edit', 'task.change_status',
    'document.view', 'document.upload', 'document.download',
    'report.view',
    'department.view',
    'user.view'
  ],
  
  viewer: [
    'project.view',
    'task.view',
    'document.view', 'document.download',
    'report.view',
    'department.view',
    'user.view'
  ]
};

class PermissionsService {
  /**
   * Obtenir les permissions pour un rôle donné
   */
  getPermissionsForRole(role: Role): Permission[] {
    return rolePermissions[role] || [];
  }

  /**
   * Vérifier si un utilisateur a une permission spécifique
   */
  hasPermission(user: User | null, permission: Permission): boolean {
    if (!user) return false;
    
    // Si l'utilisateur a des permissions personnalisées valides, les utiliser
    if (user.permissions && user.permissions.length > 0 && Array.isArray(user.permissions)) {
      // Vérifier que ce ne sont pas des permissions vides ou invalides
      const validPermissions = user.permissions.filter(p => p && typeof p === 'string' && p.length > 0);
      if (validPermissions.length > 0) {
        // Vérifier si l'utilisateur a le wildcard '*' (super-admin)
        if (validPermissions.includes('*')) {
          return true;
        }
        
        return validPermissions.includes(permission);
      }
    }
    
    // Sinon, utiliser les permissions du rôle
    const rolePerms = this.getPermissionsForRole(user.role as Role);
    return rolePerms.includes(permission);
  }

  /**
   * Vérifier si un utilisateur a toutes les permissions requises
   */
  hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
    if (!user) return false;
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Vérifier si un utilisateur a au moins une des permissions requises
   */
  hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
    if (!user) return false;
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  /**
   * Vérifier si un utilisateur peut accéder à un projet
   */
  canAccessProject(user: User | null, projectId: string, isTeamMember: boolean = false): boolean {
    if (!user) return false;
    
    // Admin et Responsable peuvent toujours accéder
    if (user.role === 'admin' || user.role === 'responsable') return true;
    
    // Si membre de l'équipe, peut voir le projet
    if (isTeamMember) return true;
    
    // Manager peut voir tous les projets
    if (user.role === 'manager') return true;
    
    // Sinon, vérifier la permission de base
    return this.hasPermission(user, 'project.view');
  }

  /**
   * Vérifier si un utilisateur peut modifier un projet
   */
  canEditProject(user: User | null, projectId: string, isManager: boolean = false): boolean {
    if (!user) return false;
    
    // Admin et Responsable peuvent toujours modifier
    if (user.role === 'admin' || user.role === 'responsable') return true;
    
    // Si manager du projet, peut modifier
    if (isManager) return true;
    
    // Vérifier la permission d'édition
    return this.hasPermission(user, 'project.edit');
  }

  /**
   * Vérifier si un utilisateur peut assigner des tâches
   */
  canAssignTasks(user: User | null): boolean {
    if (!user) return false;
    return this.hasPermission(user, 'task.assign');
  }

  /**
   * Vérifier si un utilisateur peut approuver des congés
   */
  canApproveLeaves(user: User | null): boolean {
    if (!user) return false;
    return this.hasPermission(user, 'hr.approve_leaves');
  }

  /**
   * Vérifier si un utilisateur peut gérer un département spécifique
   */
  canManageDepartment(user: User | null, departmentId: string | null = null): boolean {
    if (!user) return false;
    
    // Admin et Responsable peuvent toujours gérer tous les départements
    if (user.role === 'admin' || user.role === 'responsable') return true;
    
    // Si c'est le responsable du département spécifique
    if (departmentId && user.department === departmentId) {
      return this.hasPermission(user, 'department.manage_members');
    }
    
    // Vérifier la permission générale de création/modification des départements
    return this.hasAnyPermission(user, ['department.create', 'department.edit', 'department.delete']);
  }

  /**
   * Vérifier si un utilisateur peut voir le budget d'un département
   */
  canViewDepartmentBudget(user: User | null, departmentId: string | null = null): boolean {
    if (!user) return false;
    
    // Admin et Responsable peuvent toujours voir tous les budgets
    if (user.role === 'admin' || user.role === 'responsable') return true;
    
    // Si c'est le responsable du département spécifique
    if (departmentId && user.department === departmentId) {
      return this.hasPermission(user, 'department.view_budget');
    }
    
    // Manager peut voir les budgets
    return this.hasPermission(user, 'department.view_budget');
  }

  /**
   * Vérifier si un utilisateur a accès à l'administration
   */
  hasAdminAccess(user: User | null): boolean {
    if (!user) return false;
    
    // Vérification directe des rôles autorisés (admin et responsable)
    if (user.role === 'admin' || user.role === 'responsable') {
      return true;
    }
    
    // Fallback: vérifier via les permissions
    return this.hasPermission(user, 'admin.access');
  }

  /**
   * Obtenir les routes accessibles pour un utilisateur
   */
  getAccessibleRoutes(user: User | null): string[] {
    const routes: string[] = ['/dashboard'];
    
    if (!user) return routes;
    
    // Routes de base pour tous les utilisateurs authentifiés
    routes.push('/profile', '/settings');
    
    // Routes selon les permissions
    if (this.hasPermission(user, 'project.view')) {
      routes.push('/projects');
    }
    
    if (this.hasPermission(user, 'task.view')) {
      routes.push('/tasks');
    }
    
    if (this.hasPermission(user, 'report.view')) {
      routes.push('/reports');
    }
    
    if (this.hasAnyPermission(user, ['hr.view_all_leaves', 'hr.approve_leaves', 'hr.manage_employees'])) {
      routes.push('/hr-admin');
    }
    
    if (this.hasPermission(user, 'admin.access')) {
      routes.push('/admin');
    }
    
    // Tous les utilisateurs peuvent voir leurs propres congés
    routes.push('/my-leaves');
    routes.push('/calendar');
    routes.push('/resources');
    
    return routes;
  }

  /**
   * Obtenir la liste des rôles disponibles
   */
  getAvailableRoles(): { value: Role; label: string; description: string }[] {
    return [
      {
        value: 'admin',
        label: 'Administrateur Technique',
        description: 'Accès technique complet - Configuration système'
      },
      {
        value: 'responsable',
        label: 'Responsable Général',
        description: 'Direction métier - Vue d\'ensemble et gestion complète'
      },
      {
        value: 'manager',
        label: 'Manager',
        description: 'Gestion des projets et des équipes'
      },
      {
        value: 'teamLead',
        label: 'Référent technique',
        description: 'Gestion des tâches et de l\'équipe'
      },
      {
        value: 'contributor',
        label: 'Contributeur',
        description: 'Contribution aux projets et tâches'
      },
      {
        value: 'viewer',
        label: 'Observateur',
        description: 'Consultation uniquement'
      }
    ];
  }

  /**
   * Obtenir la liste de toutes les permissions
   */
  getAllPermissions(): { value: Permission; label: string; category: string }[] {
    return [
      // Projets
      { value: 'project.view', label: 'Voir les projets', category: 'Projets' },
      { value: 'project.create', label: 'Créer des projets', category: 'Projets' },
      { value: 'project.edit', label: 'Modifier les projets', category: 'Projets' },
      { value: 'project.delete', label: 'Supprimer les projets', category: 'Projets' },
      { value: 'project.archive', label: 'Archiver les projets', category: 'Projets' },
      { value: 'project.manage_team', label: 'Gérer les équipes', category: 'Projets' },
      
      // Tâches
      { value: 'task.view', label: 'Voir les tâches', category: 'Tâches' },
      { value: 'task.create', label: 'Créer des tâches', category: 'Tâches' },
      { value: 'task.edit', label: 'Modifier les tâches', category: 'Tâches' },
      { value: 'task.delete', label: 'Supprimer les tâches', category: 'Tâches' },
      { value: 'task.assign', label: 'Assigner les tâches', category: 'Tâches' },
      { value: 'task.change_status', label: 'Changer le statut', category: 'Tâches' },
      
      // Documents
      { value: 'document.view', label: 'Voir les documents', category: 'Documents' },
      { value: 'document.upload', label: 'Télécharger des documents', category: 'Documents' },
      { value: 'document.download', label: 'Télécharger les documents', category: 'Documents' },
      { value: 'document.delete', label: 'Supprimer les documents', category: 'Documents' },
      
      // Rapports
      { value: 'report.view', label: 'Voir les rapports', category: 'Rapports' },
      { value: 'report.create', label: 'Créer des rapports', category: 'Rapports' },
      { value: 'report.export', label: 'Exporter les rapports', category: 'Rapports' },
      
      // RH
      { value: 'hr.view_all_leaves', label: 'Voir tous les congés', category: 'Ressources Humaines' },
      { value: 'hr.approve_leaves', label: 'Approuver les congés', category: 'Ressources Humaines' },
      { value: 'hr.manage_employees', label: 'Gérer les employés', category: 'Ressources Humaines' },
      { value: 'hr.view_skills', label: 'Voir les compétences', category: 'Ressources Humaines' },
      { value: 'hr.manage_contracts', label: 'Gérer les contrats', category: 'Ressources Humaines' },
      
      // Utilisateurs
      { value: 'user.view', label: 'Voir les utilisateurs', category: 'Utilisateurs' },
      { value: 'user.create', label: 'Créer des utilisateurs', category: 'Utilisateurs' },
      { value: 'user.edit', label: 'Modifier les utilisateurs', category: 'Utilisateurs' },
      { value: 'user.delete', label: 'Supprimer les utilisateurs', category: 'Utilisateurs' },
      { value: 'user.change_role', label: 'Changer les rôles', category: 'Utilisateurs' },
      
      // Administration
      { value: 'admin.access', label: 'Accès administration', category: 'Administration' },
      { value: 'admin.settings', label: 'Paramètres système', category: 'Administration' },
      { value: 'admin.backup', label: 'Sauvegardes', category: 'Administration' },
      { value: 'admin.logs', label: 'Logs système', category: 'Administration' },
      { value: 'admin.webhooks', label: 'Webhooks', category: 'Administration' }
    ];
  }
}

export const permissionsService = new PermissionsService();