import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.redis = new Redis(redisUrl);
  }

  async onModuleInit() {
    await this.seedPermissionsAndRolesIfEmpty();
  }

  /**
   * Seed automatique au démarrage si la table role_configs est vide
   */
  private async seedPermissionsAndRolesIfEmpty() {
    const existingRoles = await this.prisma.roleConfig.count();
    if (existingRoles === 0) {
      await this.seedPermissionsAndRoles();
    }
  }

  /**
   * Seed les permissions et rôles système (idempotent)
   */
  async seedPermissionsAndRoles() {
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
      // Events
      { code: 'events:create', module: 'events', action: 'create' },
      { code: 'events:read', module: 'events', action: 'read' },
      { code: 'events:update', module: 'events', action: 'update' },
      { code: 'events:delete', module: 'events', action: 'delete' },
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
        code: 'leaves:manage_delegations',
        module: 'leaves',
        action: 'manage_delegations',
      },
      // Telework
      { code: 'telework:create', module: 'telework', action: 'create' },
      { code: 'telework:read', module: 'telework', action: 'read' },
      { code: 'telework:update', module: 'telework', action: 'update' },
      { code: 'telework:delete', module: 'telework', action: 'delete' },
      { code: 'telework:read_team', module: 'telework', action: 'read_team' },
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
        description: 'Gestion complète sauf rôles et settings',
        isSystem: true,
        permissions: permissionsData
          .filter(
            (p) =>
              p.code !== 'users:manage_roles' && p.code !== 'settings:update',
          )
          .map((p) => p.code),
      },
      {
        code: 'MANAGER',
        name: 'Manager',
        description: 'Gestion de projets et tâches',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
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
          'leaves:read',
          'leaves:approve',
        ],
      },
      {
        code: 'CHEF_DE_PROJET',
        name: 'Chef de Projet',
        description: 'Gestion de projets et tâches (idem MANAGER)',
        isSystem: true,
        permissions: [
          'projects:create',
          'projects:read',
          'projects:update',
          'projects:delete',
          'projects:manage_members',
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
          'telework:create',
          'telework:read',
        ],
      },
      {
        code: 'OBSERVATEUR',
        name: 'Observateur',
        description: 'Accès en lecture seule',
        isSystem: true,
        permissions: permissionsData
          .filter((p) => p.action === 'read')
          .map((p) => p.code),
      },
    ];

    // Créer les rôles avec leurs permissions
    for (const roleData of rolesConfig) {
      const { permissions, ...roleInfo } = roleData;

      const role = await this.prisma.roleConfig.upsert({
        where: { code: roleData.code },
        update: {},
        create: roleInfo,
      });

      // Supprimer les anciennes permissions pour ce rôle
      await this.prisma.rolePermission.deleteMany({
        where: { roleConfigId: role.id },
      });

      // Créer les nouvelles permissions
      const permissionAssignments = permissions
        .map((permCode) => {
          const permId = permissionsMap.get(permCode);
          if (!permId) return null;
          return {
            roleConfigId: role.id,
            permissionId: permId,
          };
        })
        .filter((p) => p !== null);

      if (permissionAssignments.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissionAssignments,
          skipDuplicates: true,
        });
      }

      // Invalider le cache pour ce rôle
      await this.invalidateRoleCache(roleData.code);
    }

    return { message: 'Permissions et rôles créés avec succès' };
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
        return JSON.parse(cached);
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
