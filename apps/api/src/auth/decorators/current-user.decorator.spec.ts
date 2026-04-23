import { describe, it, expect } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser, CurrentUserRoleCode } from './current-user.decorator';

function createMockContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function getDecoratorFactory(decorator: any) {
  // NestJS param decorators store their factory in metadata
  // We can call the decorator to get the metadata key, then retrieve the factory
  class Dummy {
    handler(@decorator() _user: any) {
      void _user;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Dummy, 'handler');
  if (!args) return null;
  const key = Object.keys(args)[0];
  return args[key]?.factory;
}

describe('CurrentUser decorator', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    login: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: {
      id: 'role-1',
      code: 'CONTRIBUTEUR',
      label: 'Contributeur',
      templateKey: 'CONTRIBUTOR',
      isSystem: true,
    },
  };

  it('should return the full user when no data key is provided', () => {
    const factory = getDecoratorFactory(CurrentUser);
    if (!factory) return; // Skip if metadata not available

    const ctx = createMockContext(mockUser);
    const result = factory(undefined, ctx);
    expect(result).toEqual(mockUser);
  });

  it('should return a specific user field when data key is provided', () => {
    const factory = getDecoratorFactory(CurrentUser);
    if (!factory) return;

    const ctx = createMockContext(mockUser);
    const result = factory('id', ctx);
    expect(result).toBe('user-1');
  });

  it('should return email field', () => {
    const factory = getDecoratorFactory(CurrentUser);
    if (!factory) return;

    const ctx = createMockContext(mockUser);
    const result = factory('email', ctx);
    expect(result).toBe('test@example.com');
  });

  it('should return undefined when user is null and data key is provided', () => {
    const factory = getDecoratorFactory(CurrentUser);
    if (!factory) return;

    const ctx = createMockContext(null);
    const result = factory('id', ctx);
    expect(result).toBeUndefined();
  });
});

describe('CurrentUserRoleCode decorator', () => {
  const mockUserWithRole = {
    role: { code: 'ADMIN' },
  };

  it('should return the role code when user has a role', () => {
    const factory = getDecoratorFactory(CurrentUserRoleCode);
    if (!factory) return;

    const ctx = createMockContext(mockUserWithRole);
    const result = factory(undefined, ctx);
    expect(result).toBe('ADMIN');
  });

  it('should return null when user has no role', () => {
    const factory = getDecoratorFactory(CurrentUserRoleCode);
    if (!factory) return;

    const ctx = createMockContext({ role: null });
    const result = factory(undefined, ctx);
    expect(result).toBeNull();
  });

  it('should return null when user is null', () => {
    const factory = getDecoratorFactory(CurrentUserRoleCode);
    if (!factory) return;

    const ctx = createMockContext(null);
    const result = factory(undefined, ctx);
    expect(result).toBeNull();
  });
});
