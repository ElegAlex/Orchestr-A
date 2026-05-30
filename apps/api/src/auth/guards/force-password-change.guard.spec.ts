import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForcePasswordChangeGuard } from './force-password-change.guard';

/**
 * SEC-004 witness (AC#2). FAILS pre-fix (guard does not exist), PASSES post-fix:
 * a forcePasswordChange-flagged session is rejected on a normal route and only
 * allowed on a route bearing @AllowPasswordChange(). An unflagged session passes
 * everywhere.
 */
function makeContext(
  user: { forcePasswordChange?: boolean } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function makeGuard(allowPasswordChange: boolean) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(allowPasswordChange),
  } as unknown as Reflector;
  return new ForcePasswordChangeGuard(reflector);
}

describe('ForcePasswordChangeGuard (SEC-004)', () => {
  it('BLOCKS a flagged user on a normal route (no @AllowPasswordChange) → 403 PASSWORD_CHANGE_REQUIRED', () => {
    const guard = makeGuard(false);
    const ctx = makeContext({ forcePasswordChange: true });

    let caught: ForbiddenException | undefined;
    try {
      guard.canActivate(ctx);
    } catch (err) {
      caught = err as ForbiddenException;
    }

    expect(caught).toBeInstanceOf(ForbiddenException);
    const body = caught!.getResponse() as { code?: string };
    expect(body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('ALLOWS a flagged user on a route marked @AllowPasswordChange()', () => {
    const guard = makeGuard(true);
    const ctx = makeContext({ forcePasswordChange: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ALLOWS an unflagged user on any normal route', () => {
    const guard = makeGuard(false);
    const ctx = makeContext({ forcePasswordChange: false });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ALLOWS when forcePasswordChange is absent (legacy / unflagged session)', () => {
    const guard = makeGuard(false);
    const ctx = makeContext({});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ALLOWS when there is no authenticated user (e.g. @Public route)', () => {
    const guard = makeGuard(false);
    const ctx = makeContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
