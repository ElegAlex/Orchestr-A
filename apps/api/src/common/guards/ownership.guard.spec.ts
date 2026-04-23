import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { OwnershipGuard } from './ownership.guard';
import { OWNERSHIP_METADATA } from '../decorators/ownership-check.decorator';
import type { OwnershipService } from '../services/ownership.service';
import type { PermissionsService } from '../../rbac/permissions.service';

function buildCtx(params: Record<string, any> | undefined, user: any) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ params, user }),
    }),
  } as unknown as ExecutionContext;
}

describe('OwnershipGuard', () => {
  let reflector: Reflector;
  let ownershipService: { isOwner: ReturnType<typeof vi.fn> };
  let permissionsService: {
    getPermissionsForUser: ReturnType<typeof vi.fn>;
  };
  let guard: OwnershipGuard;

  beforeEach(() => {
    reflector = new Reflector();
    ownershipService = { isOwner: vi.fn() };
    permissionsService = {
      getPermissionsForUser: vi.fn().mockResolvedValue([]),
    };
    guard = new OwnershipGuard(
      reflector,
      ownershipService as unknown as OwnershipService,
      permissionsService as unknown as PermissionsService,
    );
  });

  const setMeta = (opts: any) => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      (key: string) => (key === OWNERSHIP_METADATA ? opts : undefined),
    );
  };

  it('passes through when no metadata is set (guard is opt-in)', async () => {
    setMeta(undefined);
    const ctx = buildCtx({ id: 'r-1' }, { id: 'u-1', role: 'CONTRIBUTEUR' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ownershipService.isOwner).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when no user on request', async () => {
    setMeta({ resource: 'leave', paramKey: 'id' });
    const ctx = buildCtx({ id: 'r-1' }, undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws BadRequest when the route param is missing', async () => {
    setMeta({ resource: 'leave', paramKey: 'id' });
    const ctx = buildCtx({}, { id: 'u-1', role: 'CONTRIBUTEUR' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows owner to pass', async () => {
    setMeta({ resource: 'leave', paramKey: 'id' });
    ownershipService.isOwner.mockResolvedValue(true);
    const ctx = buildCtx({ id: 'r-1' }, { id: 'u-1', role: 'CONTRIBUTEUR' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ownershipService.isOwner).toHaveBeenCalledWith(
      'leave',
      'r-1',
      'u-1',
    );
  });

  it('rejects non-owner without bypass permission with Forbidden', async () => {
    setMeta({ resource: 'leave', paramKey: 'id' });
    ownershipService.isOwner.mockResolvedValue(false);
    const ctx = buildCtx({ id: 'r-1' }, { id: 'u-1', role: 'CONTRIBUTEUR' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows non-owner WITH bypass permission', async () => {
    setMeta({
      resource: 'project',
      paramKey: 'id',
      bypassPermission: 'projects:manage_any',
    });
    permissionsService.getPermissionsForUser.mockResolvedValue([
      'projects:manage_any',
    ]);
    ownershipService.isOwner.mockResolvedValue(false);
    const ctx = buildCtx({ id: 'p-1' }, { id: 'u-1', role: 'ADMIN' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ownershipService.isOwner).not.toHaveBeenCalled();
  });

  it('falls back to ownership check when user lacks bypass permission', async () => {
    setMeta({
      resource: 'project',
      paramKey: 'id',
      bypassPermission: 'projects:manage_any',
    });
    permissionsService.getPermissionsForUser.mockResolvedValue([
      'projects:read',
    ]);
    ownershipService.isOwner.mockResolvedValue(true);
    const ctx = buildCtx(
      { id: 'p-1' },
      { id: 'u-1', role: 'REFERENT_TECHNIQUE' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('surfaces Forbidden when the resource is not found (isOwner=false)', async () => {
    setMeta({ resource: 'event', paramKey: 'id' });
    ownershipService.isOwner.mockResolvedValue(false);
    const ctx = buildCtx(
      { id: 'missing' },
      { id: 'u-1', role: 'CONTRIBUTEUR' },
    );
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('respects custom paramKey', async () => {
    setMeta({ resource: 'timeEntry', paramKey: 'entryId' });
    ownershipService.isOwner.mockResolvedValue(true);
    const ctx = buildCtx(
      { entryId: 'te-9' },
      { id: 'u-1', role: 'CONTRIBUTEUR' },
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ownershipService.isOwner).toHaveBeenCalledWith(
      'timeEntry',
      'te-9',
      'u-1',
    );
  });
});
