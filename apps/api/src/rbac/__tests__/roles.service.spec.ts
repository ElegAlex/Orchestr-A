import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from '../roles.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PermissionsService } from '../permissions.service';

/**
 * Tests V3 F — RolesService.
 *
 * Couvre :
 *  - listRoles, listTemplates (26 templates).
 *  - createRole : conflict 409 sur code dupliqué, force isSystem=false.
 *  - updateRole : 403 si isSystem=true (D9 PO). templateKey immuable après
 *    création (un rôle créé sur un template y reste à vie) → jamais
 *    d'invalidation de cache côté updateRole.
 *  - deleteRole : 403 si isSystem=true, 409 si users rattachés (avec liste).
 *  - isDefault exclusif (un seul rôle par défaut à la fois).
 */

describe('RolesService — V3 F', () => {
  let service: RolesService;
  let prisma: {
    role: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let perms: { invalidateRoleCache: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      role: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    perms = { invalidateRoleCache: vi.fn().mockResolvedValue(undefined) };
    service = new RolesService(
      prisma as unknown as PrismaService,
      perms as unknown as PermissionsService,
    );
  });

  describe('listTemplates', () => {
    it('retourne les 26 templates du package rbac', () => {
      const templates = service.listTemplates();
      expect(templates.length).toBe(26);
      expect(templates[0]).toHaveProperty('key');
      expect(templates[0]).toHaveProperty('category');
      expect(templates[0]).toHaveProperty('permissions');
    });
  });

  describe('createRole', () => {
    it('crée un rôle custom avec isSystem=false forcé', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM_LEAD',
        label: 'Custom Lead',
        templateKey: 'PROJECT_LEAD',
        description: null,
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 0 },
      });

      const result = await service.createRole({
        code: 'CUSTOM_LEAD',
        label: 'Custom Lead',
        templateKey: 'PROJECT_LEAD',
      });

      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isSystem: false, // forcé
          }),
        }),
      );
      expect(result.isSystem).toBe(false);
    });

    it('rejette avec ConflictException si code déjà pris', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'r-existing' });
      await expect(
        service.createRole({
          code: 'ADMIN',
          label: 'Should fail',
          templateKey: 'ADMIN',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('si isDefault=true, désactive l\'ancien default', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({
        id: 'r-new',
        code: 'CUSTOM',
        label: 'New default',
        templateKey: 'BASIC_USER',
        description: null,
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 0 },
      });
      await service.createRole({
        code: 'CUSTOM',
        label: 'New default',
        templateKey: 'BASIC_USER',
        isDefault: true,
      });
      expect(prisma.role.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('updateRole — D9 (blocage isSystem)', () => {
    it('refuse update sur rôle système (403)', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'ADMIN',
        isSystem: true,
        templateKey: 'ADMIN',
        isDefault: false,
      });
      await expect(
        service.updateRole('r-1', { label: 'Renommé' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('NotFound si rôle inexistant', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(
        service.updateRole('r-x', { label: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('met à jour label/description/isDefault sans toucher à templateKey (immuable)', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        templateKey: 'BASIC_USER',
        label: 'Old',
        description: null,
        isDefault: false,
      });
      prisma.role.update.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        label: 'New',
        templateKey: 'BASIC_USER',
        description: 'desc',
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 0 },
      });
      await service.updateRole('r-1', { label: 'New', description: 'desc' });

      // templateKey ne doit JAMAIS être présent dans le payload `data` envoyé
      // à Prisma, même si existing.templateKey est consulté pour d'autres
      // champs. Un rôle créé sur BASIC_USER y reste à vie.
      const updateCall = prisma.role.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('templateKey');

      // templateKey étant immuable, updateRole n'invalide jamais le cache
      // permissions (aucun recalcul possible depuis ce endpoint).
      expect(perms.invalidateRoleCache).not.toHaveBeenCalled();
    });

    it('ignore silencieusement un templateKey passé au service (défense en profondeur)', async () => {
      // Le DTO UpdateRoleDto n'expose plus templateKey (ValidationPipe
      // whitelist=true + forbidNonWhitelisted=true rejette 400 en amont).
      // Ce test vérifie que même si un appelant interne bypass la DTO
      // et passe templateKey, le service le rejette implicitement en
      // n'assignant jamais ce champ à Prisma.
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        templateKey: 'BASIC_USER',
        label: 'Old',
        description: null,
        isDefault: false,
      });
      prisma.role.update.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        label: 'Old',
        templateKey: 'BASIC_USER',
        description: null,
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 0 },
      });

      // Cast pour forcer un input invalide au niveau service.
      await service.updateRole('r-1', {
        templateKey: 'PROJECT_CONTRIBUTOR',
      } as unknown as Parameters<typeof service.updateRole>[1]);

      const updateCall = prisma.role.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('templateKey');
      expect(perms.invalidateRoleCache).not.toHaveBeenCalled();
    });
  });

  describe('deleteRole — D9 + 409 users rattachés', () => {
    it('refuse delete sur rôle système (403)', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'ADMIN',
        isSystem: true,
        users: [],
      });
      await expect(service.deleteRole('r-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuse delete avec ConflictException + liste des users si rattachés', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        users: [
          { id: 'u-1', email: 'a@a.fr', firstName: 'A', lastName: 'Aa' },
          { id: 'u-2', email: 'b@b.fr', firstName: 'B', lastName: 'Bb' },
        ],
      });
      try {
        await service.deleteRole('r-1');
        expect.fail('expected ConflictException');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = (err as ConflictException).getResponse() as {
          users: Array<{ id: string }>;
        };
        expect(response.users).toHaveLength(2);
      }
    });

    it('supprime un rôle custom sans users + invalide cache', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        users: [],
      });
      await service.deleteRole('r-1');
      expect(prisma.role.delete).toHaveBeenCalledWith({
        where: { id: 'r-1' },
      });
      expect(perms.invalidateRoleCache).toHaveBeenCalledWith('CUSTOM');
    });

    it('NotFound si rôle inexistant', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.deleteRole('r-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
