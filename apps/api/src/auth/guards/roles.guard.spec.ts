import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, User } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * SEC-03 defense-in-depth contract test.
 *
 * The backend MUST derive the caller's role from `request.user.role` (populated
 * by the JWT strategy from the DB-persisted role) — NEVER from any client-
 * provided payload (body, headers, query). This spec locks that contract so a
 * regression (e.g. someone reading `body.role` in the guard) fails the build.
 */
describe('RolesGuard — SEC-03 contract', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockUser = {
    id: 'user-1',
    role: 'CONTRIBUTEUR' as Role,
  } as unknown as User;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function makeContext(
    user: User | undefined,
    body: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, body, headers }),
      }),
      getHandler: vi.fn(),
      getClass: vi.fn(),
    } as unknown as ExecutionContext;
  }

  it('allows when there is no @Roles decorator', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === ROLES_KEY) return undefined;
      return undefined;
    });

    const ctx = makeContext(mockUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('defers to PermissionsGuard when @Permissions decorator is set', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['tasks:read'];
      return undefined;
    });
    const ctx = makeContext(mockUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when request.user.role matches one of the required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === ROLES_KEY) return ['ADMIN', 'MANAGER'] as Role[];
      return undefined;
    });
    const ctx = makeContext({ ...mockUser, role: 'MANAGER' as Role });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when request.user.role does NOT match the required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === ROLES_KEY) return ['ADMIN'] as Role[];
      return undefined;
    });
    const ctx = makeContext(mockUser); // CONTRIBUTEUR
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('IGNORES client-provided body.role — cannot escalate by putting role=ADMIN in the request body', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === ROLES_KEY) return ['ADMIN'] as Role[];
      return undefined;
    });
    // Attacker tries to smuggle role=ADMIN via body
    const ctx = makeContext(mockUser, { role: 'ADMIN' });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('IGNORES client-provided headers.x-role — cannot escalate via custom headers', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === ROLES_KEY) return ['ADMIN'] as Role[];
      return undefined;
    });
    const ctx = makeContext(
      mockUser, // CONTRIBUTEUR
      {},
      { 'x-role': 'ADMIN', role: 'ADMIN' },
    );
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('still allows a real ADMIN through even if body also says ADMIN — decision is driven by request.user only', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return undefined;
      if (key === ROLES_KEY) return ['ADMIN'] as Role[];
      return undefined;
    });
    const adminUser = { ...mockUser, role: 'ADMIN' as Role };
    const ctx = makeContext(adminUser, { role: 'CONTRIBUTEUR' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
