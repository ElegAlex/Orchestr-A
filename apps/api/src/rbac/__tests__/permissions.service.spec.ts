import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_KEYS,
  CATALOG_PERMISSIONS,
} from 'rbac';
import { PermissionsService } from '../permissions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

/**
 * Tests RBAC V4 — PermissionsService.
 *
 * Couvre :
 *  - Pour chaque templateKey, retourne le set de
 *    `ROLE_TEMPLATES[key].permissions`.
 *  - Cache Redis : transparent côté contrat (testé via mock).
 *  - Helpers `roleHasAll`, `roleHasAny`, `getPermissionsForUser`.
 *  - `manage_any` (D6 #4 inclus) : présence dans les sets ADMIN/ADMIN_DELEGATED.
 *
 * Post-V4 : plus de fallback legacy `RoleManagementService` (supprimé). Le
 * lookup est exclusivement `prisma.role.findUnique` → `ROLE_TEMPLATES`.
 */

describe('PermissionsService — V4', () => {
  let service: PermissionsService;
  let prisma: { role: { findUnique: ReturnType<typeof vi.fn> } };
  let redis: {
    get: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };
    prisma = {
      role: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'REDIS_URL') return undefined;
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return undefined;
      }),
    };
    service = new PermissionsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
    // Override redis client (instantiated in constructor) avec notre mock
    (service as unknown as { redis: typeof redis }).redis = redis;
  });

  describe('getPermissionsForRole — template lookup', () => {
    for (const tplKey of ROLE_TEMPLATE_KEYS) {
      it(`${tplKey} → retourne ${ROLE_TEMPLATES[tplKey].permissions.length} permissions du template`, async () => {
        prisma.role.findUnique.mockResolvedValue({ templateKey: tplKey });
        const perms = await service.getPermissionsForRole(tplKey);
        expect(perms).toEqual([...ROLE_TEMPLATES[tplKey].permissions]);
        expect(perms.length).toBe(ROLE_TEMPLATES[tplKey].permissions.length);
        expect(redis.setex).toHaveBeenCalledWith(
          `role-permissions:${tplKey}`,
          300,
          expect.any(String),
        );
      });
    }
  });

  describe('getPermissionsForRole — edge cases', () => {
    it('returns [] si role absent de la table roles', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      const perms = await service.getPermissionsForRole('UNKNOWN_CODE');
      expect(perms).toEqual([]);
    });

    it('returns [] si templateKey orphelin (rôle pointe vers templateKey inconnu)', async () => {
      prisma.role.findUnique.mockResolvedValue({
        templateKey: 'TEMPLATE_INEXISTANT',
      });
      const perms = await service.getPermissionsForRole('SOME_CODE');
      expect(perms).toEqual([]);
    });

    it('returns [] si roleCode null/undefined (skip lookup)', async () => {
      expect(await service.getPermissionsForRole(null)).toEqual([]);
      expect(await service.getPermissionsForRole(undefined)).toEqual([]);
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Cache Redis', () => {
    it('lit le cache si présent (skip DB)', async () => {
      redis.get.mockResolvedValue(JSON.stringify(['cached:perm']));
      const perms = await service.getPermissionsForRole('ADMIN');
      expect(perms).toEqual(['cached:perm']);
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('fail-soft sur erreur Redis (warning + fallback DB)', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'));
      prisma.role.findUnique.mockResolvedValue({ templateKey: 'ADMIN' });
      const perms = await service.getPermissionsForRole('ADMIN');
      expect(perms.length).toBe(ROLE_TEMPLATES.ADMIN.permissions.length);
    });
  });

  describe('getPermissionsForUser', () => {
    it('utilise user.role.code si présent', async () => {
      prisma.role.findUnique.mockResolvedValue({ templateKey: 'BASIC_USER' });
      const perms = await service.getPermissionsForUser({
        role: { code: 'BASIC_USER' },
      });
      expect(perms.length).toBe(ROLE_TEMPLATES.BASIC_USER.permissions.length);
      expect(prisma.role.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'BASIC_USER' } }),
      );
    });

    it('returns [] si user sans role', async () => {
      const perms = await service.getPermissionsForUser({});
      expect(perms).toEqual([]);
    });

    it('returns [] si user.role = null', async () => {
      const perms = await service.getPermissionsForUser({ role: null });
      expect(perms).toEqual([]);
    });
  });

  describe('roleHasAll / roleHasAny (sémantique AND/OR)', () => {
    beforeEach(() => {
      prisma.role.findUnique.mockResolvedValue({ templateKey: 'BASIC_USER' });
    });

    it('roleHasAll([]) toujours true (P2 contract-04)', async () => {
      expect(await service.roleHasAll('BASIC_USER', [])).toBe(true);
    });

    it('roleHasAll matche quand toutes les perms présentes', async () => {
      const perms = ROLE_TEMPLATES.BASIC_USER.permissions;
      expect(
        await service.roleHasAll('BASIC_USER', [perms[0], perms[1]]),
      ).toBe(true);
    });

    it('roleHasAll rejette si une perm absente', async () => {
      expect(
        await service.roleHasAll('BASIC_USER', ['users:manage_roles']),
      ).toBe(false);
    });

    it("roleHasAny matche dès qu'une perm présente", async () => {
      expect(
        await service.roleHasAny('BASIC_USER', [
          'users:manage_roles', // absent BASIC_USER
          ROLE_TEMPLATES.BASIC_USER.permissions[0], // présent
        ]),
      ).toBe(true);
    });

    it('roleHasAny rejette si aucune perm présente', async () => {
      expect(
        await service.roleHasAny('BASIC_USER', [
          'users:manage_roles',
          'settings:update',
        ]),
      ).toBe(false);
    });
  });

  describe('manage_any — D6 #4 (documents:manage_any)', () => {
    it('ADMIN possède documents:manage_any (D6 #4)', async () => {
      prisma.role.findUnique.mockResolvedValue({ templateKey: 'ADMIN' });
      const perms = await service.getPermissionsForRole('ADMIN');
      expect(perms).toContain('documents:manage_any');
    });

    it('ADMIN_DELEGATED possède documents:manage_any (D6 #4)', async () => {
      prisma.role.findUnique.mockResolvedValue({
        templateKey: 'ADMIN_DELEGATED',
      });
      const perms = await service.getPermissionsForRole('ADMIN_DELEGATED');
      expect(perms).toContain('documents:manage_any');
    });

    it('BASIC_USER ne possède PAS documents:manage_any', async () => {
      prisma.role.findUnique.mockResolvedValue({ templateKey: 'BASIC_USER' });
      const perms = await service.getPermissionsForRole('BASIC_USER');
      expect(perms).not.toContain('documents:manage_any');
    });

    const ALL_MANAGE_ANY = [
      'tasks:manage_any',
      'projects:manage_any',
      'events:manage_any',
      'time_tracking:manage_any',
      'telework:manage_any',
      'documents:manage_any',
      'leaves:manage_any',
    ];
    for (const ma of ALL_MANAGE_ANY) {
      it(`ADMIN possède ${ma} (template = catalogue complet)`, async () => {
        prisma.role.findUnique.mockResolvedValue({ templateKey: 'ADMIN' });
        const perms = await service.getPermissionsForRole('ADMIN');
        expect(perms).toContain(ma);
      });
    }
  });

  describe('Granularité (P7 contract-04)', () => {
    it("PROJECT_CONTRIBUTOR n'a pas users:delete", async () => {
      prisma.role.findUnique.mockResolvedValue({
        templateKey: 'PROJECT_CONTRIBUTOR',
      });
      const perms = await service.getPermissionsForRole('PROJECT_CONTRIBUTOR');
      expect(perms).not.toContain('users:delete');
    });

    it("OBSERVER_HR_ONLY n'a pas projects:read (scope RH)", async () => {
      prisma.role.findUnique.mockResolvedValue({
        templateKey: 'OBSERVER_HR_ONLY',
      });
      const perms = await service.getPermissionsForRole('OBSERVER_HR_ONLY');
      expect(perms).not.toContain('projects:read');
    });

    it("OBSERVER_PROJECTS_ONLY n'a pas leaves:read (scope projet)", async () => {
      prisma.role.findUnique.mockResolvedValue({
        templateKey: 'OBSERVER_PROJECTS_ONLY',
      });
      const perms = await service.getPermissionsForRole(
        'OBSERVER_PROJECTS_ONLY',
      );
      expect(perms).not.toContain('leaves:read');
    });
  });

  describe('Catalogue (sanity check)', () => {
    it('CATALOG_PERMISSIONS contient 108 permissions', () => {
      expect(CATALOG_PERMISSIONS.length).toBe(108);
    });
  });

  describe('invalidateRoleCache', () => {
    it('appelle redis.del avec la bonne clé', async () => {
      await service.invalidateRoleCache('ADMIN');
      expect(redis.del).toHaveBeenCalledWith('role-permissions:ADMIN');
    });
  });
});
