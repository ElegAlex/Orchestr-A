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
    service = new AccessScopeService(
      {} as never,
      {
        getPermissionsForRole,
      } as never,
    );
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

// SEC-028 — taskReadWhere must not leak confidential tasks via assignment.
// A task marked confidential=true must only be readable by privileged callers
// (tasks:readAll / tasks:manage_any) or project-role members — never by
// assignment alone (assigneeId OR assignees).
describe('AccessScopeService.taskReadWhere — SEC-028 confidential gate', () => {
  let service: AccessScopeService;
  const getPermissionsForRole = vi.fn();

  beforeEach(() => {
    getPermissionsForRole.mockReset();
    getPermissionsForRole.mockResolvedValue([]);
    service = new AccessScopeService(
      {} as never,
      {
        getPermissionsForRole,
      } as never,
    );
  });

  it('returns sentinel no-access where when there is no caller', async () => {
    expect(await service.taskReadWhere(undefined)).toEqual({
      id: '__no_access__',
    });
  });

  it('returns an empty where for a tasks:readAll holder (privileged — no confidential gate)', async () => {
    getPermissionsForRole.mockResolvedValue(['tasks:readAll']);
    const caller: AccessUser = { id: 'priv-1', role: 'ADMIN' };
    expect(await service.taskReadWhere(caller)).toEqual({});
  });

  it('gates both assignment branches on confidential:false for a non-privileged caller', async () => {
    // non-privileged: no tasks:readAll, no tasks:manage_any
    getPermissionsForRole.mockResolvedValue([]);
    const caller: AccessUser = { id: 'user-1', role: 'CONTRIBUTEUR' };

    const where = await service.taskReadWhere(caller);

    // The assigneeId branch MUST include confidential:false so that a
    // confidential task reached only via reassignment is excluded.
    expect(where.OR).toContainEqual({
      assigneeId: caller.id,
      confidential: false,
    });

    // The multi-assignee (TaskAssignee) branch MUST also be gated.
    expect(where.OR).toContainEqual({
      assignees: { some: { userId: caller.id } },
      confidential: false,
    });
  });

  it('project-role branch is NOT gated by confidential (project membership grants full read)', async () => {
    getPermissionsForRole.mockResolvedValue([]);
    const caller: AccessUser = { id: 'user-2', role: 'MANAGER' };

    const where = await service.taskReadWhere(caller);

    // The project-role branch must exist and must NOT carry a confidential filter
    const projectBranch = (where.OR as object[]).find((b) => 'project' in b);
    expect(projectBranch).toBeDefined();
    expect(projectBranch).not.toHaveProperty('confidential');
  });
});
