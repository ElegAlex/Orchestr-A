import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from '../roles.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PermissionsService } from '../permissions.service';
import type { AuditPersistenceService } from '../../audit/audit-persistence.service';
import { AuditAction } from '../../audit/audit.service';

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
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let perms: { invalidateRoleCache: ReturnType<typeof vi.fn> };
  // OBS-005 — durable audit emitter. Injected as the 3rd ctor arg; pre-fix the
  // service ignores it (extra runtime arg) so the positive witnesses below fail
  // (log never called) and the no-op / caller-undefined negatives pass vacuously.
  let audit: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      role: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
    perms = { invalidateRoleCache: vi.fn().mockResolvedValue(undefined) };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    service = new RolesService(
      prisma as unknown as PrismaService,
      perms as unknown as PermissionsService,
      audit as unknown as AuditPersistenceService,
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

    it("si isDefault=true, désactive l'ancien default", async () => {
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

  describe('listRoles', () => {
    it('should return roles enriched with stats', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: 'r-1',
          code: 'ADMIN',
          label: 'Administrateur',
          templateKey: 'ADMIN',
          description: null,
          isSystem: true,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 5 },
        },
        {
          id: 'r-2',
          code: 'CUSTOM_LEAD',
          label: 'Chef de projet',
          templateKey: 'PROJECT_LEAD',
          description: 'Custom role',
          isSystem: false,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 2 },
        },
      ]);

      const result = await service.listRoles();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('r-1');
      expect(result[0].userCount).toBe(5);
      expect(result[1].id).toBe('r-2');
    });

    it('should return empty array when no roles exist', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      const result = await service.listRoles();

      expect(result).toHaveLength(0);
    });
  });

  describe('getRoleById', () => {
    it('should return role with stats by id', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'ADMIN',
        label: 'Administrateur',
        templateKey: 'ADMIN',
        description: null,
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 5 },
      });

      const result = await service.getRoleById('r-1');

      expect(result.id).toBe('r-1');
      expect(result.code).toBe('ADMIN');
      expect(result.userCount).toBe(5);
    });

    it('should throw NotFoundException when role not found', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.getRoleById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRole — isDefault transition', () => {
    it('should call unsetCurrentDefault when isDefault transitions to true', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        templateKey: 'BASIC_USER',
        label: 'Custom',
        description: null,
        isDefault: false, // currently not default
      });
      prisma.role.update.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        label: 'Custom',
        templateKey: 'BASIC_USER',
        description: null,
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 0 },
      });

      await service.updateRole('r-1', { isDefault: true });

      // Should call updateMany to unset current default
      expect(prisma.role.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });

    it('should NOT call unsetCurrentDefault when isDefault is already true', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        templateKey: 'BASIC_USER',
        label: 'Custom',
        description: null,
        isDefault: true, // already default
      });
      prisma.role.update.mockResolvedValue({
        id: 'r-1',
        code: 'CUSTOM',
        label: 'Custom',
        templateKey: 'BASIC_USER',
        description: null,
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 0 },
      });

      await service.updateRole('r-1', { isDefault: true });

      // updateMany should NOT be called since isDefault is already true
      expect(prisma.role.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── OBS-005 — durable audit emission on role mutations ─────────────────
  //
  // FAIL-pre witnesses: on master RolesService emits nothing (audit.log is
  // never called), so every positive assertion below fails until the fix wires
  // AuditPersistenceService into create/update/delete. The no-op and
  // caller-undefined negatives pass vacuously pre-fix and stay green post-fix.
  describe('OBS-005 — audit emission', () => {
    const caller = { id: 'actor-1' };

    function createdRole(overrides: Record<string, unknown> = {}) {
      return {
        id: 'r-new',
        code: 'CUSTOM_LEAD',
        label: 'Custom Lead',
        templateKey: 'PROJECT_LEAD',
        description: null,
        isSystem: false,
        isDefault: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        _count: { users: 0 },
        ...overrides,
      };
    }

    describe('ROLE_CREATED', () => {
      it('emits ROLE_CREATED with entityType=Role, entityId=role.id and after-scalars', async () => {
        prisma.role.findUnique.mockResolvedValue(null);
        prisma.role.create.mockResolvedValue(createdRole());

        await service.createRole(
          {
            code: 'CUSTOM_LEAD',
            label: 'Custom Lead',
            templateKey: 'PROJECT_LEAD',
          },
          caller,
        );

        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_CREATED,
            entityType: 'Role',
            entityId: 'r-new',
            actorId: 'actor-1',
            payload: expect.objectContaining({
              after: expect.objectContaining({
                code: 'CUSTOM_LEAD',
                label: 'Custom Lead',
                templateKey: 'PROJECT_LEAD',
                isDefault: false,
                isSystem: false,
              }),
            }),
          }),
        );
      });

      it('does NOT emit when caller is undefined (internal/test path)', async () => {
        prisma.role.findUnique.mockResolvedValue(null);
        prisma.role.create.mockResolvedValue(createdRole());

        await service.createRole({
          code: 'CUSTOM_LEAD',
          label: 'Custom Lead',
          templateKey: 'PROJECT_LEAD',
        });

        expect(audit.log).not.toHaveBeenCalled();
      });
    });

    describe('ROLE_UPDATED', () => {
      const existing = {
        id: 'r-1',
        code: 'CUSTOM',
        isSystem: false,
        templateKey: 'BASIC_USER',
        label: 'Old',
        description: null,
        isDefault: false,
      };

      it('emits ROLE_UPDATED with before/after scalars and a changed[] diff', async () => {
        prisma.role.findUnique.mockResolvedValue(existing);
        prisma.role.update.mockResolvedValue({
          ...existing,
          label: 'New',
          description: 'desc',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 0 },
        });

        await service.updateRole(
          'r-1',
          { label: 'New', description: 'desc' },
          caller,
        );

        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_UPDATED,
            entityType: 'Role',
            entityId: 'r-1',
            actorId: 'actor-1',
            payload: expect.objectContaining({
              before: expect.objectContaining({
                label: 'Old',
                description: null,
              }),
              after: expect.objectContaining({
                label: 'New',
                description: 'desc',
              }),
              changed: expect.arrayContaining(['label', 'description']),
            }),
          }),
        );
      });

      it('does NOT emit ROLE_UPDATED when the DTO touches no monitored field (no-op)', async () => {
        prisma.role.findUnique.mockResolvedValue(existing);
        prisma.role.update.mockResolvedValue({
          ...existing,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 0 },
        });

        // label === existing.label, description === existing.description, no isDefault.
        await service.updateRole('r-1', { label: 'Old' }, caller);

        const updatedCalls = audit.log.mock.calls.filter(
          (c) => c[0]?.action === AuditAction.ROLE_UPDATED,
        );
        expect(updatedCalls).toHaveLength(0);
      });

      it('does NOT emit when caller is undefined', async () => {
        prisma.role.findUnique.mockResolvedValue(existing);
        prisma.role.update.mockResolvedValue({
          ...existing,
          label: 'New',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 0 },
        });

        await service.updateRole('r-1', { label: 'New' });

        expect(audit.log).not.toHaveBeenCalled();
      });
    });

    describe('ROLE_DELETED', () => {
      it('emits ROLE_DELETED with payload.snapshot BEFORE the delete', async () => {
        prisma.role.findUnique.mockResolvedValue({
          id: 'r-1',
          code: 'CUSTOM',
          label: 'Custom',
          templateKey: 'BASIC_USER',
          description: 'd',
          isSystem: false,
          isDefault: false,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
          users: [],
        });

        let snapshotPresentAtDeleteTime = false;
        prisma.role.delete.mockImplementation(() => {
          // The audit row (with snapshot) must already be emitted by the time
          // the row is erased (DAT-007 PROJECT_DELETED precedent).
          snapshotPresentAtDeleteTime = audit.log.mock.calls.some(
            (c) =>
              c[0]?.action === AuditAction.ROLE_DELETED &&
              c[0]?.payload?.snapshot?.id === 'r-1',
          );
          return undefined;
        });

        await service.deleteRole('r-1', caller);

        expect(snapshotPresentAtDeleteTime).toBe(true);
        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_DELETED,
            entityType: 'Role',
            entityId: 'r-1',
            actorId: 'actor-1',
            payload: expect.objectContaining({
              snapshot: expect.objectContaining({
                id: 'r-1',
                code: 'CUSTOM',
                templateKey: 'BASIC_USER',
                isDefault: false,
              }),
            }),
          }),
        );
      });

      it('does NOT emit when caller is undefined', async () => {
        prisma.role.findUnique.mockResolvedValue({
          id: 'r-1',
          code: 'CUSTOM',
          isSystem: false,
          users: [],
        });

        await service.deleteRole('r-1');

        expect(audit.log).not.toHaveBeenCalled();
      });
    });

    describe('ROLE_DEFAULT_CHANGED', () => {
      it('captures prior-default-role-id and new-default-role-id on false→true (create)', async () => {
        prisma.role.findUnique.mockResolvedValue(null);
        prisma.role.findFirst.mockResolvedValue({ id: 'r-old-default' });
        prisma.role.create.mockResolvedValue(
          createdRole({ id: 'r-new', isDefault: true }),
        );

        await service.createRole(
          {
            code: 'CUSTOM_LEAD',
            label: 'Custom Lead',
            templateKey: 'PROJECT_LEAD',
            isDefault: true,
          },
          caller,
        );

        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_DEFAULT_CHANGED,
            entityType: 'Role',
            entityId: 'r-new',
            actorId: 'actor-1',
            payload: expect.objectContaining({
              before: { defaultRoleId: 'r-old-default' },
              after: { defaultRoleId: 'r-new' },
            }),
          }),
        );
      });

      it('captures the singleton shift on false→true (update)', async () => {
        prisma.role.findUnique.mockResolvedValue({
          id: 'r-1',
          code: 'CUSTOM',
          isSystem: false,
          templateKey: 'BASIC_USER',
          label: 'Custom',
          description: null,
          isDefault: false,
        });
        prisma.role.findFirst.mockResolvedValue({ id: 'r-old-default' });
        prisma.role.update.mockResolvedValue({
          id: 'r-1',
          code: 'CUSTOM',
          label: 'Custom',
          templateKey: 'BASIC_USER',
          description: null,
          isSystem: false,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 0 },
        });

        await service.updateRole('r-1', { isDefault: true }, caller);

        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_DEFAULT_CHANGED,
            payload: expect.objectContaining({
              before: { defaultRoleId: 'r-old-default' },
              after: { defaultRoleId: 'r-1' },
            }),
          }),
        );
      });

      it('records default removal on true→false (after=null)', async () => {
        prisma.role.findUnique.mockResolvedValue({
          id: 'r-1',
          code: 'CUSTOM',
          isSystem: false,
          templateKey: 'BASIC_USER',
          label: 'Custom',
          description: null,
          isDefault: true,
        });
        prisma.role.update.mockResolvedValue({
          id: 'r-1',
          code: 'CUSTOM',
          label: 'Custom',
          templateKey: 'BASIC_USER',
          description: null,
          isSystem: false,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 0 },
        });

        await service.updateRole('r-1', { isDefault: false }, caller);

        expect(audit.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_DEFAULT_CHANGED,
            payload: expect.objectContaining({
              before: { defaultRoleId: 'r-1' },
              after: { defaultRoleId: null },
            }),
          }),
        );
      });
    });
  });
});
