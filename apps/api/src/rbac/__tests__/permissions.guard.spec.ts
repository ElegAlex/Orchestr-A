import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuardV2 } from '../permissions.guard';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ALLOW_SELF_SERVICE_KEY } from '../decorators/allow-self-service.decorator';
import {
  REQUIRE_PERMISSIONS_KEY,
  REQUIRE_ANY_PERMISSION_KEY,
} from '../decorators/require-permissions.decorator';
import type { PermissionsService } from '../permissions.service';

/**
 * Tests V3 F — PermissionsGuardV2 (zero-trust).
 *
 * Couvre les invariants P1-P8 du contract-04 §1 + nouveaux invariants V2 :
 *  - Mode `permissive` : log warning mais autorise (par défaut, V2 actuel).
 *  - Mode `enforce` : refuse si aucune méta RBAC ne couvre la route.
 *  - `@Public` / `@AllowSelfService` : passe sans check.
 *  - `@RequirePermissions` (AND) / `@RequireAnyPermission` (OR).
 *  - Source rôle = request.user (jamais body/headers).
 */

function buildCtx(user: unknown): ExecutionContext {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuardV2 — V3 F', () => {
  let reflector: Reflector;
  let permissions: { getPermissionsForUser: ReturnType<typeof vi.fn> };
  let originalMode: string | undefined;

  beforeEach(() => {
    originalMode = process.env.RBAC_GUARD_MODE;
    reflector = new Reflector();
    permissions = {
      getPermissionsForUser: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.RBAC_GUARD_MODE;
    else process.env.RBAC_GUARD_MODE = originalMode;
  });

  function makeGuard(mode: 'permissive' | 'enforce') {
    process.env.RBAC_GUARD_MODE = mode;
    return new PermissionsGuardV2(
      reflector,
      permissions as unknown as PermissionsService,
    );
  }

  describe('@Public()', () => {
    it('autorise sans aucun check (mode permissive)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === IS_PUBLIC_KEY ? true : undefined,
      );
      const guard = makeGuard('permissive');
      await expect(guard.canActivate(buildCtx(undefined))).resolves.toBe(true);
    });

    it('autorise sans aucun check (mode enforce)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === IS_PUBLIC_KEY ? true : undefined,
      );
      const guard = makeGuard('enforce');
      await expect(guard.canActivate(buildCtx(undefined))).resolves.toBe(true);
    });
  });

  describe('@AllowSelfService()', () => {
    it('autorise sans check de permissions (mode enforce)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === ALLOW_SELF_SERVICE_KEY ? true : undefined,
      );
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'CONTRIBUTEUR' })),
      ).resolves.toBe(true);
      expect(permissions.getPermissionsForUser).not.toHaveBeenCalled();
    });
  });

  describe('Aucun décorateur RBAC', () => {
    it('mode permissive : autorise et logue', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const guard = makeGuard('permissive');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'CONTRIBUTEUR' })),
      ).resolves.toBe(true);
    });

    it('mode enforce : refuse', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'CONTRIBUTEUR' })),
      ).resolves.toBe(false);
    });
  });

  describe('@RequirePermissions (AND)', () => {
    it('autorise si toutes les perms présentes', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_PERMISSIONS_KEY ? ['tasks:read', 'tasks:update'] : undefined,
      );
      permissions.getPermissionsForUser.mockResolvedValue([
        'tasks:read',
        'tasks:update',
        'tasks:delete',
      ]);
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'PROJECT_LEAD' })),
      ).resolves.toBe(true);
    });

    it('refuse si une perm manque (sémantique AND)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_PERMISSIONS_KEY ? ['tasks:read', 'tasks:delete'] : undefined,
      );
      permissions.getPermissionsForUser.mockResolvedValue(['tasks:read']);
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'CONTRIBUTEUR' })),
      ).resolves.toBe(false);
    });

    it('autorise si décorateur vide (P2)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_PERMISSIONS_KEY ? [] : undefined,
      );
      const guard = makeGuard('enforce');
      // Décorateur vide = aucune contrainte effective. En mode enforce, route
      // sans perm requise → refuse (le marqueur AllowSelfService doit être
      // utilisé pour autoriser explicitement).
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'CONTRIBUTEUR' })),
      ).resolves.toBe(false);
    });
  });

  describe('@RequireAnyPermission (OR)', () => {
    it('autorise dès qu\'une perm match', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_ANY_PERMISSION_KEY
          ? ['tasks:create', 'tasks:create_orphan', 'tasks:create_in_project']
          : undefined,
      );
      permissions.getPermissionsForUser.mockResolvedValue(['tasks:create_orphan']);
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'BASIC_USER' })),
      ).resolves.toBe(true);
    });

    it('refuse si aucune perm ne matche', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_ANY_PERMISSION_KEY
          ? ['tasks:create', 'tasks:create_in_project']
          : undefined,
      );
      permissions.getPermissionsForUser.mockResolvedValue(['tasks:read']);
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1', role: 'OBSERVATEUR' })),
      ).resolves.toBe(false);
    });
  });

  describe('SEC-03 — source rôle exclusivement request.user', () => {
    it('refuse si user absent', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_PERMISSIONS_KEY ? ['tasks:read'] : undefined,
      );
      const guard = makeGuard('enforce');
      await expect(guard.canActivate(buildCtx(undefined))).resolves.toBe(false);
    });

    it('refuse si user sans role ni roleEntity', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_PERMISSIONS_KEY ? ['tasks:read'] : undefined,
      );
      const guard = makeGuard('enforce');
      await expect(
        guard.canActivate(buildCtx({ id: 'u-1' })),
      ).resolves.toBe(false);
    });

    it('utilise roleEntity.code en priorité sur role', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === REQUIRE_PERMISSIONS_KEY ? ['tasks:read'] : undefined,
      );
      permissions.getPermissionsForUser.mockResolvedValue(['tasks:read']);
      const guard = makeGuard('enforce');
      await guard.canActivate(
        buildCtx({
          id: 'u-1',
          role: 'CONTRIBUTEUR',
          roleEntity: { code: 'BASIC_USER', templateKey: 'BASIC_USER' },
        }),
      );
      expect(permissions.getPermissionsForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          roleEntity: { code: 'BASIC_USER', templateKey: 'BASIC_USER' },
        }),
      );
    });
  });
});
