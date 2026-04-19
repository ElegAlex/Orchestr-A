import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RoleManagementService implements OnModuleInit {
  private redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly logger = new Logger(RoleManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      this.redis = new Redis({ host, port, password: password || undefined });
    }
  }

  async onModuleInit() {
    await this.seedPermissionsAndRoles();
  }

  /**
   * Seed les permissions et rôles système (idempotent).
   * Ne modifie pas les permissions des rôles existants.
   */
  async seedPermissionsAndRoles() {
    return this._syncPermissionsAndRoles(false);
  }

  /**
   * Réinitialiser les permissions des rôles système à leurs valeurs par défaut.
   * Écrase toutes les modifications faites via l'UI admin.
   */
  async resetRolesToDefaults() {
    return this._syncPermissionsAndRoles(true);
  }

  private async _syncPermissionsAndRoles(force: boolean) {
    // Définir toutes les permissions par module
    const permissionsData = [
      // Projects
      { code: 'projects:create', module: 'projects', action: 'create' },
      { code: 'projects:read', module: 'projects', action: 'read' },
      { code: 'projects:update', module: 'projects', action: 'update' },
      { code: 'projects:delete', module: 'projects', action: 'delete' },
      {
        code: 'projects:manage_members',
        module: 'projects',
        action: 'manage_members',
      },
      {
        code: 'projects:manage_any',
        module: 'projects',
        action: 'manage_any',
        description:
          "Modifier ou supprimer n'importe quel projet, y compris ceux dont on n'est pas propriétaire (bypass OwnershipGuard)",
      },
      // Tasks
      { code: 'tasks:create', module: 'tasks', action: 'create' },
      { code: 'tasks:read', module: 'tasks', action: 'read' },
      { code: 'tasks:update', module: 'tasks', action: 'update' },
      { code: 'tasks:delete', module: 'tasks', action: 'delete' },
      {
        code: 'tasks:create_in_project',
        module: 'tasks',
        action: 'create_in_project',
      },
      { code: 'tasks:create_orphan', module: 'tasks', action: 'create_orphan' },
      {
        code: 'tasks:readAll',
        module: 'tasks',
        action: 'readAll',
        description: 'Voir toutes les tâches (pas seulement les siennes)',
      },
      {
        code: 'tasks:assign_any_user',
        module: 'tasks',
        action: 'assign_any_user',
        description:
          'Assigner une tâche à n\'importe quel utilisateur, sans restriction de périmètre ni de membres du projet',
      },
      {
        code: 'tasks:manage_any',
        module: 'tasks',
        action: 'manage_any',
        description:
          "Modifier ou supprimer n'importe quelle tâche, y compris celles dont on n'est ni assignee ni membre du projet (bypass OwnershipGuard)",
      },
      // Events
      {
        code: 'events:readAll',
        module: 'events',
        action: 'readAll',
        description: 'Voir tous les événements (pas seulement les siens)',
      },
      { code: 'events:create', module: 'events', action: 'create' },
      { code: 'events:read', module: 'events', action: 'read' },
      { code: 'events:update', module: 'events', action: 'update' },
      { code: 'events:delete', module: 'events', action: 'delete' },
      {
        code: 'events:manage_any',
        module: 'events',
        action: 'manage_any',
        description:
          "Modifier ou supprimer n'importe quel événement, y compris ceux dont on n'est pas créateur (bypass OwnershipGuard)",
      },
      // Epics
      { code: 'epics:create', module: 'epics', action: 'create' },
      { code: 'epics:read', module: 'epics', action: 'read' },
      { code: 'epics:update', module: 'epics', action: 'update' },
      { code: 'epics:delete', module: 'epics', action: 'delete' },
      // Milestones
      { code: 'milestones:create', module: 'milestones', action: 'create' },
      { code: 'milestones:read', module: 'milestones', action: 'read' },
      { code: 'milestones:update', module: 'milestones', action: 'update' },
      { code: 'milestones:delete', module: 'milestones', action: 'delete' },
      // Leaves
      { code: 'leaves:create', module: 'leaves', action: 'create' },
      { code: 'leaves:read', module: 'leaves', action: 'read' },
      { code: 'leaves:update', module: 'leaves', action: 'update' },
      { code: 'leaves:delete', module: 'leaves', action: 'delete' },
      { code: 'leaves:approve', module: 'leaves', action: 'approve' },
      {
        code: 'leaves:manage_any',
        module: 'leaves',
        action: 'manage_any',
        description:
          "Gérer (lire/modifier/supprimer/valider) n'importe quelle demande de congé sans restriction de périmètre. Réservé à l'administration centrale.",
      },
      {
        code: 'leaves:manage_delegations',
        module: 'leaves',
        action: 'manage_delegations',
      },
      {
        code: 'leaves:readAll',
        module: 'leaves',
        action: 'readAll',
        description: 'Voir tous les congés (pas seulement les siens) — nécessaire pour le planning',
      },
      // Telework
      { code: 'telework:create', module: 'telework', action: 'create' },
      { code: 'telework:read', module: 'telework', action: 'read' },
      { code: 'telework:update', module: 'telework', action: 'update' },
      { code: 'telework:delete', module: 'telework', action: 'delete' },
      { code: 'telework:read_team', module: 'telework', action: 'read_team' },
      {
        code: 'telework:manage_any',
        module: 'telework',
        action: 'manage_any',
      },
      {
        code: 'telework:manage_recurring',
        module: 'telework',
        action: 'manage_recurring',
        description: 'Gérer les règles de télétravail récurrentes pour autrui',
      },
      {
        code: 'telework:readAll',
        module: 'telework',
        action: 'readAll',
        description: 'Voir tous les télétravails (pas seulement les siens) — nécessaire pour le planning',
      },
      // Skills
      { code: 'skills:create', module: 'skills', action: 'create' },
      { code: 'skills:read', module: 'skills', action: 'read' },
      { code: 'skills:update', module: 'skills', action: 'update' },
      { code: 'skills:delete', module: 'skills', action: 'delete' },
      {
        code: 'skills:manage_matrix',
        module: 'skills',
        action: 'manage_matrix',
      },
      // Time Tracking
      {
        code: 'time_tracking:create',
        module: 'time_tracking',
        action: 'create',
      },
      { code: 'time_tracking:read', module: 'time_tracking', action: 'read' },
      {
        code: 'time_tracking:update',
        module: 'time_tracking',
        action: 'update',
      },
      {
        code: 'time_tracking:delete',
        module: 'time_tracking',
        action: 'delete',
      },
      {
        code: 'time_tracking:read_reports',
        module: 'time_tracking',
        action: 'read_reports',
      },
      {
        code: 'time_tracking:manage_any',
        module: 'time_tracking',
        action: 'manage_any',
        description:
          "Modifier ou supprimer n'importe quelle entrée de temps, y compris celles dont on n'est pas propriétaire (bypass OwnershipGuard)",
      },
      {
        code: 'time_tracking:view_any',
        module: 'time_tracking',
        action: 'view_any',
        description:
          "Lister les entrées de temps d'autres utilisateurs (filtre userId cross-user)",
      },
      // Users
      { code: 'users:create', module: 'users', action: 'create' },
      { code: 'users:read', module: 'users', action: 'read' },
      { code: 'users:update', module: 'users', action: 'update' },
      { code: 'users:delete', module: 'users', action: 'delete' },
      { code: 'users:import', module: 'users', action: 'import' },
      { code: 'users:manage_roles', module: 'users', action: 'manage_roles' },
      // Departments
      { code: 'departments:create', module: 'departments', action: 'create' },
      { code: 'departments:read', module: 'departments', action: 'read' },
      { code: 'departments:update', module: 'departments', action: 'update' },
      { code: 'departments:delete', module: 'departments', action: 'delete' },
      // Services
      { code: 'services:create', module: 'services', action: 'create' },
      { code: 'services:read', module: 'services', action: 'read' },
      { code: 'services:update', module: 'services', action: 'update' },
      { code: 'services:delete', module: 'services', action: 'delete' },
      // Documents
      { code: 'documents:create', module: 'documents', action: 'create' },
      { code: 'documents:read', module: 'documents', action: 'read' },
      { code: 'documents:update', module: 'documents', action: 'update' },
      { code: 'documents:delete', module: 'documents', action: 'delete' },
      // Comments
      { code: 'comments:create', module: 'comments', action: 'create' },
      { code: 'comments:read', module: 'comments', action: 'read' },
      { code: 'comments:update', module: 'comments', action: 'update' },
      { code: 'comments:delete', module: 'comments', action: 'delete' },
      // Settings
      { code: 'settings:read', module: 'settings', action: 'read' },
      { code: 'settings:update', module: 'settings', action: 'update' },
      // Analytics
      { code: 'analytics:read', module: 'analytics', action: 'read' },
      { code: 'analytics:export', module: 'analytics', action: 'export' },
      // Holidays
      { code: 'holidays:create', module: 'holidays', action: 'create' },
      { code: 'holidays:read', module: 'holidays', action: 'read' },
      { code: 'holidays:update', module: 'holidays', action: 'update' },
      { code: 'holidays:delete', module: 'holidays', action: 'delete' },
      // Reports (granularité distincte de analytics)
      { code: 'reports:view', module: 'reports', action: 'view' },
      { code: 'reports:export', module: 'reports', action: 'export' },
      // Predefined Tasks
      {
        code: 'predefined_tasks:view',
        module: 'predefined_tasks',
        action: 'view',
        description: 'Voir les tâches prédéfinies',
      },
      {
        code: 'predefined_tasks:create',
        module: 'predefined_tasks',
        action: 'create',
        description: 'Créer une tâche prédéfinie',
      },
      {
        code: 'predefined_tasks:edit',
        module: 'predefined_tasks',
        action: 'edit',
        description: 'Modifier une tâche prédéfinie',
      },
      {
        code: 'predefined_tasks:delete',
        module: 'predefined_tasks',
        action: 'delete',
        description: 'Supprimer une tâche prédéfinie',
      },
      {
        code: 'predefined_tasks:assign',
        module: 'predefined_tasks',
        action: 'assign',
        description: 'Assigner une tâche prédéfinie à un agent',
      },
      // Users — reset password
      {
        code: 'users:reset_password',
        module: 'users',
        action: 'reset_password',
        description: "Réinitialiser le mot de passe d'un utilisateur",
      },
      // Leaves — permissions granulaires supplémentaires
      {
        code: 'leaves:manage',
        module: 'leaves',
        action: 'manage',
        description: 'Valider ou rejeter des demandes de congés',
      },
      {
        code: 'leaves:declare_for_others',
        module: 'leaves',
        action: 'declare_for_others',
        description: "Déclarer des congés au nom d'un autre agent",
      },
      // Leaves & Telework — aliases view pour cohérence granulaire
      {
        code: 'leaves:view',
        module: 'leaves',
        action: 'view',
        description:
          'Voir les congés (alias de leaves:read pour granularité RBAC)',
      },
      {
        code: 'telework:view',
        module: 'telework',
        action: 'view',
        description:
          'Voir le télétravail (alias de telework:read pour granularité RBAC)',
      },
      // Projects — aliases view/edit pour cohérence granulaire
      {
        code: 'projects:view',
        module: 'projects',
        action: 'view',
        description:
          'Voir les projets (alias de projects:read pour granularité RBAC)',
      },
      {
        code: 'projects:edit',
        module: 'projects',
        action: 'edit',
        description:
          'Modifier les projets (alias de projects:update pour granularité RBAC)',
      },
      // Users — aliases view/edit pour cohérence granulaire
      {
        code: 'users:view',
        module: 'users',
        action: 'view',
        description:
          'Voir les utilisateurs (alias de users:read pour granularité RBAC)',
      },
      {
        code: 'users:edit',
        module: 'users',
        action: 'edit',
        description:
          'Modifier les utilisateurs (alias de users:update pour granularité RBAC)',
      },
      // Departments — aliases view/edit pour cohérence granulaire
      {
        code: 'departments:view',
        module: 'departments',
        action: 'view',
        description:
          'Voir les services (alias de departments:read pour granularité RBAC)',
      },
      {
        code: 'departments:edit',
        module: 'departments',
        action: 'edit',
        description:
          'Modifier les services (alias de departments:update pour granularité RBAC)',
      },
      // Skills — aliases view/edit pour cohérence granulaire
      {
        code: 'skills:view',
        module: 'skills',
        action: 'view',
        description:
          'Voir les compétences (alias de skills:read pour granularité RBAC)',
      },
      {
        code: 'skills:edit',
        module: 'skills',
        action: 'edit',
        description:
          'Modifier les compétences (alias de skills:update pour granularité RBAC)',
      },
    ];

    // Créer toutes les permissions (upsert)
    const permissionsMap = new Map<string, string>();
    for (const perm of permissionsData) {
      const permission = await this.prisma.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm,
      });
      permissionsMap.set(perm.code, permission.id);
    }

    // Définir les 7 rôles système avec leurs permissions
    const rolesConfig = [
      {
        code: 'ADMIN',
        name: 'Administrateur',
        description: 'Accès complet à toutes les fonctionnalités',
        isSystem: true,
        permissions: permissionsData.map((p) => p.code), // Toutes les permissions
      },
      {
        code: 'RESPONSABLE',
        name: 'Responsable',
        description:
          'Gestion complète sauf rôles, settings et congés hors périmètre',
        isSystem: true,
        // RESPONSABLE = toutes les permissions sauf :
        //  - users:manage_roles / settings:update (réservés ADMIN)
        //  - leaves:manage_any : les RESPONSABLE agissent sur les congés
        //    uniquement dans leur périmètre services (via leaves:approve),
        //    pas globalement. Attendu métier confirmé par le DSI.
        permissions: permissionsData
          .filter(
            (p) =>
              p.code !== 'users:manage_roles' &&
              p.code !== 'settings:update' &&
              p.code !== 'leaves:manage_any',
          )
          .map((p) => p.code),
      },
      {
        code: 'MANAGER',
        name: 'Manager',
        description: 'Gestion de projets, tâches, congés équipe',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
          'projects:view',
          'projects:edit',
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'tasks:create_in_project',
          'tasks:assign_any_user',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'epics:create',
          'epics:read',
          'epics:update',
          'epics:delete',
          'milestones:create',
          'milestones:read',
          'milestones:update',
          'milestones:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'time_tracking:read_reports',
          'time_tracking:view_any',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
          'leaves:approve',
          'leaves:manage',
          'leaves:manage_delegations',
          'leaves:declare_for_others',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'telework:manage_any',
          'telework:read_team',
          'telework:manage_recurring',
          'reports:view',
          'reports:export',
          'departments:read',
          'departments:view',
          'skills:read',
          'skills:view',
          'predefined_tasks:view',
          'predefined_tasks:create',
          'predefined_tasks:edit',
          'predefined_tasks:delete',
          'predefined_tasks:assign',
        ],
      },
      {
        code: 'CHEF_DE_PROJET',
        name: 'Chef de Projet',
        description: 'Gestion de projets et tâches',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
          'projects:view',
          'projects:edit',
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'tasks:create_in_project',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'epics:create',
          'epics:read',
          'epics:update',
          'epics:delete',
          'milestones:create',
          'milestones:read',
          'milestones:update',
          'milestones:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'telework:manage_any',
          'telework:read',
          'telework:view',
          'reports:view',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
        ],
      },
      {
        code: 'REFERENT_TECHNIQUE',
        name: 'Référent Technique',
        description: 'Création et modification de tâches dans les projets',
        isSystem: true,
        permissions: [
          'tasks:create_in_project',
          'tasks:read',
          'tasks:update',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'skills:create',
          'skills:read',
          'skills:update',
          'skills:delete',
          'skills:manage_matrix',
          'skills:view',
          'skills:edit',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'predefined_tasks:view',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
        ],
      },
      {
        code: 'CONTRIBUTEUR',
        name: 'Contributeur',
        description: 'Création de tâches orphelines et gestion personnelle',
        isSystem: true,
        permissions: [
          'tasks:create_orphan',
          'tasks:read',
          'tasks:update',
          'events:create',
          'events:read',
          'events:update',
          'time_tracking:create',
          'time_tracking:read',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'predefined_tasks:view',
        ],
      },
      {
        code: 'OBSERVATEUR',
        name: 'Observateur',
        description: 'Accès en lecture seule',
        isSystem: true,
        permissions: permissionsData
          .filter((p) => p.action === 'read' || p.action === 'view')
          .map((p) => p.code),
      },
      {
        code: 'TECHNICIEN_SUPPORT',
        name: 'Technicien Support',
        description: 'Support technique',
        isSystem: true,
        permissions: [
          'tasks:create_orphan',
          'tasks:read',
          'tasks:update',
          'events:create',
          'events:read',
          'events:update',
          'time_tracking:create',
          'time_tracking:read',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
        ],
      },
      {
        code: 'GESTIONNAIRE_PARC',
        name: 'Gestionnaire de Parc',
        description: 'Gestion du parc informatique',
        isSystem: true,
        permissions: [
          'tasks:create_orphan',
          'tasks:read',
          'tasks:update',
          'events:create',
          'events:read',
          'events:update',
          'time_tracking:create',
          'time_tracking:read',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
        ],
      },
      {
        code: 'ADMINISTRATEUR_IML',
        name: 'Administrateur IML',
        description: 'Administration IML',
        isSystem: true,
        permissions: [
          'tasks:create_orphan',
          'tasks:read',
          'tasks:update',
          'events:create',
          'events:read',
          'events:update',
          'time_tracking:create',
          'time_tracking:read',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
        ],
      },
      {
        code: 'DEVELOPPEUR_CONCEPTEUR',
        name: 'Développeur Concepteur',
        description: 'Développement et conception',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
          'projects:view',
          'projects:edit',
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'tasks:create_in_project',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'epics:create',
          'epics:read',
          'epics:update',
          'epics:delete',
          'milestones:create',
          'milestones:read',
          'milestones:update',
          'milestones:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'telework:manage_any',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
        ],
      },
      {
        code: 'CORRESPONDANT_FONCTIONNEL_APPLICATION',
        name: 'Correspondant Fonctionnel Application',
        description: 'Référent fonctionnel applicatif',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
          'projects:view',
          'projects:edit',
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'tasks:create_in_project',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'epics:create',
          'epics:read',
          'epics:update',
          'epics:delete',
          'milestones:create',
          'milestones:read',
          'milestones:update',
          'milestones:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'telework:manage_any',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
        ],
      },
      {
        code: 'CHARGE_DE_MISSION',
        name: 'Chargé de Mission',
        description: 'Pilotage de missions',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
          'projects:view',
          'projects:edit',
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'tasks:create_in_project',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'epics:create',
          'epics:read',
          'epics:update',
          'epics:delete',
          'milestones:create',
          'milestones:read',
          'milestones:update',
          'milestones:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'telework:manage_any',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
        ],
      },
      {
        code: 'GESTIONNAIRE_IML',
        name: 'Gestionnaire IML',
        description: 'Gestion IML',
        isSystem: true,
        permissions: [
          'tasks:create_orphan',
          'tasks:read',
          'tasks:update',
          'events:create',
          'events:read',
          'events:update',
          'time_tracking:create',
          'time_tracking:read',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
        ],
      },
      {
        code: 'CONSULTANT_TECHNOLOGIE_SI',
        name: 'Consultant Technologie SI',
        description: 'Conseil en technologies SI',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
          'projects:view',
          'projects:edit',
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'tasks:create_in_project',
          'events:create',
          'events:read',
          'events:update',
          'events:delete',
          'epics:create',
          'epics:read',
          'epics:update',
          'epics:delete',
          'milestones:create',
          'milestones:read',
          'milestones:update',
          'milestones:delete',
          'time_tracking:create',
          'time_tracking:read',
          'time_tracking:update',
          'time_tracking:delete',
          'documents:create',
          'documents:read',
          'documents:update',
          'documents:delete',
          'comments:create',
          'comments:read',
          'comments:update',
          'comments:delete',
          'telework:create',
          'telework:read',
          'telework:update',
          'telework:delete',
          'telework:view',
          'telework:manage_any',
          'leaves:create',
          'leaves:read',
          'leaves:view',
          'users:read',
          'users:view',
        ],
      },
    ];

    // ── Planning : permissions de lecture globale ──────────────────────
    // Injectées automatiquement à TOUS les rôles pour que le planning
    // affiche l'intégralité des données quel que soit le rôle connecté.
    // Ajouter un rôle à rolesConfig suffit : il héritera de ces perms.
    const PLANNING_READ_PERMISSIONS = [
      'tasks:readAll',
      'leaves:readAll',
      'telework:readAll',
      'events:readAll',
      'predefined_tasks:view',
    ];
    for (const role of rolesConfig) {
      for (const perm of PLANNING_READ_PERMISSIONS) {
        if (!role.permissions.includes(perm)) {
          role.permissions.push(perm);
        }
      }
    }

    // Créer les rôles avec leurs permissions
    for (const roleData of rolesConfig) {
      const { permissions, ...roleInfo } = roleData;

      // Vérifier si le rôle existe déjà en BDD (avec ses permissions actuelles)
      const existingRole = await this.prisma.roleConfig.findUnique({
        where: { code: roleData.code },
        include: { permissions: true },
      });

      const role = await this.prisma.roleConfig.upsert({
        where: { code: roleData.code },
        update: {},
        create: roleInfo,
      });

      if (force && existingRole) {
        // Mode reset : supprimer toutes les permissions et recréer depuis la config
        await this.prisma.rolePermission.deleteMany({
          where: { roleConfigId: role.id },
        });

        const notFoundList: string[] = [];
        const permissionAssignments = permissions
          .map((permCode) => {
            const permId = permissionsMap.get(permCode);
            if (!permId) {
              notFoundList.push(permCode);
              return null;
            }
            return { roleConfigId: role.id, permissionId: permId };
          })
          .filter((p) => p !== null);

        let created = 0;
        if (permissionAssignments.length > 0) {
          const result = await this.prisma.rolePermission.createMany({
            data: permissionAssignments,
            skipDuplicates: true,
          });
          created = result.count;
        }

        this.logger.log(
          `[Seed] ${roleData.code}: reset — ${created} permissions assigned, ${notFoundList.length} not found${notFoundList.length > 0 ? `: [${notFoundList.join(', ')}]` : ''}`,
        );
      } else if (existingRole) {
        // Mode seed (non-force) sur rôle existant : réconcilier sans toucher
        // aux permissions ajoutées manuellement via l'UI admin.
        //
        // Implémentation : INSERT…ON CONFLICT DO NOTHING (via skipDuplicates)
        // sur l'ensemble attendu. La DB gère l'idempotence — plus robuste
        // qu'un pré-filtrage en mémoire qui s'est avéré silencieusement
        // incomplet par le passé (seed rapportant "0 added" alors que des
        // permissions manquaient réellement en DB).
        const notFoundList: string[] = [];
        const permissionAssignments = permissions
          .map((permCode) => {
            const permId = permissionsMap.get(permCode);
            if (!permId) {
              notFoundList.push(permCode);
              return null;
            }
            return { roleConfigId: role.id, permissionId: permId };
          })
          .filter(
            (p): p is { roleConfigId: string; permissionId: string } =>
              p !== null,
          );

        let added = 0;
        if (permissionAssignments.length > 0) {
          const result = await this.prisma.rolePermission.createMany({
            data: permissionAssignments,
            skipDuplicates: true,
          });
          added = result.count;
          if (added > 0) {
            await this.invalidateRoleCache(roleData.code);
          }
        }

        // Vérification défensive : confirmer que toutes les permissions
        // attendues sont bien présentes après l'insert. Si un écart persiste,
        // c'est un bug à remonter immédiatement plutôt que silently ignoré.
        const finalPerms = await this.prisma.rolePermission.count({
          where: {
            roleConfigId: role.id,
            permissionId: { in: permissionAssignments.map((a) => a.permissionId) },
          },
        });
        const expectedCount = permissionAssignments.length;
        if (finalPerms < expectedCount) {
          this.logger.warn(
            `[Seed] ${roleData.code}: INCOHÉRENCE — ${finalPerms}/${expectedCount} permissions attendues présentes en DB après insert (${added} ajoutées)`,
          );
        } else {
          this.logger.log(
            `[Seed] ${roleData.code}: rôle existant — ${added} nouvelles permissions ajoutées (total attendu: ${expectedCount})${notFoundList.length > 0 ? `, ${notFoundList.length} not found: [${notFoundList.join(', ')}]` : ''}`,
          );
        }
        continue;
      } else {
        // Nouveau rôle : créer toutes les permissions par défaut
        const notFoundList: string[] = [];
        const permissionAssignments = permissions
          .map((permCode) => {
            const permId = permissionsMap.get(permCode);
            if (!permId) {
              notFoundList.push(permCode);
              return null;
            }
            return { roleConfigId: role.id, permissionId: permId };
          })
          .filter((p) => p !== null);

        let created = 0;
        if (permissionAssignments.length > 0) {
          const result = await this.prisma.rolePermission.createMany({
            data: permissionAssignments,
            skipDuplicates: true,
          });
          created = result.count;
        }

        this.logger.log(
          `[Seed] ${roleData.code}: nouveau rôle — ${created} permissions assigned, ${notFoundList.length} not found${notFoundList.length > 0 ? `: [${notFoundList.join(', ')}]` : ''}`,
        );
      }

      // Invalider le cache pour ce rôle
      await this.invalidateRoleCache(roleData.code);
    }

    return {
      message: force
        ? 'Permissions et rôles réinitialisés avec succès'
        : 'Permissions et rôles créés avec succès',
    };
  }

  /**
   * Récupérer tous les rôles avec leurs permissions
   */
  async findAllRoles() {
    return this.prisma.roleConfig.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Récupérer un rôle par ID avec ses permissions
   */
  async findOneRole(id: string) {
    const role = await this.prisma.roleConfig.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    return role;
  }

  /**
   * Créer un rôle custom
   */
  async createRole(createRoleDto: CreateRoleDto) {
    // Vérifier que le code n'existe pas déjà
    const existing = await this.prisma.roleConfig.findUnique({
      where: { code: createRoleDto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Un rôle avec ce code existe déjà');
    }

    return this.prisma.roleConfig.create({
      data: {
        code: createRoleDto.code.toUpperCase(),
        name: createRoleDto.name,
        description: createRoleDto.description,
        isSystem: false,
      },
    });
  }

  /**
   * Modifier un rôle (nom et description uniquement)
   */
  async updateRole(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.prisma.roleConfig.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    return this.prisma.roleConfig.update({
      where: { id },
      data: updateRoleDto,
    });
  }

  /**
   * Supprimer un rôle (interdit si isSystem: true)
   */
  async removeRole(id: string) {
    const role = await this.prisma.roleConfig.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    if (role.isSystem) {
      throw new BadRequestException('Impossible de supprimer un rôle système');
    }

    await this.prisma.roleConfig.delete({ where: { id } });
    await this.invalidateRoleCache(role.code);

    return { message: 'Rôle supprimé avec succès' };
  }

  /**
   * Récupérer toutes les permissions (groupées par module)
   */
  async findAllPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    // Grouper par module
    const grouped = permissions.reduce(
      (acc, perm) => {
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
      },
      {} as Record<string, typeof permissions>,
    );

    return grouped;
  }

  /**
   * Remplacer les permissions d'un rôle
   */
  async replaceRolePermissions(id: string, permissionIds: string[]) {
    const role = await this.prisma.roleConfig.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException('Rôle introuvable');
    }

    // Vérifier que toutes les permissions existent
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException(
        'Une ou plusieurs permissions introuvables',
      );
    }

    // Supprimer toutes les anciennes permissions
    await this.prisma.rolePermission.deleteMany({
      where: { roleConfigId: id },
    });

    // Créer les nouvelles permissions
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleConfigId: id,
          permissionId,
        })),
      });
    }

    // Invalider le cache
    await this.invalidateRoleCache(role.code);

    return this.findOneRole(id);
  }

  /**
   * Récupérer les permissions pour un rôle (avec cache Redis)
   */
  async getPermissionsForRole(roleCode: string): Promise<string[]> {
    const cacheKey = `role-permissions:${roleCode}`;

    try {
      // Check Redis first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const cachedPermissions = JSON.parse(cached);
        this.logger.debug(
          `[RBAC] ${roleCode}: ${cachedPermissions.length} permissions (source: cache)`,
        );
        return cachedPermissions;
      }
    } catch (error) {
      console.warn('Redis cache read error:', error);
    }

    // Si miss, query BDD
    const role = await this.prisma.roleConfig.findUnique({
      where: { code: roleCode },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return [];
    }

    const permissionCodes = role.permissions.map((rp) => rp.permission.code);

    this.logger.debug(
      `[RBAC] ${roleCode}: ${permissionCodes.length} permissions (source: db)`,
    );

    // Cache dans Redis (TTL 5 min)
    try {
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(permissionCodes),
      );
    } catch (error) {
      console.warn('Redis cache write error:', error);
    }

    return permissionCodes;
  }

  /**
   * Invalider le cache Redis pour un rôle
   */
  private async invalidateRoleCache(roleCode: string) {
    const cacheKey = `role-permissions:${roleCode}`;
    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      console.warn('Redis cache invalidation error:', error);
    }
  }
}
