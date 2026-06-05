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

// PER-002 — assertCanAccessProject must issue exactly 1 DB query on the happy
// path (access granted), not 2. The existence check must only run as a
// fallback when canAccessProject returns false, to distinguish 404 from 403.
describe('AccessScopeService.assertCanAccessProject — PER-002 query count', () => {
  let service: AccessScopeService;
  const getPermissionsForRole = vi.fn();
  const projectCount = vi.fn();

  beforeEach(() => {
    getPermissionsForRole.mockReset();
    projectCount.mockReset();
    service = new AccessScopeService(
      { project: { count: projectCount } } as never,
      { getPermissionsForRole } as never,
    );
  });

  it('PER-002 — happy path: only 1 project.count call when caller has access', async () => {
    // Caller has no bypass permission, but the project IS in their scope.
    getPermissionsForRole.mockResolvedValue([]);
    // The combined access-scoped count returns 1 → access granted.
    projectCount.mockResolvedValue(1);

    await service.assertCanAccessProject('proj-1', {
      id: 'user-1',
      role: 'CONTRIBUTEUR',
    });

    // Must have been called exactly once (the combined count in canAccessProject).
    expect(projectCount).toHaveBeenCalledTimes(1);
  });

  it('PER-002 — 404 path: 2 project.count calls when project does not exist', async () => {
    // Caller has no bypass permission, and neither query finds the project.
    getPermissionsForRole.mockResolvedValue([]);
    // First call (access-scoped) → 0; second call (bare existence) → 0.
    projectCount.mockResolvedValue(0);

    await expect(
      service.assertCanAccessProject('missing-proj', {
        id: 'user-1',
        role: 'CONTRIBUTEUR',
      }),
    ).rejects.toThrow('Projet introuvable');

    expect(projectCount).toHaveBeenCalledTimes(2);
  });

  it('PER-002 — 403 path: 2 project.count calls when project exists but caller lacks access', async () => {
    // Caller has no bypass permission; project exists but is not in their scope.
    getPermissionsForRole.mockResolvedValue([]);
    // First call (access-scoped in canAccessProject) → 0 (no access).
    // Second call (bare existence to distinguish 404 vs 403) → 1 (exists).
    projectCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(
      service.assertCanAccessProject('proj-2', {
        id: 'user-1',
        role: 'CONTRIBUTEUR',
      }),
    ).rejects.toThrow('Accès projet non autorisé');

    expect(projectCount).toHaveBeenCalledTimes(2);
  });

  it('PER-002 — bypass path: 0 project.count calls when caller has projects:manage_any', async () => {
    // Bypass callers short-circuit before any DB query.
    getPermissionsForRole.mockResolvedValue(['projects:manage_any']);

    await service.assertCanAccessProject('proj-3', {
      id: 'admin-1',
      role: 'ADMIN',
    });

    // canAccessProject returns true immediately → no DB query needed.
    expect(projectCount).not.toHaveBeenCalled();
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
