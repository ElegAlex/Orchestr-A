import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EpicsService } from './epics.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../rbac/permissions.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from 'database';

describe('EpicsService', () => {
  let service: EpicsService;

  const mockPrismaService = {
    epic: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    projectMember: {
      count: vi.fn(),
    },
  };

  const mockPermissionsService = {
    getPermissionsForRole: vi.fn(),
  };

  beforeEach(async () => {
    // Default: only the ADMIN template grants the projects:manage_any bypass;
    // every other role resolves to no bypass permission (mirror of the real
    // template resolution in PermissionsService.getPermissionsForRole).
    mockPermissionsService.getPermissionsForRole.mockImplementation((role) =>
      Promise.resolve(role === 'ADMIN' ? ['projects:manage_any'] : []),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpicsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    service = module.get<EpicsService>(EpicsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createEpicDto = {
      name: 'User Authentication',
      description: 'Epic for all auth features',
      projectId: 'project-1',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
    };

    it('should create an epic successfully', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockEpic = {
        id: '1',
        name: createEpicDto.name,
        description: createEpicDto.description,
        projectId: createEpicDto.projectId,
        startDate: new Date(createEpicDto.startDate),
        endDate: new Date(createEpicDto.endDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.create.mockResolvedValue(mockEpic);

      const result = await service.create(createEpicDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createEpicDto.name);
    });

    it('should throw error when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createEpicDto)).rejects.toThrow(
        'Projet introuvable',
      );
    });

    it('SEC-004 — non-member without projects:manage_any cannot create an epic', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]); // no bypass
      mockPrismaService.projectMember.count.mockResolvedValue(0); // not a member

      await expect(
        service.create(createEpicDto, 'user-nonmember', 'CONTRIBUTEUR'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaService.epic.create).not.toHaveBeenCalled();
    });

    it('SEC-004 — a project member can create an epic', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.projectMember.count.mockResolvedValue(1); // is a member
      mockPrismaService.epic.create.mockResolvedValue({ id: '1' });

      await service.create(createEpicDto, 'user-member', 'CONTRIBUTEUR');
      expect(mockPrismaService.projectMember.count).toHaveBeenCalledWith({
        where: { projectId: 'project-1', userId: 'user-member' },
      });
      expect(mockPrismaService.epic.create).toHaveBeenCalled();
    });

    it('SEC-004 — projects:manage_any bypasses the membership gate', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.epic.create.mockResolvedValue({ id: '1' });

      await service.create(createEpicDto, 'admin-user', 'ADMIN');
      expect(mockPrismaService.projectMember.count).not.toHaveBeenCalled();
      expect(mockPrismaService.epic.create).toHaveBeenCalled();
    });
  });

  describe('findOne (SEC-008)', () => {
    it('does not leak the full parent project row (slim id+name select only)', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({
        id: '1',
        project: { id: 'p1', name: 'P' },
        tasks: [],
      });

      await service.findOne('1');

      const call = mockPrismaService.epic.findUnique.mock.calls[0][0];
      expect(call.include.project).toEqual({
        select: { id: true, name: true },
      });
      // Regression guard: a bare `project: true` would re-expose budget/dates/createdById.
      expect(call.include.project).not.toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return paginated epics', async () => {
      const mockEpics = [
        {
          id: '1',
          name: 'Epic 1',
          projectId: 'project-1',
        },
        {
          id: '2',
          name: 'Epic 2',
          projectId: 'project-1',
        },
      ];

      mockPrismaService.epic.findMany.mockResolvedValue(mockEpics);
      mockPrismaService.epic.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(2);
    });

    it('SEC-006 — non-privileged caller only sees epics from projects they are a member of', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.epic.findMany.mockResolvedValue([]);
      mockPrismaService.epic.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, 'user-1', 'CONTRIBUTEUR');

      // The WHERE clause forwarded to Prisma must scope to member projects
      const findManyCall = mockPrismaService.epic.findMany.mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({
        project: { members: { some: { userId: 'user-1' } } },
      });
    });

    it('SEC-006 — ADMIN (projects:manage_any) sees all epics without membership filter', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.epic.findMany.mockResolvedValue([]);
      mockPrismaService.epic.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, 'admin-1', 'ADMIN');

      const findManyCall = mockPrismaService.epic.findMany.mock.calls[0][0];
      // No membership filter for privileged caller
      expect(findManyCall.where).not.toHaveProperty('project');
    });
  });

  describe('findOne', () => {
    it('should return an epic by id', async () => {
      const mockEpic = {
        id: '1',
        name: 'User Authentication',
        projectId: 'project-1',
      };

      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw error when epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Epic introuvable',
      );
    });
  });

  describe('update', () => {
    it('should update an epic successfully', async () => {
      const updateDto = {
        name: 'Updated Epic Name',
        description: 'Updated description',
      };

      const existingEpic = {
        id: '1',
        name: 'Old Name',
        projectId: 'project-1',
      };

      const updatedEpic = {
        ...existingEpic,
        ...updateDto,
      };

      mockPrismaService.epic.findUnique.mockResolvedValue(existingEpic);
      mockPrismaService.epic.update.mockResolvedValue(updatedEpic);

      const result = await service.update('1', updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Epic Name');
    });
  });

  describe('remove', () => {
    it('should delete an epic', async () => {
      const mockEpic = {
        id: '1',
        name: 'Epic',
        tasks: [],
      };

      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.epic.delete.mockResolvedValue(mockEpic);

      await service.remove('1');

      expect(mockPrismaService.epic.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update with project membership check', () => {
    // After PER-004 fix: assertProjectMembership fetches a slim epic (id +
    // projectId only) then calls projectMember.count — no full members array.
    const mockEpicSlim = { id: '1', projectId: 'project-1' };
    const mockEpicFull = {
      id: '1',
      name: 'Epic',
      tasks: [],
      project: { id: 'project-1', name: 'Project' },
    };

    it('should skip membership check when no currentUserId', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicFull);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicFull,
        name: 'Updated',
      });

      const result = await service.update('1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      // findUnique should be called once for findOne (not for membership check)
    });

    it('should bypass membership check for ADMIN role', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicFull);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicFull,
        name: 'Admin Updated',
      });

      const result = await service.update(
        '1',
        { name: 'Admin Updated' },
        'admin-user',
        'ADMIN',
      );

      expect(result.name).toBe('Admin Updated');
    });

    it('should allow member to update', async () => {
      // assertProjectMembership: slim epic lookup + projectMember.count=1
      // findOne: full epic lookup
      mockPrismaService.epic.findUnique
        .mockResolvedValueOnce(mockEpicSlim)
        .mockResolvedValueOnce(mockEpicFull);
      mockPrismaService.projectMember.count.mockResolvedValue(1);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicFull,
        name: 'Member Updated',
      });

      const result = await service.update(
        '1',
        { name: 'Member Updated' },
        'user-1',
        'CONTRIBUTEUR',
      );

      expect(result.name).toBe('Member Updated');
    });

    it('should throw ForbiddenException when non-member tries to update', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicSlim);
      mockPrismaService.projectMember.count.mockResolvedValue(0);

      await expect(
        service.update(
          '1',
          { name: 'Forbidden' },
          'non-member',
          'CONTRIBUTEUR',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove with project membership check', () => {
    const mockEpicSlim = { id: '1', projectId: 'project-1' };
    const mockEpicFull = {
      id: '1',
      name: 'Epic',
      tasks: [],
      project: { id: 'project-1', name: 'Project' },
    };

    it('should throw ForbiddenException when non-member tries to remove', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicSlim);
      mockPrismaService.projectMember.count.mockResolvedValue(0);

      await expect(
        service.remove('1', 'non-member', 'CONTRIBUTEUR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should skip membership check when no currentUserId is provided to remove', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicFull);
      mockPrismaService.epic.delete.mockResolvedValue(mockEpicFull);

      const result = await service.remove('1');

      expect(result).toEqual({ message: 'Epic supprimé avec succès' });
    });
  });

  // COR-001 — the membership bypass must rest on the resolved
  // `projects:manage_any` permission, never on the literal role code 'ADMIN'.
  // The member-passes regression is covered by 'should allow member to update'
  // above; the witness that matters here is the institutional-role bypass.
  describe('assertProjectMembership permission bypass (COR-001)', () => {
    const mockEpicSlim = { id: '1', projectId: 'project-1' };
    const mockEpicFull = {
      id: '1',
      name: 'Epic',
      tasks: [],
      project: { id: 'project-1', name: 'Project' },
    };

    it('should bypass membership for a non-ADMIN role whose resolved permissions include projects:manage_any', async () => {
      // Institutional role bound to the ADMIN template: its code is NOT the
      // literal 'ADMIN', but its resolved permissions include the bypass.
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([
        'projects:manage_any',
      ]);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicFull);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpicFull,
        name: 'Institutional Admin Updated',
      });

      // 'direction-si' is NOT a project member — the ONLY thing letting the
      // update through is the manage_any bypass.
      const result = await service.update(
        '1',
        { name: 'Institutional Admin Updated' },
        'direction-si',
        'DIRECTION_SI',
      );

      expect(result.name).toBe('Institutional Admin Updated');
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith(
        'DIRECTION_SI',
      );
    });

    it('should throw ForbiddenException for a non-member role without projects:manage_any', async () => {
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpicSlim);
      mockPrismaService.projectMember.count.mockResolvedValue(0);

      await expect(
        service.update(
          '1',
          { name: 'Forbidden' },
          'non-member',
          'DIRECTION_SI',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // PER-004 — assertProjectMembership must fire a targeted count query rather
  // than fetching the full members array and filtering in-memory.
  describe('PER-004 — assertProjectMembership uses projectMember.count not full members include', () => {
    it('PER-004 — only prisma.projectMember.count fires, never an include:members fetch', async () => {
      // Non-privileged caller
      mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
      // Slim epic returned by the targeted findUnique in assertProjectMembership
      mockPrismaService.epic.findUnique.mockResolvedValueOnce({
        id: 'epic-1',
        projectId: 'proj-1',
      });
      // count=1 → member found
      mockPrismaService.projectMember.count.mockResolvedValue(1);
      // Full epic for findOne (second call)
      mockPrismaService.epic.findUnique.mockResolvedValueOnce({
        id: 'epic-1',
        name: 'Epic',
        projectId: 'proj-1',
        project: { id: 'proj-1' },
        tasks: [],
      });
      mockPrismaService.epic.update.mockResolvedValue({
        id: 'epic-1',
        name: 'Updated',
      });

      await service.update(
        'epic-1',
        { name: 'Updated' },
        'user-1',
        'CONTRIBUTEUR',
      );

      // projectMember.count must have been called with the targeted where clause
      expect(mockPrismaService.projectMember.count).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', userId: 'user-1' },
      });

      // The assertProjectMembership findUnique must NOT include members
      const membershipCall = mockPrismaService.epic.findUnique.mock.calls[0][0];
      expect(membershipCall).not.toHaveProperty('include');
    });
  });

  // COR-052 — update/remove must catch Prisma P2025 and surface NotFoundException
  // instead of letting an unhandled error bubble as a 500.
  describe('COR-052 — update/remove catch P2025 (concurrent delete) → NotFoundException', () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      { code: 'P2025', clientVersion: 'test' },
    );

    it('COR-052 — update() throws NotFoundException when epic.update raises P2025', async () => {
      // findOne passes (epic exists at read time), but update hits P2025
      mockPrismaService.epic.findUnique.mockResolvedValue({
        id: '1',
        name: 'Epic',
        tasks: [],
        project: { id: 'project-1', name: 'Project' },
      });
      mockPrismaService.epic.update.mockRejectedValueOnce(p2025);

      await expect(service.update('1', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('COR-052 — remove() throws NotFoundException when epic.delete raises P2025', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({
        id: '1',
        name: 'Epic',
        tasks: [],
        project: { id: 'project-1', name: 'Project' },
      });
      mockPrismaService.epic.delete.mockRejectedValueOnce(p2025);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
