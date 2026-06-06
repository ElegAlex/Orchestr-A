import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ROLE_TEMPLATES, type PermissionCode } from 'rbac';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessScopeService } from './access-scope.service';
import type { PermissionsService } from '../../rbac/permissions.service';
import type { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { LeavesController } from '../../leaves/leaves.controller';
import type { LeavesService } from '../../leaves/leaves.service';
import { SkillsController } from '../../skills/skills.controller';
import type { SkillsService } from '../../skills/skills.service';

/**
 * SEC-030 (2026-06-04 cycle) — Real-Postgres integration witness for the
 * server-side managed-scope enforcement on the by-user read endpoints.
 *
 * THE GAP this closes
 * -------------------
 * The SuiviPage (`/users/[id]/suivi`) gates cross-user access entirely in the
 * browser (`checkAccess` reads `currentUser.managedServices` from the Zustand
 * store). An attacker who manipulates the store calls the by-user API endpoints
 * directly. Reconciliation against the live RBAC templates (see the SEC-030
 * backlog entry / MANIFEST §4) showed that, of the seven calls the page makes,
 * only TWO actually over-expose data to a managed-scope role:
 *
 *   - GET /leaves/balance/:userId  — gated by the GLOBAL `leaves:approve`, which
 *     MANAGER / MANAGER_HR_FOCUS / HR_OFFICER all hold → any of them could read
 *     ANY user's balance, ignoring their managed-service perimeter.
 *   - GET /skills/user/:userId     — gated only by `skills:read` with NO per-user
 *     scope at all → any reader could read any user's skills.
 *
 * The other five were already equal-or-stronger and are NOT re-touched:
 *   - GET /tasks/assignee/:userId   → service requires GLOBAL `tasks:readAll`
 *                                     (MANAGER lacks it → 403).
 *   - GET /leaves?userId=           → service forces self unless `leaves:readAll`.
 *   - GET /telework?userId=         → service forces self unless `telework:readAll`.
 *   - GET /time-tracking/.../report → guarded by `time_tracking:read_reports`
 *                                     (CONTROLLER/BUDGET_ANALYST only; MANAGER
 *                                     lacks it). The suivi page's `/stats` route
 *                                     does not even exist (404).
 *   - GET /projects/user/:userId    → service already intersects with the
 *                                     caller's accessible-project scope.
 *
 * The scope predicate is the existing `AccessScopeService.canManageUser`
 * (ADMIN-template bypass + shared-service-membership + managed-department),
 * the same write-scope used for user update/deactivate.
 *
 * RED capture (discriminating)
 * ----------------------------
 * Before the controller fix (scope check absent, signature present), caller A —
 * a MANAGER who holds `leaves:approve`/`skills:read` but does NOT manage target
 * B — reads B's balance and skills (the stub services return a sentinel; no
 * throw) → the "must reject" assertions below are RED. The positive controls
 * (self, same-service peer C) pass in both states, proving the fix does not
 * over-restrict legitimate access.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts.
 */

const prisma = new PrismaService();

// --------------------------------------------------------------------------
// Stub PermissionsService — resolves from the REAL ROLE_TEMPLATES (no Redis).
// The DB stays real for every scope query (canManageUser hits user/department/
// user_service tables); only the role→permission resolution is short-circuited.
// --------------------------------------------------------------------------
const permsByCode: Record<string, readonly PermissionCode[]> = {
  MANAGER: ROLE_TEMPLATES.MANAGER.permissions,
  ADMIN: ROLE_TEMPLATES.ADMIN.permissions,
};
const permissionsStub = {
  getPermissionsForRole: async (
    code: string | null | undefined,
  ): Promise<readonly PermissionCode[]> => (code && permsByCode[code]) || [],
} as unknown as PermissionsService;

const accessScope = new AccessScopeService(prisma, permissionsStub);

// Domain services are stubbed: the authorization decision happens in the
// controller / AccessScopeService BEFORE the service is reached on the happy
// path, so the stubs only need to return a recognisable sentinel.
const leavesServiceStub = {
  getLeaveBalance: async (userId: string) => ({ userId, sentinel: true }),
} as unknown as LeavesService;
const skillsServiceStub = {
  getUserSkills: async (userId: string) => ({
    userId,
    total: 0,
    skills: [],
    byCategory: {},
  }),
} as unknown as SkillsService;

const leavesController = new LeavesController(
  leavesServiceStub,
  permissionsStub,
  accessScope,
);
const skillsController = new SkillsController(skillsServiceStub, accessScope);

function manager(id: string): AuthenticatedUser {
  return {
    id,
    role: {
      id: 'role-manager',
      code: 'MANAGER',
      label: 'Manager',
      templateKey: 'MANAGER',
      isSystem: false,
    },
  } as unknown as AuthenticatedUser;
}

describe('SEC-030 — server-side managed-scope on by-user read endpoints (real DB)', () => {
  // A = MANAGER in service S1; B = target in service S2 (no overlap, dept not
  // managed by A); C = peer in service S1 (shares a service with A → manageable).
  let aId: string;
  let bId: string;
  let cId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const tag = randomUUID().slice(0, 8);
    const dept1 = await prisma.department.create({
      data: { name: `sec030-d1-${tag}` },
    });
    const dept2 = await prisma.department.create({
      data: { name: `sec030-d2-${tag}` },
    });
    const s1 = await prisma.service.create({
      data: { name: `sec030-s1-${tag}`, departmentId: dept1.id },
    });
    const s2 = await prisma.service.create({
      data: { name: `sec030-s2-${tag}`, departmentId: dept2.id },
    });

    const mk = async (
      label: string,
      departmentId: string,
      serviceId: string,
    ) => {
      const u = await prisma.user.create({
        data: {
          email: `sec030-${label}-${tag}@witness.test`,
          login: `sec030-${label}-${tag}`,
          passwordHash: 'x',
          firstName: 'SEC030',
          lastName: label,
          departmentId,
        },
      });
      await prisma.userService.create({
        data: { userId: u.id, serviceId },
      });
      return u.id;
    };

    aId = await mk('A', dept1.id, s1.id);
    bId = await mk('B', dept2.id, s2.id);
    cId = await mk('C', dept1.id, s1.id);
  });

  afterAll(async () => {
    await prisma.userService.deleteMany({
      where: { userId: { in: [aId, bId, cId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [aId, bId, cId] } } });
    // departments/services cascade via the users' FKs being removed first;
    // delete leftover scope rows by tag-prefixed name.
    await prisma.service.deleteMany({
      where: { name: { startsWith: 'sec030-s' } },
    });
    await prisma.department.deleteMany({
      where: { name: { startsWith: 'sec030-d' } },
    });
    await prisma.$disconnect();
  });

  // -- Scope core (the shared predicate underpinning every by-user endpoint) --
  it('canManageUser: A cannot manage out-of-scope B, can manage same-service C', async () => {
    await expect(accessScope.canManageUser(bId, manager(aId))).resolves.toBe(
      false,
    );
    await expect(accessScope.canManageUser(cId, manager(aId))).resolves.toBe(
      true,
    );
  });

  // -- GET /leaves/balance/:userId --
  describe('leaves.getUserBalance', () => {
    it('REJECTS A reading out-of-scope B (RED before fix)', async () => {
      await expect(
        leavesController.getUserBalance(bId, manager(aId)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ALLOWS A reading own balance', async () => {
      await expect(
        leavesController.getUserBalance(aId, manager(aId)),
      ).resolves.toMatchObject({ userId: aId });
    });

    it('ALLOWS A reading same-service peer C', async () => {
      await expect(
        leavesController.getUserBalance(cId, manager(aId)),
      ).resolves.toMatchObject({ userId: cId });
    });
  });

  // -- GET /skills/user/:userId --
  describe('skills.getUserSkills', () => {
    it('REJECTS A reading out-of-scope B (RED before fix)', async () => {
      await expect(
        skillsController.getUserSkills(bId, manager(aId)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ALLOWS A reading own skills', async () => {
      await expect(
        skillsController.getUserSkills(aId, manager(aId)),
      ).resolves.toMatchObject({ userId: aId });
    });

    it('ALLOWS A reading same-service peer C', async () => {
      await expect(
        skillsController.getUserSkills(cId, manager(aId)),
      ).resolves.toMatchObject({ userId: cId });
    });
  });
});
