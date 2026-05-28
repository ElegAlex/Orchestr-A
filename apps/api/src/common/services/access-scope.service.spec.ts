import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessScopeService, AccessUser } from './access-scope.service';

// SEC-030 — unit coverage for the net-new `userReadWhere` horizontal read
// scope. `userReadWhere` performs no prisma queries (it is a pure relational
// WhereInput builder), so prisma is stubbed empty; only the permission
// resolution is driven.
describe('AccessScopeService.userReadWhere', () => {
  let service: AccessScopeService;
  const getPermissionsForRole = vi.fn();

  beforeEach(() => {
    getPermissionsForRole.mockReset();
    getPermissionsForRole.mockResolvedValue([]);
    service = new AccessScopeService({} as never, {
      getPermissionsForRole,
    } as never);
  });

  it('returns a sentinel no-access where when there is no caller', async () => {
    expect(await service.userReadWhere(undefined)).toEqual({
      id: '__no_access__',
    });
  });

  it('returns an empty where (every user) for a users:manage holder', async () => {
    getPermissionsForRole.mockResolvedValue(['users:manage']);
    const caller: AccessUser = { id: 'mgr-1', role: 'ADMIN' };

    expect(await service.userReadWhere(caller)).toEqual({});
  });

  it('restricts a plain users:read caller to self / same-service / managed-service / managed-department', async () => {
    getPermissionsForRole.mockResolvedValue(['users:read']);
    const caller: AccessUser = { id: 'caller-1', role: 'CONTRIBUTEUR' };

    const where = await service.userReadWhere(caller);

    expect(where.OR).toEqual([
      { id: 'caller-1' },
      {
        userServices: {
          some: {
            service: { userServices: { some: { userId: 'caller-1' } } },
          },
        },
      },
      { userServices: { some: { service: { managerId: 'caller-1' } } } },
      { department: { managerId: 'caller-1' } },
    ]);
  });
});
