import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function makeContext(isPublic: boolean): ExecutionContext {
    const handler = vi.fn();
    const classRef = vi.fn();
    return {
      getHandler: () => handler,
      getClass: () => classRef,
    } as unknown as ExecutionContext;
  }

  describe('canActivate', () => {
    it('should return true immediately for public routes', () => {
      const context = makeContext(true);
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should call super.canActivate for non-public routes', () => {
      const context = makeContext(false);
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      // Mock the parent class canActivate to avoid JWT processing
      const superCanActivate = vi
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true as any);

      const result = guard.canActivate(context);

      expect(superCanActivate).toHaveBeenCalledWith(context);
    });

    it('should call getAllAndOverride with IS_PUBLIC_KEY and handler/class', () => {
      const context = makeContext(false);
      const getAllAndOverrideSpy = vi
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(false);
      vi
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true as any);

      guard.canActivate(context);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
